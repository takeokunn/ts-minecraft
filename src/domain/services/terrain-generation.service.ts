/**
 * Enhanced Terrain Generation Service
 * 
 * Pure domain service for terrain generation using advanced algorithms
 * and domain-driven patterns. Extracted from infrastructure layer with
 * all technology-agnostic business logic for world generation.
 */

import { Effect, Context, Layer, pipe } from 'effect'
import { BlockType, BLOCK_MATERIAL_PROPERTIES, BlockPropertiesUtils } from '@domain/constants/block-properties'
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
 * Advanced noise generation settings
 */
export interface AdvancedNoiseSettings extends NoiseSettings {
  readonly ridgedMultiplier?: number
  readonly billowiness?: number
  readonly domainWarpStrength?: number
  readonly fractalType?: 'fbm' | 'ridged' | 'billow'
}

/**
 * Biome-specific generation rules
 */
export interface BiomeGenerationRules {
  readonly surfaceDepth: number
  readonly subsurfaceDepth: number
  readonly bedrockVariation: number
  readonly oreMultiplier: number
  readonly vegetationDensity: number
  readonly structureSpawnRate: number
  readonly temperatureRange: readonly [number, number]
  readonly humidityRange: readonly [number, number]
}

/**
 * Enhanced biome configuration with generation rules
 */
export interface EnhancedBiomeConfig extends BiomeConfig {
  readonly generationRules: BiomeGenerationRules
  readonly blockVariants?: {
    readonly [key: string]: BlockType[]
  }
}

/**
 * Structure generation settings
 */
export interface StructureConfig {
  readonly caves: {
    readonly enabled: boolean
    readonly density: number
    readonly minSize: number
    readonly maxSize: number
  }
  readonly ravines: {
    readonly enabled: boolean
    readonly frequency: number
    readonly width: number
    readonly depth: number
  }
  readonly dungeons: {
    readonly enabled: boolean
    readonly frequency: number
    readonly size: number
  }
}

/**
 * Advanced terrain generation request
 */
export interface EnhancedTerrainGenerationRequest extends TerrainGenerationRequest {
  readonly advancedNoise?: AdvancedNoiseSettings
  readonly enhancedBiome?: EnhancedBiomeConfig
  readonly structures?: StructureConfig
}

/**
 * Multi-octave fractal noise implementation
 * Pure mathematical function for generating natural-looking noise
 */
class DomainNoise {
  /**
   * Generate fractal brownian motion noise
   */
  static fbm(x: number, y: number, z: number, settings: AdvancedNoiseSettings, seed: number): number {
    let value = 0
    let amplitude = 1
    let frequency = settings.scale
    let maxValue = 0

    for (let i = 0; i < settings.octaves; i++) {
      const noiseValue = this.simplex3D(x * frequency, y * frequency, z * frequency, seed + i)
      value += noiseValue * amplitude
      maxValue += amplitude
      amplitude *= settings.persistence
      frequency *= settings.lacunarity
    }

    return value / maxValue
  }

  /**
   * Generate ridged multifractal noise
   */
  static ridgedMultifractal(x: number, y: number, z: number, settings: AdvancedNoiseSettings, seed: number): number {
    let value = 0
    let amplitude = 1
    let frequency = settings.scale
    let ridgedMultiplier = settings.ridgedMultiplier ?? 2.0

    for (let i = 0; i < settings.octaves; i++) {
      let noiseValue = this.simplex3D(x * frequency, y * frequency, z * frequency, seed + i)
      noiseValue = Math.abs(noiseValue)
      noiseValue = ridgedMultiplier - noiseValue
      noiseValue = noiseValue * noiseValue
      value += noiseValue * amplitude
      amplitude *= settings.persistence
      frequency *= settings.lacunarity
    }

    return value
  }

