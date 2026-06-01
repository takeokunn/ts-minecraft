// @effect-boundary Worker entrypoint catches host exceptions and reports structured failures.
import { Option, Schema } from 'effect'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world'
import { LIGHT_BYTE_LENGTH } from '@ts-minecraft/block'
import type { LightGrids } from '@ts-minecraft/block'
import { greedyMeshChunk } from '@ts-minecraft/rendering/infrastructure/meshing/greedy-meshing'
import { createGreedyMeshScratch } from '@ts-minecraft/rendering/infrastructure/meshing/greedy-meshing-types'
import { LodLevelSchema, simplifyMesh } from '@ts-minecraft/rendering/infrastructure/meshing/lod-simplification'

// Message shapes for the meshing worker protocol.
//
// Input: chunk.blocks ArrayBuffer is *transferred* (zero-copy); transparentBlockIds is a
// small plain array (typically [6] for WATER). wx/wz are world-space block coordinates.
// skyLight/blockLight ArrayBuffers are also transferred when lighting is computed for the
// chunk; both null means the worker defaults to all-daylight (sky=15, block=0).
//
// Output: all TypedArrays are *transferred* back to main thread (zero-copy).
// null water arrays signal that this chunk has no transparent faces.
// FR-4.1: optional dirty AABB describing the chunk-local subregion that
// changed. Forwarded through the protocol so the worker can attach a hint to
// its response (the actual sub-region splice happens on the main thread,
// where the previous mesh is reachable). When omitted the worker performs a
// behaviour-preserving full re-mesh.
const DirtyAABBSchema = Schema.Struct({
  minX: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  maxX: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  minY: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  maxY: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  minZ: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  maxZ: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})

export const MeshRequestSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  blocks: Schema.instanceOf(ArrayBuffer),
  fluid: Schema.optionalWith(Schema.NullOr(Schema.instanceOf(ArrayBuffer)), { default: () => null }),
  skyLight: Schema.NullOr(Schema.instanceOf(ArrayBuffer)),
  blockLight: Schema.NullOr(Schema.instanceOf(ArrayBuffer)),
  wx: Schema.Number.pipe(Schema.int()),
  wz: Schema.Number.pipe(Schema.int()),
  transparentBlockIds: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
  // Transparent-solid block IDs (GLASS, LEAVES) — atlas material + alpha blending, NOT water shader.
  transparentSolidBlockIds: Schema.optionalWith(
    Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
    { default: () => [] as readonly number[] }
  ),
  // FR-3.2: LOD level applied AFTER greedy meshing. Optional with default 0.
  lod: Schema.optionalWith(LodLevelSchema, { default: () => 0 as const }),
  // FR-4.1: optional dirtyAABB; the worker currently full-re-meshes regardless,
  // but the field is forwarded so future worker-side splicing remains a
  // protocol-level no-op when omitted.
  dirtyAABB: Schema.optionalWith(Schema.NullOr(DirtyAABBSchema), { default: () => null }),
})
export type MeshRequest = Schema.Schema.Type<typeof MeshRequestSchema>

const scratch = createGreedyMeshScratch()

const decodeRequestSync = Schema.decodeUnknownSync(MeshRequestSchema)

