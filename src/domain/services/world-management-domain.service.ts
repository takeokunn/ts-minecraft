/**
 * World Management Domain Service
 * 
 * Contains the pure business logic for world management operations,
 * including chunk management, world state coordination, and
 * high-level world operations that orchestrate other domain services.
 */

import { Effect, Context, Layer, HashMap, HashSet } from 'effect'
import { WorldDomainService } from './world-domain.service'
import { 
  TerrainGeneratorPort, 
  type ITerrainGenerator, 
  type TerrainGenerationRequest,
  type ChunkCoordinates,
  TerrainGeneratorHelpers
} from '../ports/terrain-generator.port'
import {
  MeshGeneratorPort,
  type IMeshGenerator,
  type MeshGenerationRequest,
  type ChunkData,
  MeshGeneratorHelpers
} from '../ports/mesh-generator.port'
import { WorldRepository } from '../ports/world.repository'
import { CHUNK_SIZE } from '../constants/world-constants'
import { EntityId } from '../entities'

/**
 * Chunk loading status
 */
export type ChunkLoadingStatus = 'unloaded' | 'loading' | 'generating' | 'meshing' | 'loaded' | 'error'

/**
 * Chunk metadata for management
 */
export interface ChunkMetadata {
  readonly coordinates: ChunkCoordinates
  readonly status: ChunkLoadingStatus
  readonly loadTime?: number
  readonly lastAccessed: number
  readonly priority: number
  readonly neighbors: readonly ChunkCoordinates[]
  readonly entityCount: number
  readonly blockCount: number
}

/**
 * World management configuration
 */
export interface WorldManagementConfig {
  readonly maxLoadedChunks: number
  readonly chunkLoadDistance: number
  readonly chunkUnloadDistance: number
  readonly maxConcurrentGenerations: number
  readonly preloadRadius: number
  readonly worldSeed: number
}

/**
 * World management statistics
 */
export interface WorldManagementStats {
  readonly totalChunks: number
  readonly loadedChunks: number
  readonly generatingChunks: number
  readonly meshingChunks: number
  readonly totalEntities: number
  readonly memoryUsage: number
  readonly averageLoadTime: number
}

/**
 * Chunk loading result
 */
export interface ChunkLoadResult {
  readonly coordinates: ChunkCoordinates
  readonly success: boolean
  readonly loadTime: number
  readonly blockCount: number
  readonly entityCount: number
  readonly error?: string
}

/**
 * World Management Domain Service Interface
 */
export interface IWorldManagementDomainService {
  /**
   * Load a chunk with terrain generation and mesh creation
   */
  readonly loadChunk: (coordinates: ChunkCoordinates, priority?: number) => Effect.Effect<ChunkLoadResult, never, never>
  
  /**
   * Unload a chunk and free its resources
   */
  readonly unloadChunk: (coordinates: ChunkCoordinates) => Effect.Effect<boolean, never, never>
  
  /**
   * Get chunk metadata
   */
  readonly getChunkMetadata: (coordinates: ChunkCoordinates) => Effect.Effect<ChunkMetadata | null, never, never>
  
  /**
   * Get all loaded chunks
   */
  readonly getLoadedChunks: () => Effect.Effect<readonly ChunkMetadata[], never, never>
  
  /**
   * Update player position and manage chunk loading/unloading
   */
  readonly updatePlayerPosition: (playerEntityId: EntityId, chunkCoordinates: ChunkCoordinates) => Effect.Effect<void, never, never>
  
  /**
   * Get world management statistics
   */
  readonly getStats: () => Effect.Effect<WorldManagementStats, never, never>
  
  /**
   * Cleanup unused chunks based on distance and usage
   */
  readonly cleanupUnusedChunks: () => Effect.Effect<number, never, never>
}

/**
 * World Management Domain Service Implementation
 */
export class WorldManagementDomainService implements IWorldManagementDomainService {
  private chunkMetadata: HashMap.HashMap<string, ChunkMetadata>
  private currentGenerations: HashSet.HashSet<string>
  private config: WorldManagementConfig

