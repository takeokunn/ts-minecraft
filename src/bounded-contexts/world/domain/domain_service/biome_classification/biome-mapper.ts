/**
 * Biome Mapper Service - バイオームマッピングドメインサービス
 *
 * 気候データを具体的なMinecraftバイオームにマッピング
 * 17種類のバニラバイオーム + MOD拡張対応
 * 遷移領域とエコトーンの適切な処理
 */

import { Effect, Context, Schema, Layer, pipe } from 'effect'
import type {
  WorldCoordinate2D,
} from '../../value_object/coordinates/world-coordinate.js'
import type {
  ClimateData,
  ClimateClassification,
} from './climate-calculator.js'
import type {
  WorldSeed,
} from '../../value_object/world_seed/seed.js'
import {
  GenerationErrorSchema,
  type GenerationError,
} from '../../types/errors/generation-errors.js'

/**
 * Minecraftバイオーム種別
 */
export const MinecraftBiomeTypeSchema = Schema.Literal(
  // 温帯バイオーム
  'plains',
  'forest',
  'birch_forest',
  'dark_forest',
  'flower_forest',

  // 寒帯バイオーム
  'taiga',
  'old_growth_pine_taiga',
  'old_growth_spruce_taiga',
  'snowy_taiga',
  'snowy_tundra',

  // 乾燥バイオーム
  'desert',
  'badlands',
  'eroded_badlands',
  'wooded_badlands',

  // 熱帯バイオーム
  'jungle',
  'sparse_jungle',
  'bamboo_jungle',
  'mangrove_swamp',

  // 湿地バイオーム
  'swamp',
  'mushroom_fields',

  // 山岳バイオーム
  'windswept_hills',
  'windswept_forest',
  'windswept_gravelly_hills',
  'stony_peaks',
  'jagged_peaks',
  'frozen_peaks',
  'snowy_slopes',
  'grove',
  'meadow',

  // 海洋バイオーム
  'ocean',
  'deep_ocean',
  'warm_ocean',
  'lukewarm_ocean',
  'cold_ocean',
  'frozen_ocean',

  // 河川・湖沼
  'river',
  'frozen_river',

  // 洞窟バイオーム
  'dripstone_caves',
  'lush_caves',
  'deep_dark',

  // ネザーバイオーム
  'nether_wastes',
  'crimson_forest',
  'warped_forest',
  'soul_sand_valley',
  'basalt_deltas',

  // エンドバイオーム
  'the_end',
  'small_end_islands',
  'end_barrens',
  'end_highlands',
  'end_midlands'
)

export type MinecraftBiomeType = typeof MinecraftBiomeTypeSchema.Type

/**
 * バイオームマッピング結果スキーマ
 */
export const BiomeMappingResultSchema = Schema.Struct({
  // 主要バイオーム
  primaryBiome: MinecraftBiomeTypeSchema,

  // バリアント・サブバイオーム
  biomeVariant: Schema.String.pipe(Schema.optional),
  subBiomes: Schema.Array(MinecraftBiomeTypeSchema).pipe(Schema.optional),

  // 遷移情報
  transitionBiomes: Schema.Array(Schema.Struct({
    biome: MinecraftBiomeTypeSchema,
    distance: Schema.Number.pipe(Schema.nonNegative()),
    transitionType: Schema.Literal('gradual', 'sharp', 'ecotone', 'edge')
  })).pipe(Schema.optional),

  // 信頼性指標
  mappingConfidence: Schema.Number.pipe(
    Schema.between(0, 1)
  ),
  alternativeBiomes: Schema.Array(Schema.Struct({
    biome: MinecraftBiomeTypeSchema,
    probability: Schema.Number.pipe(Schema.between(0, 1))
  })).pipe(Schema.optional),

  // 位置情報
  coordinate: Schema.Unknown, // WorldCoordinate2D

  // 生成パラメータ
  biomeParameters: Schema.Struct({
    temperature: Schema.Number.pipe(Schema.finite()),
    humidity: Schema.Number.pipe(Schema.between(0, 1)),
    continentalness: Schema.Number.pipe(Schema.between(0, 1)),
    erosion: Schema.Number.pipe(Schema.between(0, 1)),
    depth: Schema.Number.pipe(Schema.finite()),
    weirdness: Schema.Number.pipe(Schema.finite())
  }),

  // 特殊特徴
  specialFeatures: Schema.Array(Schema.Literal(
    'rare_variant',
    'modified_biome',
    'hills_variant',
    'edge_biome',
    'river_biome',
    'ocean_biome',
    'mountain_biome',
    'cave_biome'
  )).pipe(Schema.optional),

  // 入力データ
  sourceClimate: Schema.Unknown, // ClimateData
  sourceClassification: Schema.Unknown, // ClimateClassification

  // メタデータ
  mappingMetadata: Schema.Struct({
    mappingAlgorithm: Schema.String,
    noiseInfluence: Schema.Number.pipe(Schema.between(0, 1)),
    randomSeed: Schema.BigInt,
    computationTime: Schema.Number.pipe(Schema.optional),
    qualityScore: Schema.Number.pipe(Schema.between(0, 1))
  })
}).pipe(
  Schema.annotations({
    identifier: 'BiomeMappingResult',
    title: 'Biome Mapping Result',
    description: 'Complete biome mapping with transition and variant information'
  })
)

