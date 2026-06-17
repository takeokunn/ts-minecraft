import { Clock, Effect, Ref } from 'effect'
import { Position } from '@ts-minecraft/core'
import { worldToChunkCoord } from '../domain/chunk-coord-utils'
import { RENDER_DISTANCE, type ChunkManagerError } from './chunk-manager-constants'
import { type ChunkOpsContext } from './chunk-manager-ops'
import { type ChunkLoadOptions } from './chunk-manager-service-model'
import { loadChunkBatch, unloadChunkBatch } from './chunk-manager-service-load-execution'
import { resolveChunkCacheCapacity, resolveChunkLoadPlan } from './chunk-manager-service-load-plan'
import { resolveChunkLoadThrottle } from './chunk-manager-service-load-throttle'

export const loadChunksAroundPlayer = (
  ctx: ChunkOpsContext,
  lastLoadTimeRef: Ref.Ref<number>,
  loadSemaphore: Effect.Semaphore,
  playerPos: Position,
  renderDistance: number = RENDER_DISTANCE,
  options: ChunkLoadOptions = {},
): Effect.Effect<boolean, ChunkManagerError> =>
  Effect.gen(function* () {
    if (options.eager !== true) {
      const now = yield* Clock.currentTimeMillis
      const shouldLoad = yield* Ref.modify(lastLoadTimeRef, (last) => resolveChunkLoadThrottle(now, last))
      if (!shouldLoad) return false
    }

    const centerChunk = worldToChunkCoord(playerPos)
    const chunkCacheCapacity = resolveChunkCacheCapacity(renderDistance)
    yield* Ref.update(ctx.maxCachedChunksRef, (current) => Math.max(current, chunkCacheCapacity))

    const currentWorldId = yield* Ref.get(ctx.worldIdRef)
    const stateBeforeLoad = yield* Ref.get(ctx.cache)
    const plan = resolveChunkLoadPlan(stateBeforeLoad, currentWorldId, centerChunk, renderDistance, options.eager === true)

    const terrainLevels = options.terrainLevels
    yield* loadChunkBatch(ctx, loadSemaphore, plan.chunkLoadBatch, terrainLevels)

    // Unload (and stop meshing) chunks beyond a 2-chunk hysteresis ring around the render
    // distance. The old `Math.max(renderDistance + 2, UNLOAD_DISTANCE=10)` floor kept chunks
    // out to dist 10 even at the default renderDistance 4 — ~400 chunks loaded & MESHED when
    // only ~81 are ever visible (chunks past dist ~4 are fog-culled), the memory growth seen
    // while walking. Scaling with the actual render distance bounds the loaded/meshed set
    // (rd4 → dist 6 ≈ 169 chunks vs 441; rd8 → dist 10, unchanged).
    yield* unloadChunkBatch(ctx, plan.chunksToUnload)

    return plan.chunkLoadBatch.length === plan.missingChunksToLoad.length
  })
