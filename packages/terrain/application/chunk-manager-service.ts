import { Array as Arr, Clock, Effect, HashMap, HashSet, Option, Ref } from 'effect'
import { ChunkService } from './chunk-service'
import { computeMaxY, type Chunk } from '../domain/chunk'
import { ChunkCoord, type WorldId } from '@ts-minecraft/kernel'
import { StorageError } from '@ts-minecraft/world-state'
import { LightEngineService } from './light-engine-service'
import {
  aabbFromVoxels,
  fullChunkAABB,
  unionAABB,
  type ChunkAABB,
} from '../domain/chunk-aabb'
import { StorageServicePort } from '../domain/storage-service-port'
import { Position, ChunkCacheKey, DEFAULT_WORLD_ID } from '@ts-minecraft/kernel'
import { BiomeService } from './biome-service'
import { NoiseServicePort } from '../domain/noise-service-port'
import { TerrainWorkerPoolPort } from './terrain-worker-pool-port'
import {
  chunkDistanceSquared,
  worldToChunkCoord,
  getChunksInRenderDistance,
  countChunksInRadius,
  chunkCoordToWorldKey,
} from '../domain/chunk-coord-utils'
import { RENDER_DISTANCE, UNLOAD_DISTANCE, MAX_CACHED_CHUNKS, ChunkManagerError } from './chunk-manager-constants'
import { type ChunkCache, type ChunkCacheEntry } from './chunk-manager-cache'
import { type ChunkOpsContext, getChunk, unloadChunk } from './chunk-manager-ops'

export { RENDER_DISTANCE, UNLOAD_DISTANCE, MAX_CACHED_CHUNKS } from './chunk-manager-constants'
export type { ChunkManagerError } from './chunk-manager-constants'

const MAX_CHUNK_LOADS_PER_CALL = 4
const CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE = 3
type ChunkLoadOptions = {
  readonly eager?: boolean
}

let activeChunkWorldIdRef: WorldId = DEFAULT_WORLD_ID
let activeChunkWorldServiceUpdater: ((worldId: WorldId) => void) | undefined

