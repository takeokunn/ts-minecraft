/**
 * Terrain Generator Port
 *
 * This port defines the contract for terrain generation operations,
 * allowing the domain layer to generate terrain without depending
 * on specific noise algorithms or terrain generation implementations.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'

/**
 * Chunk coordinates for terrain generation
 */
export interface ChunkCoordinates {
  readonly x: number
  readonly z: number
}

/**
 * 3D position for blocks
 */
export interface Position3D {
  readonly x: number
  readonly y: number
  readonly z: number
}

/**
 * Biome configuration
 */
export interface BiomeConfig {
  readonly type: 'plains' | 'desert' | 'ocean' | 'forest' | 'mountain' | 'swamp'
  readonly temperature: number
  readonly humidity: number
  readonly surfaceBlock: string
  readonly subsurfaceBlock: string
}

/**
 * Noise settings for terrain generation
 */
export interface NoiseSettings {
  readonly scale: number
  readonly octaves: number
  readonly persistence: number
  readonly lacunarity: number
  readonly heightMultiplier: number
  readonly baseHeight: number
}

/**
 * Feature generation configuration
 */
export interface FeatureConfig {
  readonly generateOres: boolean
  readonly generateStructures: boolean
  readonly generateVegetation: boolean
  readonly oreDensity: number
}

/**
 * Generated block data
 */
export interface GeneratedBlock {
  readonly position: Position3D
  readonly blockType: string
  readonly lightLevel: number
}

/**
 * Terrain generation result
 */
export interface TerrainGenerationResult {
  readonly coordinates: ChunkCoordinates
  readonly blocks: readonly GeneratedBlock[]
  readonly heightMap: readonly number[]
  readonly biomeMap: readonly string[]
  readonly generationTime: number
  readonly blockCount: number
}

/**
 * Terrain generation request
 */
export interface TerrainGenerationRequest {
  readonly coordinates: ChunkCoordinates
  readonly seed: number
  readonly biome: BiomeConfig
  readonly noise: NoiseSettings
  readonly features: FeatureConfig
}

/**
 * Terrain Generator Port Interface
 */
export interface ITerrainGenerator {
  /**
   * Generate terrain for a chunk
   */
  readonly generateTerrain: (request: TerrainGenerationRequest) => Effect.Effect<TerrainGenerationResult, never, never>

  /**
   * Generate height map for a chunk
   */
  readonly generateHeightMap: (coordinates: ChunkCoordinates, seed: number, noise: NoiseSettings) => Effect.Effect<readonly number[], never, never>

  /**
   * Get biome at specific coordinates
   */
  readonly getBiome: (x: number, z: number, seed: number) => Effect.Effect<BiomeConfig, never, never>

  /**
   * Check if terrain generation is available
   */
  readonly isAvailable: () => Effect.Effect<boolean, never, never>
}

/**
 * Terrain Generator Port tag for dependency injection
 */
export const TerrainGeneratorPort = Context.GenericTag<ITerrainGenerator>('TerrainGeneratorPort')

/**
 * Helper functions for terrain generation
 */
export const TerrainGeneratorHelpers = {
  /**
   * Create default biome configuration
   */
  createDefaultBiome: (type: BiomeConfig['type'] = 'plains'): BiomeConfig => ({
    type,
    temperature: 0.5,
    humidity: 0.5,
    surfaceBlock: type === 'desert' ? 'sand' : 'grass',
    subsurfaceBlock: 'dirt',
  }),

  /**
   * Create default noise settings
   */
  createDefaultNoiseSettings: (): NoiseSettings => ({
    scale: 0.01,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2.0,
    heightMultiplier: 64,
    baseHeight: 64,
  }),

  /**
   * Create default feature configuration
   */
  createDefaultFeatures: (): FeatureConfig => ({
    generateOres: true,
    generateStructures: false,
    generateVegetation: false,
    oreDensity: 0.1,
  }),
}
