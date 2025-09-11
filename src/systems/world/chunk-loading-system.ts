/**
 * Chunk Loading System - Next-Generation Dynamic World Management
 * 
 * Features:
 * - Predictive chunk loading based on player movement
 * - Priority-based loading with distance weighting
 * - Asynchronous chunk generation with worker threads
 * - Memory-efficient chunk caching and unloading
 * - Streaming Level-of-Detail (LOD) for distant chunks
 * - Performance-optimized spatial queries
 */

import { Effect, pipe, Array as EffArray, Duration, Ref, HashMap, Option, Queue, Fiber } from 'effect'
import { queries, createArchetypeQuery, trackPerformance } from '@/core/queries'
import { World, ComputationWorker, Clock } from '@/runtime/services'
import { SystemFunction, SystemConfig, SystemContext } from '../core/scheduler'
import { Position, ChunkComponent, PlayerControlComponent, VelocityComponent } from '@/core/components'
import { EntityId } from '@/core/entities/entity'
import { CHUNK_SIZE, RENDER_DISTANCE, CHUNK_HEIGHT } from '@/domain/world-constants'

/**
 * Chunk loading system configuration
 */
export interface ChunkLoadingConfig {
  readonly renderDistance: number
  readonly preloadDistance: number
  readonly unloadDistance: number
  readonly maxConcurrentLoads: number
  readonly maxConcurrentUnloads: number
  readonly enablePredictiveLoading: boolean
  readonly enableLOD: boolean
  readonly lodLevels: readonly number[]
  readonly chunkCacheSize: number
  readonly priorityBased: boolean
  readonly streamingEnabled: boolean
}

/**
 * Chunk coordinates
 */
export interface ChunkCoord {
  readonly x: number
  readonly z: number
}

/**
 * Chunk loading priority
 */
export type ChunkPriority = 'immediate' | 'high' | 'normal' | 'low' | 'background'

/**
 * Chunk state
 */
export type ChunkState = 'unloaded' | 'loading' | 'loaded' | 'unloading' | 'cached'

/**
 * Chunk loading request
 */
interface ChunkLoadRequest {
  readonly coord: ChunkCoord
  readonly priority: ChunkPriority
  readonly lodLevel: number
  readonly requestTime: number
  readonly predictive: boolean
}

/**
 * Chunk unload request
 */
interface ChunkUnloadRequest {
  readonly entityId: EntityId
  readonly coord: ChunkCoord
  readonly distance: number
  readonly lastAccessed: number
}

/**
 * Chunk cache entry
 */
interface ChunkCacheEntry {
  readonly coord: ChunkCoord
  readonly data: any // Chunk data
  readonly lastAccessed: number
  readonly accessCount: number
  readonly size: number
}

/**
 * Player movement prediction
 */
interface MovementPrediction {
  readonly currentPosition: Position
  readonly velocity: VelocityComponent
  readonly predictedPosition: Position
  readonly movementDirection: { x: number, z: number }
  readonly speed: number
}

/**
 * Default chunk loading configuration
 */
export const defaultChunkLoadingConfig: ChunkLoadingConfig = {
  renderDistance: RENDER_DISTANCE,
  preloadDistance: RENDER_DISTANCE + 2,
  unloadDistance: RENDER_DISTANCE + 4,
  maxConcurrentLoads: 8,
  maxConcurrentUnloads: 4,
  enablePredictiveLoading: true,
  enableLOD: true,
  lodLevels: [4, 8, 16, 32], // Chunk simplification levels
  chunkCacheSize: 100, // Number of chunks to keep in cache
  priorityBased: true,
  streamingEnabled: true,
}

/**
 * Chunk coordinate utilities
 */
