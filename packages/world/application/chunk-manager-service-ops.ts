import { Array as Arr, Clock, Effect, HashMap, HashSet, Option, Ref } from 'effect'
import { ChunkCacheKey, ChunkCoord, Position } from '@ts-minecraft/core'
import { computeMaxY, type Chunk } from '../domain/chunk'
import { StorageError } from '../domain/errors'
import { aabbFromVoxels, fullChunkAABB, unionAABB, type ChunkAABB } from '../domain/chunk-aabb'
import { chunkCoordToWorldKey, chunkDistanceSquared, countChunksInRadius, getChunksInRenderDistance, worldToChunkCoord } from '../domain/chunk-coord-utils'
import { MAX_CACHED_CHUNKS, RENDER_DISTANCE, UNLOAD_DISTANCE, type ChunkManagerError } from './chunk-manager-constants'
import type { ChunkCache } from './chunk-manager-cache'
import { type ChunkOpsContext, getChunk, unloadChunk } from './chunk-manager-ops'
import { CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE, MAX_CHUNK_LOADS_PER_CALL, type ChunkLoadOptions } from './chunk-manager-service-model'

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
      const shouldLoad = yield* Ref.modify(lastLoadTimeRef, (last) =>
        now - last < 200 ? [false, last] : [true, now]
      )
      if (!shouldLoad) return false
    }

    const centerChunk = worldToChunkCoord(playerPos)
    const chunkCacheCapacity = Math.max(MAX_CACHED_CHUNKS, countChunksInRadius(renderDistance + 2))
    yield* Ref.update(ctx.maxCachedChunksRef, (current) => Math.max(current, chunkCacheCapacity))

    const currentWorldId = yield* Ref.get(ctx.worldIdRef)
    const chunksToLoad = getChunksInRenderDistance(centerChunk, renderDistance)
    const stateBeforeLoad = yield* Ref.get(ctx.cache)
    const missingChunksToLoad = Arr.filter(
      chunksToLoad,
      (coord) => !HashMap.has(stateBeforeLoad.chunks, chunkCoordToWorldKey(coord, currentWorldId)),
    )

    const shouldBatchLoads = options.eager !== true && renderDistance >= CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE
    const chunkLoadBatch = shouldBatchLoads ? Arr.take(missingChunksToLoad, MAX_CHUNK_LOADS_PER_CALL) : missingChunksToLoad

    yield* Effect.forEach(chunkLoadBatch, (coord) => loadSemaphore.withPermits(1)(getChunk(ctx, coord)), { concurrency: 4 })

    const state = yield* Ref.get(ctx.cache)
    const unloadDistance = Math.max(renderDistance + 2, UNLOAD_DISTANCE)
    const maxDistance = unloadDistance * unloadDistance
    yield* Effect.forEach(
      Arr.filter(Arr.fromIterable(HashMap.values(state.chunks)), (entry) => chunkDistanceSquared(entry.chunk.coord, centerChunk) > maxDistance),
      (entry) => unloadChunk(ctx, entry.chunk.coord),
      { concurrency: 1 },
    )

    return chunkLoadBatch.length === missingChunksToLoad.length
  })

export const getLoadedChunks = (ctx: ChunkOpsContext): Effect.Effect<ReadonlyArray<Chunk>, never> =>
  Effect.gen(function* () {
    const cached = yield* Ref.get(ctx.cachedLoadedChunksRef)
    const cachedVal = Option.getOrNull(cached)
    if (cachedVal !== null) return cachedVal
    const state = yield* Ref.get(ctx.cache)
    const chunks = Arr.map(Arr.fromIterable(HashMap.values(state.chunks)), (entry) => entry.chunk)
    yield* Ref.set(ctx.cachedLoadedChunksRef, Option.some(chunks))
    return chunks
  })

export const drainRenderDirtyChunks = (cache: Ref.Ref<ChunkCache>): Effect.Effect<ReadonlyArray<Chunk>, never> =>
  Effect.gen(function* () {
    const renderDirtyKeys = yield* Ref.modify(cache, (s) => [
      s.renderDirtyChunks,
      { ...s, renderDirtyChunks: HashSet.empty<ChunkCacheKey>(), renderDirtyAABBs: HashMap.empty<ChunkCacheKey, ChunkAABB>() },
    ])
    const state = yield* Ref.get(cache)
    return Arr.filterMap(Arr.fromIterable(renderDirtyKeys), (key) => Option.map(HashMap.get(state.chunks, key), (entry) => entry.chunk))
  })

export const drainRenderDirtyChunkEntries = (cache: Ref.Ref<ChunkCache>): Effect.Effect<
  ReadonlyArray<{ readonly chunk: Chunk; readonly dirtyAABB: Option.Option<ChunkAABB> }>, never
> =>
  Effect.gen(function* () {
    const drained = yield* Ref.modify(cache, (s) => [
      { keys: s.renderDirtyChunks, aabbs: s.renderDirtyAABBs } as const,
      { ...s, renderDirtyChunks: HashSet.empty<ChunkCacheKey>(), renderDirtyAABBs: HashMap.empty<ChunkCacheKey, ChunkAABB>() },
    ] as const)
    const state = yield* Ref.get(cache)
    return Arr.filterMap(Arr.fromIterable(drained.keys), (key) =>
      Option.map(HashMap.get(state.chunks, key), (entry) => ({ chunk: entry.chunk, dirtyAABB: HashMap.get(drained.aabbs, key) })),
    )
  })

