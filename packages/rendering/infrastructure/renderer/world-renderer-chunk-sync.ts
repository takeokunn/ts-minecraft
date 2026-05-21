import { Array as Arr, Effect, HashMap, HashSet, Option, Ref } from 'effect'
import * as THREE from 'three'
import { ChunkCacheKey } from '@ts-minecraft/kernel'
import { Chunk } from '@ts-minecraft/terrain'
import { ChunkMeshService } from '../meshing/chunk-mesh'
import { lodForDistance, type LodLevel } from '../meshing/lod-simplification'
import { SceneService } from '../scene/scene-service'
import {
  MAX_CHUNK_UPDATES_PER_FRAME,
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
    // moved across a band boundary, or render distance changed). These are NOT
    // re-meshed inside this scene-sync call — re-meshing happens via the
    // existing dirty-chunk path (updateChunkInScene). This block only forces
    // syncChunksToScene to keep running so callers can observe `false` from
    // the return value when the scene state is still settling.
    const hasLodChanges = Arr.some(loadedChunks, (c) =>
      Option.match(HashMap.get(meshes, chunkKey(c.coord)), {
        onNone: () => false,
        onSome: (cm) => cm.lod !== lodForChunk(c),
      })
    )

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
      { chunks: [] as Array<readonly [ChunkCacheKey, { opaqueMesh: THREE.Mesh; waterMesh: Option.Option<THREE.Mesh>; lod: LodLevel }]>, processed: 0 },
      {
        while: (s) => s.processed < hardCap && nowMs() - startMs < WORLD_RENDERER_TIME_BUDGET_MS,
        body: (s) => {
          const chunk = newChunks[s.processed]!
          const lod = lodForChunk(chunk)
          return chunkMeshService
            .createChunkMesh(chunk, waterMaterial, lod)
            .pipe(
              Effect.map(({ opaqueMesh, waterMesh }) => ({
                chunks: [...s.chunks, [chunkKey(chunk.coord), { opaqueMesh, waterMesh, lod }] as const],
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
      Arr.map(meshedChunks, ([key, { opaqueMesh, waterMesh, lod }]) =>
        Effect.all([
          sceneService.add(scene, opaqueMesh),
          Option.match(waterMesh, {
            onNone: () => Effect.void,
            onSome: (m) => sceneService.add(scene, m),
          }),
        ], { concurrency: 'unbounded', discard: true }).pipe(
          Effect.as([key, { opaque: opaqueMesh, water: waterMesh, lod }] as const)
        )
      ),
      { concurrency: CHUNK_SYNC_CONCURRENCY }
    ).pipe(
      Effect.map((added) =>
        Arr.reduce(added, meshes, (acc, [key, chunkMeshes]) => HashMap.set(acc, key, chunkMeshes))
      )
    )

    // Remove meshes for chunks no longer loaded (iterate original snapshot)
    const removalPairs = Arr.filterMap(
      Arr.fromIterable(meshes),
      ([key, chunkMeshes]) => HashSet.has(loadedKeySet, key) ? Option.none() : Option.some([key, chunkMeshes] as const)
    )

    const removedKeys = yield* Effect.all(
      Arr.map(removalPairs, ([key, chunkMeshes]) =>
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
          // SEC-W1: drop the sync-fallback prev mesh cache for this coord so
          // the cache cannot grow unbounded under long sessions on the sync
          // fallback path. Worker path is a no-op (no per-coord cache).
          // Pulled from `userData.chunkCoord` (the same source the renderer
          // already trusts for frustum culling) — only releasing when the
          // value is present preserves correctness if it is somehow missing.
          Option.match(Option.fromNullable(chunkMeshes.opaque.userData.chunkCoord), {
            onNone: () => Effect.void,
            onSome: (coord) => chunkMeshService.releasePrevCachedMesh(coord),
          }),
        ], { concurrency: 'unbounded', discard: true }).pipe(
          Effect.as(key)
        )
      ),
      { concurrency: CHUNK_SYNC_CONCURRENCY }
    )

    const nextMeshes = Arr.reduce(removedKeys, nextMeshesAfterAdd, (acc, key) => HashMap.remove(acc, key))

    // Rebuild stable water mesh list
    const nextWaterMeshes = Arr.filterMap(Arr.fromIterable(HashMap.values(nextMeshes)), (cm) => cm.water)
    yield* Effect.all([
      Ref.set(meshesRef, nextMeshes),
      Ref.set(waterMeshesRef, nextWaterMeshes),
      invalidateSceneCaches(),
    ], { concurrency: 'unbounded', discard: true })

    return allNewChunksMeshed
  })