export const ChunkCoordUtils = {
  /**
   * Convert position to chunk coordinates
   */
  fromPosition: (position: Position): ChunkCoord => ({
    x: Math.floor(position.x / CHUNK_SIZE),
    z: Math.floor(position.z / CHUNK_SIZE),
  }),

  /**
   * Convert chunk coordinates to world position
   */
  toWorldPosition: (coord: ChunkCoord): Position => ({
    x: coord.x * CHUNK_SIZE,
    y: 0,
    z: coord.z * CHUNK_SIZE,
  }),

  /**
   * Calculate distance between two chunk coordinates
   */
  distance: (a: ChunkCoord, b: ChunkCoord): number => {
    const dx = a.x - b.x
    const dz = a.z - b.z
    return Math.sqrt(dx * dx + dz * dz)
  },

  /**
   * Create chunk key string
   */
  toKey: (coord: ChunkCoord): string => `${coord.x},${coord.z}`,

  /**
   * Parse chunk key string
   */
  fromKey: (key: string): Option.Option<ChunkCoord> => {
    const parts = key.split(',')
    if (parts.length !== 2) return Option.none()
    
    const x = parseInt(parts[0]!, 10)
    const z = parseInt(parts[1]!, 10)
    
    if (isNaN(x) || isNaN(z)) return Option.none()
    
    return Option.some({ x, z })
  },

  /**
   * Get chunks in a radius
   */
  getChunksInRadius: (center: ChunkCoord, radius: number): ChunkCoord[] => {
    const chunks: ChunkCoord[] = []
    
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      for (let z = center.z - radius; z <= center.z + radius; z++) {
        const coord = { x, z }
        if (ChunkCoordUtils.distance(center, coord) <= radius) {
          chunks.push(coord)
        }
      }
    }
    
    return chunks.sort((a, b) => 
      ChunkCoordUtils.distance(center, a) - ChunkCoordUtils.distance(center, b)
    )
  },

  /**
   * Check if chunks are adjacent
   */
  areAdjacent: (a: ChunkCoord, b: ChunkCoord): boolean => {
    const dx = Math.abs(a.x - b.x)
    const dz = Math.abs(a.z - b.z)
    return (dx === 1 && dz === 0) || (dx === 0 && dz === 1)
  },
}

/**
 * Advanced chunk loading processor
 */
class ChunkLoadingProcessor {
  private loadingChunks = new Map<string, ChunkLoadRequest>()
  private unloadingChunks = new Map<string, ChunkUnloadRequest>()
  private chunkCache = new Map<string, ChunkCacheEntry>()
  private loadQueue: ChunkLoadRequest[] = []
  private unloadQueue: ChunkUnloadRequest[] = []
  private activeFibers = new Map<string, Fiber.RuntimeFiber<void, Error>>()

  constructor(private config: ChunkLoadingConfig) {}

  /**
   * Process chunk loading for a frame
   */
  async processChunkLoading(
    playerPosition: Position,
    playerVelocity: Option.Option<VelocityComponent>,
    loadedChunks: Map<string, EntityId>,
    frameId: number
  ): Promise<{
    loadRequests: ChunkLoadRequest[]
    unloadRequests: ChunkUnloadRequest[]
    cacheOperations: ('evict' | 'store')[]
  }> {
    const playerChunk = ChunkCoordUtils.fromPosition(playerPosition)
    
    // Predict player movement if enabled
    const prediction = this.config.enablePredictiveLoading && Option.isSome(playerVelocity)
      ? this.predictMovement(playerPosition, playerVelocity.value)
      : null

    // Determine required chunks
    const requiredChunks = this.getRequiredChunks(playerChunk, prediction)
    
    // Calculate chunks to load and unload
    const { toLoad, toUnload } = this.calculateChunkUpdates(
      requiredChunks,
      loadedChunks,
      playerChunk
    )

    // Prioritize and queue loading requests
    const loadRequests = this.createLoadRequests(toLoad, playerChunk, prediction)
    
    // Create unload requests
    const unloadRequests = this.createUnloadRequests(toUnload, playerChunk)

    // Manage cache
    const cacheOperations = this.manageCacheOperations()

    // Update internal state
    this.updateProcessorState(loadRequests, unloadRequests)

    return {
      loadRequests,
      unloadRequests,
      cacheOperations,
    }
  }

  /**
   * Predict player movement
   */
  private predictMovement(position: Position, velocity: VelocityComponent): MovementPrediction {
    const speed = Math.sqrt(velocity.dx * velocity.dx + velocity.dz * velocity.dz)
    const predictionTime = 2.0 // Predict 2 seconds ahead
    
    const predictedPosition: Position = {
      x: position.x + velocity.dx * predictionTime,
      y: position.y,
      z: position.z + velocity.dz * predictionTime,
    }

    const movementDirection = speed > 0 ? {
      x: velocity.dx / speed,
      z: velocity.dz / speed,
    } : { x: 0, z: 0 }

    return {
      currentPosition: position,
      velocity,
      predictedPosition,
      movementDirection,
      speed,
    }
  }

