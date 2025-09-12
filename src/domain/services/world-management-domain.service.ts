/**
 * World Management Domain Service
 *
 * Contains the pure business logic for world management operations,
 * including chunk management, world state coordination, and
 * high-level world operations that orchestrate other domain services.
 */

import { Effect, Context, Layer, HashMap, HashSet, Data, Ref } from 'effect'
import { WorldDomainService } from '@domain/services/world-domain.service'
import { TerrainGeneratorPort, type ITerrainGenerator, type TerrainGenerationRequest, type ChunkCoordinates, TerrainGeneratorHelpers } from '@domain/ports/terrain-generator.port'
import { MeshGeneratorPort, type IMeshGenerator, type MeshGenerationRequest, type ChunkData, MeshGeneratorHelpers } from '@domain/ports/mesh-generator.port'
import { WorldRepositoryPort } from '@domain/ports/world-repository.port'
import { CHUNK_SIZE } from '@shared/constants/world'
import { EntityId } from '@domain/entities'

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
  readonly loadChunk: (coordinates: ChunkCoordinates, priority?: number) => Effect.Effect<ChunkLoadResult, ChunkLoadFailedError | ChunkGenerationLimitExceededError>

  /**
   * Unload a chunk and free its resources
   */
  readonly unloadChunk: (coordinates: ChunkCoordinates) => Effect.Effect<boolean>

  /**
   * Get chunk metadata
   */
  readonly getChunkMetadata: (coordinates: ChunkCoordinates) => Effect.Effect<ChunkMetadata | null>

  /**
   * Get all loaded chunks
   */
  readonly getLoadedChunks: () => Effect.Effect<readonly ChunkMetadata[]>

  /**
   * Update player position and manage chunk loading/unloading
   */
  readonly updatePlayerPosition: (playerEntityId: EntityId, chunkCoordinates: ChunkCoordinates) => Effect.Effect<void>

  /**
   * Get world management statistics
   */
  readonly getStats: () => Effect.Effect<WorldManagementStats>

  /**
   * Cleanup unused chunks based on distance and usage
   */
  readonly cleanupUnusedChunks: () => Effect.Effect<number>
}

/**
 * World Management Domain Service Errors
 */
export class ChunkGenerationLimitExceededError extends Data.TaggedError('ChunkGenerationLimitExceededError')<{
  readonly limit: number
  readonly current: number
}> {}

export class ChunkLoadFailedError extends Data.TaggedError('ChunkLoadFailedError')<{
  readonly coordinates: ChunkCoordinates
  readonly reason: string
}> {}

export class WorldManagementConfigError extends Data.TaggedError('WorldManagementConfigError')<{
  readonly invalidFields: readonly string[]
}> {}

// Helper functions
const getChunkKey = (coordinates: ChunkCoordinates): string => `${coordinates.x},${coordinates.z}`

const getNeighborCoordinates = (coordinates: ChunkCoordinates): readonly ChunkCoordinates[] => [
  { x: coordinates.x - 1, z: coordinates.z }, // West
  { x: coordinates.x + 1, z: coordinates.z }, // East
  { x: coordinates.x, z: coordinates.z - 1 }, // North
  { x: coordinates.x, z: coordinates.z + 1 }, // South
  { x: coordinates.x - 1, z: coordinates.z - 1 }, // Northwest
  { x: coordinates.x + 1, z: coordinates.z - 1 }, // Northeast
  { x: coordinates.x - 1, z: coordinates.z + 1 }, // Southwest
  { x: coordinates.x + 1, z: coordinates.z + 1 }, // Southeast
]

const createTerrainRequest = (coordinates: ChunkCoordinates, worldSeed: number): TerrainGenerationRequest => ({
  coordinates,
  seed: worldSeed,
  biome: TerrainGeneratorHelpers.createDefaultBiome(),
  noise: TerrainGeneratorHelpers.createDefaultNoiseSettings(),
  features: TerrainGeneratorHelpers.createDefaultFeatures(),
})

const getChunksInRadius = (center: ChunkCoordinates, radius: number): readonly ChunkCoordinates[] => {
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

const calculateChunkDistance = (a: ChunkCoordinates, b: ChunkCoordinates): number => Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.z - b.z, 2))

/**
 * World Management Domain Service Context Tag
 */
export const WorldManagementDomainService = Context.GenericTag<IWorldManagementDomainService>('WorldManagementDomainService')

/**
 * World Management Domain Service Live Implementation
 */