  /**
   * Generate billow noise
   */
  static billow(x: number, y: number, z: number, settings: AdvancedNoiseSettings, seed: number): number {
    let value = 0
    let amplitude = 1
    let frequency = settings.scale

    for (let i = 0; i < settings.octaves; i++) {
      let noiseValue = this.simplex3D(x * frequency, y * frequency, z * frequency, seed + i)
      noiseValue = Math.abs(noiseValue)
      value += noiseValue * amplitude
      amplitude *= settings.persistence
      frequency *= settings.lacunarity
    }

    const billowiness = settings.billowiness ?? 0.5
    return Math.pow(value, billowiness)
  }

  /**
   * Domain warp for more realistic terrain
   */
  static domainWarp(x: number, y: number, z: number, settings: AdvancedNoiseSettings, seed: number): [number, number, number] {
    const warpStrength = settings.domainWarpStrength ?? 50.0
    const warpX = this.simplex3D(x * 0.02, y * 0.02, z * 0.02, seed + 1000) * warpStrength
    const warpY = this.simplex3D(x * 0.02, y * 0.02, z * 0.02, seed + 2000) * warpStrength
    const warpZ = this.simplex3D(x * 0.02, y * 0.02, z * 0.02, seed + 3000) * warpStrength

    return [x + warpX, y + warpY, z + warpZ]
  }

  /**
   * Generate noise based on fractal type
   */
  static generateNoise(x: number, y: number, z: number, settings: AdvancedNoiseSettings, seed: number): number {
    const [warpedX, warpedY, warpedZ] = settings.domainWarpStrength 
      ? this.domainWarp(x, y, z, settings, seed)
      : [x, y, z]

    switch (settings.fractalType ?? 'fbm') {
      case 'ridged':
        return this.ridgedMultifractal(warpedX, warpedY, warpedZ, settings, seed)
      case 'billow':
        return this.billow(warpedX, warpedY, warpedZ, settings, seed)
      case 'fbm':
      default:
        return this.fbm(warpedX, warpedY, warpedZ, settings, seed)
    }
  }

  /**
   * Simple 3D simplex noise implementation
   */
  private static simplex3D(x: number, y: number, z: number, seed: number): number {
    const offset = seed * 1000
    const n = Math.sin((x + offset) * 0.1) * 
              Math.cos((y + offset) * 0.1) * 
              Math.sin((z + offset) * 0.1)
    return (n + 1) / 2 - 0.5 // Return in range [-0.5, 0.5]
  }
}

/**
 * Advanced terrain generation algorithms
 */
class TerrainGenerationAlgorithms {
  /**
   * Generate advanced height map with multiple noise layers
   */
  static generateAdvancedHeightMap(
    chunkX: number,
    chunkZ: number,
    seed: number,
    noiseSettings: AdvancedNoiseSettings,
    biome: EnhancedBiomeConfig,
  ): readonly number[] {
    const heightMap: number[] = []
    const chunkSize = 16

    // Generate base terrain height using primary noise
    const baseHeights = this.generateBaseHeightLayer(chunkX, chunkZ, seed, noiseSettings)
    
    // Generate mountain/hill features using ridged noise
    const mountainHeights = this.generateMountainLayer(chunkX, chunkZ, seed + 1000, noiseSettings, biome)
    
    // Generate valley/depression features
    const valleyHeights = this.generateValleyLayer(chunkX, chunkZ, seed + 2000, noiseSettings, biome)

    for (let i = 0; i < chunkSize * chunkSize; i++) {
      let height = baseHeights[i] + mountainHeights[i] - valleyHeights[i]
      
      // Apply biome-specific height adjustments
      height = this.applyBiomeHeightModifications(height, biome)
      
      // Ensure height is within valid range
      height = Math.max(1, Math.min(255, Math.floor(height)))
      heightMap.push(height)
    }

    return heightMap
  }

