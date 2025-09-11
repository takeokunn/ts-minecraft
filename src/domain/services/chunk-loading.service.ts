/**
 * Chunk Loading Service - Effect-TS Domain Service for Chunk Management
 *
 * This service provides pure domain logic for chunk loading, generation,
 * and management using Effect-TS patterns with proper error handling.
 */

import { Effect, Context, Layer, Queue, Ref, HashMap, Option, Duration, Schedule, Data } from 'effect'
import { EntityId } from '@domain/entities'
import { ChunkNotLoadedError, ChunkGenerationError, WorldStateError } from '@domain/errors/unified-errors'
import { CHUNK_SIZE } from '@domain/constants/world-constants'

// ===== CHUNK LOADING DOMAIN TYPES =====

export interface ChunkCoordinates {
  readonly x: number
  readonly z: number
}

export interface ChunkData {
  readonly coordinates: ChunkCoordinates
  readonly blocks: readonly GeneratedBlock[]
  readonly heightMap: readonly number[]
  readonly biomeMap: readonly string[]
  readonly entities: readonly EntityId[]
  readonly metadata: ChunkMetadata
}

export interface GeneratedBlock {
  readonly position: { x: number; y: number; z: number }
  readonly blockType: string
  readonly properties?: Record<string, unknown>
}

export interface ChunkMetadata {
  readonly generatedAt: Date
  readonly lastAccessed: Date
  readonly version: string
  readonly size: number
  readonly entityCount: number
  readonly blockCount: number
}

export interface ChunkLoadRequest {
  readonly coordinates: ChunkCoordinates
  readonly priority: ChunkPriority
  readonly requesterEntityId: EntityId
  readonly options?: ChunkLoadOptions
}

export interface ChunkLoadOptions {
  readonly generateTerrain?: boolean
  readonly generateMesh?: boolean
  readonly loadEntities?: boolean
  readonly preloadNeighbors?: boolean
}

export interface ChunkLoadResult {
  readonly coordinates: ChunkCoordinates
  readonly success: boolean
  readonly loadTime: number
  readonly data?: ChunkData
  readonly error?: string
}

export type ChunkPriority = 'low' | 'normal' | 'high' | 'critical'

export type ChunkLoadingStatus = 'pending' | 'loading' | 'generating' | 'meshing' | 'loaded' | 'error' | 'unloaded'

export interface ChunkLoadingState {
  readonly coordinates: ChunkCoordinates
  readonly status: ChunkLoadingStatus
  readonly priority: ChunkPriority
  readonly requestedBy: EntityId
  readonly requestTime: Date
  readonly progress: number // 0-100
  readonly error?: string
}

export interface ChunkLoadingStats {
  readonly totalRequests: number
  readonly completedLoads: number
  readonly failedLoads: number
  readonly averageLoadTime: number
  readonly currentlyLoading: number
  readonly queueSize: number
  readonly cacheHitRate: number
  readonly memoryUsage: number
}

// ===== PORT INTERFACES =====

export interface TerrainGeneratorPort {
  readonly generateTerrain: (coordinates: ChunkCoordinates) => Effect.Effect<ChunkData, ChunkGenerationError>
}

export const TerrainGeneratorPort = Context.GenericTag<TerrainGeneratorPort>('TerrainGeneratorPort')

export interface ChunkRepositoryPort {
  readonly saveChunk: (chunkData: ChunkData) => Effect.Effect<void, never>
  readonly loadChunk: (coordinates: ChunkCoordinates) => Effect.Effect<Option.Option<ChunkData>, never>
  readonly deleteChunk: (coordinates: ChunkCoordinates) => Effect.Effect<void, never>
  readonly chunkExists: (coordinates: ChunkCoordinates) => Effect.Effect<boolean, never>
}

export const ChunkRepositoryPort = Context.GenericTag<ChunkRepositoryPort>('ChunkRepositoryPort')

export interface MeshGeneratorPort {
  readonly generateMesh: (chunkData: ChunkData) => Effect.Effect<unknown, never> // Mesh data would be typed properly
}

export const MeshGeneratorPort = Context.GenericTag<MeshGeneratorPort>('MeshGeneratorPort')

// ===== CHUNK LOADING SERVICE INTERFACE =====