  /**
   * Get all chunks that should be loaded
   */
  private getRequiredChunks(
    playerChunk: ChunkCoord, 
    prediction: MovementPrediction | null
  ): Map<string, { coord: ChunkCoord, priority: ChunkPriority, lodLevel: number, predictive: boolean }> {
    const required = new Map<string, { coord: ChunkCoord, priority: ChunkPriority, lodLevel: number, predictive: boolean }>()

    // Current view distance chunks
    const viewChunks = ChunkCoordUtils.getChunksInRadius(playerChunk, this.config.renderDistance)
    
    for (const coord of viewChunks) {
      const distance = ChunkCoordUtils.distance(playerChunk, coord)
      const priority = this.calculatePriority(distance)
      const lodLevel = this.calculateLODLevel(distance)
      
      required.set(ChunkCoordUtils.toKey(coord), {
        coord,
        priority,
        lodLevel,
        predictive: false,
      })
    }

    // Predictive loading
    if (this.config.enablePredictiveLoading && prediction && prediction.speed > 0.1) {
      const predictedChunk = ChunkCoordUtils.fromPosition(prediction.predictedPosition)
      const predictiveChunks = ChunkCoordUtils.getChunksInRadius(
        predictedChunk, 
        Math.min(this.config.preloadDistance, this.config.renderDistance)
      )

      for (const coord of predictiveChunks) {
        const key = ChunkCoordUtils.toKey(coord)
        if (!required.has(key)) {
          const distance = ChunkCoordUtils.distance(playerChunk, coord)
          required.set(key, {
            coord,
            priority: 'background',
            lodLevel: this.calculateLODLevel(distance + 2), // Lower quality for predictive
            predictive: true,
          })
        }
      }
    }

    return required
  }

  /**
   * Calculate what chunks need to be loaded/unloaded
   */
  private calculateChunkUpdates(
    requiredChunks: Map<string, { coord: ChunkCoord, priority: ChunkPriority, lodLevel: number, predictive: boolean }>,
    loadedChunks: Map<string, EntityId>,
    playerChunk: ChunkCoord
  ): { toLoad: { coord: ChunkCoord, priority: ChunkPriority, lodLevel: number, predictive: boolean }[], toUnload: { entityId: EntityId, coord: ChunkCoord }[] } {
    const toLoad: { coord: ChunkCoord, priority: ChunkPriority, lodLevel: number, predictive: boolean }[] = []
    const toUnload: { entityId: EntityId, coord: ChunkCoord }[] = []

    // Find chunks to load
    for (const [key, chunkInfo] of requiredChunks) {
      if (!loadedChunks.has(key) && !this.loadingChunks.has(key)) {
        toLoad.push(chunkInfo)
      }
    }

    // Find chunks to unload
    for (const [key, entityId] of loadedChunks) {
      if (!requiredChunks.has(key)) {
        const coord = ChunkCoordUtils.fromKey(key)
        if (Option.isSome(coord)) {
          const distance = ChunkCoordUtils.distance(playerChunk, coord.value)
          if (distance > this.config.unloadDistance) {
            toUnload.push({ entityId, coord: coord.value })
          }
        }
      }
    }

    return { toLoad, toUnload }
  }

  /**
   * Create load requests with priorities
   */
  private createLoadRequests(
    toLoad: { coord: ChunkCoord, priority: ChunkPriority, lodLevel: number, predictive: boolean }[],
    playerChunk: ChunkCoord,
    prediction: MovementPrediction | null
  ): ChunkLoadRequest[] {
    const requests: ChunkLoadRequest[] = toLoad.map(chunk => ({
      coord: chunk.coord,
      priority: chunk.priority,
      lodLevel: chunk.lodLevel,
      requestTime: Date.now(),
      predictive: chunk.predictive,
    }))

    // Sort by priority and distance
    return requests.sort((a, b) => {
      const priorityOrder = { immediate: 0, high: 1, normal: 2, low: 3, background: 4 }
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      
      if (priorityDiff !== 0) return priorityDiff
      
      // Then by distance
      const distA = ChunkCoordUtils.distance(playerChunk, a.coord)
      const distB = ChunkCoordUtils.distance(playerChunk, b.coord)
      
      return distA - distB
    })
  }

  /**
   * Create unload requests
   */
  private createUnloadRequests(
    toUnload: { entityId: EntityId, coord: ChunkCoord }[],
    playerChunk: ChunkCoord
  ): ChunkUnloadRequest[] {
    return toUnload.map(chunk => ({
      entityId: chunk.entityId,
      coord: chunk.coord,
      distance: ChunkCoordUtils.distance(playerChunk, chunk.coord),
      lastAccessed: Date.now(), // Would be tracked from actual usage
    })).sort((a, b) => b.distance - a.distance) // Unload farthest first
  }