  /**
   * Generate base terrain height layer
   */
  private static generateBaseHeightLayer(
    chunkX: number,
    chunkZ: number,
    seed: number,
    noiseSettings: AdvancedNoiseSettings,
  ): readonly number[] {
    const heights: number[] = []
    const chunkSize = 16

    for (let z = 0; z < chunkSize; z++) {
      for (let x = 0; x < chunkSize; x++) {
        const worldX = chunkX * chunkSize + x
        const worldZ = chunkZ * chunkSize + z

        const height = DomainNoise.generateNoise(worldX, 0, worldZ, noiseSettings, seed)
        const scaledHeight = height * noiseSettings.heightMultiplier + noiseSettings.baseHeight
        heights.push(scaledHeight)
      }
    }

    return heights
  }

  /**
   * Generate mountain/hill feature layer
   */
  private static generateMountainLayer(
    chunkX: number,
    chunkZ: number,
    seed: number,
    noiseSettings: AdvancedNoiseSettings,
    biome: EnhancedBiomeConfig,
  ): readonly number[] {
    const heights: number[] = []
    const chunkSize = 16

    const mountainSettings: AdvancedNoiseSettings = {
      ...noiseSettings,
      scale: noiseSettings.scale * 0.3,
      fractalType: 'ridged',
      ridgedMultiplier: 1.5,
    }

    for (let z = 0; z < chunkSize; z++) {
      for (let x = 0; x < chunkSize; x++) {
        const worldX = chunkX * chunkSize + x
        const worldZ = chunkZ * chunkSize + z

        let mountainHeight = DomainNoise.generateNoise(worldX, 0, worldZ, mountainSettings, seed)
        
        // Scale based on biome preferences
        if (biome.type === 'mountain') {
          mountainHeight *= 3.0
        } else if (biome.type === 'plains') {
          mountainHeight *= 0.2
        } else if (biome.type === 'ocean') {
          mountainHeight *= 0.1
        }

        heights.push(mountainHeight * 40) // Scale mountain features
      }
    }

    return heights
  }

  /**
   * Generate valley/depression layer
   */
  private static generateValleyLayer(
    chunkX: number,
    chunkZ: number,
    seed: number,
    noiseSettings: AdvancedNoiseSettings,
    biome: EnhancedBiomeConfig,
  ): readonly number[] {
    const heights: number[] = []
    const chunkSize = 16

    const valleySettings: AdvancedNoiseSettings = {
      ...noiseSettings,
      scale: noiseSettings.scale * 0.15,
      fractalType: 'billow',
      billowiness: 0.3,
    }

    for (let z = 0; z < chunkSize; z++) {
      for (let x = 0; x < chunkSize; x++) {
        const worldX = chunkX * chunkSize + x
        const worldZ = chunkZ * chunkSize + z

        let valleyDepth = DomainNoise.generateNoise(worldX, 0, worldZ, valleySettings, seed)
        
        // Scale based on biome preferences
        if (biome.type === 'ocean') {
          valleyDepth *= 2.0 // Deeper ocean valleys
        } else if (biome.type === 'mountain') {
          valleyDepth *= 1.5 // Mountain valleys
        }

        heights.push(Math.max(0, valleyDepth * 20)) // Scale valley features
      }
    }

    return heights
  }

  /**
   * Apply biome-specific height modifications
   */
  private static applyBiomeHeightModifications(height: number, biome: EnhancedBiomeConfig): number {
    const rules = biome.generationRules

    // Apply temperature and humidity effects on height
    const avgTemp = (rules.temperatureRange[0] + rules.temperatureRange[1]) / 2
    const avgHumidity = (rules.humidityRange[0] + rules.humidityRange[1]) / 2

    // Cold biomes tend to be higher (mountains)
    if (avgTemp < 0.3) {
      height += 20
    }

    // Humid biomes tend to have more variation
    if (avgHumidity > 0.7) {
      height += (Math.random() - 0.5) * 10
    }

    return height
  }
}

/**
 * Advanced block placement logic with biome awareness
 */