export const WorldManagementDomainServiceLive = Layer.effect(
  WorldManagementDomainService,
  Effect.gen(function* () {
    // Configuration
    const config: WorldManagementConfig = {
      maxLoadedChunks: 100,
      chunkLoadDistance: 8,
      chunkUnloadDistance: 12,
      maxConcurrentGenerations: 4,
      preloadRadius: 3,
      worldSeed: 12345,
    }

    // State management with Effect Refs
    const chunkMetadata = yield* Ref.make(HashMap.empty<string, ChunkMetadata>())
    const currentGenerations = yield* Ref.make(0)

    // Helper function for updating chunk status
    const updateChunkStatus = (coordinates: ChunkCoordinates, status: ChunkLoadingStatus): Effect.Effect<void> =>
      Effect.gen(function* () {
        const chunkKey = getChunkKey(coordinates)
        const metadata = yield* Ref.get(chunkMetadata)
        const existing = HashMap.get(metadata, chunkKey)

        const updated: ChunkMetadata = existing
          ? {
              ...existing,
              status,
              lastAccessed: Date.now(),
            }
          : {
              coordinates,
              status,
              lastAccessed: Date.now(),
              priority: 1,
              neighbors: getNeighborCoordinates(coordinates),
              entityCount: 0,
              blockCount: 0,
            }

        yield* Ref.update(chunkMetadata, HashMap.set(chunkKey, updated))
      })

    const getChunksOutsideRadius = (center: ChunkCoordinates, radius: number): Effect.Effect<readonly ChunkCoordinates[]> =>
      Effect.gen(function* () {
        const metadata = yield* Ref.get(chunkMetadata)
        const chunks = HashMap.values(metadata)
        return chunks
          .filter((chunk) => {
            const distance = calculateChunkDistance(center, chunk.coordinates)
            return distance > radius
          })
          .map((chunk) => chunk.coordinates)
      })

    // Service implementation
    const loadChunk = (coordinates: ChunkCoordinates, priority: number = 1): Effect.Effect<ChunkLoadResult, ChunkLoadFailedError | ChunkGenerationLimitExceededError> =>
      Effect.gen(function* () {
        const startTime = performance.now()
        const chunkKey = getChunkKey(coordinates)

        // Check if chunk is already loaded or loading
        const metadata = yield* Ref.get(chunkMetadata)
        const existingMetadata = HashMap.get(metadata, chunkKey)
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
        const generations = yield* Ref.get(currentGenerations)
        if (generations >= config.maxConcurrentGenerations) {
          return yield* Effect.fail(
            new ChunkGenerationLimitExceededError({
              limit: config.maxConcurrentGenerations,
              current: generations,
            }),
          )
        }

        // Mark as loading
        yield* updateChunkStatus(coordinates, 'loading')
        yield* Ref.update(currentGenerations, (n) => n + 1)

        try {
          // Generate terrain
          const terrainGenerator = yield* TerrainGeneratorPort
          const terrainRequest = createTerrainRequest(coordinates, config.worldSeed)

          yield* updateChunkStatus(coordinates, 'generating')
          const terrainResult = yield* terrainGenerator.generateTerrain(terrainRequest)

          // Generate mesh
          const meshGenerator = yield* MeshGeneratorPort
          const chunkData: ChunkData = {
            coordinates: terrainResult.coordinates,
            blocks: terrainResult.blocks,
            heightMap: terrainResult.heightMap,
            biomeMap: terrainResult.biomeMap,
          }

          const meshRequest = MeshGeneratorHelpers.createDefaultRequest(chunkData)

          yield* updateChunkStatus(coordinates, 'meshing')
          const meshResult = yield* meshGenerator.generateMesh(meshRequest)

          // Store chunk data in world repository
          const worldRepo = yield* WorldRepositoryPort
          yield* worldRepo.addChunk(coordinates, chunkData)

          // Update metadata
          const loadTime = performance.now() - startTime
          const newMetadata: ChunkMetadata = {
            coordinates,
            status: 'loaded',
            loadTime,
            lastAccessed: Date.now(),
            priority,
            neighbors: getNeighborCoordinates(coordinates),
            entityCount: 0,
            blockCount: terrainResult.blocks.length,
          }

          yield* Ref.update(chunkMetadata, HashMap.set(chunkKey, newMetadata))
          yield* Ref.update(currentGenerations, (n) => n - 1)

          return {
            coordinates,
            success: true,
            loadTime,
            blockCount: terrainResult.blocks.length,
            entityCount: 0,
          }
        } catch (error) {
          yield* updateChunkStatus(coordinates, 'error')
          yield* Ref.update(currentGenerations, (n) => n - 1)

          return yield* Effect.fail(
            new ChunkLoadFailedError({
              coordinates,
              reason: error instanceof Error ? error.message : 'Unknown error',
            }),
          )
        }
      })

    const unloadChunk = (coordinates: ChunkCoordinates): Effect.Effect<boolean> =>
      Effect.gen(function* () {
        const chunkKey = getChunkKey(coordinates)
        const metadata = yield* Ref.get(chunkMetadata)
        const chunkMeta = HashMap.get(metadata, chunkKey)

        if (!chunkMeta) {
          return false
        }

        // Remove from world repository
        const worldRepo = yield* WorldRepositoryPort
        yield* worldRepo.removeChunk(coordinates)

        yield* Ref.update(chunkMetadata, HashMap.remove(chunkKey))
        return true
      })

    const getChunkMetadata = (coordinates: ChunkCoordinates): Effect.Effect<ChunkMetadata | null> =>
      Effect.gen(function* () {
        const metadata = yield* Ref.get(chunkMetadata)
        const chunkKey = getChunkKey(coordinates)
        const chunkMeta = HashMap.get(metadata, chunkKey)
        return chunkMeta || null
      })

    const getLoadedChunks = (): Effect.Effect<readonly ChunkMetadata[]> =>
      Effect.gen(function* () {
        const metadata = yield* Ref.get(chunkMetadata)
        return HashMap.values(metadata).filter((chunk) => chunk.status === 'loaded')
      })

    const updatePlayerPosition = (playerEntityId: EntityId, chunkCoordinates: ChunkCoordinates): Effect.Effect<void> =>
      Effect.gen(function* () {
        // Calculate chunks that should be loaded based on player position
        const chunksToLoad = getChunksInRadius(chunkCoordinates, config.chunkLoadDistance)
        const chunksToUnload = yield* getChunksOutsideRadius(chunkCoordinates, config.chunkUnloadDistance)

        // Load nearby chunks
        for (const coords of chunksToLoad) {
          const distance = calculateChunkDistance(chunkCoordinates, coords)
          const priority = Math.max(1, config.chunkLoadDistance - distance + 1)

          // Start loading chunk (fire and forget)
          yield* Effect.fork(loadChunk(coords, priority))
        }

        // Unload distant chunks
        for (const coords of chunksToUnload) {
          yield* Effect.fork(unloadChunk(coords))
        }
      })

    const getStats = (): Effect.Effect<WorldManagementStats> =>
      Effect.gen(function* () {
        const metadata = yield* Ref.get(chunkMetadata)
        const chunks = HashMap.values(metadata)
        const loadedChunks = chunks.filter((c) => c.status === 'loaded')
        const generatingChunks = chunks.filter((c) => c.status === 'generating').length
        const meshingChunks = chunks.filter((c) => c.status === 'meshing').length

        const totalEntities = chunks.reduce((sum, chunk) => sum + chunk.entityCount, 0)
        const totalBlocks = chunks.reduce((sum, chunk) => sum + chunk.blockCount, 0)
        const averageLoadTime = loadedChunks.reduce((sum, chunk) => sum + (chunk.loadTime || 0), 0) / Math.max(1, loadedChunks.length)

        // Rough memory estimation
        const memoryUsage = totalBlocks * 16 + totalEntities * 64

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

    const cleanupUnusedChunks = (): Effect.Effect<number> =>
      Effect.gen(function* () {
        const now = Date.now()
        const maxAge = 5 * 60 * 1000 // 5 minutes
        let cleanedCount = 0

        const metadata = yield* Ref.get(chunkMetadata)
        const chunks = HashMap.values(metadata)
        for (const chunk of chunks) {
          if (chunk.status === 'loaded' && now - chunk.lastAccessed > maxAge) {
            yield* unloadChunk(chunk.coordinates)
            cleanedCount++
          }
        }

        return cleanedCount
      })

    return {
      loadChunk,
      unloadChunk,
      getChunkMetadata,
      getLoadedChunks,
      updatePlayerPosition,
      getStats,
      cleanupUnusedChunks,
    }
  }),
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
    const distance = Math.sqrt(Math.pow(playerChunk.x - targetChunk.x, 2) + Math.pow(playerChunk.z - targetChunk.z, 2))
    return Math.max(1, maxDistance - Math.floor(distance) + 1)
  },
}
