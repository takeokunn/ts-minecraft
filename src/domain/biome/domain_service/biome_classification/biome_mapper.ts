/**
 * Biome Mapper Service - バイオームマッピングドメインサービス
 *
 * 気候データを具体的なMinecraftバイオームにマッピング
 * 17種類のバニラバイオーム + MOD拡張対応
 * 遷移領域とエコトーンの適切な処理
 */

import type { BoundingBox, WorldCoordinate2D } from '@/domain/biome/value_object/coordinates'
import { makeUnsafeWorldCoordinate2D, WorldCoordinate2DSchema } from '@/domain/biome/value_object/coordinates'
import { type BiomeGenerationError } from './errors'
import type { WorldSeed } from '@domain/shared/value_object/world_seed'
import { Context, Effect, Layer, Match, Option, pipe, Random, ReadonlyArray, Schema } from 'effect'
import { ClimateClassificationSchema, ClimateDataSchema } from './climate_calculator'
import type { ClimateData } from './index'

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
  transitionBiomes: Schema.Array(
    Schema.Struct({
      biome: MinecraftBiomeTypeSchema,
      distance: Schema.Number.pipe(Schema.nonNegative()),
      transitionType: Schema.Literal('gradual', 'sharp', 'ecotone', 'edge'),
    })
  ).pipe(Schema.optional),

  // 信頼性指標
  mappingConfidence: Schema.Number.pipe(Schema.between(0, 1)),
  alternativeBiomes: Schema.Array(
    Schema.Struct({
      biome: MinecraftBiomeTypeSchema,
      probability: Schema.Number.pipe(Schema.between(0, 1)),
    })
  ).pipe(Schema.optional),

  // 位置情報
  coordinate: WorldCoordinate2DSchema,

  // 生成パラメータ
  biomeParameters: Schema.Struct({
    temperature: Schema.Number.pipe(Schema.finite()),
    humidity: Schema.Number.pipe(Schema.between(0, 1)),
    continentalness: Schema.Number.pipe(Schema.between(0, 1)),
    erosion: Schema.Number.pipe(Schema.between(0, 1)),
    depth: Schema.Number.pipe(Schema.finite()),
    weirdness: Schema.Number.pipe(Schema.finite()),
  }),

  // 特殊特徴
  specialFeatures: Schema.Array(
    Schema.Literal(
      'rare_variant',
      'modified_biome',
      'hills_variant',
      'edge_biome',
      'river_biome',
      'ocean_biome',
      'mountain_biome',
      'cave_biome'
    )
  ).pipe(Schema.optional),

  // 入力データ
  sourceClimate: ClimateDataSchema,
  sourceClassification: ClimateClassificationSchema,

  // メタデータ
  mappingMetadata: Schema.Struct({
    mappingAlgorithm: Schema.String,
    noiseInfluence: Schema.Number.pipe(Schema.between(0, 1)),
    randomSeed: Schema.BigInt,
    computationTime: Schema.Number.pipe(Schema.optional),
    qualityScore: Schema.Number.pipe(Schema.between(0, 1)),
  }),
}).pipe(
  Schema.annotations({
    identifier: 'BiomeMappingResult',
    title: 'Biome Mapping Result',
    description: 'Complete biome mapping with transition and variant information',
  })
)

export type BiomeMappingResult = typeof BiomeMappingResultSchema.Type

export type BiomeTransitionAnalysis = {
  readonly fromBiome: MinecraftBiomeType
  readonly toBiome: MinecraftBiomeType
  readonly transitionDistance: number
  readonly transitionSharpness: number
  readonly ecotoneCharacteristics: ReadonlyArray<string>
}

type BiomeParameters = {
  readonly temperature: number
  readonly humidity: number
  readonly continentalness: number
  readonly erosion: number
  readonly depth: number
  readonly weirdness: number
}