  constructor(config?: Partial<WorldManagementConfig>) {
    this.chunkMetadata = HashMap.empty()
    this.currentGenerations = HashSet.empty()
    this.config = {
      maxLoadedChunks: 100,
      chunkLoadDistance: 8,
      chunkUnloadDistance: 12,
      maxConcurrentGenerations: 4,
      preloadRadius: 3,
      worldSeed: 12345,
      ...config,
    }
  }

  loadChunk = (coordinates: ChunkCoordinates, priority: number = 1): Effect.Effect<ChunkLoadResult, never, never> =>
    Effect.gen((_) => {
      const startTime = performance.now()
      const chunkKey = this.getChunkKey(coordinates)

      // Check if chunk is already loaded or loading
      const existingMetadata = yield* this.getChunkMetadata(coordinates)
      if (existingMetadata && (existingMetadata.status === 'loaded' || existingMetadata.status === 'loading')) {
        return {
          coordinates,
          success: true,
          loadTime: 0,
          blockCount: existingMetadata.blockCount,
          entityCount: existingMetadata.entityCount,
        }
      }

      // Check concurrent generation limit
      if (HashSet.size(this.currentGenerations) >= this.config.maxConcurrentGenerations) {
        return {
          coordinates,
          success: false,
          loadTime: 0,
          blockCount: 0,
          entityCount: 0,
          error: 'Too many concurrent generations',
        }
      }

      try {
        // Mark as loading
        yield* this.updateChunkStatus(coordinates, 'loading')
        this.currentGenerations = HashSet.add(this.currentGenerations, chunkKey)

        // Generate terrain
        const terrainGenerator = yield* _(TerrainGeneratorPort)
        const terrainRequest = this.createTerrainRequest(coordinates)
        
        yield* this.updateChunkStatus(coordinates, 'generating')
        const terrainResult = yield* _(terrainGenerator.generateTerrain(terrainRequest))

        // Generate mesh
        const meshGenerator = yield* _(MeshGeneratorPort)
        const chunkData: ChunkData = {
          coordinates: terrainResult.coordinates,
          blocks: terrainResult.blocks,
          heightMap: terrainResult.heightMap,
          biomeMap: terrainResult.biomeMap,
        }

        const meshRequest = MeshGeneratorHelpers.createDefaultRequest(chunkData)
        
        yield* this.updateChunkStatus(coordinates, 'meshing')
        const meshResult = yield* _(meshGenerator.generateMesh(meshRequest))

        // Store chunk data in world repository
        const world = yield* _(WorldRepository)
        // In a real implementation, we would store the chunk data
        // yield* _(world.storeChunkData(chunkData, meshResult))

        // Update metadata
        const loadTime = performance.now() - startTime
        const metadata: ChunkMetadata = {
          coordinates,
          status: 'loaded',
          loadTime,
          lastAccessed: Date.now(),
          priority,
          neighbors: this.getNeighborCoordinates(coordinates),
          entityCount: 0, // Would be calculated from actual entities
          blockCount: terrainResult.blocks.length,
        }

        this.chunkMetadata = HashMap.set(this.chunkMetadata, chunkKey, metadata)
        this.currentGenerations = HashSet.remove(this.currentGenerations, chunkKey)

        return {
          coordinates,
          success: true,
          loadTime,
          blockCount: terrainResult.blocks.length,
          entityCount: 0,
        }
      } catch (error) {
        // Handle generation error
        yield* this.updateChunkStatus(coordinates, 'error')
        this.currentGenerations = HashSet.remove(this.currentGenerations, chunkKey)

        return {
          coordinates,
          success: false,
          loadTime: performance.now() - startTime,
          blockCount: 0,
          entityCount: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    })

  unloadChunk = (coordinates: ChunkCoordinates): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* (_) {
      const chunkKey = this.getChunkKey(coordinates)
      const metadata = HashMap.get(this.chunkMetadata, chunkKey)

      if (!metadata) {
        return false
      }

      // In a real implementation, we would:
      // - Save chunk data if modified
      // - Remove from world repository
      // - Free mesh data
      // - Update entity references

      this.chunkMetadata = HashMap.remove(this.chunkMetadata, chunkKey)
      return true
    })

  getChunkMetadata = (coordinates: ChunkCoordinates): Effect.Effect<ChunkMetadata | null, never, never> =>
    Effect.gen(function* (_) {
      const chunkKey = this.getChunkKey(coordinates)
      const metadata = HashMap.get(this.chunkMetadata, chunkKey)
      return metadata || null
    })

  getLoadedChunks = (): Effect.Effect<readonly ChunkMetadata[], never, never> =>
    Effect.gen(function* (_) {
      return HashMap.values(this.chunkMetadata).filter(chunk => chunk.status === 'loaded')
    })

  updatePlayerPosition = (playerEntityId: EntityId, chunkCoordinates: ChunkCoordinates): Effect.Effect<void, never, never> =>
    Effect.gen((_) => {
      // Calculate chunks that should be loaded based on player position
      const chunksToLoad = this.getChunksInRadius(chunkCoordinates, this.config.chunkLoadDistance)
      const chunksToUnload = this.getChunksOutsideRadius(chunkCoordinates, this.config.chunkUnloadDistance)

      // Load nearby chunks
      for (const coords of chunksToLoad) {
        const distance = this.calculateChunkDistance(chunkCoordinates, coords)
        const priority = Math.max(1, this.config.chunkLoadDistance - distance + 1)
        
        // Start loading chunk (fire and forget)
        Effect.fork(this.loadChunk(coords, priority))
      }

      // Unload distant chunks
      for (const coords of chunksToUnload) {
        Effect.fork(this.unloadChunk(coords))
      }

      return undefined
    })

  getStats = (): Effect.Effect<WorldManagementStats, never, never> =>
    Effect.gen(function* (_) {
      const chunks = HashMap.values(this.chunkMetadata)
      const loadedChunks = chunks.filter(c => c.status === 'loaded')
      const generatingChunks = chunks.filter(c => c.status === 'generating').length
      const meshingChunks = chunks.filter(c => c.status === 'meshing').length
      
      const totalEntities = chunks.reduce((sum, chunk) => sum + chunk.entityCount, 0)
      const totalBlocks = chunks.reduce((sum, chunk) => sum + chunk.blockCount, 0)
      const averageLoadTime = loadedChunks.reduce((sum, chunk) => sum + (chunk.loadTime || 0), 0) / Math.max(1, loadedChunks.length)

      // Rough memory estimation
      const memoryUsage = totalBlocks * 16 + totalEntities * 64 // Simplified calculation

      return {
        totalChunks: chunks.length,
        loadedChunks: loadedChunks.length,
        generatingChunks,
        meshingChunks,
        totalEntities,
        memoryUsage,
        averageLoadTime,
      }
    })

  cleanupUnusedChunks = (): Effect.Effect<number, never, never> =>
    Effect.gen(function* (_) {
      const now = Date.now()
      const maxAge = 5 * 60 * 1000 // 5 minutes
      let cleanedCount = 0

      const chunks = HashMap.values(this.chunkMetadata)
      for (const chunk of chunks) {
        if (chunk.status === 'loaded' && (now - chunk.lastAccessed) > maxAge) {
          yield* _(this.unloadChunk(chunk.coordinates))
          cleanedCount++
        }
      }

      return cleanedCount
    })

  // Private helper methods
  private getChunkKey = (coordinates: ChunkCoordinates): string => {
    return `${coordinates.x},${coordinates.z}`
  }

  private updateChunkStatus = (coordinates: ChunkCoordinates, status: ChunkLoadingStatus): Effect.Effect<void, never, never> =>
    Effect.gen(function* (_) {
      const chunkKey = this.getChunkKey(coordinates)
      const existing = HashMap.get(this.chunkMetadata, chunkKey)
      
      const updated: ChunkMetadata = existing ? {
        ...existing,
        status,
        lastAccessed: Date.now(),
      } : {
        coordinates,
        status,
        lastAccessed: Date.now(),
        priority: 1,
        neighbors: this.getNeighborCoordinates(coordinates),
        entityCount: 0,
        blockCount: 0,
      }

      this.chunkMetadata = HashMap.set(this.chunkMetadata, chunkKey, updated)
    })

  private createTerrainRequest = (coordinates: ChunkCoordinates): TerrainGenerationRequest => {
    return {
      coordinates,
      seed: this.config.worldSeed,
      biome: TerrainGeneratorHelpers.createDefaultBiome(),
      noise: TerrainGeneratorHelpers.createDefaultNoiseSettings(),
      features: TerrainGeneratorHelpers.createDefaultFeatures(),
    }
  }

  private getNeighborCoordinates = (coordinates: ChunkCoordinates): readonly ChunkCoordinates[] => {
    return [
      { x: coordinates.x - 1, z: coordinates.z },     // West
      { x: coordinates.x + 1, z: coordinates.z },     // East
      { x: coordinates.x, z: coordinates.z - 1 },     // North
      { x: coordinates.x, z: coordinates.z + 1 },     // South
      { x: coordinates.x - 1, z: coordinates.z - 1 }, // Northwest
      { x: coordinates.x + 1, z: coordinates.z - 1 }, // Northeast
      { x: coordinates.x - 1, z: coordinates.z + 1 }, // Southwest
      { x: coordinates.x + 1, z: coordinates.z + 1 }, // Southeast
    ]
  }

  private getChunksInRadius = (center: ChunkCoordinates, radius: number): readonly ChunkCoordinates[] => {
    const chunks: ChunkCoordinates[] = []
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      for (let z = center.z - radius; z <= center.z + radius; z++) {
        const distance = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(z - center.z, 2))
        if (distance <= radius) {
          chunks.push({ x, z })
        }
      }
    }
    return chunks
  }

  private getChunksOutsideRadius = (center: ChunkCoordinates, radius: number): readonly ChunkCoordinates[] => {
    const chunks = HashMap.values(this.chunkMetadata)
    return chunks
      .filter(chunk => {
        const distance = this.calculateChunkDistance(center, chunk.coordinates)
        return distance > radius
      })
      .map(chunk => chunk.coordinates)
  }

  private calculateChunkDistance = (a: ChunkCoordinates, b: ChunkCoordinates): number => {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.z - b.z, 2))
  }
}