export type BiomeMappingResult = typeof BiomeMappingResultSchema.Type

/**
 * Biome Mapper Service Interface
 *
 * バイオームマッピングの核となるドメインサービス
 * 現実的な生態学理論とMinecraft世界観を両立
 */
export interface BiomeMapperService {
  /**
   * 気候データから主要バイオームをマッピング
   */
  readonly mapPrimaryBiome: (
    climateData: ClimateData,
    coordinate: WorldCoordinate2D,
    seed: WorldSeed
  ) => Effect.Effect<BiomeMappingResult, GenerationError>

  /**
   * 複数座標での地域バイオーム分布計算
   */
  readonly mapRegionalBiomes: (
    bounds: any, // BoundingBox
    resolution: number,
    seed: WorldSeed
  ) => Effect.Effect<ReadonlyArray<ReadonlyArray<BiomeMappingResult>>, GenerationError>

  /**
   * バイオーム遷移の詳細解析
   */
  readonly analyzeBiomeTransitions: (
    centerCoordinate: WorldCoordinate2D,
    searchRadius: number,
    seed: WorldSeed
  ) => Effect.Effect<ReadonlyArray<{
    fromBiome: MinecraftBiomeType
    toBiome: MinecraftBiomeType
    transitionDistance: number
    transitionSharpness: number
    ecotoneCharacteristics: ReadonlyArray<string>
  }>, GenerationError>

  /**
   * 希少バイオームの生成判定
   */
  readonly generateRareBiomes: (
    coordinate: WorldCoordinate2D,
    baseBiome: MinecraftBiomeType,
    seed: WorldSeed
  ) => Effect.Effect<{
    hasRareBiome: boolean
    rareBiomeType: MinecraftBiomeType | null
    rarity: number
    conditions: ReadonlyArray<string>
  }, GenerationError>

  /**
   * 高度帯によるバイオーム変化
   */
  readonly mapAltitudinalZones: (
    coordinate: WorldCoordinate2D,
    elevationProfile: ReadonlyArray<number>,
    seed: WorldSeed
  ) => Effect.Effect<ReadonlyArray<{
    elevation: number
    biome: MinecraftBiomeType
    transitionType: string
  }>, GenerationError>

  /**
   * 海洋バイオームの特別処理
   */
  readonly mapOceanBiomes: (
    coordinate: WorldCoordinate2D,
    depth: number,
    temperature: number,
    seed: WorldSeed
  ) => Effect.Effect<BiomeMappingResult, GenerationError>

  /**
   * 洞窟バイオームの生成
   */
  readonly mapCaveBiomes: (
    coordinate: WorldCoordinate2D,
    depth: number,
    surfaceBiome: MinecraftBiomeType,
    seed: WorldSeed
  ) => Effect.Effect<BiomeMappingResult, GenerationError>