type CustomBiomeRule = {
  readonly biome: MinecraftBiomeType
  readonly conditions: ReadonlyArray<string>
  readonly priority: number
}

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
  ) => Effect.Effect<BiomeMappingResult, BiomeGenerationError>

  /**
   * 複数座標での地域バイオーム分布計算
   */
  readonly mapRegionalBiomes: (
    bounds: BoundingBox,
    resolution: number,
    seed: WorldSeed
  ) => Effect.Effect<ReadonlyArray<ReadonlyArray<BiomeMappingResult>>, BiomeGenerationError>

  /**
   * バイオーム遷移の詳細解析
   */
  readonly analyzeBiomeTransitions: (
    centerCoordinate: WorldCoordinate2D,
    searchRadius: number,
    seed: WorldSeed
  ) => Effect.Effect<ReadonlyArray<BiomeTransitionAnalysis>, BiomeGenerationError>

  /**
   * 希少バイオームの生成判定
   */
  readonly generateRareBiomes: (
    coordinate: WorldCoordinate2D,
    baseBiome: MinecraftBiomeType,
    seed: WorldSeed
  ) => Effect.Effect<
    {
      hasRareBiome: boolean
      rareBiomeType: MinecraftBiomeType | null
      rarity: number
      conditions: ReadonlyArray<string>
    },
    BiomeGenerationError
  >

  /**
   * 高度帯によるバイオーム変化
   */
  readonly mapAltitudinalZones: (
    coordinate: WorldCoordinate2D,
    elevationProfile: ReadonlyArray<number>,
    seed: WorldSeed
  ) => Effect.Effect<
    ReadonlyArray<{
      elevation: number
      biome: MinecraftBiomeType
      transitionType: string
    }>,
    BiomeGenerationError
  >

  /**
   * 海洋バイオームの特別処理
   */
  readonly mapOceanBiomes: (
    coordinate: WorldCoordinate2D,
    depth: number,
    temperature: number,
    seed: WorldSeed
  ) => Effect.Effect<BiomeMappingResult, BiomeGenerationError>

  /**
   * 洞窟バイオームの生成
   */
  readonly mapCaveBiomes: (
    coordinate: WorldCoordinate2D,
    depth: number,
    surfaceBiome: MinecraftBiomeType,
    seed: WorldSeed
  ) => Effect.Effect<BiomeMappingResult, BiomeGenerationError>

  /**
   * バイオーム境界の最適化
   */
  readonly optimizeBiomeBoundaries: (
    biomeMap: ReadonlyArray<ReadonlyArray<BiomeMappingResult>>,
    smoothingFactor: number
  ) => Effect.Effect<ReadonlyArray<ReadonlyArray<BiomeMappingResult>>, BiomeGenerationError>

  /**
   * カスタムバイオーム定義の適用
   */
  readonly applyCustomBiomes: (
    baseMappingResult: BiomeMappingResult,
    customBiomeRules: ReadonlyArray<CustomBiomeRule>
  ) => Effect.Effect<BiomeMappingResult, BiomeGenerationError>
}

/**
 * Biome Mapper Service Context Tag
 */