export const setActiveChunkWorldId = (worldId: WorldId): void => {
  activeChunkWorldIdRef = worldId
  activeChunkWorldServiceUpdater?.(worldId)
}
export class ChunkManagerService extends Effect.Service<ChunkManagerService>()(
  '@minecraft/application/ChunkManagerService',
  {
    effect: Effect.gen(function* () {
      yield* ChunkService
      const storageService = yield* StorageServicePort
      yield* BiomeService
      const noiseService = yield* NoiseServicePort
      const terrainPool = yield* TerrainWorkerPoolPort
      const lightEngine = yield* LightEngineService

      const emptyCacheState = (): ChunkCache => ({
        chunks: HashMap.empty<ChunkCacheKey, ChunkCacheEntry>(),
        dirtyChunks: HashSet.empty<ChunkCacheKey>(),
        renderDirtyChunks: HashSet.empty<ChunkCacheKey>(),
        renderDirtyAABBs: HashMap.empty<ChunkCacheKey, ChunkAABB>(),
      })

      const cache = yield* Ref.make<ChunkCache>(emptyCacheState())

      const cachedLoadedChunksRef = yield* Ref.make<Option.Option<ReadonlyArray<Chunk>>>(Option.none())
      const maxCachedChunksRef = yield* Ref.make(MAX_CACHED_CHUNKS)
      const worldIdRef = yield* Ref.make<WorldId>(activeChunkWorldIdRef)
      const lastLoadTimeRef = yield* Ref.make<number>(-200)
      const accessCounterRef = yield* Ref.make<number>(0)
      const loadSemaphore = yield* Effect.makeSemaphore(4)

      const updateActiveWorldId = (worldId: WorldId): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          activeChunkWorldIdRef = worldId
          yield* Ref.set(worldIdRef, worldId)
          yield* Ref.set(cache, emptyCacheState())
          yield* Ref.set(cachedLoadedChunksRef, Option.none())
          yield* Ref.set(maxCachedChunksRef, MAX_CACHED_CHUNKS)
          yield* Ref.set(lastLoadTimeRef, -200)
          yield* Ref.set(accessCounterRef, 0)
        })

      activeChunkWorldServiceUpdater = (worldId) => {
        Effect.runSync(updateActiveWorldId(worldId))
      }

      const ctx: ChunkOpsContext = {
        worldIdRef,
        cache,
        cachedLoadedChunksRef,
        maxCachedChunksRef,
        accessCounterRef,
        storageService,
        noiseService,
        terrainPool,
        lightEngine,
      }

      const service = {
        getChunk: (coord: ChunkCoord) => getChunk(ctx, coord),

        loadChunksAroundPlayer: (playerPos: Position, renderDistance: number = RENDER_DISTANCE, options: ChunkLoadOptions = {}): Effect.Effect<boolean, ChunkManagerError> =>
          Effect.gen(function* () {
            if (options.eager !== true) {
              const now = yield* Clock.currentTimeMillis
              const shouldLoad = yield* Ref.modify(lastLoadTimeRef, (last) =>
                now - last < 200 ? [false, last] : [true, now]
              )
              if (!shouldLoad) {
                return false
              }
            }

            const centerChunk = worldToChunkCoord(playerPos)
            const chunkCacheCapacity = Math.max(MAX_CACHED_CHUNKS, countChunksInRadius(renderDistance + 2))
            yield* Ref.update(maxCachedChunksRef, (current) => Math.max(current, chunkCacheCapacity))

            const currentWorldId = yield* Ref.get(worldIdRef)
            const chunksToLoad = getChunksInRenderDistance(centerChunk, renderDistance)
            const stateBeforeLoad = yield* Ref.get(cache)
            const missingChunksToLoad = Arr.filter(
              chunksToLoad,
              (coord) => !HashMap.has(stateBeforeLoad.chunks, chunkCoordToWorldKey(coord, currentWorldId)),
            )

            const shouldBatchLoads = options.eager !== true && renderDistance >= CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE
            const chunkLoadBatch = shouldBatchLoads
              ? Arr.take(missingChunksToLoad, MAX_CHUNK_LOADS_PER_CALL)
              : missingChunksToLoad

            yield* Effect.forEach(
              chunkLoadBatch,
              (coord) => loadSemaphore.withPermits(1)(getChunk(ctx, coord)),
              { concurrency: 4 }
            )

            const state = yield* Ref.get(cache)
            const unloadDistance = Math.max(renderDistance + 2, UNLOAD_DISTANCE)
            const maxDistance = unloadDistance * unloadDistance

            yield* Effect.forEach(
              Arr.filter(Arr.fromIterable(HashMap.values(state.chunks)), (entry) =>
                chunkDistanceSquared(entry.chunk.coord, centerChunk) > maxDistance
              ),
              (entry) => unloadChunk(ctx, entry.chunk.coord),
              { concurrency: 1 }
            )

            return chunkLoadBatch.length === missingChunksToLoad.length
          }),

        getLoadedChunks: (): Effect.Effect<ReadonlyArray<Chunk>, never> =>
          Effect.gen(function* () {
            return yield* Option.match(yield* Ref.get(cachedLoadedChunksRef), {
              onSome: Effect.succeed,
              onNone: () => Effect.gen(function* () {
                const state = yield* Ref.get(cache)
                const chunks: ReadonlyArray<Chunk> = Arr.map(Arr.fromIterable(HashMap.values(state.chunks)), (entry) => entry.chunk)
                yield* Ref.set(cachedLoadedChunksRef, Option.some(chunks))
                return chunks
              }),
            })
          }),

        drainRenderDirtyChunks: (): Effect.Effect<ReadonlyArray<Chunk>, never> =>
          Effect.gen(function* () {
            // Drain both the key set AND the AABB map atomically — see
            // drainRenderDirtyChunkEntries for the AABB-aware variant.
            const renderDirtyKeys = yield* Ref.modify(cache, (s) => [
              s.renderDirtyChunks,
              {
                ...s,
                renderDirtyChunks: HashSet.empty<ChunkCacheKey>(),
                renderDirtyAABBs: HashMap.empty<ChunkCacheKey, ChunkAABB>(),
              },
            ])
            const state = yield* Ref.get(cache)
            return Arr.filterMap(
              Arr.fromIterable(renderDirtyKeys),
              (key) => Option.map(HashMap.get(state.chunks, key), (entry) => entry.chunk),
            )
          }),

        // FR-4.2: AABB-aware variant of drainRenderDirtyChunks. Each entry
        // carries the chunk's accumulated dirty AABB (or Option.none() for
        // "full chunk", e.g. first-time bake / SEC-W1 fall-back). Callers
        // pass the AABB to ChunkMeshService.updateChunkMesh so meshing
        // workers can later restrict greedy-meshing to the changed region
        // (FR-4.1). Behaviour-equivalent to drainRenderDirtyChunks when the
        // AABB is full or absent.
        drainRenderDirtyChunkEntries: (): Effect.Effect<
          ReadonlyArray<{ readonly chunk: Chunk; readonly dirtyAABB: Option.Option<ChunkAABB> }>,
          never
        > =>
          Effect.gen(function* () {
            const drained = yield* Ref.modify(cache, (s) => {
              const ret = { keys: s.renderDirtyChunks, aabbs: s.renderDirtyAABBs } as const
              const next: ChunkCache = {
                ...s,
                renderDirtyChunks: HashSet.empty<ChunkCacheKey>(),
                renderDirtyAABBs: HashMap.empty<ChunkCacheKey, ChunkAABB>(),
              }
              return [ret, next] as const
            })
            const state = yield* Ref.get(cache)
            return Arr.filterMap(Arr.fromIterable(drained.keys), (key) =>
              Option.map(HashMap.get(state.chunks, key), (entry) => ({
                chunk: entry.chunk,
                dirtyAABB: HashMap.get(drained.aabbs, key),
              })),
            )
          }),

        markChunkDirty: (coord: ChunkCoord, dirtyVoxels?: ReadonlyArray<{ readonly lx: number; readonly y: number; readonly lz: number }>): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const worldId = yield* Ref.get(worldIdRef)
            const key = chunkCoordToWorldKey(coord, worldId)
            const state = yield* Ref.get(cache)

            // FR-3.4: when dirty voxels are supplied AND prior lighting exists,
            // run BFS-incremental propagation. Otherwise fall back to full
            // re-compute (preserves legacy behavior + first-time light bake).
            // FR-3.5: BFS reports which neighbors actually had boundary voxels
            // touched; only those neighbors get added to the dirty/render-dirty
            // sets (vs. the legacy "always all 9").
            // FR-4.2: BFS also reports `affectedAABB` — the bounding box of every
            // voxel whose light value changed. We accumulate this into
            // `renderDirtyAABBs` so re-mesh can be sub-region-restricted.
            const bfsResult = yield* Option.match(HashMap.get(state.chunks, key), {
              onNone: () => Effect.succeed(Option.none<{
                boundary: { nx: boolean; px: boolean; nz: boolean; pz: boolean }
                affectedAABB: Option.Option<ChunkAABB>
              }>()),
              onSome: (entry) => {
                const hasPrior = entry.chunk.skyLight !== undefined && entry.chunk.blockLight !== undefined
                const useBfs = hasPrior && dirtyVoxels !== undefined && dirtyVoxels.length > 0
                return useBfs
                  ? lightEngine.propagateLightIncremental(entry.chunk, dirtyVoxels).pipe(
                      Effect.tap((result) =>
                        Ref.update(cache, (s) =>
                          Option.match(HashMap.get(s.chunks, key), {
                            onNone: () => s,
                            onSome: (e) => ({
                              ...s,
                              chunks: HashMap.set(s.chunks, key, {
                                ...e,
                                // FR-3.3: refresh maxY after edit — blocks were mutated in-place
                                // before markChunkDirty; stale maxY would frustum-cull tower tops.
                                chunk: { ...e.chunk, skyLight: result.skyLight, blockLight: result.blockLight, maxY: computeMaxY(e.chunk.blocks) },
                              }),
                            }),
                          })
                        )
                      ),
                      Effect.map((r) => Option.some({ boundary: r.boundary, affectedAABB: r.affectedAABB })),
                    )
                  : lightEngine.updateLight(entry.chunk).pipe(
                      Effect.tap((grids) =>
                        Ref.update(cache, (s) =>
                          Option.match(HashMap.get(s.chunks, key), {
                            onNone: () => s,
                            onSome: (e) => ({
                              ...s,
                              chunks: HashMap.set(s.chunks, key, {
                                ...e,
                                // FR-3.3: refresh maxY after edit — see BFS branch above.
                                chunk: { ...e.chunk, skyLight: grids.skyLight, blockLight: grids.blockLight, maxY: computeMaxY(e.chunk.blocks) },
                              }),
                            }),
                          })
                        )
                      ),
                      Effect.map(() => Option.none<{
                        boundary: { nx: boolean; px: boolean; nz: boolean; pz: boolean }
                        affectedAABB: Option.Option<ChunkAABB>
                      }>()),
                    )
              },
            })

            // Determine neighbor offsets to mark dirty:
            // - If BFS reported a precise boundary set, mark only those.
            // - Otherwise (no BFS), preserve legacy 9-neighbor behavior.
            const allOffsets: ReadonlyArray<readonly [number, number]> = [
              [0, 0],
              [-1, -1], [-1, 0], [-1, 1],
              [0, -1], [0, 1],
              [1, -1], [1, 0], [1, 1],
            ]
            const offsetsToMark = Option.match(bfsResult, {
              onNone: () => allOffsets,
              onSome: ({ boundary: b }) => Arr.filter(allOffsets, ([dx, dz]) => {
                if (dx === 0 && dz === 0) return true
                if (dx === -1 && b.nx) return true
                if (dx === 1 && b.px) return true
                if (dz === -1 && b.nz) return true
                if (dz === 1 && b.pz) return true
                // Diagonal neighbors only if both axes touched
                if (dx === -1 && dz === -1) return b.nx && b.nz
                if (dx === -1 && dz === 1) return b.nx && b.pz
                if (dx === 1 && dz === -1) return b.px && b.nz
                if (dx === 1 && dz === 1) return b.px && b.pz
                return false
              }),
            })
            const allKeys = Arr.map(offsetsToMark, ([dx, dz]) =>
              chunkCoordToWorldKey({ x: coord.x + dx, z: coord.z + dz }, worldId)
            )

            // FR-4.2: AABB for the EDITED chunk (offset 0,0) =
            //   union(seed AABB from dirtyVoxels, BFS-reported affectedAABB).
            // For NEIGHBOR chunks, we don't know the precise affected region,
            // so we conservatively assign `fullChunkAABB` — same effect as
            // legacy full re-mesh. Future work: light-engine could expose
            // per-neighbor AABBs for tighter neighbor re-mesh.
            const seedAABB = dirtyVoxels === undefined ? Option.none<ChunkAABB>() : aabbFromVoxels(dirtyVoxels)
            const bfsAABB = Option.flatMap(bfsResult, (r) => r.affectedAABB)
            const editedChunkAABB: ChunkAABB = Option.match(
              Option.match(seedAABB, {
                onNone: () => bfsAABB,
                onSome: (s) => Option.match(bfsAABB, {
                  onNone: () => Option.some(s),
                  onSome: (b) => Option.some(unionAABB(s, b)),
                }),
              }),
              { onNone: () => fullChunkAABB, onSome: (a) => a },
            )
            const editedKey = chunkCoordToWorldKey(coord, worldId)

            yield* Ref.update(cache, (s) => ({
              ...s,
              dirtyChunks: Arr.reduce(allKeys, s.dirtyChunks, (set, k) => HashSet.add(set, k)),
              renderDirtyChunks: Arr.reduce(allKeys, s.renderDirtyChunks, (set, k) => HashSet.add(set, k)),
              renderDirtyAABBs: Arr.reduce(allKeys, s.renderDirtyAABBs, (m, k) => {
                const incoming = k === editedKey ? editedChunkAABB : fullChunkAABB
                // Union with any existing AABB so multiple markChunkDirty calls
                // on the same chunk grow (never shrink) the dirty region.
                return Option.match(HashMap.get(m, k), {
                  onNone: () => HashMap.set(m, k, incoming),
                  onSome: (existing) => HashMap.set(m, k, unionAABB(existing, incoming)),
                })
              }),
            }))
          }),

        saveDirtyChunks: (): Effect.Effect<void, StorageError> =>
          Effect.gen(function* () {
            const state = yield* Ref.get(cache)
            const keysToSave = state.dirtyChunks
            const currentWorldId = yield* Ref.get(worldIdRef)

            yield* Effect.forEach(
              Arr.filterMap(Arr.fromIterable(keysToSave), (key) => HashMap.get(state.chunks, key)),
              (entry) => storageService.saveChunk(entry.worldId ?? currentWorldId, entry.chunk.coord, {
                blocks: entry.chunk.blocks,
                fluid: Option.getOrUndefined(entry.chunk.fluid),
              }),
              { concurrency: 1 }
            )

            yield* Ref.update(cache, (s) => ({
              ...s,
              dirtyChunks: HashSet.difference(s.dirtyChunks, keysToSave),
            }))
          }),

        unloadChunk: (coord: ChunkCoord) => unloadChunk(ctx, coord),
      }

      return service
    }),
  }
) {}
export const ChunkManagerServiceLive = ChunkManagerService.Default