  /**
   * Calculate chunk loading priority
   */
  private calculatePriority(distance: number): ChunkPriority {
    if (distance <= 1) return 'immediate'
    if (distance <= 3) return 'high'
    if (distance <= 6) return 'normal'
    if (distance <= 10) return 'low'
    return 'background'
  }

  /**
   * Calculate LOD level based on distance
   */
  private calculateLODLevel(distance: number): number {
    if (!this.config.enableLOD) return 0
    
    for (let i = 0; i < this.config.lodLevels.length; i++) {
      if (distance <= this.config.lodLevels[i]!) {
        return i
      }
    }
    
    return this.config.lodLevels.length - 1
  }

  /**
   * Manage cache operations
   */
  private manageCacheOperations(): ('evict' | 'store')[] {
    const operations: ('evict' | 'store')[] = []
    
    // Evict old cache entries if over limit
    if (this.chunkCache.size > this.config.chunkCacheSize) {
      const sortedEntries = Array.from(this.chunkCache.entries())
        .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
      
      const toEvict = sortedEntries.slice(0, this.chunkCache.size - this.config.chunkCacheSize)
      
      for (const [key] of toEvict) {
        this.chunkCache.delete(key)
        operations.push('evict')
      }
    }
    
    return operations
  }

  /**
   * Update internal processor state
   */
  private updateProcessorState(
    loadRequests: ChunkLoadRequest[],
    unloadRequests: ChunkUnloadRequest[]
  ): void {
    // Track loading chunks
    for (const request of loadRequests) {
      const key = ChunkCoordUtils.toKey(request.coord)
      this.loadingChunks.set(key, request)
    }

    // Track unloading chunks
    for (const request of unloadRequests) {
      const key = ChunkCoordUtils.toKey(request.coord)
      this.unloadingChunks.set(key, request)
    }
  }

  /**
   * Mark chunk as loaded
   */
  markChunkLoaded(coord: ChunkCoord): void {
    const key = ChunkCoordUtils.toKey(coord)
    this.loadingChunks.delete(key)
  }

  /**
   * Mark chunk as unloaded
   */
  markChunkUnloaded(coord: ChunkCoord): void {
    const key = ChunkCoordUtils.toKey(coord)
    this.unloadingChunks.delete(key)
  }

  /**
   * Get loading statistics
   */
  getStats(): {
    loadingCount: number
    unloadingCount: number
    cacheSize: number
    queueSizes: { load: number, unload: number }
  } {
    return {
      loadingCount: this.loadingChunks.size,
      unloadingCount: this.unloadingChunks.size,
      cacheSize: this.chunkCache.size,
      queueSizes: {
        load: this.loadQueue.length,
        unload: this.unloadQueue.length,
      },
    }
  }
}

/**
 * Create optimized chunk loading system
 */
