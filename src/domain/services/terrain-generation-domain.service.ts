/**
 * Terrain Generation Domain Service
 *
 * Contains the pure business logic for terrain generation,
 * extracted from infrastructure layer and made technology-agnostic.
 * This service implements the core terrain generation algorithms
 * without dependencies on specific noise libraries or implementations.
 */

import { Effect, Context, Layer } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@shared/constants/world'
import {
  TerrainGeneratorPort,
  type ITerrainGenerator,
  type ChunkCoordinates,
  type Position3D,
  type BiomeConfig,
  type NoiseSettings,
  type FeatureConfig,
  type GeneratedBlock,
  type TerrainGenerationResult,
  type TerrainGenerationRequest,
  TerrainGeneratorHelpers,
} from '@domain/ports/terrain-generator.port'

/**
 * Simple noise function for terrain generation
 * Pure mathematical function without external dependencies
 */
const simpleNoise = (x: number, y: number, z: number, seed: number): number => {
  const n = Math.sin(x * 0.1 + seed) * Math.cos(y * 0.1 + seed) * Math.sin(z * 0.1 + seed)
  return (n + 1) / 2 // Normalize to 0-1
}

/**
 * Generate height map for a chunk using layered noise
 * Pure domain logic without infrastructure dependencies
 */
const generateHeightMapLogic = (chunkX: number, chunkZ: number, seed: number, noiseSettings: NoiseSettings): readonly number[] => {
  const heightMap: number[] = []
  const chunkSize = CHUNK_SIZE

  for (let z = 0; z < chunkSize; z++) {
    for (let x = 0; x < chunkSize; x++) {
      const worldX = chunkX * chunkSize + x
      const worldZ = chunkZ * chunkSize + z

      let height = 0
      let amplitude = 1
      let frequency = noiseSettings.scale

      // Multi-octave noise generation
      for (let octave = 0; octave < noiseSettings.octaves; octave++) {
        height += simpleNoise(worldX * frequency, 0, worldZ * frequency, seed) * amplitude
        amplitude *= noiseSettings.persistence
        frequency *= noiseSettings.lacunarity
      }

      // Apply height scaling and constraints
      height = Math.floor(height * noiseSettings.heightMultiplier + noiseSettings.baseHeight)
      height = Math.max(1, Math.min(255, height))

      heightMap.push(height)
    }
  }

  return heightMap
}

/**
 * Generate blocks for a chunk based on height map and biome rules
 * Pure business logic for block placement
 */
const generateBlocksLogic = (
  chunkX: number,
  chunkZ: number,
  heightMap: readonly number[],
  biome: BiomeConfig,
  features: FeatureConfig,
  seed: number,
): readonly GeneratedBlock[] => {
  const blocks: GeneratedBlock[] = []
  const chunkSize = CHUNK_SIZE
  const maxHeight = CHUNK_HEIGHT

  for (let y = 0; y < maxHeight; y++) {
    for (let z = 0; z < chunkSize; z++) {
      for (let x = 0; x < chunkSize; x++) {
        const heightIndex = z * chunkSize + x
        const terrainHeight = heightMap[heightIndex]
        const worldX = chunkX * chunkSize + x
        const worldY = y
        const worldZ = chunkZ * chunkSize + z

        const blockType = determineBlockType(worldX, worldY, worldZ, terrainHeight, biome, features, seed)

        if (blockType !== 'air') {
          const position: Position3D = { x: worldX, y: worldY, z: worldZ }
          blocks.push({
            position,
            blockType,
            lightLevel: calculateLightLevel(worldY, terrainHeight),
          })
        }
      }
    }
  }

  return blocks
}

/**
 * Determine block type based on position, height, biome, and features
 * Core business logic for block placement rules
 */
const determineBlockType = (x: number, y: number, z: number, terrainHeight: number, biome: BiomeConfig, features: FeatureConfig, seed: number): string => {
  // Bedrock layer
  if (y === 0) {
    return 'bedrock'
  }

  // Underground stone layer
  if (y <= terrainHeight - 4) {
    let blockType = 'stone'

    // Ore generation logic
    if (features.generateOres) {
      const oreNoise = simpleNoise(x, y, z, seed + 12345)
      const oreThreshold = 1 - features.oreDensity

      if (oreNoise > oreThreshold + 0.05 && y < 64) {
        blockType = 'coal_ore'
      } else if (oreNoise > oreThreshold + 0.08 && y < 32) {
        blockType = 'iron_ore'
      } else if (oreNoise > oreThreshold + 0.095 && y < 16) {
        blockType = 'diamond_ore'
      }
    }

    return blockType
  }

  // Subsurface layer
  if (y <= terrainHeight - 1) {
    return biome.subsurfaceBlock
  }

  // Surface layer
  if (y === terrainHeight) {
    return biome.surfaceBlock
  }

  // Water level for ocean biomes
  if (y <= 62 && biome.type === 'ocean') {
    return 'water'
  }

  return 'air'
}

/**
 * Calculate light level based on position and terrain height
 * Pure function for light calculation
 */
