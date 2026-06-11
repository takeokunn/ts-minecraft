import { Array as Arr, Effect, HashMap, HashSet, Option, Ref } from 'effect'
import * as THREE from 'three'
import { ChunkCacheKey } from '@ts-minecraft/core'
import { Chunk } from '@ts-minecraft/world'
import { ChunkMeshService } from '../meshing/chunk-mesh'
import { lodForDistance, type LodLevel } from '../meshing/lod-simplification'
import { SceneService } from '../scene/scene-service'
import {
  MAX_CHUNK_UPDATES_PER_FRAME,
  MAX_CHUNK_REMOVALS_PER_FRAME,
  WORLD_RENDERER_TIME_BUDGET_MS,
  CHUNK_SYNC_CONCURRENCY,
  type ChunkMeshes,
} from './world-renderer-types'
import { nowMs, chunkKey, disposeMesh } from './world-renderer-utils'

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

    // FR-3.1: derive a player-chunk proxy from the centroid of all loaded
    // chunks. `loadedChunks` is the engine's render-distance window which
    // always clusters tightly around the player, so the centroid tracks the
    // player to within one chunk. Used here purely for LOD distance-band
    // selection (no player position threaded through the layer for this).
    const centerX = loadedChunks.length > 0
      ? loadedChunks.reduce((acc, c) => acc + c.coord.x, 0) / loadedChunks.length
      : 0
    const centerZ = loadedChunks.length > 0
      ? loadedChunks.reduce((acc, c) => acc + c.coord.z, 0) / loadedChunks.length
      : 0
    // Chebyshev (L∞) distance produces square LOD rings around the player,
    // matching the square render-distance window typical of voxel renderers.
    const lodDistanceFromCenter = (chunk: Chunk): number => {
      const dx = Math.abs(chunk.coord.x - centerX)
      const dz = Math.abs(chunk.coord.z - centerZ)
      return Math.max(dx, dz)
    }
    const lodForChunk = (chunk: Chunk): LodLevel => lodForDistance(lodDistanceFromCenter(chunk))

    // Early-exit phase 1: check for new chunks — no Set allocation needed.
    const newChunks = Arr.filter(loadedChunks, (c) => !HashMap.has(meshes, chunkKey(c.coord)))
    const hasNewChunks = newChunks.length > 0

    // Early-exit phase 2: detect removals cheaply.
    const hasRemovedChunks = !hasNewChunks && loadedChunks.length < HashMap.size(meshes)

    // FR-3.1: detect chunks whose LOD band changed since last meshed (player
    // moved across a band boundary, or render distance changed). Collect the
    // affected chunks so they can be re-meshed below with the new LOD level.
    const lodChangedChunks = Arr.filter(loadedChunks, (c) =>
      Option.match(HashMap.get(meshes, chunkKey(c.coord)), {
        onNone: () => false,
        onSome: (cm) => cm.lod !== lodForChunk(c),
      })
    )
    const hasLodChanges = lodChangedChunks.length > 0

    if (!hasNewChunks && !hasRemovedChunks && !hasLodChanges) {
      return true
    }

    // Allocate loadedKeys Set only after confirming work is needed
    const loadedKeySet = HashSet.fromIterable(Arr.map(loadedChunks, (c) => chunkKey(c.coord)))

    // Add meshes for newly loaded chunks not yet in scene.
    // Throttle: drain one chunk at a time, checking elapsed wall-clock
    // time after each. Stop when WORLD_RENDERER_TIME_BUDGET_MS is reached
    // OR MAX_CHUNK_UPDATES_PER_FRAME (hard safety cap) is hit. Remaining
    // chunks are picked up next frame. Mirrors the dirty-chunk drain in
    // frame-maintenance.ts (same time-budget pattern).
    //
    // CHUNK_SYNC_CONCURRENCY is preserved as concurrency: 1 here for
    // correctness — we need to check the time budget AFTER each
    // createChunkMesh, which only works if the inner pipeline is
    // sequential. The previous concurrency: CHUNK_SYNC_CONCURRENCY (=2)
    // batched the work and would overshoot the budget by up to one full
    // mesh build. Per-frame impact is negligible because meshing is
    // mostly main-thread sync work anyway.
    const startMs = nowMs()
    const hardCap = Math.min(MAX_CHUNK_UPDATES_PER_FRAME, newChunks.length)
    const { chunks: meshedChunks, processed } = yield* Effect.iterate(
      { chunks: [] as Array<readonly [ChunkCacheKey, { opaqueMesh: THREE.Mesh; waterMesh: Option.Option<THREE.Mesh>; transparentSolidMesh: Option.Option<THREE.Mesh>; lod: LodLevel }]>, processed: 0 },
      {
        while: (s) => s.processed < hardCap && nowMs() - startMs < WORLD_RENDERER_TIME_BUDGET_MS,
        body: (s) => {
          const chunk = newChunks[s.processed]!
          const lod = lodForChunk(chunk)
          return chunkMeshService
            .createChunkMesh(chunk, waterMaterial, lod)
            .pipe(
              Effect.map(({ opaqueMesh, waterMesh, transparentSolidMesh }) => ({
                chunks: [...s.chunks, [chunkKey(chunk.coord), { opaqueMesh, waterMesh, transparentSolidMesh, lod }] as const],
                processed: s.processed + 1,
              }))
            )
        },
      }
    )
    // allNewChunksMeshed is `false` if either the time budget OR the hard
    // cap stopped us short of draining the entire newChunks queue.
    const allNewChunksMeshed = processed >= newChunks.length

    const nextMeshesAfterAdd = yield* Effect.all(
      Arr.map(meshedChunks, ([key, { opaqueMesh, waterMesh, transparentSolidMesh, lod }]) =>
        Effect.all([
          sceneService.add(scene, opaqueMesh),
          Option.match(waterMesh, {
            onNone: () => Effect.void,
            onSome: (m) => sceneService.add(scene, m),
          }),
          Option.match(transparentSolidMesh, {
            onNone: () => Effect.void,
            onSome: (m) => sceneService.add(scene, m),
          }),
        ], { concurrency: 'unbounded', discard: true }).pipe(
          Effect.as([key, { opaque: opaqueMesh, water: waterMesh, transparentSolid: transparentSolidMesh, lod }] as const)
        )
      ),
      { concurrency: CHUNK_SYNC_CONCURRENCY }
    ).pipe(
      Effect.map((added) =>
        Arr.reduce(added, meshes, (acc, [key, chunkMeshes]) => HashMap.set(acc, key, chunkMeshes))
      )
    )

    // FR-3.1: re-mesh LOD-changed chunks in place (geometry buffers updated in
    // the existing mesh object). Uses the same time-budget + hard-cap as the
    // new-chunk add path above so LOD transitions spread across frames rather
    // than spiking in a single frame. Each call to updateChunkMesh overwrites
    // the geometry buffer in place (or replaces it when capacity is
    // insufficient) and records the new lod value so the next frame finds
    // `cm.lod === lodForChunk(c)` and skips the work.
    const lodStartMs = nowMs()
    const lodHardCap = Math.min(MAX_CHUNK_UPDATES_PER_FRAME, lodChangedChunks.length)
    const { meshMap: nextMeshesAfterLod, processedLod } = yield* Effect.iterate(
      { meshMap: nextMeshesAfterAdd, processedLod: 0 },
      {
        while: (s) => s.processedLod < lodHardCap && nowMs() - lodStartMs < WORLD_RENDERER_TIME_BUDGET_MS,
        body: (s) => {
          const chunk = lodChangedChunks[s.processedLod]!
          const key = chunkKey(chunk.coord)
          const existing = Option.getOrNull(HashMap.get(s.meshMap, key))
          if (existing === null) {
            // Chunk was just added above — it already has the correct LOD.
            return Effect.succeed({ meshMap: s.meshMap, processedLod: s.processedLod + 1 })
          }
          const newLod = lodForChunk(chunk)
          return chunkMeshService
            .updateChunkMesh(existing.opaque, existing.water, chunk, waterMaterial, newLod, undefined, existing.transparentSolid)
            .pipe(
              Effect.map(({ waterMesh: nextWaterMesh, transparentSolidMesh: nextTransparentSolidMesh }) => {
                const updated: ChunkMeshes = {
                  opaque: existing.opaque,
                  water: nextWaterMesh,
                  transparentSolid: nextTransparentSolidMesh,
                  lod: newLod,
                }
                return {
                  meshMap: HashMap.set(s.meshMap, key, updated),
                  processedLod: s.processedLod + 1,
                }
              })
            )
        },
      }
    )
    const allLodChunksRemeshed = processedLod >= lodChangedChunks.length

    // Remove meshes for chunks no longer loaded (iterate original snapshot).
    // BUDGETED: dispose at most MAX_CHUNK_REMOVALS_PER_FRAME chunks per frame.
    // geometry.dispose() runs a synchronous WebGL deleteBuffer on the main thread;
    // a chunk-boundary crossing stales a whole row at once, so disposing them all in
    // one frame stutters while moving. Unprocessed stale chunks stay in `meshes` and
    // are disposed next frame (steady churn ≪ the cap → no accumulation, and they are
    // just off-screen edge chunks). Mirrors the budgeted ADD path above.
    const removalPairs = Arr.filterMap(
      Arr.fromIterable(nextMeshesAfterLod),
      ([key, chunkMeshes]) => HashSet.has(loadedKeySet, key) ? Option.none() : Option.some([key, chunkMeshes] as const)
    )
    const removalsToProcess = Arr.take(removalPairs, MAX_CHUNK_REMOVALS_PER_FRAME)
    const allStaleRemoved = removalPairs.length <= removalsToProcess.length

    const removedKeys = yield* Effect.all(
      Arr.map(removalsToProcess, ([key, chunkMeshes]) =>
        Effect.all([
          sceneService.remove(scene, chunkMeshes.opaque).pipe(
            Effect.andThen(Effect.sync(() => disposeMesh(chunkMeshes.opaque)))
          ),
          Option.match(chunkMeshes.water, {
            onNone: () => Effect.void,
            onSome: (m) =>
              sceneService.remove(scene, m).pipe(
                Effect.andThen(Effect.sync(() => disposeMesh(m)))
              ),
          }),
          Option.match(chunkMeshes.transparentSolid, {
            onNone: () => Effect.void,
            onSome: (m) =>
              /* c8 ignore start -- transparentSolid mesh removal on chunk unload; requires full scene setup to hit in tests */
              sceneService.remove(scene, m).pipe(
                Effect.andThen(Effect.sync(() => disposeMesh(m)))
              ),
              /* c8 ignore end */
          }),
          // SEC-W1: drop the sync-fallback prev mesh cache for this coord so
          // the cache cannot grow unbounded under long sessions on the sync
          // fallback path. Worker path is a no-op (no per-coord cache).
          // Pulled from `userData.chunkCoord` (the same source the renderer
          // already trusts for frustum culling) — only releasing when the
          // value is present preserves correctness if it is somehow missing.
          Option.match(Option.fromNullable(chunkMeshes.opaque.userData['chunkCoord']), {
            onNone: () => Effect.void,
            onSome: (coord) => chunkMeshService.releasePrevCachedMesh(coord),
          }),
        ], { concurrency: 'unbounded', discard: true }).pipe(
          Effect.as(key)
        )
      ),
      { concurrency: CHUNK_SYNC_CONCURRENCY }
    )

    const nextMeshes = Arr.reduce(removedKeys, nextMeshesAfterLod, (acc, key) => HashMap.remove(acc, key))

    // Rebuild stable water mesh list
    const nextWaterMeshes = Arr.filterMap(Arr.fromIterable(HashMap.values(nextMeshes)), (cm) => cm.water)
    yield* Effect.all([
      Ref.set(meshesRef, nextMeshes),
      Ref.set(waterMeshesRef, nextWaterMeshes),
      invalidateSceneCaches(),
    ], { concurrency: 'unbounded', discard: true })

    // `false` (→ caller re-fires next frame) while new chunks remain to mesh,
    // stale chunks remain to dispose, OR LOD-changed chunks remain to re-mesh.
    return allNewChunksMeshed && allStaleRemoved && allLodChunksRemeshed
  })