/**
 * World Management Domain Service Context Tag
 */
export const WorldManagementDomainServicePort = Context.GenericTag<IWorldManagementDomainService>('WorldManagementDomainServicePort')

/**
 * Live layer for World Management Domain Service
 */
export const WorldManagementDomainServiceLive = Layer.effect(
  WorldManagementDomainServicePort,
  Effect.gen(function* (_) {
    return new WorldManagementDomainService()
  })
)

/**
 * Utility functions for world management
 */
export const WorldManagementUtils = {
  /**
   * Create default world management configuration
   */
  createDefaultConfig: (): WorldManagementConfig => ({
    maxLoadedChunks: 100,
    chunkLoadDistance: 8,
    chunkUnloadDistance: 12,
    maxConcurrentGenerations: 4,
    preloadRadius: 3,
    worldSeed: Math.floor(Math.random() * 1000000),
  }),

  /**
   * Calculate memory usage for chunk metadata
   */
  calculateMetadataMemory: (chunks: readonly ChunkMetadata[]): number => {
    return chunks.length * 200 // Approximate bytes per chunk metadata
  },

  /**
   * Get chunk priority based on distance from player
   */
  calculateChunkPriority: (playerChunk: ChunkCoordinates, targetChunk: ChunkCoordinates, maxDistance: number): number => {
    const distance = Math.sqrt(
      Math.pow(playerChunk.x - targetChunk.x, 2) + 
      Math.pow(playerChunk.z - targetChunk.z, 2)
    )
    return Math.max(1, maxDistance - Math.floor(distance) + 1)
  },
}