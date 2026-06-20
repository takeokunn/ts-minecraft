import { Option } from 'effect'
import { greedyMeshChunk } from '@ts-minecraft/rendering/infrastructure/meshing/greedy-meshing'
import { createGreedyMeshScratch, type GreedyMeshResult } from '@ts-minecraft/rendering/infrastructure/meshing/greedy-meshing-types'
import { greedyMeshChunkSubregion } from '@ts-minecraft/rendering/infrastructure/meshing/subregion-greedy'
import { simplifyMesh, type LodLevel } from '@ts-minecraft/rendering/infrastructure/meshing/lod-simplification'
import type { LightGrids } from '@ts-minecraft/block/domain/light'
import { CHUNK_SIZE, type ChunkCoord } from '@ts-minecraft/core'
import type { Chunk, ChunkAABB } from '@ts-minecraft/world'
import type { WorkerMeshResult } from './meshing-worker-pool-protocol'
import { TRANSPARENT_IDS_SET, TRANSPARENT_SOLID_IDS_SET } from './meshing-worker-config'

const lightGridsFromChunk = (chunk: Chunk): LightGrids | undefined => {
  const grids = Option.getOrNull(Option.all([
    Option.fromNullable(chunk.skyLight),
    Option.fromNullable(chunk.blockLight),
  ] as const))
  if (grids === null) return undefined
  const [skyLight, blockLight] = grids
  return { skyLight, blockLight }
}

// Per-coord cache key for the previous full GreedyMeshResult — used by the
// FR-4.1 sub-region splice path. Keying by coord (not by Chunk identity)
// matches the production scene-graph invariant: at most one mesh exists per
// chunk coord at a time.
const coordCacheKey = (coord: ChunkCoord): string => `${coord.x},${coord.z}`

// Bound the sync fallback prev-mesh cache. Each cached full mesh result owns
// typed-array buffers, so a missing release call should not be able to retain
// unbounded chunk-sized allocations on low-memory devices.
export const MAX_SYNC_PREV_MESH_CACHE_ENTRIES = 32

const cachePrevMesh = (prevByCoord: Map<string, GreedyMeshResult>, cacheKey: string, result: GreedyMeshResult): void => {
  prevByCoord.delete(cacheKey)
  prevByCoord.set(cacheKey, result)

  if (prevByCoord.size <= MAX_SYNC_PREV_MESH_CACHE_ENTRIES) return

  const oldestKey = prevByCoord.keys().next().value
  if (oldestKey !== undefined) prevByCoord.delete(oldestKey)
}

// SEC-W1: surface returned by `createSyncChunkMesher` — the mesh function and
// an explicit `releasePrev` to evict a coord's cached LOD-0 prev when the
// chunk is removed from the scene. Without `releasePrev`, the inner
// `prevByCoord` map grows unbounded for the lifetime of the meshing service
// (≈ ~360KB per cached chunk × thousands of evicted chunks under the sync
// fallback path).
export type SyncChunkMesher = {
  readonly mesh: (chunk: Chunk, lod: LodLevel, dirtyAABB?: ChunkAABB) => WorkerMeshResult
  readonly releasePrev: (coord: ChunkCoord) => void
}

export const createSyncChunkMesher = (): SyncChunkMesher => {
  const scratch = createGreedyMeshScratch()
  // FR-4.1: cache the most recent LOD-0 GreedyMeshResult per chunk coord so
  // a follow-up call carrying `dirtyAABB` can splice the unaffected slices.
  // The result's raw arrays are owned by per-call accumulators (NOT the
  // shared scratch), so caching across calls is safe — see
  // greedy-meshing.ts toRawMeshData where each call allocates new
  // accumulator buffers. The map is bounded because the sync path runs on the
  // main thread in no-Worker environments where memory pressure is most likely.
  const prevByCoord = new Map<string, GreedyMeshResult>()

  const mesh = (chunk: Chunk, lod: LodLevel, dirtyAABB?: ChunkAABB): WorkerMeshResult => {
    const offset = { wx: chunk.coord.x * CHUNK_SIZE, wz: chunk.coord.z * CHUNK_SIZE }
    const lights = lightGridsFromChunk(chunk)
    const cacheKey = coordCacheKey(chunk.coord)

    // FR-4.1 sub-region path: opt-in via dirtyAABB AND a cached prev result.
    // Sub-region splicing is restricted to LOD 0 because the simplifier
    // applied at LOD 1/2 produces a different vertex layout that cannot be
    // spliced byte-equivalently against the cached LOD-0 prev.
    const prev = prevByCoord.get(cacheKey)
    const result =
      dirtyAABB !== undefined && lod === 0 && prev !== undefined
        ? greedyMeshChunkSubregion(
            chunk,
            offset,
            { dirtyAABB, prev },
            TRANSPARENT_IDS_SET,
            scratch,
            lights,
            TRANSPARENT_SOLID_IDS_SET,
          )
        : greedyMeshChunk(chunk, offset, TRANSPARENT_IDS_SET, scratch, lights, TRANSPARENT_SOLID_IDS_SET)

    // Update the cache only for LOD 0 (LOD 1/2 produces simplified buffers
    // we cannot use as a future splice prev). Cache is updated regardless of
    // whether THIS call used the splice path — the splice output is itself a
    // valid prev for the next edit.
    if (lod === 0) cachePrevMesh(prevByCoord, cacheKey, result)

    const meshed = result.toMeshed()
    // FR-3.1: simplify the opaque pass per the requested LOD. Water meshes
    // skip simplification — water is rare at LOD-2 distances and the surface
    // shader benefits from full vertex resolution for ripples.
    const opaque = lod === 0 ? meshed.opaque : simplifyMesh(meshed.opaque, lod)
    return {
      opaque,
      water: meshed.water.positions.length > 0 ? meshed.water : null,
      transparentSolid: meshed.transparentSolid.positions.length > 0 ? meshed.transparentSolid : null,
    }
  }

  // SEC-W1: drop the cached prev for `coord`. The next call for that coord
  // (whether a fresh load or an edit carrying `dirtyAABB`) will fall back to
  // a full re-mesh — the splice path requires a cached prev. This is safe:
  // when a chunk is evicted from the scene the splice "prev" is no longer a
  // valid baseline (the chunk could be reloaded with completely different
  // contents), so dropping it is also correctness-preserving.
  const releasePrev = (coord: ChunkCoord): void => {
    prevByCoord.delete(coordCacheKey(coord))
  }

  return { mesh, releasePrev }
}