class BiomeAwareBlockPlacement {
  /**
   * Generate blocks with advanced biome-specific placement
   */
  static generateAdvancedBlocks(
    chunkX: number,
    chunkZ: number,
    heightMap: readonly number[],
    biome: EnhancedBiomeConfig,
    features: FeatureConfig,
    structures: StructureConfig,
    seed: number,
  ): readonly GeneratedBlock[] {
    const blocks: GeneratedBlock[] = []
    const chunkSize = 16
    const maxHeight = 256

    for (let y = 0; y < maxHeight; y++) {
      for (let z = 0; z < chunkSize; z++) {
        for (let x = 0; x < chunkSize; x++) {
          const heightIndex = z * chunkSize + x
          const terrainHeight = heightMap[heightIndex]
          const worldX = chunkX * chunkSize + x
          const worldY = y
          const worldZ = chunkZ * chunkSize + z

          // Check for structure generation first
          if (this.shouldGenerateStructure(worldX, worldY, worldZ, structures, seed)) {
            const structureBlock = this.generateStructureBlock(worldX, worldY, worldZ, structures, seed)
            if (structureBlock) {
              blocks.push(structureBlock)
              continue
            }
          }

          // Generate regular terrain blocks
          const blockType = this.determineAdvancedBlockType(
            worldX,
            worldY,
            worldZ,
            terrainHeight,
            biome,
            features,
            seed,
          )

          if (blockType !== 'air') {
            const position: Position3D = { x: worldX, y: worldY, z: worldZ }
            blocks.push({
              position,
              blockType,
              lightLevel: this.calculateAdvancedLightLevel(worldY, terrainHeight, blockType),
            })
          }
        }
      }
    }

    return blocks
  }

  /**
   * Determine block type with advanced biome-specific logic
   */
  private static determineAdvancedBlockType(
    x: number,
    y: number,
    z: number,
    terrainHeight: number,
    biome: EnhancedBiomeConfig,
    features: FeatureConfig,
    seed: number,
  ): BlockType {
    const rules = biome.generationRules

    // Bedrock layer with variation
    if (y <= rules.bedrockVariation) {
      const bedrockNoise = DomainNoise.generateNoise(x, y, z, { 
        scale: 0.1, 
        octaves: 1, 
        persistence: 0.5, 
        lacunarity: 2.0,
        heightMultiplier: 1,
        baseHeight: 0 
      }, seed)
      
      if (y === 0 || bedrockNoise > 0.3) {
        return 'bedrock'
      }
    }

    // Deep underground stone layer with ore generation
    if (y <= terrainHeight - rules.subsurfaceDepth) {
      let blockType: BlockType = 'stone'

      // Enhanced ore generation based on biome rules
      if (features.generateOres) {
        blockType = this.generateOres(x, y, z, biome, features, seed) ?? blockType
      }

      // Biome-specific stone variants
      if (biome.blockVariants?.stone) {
        const stoneNoise = DomainNoise.generateNoise(x, y, z, { 
          scale: 0.05, 
          octaves: 2, 
          persistence: 0.5, 
          lacunarity: 2.0,
          heightMultiplier: 1,
          baseHeight: 0 
        }, seed + 5000)
        
        if (stoneNoise > 0.6) {
          const variants = biome.blockVariants.stone
          const variantIndex = Math.floor(Math.abs(stoneNoise * variants.length)) % variants.length
          return variants[variantIndex]
        }
      }

      return blockType
    }

    // Subsurface layer
    if (y <= terrainHeight - rules.surfaceDepth) {
      return biome.subsurfaceBlock as BlockType
    }

    // Surface layer with vegetation
    if (y === terrainHeight) {
      // Check for vegetation generation
      if (this.shouldGenerateVegetation(x, z, biome, seed)) {
        return this.selectVegetationBlock(biome, seed)
      }

      return biome.surfaceBlock as BlockType
    }

    // Above-surface features (trees, etc.)
    if (y > terrainHeight && y <= terrainHeight + 10) {
      const vegetationBlock = this.generateAboveSurfaceVegetation(x, y, z, terrainHeight, biome, seed)
      if (vegetationBlock) {
        return vegetationBlock
      }
    }

    // Water level for ocean/lake biomes
    if (y <= 62 && biome.type === 'ocean') {
      return 'water'
    }

    return 'air'
  }

