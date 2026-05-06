import { Array as Arr, Clock, Effect, HashMap, HashSet, Option, Ref } from 'effect';
import { ChunkService } from './chunk-service';
import { LightEngineService } from './light-engine-service';
import { StorageServicePort } from '../domain/storage-service-port';
import { DEFAULT_WORLD_ID } from '@ts-minecraft/kernel';
import { BiomeService } from './biome-service';
import { NoiseServicePort } from '../domain/noise-service-port';
import { TerrainWorkerPoolPort } from './terrain-worker-pool-port';
import { chunkDistanceSquared, worldToChunkCoord, getChunksInRenderDistance, countChunksInRadius, chunkCoordToWorldKey, } from '../domain/chunk-coord-utils';
import { RENDER_DISTANCE, UNLOAD_DISTANCE, MAX_CACHED_CHUNKS } from './chunk-manager-constants';
import { getChunk, unloadChunk } from './chunk-manager-ops';
export { RENDER_DISTANCE, UNLOAD_DISTANCE, MAX_CACHED_CHUNKS } from './chunk-manager-constants';
let activeChunkWorldIdRef = DEFAULT_WORLD_ID;
let activeChunkWorldServiceUpdater;
export const setActiveChunkWorldId = (worldId) => {
    activeChunkWorldIdRef = worldId;
    activeChunkWorldServiceUpdater?.(worldId);
};
export class ChunkManagerService extends Effect.Service()('@minecraft/application/ChunkManagerService', {
    effect: Effect.gen(function* () {
        // ChunkService and BiomeService are still required at the layer boundary
        // (other services in the graph depend on them being provided alongside
        // ChunkManagerService) but the chunk-manager body itself no longer touches them
        // directly — terrain generation moved off-thread via TerrainWorkerPoolPort.
        yield* ChunkService;
        const storageService = yield* StorageServicePort;
        yield* BiomeService;
        // NoiseServicePort exposes `getSeed` (the active world seed). Output remains
        // byte-identical because generateTerrainBlocks (in the worker pool's sync fallback
        // and in the worker itself) constructs the same NoisePrimitives from the same seed.
        const noiseService = yield* NoiseServicePort;
        const terrainPool = yield* TerrainWorkerPoolPort;
        const lightEngine = yield* LightEngineService;
        const emptyCacheState = () => ({
            chunks: HashMap.empty(),
            dirtyChunks: HashSet.empty(),
            renderDirtyChunks: HashSet.empty(),
        });
        const cache = yield* Ref.make(emptyCacheState());
        // Cache for getLoadedChunks result — invalidated whenever a chunk is inserted or removed.
        // Avoids allocating two arrays + N object refs on every frame at 60 Hz.
        const cachedLoadedChunksRef = yield* Ref.make(Option.none());
        const maxCachedChunksRef = yield* Ref.make(MAX_CACHED_CHUNKS);
        const worldIdRef = yield* Ref.make(activeChunkWorldIdRef);
        const lastLoadTimeRef = yield* Ref.make(-200);
        // Monotonically incrementing counter for LRU access ordering.
        // Using a counter instead of wall-clock time guarantees strict uniqueness per access,
        // which avoids ties when multiple chunks are inserted within the same millisecond.
        // HashMap iteration order is hash-based (not insertion-ordered like native Map),
        // so ties in lastAccessed would produce non-deterministic LRU eviction — the counter fixes this.
        const accessCounterRef = yield* Ref.make(0);
        // Semaphore limiting concurrent chunk generation/loading to 4 fibers at a time
        const loadSemaphore = yield* Effect.makeSemaphore(4);
        const updateActiveWorldId = (worldId) => Effect.gen(function* () {
            activeChunkWorldIdRef = worldId;
            yield* Ref.set(worldIdRef, worldId);
            yield* Ref.set(cache, emptyCacheState());
            yield* Ref.set(cachedLoadedChunksRef, Option.none());
            yield* Ref.set(maxCachedChunksRef, MAX_CACHED_CHUNKS);
            yield* Ref.set(lastLoadTimeRef, -200);
            yield* Ref.set(accessCounterRef, 0);
        });
        activeChunkWorldServiceUpdater = (worldId) => {
            Effect.runSync(updateActiveWorldId(worldId));
        };
        // Bundle all shared dependencies into a context object for the ops helpers.
        const ctx = {
            worldIdRef,
            cache,
            cachedLoadedChunksRef,
            maxCachedChunksRef,
            accessCounterRef,
            storageService,
            noiseService,
            terrainPool,
            lightEngine,
        };
        return {
            getChunk: (coord) => getChunk(ctx, coord),
            loadChunksAroundPlayer: (playerPos, renderDistance = RENDER_DISTANCE) => Effect.gen(function* () {
                const now = yield* Clock.currentTimeMillis;
                // Throttle: atomic check-and-update so concurrent callers can't both pass the gate
                const shouldLoad = yield* Ref.modify(lastLoadTimeRef, (last) => now - last < 200 ? [false, last] : [true, now]);
                if (!shouldLoad) {
                    return false;
                }
                const centerChunk = worldToChunkCoord(playerPos);
                const chunkCacheCapacity = Math.max(MAX_CACHED_CHUNKS, countChunksInRadius(renderDistance + 2));
                yield* Ref.update(maxCachedChunksRef, (current) => Math.max(current, chunkCacheCapacity));
                const currentWorldId = yield* Ref.get(worldIdRef);
                const chunksToLoad = getChunksInRenderDistance(centerChunk, renderDistance);
                const stateBeforeLoad = yield* Ref.get(cache);
                const missingChunksToLoad = Arr.filter(chunksToLoad, (coord) => !HashMap.has(stateBeforeLoad.chunks, chunkCoordToWorldKey(coord, currentWorldId)));
                const shouldBatchLoads = renderDistance >= 3;
                const chunkLoadBatch = shouldBatchLoads ? Arr.take(missingChunksToLoad, 4) : missingChunksToLoad;
                // Load chunks in render distance — cap fan-out to the same 4 fibers as the semaphore.
                yield* Effect.forEach(chunkLoadBatch, (coord) => loadSemaphore.withPermits(1)(getChunk(ctx, coord)), { concurrency: 4 });
                // Unload chunks outside the render radius plus a small buffer.
                const state = yield* Ref.get(cache);
                const unloadDistance = Math.max(renderDistance + 2, UNLOAD_DISTANCE);
                const maxDistance = unloadDistance * unloadDistance;
                yield* Effect.forEach(Arr.filter(Arr.fromIterable(HashMap.values(state.chunks)), (entry) => chunkDistanceSquared(entry.chunk.coord, centerChunk) > maxDistance), 
                /* c8 ignore next */
                (entry) => unloadChunk(ctx, entry.chunk.coord), { concurrency: 1 });
                return chunkLoadBatch.length === missingChunksToLoad.length;
            }),
            // Result is cached per-insert/remove to avoid per-frame array allocation at 60 Hz.
            getLoadedChunks: () => Effect.gen(function* () {
                return yield* Option.match(yield* Ref.get(cachedLoadedChunksRef), {
                    onSome: Effect.succeed,
                    onNone: () => Effect.gen(function* () {
                        const state = yield* Ref.get(cache);
                        const chunks = Arr.map(Arr.fromIterable(HashMap.values(state.chunks)), (entry) => entry.chunk);
                        yield* Ref.set(cachedLoadedChunksRef, Option.some(chunks));
                        return chunks;
                    }),
                });
            }),
            drainRenderDirtyChunks: () => Effect.gen(function* () {
                const renderDirtyKeys = yield* Ref.modify(cache, (s) => [
                    s.renderDirtyChunks,
                    { ...s, renderDirtyChunks: HashSet.empty() },
                ]);
                const state = yield* Ref.get(cache);
                return Arr.filterMap(Arr.fromIterable(renderDirtyKeys), (key) => Option.map(HashMap.get(state.chunks, key), (entry) => entry.chunk));
            }),
            // Also marks 8 neighbors dirty — corner lighting samples cross chunk borders.
            markChunkDirty: (coord) => Effect.gen(function* () {
                const worldId = yield* Ref.get(worldIdRef);
                const key = chunkCoordToWorldKey(coord, worldId);
                // Recompute lighting for the modified chunk in-place — the existing skyLight/blockLight
                // buffers are reused (lightBufferOrFresh checks byteLength) so no extra allocations.
                const state = yield* Ref.get(cache);
                yield* Option.match(HashMap.get(state.chunks, key), {
                    onNone: () => Effect.void,
                    onSome: (entry) => lightEngine.updateLight(entry.chunk).pipe(Effect.tap((grids) => Ref.update(cache, (s) => Option.match(HashMap.get(s.chunks, key), {
                        /* c8 ignore next */
                        onNone: () => s,
                        onSome: (e) => ({
                            ...s,
                            chunks: HashMap.set(s.chunks, key, {
                                ...e,
                                chunk: { ...e.chunk, skyLight: grids.skyLight, blockLight: grids.blockLight },
                            }),
                        }),
                    })))),
                });
                // Mark this chunk + 8 neighbors as dirty (renderer re-meshes from dirty set).
                const neighborOffsets = [
                    [0, 0],
                    [-1, -1], [-1, 0], [-1, 1],
                    [0, -1], [0, 1],
                    [1, -1], [1, 0], [1, 1],
                ];
                const allKeys = Arr.map(neighborOffsets, ([dx, dz]) => chunkCoordToWorldKey({ x: coord.x + dx, z: coord.z + dz }, worldId));
                yield* Ref.update(cache, (s) => ({
                    ...s,
                    dirtyChunks: Arr.reduce(allKeys, s.dirtyChunks, (set, k) => HashSet.add(set, k)),
                    renderDirtyChunks: Arr.reduce(allKeys, s.renderDirtyChunks, (set, k) => HashSet.add(set, k)),
                }));
            }),
            saveDirtyChunks: () => Effect.gen(function* () {
                // Snapshot the dirty key set — saves only these keys, not any new ones added
                // during the async save loop. Clears only the saved keys afterward so that
                // block modifications arriving mid-save are not silently discarded.
                // HashSet is immutable — holding a reference IS a snapshot (no defensive copy needed).
                const state = yield* Ref.get(cache);
                const keysToSave = state.dirtyChunks;
                const currentWorldId = yield* Ref.get(worldIdRef);
                yield* Effect.forEach(Arr.filterMap(Arr.fromIterable(keysToSave), (key) => HashMap.get(state.chunks, key)), (entry) => storageService.saveChunk(entry.worldId ?? currentWorldId, entry.chunk.coord, {
                    blocks: entry.chunk.blocks,
                    fluid: Option.getOrUndefined(entry.chunk.fluid),
                }), { concurrency: 1 });
                // Clear only the keys we actually saved — preserves new dirty flags set during save.
                // HashSet.difference returns elements in s.dirtyChunks NOT in keysToSave.
                yield* Ref.update(cache, (s) => ({
                    ...s,
                    dirtyChunks: HashSet.difference(s.dirtyChunks, keysToSave),
                }));
            }),
            unloadChunk: (coord) => unloadChunk(ctx, coord),
        };
    }),
}) {
}
export const ChunkManagerServiceLive = ChunkManagerService.Default;
//# sourceMappingURL=chunk-manager-service.js.map
