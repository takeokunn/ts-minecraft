import { Option, Schema } from 'effect'
import { CHUNK_SIZE } from '@ts-minecraft/kernel'
import type { Chunk } from '@ts-minecraft/terrain'
import { LIGHT_BYTE_LENGTH } from '@ts-minecraft/world-state'
import type { LightGrids } from '@ts-minecraft/world-state'
import { createGreedyMeshScratch, greedyMeshChunk } from './greedy-meshing'

// Message shapes for the meshing worker protocol.
//
// Input: chunk.blocks ArrayBuffer is *transferred* (zero-copy); transparentBlockIds is a
// small plain array (typically [6] for WATER). wx/wz are world-space block coordinates.
// skyLight/blockLight ArrayBuffers are also transferred when lighting is computed for the
// chunk; both null means the worker defaults to all-daylight (sky=15, block=0).
//
// Output: all TypedArrays are *transferred* back to main thread (zero-copy).
// null water arrays signal that this chunk has no transparent faces.
export const MeshRequestSchema = Schema.Struct({
  id: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  blocks: Schema.instanceOf(ArrayBuffer),
  skyLight: Schema.NullOr(Schema.instanceOf(ArrayBuffer)),
  blockLight: Schema.NullOr(Schema.instanceOf(ArrayBuffer)),
  wx: Schema.Number.pipe(Schema.int()),
  wz: Schema.Number.pipe(Schema.int()),
  transparentBlockIds: Schema.Array(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
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

  const { id, blocks, skyLight, blockLight, wx, wz, transparentBlockIds } = req

  // Reconstruct a minimal Chunk — greedyMeshChunk only reads chunk.blocks; coord
  // is required by the type but unused inside the meshing algorithm (offset carries
  // the world position).
  const chunk: Chunk = {
    coord: { x: Math.floor(wx / CHUNK_SIZE), z: Math.floor(wz / CHUNK_SIZE) },
    blocks: new Uint8Array(blocks),
    fluid: Option.none(),
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
  )

  // toMeshed() calls .slice() on each accumulator subarray, producing owned ArrayBuffers
  // per typed array. This allocation is in the worker thread, not the main thread —
  // the main thread only receives transferred (detached) buffers, with zero GC cost.
  const meshed = result.toMeshed()
  const hasWater = meshed.water.positions.length > 0

  const transferList: ArrayBuffer[] = [
    meshed.opaque.positions.buffer,
    meshed.opaque.normals.buffer,
    meshed.opaque.colors.buffer,
    meshed.opaque.uvs.buffer,
    meshed.opaque.tileIndexes.buffer,
    meshed.opaque.indices.buffer,
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

  self.postMessage(
    {
      id,
      opositions: meshed.opaque.positions,
      onormals: meshed.opaque.normals,
      ocolors: meshed.opaque.colors,
      ouvs: meshed.opaque.uvs,
      otileIndexes: meshed.opaque.tileIndexes,
      oindices: meshed.opaque.indices,
      wpositions: hasWater ? meshed.water.positions : null,
      wnormals: hasWater ? meshed.water.normals : null,
      wcolors: hasWater ? meshed.water.colors : null,
      wuvs: hasWater ? meshed.water.uvs : null,
      wtileIndexes: hasWater ? meshed.water.tileIndexes : null,
      windices: hasWater ? meshed.water.indices : null,
    },
    transferList
  )
}