  /**
   * Enhanced ore generation with biome-specific rules
   */
  private static generateOres(
    x: number,
    y: number,
    z: number,
    biome: EnhancedBiomeConfig,
    features: FeatureConfig,
    seed: number,
  ): BlockType | null {
    const oreMultiplier = biome.generationRules.oreMultiplier
    const adjustedDensity = features.oreDensity * oreMultiplier

    const oreNoise = DomainNoise.generateNoise(x, y, z, {
      scale: 0.05,
      octaves: 3,
      persistence: 0.6,
      lacunarity: 2.0,
      heightMultiplier: 1,
      baseHeight: 0,
      fractalType: 'billow'
    }, seed + 12345)

    const oreThreshold = 1 - adjustedDensity

    // Diamond ore (deep levels, rare)
    if (y <= 16 && oreNoise > oreThreshold + 0.12) {
      return 'diamond_ore'
    }

    // Gold ore (mid-deep levels)
    if (y <= 32 && oreNoise > oreThreshold + 0.10) {
      return 'gold_ore'
    }

    // Iron ore (common, mid levels)
    if (y <= 64 && oreNoise > oreThreshold + 0.08) {
      return 'iron_ore'
    }

    // Coal ore (surface to deep, very common)
    if (y <= 128 && oreNoise > oreThreshold + 0.05) {
      return 'coal_ore'
    }

    return null
  }

  /**
   * Check if vegetation should be generated
   */
  private static shouldGenerateVegetation(x: number, z: number, biome: EnhancedBiomeConfig, seed: number): boolean {
    const vegetationNoise = DomainNoise.generateNoise(x, 0, z, {
      scale: 0.1,
      octaves: 2,
      persistence: 0.5,
      lacunarity: 2.0,
      heightMultiplier: 1,
      baseHeight: 0
    }, seed + 9999)

    return vegetationNoise > (1 - biome.generationRules.vegetationDensity)
  }

  /**
   * Select appropriate vegetation block for biome
   */
  private static selectVegetationBlock(biome: EnhancedBiomeConfig, seed: number): BlockType {
    // Simple vegetation selection based on biome type
    switch (biome.type) {
      case 'forest':
        return Math.random() > 0.1 ? 'grass' : 'wood'
      case 'desert':
        return 'sand' // Could add cactus later
      case 'snow':
        return 'snow'
      default:
        return biome.surfaceBlock as BlockType
    }
  }

  /**
   * Generate above-surface vegetation (trees, etc.)
   */
  private static generateAboveSurfaceVegetation(
    x: number,
    y: number,
    z: number,
    terrainHeight: number,
    biome: EnhancedBiomeConfig,
    seed: number,
  ): BlockType | null {
    const heightAboveTerrain = y - terrainHeight

    // Simple tree generation for forest biomes
    if (biome.type === 'forest' && heightAboveTerrain <= 5) {
      const treeNoise = DomainNoise.generateNoise(x, 0, z, {
        scale: 0.2,
        octaves: 1,
        persistence: 0.5,
        lacunarity: 2.0,
        heightMultiplier: 1,
        baseHeight: 0
      }, seed + 7777)

      if (treeNoise > 0.8) {
        return heightAboveTerrain <= 3 ? 'wood' : 'leaves'
      }
    }

    return null
  }

  /**
   * Check if structures should be generated
   */
  private static shouldGenerateStructure(
    x: number,
    y: number,
    z: number,
    structures: StructureConfig,
    seed: number,
  ): boolean {
    // Cave generation
    if (structures.caves.enabled && y > 1 && y < 60) {
      const caveNoise = DomainNoise.generateNoise(x, y, z, {
        scale: 0.02,
        octaves: 3,
        persistence: 0.5,
        lacunarity: 2.0,
        heightMultiplier: 1,
        baseHeight: 0,
        fractalType: 'billow'
      }, seed + 11111)

      return caveNoise > (1 - structures.caves.density)
    }

    return false
  }