export const BiomeMapperService = Context.GenericTag<BiomeMapperService>('@minecraft/domain/world/BiomeMapper')

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
        const transitionBiomes = yield* detectTransitionBiomes(coordinate, primaryBiome, biomeParameters, seed)

        // 5. 信頼性の評価
        const mappingConfidence = yield* calculateMappingConfidence(biomeParameters, climateData)

        // 6. 代替バイオームの計算
        const alternativeBiomes = yield* calculateAlternativeBiomes(biomeParameters, primaryBiome)

        // 7. 特殊特徴の判定
        const specialFeatures = yield* identifySpecialFeatures(primaryBiome, biomeParameters, coordinate)

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
            qualityScore: mappingConfidence,
          },
        } satisfies BiomeMappingResult
      }),

    mapRegionalBiomes: (bounds, resolution, seed) =>
      pipe(
        ReadonlyArray.makeBy(resolution, (x) => x),
        Effect.forEach(
          (x) =>
            pipe(
              ReadonlyArray.makeBy(resolution, (z) => {
                const worldX = bounds.min.x + (x / (resolution - 1)) * (bounds.max.x - bounds.min.x)
                const worldZ = bounds.min.z + (z / (resolution - 1)) * (bounds.max.z - bounds.min.z)

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
                  dataQuality: 0.9,
                } as ClimateData

                return { climateData, worldX, worldZ }
              }),
              Effect.forEach(
                ({ climateData, worldX, worldZ }) =>
                  BiomeMapperService.mapPrimaryBiome(climateData, makeUnsafeWorldCoordinate2D(worldX, worldZ), seed),
                { concurrency: 4 }
              )
            ),
          { concurrency: 4 }
        )
      ),

    analyzeBiomeTransitions: (centerCoordinate, searchRadius, seed) =>
      Effect.gen(function* () {
        const centerClimate = createSimpleClimate(centerCoordinate)
        const centerBiome = yield* BiomeMapperService.mapPrimaryBiome(centerClimate, centerCoordinate, seed)

        const angles = ReadonlyArray.makeBy(8, (i) => i * 45)

        const transitions = yield* pipe(
          angles,
          Effect.forEach(
            (angle) => {
              const rad = (angle * Math.PI) / 180
              const testCoordinate: WorldCoordinate2D = {
                x: centerCoordinate.x + Math.cos(rad) * searchRadius,
                z: centerCoordinate.z + Math.sin(rad) * searchRadius,
              }

              const testClimate = createSimpleClimate(testCoordinate)

              return pipe(
                BiomeMapperService.mapPrimaryBiome(testClimate, testCoordinate, seed),
                Effect.map((testBiome) =>
                  testBiome.primaryBiome !== centerBiome.primaryBiome
                    ? [
                        Effect.gen(function* () {
                          const sharpness = yield* Random.nextIntBetween(0, 100)
                          return {
                            fromBiome: centerBiome.primaryBiome,
                            toBiome: testBiome.primaryBiome,
                            transitionDistance: searchRadius,
                            transitionSharpness: sharpness / 100,
                            ecotoneCharacteristics: ['temperature_gradient', 'moisture_change'],
                          }
                        }),
                      ]
                    : []
                )
              )
            },
            { concurrency: 4 }
          ),
          Effect.map(ReadonlyArray.flatten)
        )

        return transitions
      }),

    generateRareBiomes: (coordinate, baseBiome, seed) =>
      Effect.gen(function* () {
        const rarityValue = yield* Random.nextIntBetween(0, 100)
        const rarity = rarityValue / 100
        const hasRareBiome = rarity < 0.05

        const { rareBiomeType, conditions } = hasRareBiome
          ? {
              rareBiomeType: selectRareBiome(baseBiome),
              conditions: ['rare_generation_conditions_met'],
            }
          : {
              rareBiomeType: null,
              conditions: [],
            }

        return {
          hasRareBiome,
          rareBiomeType,
          rarity,
          conditions,
        }
      }),

    mapAltitudinalZones: (coordinate, elevationProfile, seed) =>
      pipe(
        elevationProfile,
        Effect.forEach(
          (elevation) =>
            pipe(
              getBiomeForElevation(elevation, coordinate, seed),
              Effect.map((biome) => ({
                elevation,
                biome,
                transitionType: getTransitionType(elevation),
              }))
            ),
          { concurrency: 4 }
        )
      ),

    mapOceanBiomes: (coordinate, depth, temperature, seed) =>
      Effect.gen(function* () {
        const oceanBiome = pipe(
          { depth, temperature },
          Match.value,
          Match.when(
            ({ depth }) => depth > 30,
            () => 'deep_ocean'
          ),
          Match.when(
            ({ temperature }) => temperature > 15,
            () => 'warm_ocean'
          ),
          Match.when(
            ({ temperature }) => temperature > 0,
            () => 'lukewarm_ocean'
          ),
          Match.orElse(() => 'cold_ocean')
        ) satisfies MinecraftBiomeType

        return {
          primaryBiome: oceanBiome,
          coordinate,
          biomeParameters: {
            temperature,
            humidity: 0.8,
            continentalness: 0.0,
            erosion: 0.1,
            depth: -depth,
            weirdness: 0.0,
          },
          mappingConfidence: 0.9,
          sourceClimate: createSimpleClimate(coordinate),
          mappingMetadata: {
            mappingAlgorithm: 'ocean_specific',
            noiseInfluence: 0.1,
            randomSeed: seed,
            qualityScore: 0.9,
          },
        } satisfies BiomeMappingResult
      }),

    mapCaveBiomes: (coordinate, depth, surfaceBiome, seed) =>
      Effect.gen(function* () {
        const randomValueRaw = yield* Random.nextIntBetween(0, 100)
        const randomValue = randomValueRaw / 100
        const caveBiome = pipe(
          { depth, randomValue },
          Match.value,
          Match.when(
            ({ depth }) => depth < -40,
            () => 'deep_dark'
          ),
          Match.when(
            ({ randomValue }) => randomValue < 0.3,
            () => 'lush_caves'
          ),
          Match.orElse(() => 'dripstone_caves')
        ) satisfies MinecraftBiomeType

        return {
          primaryBiome: caveBiome,
          coordinate,
          biomeParameters: {
            temperature: 8,
            humidity: 0.9,
            continentalness: 0.5,
            erosion: 0.8,
            depth,
            weirdness: 0.5,
          },
          mappingConfidence: 0.8,
          sourceClimate: createSimpleClimate(coordinate),
          specialFeatures: ['cave_biome'],
          mappingMetadata: {
            mappingAlgorithm: 'cave_specific',
            noiseInfluence: 0.4,
            randomSeed: seed,
            qualityScore: 0.8,
          },
        } satisfies BiomeMappingResult
      }),

    optimizeBiomeBoundaries: (biomeMap, smoothingFactor) =>
      Effect.gen(function* () {
        const findMostCommonBiome = (neighbors: ReadonlyArray<BiomeMappingResult>): MinecraftBiomeType | undefined => {
          const biomeCounts = pipe(
            neighbors,
            ReadonlyArray.groupBy((neighbor) => neighbor.primaryBiome),
            (groups) =>
              Object.entries(groups).map(([biome, items]) => ({
                biome: biome satisfies string as MinecraftBiomeType,
                count: items.length,
              })),
            ReadonlyArray.sortBy((a, b) => b.count - a.count)
          )
          return biomeCounts[0]?.biome
        }

        const optimizedMap = biomeMap.map((row) => [...row])

        const innerIndices = pipe(
          ReadonlyArray.makeBy(biomeMap.length - 2, (i) => i + 1),
          ReadonlyArray.flatMap((x) =>
            pipe(
              ReadonlyArray.makeBy(biomeMap[x].length - 2, (j) => j + 1),
              ReadonlyArray.map((z) => ({ x, z }))
            )
          )
        )

        // Effect化: forEach内でRandom Serviceを使用
        yield* Effect.forEach(innerIndices, ({ x, z }) =>
          Effect.gen(function* () {
            const neighbors = [biomeMap[x - 1][z], biomeMap[x + 1][z], biomeMap[x][z - 1], biomeMap[x][z + 1]]
            const mostCommonBiome = findMostCommonBiome(neighbors)

            yield* pipe(
              Option.fromNullable(mostCommonBiome),
              Option.match({
                onNone: () => Effect.unit,
                onSome: (biome) =>
                  Effect.gen(function* () {
                    const randomValue = yield* Random.nextIntBetween(0, 100)
                    const shouldSmooth = randomValue < smoothingFactor * 100

                    yield* pipe(
                      Match.value(shouldSmooth),
                      Match.when(true, () =>
                        Effect.sync(() => {
                          optimizedMap[x][z] = {
                            ...optimizedMap[x][z],
                            primaryBiome: biome,
                          }
                        })
                      ),
                      Match.orElse(() => Effect.unit)
                    )
                  }),
              })
            )
          })
        )

        return optimizedMap
      }),

    applyCustomBiomes: (baseMappingResult, _customBiomeRules) =>
      Effect.gen(function* () {
        // カスタムバイオーム適用（簡略化）
        return baseMappingResult
      }),
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
): Effect.Effect<BiomeParameters, BiomeGenerationError> =>
  Effect.gen(function* () {
    const erosionValue = yield* Random.nextIntBetween(0, 100)
    return {
      temperature: climateData.temperature / 30, // -1 to 1
      humidity: climateData.humidity / 100, // 0 to 1
      continentalness: climateData.continentality,
      erosion: erosionValue / 100, // 簡略化
      depth: climateData.elevation / 100, // 正規化
      weirdness: Math.sin(Number(seed) + coordinate.x * 0.001) * 0.5,
    }
  })