const dirtyOffsets = (bfsResult: Option.Option<{ boundary: { nx: boolean; px: boolean; nz: boolean; pz: boolean } }>) => {
  const allOffsets: ReadonlyArray<readonly [number, number]> = [[0, 0], [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
  const bfsResultVal = Option.getOrNull(bfsResult)
  if (bfsResultVal === null) return allOffsets
  return Arr.filter(allOffsets, ([dx, dz]) => {
    const b = bfsResultVal.boundary
      if (dx === 0 && dz === 0) return true
      if (dx === -1 && b.nx) return true
      if (dx === 1 && b.px) return true
      if (dz === -1 && b.nz) return true
      if (dz === 1 && b.pz) return true
      if (dx === -1 && dz === -1) return b.nx && b.nz
      if (dx === -1 && dz === 1) return b.nx && b.pz
      if (dx === 1 && dz === -1) return b.px && b.nz
      if (dx === 1 && dz === 1) return b.px && b.pz
      /* c8 ignore next */
      return false
    })
}

export const markChunkDirty = (
  ctx: ChunkOpsContext,
  coord: ChunkCoord,
  dirtyVoxels?: ReadonlyArray<{ readonly lx: number; readonly y: number; readonly lz: number }>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const worldId = yield* Ref.get(ctx.worldIdRef)
    const key = chunkCoordToWorldKey(coord, worldId)
    const state = yield* Ref.get(ctx.cache)
    type BfsResult = Option.Option<{ boundary: { nx: boolean; px: boolean; nz: boolean; pz: boolean }; affectedAABB: Option.Option<ChunkAABB> }>
    const entry = Option.getOrNull(HashMap.get(state.chunks, key))
    const bfsResult: BfsResult = yield* entry === null
      ? Effect.succeed(Option.none())
      : (() => {
          const useBfs = entry.chunk.skyLight !== undefined && entry.chunk.blockLight !== undefined && dirtyVoxels !== undefined && dirtyVoxels.length > 0
          return useBfs
            ? Effect.gen(function* () {
                const result = yield* ctx.lightEngine.propagateLightIncremental(entry.chunk, dirtyVoxels)
                yield* Ref.update(ctx.cache, (s) => updateLitChunk(s, key, result.skyLight, result.blockLight))
                return Option.some({ boundary: result.boundary, affectedAABB: result.affectedAABB })
              })
            : Effect.gen(function* () {
                const grids = yield* ctx.lightEngine.updateLight(entry.chunk)
                yield* Ref.update(ctx.cache, (s) => updateLitChunk(s, key, grids.skyLight, grids.blockLight))
                return Option.none<{ boundary: { nx: boolean; px: boolean; nz: boolean; pz: boolean }; affectedAABB: Option.Option<ChunkAABB> }>()
              })
        })()

    const allKeys = Arr.map(dirtyOffsets(bfsResult), ([dx, dz]) => chunkCoordToWorldKey({ x: coord.x + dx, z: coord.z + dz }, worldId))
    const seedAABB = dirtyVoxels === undefined ? Option.none<ChunkAABB>() : aabbFromVoxels(dirtyVoxels)
    const bfsAABB = Option.flatMap(bfsResult, (r) => r.affectedAABB)
    const editedChunkAABB = Option.getOrElse(Option.orElse(seedAABB, () => bfsAABB), () => fullChunkAABB)
    const editedKey = chunkCoordToWorldKey(coord, worldId)

    yield* Ref.update(ctx.cache, (s) => ({
      ...s,
      dirtyChunks: Arr.reduce(allKeys, s.dirtyChunks, (set, k) => HashSet.add(set, k)),
      renderDirtyChunks: Arr.reduce(allKeys, s.renderDirtyChunks, (set, k) => HashSet.add(set, k)),
      renderDirtyAABBs: Arr.reduce(allKeys, s.renderDirtyAABBs, (m, k) => {
        const incoming = k === editedKey ? editedChunkAABB : fullChunkAABB
        const existing = Option.getOrNull(HashMap.get(m, k))
        return existing === null
          ? HashMap.set(m, k, incoming)
          : HashMap.set(m, k, unionAABB(existing, incoming))
      }),
    }))
  })

const updateLitChunk = (s: ChunkCache, key: ChunkCacheKey, skyLight: Uint8Array, blockLight: Uint8Array): ChunkCache =>
  (() => {
    const e = Option.getOrNull(HashMap.get(s.chunks, key))
    if (e === null) return s
    return { ...s, chunks: HashMap.set(s.chunks, key, { ...e, chunk: { ...e.chunk, skyLight, blockLight, maxY: computeMaxY(e.chunk.blocks) } }) }
  })()

export const saveDirtyChunks = (ctx: ChunkOpsContext): Effect.Effect<void, StorageError> =>
  Effect.gen(function* () {
    const state = yield* Ref.get(ctx.cache)
    const keysToSave = state.dirtyChunks
    const currentWorldId = yield* Ref.get(ctx.worldIdRef)
    yield* Effect.forEach(
      Arr.filterMap(Arr.fromIterable(keysToSave), (key) => HashMap.get(state.chunks, key)),
      (entry) => ctx.storageService.saveChunk(entry.worldId ?? currentWorldId, entry.chunk.coord, {
        blocks: entry.chunk.blocks,
        fluid: Option.getOrUndefined(entry.chunk.fluid),
      }),
      { concurrency: 1 },
    )
    yield* Ref.update(ctx.cache, (s) => ({ ...s, dirtyChunks: HashSet.difference(s.dirtyChunks, keysToSave) }))
  })