  /**
   * Generate structure-specific blocks
   */
  private static generateStructureBlock(
    x: number,
    y: number,
    z: number,
    structures: StructureConfig,
    seed: number,
  ): GeneratedBlock | null {
    // For caves, return air to create caverns
    if (y > 1 && y < 60) {
      return {
        position: { x, y, z },
        blockType: 'air',
        lightLevel: 0,
      }
    }

    return null
  }

  /**
   * Calculate advanced light level with block properties consideration
   */
  private static calculateAdvancedLightLevel(y: number, terrainHeight: number, blockType: BlockType): number {
    // Check if block is a light source
    if (BlockPropertiesUtils.isBlockLightSource(blockType)) {
      return BlockPropertiesUtils.getBlockLightLevel(blockType)
    }

    // Surface lighting
    if (y >= terrainHeight) {
      return 15 // Full sunlight
    }

    // Underground lighting calculation
    const depth = terrainHeight - y
    let lightLevel = Math.max(0, 15 - depth)

    // Transparent blocks allow more light
    if (BlockPropertiesUtils.isBlockTransparent(blockType)) {
      lightLevel += 2
    }

    return Math.min(15, lightLevel)
  }
}

/**
 * Enhanced Terrain Generation Service Implementation
 */
export class EnhancedTerrainGenerationService implements ITerrainGenerator {
  generateTerrain = (request: EnhancedTerrainGenerationRequest): Effect.Effect<TerrainGenerationResult, never, never> =>
    Effect.gen(function* () {
      const startTime = performance.now()
      const { coordinates, seed, biome, noise, features } = request
      const advancedNoise = request.advancedNoise ?? this.createAdvancedNoiseSettings(noise)
      const enhancedBiome = request.enhancedBiome ?? this.createEnhancedBiome(biome)
      const structures = request.structures ?? this.createDefaultStructures()

      // Generate advanced height map
      const heightMap = TerrainGenerationAlgorithms.generateAdvancedHeightMap(
        coordinates.x,
        coordinates.z,
        seed,
        advancedNoise,
        enhancedBiome,
      )

      // Generate blocks with biome-aware placement
      const blocks = BiomeAwareBlockPlacement.generateAdvancedBlocks(
        coordinates.x,
        coordinates.z,
        heightMap,
        enhancedBiome,
        features,
        structures,
        seed,
      )

      // Generate biome map
      const biomeMap = this.generateBiomeMap(enhancedBiome)

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
      const advancedNoise = this.createAdvancedNoiseSettings(noise)
      const defaultBiome = this.createEnhancedBiome(TerrainGeneratorHelpers.createDefaultBiome())
      
      return TerrainGenerationAlgorithms.generateAdvancedHeightMap(
        coordinates.x,
        coordinates.z,
        seed,
        advancedNoise,
        defaultBiome,
      )
    })

  getBiome = (x: number, z: number, seed: number): Effect.Effect<BiomeConfig, never, never> =>
    Effect.gen(function* () {
      const biomeNoise = DomainNoise.generateNoise(x * 0.001, 0, z * 0.001, {
        scale: 0.001,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        heightMultiplier: 1,
        baseHeight: 0,
        fractalType: 'fbm'
      }, seed + 54321)

      const temperatureNoise = DomainNoise.generateNoise(x * 0.002, 0, z * 0.002, {
        scale: 0.002,
        octaves: 3,
        persistence: 0.6,
        lacunarity: 2.0,
        heightMultiplier: 1,
        baseHeight: 0
      }, seed + 12345)

      const humidityNoise = DomainNoise.generateNoise(x * 0.003, 0, z * 0.003, {
        scale: 0.003,
        octaves: 3,
        persistence: 0.6,
        lacunarity: 2.0,
        heightMultiplier: 1,
        baseHeight: 0
      }, seed + 67890)

      // Normalize noise values
      const normalizedBiome = (biomeNoise + 0.5)
      const temperature = (temperatureNoise + 0.5)
      const humidity = (humidityNoise + 0.5)

      // Determine biome based on temperature and humidity
      return this.selectBiomeByClimate(normalizedBiome, temperature, humidity)
    })