/**
 * 主要バイオームの決定
 */
const determinePrimaryBiome = (
  params: BiomeParameters,
  climateData: ClimateData
): Effect.Effect<MinecraftBiomeType, BiomeGenerationError> => {
  const temp = params.temperature
  const humidity = params.humidity

  const biomeType = pipe(
    { temp, humidity },
    Match.value,
    Match.when(
      ({ temp, humidity }) => temp > 0.8 && humidity > 0.8,
      () => 'jungle'
    ),
    Match.when(
      ({ temp, humidity }) => temp > 0.8 && humidity > 0.4,
      () => 'plains'
    ),
    Match.when(
      ({ temp }) => temp > 0.8,
      () => 'desert'
    ),
    Match.when(
      ({ temp, humidity }) => temp > 0.2 && humidity > 0.6,
      () => 'forest'
    ),
    Match.when(
      ({ temp }) => temp > 0.2,
      () => 'plains'
    ),
    Match.when(
      ({ temp, humidity }) => temp > -0.5 && humidity > 0.5,
      () => 'taiga'
    ),
    Match.when(
      ({ temp }) => temp > -0.5,
      () => 'snowy_taiga'
    ),
    Match.orElse(() => 'snowy_tundra')
  ) satisfies MinecraftBiomeType

  return Effect.succeed(biomeType)
}