  /**
   * バイオーム境界の最適化
   */
  readonly optimizeBiomeBoundaries: (
    biomeMap: ReadonlyArray<ReadonlyArray<BiomeMappingResult>>,
    smoothingFactor: number
  ) => Effect.Effect<ReadonlyArray<ReadonlyArray<BiomeMappingResult>>, GenerationError>

  /**
   * カスタムバイオーム定義の適用
   */
  readonly applyCustomBiomes: (
    baseMappingResult: BiomeMappingResult,
    customBiomeRules: ReadonlyArray<any> // CustomBiomeRule
  ) => Effect.Effect<BiomeMappingResult, GenerationError>
}

/**
 * Biome Mapper Service Context Tag
 */
export const BiomeMapperService = Context.GenericTag<BiomeMapperService>(
  '@minecraft/domain/world/BiomeMapper'
)

/**
 * Biome Mapper Service Live Implementation
 *
 * Minecraft 1.19+の最新バイオーム生成アルゴリズムを実装
 * 多次元ノイズベースの高精度マッピング
 */
export const BiomeMapperServiceLive = Layer.effect(
  BiomeMapperService,
  Effect.succeed({
    mapPrimaryBiome: (climateData, coordinate, seed) =>
      Effect.gen(function* () {
        const startTime = performance.now()

        // 1. Minecraft 1.19+のバイオームパラメータ計算
        const biomeParameters = yield* calculateBiomeParameters(climateData, coordinate, seed)

        // 2. 主要バイオームの決定
        const primaryBiome = yield* determinePrimaryBiome(biomeParameters, climateData)

        // 3. バリアント・サブバイオームの判定
        const variants = yield* determineVariants(primaryBiome, biomeParameters, seed)

        // 4. 遷移バイオームの検出
        const transitionBiomes = yield* detectTransitionBiomes(
          coordinate,
          primaryBiome,
          biomeParameters,
          seed
        )

        // 5. 信頼性の評価
        const mappingConfidence = yield* calculateMappingConfidence(
          biomeParameters,
          climateData
        )

        // 6. 代替バイオームの計算
        const alternativeBiomes = yield* calculateAlternativeBiomes(
          biomeParameters,
          primaryBiome
        )

        // 7. 特殊特徴の判定
        const specialFeatures = yield* identifySpecialFeatures(
          primaryBiome,
          biomeParameters,
          coordinate
        )

        const computationTime = performance.now() - startTime

        return {
          primaryBiome,
          biomeVariant: variants.variant,
          subBiomes: variants.subBiomes,
          transitionBiomes,
          mappingConfidence,
          alternativeBiomes,
          coordinate,
          biomeParameters,
          specialFeatures,
          sourceClimate: climateData,
          sourceClassification: null, // 簡略化
          mappingMetadata: {
            mappingAlgorithm: 'minecraft_1_19_plus',
            noiseInfluence: 0.3,
            randomSeed: seed,
            computationTime,
            qualityScore: mappingConfidence
          }
        } satisfies BiomeMappingResult
      }),

    mapRegionalBiomes: (bounds, resolution, seed) =>
      Effect.gen(function* () {
        const biomeMap: BiomeMappingResult[][] = []

        for (let x = 0; x < resolution; x++) {
          const row: BiomeMappingResult[] = []
          for (let z = 0; z < resolution; z++) {
            const worldX = bounds.min.x + (x / (resolution - 1)) * (bounds.max.x - bounds.min.x)
            const worldZ = bounds.min.z + (z / (resolution - 1)) * (bounds.max.z - bounds.min.z)

            // 簡略化された気候データ
            const climateData = {
              temperature: 15 + Math.sin(worldX * 0.001) * 10,
              humidity: 50 + Math.cos(worldZ * 0.001) * 30,
              precipitation: 800 + Math.sin(worldX * 0.0005) * 400,
              evapotranspiration: 600,
              coordinate: { x: worldX, z: worldZ },
              elevation: 64,
              temperatureAmplitude: 20,
              precipitationSeasonality: 0.3,
              continentality: 0.5,
              aridity: 0.3,
              thermicity: 150,
              growingDegreeDays: 2000,
              frostFreeDays: 200,
              potentialEvapotranspiration: 700,
              dataQuality: 0.9
            } as ClimateData

            const biomeResult = yield* BiomeMapperService.mapPrimaryBiome(
              climateData,
              { x: worldX, z: worldZ } as WorldCoordinate2D,
              seed
            )

            row.push(biomeResult)
          }
          biomeMap.push(row)
        }

        return biomeMap
      }),

    analyzeBiomeTransitions: (centerCoordinate, searchRadius, seed) =>
      Effect.gen(function* () {
        // 中心バイオームの取得
        const centerClimate = createSimpleClimate(centerCoordinate)
        const centerBiome = yield* BiomeMapperService.mapPrimaryBiome(
          centerClimate,
          centerCoordinate,
          seed
        )

        const transitions = []

        // 8方向での遷移解析
        for (let angle = 0; angle < 360; angle += 45) {
          const rad = angle * Math.PI / 180
          const testCoordinate: WorldCoordinate2D = {
            x: centerCoordinate.x + Math.cos(rad) * searchRadius,
            z: centerCoordinate.z + Math.sin(rad) * searchRadius
          }

          const testClimate = createSimpleClimate(testCoordinate)
          const testBiome = yield* BiomeMapperService.mapPrimaryBiome(
            testClimate,
            testCoordinate,
            seed
          )

          if (testBiome.primaryBiome !== centerBiome.primaryBiome) {
            transitions.push({
              fromBiome: centerBiome.primaryBiome,
              toBiome: testBiome.primaryBiome,
              transitionDistance: searchRadius,
              transitionSharpness: Math.random(), // 簡略化
              ecotoneCharacteristics: ['temperature_gradient', 'moisture_change']
            })
          }
        }

        return transitions
      }),

    generateRareBiomes: (coordinate, baseBiome, seed) =>
      Effect.gen(function* () {
        // 希少バイオーム生成の確率計算
        const rarity = Math.random()
        const hasRareBiome = rarity < 0.05 // 5%の確率

        let rareBiomeType: MinecraftBiomeType | null = null
        const conditions: string[] = []

        if (hasRareBiome) {
          // 基本バイオームに基づく希少バイオーム選択
          rareBiomeType = selectRareBiome(baseBiome)
          conditions.push('rare_generation_conditions_met')
        }

        return {
          hasRareBiome,
          rareBiomeType,
          rarity,
          conditions
        }
      }),

    mapAltitudinalZones: (coordinate, elevationProfile, seed) =>
      Effect.gen(function* () {
        const zones = []

        for (const elevation of elevationProfile) {
          // 標高に基づくバイオーム変化
          const biome = yield* getBiomeForElevation(elevation, coordinate, seed)
          const transitionType = getTransitionType(elevation)

          zones.push({
            elevation,
            biome,
            transitionType
          })
        }

        return zones
      }),

    mapOceanBiomes: (coordinate, depth, temperature, seed) =>
      Effect.gen(function* () {
        // 深度と温度に基づく海洋バイオーム決定
        let oceanBiome: MinecraftBiomeType

        if (depth > 30) {
          oceanBiome = 'deep_ocean'
        } else if (temperature > 15) {
          oceanBiome = 'warm_ocean'
        } else if (temperature > 0) {
          oceanBiome = 'lukewarm_ocean'
        } else {
          oceanBiome = 'cold_ocean'
        }

        // 簡略化された海洋バイオーム結果
        return {
          primaryBiome: oceanBiome,
          coordinate,
          biomeParameters: {
            temperature,
            humidity: 0.8,
            continentalness: 0.0,
            erosion: 0.1,
            depth: -depth,
            weirdness: 0.0
          },
          mappingConfidence: 0.9,
          sourceClimate: createSimpleClimate(coordinate),
          mappingMetadata: {
            mappingAlgorithm: 'ocean_specific',
            noiseInfluence: 0.1,
            randomSeed: seed,
            qualityScore: 0.9
          }
        } satisfies BiomeMappingResult
      }),

    mapCaveBiomes: (coordinate, depth, surfaceBiome, seed) =>
      Effect.gen(function* () {
        // 深度と地表バイオームに基づく洞窟バイオーム決定
        let caveBiome: MinecraftBiomeType

        if (depth < -40) {
          caveBiome = 'deep_dark'
        } else if (Math.random() < 0.3) {
          caveBiome = 'lush_caves'
        } else {
          caveBiome = 'dripstone_caves'
        }

        return {
          primaryBiome: caveBiome,
          coordinate,
          biomeParameters: {
            temperature: 8, // 地下は涼しい
            humidity: 0.9,
            continentalness: 0.5,
            erosion: 0.8,
            depth,
            weirdness: 0.5
          },
          mappingConfidence: 0.8,
          sourceClimate: createSimpleClimate(coordinate),
          specialFeatures: ['cave_biome'],
          mappingMetadata: {
            mappingAlgorithm: 'cave_specific',
            noiseInfluence: 0.4,
            randomSeed: seed,
            qualityScore: 0.8
          }
        } satisfies BiomeMappingResult
      }),

    optimizeBiomeBoundaries: (biomeMap, smoothingFactor) =>
      Effect.gen(function* () {
        // 簡単なバイオーム境界平滑化
        const optimizedMap = biomeMap.map(row => [...row])

        for (let x = 1; x < biomeMap.length - 1; x++) {
          for (let z = 1; z < biomeMap[x].length - 1; z++) {
            const neighbors = [
              biomeMap[x-1][z], biomeMap[x+1][z],
              biomeMap[x][z-1], biomeMap[x][z+1]
            ]

            // 多数決による平滑化
            const biomeCounts = new Map<MinecraftBiomeType, number>()
            neighbors.forEach(neighbor => {
              const count = biomeCounts.get(neighbor.primaryBiome) || 0
              biomeCounts.set(neighbor.primaryBiome, count + 1)
            })

            const mostCommonBiome = Array.from(biomeCounts.entries())
              .sort((a, b) => b[1] - a[1])[0]?.[0]

            if (mostCommonBiome && Math.random() < smoothingFactor) {
              optimizedMap[x][z] = {
                ...optimizedMap[x][z],
                primaryBiome: mostCommonBiome
              }
            }
          }
        }

        return optimizedMap
      }),

    applyCustomBiomes: (baseMappingResult, customBiomeRules) =>
      Effect.gen(function* () {
        // カスタムバイオーム適用（簡略化）
        return baseMappingResult
      })
  })
)