  isAvailable = (): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      return true // Always available as it's pure logic
    })

  /**
   * Create advanced noise settings from basic noise settings
   */
  private createAdvancedNoiseSettings(noise: NoiseSettings): AdvancedNoiseSettings {
    return {
      ...noise,
      fractalType: 'fbm',
      ridgedMultiplier: 2.0,
      billowiness: 0.5,
      domainWarpStrength: 30.0,
    }
  }

  /**
   * Create enhanced biome configuration
   */
  private createEnhancedBiome(biome: BiomeConfig): EnhancedBiomeConfig {
    const generationRules: BiomeGenerationRules = this.createBiomeGenerationRules(biome.type)
    
    return {
      ...biome,
      generationRules,
      blockVariants: this.createBlockVariants(biome.type),
    }
  }

  /**
   * Create biome-specific generation rules
   */
  private createBiomeGenerationRules(biomeType: string): BiomeGenerationRules {
    switch (biomeType) {
      case 'mountain':
        return {
          surfaceDepth: 1,
          subsurfaceDepth: 5,
          bedrockVariation: 3,
          oreMultiplier: 1.5,
          vegetationDensity: 0.2,
          structureSpawnRate: 0.1,
          temperatureRange: [0.1, 0.4],
          humidityRange: [0.3, 0.7],
        }
      case 'ocean':
        return {
          surfaceDepth: 0,
          subsurfaceDepth: 8,
          bedrockVariation: 1,
          oreMultiplier: 0.8,
          vegetationDensity: 0.05,
          structureSpawnRate: 0.05,
          temperatureRange: [0.4, 0.7],
          humidityRange: [0.8, 1.0],
        }
      case 'desert':
        return {
          surfaceDepth: 3,
          subsurfaceDepth: 2,
          bedrockVariation: 2,
          oreMultiplier: 0.9,
          vegetationDensity: 0.05,
          structureSpawnRate: 0.3,
          temperatureRange: [0.8, 1.0],
          humidityRange: [0.0, 0.3],
        }
      case 'forest':
        return {
          surfaceDepth: 1,
          subsurfaceDepth: 4,
          bedrockVariation: 2,
          oreMultiplier: 1.0,
          vegetationDensity: 0.8,
          structureSpawnRate: 0.2,
          temperatureRange: [0.5, 0.8],
          humidityRange: [0.6, 0.9],
        }
      default: // plains
        return {
          surfaceDepth: 1,
          subsurfaceDepth: 3,
          bedrockVariation: 2,
          oreMultiplier: 1.0,
          vegetationDensity: 0.4,
          structureSpawnRate: 0.15,
          temperatureRange: [0.4, 0.7],
          humidityRange: [0.4, 0.8],
        }
    }
  }

  /**
   * Create block variants for biomes
   */
  private createBlockVariants(biomeType: string): { readonly [key: string]: BlockType[] } {
    switch (biomeType) {
      case 'mountain':
        return {
          stone: ['stone', 'cobblestone'],
        }
      case 'desert':
        return {
          stone: ['stone'],
        }
      default:
        return {}
    }
  }

  /**
   * Create default structure configuration
   */
  private createDefaultStructures(): StructureConfig {
    return {
      caves: {
        enabled: true,
        density: 0.15,
        minSize: 3,
        maxSize: 8,
      },
      ravines: {
        enabled: true,
        frequency: 0.02,
        width: 3,
        depth: 15,
      },
      dungeons: {
        enabled: true,
        frequency: 0.005,
        size: 5,
      },
    }
  }

  /**
   * Select biome based on climate parameters
   */
  private selectBiomeByClimate(biomeNoise: number, temperature: number, humidity: number): BiomeConfig {
    // Cold biomes
    if (temperature < 0.3) {
      if (humidity > 0.6) {
        return TerrainGeneratorHelpers.createDefaultBiome('forest') // Cold forest
      } else {
        return TerrainGeneratorHelpers.createDefaultBiome('mountain') // Cold mountains
      }
    }

    // Hot biomes
    if (temperature > 0.8) {
      if (humidity < 0.3) {
        return TerrainGeneratorHelpers.createDefaultBiome('desert')
      } else {
        return TerrainGeneratorHelpers.createDefaultBiome('plains') // Hot plains
      }
    }

    // Temperate biomes
    if (humidity > 0.8) {
      return TerrainGeneratorHelpers.createDefaultBiome('ocean')
    } else if (humidity > 0.6) {
      return TerrainGeneratorHelpers.createDefaultBiome('forest')
    } else {
      return TerrainGeneratorHelpers.createDefaultBiome('plains')
    }
  }

  /**
   * Generate biome map
   */
  private generateBiomeMap(biome: EnhancedBiomeConfig): readonly string[] {
    return new Array(16 * 16).fill(biome.type)
  }
}

