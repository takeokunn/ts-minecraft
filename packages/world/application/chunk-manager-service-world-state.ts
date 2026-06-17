import { Effect, HashMap, HashSet, Option, Ref } from 'effect'
import { WorldId, type ChunkCacheKey, type WorldId as WorldIdType } from '@ts-minecraft/core'
import type { Chunk } from '../domain/chunk'
import type { ChunkAABB } from '../domain/chunk-aabb'
import type { Dimension } from '../domain/nether/nether-travel'
import { MAX_CACHED_CHUNKS } from './chunk-manager-constants'
import type { ChunkCache, ChunkCacheEntry } from './chunk-manager-cache'

export const emptyCacheState = (): ChunkCache => ({
  chunks: HashMap.empty<ChunkCacheKey, ChunkCacheEntry>(),
  dirtyChunks: HashSet.empty<ChunkCacheKey>(),
  renderDirtyChunks: HashSet.empty<ChunkCacheKey>(),
  renderDirtyAABBs: HashMap.empty<ChunkCacheKey, ChunkAABB>(),
})

export const buildSetActiveWorldId = (
  worldIdRef: Ref.Ref<WorldIdType>,
  cache: Ref.Ref<ChunkCache>,
  cachedLoadedChunksRef: Ref.Ref<Option.Option<ReadonlyArray<Chunk>>>,
  maxCachedChunksRef: Ref.Ref<number>,
  lastLoadTimeRef: Ref.Ref<number>,
  accessCounterRef: Ref.Ref<number>,
) => (worldId: WorldIdType): Effect.Effect<void, never> =>
  Ref.set(worldIdRef, worldId).pipe(
    Effect.flatMap(() => Ref.update(cache, () => emptyCacheState())),
    Effect.flatMap(() => Ref.set(cachedLoadedChunksRef, Option.none())),
    Effect.flatMap(() => Ref.set(maxCachedChunksRef, MAX_CACHED_CHUNKS)),
    Effect.flatMap(() => Ref.set(lastLoadTimeRef, -200)),
    Effect.flatMap(() => Ref.set(accessCounterRef, 0)),
  )

export const buildSetActiveDimension = (
  baseWorldIdRef: Ref.Ref<WorldIdType>,
  dimensionRef: Ref.Ref<Dimension>,
  resetCache: (worldId: WorldIdType) => Effect.Effect<void, never>,
) => (dim: Dimension): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const baseWorldId = yield* Ref.get(baseWorldIdRef)
    const worldId = buildDimensionWorldId(baseWorldId, dim)
    yield* Ref.set(dimensionRef, dim)
    yield* resetCache(worldId)
  })

export const buildDimensionWorldId = (baseWorldId: WorldIdType, dim: Dimension): WorldIdType =>
  dim === 'nether'
    ? WorldId.make(`${baseWorldId}-nether`)
    : dim === 'end'
      ? WorldId.make(`${baseWorldId}-end`)
      : baseWorldId
