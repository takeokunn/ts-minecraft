import { Effect, HashMap, Option, Ref } from 'effect'
import * as THREE from 'three'
import { ChunkCacheKey } from '@ts-minecraft/core'
import { Chunk } from '@ts-minecraft/world'
import { ChunkMeshService } from '../meshing/chunk-mesh'
import { lodForDistance, LOD1_DISTANCE_CHUNKS, LOD2_DISTANCE_CHUNKS, type LodLevel } from '../meshing/lod-simplification'
import { SceneService } from '../scene/scene-service'
import {
  MAX_CHUNK_UPDATES_PER_FRAME,
  MAX_CHUNK_REMOVALS_PER_FRAME,
  WORLD_RENDERER_TIME_BUDGET_MS,
  CHUNK_SYNC_CONCURRENCY,
  type ChunkMeshes,
} from './world-renderer-types'
import { nowMs, chunkKey, disposeMesh } from './world-renderer-utils'

// LOD hysteresis margin (in chunks). The per-chunk LOD band is selected from a player
// proxy (the centroid of the loaded-chunk window), which jitters by up to ~1 chunk as
// chunks load/unload asymmetrically while the player moves. Without hysteresis, chunks
// sitting on a LOD-band boundary flip-flop their LOD every time that jitter nudges the
// centroid across the threshold — and every flip is a wasted chunk re-mesh + GPU buffer
// re-upload during the dominant gameplay state (walking). A 1-chunk dead-zone around each
// boundary absorbs the jitter while still switching LOD on a genuine band crossing.
const LOD_HYSTERESIS_CHUNKS = 1

// Returns the LOD a chunk should have given its distance and its CURRENT lod: it keeps the
// current lod while the distance stays within the current band widened by the hysteresis
// margin on each side, otherwise recomputes from scratch.
export const lodWithHysteresis = (distance: number, currentLod: LodLevel): LodLevel => {
  const withinLower =
    currentLod === 0 ||
    distance >= (currentLod === 1 ? LOD1_DISTANCE_CHUNKS : LOD2_DISTANCE_CHUNKS) - LOD_HYSTERESIS_CHUNKS
  const withinUpper =
    currentLod === 2 ||
    distance < (currentLod === 0 ? LOD1_DISTANCE_CHUNKS : LOD2_DISTANCE_CHUNKS) + LOD_HYSTERESIS_CHUNKS
  return withinLower && withinUpper ? currentLod : lodForDistance(distance)
}

export type LoadedChunkSyncWork = {
  readonly newChunks: ReadonlyArray<Chunk>
  readonly lodChangedChunks: ReadonlyArray<Chunk>
}

export const collectLoadedChunkSyncWork = (
  loadedChunks: ReadonlyArray<Chunk>,
  meshes: HashMap.HashMap<ChunkCacheKey, ChunkMeshes>,
  centerX: number,
  centerZ: number,
): LoadedChunkSyncWork => {
  const newChunks: Array<Chunk> = []
  const lodChangedChunks: Array<Chunk> = []
  for (const chunk of loadedChunks) {
    const key = chunkKey(chunk.coord)
    const existing = Option.getOrNull(HashMap.get(meshes, key))
    if (existing === null) {
      newChunks.push(chunk)
      continue
    }
    const dx = Math.abs(chunk.coord.x - centerX)
    const dz = Math.abs(chunk.coord.z - centerZ)
    if (existing.lod !== lodWithHysteresis(Math.max(dx, dz), existing.lod)) {
      lodChangedChunks.push(chunk)
    }
  }
  return { newChunks, lodChangedChunks }
}

export const makeLoadedChunkKeySet = (loadedChunks: ReadonlyArray<Chunk>): Set<ChunkCacheKey> => {
  const loadedKeySet = new Set<ChunkCacheKey>()
  for (const chunk of loadedChunks) {
    loadedKeySet.add(chunkKey(chunk.coord))
  }
  return loadedKeySet
}

export const hasPotentialStaleChunkMeshes = (
  loadedChunkCount: number,
  meshCount: number,
  missingLoadedChunkCount: number,
): boolean => meshCount + missingLoadedChunkCount > loadedChunkCount

export type ChunkRemovalBatch = {
  readonly removalsToProcess: ReadonlyArray<readonly [ChunkCacheKey, ChunkMeshes]>
  readonly allStaleRemoved: boolean
}