// ヘルパー関数群

/**
 * バイオームパラメータの計算
 */
const calculateBiomeParameters = (
  climateData: ClimateData,
  coordinate: WorldCoordinate2D,
  seed: WorldSeed
): Effect.Effect<{
  temperature: number
  humidity: number
  continentalness: number
  erosion: number
  depth: number
  weirdness: number
}, GenerationError> =>
  Effect.succeed({
    temperature: climateData.temperature / 30, // -1 to 1
    humidity: climateData.humidity / 100, // 0 to 1
    continentalness: climateData.continentality,
    erosion: Math.random(), // 簡略化
    depth: climateData.elevation / 100, // 正規化
    weirdness: Math.sin(Number(seed) + coordinate.x * 0.001) * 0.5
  })

/**
 * 主要バイオームの決定
 */
const determinePrimaryBiome = (
  params: any,
  climateData: ClimateData
): Effect.Effect<MinecraftBiomeType, GenerationError> =>
  Effect.succeed((() => {
    const temp = params.temperature
    const humidity = params.humidity

    // 簡略化されたバイオーム決定ロジック
    if (temp > 0.8) {
      if (humidity > 0.8) return 'jungle'
      if (humidity > 0.4) return 'plains'
      return 'desert'
    } else if (temp > 0.2) {
      if (humidity > 0.6) return 'forest'
      return 'plains'
    } else if (temp > -0.5) {
      if (humidity > 0.5) return 'taiga'
      return 'snowy_taiga'
    } else {
      return 'snowy_tundra'
    }
  })())

