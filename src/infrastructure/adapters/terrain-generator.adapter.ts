/**
 * Terrain Generator Adapter
 * 
 * Infrastructure adapter that implements the ITerrainGenerator port interface.
 * This adapter provides the concrete implementation of terrain generation
 * using specific libraries and algorithms while maintaining the port contract.
 */

import { Effect, Layer, Context } from 'effect'
import {
  ITerrainGenerator,
  TerrainGeneratorPort,
  TerrainGenerationRequest,
  TerrainGenerationResult,
  ChunkCoordinates,
  BiomeConfig,
  NoiseSettings,
  GeneratedBlock,
  Position3D,
  TerrainGeneratorHelpers,
} from '../../domain/ports/terrain-generator.port'

/**
 * Concrete implementation of the terrain generator using infrastructure-specific algorithms
 */
export class TerrainGeneratorAdapter implements ITerrainGenerator {
  private seed: number = 12345

  /**
   * Simple noise implementation using Math functions
   * In a real implementation, this would use a proper noise library like SimplexNoise
   */
  private noise = (x: number, y: number, z: number, seed: number): number => {
    const n = Math.sin(x * 0.01 + seed) * Math.cos(y * 0.01 + seed) * Math.sin(z * 0.01 + seed)
    return (n + 1) / 2 // Normalize to 0-1
  }

  /**
   * Generate height map using noise functions
   */
  private generateHeightMapData = (
    chunkX: number,
    chunkZ: number,
    seed: number,
    noise: NoiseSettings,
  ): readonly number[] => {
    const heightMap: number[] = []
    const chunkSize = 16

    for (let z = 0; z < chunkSize; z++) {
      for (let x = 0; x < chunkSize; x++) {
        const worldX = chunkX * chunkSize + x
        const worldZ = chunkZ * chunkSize + z

        let height = 0
        let amplitude = 1
        let frequency = noise.scale

        // Multi-octave noise generation
        for (let octave = 0; octave < noise.octaves; octave++) {
          height += this.noise(worldX * frequency, 0, worldZ * frequency, seed) * amplitude
          amplitude *= noise.persistence
          frequency *= noise.lacunarity
        }

        // Apply height scaling and constraints
        height = Math.floor(height * noise.heightMultiplier + noise.baseHeight)
        height = Math.max(1, Math.min(255, height))

        heightMap.push(height)
      }
    }

    return heightMap
  }

  /**
   * Determine block type based on position and biome rules
   */
  private determineBlockType = (
    x: number,
    y: number,
    z: number,
    terrainHeight: number,
    biome: BiomeConfig,
    seed: number,
  ): string => {
    // Bedrock layer
    if (y === 0) {
      return 'bedrock'
    }

    // Underground stone layer
    if (y <= terrainHeight - 4) {
      let blockType = 'stone'

      // Simple ore generation
      const oreNoise = this.noise(x, y, z, seed + 12345)
      if (oreNoise > 0.95 && y < 64) {
        blockType = 'coal_ore'
      } else if (oreNoise > 0.98 && y < 32) {
        blockType = 'iron_ore'
      } else if (oreNoise > 0.995 && y < 16) {
        blockType = 'diamond_ore'
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
   * Calculate light level based on position
   */
  private calculateLightLevel = (y: number, terrainHeight: number): number => {
    if (y > terrainHeight) {
      return 15 // Full sunlight above surface
    }
    
    const depth = terrainHeight - y
    return Math.max(0, 15 - depth)
  }

  generateTerrain = (request: TerrainGenerationRequest): Effect.Effect<TerrainGenerationResult, never, never> =>
    Effect.gen(function* () {
      const startTime = performance.now()
      const { coordinates, seed, biome, noise, features } = request

      // Generate height map using infrastructure-specific noise implementation
      const heightMap = this.generateHeightMapData(coordinates.x, coordinates.z, seed, noise)

      // Generate blocks based on height map and biome rules
      const blocks: GeneratedBlock[] = []
      const chunkSize = 16
      const maxHeight = 256

      for (let y = 0; y < maxHeight; y++) {
        for (let z = 0; z < chunkSize; z++) {
          for (let x = 0; x < chunkSize; x++) {
            const heightIndex = z * chunkSize + x
            const terrainHeight = heightMap[heightIndex]
            const worldX = coordinates.x * chunkSize + x
            const worldY = y
            const worldZ = coordinates.z * chunkSize + z

            const blockType = this.determineBlockType(
              worldX,
              worldY,
              worldZ,
              terrainHeight,
              biome,
              seed,
            )

            if (blockType !== 'air') {
              const position: Position3D = { x: worldX, y: worldY, z: worldZ }
              blocks.push({
                position,
                blockType,
                lightLevel: this.calculateLightLevel(worldY, terrainHeight),
              })
            }
          }
        }
      }

      // Generate biome map (simplified - single biome per chunk)
      const biomeMap = new Array(16 * 16).fill(biome.type)

      const generationTime = performance.now() - startTime

      return {
        coordinates,
        blocks,
        heightMap,
        biomeMap,
        generationTime,
        blockCount: blocks.length,
      } satisfies TerrainGenerationResult
    })

  generateHeightMap = (
    coordinates: ChunkCoordinates,
    seed: number,
    noise: NoiseSettings,
  ): Effect.Effect<readonly number[], never, never> =>
    Effect.gen(function* () {
      return this.generateHeightMapData(coordinates.x, coordinates.z, seed, noise)
    })

  getBiome = (x: number, z: number, seed: number): Effect.Effect<BiomeConfig, never, never> =>
    Effect.gen(function* () {
      // Infrastructure-specific biome generation using noise
      const biomeNoise = this.noise(x * 0.001, 0, z * 0.001, seed + 54321)
      
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
    })

  isAvailable = (): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      // Check if infrastructure dependencies are available
      // In a real implementation, this would check for WebGL, noise libraries, etc.
      return typeof performance !== 'undefined' && typeof Math !== 'undefined'
    })
}

/**
 * Live layer for Terrain Generator Adapter
 */
export const TerrainGeneratorAdapterLive = Layer.succeed(
  TerrainGeneratorPort,
  new TerrainGeneratorAdapter(),
)

/**
 * Terrain Generator Adapter with custom configuration
 */
export const createTerrainGeneratorAdapter = (config?: {
  seed?: number
  noiseLibrary?: 'math' | 'simplex' | 'perlin'
}) => {
  const adapter = new TerrainGeneratorAdapter()
  if (config?.seed) {
    adapter['seed'] = config.seed
  }
  return Layer.succeed(TerrainGeneratorPort, adapter)
}

/**
 * Infrastructure-specific terrain generation utilities
 */
export const TerrainGeneratorAdapterUtils = {
  /**
   * Validate terrain generation capabilities
   */
  validateCapabilities: (): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      // Check for required browser APIs and performance capabilities
      return (
        typeof performance !== 'undefined' &&
        typeof Math !== 'undefined' &&
        typeof Float32Array !== 'undefined'
      )
    }),

  /**
   * Estimate memory usage for terrain generation
   */
  estimateMemoryUsage: (chunkCount: number): number => {
    // Rough estimate: each chunk uses ~64KB for terrain data
    return chunkCount * 64 * 1024
  },

  /**
   * Get supported noise algorithms
   */
  getSupportedAlgorithms: (): string[] => {
    return ['math-based', 'simplified-perlin']
  },
}