export const collectChunkRemovalBatch = (
  meshes: HashMap.HashMap<ChunkCacheKey, ChunkMeshes>,
  loadedKeySet: Set<ChunkCacheKey>,
  maxRemovals: number,
): ChunkRemovalBatch => {
  const removalsToProcess: Array<readonly [ChunkCacheKey, ChunkMeshes]> = []
  let staleCount = 0
  for (const [key, chunkMeshes] of meshes) {
    if (loadedKeySet.has(key)) continue
    staleCount += 1
    if (removalsToProcess.length < maxRemovals) {
      removalsToProcess.push([key, chunkMeshes])
    }
  }
  return { removalsToProcess, allStaleRemoved: staleCount <= removalsToProcess.length }
}

type TrackedMeshes = ReadonlyArray<THREE.Mesh>

const appendTrackedMesh = (
  meshes: TrackedMeshes,
  mesh: THREE.Mesh,
): TrackedMeshes => {
  const nextMeshes = meshes.slice()
  nextMeshes.push(mesh)
  return nextMeshes
}

const removeTrackedMesh = (
  meshes: TrackedMeshes,
  mesh: THREE.Mesh,
): TrackedMeshes => {
  const index = meshes.indexOf(mesh)
  if (index === -1) return meshes
  const nextMeshes = meshes.slice()
  nextMeshes.splice(index, 1)
  return nextMeshes
}

const replaceTrackedMesh = (
  meshes: TrackedMeshes,
  prevMesh: THREE.Mesh,
  nextMesh: THREE.Mesh,
): TrackedMeshes => {
  const index = meshes.indexOf(prevMesh)
  if (index === -1) return appendTrackedMesh(meshes, nextMesh)
  const nextMeshes = meshes.slice()
  nextMeshes[index] = nextMesh
  return nextMeshes
}

export const shouldContinueBudgetedChunkSync = (
  processed: number,
  hardCap: number,
  elapsedMs: number,
  budgetMs: number = WORLD_RENDERER_TIME_BUDGET_MS,
): boolean => processed < hardCap && (processed === 0 || elapsedMs < budgetMs)

export type SyncChunksContext = {
  readonly meshesRef: Ref.Ref<HashMap.HashMap<ChunkCacheKey, ChunkMeshes>>
  readonly waterMeshesRef: Ref.Ref<ReadonlyArray<THREE.Mesh>>
  readonly chunkMeshService: ChunkMeshService
  readonly sceneService: SceneService
  readonly waterMaterial: THREE.ShaderMaterial
  readonly invalidateSceneCaches: () => Effect.Effect<void, never>
}

/**
 * Syncs the Three.js scene to the given set of loaded chunks.
 * Adds meshes for new chunks (throttled by time budget) and removes meshes
 * for chunks that are no longer loaded.
 *
 * Returns `true` when all loaded chunks have meshes; `false` when new chunks
 * were deferred to the next frame.
 */
