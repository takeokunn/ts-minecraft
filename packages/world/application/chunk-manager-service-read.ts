import { Effect, HashMap, HashSet, Option, Ref } from 'effect'
import type { Chunk } from '../domain/chunk'
import type { ChunkAABB } from '../domain/chunk-aabb'
import type { ChunkCache, ChunkCacheKey } from './chunk-manager-cache'
import type { ChunkOpsContext } from './chunk-manager-ops'
import { collectChunks, collectDirtyChunkEntries, collectDirtyChunks } from './chunk-manager-service-read-collection'

const drainRenderDirtyState = (
  cache: Ref.Ref<ChunkCache>,
): Effect.Effect<{
  readonly keys: HashSet.HashSet<ChunkCacheKey>
  readonly aabbs: HashMap.HashMap<ChunkCacheKey, ChunkAABB>
}, never> =>
  Ref.modify(cache, (s) => [
    { keys: s.renderDirtyChunks, aabbs: s.renderDirtyAABBs } as const,
    { ...s, renderDirtyChunks: HashSet.empty<ChunkCacheKey>(), renderDirtyAABBs: HashMap.empty<ChunkCacheKey, ChunkAABB>() },
  ] as const)

export const getLoadedChunks = (ctx: ChunkOpsContext): Effect.Effect<ReadonlyArray<Chunk>, never> =>
  Effect.gen(function* () {
    const cached = yield* Ref.get(ctx.cachedLoadedChunksRef)
    const cachedVal = Option.getOrNull(cached)
    if (cachedVal !== null) return cachedVal
    const state = yield* Ref.get(ctx.cache)
    const chunks = collectChunks(state)
    yield* Ref.set(ctx.cachedLoadedChunksRef, Option.some(chunks))
    return chunks
  })

export const drainRenderDirtyChunks = (cache: Ref.Ref<ChunkCache>): Effect.Effect<ReadonlyArray<Chunk>, never> =>
  Effect.gen(function* () {
    const drained = yield* drainRenderDirtyState(cache)
    const state = yield* Ref.get(cache)
    return collectDirtyChunks(state, drained.keys)
  })

export const drainRenderDirtyChunkEntries = (
  cache: Ref.Ref<ChunkCache>,
): Effect.Effect<ReadonlyArray<{ readonly chunk: Chunk; readonly dirtyAABB: Option.Option<ChunkAABB> }>, never> =>
  Effect.gen(function* () {
    const drained = yield* drainRenderDirtyState(cache)
    const state = yield* Ref.get(cache)
    return collectDirtyChunkEntries(state, drained.keys, drained.aabbs)
  })