export interface ChunkLoadingService {
  readonly requestChunkLoad: (request: ChunkLoadRequest) => Effect.Effect<void, never>
  readonly getChunkData: (coordinates: ChunkCoordinates) => Effect.Effect<ChunkData, ChunkNotLoadedError>
  readonly isChunkLoaded: (coordinates: ChunkCoordinates) => Effect.Effect<boolean, never>
  readonly unloadChunk: (coordinates: ChunkCoordinates) => Effect.Effect<boolean, never>
  readonly preloadArea: (center: ChunkCoordinates, radius: number, requesterEntityId: EntityId) => Effect.Effect<number, never>
  readonly getLoadingStatus: (coordinates: ChunkCoordinates) => Effect.Effect<Option.Option<ChunkLoadingState>, never>
  readonly getAllLoadingStates: () => Effect.Effect<readonly ChunkLoadingState[], never>
  readonly getStats: () => Effect.Effect<ChunkLoadingStats, never>
  readonly clearCache: () => Effect.Effect<void, never>
  readonly cancelChunkLoad: (coordinates: ChunkCoordinates) => Effect.Effect<boolean, never>
  readonly waitForChunkLoad: (coordinates: ChunkCoordinates, timeout?: Duration.Duration) => Effect.Effect<ChunkData, ChunkNotLoadedError | ChunkGenerationError>
}

export const ChunkLoadingService = Context.GenericTag<ChunkLoadingService>('ChunkLoadingService')

// ===== HELPER FUNCTIONS =====

const chunkKey = (coordinates: ChunkCoordinates): string => `${coordinates.x},${coordinates.z}`

const getNeighborCoordinates = (center: ChunkCoordinates, radius: number): readonly ChunkCoordinates[] => {
  const neighbors: ChunkCoordinates[] = []
  for (let x = center.x - radius; x <= center.x + radius; x++) {
    for (let z = center.z - radius; z <= center.z + radius; z++) {
      if (x !== center.x || z !== center.z) {
        neighbors.push({ x, z })
      }
    }
  }
  return neighbors
}

const priorityWeight = (priority: ChunkPriority): number => {
  switch (priority) {
    case 'critical':
      return 4
    case 'high':
      return 3
    case 'normal':
      return 2
    case 'low':
      return 1
    default:
      return 1
  }
}

const calculateDistance = (a: ChunkCoordinates, b: ChunkCoordinates): number => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.z - b.z, 2))

// ===== CHUNK LOADING SERVICE IMPLEMENTATION =====