export const syncChunksToScene = (
  ctx: SyncChunksContext,
  loadedChunks: ReadonlyArray<Chunk>,
  scene: THREE.Scene,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const { meshesRef, waterMeshesRef, chunkMeshService, sceneService, waterMaterial, invalidateSceneCaches } = ctx
    const meshes = yield* Ref.get(meshesRef)
    let nextWaterMeshes = yield* Ref.get(waterMeshesRef)

    // FR-3.1: derive a player-chunk proxy from the centroid of all loaded
    // chunks. `loadedChunks` is the engine's render-distance window which
    // always clusters tightly around the player, so the centroid tracks the
    // player to within one chunk. Used here purely for LOD distance-band
    // selection (no player position threaded through the layer for this).
    let centerX = 0
    let centerZ = 0
    if (loadedChunks.length > 0) {
      for (const chunk of loadedChunks) {
        centerX += chunk.coord.x
        centerZ += chunk.coord.z
      }
      centerX /= loadedChunks.length
      centerZ /= loadedChunks.length
    }
    // Chebyshev (L∞) distance produces square LOD rings around the player,
    // matching the square render-distance window typical of voxel renderers.
    const lodForChunk = (chunk: Chunk): LodLevel => {
      const dx = Math.abs(chunk.coord.x - centerX)
      const dz = Math.abs(chunk.coord.z - centerZ)
      return lodForDistance(Math.max(dx, dz))
    }

    // Early-exit work scan: classify new chunks and LOD changes together without
    // allocating intermediate key arrays. The loaded-key set is still deferred until
    // stale removals are possible, preserving the cheap steady-state path.
    const { newChunks, lodChangedChunks } = collectLoadedChunkSyncWork(loadedChunks, meshes, centerX, centerZ)
    const hasNewChunks = newChunks.length > 0

    // If existing meshes plus currently-missing loaded chunks exceed the loaded window,
    // at least one mesh must be stale. This avoids building a loaded-key Set and scanning
    // all meshes on pure add / pure LOD frames, which are common while walking.
    const hasPotentialStaleMeshes = hasPotentialStaleChunkMeshes(
      loadedChunks.length,
      HashMap.size(meshes),
      newChunks.length,
    )

    const hasLodChanges = lodChangedChunks.length > 0

    if (!hasNewChunks && !hasPotentialStaleMeshes && !hasLodChanges) {
      return true
    }

    // Add meshes for newly loaded chunks not yet in scene. Meshing is a Web Worker
    // round-trip (greedy meshing runs off-thread), so we dispatch up to
    // MAX_CHUNK_UPDATES_PER_FRAME of them IN PARALLEL to keep the whole worker pool
    // busy. The previous concurrency:1 + wall-clock budget left 3 of 4 worker cores
    // idle AND counted worker-await latency against a main-thread budget — the budget
    // was guarding the wrong thing (the old comment's "meshing is mostly main-thread
    // sync work" is false on the worker path). This sync runs on the maintenance fiber,
    // not the render loop, so the parallel await never blocks rendering. The per-frame
    // hard cap bounds the sync geometry-build + GPU-upload cost; chunk order is keyed
    // by cache identity, so any chunks beyond the cap drain next frame (the caller
    // re-fires while chunkSyncPending is set).
    // Mesh + add newly-streamed chunks within a WALL-CLOCK budget. Each createChunkMesh
    // builds 3 BufferGeometries on the main thread (~3 ms), so meshing the full
    // the previous 8-chunk hard cap in one go spiked a single frame to ~28 ms (the p90/p99
    // stutter while walking) even though the worker meshing itself is off-thread. Process in
    // small parallel sub-batches (CHUNK_SYNC_CONCURRENCY keeps the worker pool busy) and STOP
    // once WORLD_RENDERER_TIME_BUDGET_MS is exceeded — the remainder drains next frame
    // (chunkSyncPending re-fires the caller). At least one sub-batch always runs (progress
    // guarantee). Mirrors the LOD path's budget below.
    const addStartMs = nowMs()
    const newChunkHardCap = Math.min(newChunks.length, MAX_CHUNK_UPDATES_PER_FRAME)
    let nextMeshesAfterAdd = meshes
    let newProcessed = 0
    while (shouldContinueBudgetedChunkSync(newProcessed, newChunkHardCap, nowMs() - addStartMs)) {
      const batchEnd = Math.min(newProcessed + CHUNK_SYNC_CONCURRENCY, newChunkHardCap)
      const batchChunks: Array<Chunk> = []
      for (let i = newProcessed; i < batchEnd; i++) {
        batchChunks.push(newChunks[i]!)
      }
      const meshed = yield* Effect.forEach(
        batchChunks,
        (chunk) =>
          Effect.gen(function* () {
            const lod = lodForChunk(chunk)
            const { opaqueMesh, waterMesh, transparentSolidMesh } = yield* chunkMeshService.createChunkMesh(chunk, waterMaterial, lod)
            return [chunkKey(chunk.coord), { opaque: opaqueMesh, water: waterMesh, transparentSolid: transparentSolidMesh, lod }] as const
          }),
        { concurrency: CHUNK_SYNC_CONCURRENCY },
      )
      for (const [key, chunkMeshes] of meshed) {
        yield* sceneService.add(scene, chunkMeshes.opaque)
        const waterMesh = Option.getOrNull(chunkMeshes.water)
        if (waterMesh !== null) {
          yield* sceneService.add(scene, waterMesh)
          nextWaterMeshes = appendTrackedMesh(nextWaterMeshes, waterMesh)
        }
        const transparentSolidMesh = Option.getOrNull(chunkMeshes.transparentSolid)
        if (transparentSolidMesh !== null) yield* sceneService.add(scene, transparentSolidMesh)
        nextMeshesAfterAdd = HashMap.set(nextMeshesAfterAdd, key, chunkMeshes)
      }
      newProcessed = batchEnd
    }
    const allNewChunksMeshed = newProcessed >= newChunks.length

    // FR-3.1: re-mesh LOD-changed chunks in place (geometry buffers updated in
    // the existing mesh object). Uses the same time-budget + hard-cap as the
    // new-chunk add path above so LOD transitions spread across frames rather
    // than spiking in a single frame. Each call to updateChunkMesh overwrites
    // the geometry buffer in place (or replaces it when capacity is
    // insufficient) and records the new lod value (the natural lodForChunk) so the next
    // frame's hysteresis check is satisfied (cm.lod is within its band) and skips the work.
    const lodStartMs = nowMs()
    const lodHardCap = Math.min(MAX_CHUNK_UPDATES_PER_FRAME, lodChangedChunks.length)
    let nextMeshesAfterLod = nextMeshesAfterAdd
    let processedLod = 0
    while (shouldContinueBudgetedChunkSync(processedLod, lodHardCap, nowMs() - lodStartMs)) {
      const chunk = lodChangedChunks[processedLod]!
      const key = chunkKey(chunk.coord)
      const existing = Option.getOrNull(HashMap.get(nextMeshesAfterLod, key))
      if (existing === null) {
        // Chunk was just added above — it already has the correct LOD.
        processedLod += 1
        continue
      }
      const newLod = lodForChunk(chunk)
      const { waterMesh: nextWaterMesh, transparentSolidMesh: nextTransparentSolidMesh } = yield* chunkMeshService
        .updateChunkMesh(existing.opaque, existing.water, chunk, waterMaterial, newLod, undefined, existing.transparentSolid)
      const prevWaterMesh = Option.getOrNull(existing.water)
      const nextWaterMeshVal = Option.getOrNull(nextWaterMesh)
      if (prevWaterMesh === null) {
        if (nextWaterMeshVal !== null) nextWaterMeshes = appendTrackedMesh(nextWaterMeshes, nextWaterMeshVal)
      } else if (nextWaterMeshVal === null) {
        nextWaterMeshes = removeTrackedMesh(nextWaterMeshes, prevWaterMesh)
      } else if (prevWaterMesh !== nextWaterMeshVal) {
        nextWaterMeshes = replaceTrackedMesh(nextWaterMeshes, prevWaterMesh, nextWaterMeshVal)
      }
      const updated: ChunkMeshes = {
        opaque: existing.opaque,
        water: nextWaterMesh,
        transparentSolid: nextTransparentSolidMesh,
        lod: newLod,
      }
      nextMeshesAfterLod = HashMap.set(nextMeshesAfterLod, key, updated)
      processedLod += 1
    }
    const allLodChunksRemeshed = processedLod >= lodChangedChunks.length

    // Remove meshes for chunks no longer loaded (iterate original snapshot).
    // BUDGETED: dispose at most MAX_CHUNK_REMOVALS_PER_FRAME chunks per frame.
    // geometry.dispose() runs a synchronous WebGL deleteBuffer on the main thread;
    // a chunk-boundary crossing stales a whole row at once, so disposing them all in
    // one frame stutters while moving. Unprocessed stale chunks stay in `meshes` and
    // are disposed next frame (steady churn ≪ the cap → no accumulation, and they are
    // just off-screen edge chunks). Mirrors the budgeted ADD path above.
    const { removalsToProcess, allStaleRemoved } = hasPotentialStaleMeshes
      ? collectChunkRemovalBatch(
        nextMeshesAfterLod,
        makeLoadedChunkKeySet(loadedChunks),
        MAX_CHUNK_REMOVALS_PER_FRAME,
      )
      : { removalsToProcess: [], allStaleRemoved: true }

    let nextMeshes = nextMeshesAfterLod
    for (const [key, chunkMeshes] of removalsToProcess) {
      // Sequential: scene.remove + disposeMesh + cache release are sync operations
      // on a budgeted removal path (max CHUNK_SYNC_CONCURRENCY chunks/frame).
      yield* sceneService.remove(scene, chunkMeshes.opaque)
      yield* Effect.sync(() => disposeMesh(chunkMeshes.opaque))
      const waterMesh = Option.getOrNull(chunkMeshes.water)
      if (waterMesh !== null) {
        yield* sceneService.remove(scene, waterMesh)
        yield* Effect.sync(() => disposeMesh(waterMesh))
        nextWaterMeshes = removeTrackedMesh(nextWaterMeshes, waterMesh)
      }
      const transparentSolidMesh = Option.getOrNull(chunkMeshes.transparentSolid)
      if (transparentSolidMesh !== null) {
        yield* sceneService.remove(scene, transparentSolidMesh)
        yield* Effect.sync(() => disposeMesh(transparentSolidMesh))
      }
      const coord = chunkMeshes.opaque.userData['chunkCoord'] ?? null
      if (coord !== null) yield* chunkMeshService.releasePrevCachedMesh(coord)
      nextMeshes = HashMap.remove(nextMeshes, key)
    }

    // Sequential: Ref.set + invalidateSceneCaches are sync state writes
    yield* Ref.set(meshesRef, nextMeshes)
    yield* Ref.set(waterMeshesRef, nextWaterMeshes)
    yield* invalidateSceneCaches()

    // `false` (→ caller re-fires next frame) while new chunks remain to mesh,
    // stale chunks remain to dispose, OR LOD-changed chunks remain to re-mesh.
    return allNewChunksMeshed && allStaleRemoved && allLodChunksRemeshed
  })