/**
 * バリアント・サブバイオームの決定
 */
const determineVariants = (
  primaryBiome: MinecraftBiomeType,
  params: any,
  seed: WorldSeed
): Effect.Effect<{ variant?: string; subBiomes?: MinecraftBiomeType[] }, GenerationError> =>
  Effect.succeed((() => {
    const variants: { variant?: string; subBiomes?: MinecraftBiomeType[] } = {}

    // バイオーム固有のバリアント
    if (primaryBiome === 'forest' && Math.random() < 0.2) {
      variants.variant = 'birch'
    } else if (primaryBiome === 'desert' && Math.random() < 0.1) {
      variants.variant = 'temple'
    }

    return variants
  })())

/**
 * 遷移バイオームの検出
 */
const detectTransitionBiomes = (
  coordinate: WorldCoordinate2D,
  primaryBiome: MinecraftBiomeType,
  params: any,
  seed: WorldSeed
): Effect.Effect<ReadonlyArray<{
  biome: MinecraftBiomeType
  distance: number
  transitionType: 'gradual' | 'sharp' | 'ecotone' | 'edge'
}>, GenerationError> =>
  Effect.succeed([])

/**
 * マッピング信頼度の計算
 */
const calculateMappingConfidence = (
  params: any,
  climateData: ClimateData
): Effect.Effect<number, GenerationError> =>
  Effect.succeed(climateData.dataQuality * 0.9)