export const ChunkLoadingServiceLive = Layer.effect(
  ChunkLoadingService,
  Effect.gen(function* () {
    const terrainGenerator = yield* TerrainGeneratorPort
    const chunkRepository = yield* ChunkRepositoryPort
    const meshGenerator = yield* MeshGeneratorPort

    // Internal state management
    const loadedChunks = yield* Ref.make(HashMap.empty<string, ChunkData>())
    const loadingStates = yield* Ref.make(HashMap.empty<string, ChunkLoadingState>())
    const loadQueue = yield* Queue.bounded<ChunkLoadRequest>(1000)
    const completionQueues = yield* Ref.make(HashMap.empty<string, Queue.Queue<ChunkLoadResult>>())

    // Statistics tracking
    const stats = yield* Ref.make({
      totalRequests: 0,
      completedLoads: 0,
      failedLoads: 0,
      totalLoadTime: 0,
      cacheHits: 0,
      memoryUsage: 0,
    })

    // Configuration
    const MAX_CONCURRENT_LOADS = 4
    const CACHE_SIZE_LIMIT = 500
    const CHUNK_TIMEOUT = Duration.seconds(30)

    // Process chunk loading queue
    const processLoadQueue = Effect.gen(function* () {
      while (true) {
        // Take request from queue
        const request = yield* Queue.take(loadQueue)

        // Process the load request
        yield* Effect.fork(processChunkLoadRequest(request))
      }
    })

    const processChunkLoadRequest = (request: ChunkLoadRequest): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const key = chunkKey(request.coordinates)
        const startTime = Date.now()

        // Update loading state
        yield* Ref.update(
          loadingStates,
          HashMap.set(key, {
            coordinates: request.coordinates,
            status: 'loading' as ChunkLoadingStatus,
            priority: request.priority,
            requestedBy: request.requesterEntityId,
            requestTime: new Date(),
            progress: 0,
          }),
        )

        try {
          // Check if chunk is already in cache
          const cached = yield* Ref.get(loadedChunks)
          const cachedChunk = HashMap.get(cached, key)

          if (Option.isSome(cachedChunk)) {
            // Cache hit - update stats and complete request
            yield* Ref.update(stats, (s) => ({ ...s, cacheHits: s.cacheHits + 1, completedLoads: s.completedLoads + 1 }))
            yield* updateLoadingState(key, 'loaded', 100)
            yield* notifyCompletion(request.coordinates, {
              coordinates: request.coordinates,
              success: true,
              loadTime: Date.now() - startTime,
              data: cachedChunk.value,
            })
            return
          }

          // Check repository for persisted chunk
          const persistedChunk = yield* chunkRepository.loadChunk(request.coordinates)

          if (Option.isSome(persistedChunk)) {
            // Load from repository
            yield* updateLoadingState(key, 'loaded', 100)
            yield* Ref.update(loadedChunks, HashMap.set(key, persistedChunk.value))
            yield* Ref.update(stats, (s) => ({ ...s, completedLoads: s.completedLoads + 1 }))
            yield* notifyCompletion(request.coordinates, {
              coordinates: request.coordinates,
              success: true,
              loadTime: Date.now() - startTime,
              data: persistedChunk.value,
            })
            return
          }

          // Generate new terrain
          yield* updateLoadingState(key, 'generating', 25)
          const chunkData = yield* terrainGenerator.generateTerrain(request.coordinates)

          yield* updateLoadingState(key, 'meshing', 75)

          // Generate mesh if requested
          if (request.options?.generateMesh !== false) {
            yield* meshGenerator.generateMesh(chunkData)
          }

          // Save to repository and cache
          yield* chunkRepository.saveChunk(chunkData)
          yield* Ref.update(loadedChunks, HashMap.set(key, chunkData))
          yield* updateLoadingState(key, 'loaded', 100)

          // Update statistics
          const loadTime = Date.now() - startTime
          yield* Ref.update(stats, (s) => ({
            ...s,
            completedLoads: s.completedLoads + 1,
            totalLoadTime: s.totalLoadTime + loadTime,
          }))

          // Notify completion
          yield* notifyCompletion(request.coordinates, {
            coordinates: request.coordinates,
            success: true,
            loadTime,
            data: chunkData,
          })

          // Preload neighbors if requested
          if (request.options?.preloadNeighbors) {
            const neighbors = getNeighborCoordinates(request.coordinates, 1)
            yield* Effect.forEach(
              neighbors,
              (coords) =>
                Queue.offer(loadQueue, {
                  coordinates: coords,
                  priority: 'low' as ChunkPriority,
                  requesterEntityId: request.requesterEntityId,
                  options: { ...request.options, preloadNeighbors: false },
                }),
              { concurrency: 'unbounded', discard: true },
            )
          }
        } catch (error) {
          // Handle load failure
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          yield* updateLoadingState(key, 'error', 0, errorMessage)
          yield* Ref.update(stats, (s) => ({ ...s, failedLoads: s.failedLoads + 1 }))
          yield* notifyCompletion(request.coordinates, {
            coordinates: request.coordinates,
            success: false,
            loadTime: Date.now() - startTime,
            error: errorMessage,
          })
        }
      })

    const updateLoadingState = (key: string, status: ChunkLoadingStatus, progress: number, error?: string): Effect.Effect<void, never> =>
      Ref.update(loadingStates, (states) => {
        const existing = HashMap.get(states, key)
        if (Option.isSome(existing)) {
          const updated = { ...existing.value, status, progress, error }
          return HashMap.set(states, key, updated)
        }
        return states
      })

    const notifyCompletion = (coordinates: ChunkCoordinates, result: ChunkLoadResult): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const key = chunkKey(coordinates)
        const queues = yield* Ref.get(completionQueues)
        const queue = HashMap.get(queues, key)
        if (Option.isSome(queue)) {
          yield* Queue.offer(queue.value, result)
        }
      })

    // Start background processing
    yield* Effect.fork(processLoadQueue)

    // Implement service methods
    const requestChunkLoad = (request: ChunkLoadRequest): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        yield* Ref.update(stats, (s) => ({ ...s, totalRequests: s.totalRequests + 1 }))
        yield* Queue.offer(loadQueue, request)
      })

    const getChunkData = (coordinates: ChunkCoordinates): Effect.Effect<ChunkData, ChunkNotLoadedError> =>
      Effect.gen(function* () {
        const chunks = yield* Ref.get(loadedChunks)
        const chunk = HashMap.get(chunks, chunkKey(coordinates))

        return Option.match(chunk, {
          onNone: () => new ChunkNotLoadedError({ chunkX: coordinates.x, chunkZ: coordinates.z }),
          onSome: (data) => data,
        })
      }).pipe(Effect.flatMap(Effect.succeed))

    const isChunkLoaded = (coordinates: ChunkCoordinates): Effect.Effect<boolean, never> =>
      Effect.gen(function* () {
        const chunks = yield* Ref.get(loadedChunks)
        return HashMap.has(chunks, chunkKey(coordinates))
      })

    const unloadChunk = (coordinates: ChunkCoordinates): Effect.Effect<boolean, never> =>
      Effect.gen(function* () {
        const key = chunkKey(coordinates)
        const chunks = yield* Ref.get(loadedChunks)
        const states = yield* Ref.get(loadingStates)

        const hasChunk = HashMap.has(chunks, key)
        if (hasChunk) {
          yield* Ref.update(loadedChunks, HashMap.remove(key))
          yield* Ref.update(loadingStates, HashMap.remove(key))
        }

        return hasChunk
      })

    const preloadArea = (center: ChunkCoordinates, radius: number, requesterEntityId: EntityId): Effect.Effect<number, never> =>
      Effect.gen(function* () {
        const chunks = getNeighborCoordinates(center, radius)
        let requestCount = 0

        for (const coords of chunks) {
          const alreadyLoaded = yield* isChunkLoaded(coords)
          if (!alreadyLoaded) {
            const distance = calculateDistance(center, coords)
            const priority: ChunkPriority = distance <= 1 ? 'high' : distance <= 2 ? 'normal' : 'low'

            yield* requestChunkLoad({
              coordinates: coords,
              priority,
              requesterEntityId,
              options: { generateMesh: true, preloadNeighbors: false },
            })
            requestCount++
          }
        }

        return requestCount
      })

    const getLoadingStatus = (coordinates: ChunkCoordinates): Effect.Effect<Option.Option<ChunkLoadingState>, never> =>
      Effect.gen(function* () {
        const states = yield* Ref.get(loadingStates)
        return HashMap.get(states, chunkKey(coordinates))
      })

    const getAllLoadingStates = (): Effect.Effect<readonly ChunkLoadingState[], never> =>
      Effect.gen(function* () {
        const states = yield* Ref.get(loadingStates)
        return Array.from(HashMap.values(states))
      })

    const getStats = (): Effect.Effect<ChunkLoadingStats, never> =>
      Effect.gen(function* () {
        const currentStats = yield* Ref.get(stats)
        const chunks = yield* Ref.get(loadedChunks)
        const states = yield* Ref.get(loadingStates)
        const queueSize = yield* Queue.size(loadQueue)

        const currentlyLoading = Array.from(HashMap.values(states)).filter(
          (state) => state.status === 'loading' || state.status === 'generating' || state.status === 'meshing',
        ).length

        const averageLoadTime = currentStats.completedLoads > 0 ? currentStats.totalLoadTime / currentStats.completedLoads : 0

        const cacheHitRate = currentStats.totalRequests > 0 ? currentStats.cacheHits / currentStats.totalRequests : 0

        // Rough memory estimation
        const memoryUsage = HashMap.size(chunks) * 1024 * 1024 // 1MB per chunk estimate

        return {
          totalRequests: currentStats.totalRequests,
          completedLoads: currentStats.completedLoads,
          failedLoads: currentStats.failedLoads,
          averageLoadTime,
          currentlyLoading,
          queueSize,
          cacheHitRate,
          memoryUsage,
        }
      })

    const clearCache = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        yield* Ref.set(loadedChunks, HashMap.empty())
        yield* Ref.set(loadingStates, HashMap.empty())
        yield* Ref.update(stats, (s) => ({ ...s, memoryUsage: 0 }))
      })

    const cancelChunkLoad = (coordinates: ChunkCoordinates): Effect.Effect<boolean, never> =>
      Effect.gen(function* () {
        const key = chunkKey(coordinates)
        const states = yield* Ref.get(loadingStates)
        const state = HashMap.get(states, key)

        if (Option.isSome(state) && state.value.status !== 'loaded' && state.value.status !== 'error') {
          yield* updateLoadingState(key, 'error', 0, 'Cancelled')
          return true
        }

        return false
      })

    const waitForChunkLoad = (coordinates: ChunkCoordinates, timeout = Duration.seconds(30)): Effect.Effect<ChunkData, ChunkNotLoadedError | ChunkGenerationError> =>
      Effect.gen(function* () {
        // Check if already loaded
        const alreadyLoaded = yield* isChunkLoaded(coordinates)
        if (alreadyLoaded) {
          return yield* getChunkData(coordinates)
        }

        // Create completion queue for this chunk
        const key = chunkKey(coordinates)
        const completionQueue = yield* Queue.bounded<ChunkLoadResult>(1)
        yield* Ref.update(completionQueues, HashMap.set(key, completionQueue))

        // Wait for completion or timeout
        const result = yield* Queue.take(completionQueue).pipe(
          Effect.timeout(timeout),
          Effect.catchTag('TimeoutException', () => Effect.fail(new ChunkNotLoadedError({ chunkX: coordinates.x, chunkZ: coordinates.z, message: 'Chunk load timeout' }))),
        )

        // Cleanup completion queue
        yield* Ref.update(completionQueues, HashMap.remove(key))

        if (result.success && result.data) {
          return result.data
        } else {
          return yield* Effect.fail(
            new ChunkGenerationError({
              chunkX: coordinates.x,
              chunkZ: coordinates.z,
              reason: result.error || 'Unknown error',
            }),
          )
        }
      })

    return ChunkLoadingService.of({
      requestChunkLoad,
      getChunkData,
      isChunkLoaded,
      unloadChunk,
      preloadArea,
      getLoadingStatus,
      getAllLoadingStates,
      getStats,
      clearCache,
      cancelChunkLoad,
      waitForChunkLoad,
    })
  }),
)

