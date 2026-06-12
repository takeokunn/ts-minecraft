import { Option } from 'effect'
import { Chunk } from '@ts-minecraft/world'
import {
  type LightGrids,
} from '@ts-minecraft/block'

// Re-export all public API so meshing/index.ts and meshing-worker-pool.ts imports still work.
export * from './greedy-meshing-types'
export * from './greedy-meshing-quads'

import {
  EMPTY_MESHED_CHUNK,
  MeshedChunk,
  RawMeshData,
  ChunkWorldOffset,
  GreedyMeshScratch,
  GreedyMeshResult,
  createGreedyMeshScratch,
} from './greedy-meshing-types'

import {
  MeshAccumulator,
  MeshAccumulatorPool,
  createAccumulator,
  resetAccumulator,
} from './greedy-meshing-quads'

import type { FacePassState } from './greedy-meshing-passes'

import { meshFluidFaces } from './greedy-meshing-fluids'
import {
  meshXPosFace,
  meshXNegFace,
  meshYPosFace,
  meshYNegFace,
  meshZPosFace,
  meshZNegFace,
} from './greedy-meshing-algorithms'

// ─── Lookup table cache ──────────────────────────────────────────────────────
// Build a 256-entry Uint8Array lookup for a set of block IDs.  The WeakMap key
// is the Set *identity*, so callers that pass the same module-level constant
// Set every call pay the build cost exactly once.  Worker-thread callers that
// reconstruct a new Set per message will rebuild once per message — acceptable
// because that work runs off the main thread and the resulting lookup is still
// faster than iterating a Set in the inner meshing loop.
const _lookupCache = new WeakMap<ReadonlySet<number>, Uint8Array>()
const buildLookup = (ids: ReadonlySet<number>): Uint8Array => {
  let tbl = _lookupCache.get(ids)
  if (tbl === undefined) {
    tbl = new Uint8Array(256)
    for (const id of ids) tbl[id] = 1
    _lookupCache.set(ids, tbl)
  }
  return tbl
}

// ─── Main meshing function ───────────────────────────────────────────────────

export const greedyMeshChunk = (
  chunk: Chunk,
  offset: ChunkWorldOffset,
  transparentBlockIds: ReadonlySet<number> = new Set(),
  scratch: GreedyMeshScratch = createGreedyMeshScratch(),
  lightGrids?: LightGrids,
  transparentSolidBlockIds: ReadonlySet<number> = new Set(),
  // Optional reusable accumulator pool. When provided, the ~1.13 MB typed-array set is
  // reused instead of allocated per call. SAFE ONLY for a serial caller that fully copies
  // the mesh out (toMeshed()) before the next call and never retains the raw subarray
  // views — i.e. the meshing worker. The sync/sub-region callers MUST omit it (they keep
  // a `prev` mesh whose views alias the accumulator buffers).
  pool?: MeshAccumulatorPool,
): GreedyMeshResult => {
  // opaque is always used → reset eagerly. water/transparentSolid stay lazy so the
  // "null === no such faces" signal (waterRaw/transparentSolidRaw below) is preserved:
  // the pooled accumulator is taken (and reset) only on the first face that needs it.
  const opaqueAcc = pool ? resetAccumulator(pool.opaque) : createAccumulator()
  let waterAccStorage: MeshAccumulator | null = null
  let transparentSolidAccStorage: MeshAccumulator | null = null
  const transparentLookup = buildLookup(transparentBlockIds)
  const transparentSolidLookup = buildLookup(transparentSolidBlockIds)

  const { maskCH, maskSS } = scratch
  const blocks: Readonly<Uint8Array> = chunk.blocks
  const getWaterAcc = (): MeshAccumulator =>
    (waterAccStorage ??= pool ? resetAccumulator(pool.water) : createAccumulator())
  const getTransparentSolidAcc = (): MeshAccumulator =>
    (transparentSolidAccStorage ??= pool ? resetAccumulator(pool.transparentSolid) : createAccumulator())

  const state: FacePassState = {
    blocks,
    lightGrids,
    maskCH,
    maskSS,
    opaqueAcc,
    getWaterAcc,
    transparentLookup,
    getTransparentSolidAcc,
    transparentSolidLookup,
    offset,
  }

  meshXPosFace(state)
  meshXNegFace(state)
  meshYPosFace(state)
  meshYNegFace(state)
  meshZPosFace(state)
  meshZNegFace(state)
  meshFluidFaces(
    blocks,
    Option.getOrUndefined(chunk.fluid),
    lightGrids,
    opaqueAcc,
    getWaterAcc,
    transparentLookup,
    transparentSolidLookup,
    offset,
  )

  // Construct RawMeshData directly from the accumulator's typed arrays. These buffers
  // are produced internally by the face passes above, so Schema validation is redundant
  // overhead on the per-chunk-mesh hot path (and risks throwing outside Effect's error
  // channel). Mirrors decodeRaw in subregion-greedy-splice.ts.
  const toRawMeshData = (a: MeshAccumulator): RawMeshData => ({
    positions: a.positions.subarray(0, a.vertexCount * 3),
    normals: a.normals.subarray(0, a.vertexCount * 3),
    colors: a.colors.subarray(0, a.vertexCount * 3),
    uvs: a.uvs.subarray(0, a.vertexCount * 2),
    tileIndexes: a.tileIndexes.subarray(0, a.vertexCount),
    indices: a.indices.subarray(0, a.indexCount),
    vertexCount: a.vertexCount,
    indexCount: a.indexCount,
  })

  const toMeshedChunk = (raw: RawMeshData): MeshedChunk => ({
    positions: raw.positions.slice(),
    normals: raw.normals.slice(),
    colors: raw.colors.slice(),
    uvs: raw.uvs.slice(),
    tileIndexes: raw.tileIndexes.slice(),
    indices: raw.indices.slice(),
  })

  const opaqueRaw = toRawMeshData(opaqueAcc)
  const waterRaw = waterAccStorage !== null ? toRawMeshData(waterAccStorage) : null
  const transparentSolidRaw = transparentSolidAccStorage !== null ? toRawMeshData(transparentSolidAccStorage) : null

  // Lazy cache: toMeshed() allocates sliced copies on first call, then returns the cached result.
  let _meshedCache: { opaque: MeshedChunk; water: MeshedChunk; transparentSolid: MeshedChunk } | null = null
  const toMeshed = (): { opaque: MeshedChunk; water: MeshedChunk; transparentSolid: MeshedChunk } => {
    if (_meshedCache === null) {
      _meshedCache = {
        opaque: toMeshedChunk(opaqueRaw),
        water: waterRaw !== null ? toMeshedChunk(waterRaw) : EMPTY_MESHED_CHUNK,
        transparentSolid: transparentSolidRaw !== null ? toMeshedChunk(transparentSolidRaw) : EMPTY_MESHED_CHUNK,
      }
    }
    return _meshedCache
  }

  return {
    opaqueRaw,
    waterRaw,
    transparentSolidRaw,
    toMeshed,
  }
}