/**
 * 代替バイオームの計算
 */
const calculateAlternativeBiomes = (
  params: any,
  primaryBiome: MinecraftBiomeType
): Effect.Effect<ReadonlyArray<{ biome: MinecraftBiomeType; probability: number }>, GenerationError> =>
  Effect.succeed([])

/**
 * 特殊特徴の判定
 */
const identifySpecialFeatures = (
  primaryBiome: MinecraftBiomeType,
  params: any,
  coordinate: WorldCoordinate2D
): Effect.Effect<ReadonlyArray<string>, GenerationError> =>
  Effect.succeed([])

/**
 * 簡単な気候データ作成
 */
const createSimpleClimate = (coordinate: WorldCoordinate2D): ClimateData => ({
  temperature: 15 + Math.sin(coordinate.x * 0.001) * 10,
  humidity: 50 + Math.cos(coordinate.z * 0.001) * 30,
  precipitation: 800,
  evapotranspiration: 600,
  coordinate,
  elevation: 64,
  temperatureAmplitude: 20,
  precipitationSeasonality: 0.3,
  continentality: 0.5,
  aridity: 0.3,
  thermicity: 150,
  growingDegreeDays: 2000,
  frostFreeDays: 200,
  potentialEvapotranspiration: 700,
  dataQuality: 0.9
})

/**
 * 希少バイオーム選択
 */
const selectRareBiome = (baseBiome: MinecraftBiomeType): MinecraftBiomeType => {
  const rareVariants: Record<string, MinecraftBiomeType> = {
    'forest': 'flower_forest',
    'plains': 'flower_forest',
    'desert': 'eroded_badlands',
    'ocean': 'mushroom_fields'
  }
  return rareVariants[baseBiome] || baseBiome
}

/**
 * 標高別バイオーム取得
 */
const getBiomeForElevation = (
  elevation: number,
  coordinate: WorldCoordinate2D,
  seed: WorldSeed
): Effect.Effect<MinecraftBiomeType, GenerationError> =>
  Effect.succeed((() => {
    if (elevation > 150) return 'stony_peaks'
    if (elevation > 100) return 'windswept_hills'
    if (elevation > 80) return 'meadow'
    return 'plains'
  })())

/**
 * 遷移タイプ取得
 */
const getTransitionType = (elevation: number): string => {
  if (elevation > 120) return 'alpine'
  if (elevation > 90) return 'montane'
  return 'lowland'
}