/**
 * Live layer for Enhanced Terrain Generation Service
 */
export const EnhancedTerrainGenerationServiceLive = Layer.succeed(
  TerrainGeneratorPort,
  new EnhancedTerrainGenerationService(),
)

/**
 * Terrain Generation Service interface for dependency injection
 */
export interface TerrainGenerationService extends ITerrainGenerator {}

export const TerrainGenerationService = Context.GenericTag<TerrainGenerationService>('TerrainGenerationService')

/**
 * Create terrain generation service layer with Effect-TS patterns
 */
export const terrainGenerationServiceLive = Layer.succeed(
  TerrainGenerationService,
  new EnhancedTerrainGenerationService(),
)

// Re-export original service for backward compatibility
export * from './terrain-generation-domain.service'
export { 
  TerrainGenerationDomainService as TerrainGenerationDomainServiceOriginal,
  TerrainGenerationDomainServiceLive as TerrainGenerationDomainServiceLiveOriginal
} from './terrain-generation-domain.service'

/**
 * Utility functions for terrain generation
 */
export const TerrainGenerationServiceUtils = {
  /**
   * Create default enhanced terrain generation request
   */
  createDefaultEnhancedRequest: (coordinates: ChunkCoordinates, seed: number): EnhancedTerrainGenerationRequest => ({
    coordinates,
    seed,
    biome: TerrainGeneratorHelpers.createDefaultBiome(),
    noise: TerrainGeneratorHelpers.createDefaultNoiseSettings(),
    features: TerrainGeneratorHelpers.createDefaultFeatures(),
    advancedNoise: {
      scale: 0.01,
      octaves: 6,
      persistence: 0.5,
      lacunarity: 2.0,
      heightMultiplier: 80,
      baseHeight: 64,
      fractalType: 'fbm',
      domainWarpStrength: 25.0,
    },
  }),

  /**
   * Validate enhanced terrain generation request
   */
  validateEnhancedRequest: (request: EnhancedTerrainGenerationRequest): boolean => {
    return (
      request.coordinates.x !== undefined &&
      request.coordinates.z !== undefined &&
      request.seed !== undefined &&
      request.noise.scale > 0 &&
      request.noise.octaves > 0 &&
      request.noise.heightMultiplier > 0 &&
      (request.advancedNoise?.fractalType === undefined || 
       ['fbm', 'ridged', 'billow'].includes(request.advancedNoise.fractalType))
    )
  },

  /**
   * Estimate terrain complexity
   */
  estimateTerrainComplexity: (request: EnhancedTerrainGenerationRequest): number => {
    let complexity = request.noise.octaves * 10
    
    if (request.advancedNoise?.fractalType === 'ridged') complexity += 20
    if (request.advancedNoise?.fractalType === 'billow') complexity += 15
    if (request.advancedNoise?.domainWarpStrength) complexity += 30
    if (request.structures?.caves.enabled) complexity += 25
    if (request.features?.generateOres) complexity += 15
    
    return complexity
  },
} as const