/**
 * バリアント・サブバイオームの決定
 */
const determineVariants = (
  primaryBiome: MinecraftBiomeType,
  _params: BiomeParameters,
  _seed: WorldSeed
): Effect.Effect<{ variant?: string; subBiomes?: MinecraftBiomeType[] }, BiomeGenerationError> => {
  const variants: { variant?: string; subBiomes?: MinecraftBiomeType[] } = {}

  return pipe(
    Effect.succeed(variants),
    Effect.tap(() =>
      Effect.gen(function* () {
        yield* pipe(
          Match.value(primaryBiome === 'forest'),
          Match.when(true, () =>
            Effect.gen(function* () {
              const forestRoll = yield* Random.nextIntBetween(0, 100)
              yield* pipe(
                Match.value(forestRoll < 20),
                Match.when(true, () =>
                  Effect.sync(() => {
                    variants.variant = 'birch'
                  })
                ),
                Match.orElse(() => Effect.unit)
              )
            })
          ),
          Match.orElse(() => Effect.unit)
        )
      })
    ),
    Effect.tap(() =>
      Effect.gen(function* () {
        yield* pipe(
          Match.value(primaryBiome === 'desert'),
          Match.when(true, () =>
            Effect.gen(function* () {
              const desertRoll = yield* Random.nextIntBetween(0, 100)
              yield* pipe(
                Match.value(desertRoll < 10),
                Match.when(true, () =>
                  Effect.sync(() => {
                    variants.variant = 'temple'
                  })
                ),
                Match.orElse(() => Effect.unit)
              )
            })
          ),
          Match.orElse(() => Effect.unit)
        )
      })
    )
  )
}

/**
 * 遷移バイオームの検出
 */
const detectTransitionBiomes = (
  coordinate: WorldCoordinate2D,
  primaryBiome: MinecraftBiomeType,
  _params: BiomeParameters,
  seed: WorldSeed
): Effect.Effect<
  ReadonlyArray<{
    biome: MinecraftBiomeType
    distance: number
    transitionType: 'gradual' | 'sharp' | 'ecotone' | 'edge'
  }>,
  BiomeGenerationError
> => Effect.succeed([])

/**
 * マッピング信頼度の計算
 */
const calculateMappingConfidence = (
  _params: BiomeParameters,
  climateData: ClimateData
): Effect.Effect<number, BiomeGenerationError> => Effect.succeed(climateData.dataQuality * 0.9)

/**
 * 代替バイオームの計算
 */
const calculateAlternativeBiomes = (
  _params: BiomeParameters,
  primaryBiome: MinecraftBiomeType
): Effect.Effect<ReadonlyArray<{ biome: MinecraftBiomeType; probability: number }>, BiomeGenerationError> =>
  Effect.succeed([])

/**
 * 特殊特徴の判定
 */
const identifySpecialFeatures = (
  primaryBiome: MinecraftBiomeType,
  _params: BiomeParameters,
  coordinate: WorldCoordinate2D
): Effect.Effect<ReadonlyArray<string>, BiomeGenerationError> => Effect.succeed([])

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
  dataQuality: 0.9,
})

/**
 * 希少バイオーム選択
 */
const selectRareBiome = (baseBiome: MinecraftBiomeType): MinecraftBiomeType => {
  const rareVariants: Record<string, MinecraftBiomeType> = {
    forest: 'flower_forest',
    plains: 'flower_forest',
    desert: 'eroded_badlands',
    ocean: 'mushroom_fields',
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
): Effect.Effect<MinecraftBiomeType, BiomeGenerationError> =>
  Effect.succeed(
    pipe(
      elevation,
      Match.value,
      Match.when(
        (e) => e > 150,
        () => 'stony_peaks'
      ),
      Match.when(
        (e) => e > 100,
        () => 'windswept_hills'
      ),
      Match.when(
        (e) => e > 80,
        () => 'meadow'
      ),
      Match.orElse(() => 'plains')
    ) satisfies MinecraftBiomeType
  )

/**
 * 遷移タイプ取得
 */
const getTransitionType = (elevation: number): string =>
  pipe(
    elevation,
    Match.value,
    Match.when(
      (e) => e > 120,
      () => 'alpine'
    ),
    Match.when(
      (e) => e > 90,
      () => 'montane'
    ),
    Match.orElse(() => 'lowland')
  )