self.onmessage = (e: MessageEvent<unknown>): void => {
  // Pull `id` from the raw payload first so a malformed request still gets
  // routed back to the correct caller as a `failure`. We treat anything that
  // isn't a plain object with a numeric `id` as id=-1 — the pool ignores
  // unrecognized ids, which is the right behaviour for a structurally-broken
  // message.
  const raw = e.data as { id?: unknown } | null | undefined
  const fallbackId = typeof raw?.id === 'number' && Number.isFinite(raw.id) ? raw.id : -1

  let req: MeshRequest
  try {
    req = decodeRequestSync(e.data)
  } catch (err) {
    self.postMessage({
      id: fallbackId,
      kind: 'failure',
      error: String(err),
    })
    return
  }

  // dirtyAABB is accepted but currently unused — the worker always returns a
  // full re-mesh; sub-region splicing is performed on the main thread (only
  // the main thread has access to the previous WorkerMeshResult).
  const { id, blocks, fluid, skyLight, blockLight, wx, wz, transparentBlockIds, transparentSolidBlockIds, lod } = req

  // Reconstruct a minimal Chunk — greedyMeshChunk only reads chunk.blocks; coord
  // is required by the type but unused inside the meshing algorithm (offset carries
  // the world position).
  const chunk: Chunk = {
    coord: { x: Math.floor(wx / CHUNK_SIZE), z: Math.floor(wz / CHUNK_SIZE) },
    blocks: new Uint8Array(blocks),
    fluid: fluid === null ? Option.none() : Option.some(new Uint8Array(fluid)),
  }

  // Reconstruct LightGrids only when both buffers arrived AND have the expected byte length;
  // a mismatch means stale/corrupted lighting data — fall back to all-daylight default.
  const lightGrids: LightGrids | undefined =
    skyLight !== null && blockLight !== null
      && skyLight.byteLength === LIGHT_BYTE_LENGTH
      && blockLight.byteLength === LIGHT_BYTE_LENGTH
      ? { skyLight: new Uint8Array(skyLight), blockLight: new Uint8Array(blockLight) }
      : undefined

  const result = greedyMeshChunk(
    chunk,
    { wx, wz },
    new Set(transparentBlockIds),
    scratch,
    lightGrids,
    new Set(transparentSolidBlockIds),
  )

  // toMeshed() calls .slice() on each accumulator subarray, producing owned ArrayBuffers
  // per typed array. This allocation is in the worker thread, not the main thread —
  // the main thread only receives transferred (detached) buffers, with zero GC cost.
  const meshed = result.toMeshed()
  // FR-3.2: simplify the opaque pass per requested LOD inside the worker so the
  // main thread receives the smaller buffers directly (no main-thread CPU cost).
  // Water keeps full detail — water is rare at LOD-2 distances and the surface
  // shader benefits from full vertex resolution for ripples.
  const opaque = lod === 0 ? meshed.opaque : simplifyMesh(meshed.opaque, lod)
  const hasWater = meshed.water.positions.length > 0
  const hasTransparentSolid = meshed.transparentSolid.positions.length > 0

  const transferList: ArrayBuffer[] = [
    opaque.positions.buffer,
    opaque.normals.buffer,
    opaque.colors.buffer,
    opaque.uvs.buffer,
    opaque.tileIndexes.buffer,
    opaque.indices.buffer,
  ]

  if (hasWater) {
    transferList.push(
      meshed.water.positions.buffer,
      meshed.water.normals.buffer,
      meshed.water.colors.buffer,
      meshed.water.uvs.buffer,
      meshed.water.tileIndexes.buffer,
      meshed.water.indices.buffer,
    )
  }

  /* c8 ignore start -- transparent solid buffer transfer; only when GLASS/LEAVES are present */
  if (hasTransparentSolid) {
    transferList.push(
      meshed.transparentSolid.positions.buffer,
      meshed.transparentSolid.normals.buffer,
      meshed.transparentSolid.colors.buffer,
      meshed.transparentSolid.uvs.buffer,
      meshed.transparentSolid.tileIndexes.buffer,
      meshed.transparentSolid.indices.buffer,
    )
  }
  /* c8 ignore end */

  self.postMessage(
    {
      id,
      opositions: opaque.positions,
      onormals: opaque.normals,
      ocolors: opaque.colors,
      ouvs: opaque.uvs,
      otileIndexes: opaque.tileIndexes,
      oindices: opaque.indices,
      wpositions: hasWater ? meshed.water.positions : null,
      wnormals: hasWater ? meshed.water.normals : null,
      wcolors: hasWater ? meshed.water.colors : null,
      wuvs: hasWater ? meshed.water.uvs : null,
      wtileIndexes: hasWater ? meshed.water.tileIndexes : null,
      windices: hasWater ? meshed.water.indices : null,
      tspositions: hasTransparentSolid ? meshed.transparentSolid.positions : null,
      tsnormals: hasTransparentSolid ? meshed.transparentSolid.normals : null,
      tscolors: hasTransparentSolid ? meshed.transparentSolid.colors : null,
      tsuvs: hasTransparentSolid ? meshed.transparentSolid.uvs : null,
      tstileIndexes: hasTransparentSolid ? meshed.transparentSolid.tileIndexes : null,
      tsindices: hasTransparentSolid ? meshed.transparentSolid.indices : null,
    },
    transferList
  )
}