// ===== UTILITY FUNCTIONS =====

export const ChunkLoadingUtils = {
  /**
   * Create a chunk load request with default options
   */
  createLoadRequest: (coordinates: ChunkCoordinates, requesterEntityId: EntityId, priority: ChunkPriority = 'normal'): ChunkLoadRequest => ({
    coordinates,
    priority,
    requesterEntityId,
    options: {
      generateTerrain: true,
      generateMesh: true,
      loadEntities: true,
      preloadNeighbors: false,
    },
  }),

  /**
   * Calculate chunks in area around center point
   */
  getChunksInArea: (center: ChunkCoordinates, radius: number): readonly ChunkCoordinates[] => getNeighborCoordinates(center, radius),

  /**
   * Convert world position to chunk coordinates
   */
  worldPosToChunkCoords: (worldX: number, worldZ: number): ChunkCoordinates => ({
    x: Math.floor(worldX / CHUNK_SIZE),
    z: Math.floor(worldZ / CHUNK_SIZE),
  }),

  /**
   * Get chunk loading priority based on distance from player
   */
  getPriorityByDistance: (distance: number): ChunkPriority => {
    if (distance <= 1) return 'critical'
    if (distance <= 2) return 'high'
    if (distance <= 4) return 'normal'
    return 'low'
  },

  /**
   * Estimate memory usage for chunks
   */
  estimateChunkMemoryUsage: (chunkCount: number): number => chunkCount * 1024 * 1024, // Rough estimate: 1MB per chunk

  /**
   * Create chunk metadata
   */
  createChunkMetadata: (chunkData: ChunkData): ChunkMetadata => ({
    generatedAt: new Date(),
    lastAccessed: new Date(),
    version: '1.0.0',
    size: CHUNK_SIZE,
    entityCount: chunkData.entities.length,
    blockCount: chunkData.blocks.length,
  }),
} as const