const calculateLightLevel = (y: number, terrainHeight: number): number => {
  if (y > terrainHeight) {
    return 15 // Full sunlight above surface
  }

  const depth = terrainHeight - y
  return Math.max(0, 15 - depth)
}

/**
 * Generate biome map for a chunk
 * Simplified single-biome implementation
 */
const generateBiomeMap = (biome: BiomeConfig): readonly string[] => {
  return new Array(CHUNK_SIZE * CHUNK_SIZE).fill(biome.type)
}

/**
 * Terrain Generation Domain Service Interface
 * Defines the contract for terrain generation operations
 */
export interface TerrainGenerationDomainService extends ITerrainGenerator {}

/**
 * Terrain Generation Domain Service Context Tag
 */
export const TerrainGenerationDomainService = Context.GenericTag<TerrainGenerationDomainService>('TerrainGenerationDomainService')

/**
 * Terrain Generation Domain Service Implementation
 * Pure business logic implementation following Effect-TS patterns
 */
const createTerrainGenerationService = (): TerrainGenerationDomainService => ({
  generateTerrain: (request: TerrainGenerationRequest): Effect.Effect<TerrainGenerationResult, never, never> =>
    Effect.gen(function* () {
      const startTime = performance.now()
      const { coordinates, seed, biome, noise, features } = request

      // Generate height map
      const heightMap = generateHeightMapLogic(coordinates.x, coordinates.z, seed, noise)

      // Generate blocks
      const blocks = generateBlocksLogic(coordinates.x, coordinates.z, heightMap, biome, features, seed)

      // Generate biome map
      const biomeMap = generateBiomeMap(biome)

      const generationTime = performance.now() - startTime

      return {
        coordinates,
        blocks,
        heightMap,
        biomeMap,
        generationTime,
        blockCount: blocks.length,
      } satisfies TerrainGenerationResult
    }),

  generateHeightMap: (coordinates: ChunkCoordinates, seed: number, noise: NoiseSettings): Effect.Effect<readonly number[], never, never> =>
    Effect.gen(function* () {
      return generateHeightMapLogic(coordinates.x, coordinates.z, seed, noise)
    }),

  getBiome: (x: number, z: number, seed: number): Effect.Effect<BiomeConfig, never, never> =>
    Effect.gen(function* () {
      // Simplified biome generation based on noise
      const biomeNoise = simpleNoise(x * 0.001, 0, z * 0.001, seed + 54321)

      if (biomeNoise < 0.2) {
        return TerrainGeneratorHelpers.createDefaultBiome('desert')
      } else if (biomeNoise < 0.4) {
        return TerrainGeneratorHelpers.createDefaultBiome('ocean')
      } else if (biomeNoise < 0.6) {
        return TerrainGeneratorHelpers.createDefaultBiome('forest')
      } else if (biomeNoise < 0.8) {
        return TerrainGeneratorHelpers.createDefaultBiome('mountain')
      } else {
        return TerrainGeneratorHelpers.createDefaultBiome('plains')
      }
    }),

  isAvailable: (): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      return true // Always available as it's pure logic
    }),
})

/**
 * Live layer for Terrain Generation Domain Service
 */
export const TerrainGenerationDomainServiceLive = Layer.effect(
  TerrainGenerationDomainService,
  Effect.gen(function* () {
    return TerrainGenerationDomainService.of(createTerrainGenerationService())
  }),
)

/**
 * Legacy compatibility layer - provides the service via the port pattern
 */
export const TerrainGeneratorPortLive = Layer.effect(
  TerrainGeneratorPort,
  Effect.gen(function* () {
    const service = yield* TerrainGenerationDomainService
    return TerrainGeneratorPort.of(service)
  }),
).pipe(Layer.provide(TerrainGenerationDomainServiceLive))

/**
 * Utility functions for terrain generation
 */
// Re-export types and utilities for use in other modules
export { TerrainGeneratorPort, TerrainGeneratorHelpers } from '@domain/ports/terrain-generator.port'

export const TerrainGenerationUtils = {
  /**
   * Create default terrain generation request
   */
  createDefaultRequest: (coordinates: ChunkCoordinates, seed: number): TerrainGenerationRequest => ({
    coordinates,
    seed,
    biome: TerrainGeneratorHelpers.createDefaultBiome(),
    noise: TerrainGeneratorHelpers.createDefaultNoiseSettings(),
    features: TerrainGeneratorHelpers.createDefaultFeatures(),
  }),

  /**
   * Validate terrain generation request
   */
  validateRequest: (request: TerrainGenerationRequest): boolean => {
    return (
      request.coordinates.x !== undefined &&
      request.coordinates.z !== undefined &&
      request.seed !== undefined &&
      request.noise.scale > 0 &&
      request.noise.octaves > 0 &&
      request.noise.heightMultiplier > 0
    )
  },

  /**
   * Calculate expected block count for a chunk
   */
  calculateExpectedBlockCount: (heightMap: readonly number[]): number => {
    return heightMap.reduce((sum, height) => sum + height, 0)
  },
}