export const createChunkLoadingSystem = (
  config: Partial<ChunkLoadingConfig> = {}
): SystemFunction => {
  const chunkConfig = { ...defaultChunkLoadingConfig, ...config }
  const processor = new ChunkLoadingProcessor(chunkConfig)

  return (context: SystemContext) => Effect.gen(function* ($) {
    const world = yield* $(World)
    const worker = yield* $(ComputationWorker)
    
    const startTime = Date.now()

    // Get player position and velocity
    const playerQuery = createArchetypeQuery()
      .with('player', 'position')
      .maybe('velocity')
      .execute()

    if (playerQuery.entities.length === 0) {
      return // No player, skip chunk loading
    }

    const playerId = playerQuery.entities[0]!
    const playerPosition = playerQuery.getComponent<Position>(playerId, 'position')
    const playerVelocity = playerQuery.getComponent<VelocityComponent>(playerId, 'velocity')

    if (playerPosition._tag !== 'Some') {
      return // No valid player position
    }

    // Get currently loaded chunks
    const chunkQuery = createArchetypeQuery()
      .with('chunk')
      .execute()

    const loadedChunks = new Map<string, EntityId>()
    for (const entityId of chunkQuery.entities) {
      const chunk = chunkQuery.getComponent<ChunkComponent>(entityId, 'chunk')
      if (chunk._tag === 'Some') {
        const coord = { x: (chunk as any).value.x, z: (chunk as any).value.z }
        loadedChunks.set(ChunkCoordUtils.toKey(coord), entityId)
      }
    }

    // Process chunk loading
    const result = yield* $(
      Effect.promise(() => 
        processor.processChunkLoading(
          (playerPosition as any).value,
          playerVelocity,
          loadedChunks,
          context.frameId
        )
      )
    )

    // Execute load requests
    yield* $(
      Effect.forEach(
        result.loadRequests.slice(0, chunkConfig.maxConcurrentLoads),
        (request) => Effect.gen(function* ($) {
          yield* $(worker.postTask({
            type: 'generateChunk',
            chunkX: request.coord.x,
            chunkZ: request.coord.z,
            priority: request.priority,
            lodLevel: request.lodLevel,
          }))
          
          processor.markChunkLoaded(request.coord)
        }),
        { concurrency: chunkConfig.maxConcurrentLoads, discard: true }
      )
    )

    // Execute unload requests
    yield* $(
      Effect.forEach(
        result.unloadRequests.slice(0, chunkConfig.maxConcurrentUnloads),
        (request) => Effect.gen(function* ($) {
          yield* $(world.removeEntity(request.entityId))
          processor.markChunkUnloaded(request.coord)
        }),
        { concurrency: chunkConfig.maxConcurrentUnloads, discard: true }
      )
    )

    // Performance tracking
    const endTime = Date.now()
    const executionTime = endTime - startTime
    trackPerformance('chunk-loading', 'write', executionTime)

    // Debug logging
    if (context.frameId % 60 === 0) {
      const stats = processor.getStats()
      console.debug(`Chunk Loading - Loading: ${stats.loadingCount}, Unloading: ${stats.unloadingCount}, Cache: ${stats.cacheSize}, Time: ${executionTime}ms`)
    }
  })
}

/**
 * System configuration for chunk loading
 */
export const chunkLoadingSystemConfig: SystemConfig = {
  id: 'chunk-loading',
  name: 'Chunk Loading System',
  priority: 'high',
  phase: 'update',
  dependencies: ['input', 'physics'],
  conflicts: [],
  maxExecutionTime: Duration.millis(12), // Allow more time for world operations
  enableProfiling: true,
}

/**
 * Default chunk loading system instance
 */
export const chunkLoadingSystem = createChunkLoadingSystem()

/**
 * Chunk loading system variants
 */
export const chunkLoadingSystemVariants = {
  /**
   * Performance optimized for lower-end systems
   */
  performance: createChunkLoadingSystem({
    renderDistance: 6,
    preloadDistance: 8,
    maxConcurrentLoads: 4,
    enablePredictiveLoading: false,
    enableLOD: true,
  }),

  /**
   * Quality optimized for higher-end systems
   */
  quality: createChunkLoadingSystem({
    renderDistance: 16,
    preloadDistance: 20,
    maxConcurrentLoads: 12,
    enablePredictiveLoading: true,
    enableLOD: true,
    lodLevels: [8, 16, 32, 64],
  }),

  /**
   * Debug variant with extended visibility
   */
  debug: createChunkLoadingSystem({
    renderDistance: 32,
    preloadDistance: 40,
    unloadDistance: 50,
    enablePredictiveLoading: false,
    enableLOD: false,
  }),
}

/**
 * Chunk loading utilities
 */
export const ChunkLoadingUtils = {
  /**
   * Create system optimized for render distance
   */
  withRenderDistance: (distance: number) => createChunkLoadingSystem({
    renderDistance: distance,
    preloadDistance: distance + 2,
    unloadDistance: distance + 4,
  }),

  /**
   * Create system with performance profile
   */
  withProfile: (profile: 'low' | 'medium' | 'high' | 'ultra') => {
    const profiles = {
      low: { renderDistance: 4, maxConcurrentLoads: 2, enablePredictiveLoading: false },
      medium: { renderDistance: 8, maxConcurrentLoads: 4, enablePredictiveLoading: true },
      high: { renderDistance: 12, maxConcurrentLoads: 6, enablePredictiveLoading: true },
      ultra: { renderDistance: 16, maxConcurrentLoads: 8, enablePredictiveLoading: true },
    }
    
    return createChunkLoadingSystem(profiles[profile])
  },

  /**
   * Estimate memory usage for configuration
   */
  estimateMemoryUsage: (config: ChunkLoadingConfig): number => {
    const chunkCount = Math.PI * config.renderDistance * config.renderDistance
    const bytesPerChunk = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT * 4 // 4 bytes per block
    return chunkCount * bytesPerChunk + config.chunkCacheSize * bytesPerChunk * 0.5
  },
}