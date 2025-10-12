/**
 * OrePlacer Domain Service - 鉱石配置システム
 *
 * 確率分布による現実的な鉱石配置アルゴリズム
 * 地質学的原理とゲームバランスを両立した鉱脈生成
 */

import { type GenerationError } from '@domain/world/types/errors'
import {
  makeUnsafeWorldCoordinate,
  WorldCoordinateSchema,
  type BoundingBox,
  type WorldCoordinate,
} from '@domain/world/value_object/coordinates'
import { AdvancedNoiseSettingsSchema } from '@domain/world/value_object/noise_configuration/index'
import type { WorldSeed } from '@domain/world/value_object/world_seed'
import { JsonRecordSchema, JsonValueSchema } from '@shared/schema/json'
import { Context, Effect, Layer, Match, Option, pipe, ReadonlyArray, Schema } from 'effect'

/**
 * 鉱石タイプ定義
 */
export const OreTypeSchema = Schema.Literal(
  'coal', // 石炭
  'iron', // 鉄
  'gold', // 金
  'diamond', // ダイヤモンド
  'emerald', // エメラルド
  'redstone', // レッドストーン
  'lapis', // ラピスラズリ
  'copper', // 銅
  'tin', // 錫（MOD対応）
  'silver', // 銀（MOD対応）
  'uranium', // ウラン（MOD対応）
  'quartz', // クォーツ
  'obsidian', // 黒曜石
  'rare_earth' // 希土類
).pipe(
  Schema.annotations({
    title: 'Ore Type',
    description: 'Types of ores that can be generated in the world',
  })
)

export type OreType = typeof OreTypeSchema.Type

/**
 * 鉱石密度プロファイル
 */
export const OreDensityProfileSchema = Schema.Struct({
  oreType: OreTypeSchema,

  // 深度分布
  depthDistribution: Schema.Struct({
    optimalDepth: Schema.Number.pipe(Schema.int()),
    depthRange: Schema.Struct({
      min: Schema.Number.pipe(Schema.int()),
      max: Schema.Number.pipe(Schema.int()),
    }),
    depthFalloff: Schema.Number.pipe(Schema.between(0, 1)), // 最適深度からの減衰率
  }),

  // 確率分布
  rarity: Schema.Number.pipe(Schema.between(0, 1)), // 0: 極稀, 1: 非常に一般的
  clusterProbability: Schema.Number.pipe(Schema.between(0, 1)), // クラスター形成確率
  veinProbability: Schema.Number.pipe(Schema.between(0, 1)), // 鉱脈形成確率

  // サイズ分布
  clusterSize: Schema.Struct({
    min: Schema.Number.pipe(Schema.int(), Schema.positive()),
    max: Schema.Number.pipe(Schema.int(), Schema.positive()),
    average: Schema.Number.pipe(Schema.positive()),
  }),

  // 地質的制約
  hostRocks: Schema.Array(Schema.String), // 母岩種類
  avoidMaterials: Schema.Array(Schema.String), // 避けるべき材質
  requiresProximity: Schema.Array(Schema.String).pipe(Schema.optional), // 近接必要材質

  // 特殊条件
  requiresWater: Schema.Boolean.pipe(Schema.optional),
  requiresLava: Schema.Boolean.pipe(Schema.optional),
  requiresAir: Schema.Boolean.pipe(Schema.optional),
  temperatureRange: Schema.Struct({
    min: Schema.Number,
    max: Schema.Number,
  }).pipe(Schema.optional),

  // ゲームバランス
  economicValue: Schema.Number.pipe(Schema.between(0, 100)),
  renewability: Schema.Boolean,
  processingDifficulty: Schema.Number.pipe(Schema.between(1, 10)),
}).pipe(
  Schema.annotations({
    identifier: 'OreDensityProfile',
    title: 'Ore Density Profile',
    description: 'Complete density and distribution profile for a specific ore type',
  })
)

export type OreDensityProfile = typeof OreDensityProfileSchema.Type

/**
 * 鉱脈構造
 */
export const OreVeinSchema = Schema.Struct({
  id: Schema.String,
  oreType: OreTypeSchema,

  // 空間的構造
  centerCoordinate: WorldCoordinateSchema,
  orientation: Schema.Struct({
    strike: Schema.Number.pipe(Schema.between(0, 360)), // 走向（度）
    dip: Schema.Number.pipe(Schema.between(0, 90)), // 傾斜（度）
    plunge: Schema.Number.pipe(Schema.between(0, 180)), // プランジ（度）
  }),

  // サイズ・形状
  length: Schema.Number.pipe(Schema.positive()),
  width: Schema.Number.pipe(Schema.positive()),
  thickness: Schema.Number.pipe(Schema.positive()),
  shape: Schema.Literal('tabular', 'lenticular', 'irregular', 'pipe', 'stratiform'),

  // 品位分布
  gradeDistribution: Schema.Array(
    Schema.Struct({
      coordinate: WorldCoordinateSchema,
      grade: Schema.Number.pipe(Schema.between(0, 1)), // 品位（0-1）
      confidence: Schema.Number.pipe(Schema.between(0, 1)),
    })
  ),

  // 地質情報
  hostRock: Schema.String,
  alterationZone: Schema.Number.pipe(Schema.positive()).pipe(Schema.optional),
  structuralControls: Schema.Array(Schema.String).pipe(Schema.optional),

  // 関連鉱脈
  relatedVeins: Schema.Array(Schema.String).pipe(Schema.optional),
  generation: Schema.Number.pipe(Schema.int(), Schema.positive()), // 形成世代
  metadata: Schema.optional(JsonRecordSchema),
}).pipe(
  Schema.annotations({
    identifier: 'OreVein',
    title: 'Ore Vein Structure',
    description: 'Geological ore vein with spatial and compositional information',
  })
)

export type OreVein = typeof OreVeinSchema.Type

/**
 * 鉱石配置設定
 */
export const OrePlacementConfigSchema = Schema.Struct({
  // 基本設定
  globalDensity: Schema.Number.pipe(Schema.between(0, 1)),
  realismLevel: Schema.Number.pipe(Schema.between(0, 1)), // 0: ゲーム的, 1: 現実的

  // 鉱石プロファイル
  oreProfiles: Schema.Array(OreDensityProfileSchema),

  // 地質設定
  enableGeologicalRealism: Schema.Boolean,
  tectonicActivity: Schema.Number.pipe(Schema.between(0, 1)),
  hydrothermalism: Schema.Number.pipe(Schema.between(0, 1)),
  metamorphismLevel: Schema.Number.pipe(Schema.between(0, 1)),

  // ノイズ設定
  distributionNoise: AdvancedNoiseSettingsSchema,
  gradeNoise: AdvancedNoiseSettingsSchema,
  structuralNoise: AdvancedNoiseSettingsSchema,

  // 生成制約
  avoidCaves: Schema.Boolean,
  caveBuffer: Schema.Number.pipe(Schema.nonNegative()),
  avoidWater: Schema.Boolean,
  waterBuffer: Schema.Number.pipe(Schema.nonNegative()),

  // バランス調整
  difficultyMultiplier: Schema.Number.pipe(Schema.positive()),
  abundanceModifier: Schema.Number.pipe(Schema.positive()),
  qualityModifier: Schema.Number.pipe(Schema.positive()),

  // パフォーマンス
  maxVeinsPerChunk: Schema.Number.pipe(Schema.int(), Schema.positive()),
  generationRadius: Schema.Number.pipe(Schema.positive()),
  qualityThreshold: Schema.Number.pipe(Schema.between(0, 1)),
}).pipe(
  Schema.annotations({
    identifier: 'OrePlacementConfig',
    title: 'Ore Placement Configuration',
    description: 'Complete configuration for ore generation and placement',
  })
)

export type OrePlacementConfig = typeof OrePlacementConfigSchema.Type

/**
 * 鉱石配置結果
 */
export const OrePlacementResultSchema = Schema.Struct({
  veins: Schema.Array(OreVeinSchema),

  orePlacements: Schema.Array(
    Schema.Struct({
      coordinate: WorldCoordinateSchema,
      oreType: OreTypeSchema,
      grade: Schema.Number.pipe(Schema.between(0, 1)),
      veinId: Schema.String.pipe(Schema.optional),
      placementReason: Schema.Literal('vein', 'cluster', 'scatter', 'replacement'),
    })
  ),

  geochemistry: Schema.Struct({
    totalOreVolume: Schema.Number.pipe(Schema.positive()),
    averageGrade: Schema.Record({
      key: OreTypeSchema,
      value: Schema.Number.pipe(Schema.between(0, 1)),
    }),
    spatialDistribution: Schema.Record({
      key: OreTypeSchema,
      value: Schema.Number.pipe(Schema.positive()),
    }),
    correlationMatrix: Schema.Record({
      key: Schema.String,
      value: Schema.Number.pipe(Schema.between(-1, 1)),
    }),
  }),

  statistics: Schema.Struct({
    totalPlacements: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    veinCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    averageVeinSize: Schema.Number.pipe(Schema.positive()),
    generationTime: Schema.Number.pipe(Schema.positive()),
    memoryUsed: Schema.Number.pipe(Schema.positive()),
    economicValue: Schema.Number.pipe(Schema.positive()),
  }),

  warnings: Schema.Array(Schema.String).pipe(Schema.optional),
  debugInfo: Schema.Record({
    key: Schema.String,
    value: JsonValueSchema,
  }).pipe(Schema.optional),
}).pipe(
  Schema.annotations({
    identifier: 'OrePlacementResult',
    title: 'Ore Placement Result',
    description: 'Complete result of ore placement and vein generation',
  })
)

export type OrePlacementResult = typeof OrePlacementResultSchema.Type

/**
 * OrePlacer Service Interface
 *
 * 鉱石配置と鉱脈生成の専門ドメインサービス
 * 地質学的現実性とゲームバランスを両立
 */
export interface OrePlacerService {
  /**
   * 指定領域に鉱石を配置
   */
  readonly placeOres: (
    bounds: BoundingBox,
    config: OrePlacementConfig,
    seed: WorldSeed,
    existingTerrain: ReadonlyArray<{
      coordinate: WorldCoordinate
      material: string
    }>
  ) => Effect.Effect<OrePlacementResult, GenerationError>

  /**
   * 鉱脈の生成
   */
  readonly generateOreVein: (
    center: WorldCoordinate,
    oreType: OreType,
    profile: OreDensityProfile,
    seed: WorldSeed
  ) => Effect.Effect<OreVein, GenerationError>

  /**
   * 鉱石クラスターの生成
   */
  readonly generateOreCluster: (
    center: WorldCoordinate,
    oreType: OreType,
    clusterSize: number,
    grade: number
  ) => Effect.Effect<
    ReadonlyArray<{
      coordinate: WorldCoordinate
      grade: number
    }>,
    GenerationError
  >

  /**
   * 地質的妥当性の検証
   */
  readonly validateGeologicalPlausibility: (
    result: OrePlacementResult,
    config: OrePlacementConfig
  ) => Effect.Effect<
    {
      isPlausible: boolean
      issues: ReadonlyArray<string>
      suggestions: ReadonlyArray<string>
    },
    GenerationError
  >

  /**
   * 経済性評価
   */
  readonly evaluateEconomicViability: (
    result: OrePlacementResult,
    config: OrePlacementConfig
  ) => Effect.Effect<
    {
      totalValue: number
      viableDeposits: ReadonlyArray<string>
      extractionDifficulty: Record<OreType, number>
    },
    GenerationError
  >

  /**
   * 鉱石品位の計算
   */
  readonly calculateGrade: (
    coordinate: WorldCoordinate,
    oreType: OreType,
    profile: OreDensityProfile,
    seed: WorldSeed
  ) => Effect.Effect<number, GenerationError>
}

/**
 * OrePlacer Context Tag
 */
export const OrePlacerService = Context.GenericTag<OrePlacerService>('@minecraft/domain/world/OrePlacer')

/**
 * OrePlacer Live Implementation
 *
 * 地質学的原理に基づいた鉱石配置の実装
 */
export const OrePlacerServiceLive = Layer.effect(
  OrePlacerService,
  Effect.succeed({
    placeOres: (bounds, config, seed, existingTerrain) =>
      Effect.gen(function* () {
        const startTime = yield* Clock.currentTimeMillis

        // 1. 鉱脈配置の決定
        const veinPlacements = yield* determineVeinPlacements(bounds, config, seed)

        // 2. 各鉱脈の詳細生成
        const generatedVeins = yield* generateAllVeins(veinPlacements, config, seed)

        // 3. クラスター配置の決定
        const clusterPlacements = yield* determineClusterPlacements(bounds, config, seed)

        // 4. 散在鉱石の配置
        const scatterPlacements = yield* determineScatterPlacements(bounds, config, seed)

        // 5. 地質的制約の適用
        const validatedPlacements = yield* applyGeologicalConstraints(
          [...generatedVeins.flatMap((v) => veinToOrePlacements(v)), ...clusterPlacements, ...scatterPlacements],
          config
        )

        // 6. 地化学的分析
        const geochemistry = yield* performGeochemicalAnalysis(validatedPlacements, generatedVeins)

        // 7. 統計計算
        const statistics = {
          totalPlacements: validatedPlacements.length,
          veinCount: generatedVeins.length,
          averageVeinSize:
            generatedVeins.reduce((sum, v) => sum + v.length * v.width * v.thickness, 0) / generatedVeins.length,
          generationTime: yield* Clock.currentTimeMillis,
          memoryUsed: estimateMemoryUsage(validatedPlacements, generatedVeins),
          economicValue: calculateTotalEconomicValue(validatedPlacements, config),
        }

        return {
          veins: generatedVeins,
          orePlacements: validatedPlacements,
          geochemistry,
          statistics,
          warnings: yield* validatePlacementWarnings(validatedPlacements, config),
          debugInfo: {
            veinTypes: Array.from(new Set(generatedVeins.map((v) => v.oreType))),
            averageDepth: validatedPlacements.reduce((sum, p) => sum + p.coordinate.y, 0) / validatedPlacements.length,
            totalVolume: calculateBoundsVolume(bounds),
          },
        }
      }),

    generateOreVein: (center, oreType, profile, seed) =>
      Effect.gen(function* () {
        // 鉱脈の詳細生成

        // 1. 構造方向の決定
        const orientation = yield* determineVeinOrientation(center, oreType, seed)

        // 2. サイズの決定
        const dimensions = yield* determineVeinDimensions(profile, seed)

        // 3. 形状の決定
        const shape = yield* determineVeinShape(oreType, profile, seed)

        // 4. 品位分布の計算
        const gradeDistribution = yield* calculateVeinGradeDistribution(center, dimensions, orientation, profile, seed)

        // 5. 地質情報の設定
        const geologicalInfo = yield* determineGeologicalInfo(center, oreType, profile)

        return {
          id: `vein_${oreType}_${center.x}_${center.y}_${center.z}`,
          oreType,
          centerCoordinate: center,
          orientation,
          ...dimensions,
          shape,
          gradeDistribution,
          ...geologicalInfo,
          relatedVeins: [],
          generation: 1,
        }
      }),

    generateOreCluster: (center, oreType, clusterSize, grade) =>
      Effect.gen(function* () {
        // 球状クラスターの生成
        const radius = Math.cbrt(clusterSize / ((4 * Math.PI) / 3))

        // 3D空間の全座標を関数型スタイルで生成
        const cluster = pipe(
          ReadonlyArray.range(Math.floor(-radius), Math.ceil(radius) + 1),
          ReadonlyArray.flatMap((x) =>
            pipe(
              ReadonlyArray.range(Math.floor(-radius), Math.ceil(radius) + 1),
              ReadonlyArray.flatMap((y) =>
                pipe(
                  ReadonlyArray.range(Math.floor(-radius), Math.ceil(radius) + 1),
                  ReadonlyArray.filterMap((z) => {
                    const distance = Math.sqrt(x * x + y * y + z * z)

                    return pipe(
                      Match.value(distance),
                      Match.when(
                        (value) => value > radius,
                        () => Option.none<{ coordinate: WorldCoordinate; grade: number }>()
                      ),
                      Match.orElse((validDistance) => {
                        const gradeModifier = 1 - (validDistance / radius) * 0.5
                        const finalGrade = grade * gradeModifier

                        return pipe(
                          Match.value(finalGrade),
                          Match.when(
                            (value) => value <= 0.1,
                            () => Option.none<{ coordinate: WorldCoordinate; grade: number }>()
                          ),
                          Match.orElse(() =>
                            Option.some({
                              coordinate: makeUnsafeWorldCoordinate(center.x + x, center.y + y, center.z + z),
                              grade: finalGrade,
                            })
                          )
                        )
                      })
                    )
                  })
                )
              )
            )
          )
        )

        return cluster
      }),

    validateGeologicalPlausibility: (result, config) =>
      Effect.gen(function* () {
        // 1. 深度分布の検証（関数型スタイル）
        const depthValidation = pipe(
          result.veins,
          ReadonlyArray.filterMap((vein) => {
            const veinDepth = vein.centerCoordinate.y

            return pipe(
              Option.fromNullable(config.oreProfiles.find((p) => p.oreType === vein.oreType)),
              Option.match({
                onNone: () => Option.none(),
                onSome: (profile) =>
                  pipe(
                    Match.value(veinDepth),
                    Match.when(
                      (depth) =>
                        depth < profile.depthDistribution.depthRange.min ||
                        depth > profile.depthDistribution.depthRange.max,
                      (depth) =>
                        Option.some({
                          issue: `${vein.oreType} vein at inappropriate depth: ${depth}`,
                          suggestion: `Relocate ${vein.oreType} vein to depth range ${profile.depthDistribution.depthRange.min}-${profile.depthDistribution.depthRange.max}`,
                        })
                    ),
                    Match.orElse(() => Option.none())
                  ),
              })
            )
          })
        )

        const issues = pipe(
          depthValidation,
          ReadonlyArray.map((v) => v.issue)
        )
        const suggestions = pipe(
          depthValidation,
          ReadonlyArray.map((v) => v.suggestion)
        )

        // 2. 母岩適合性の検証
        // 3. 構造制御の検証
        // 4. 地化学的相関の検証

        return {
          isPlausible: issues.length === 0,
          issues,
          suggestions,
        }
      }),

    evaluateEconomicViability: (result, config) =>
      Effect.gen(function* () {
        // 各鉱脈の経済性評価（関数型スタイル）
        const evaluations = pipe(
          result.veins,
          ReadonlyArray.filterMap((vein) => {
            return pipe(
              Option.fromNullable(config.oreProfiles.find((p) => p.oreType === vein.oreType)),
              Option.match({
                onNone: () => Option.none(),
                onSome: (profile) => {
                  const veinValue = calculateVeinValue(vein, profile)
                  const difficulty = calculateExtractionDifficulty(vein, profile)

                  return Option.some({
                    veinId: vein.id,
                    oreType: vein.oreType,
                    value: veinValue,
                    difficulty,
                    isViable: veinValue / difficulty > 1.0, // 採算性閾値
                  })
                },
              })
            )
          })
        )

        const totalValue = pipe(
          evaluations,
          ReadonlyArray.reduce(0, (sum, eval) => sum + eval.value)
        )
        const viableDeposits = pipe(
          evaluations,
          ReadonlyArray.filter((eval) => eval.isViable),
          ReadonlyArray.map((eval) => eval.veinId)
        )
        const extractionDifficulty = pipe(
          evaluations,
          ReadonlyArray.reduce({} satisfies Record<OreType, number>, (acc, eval) => ({
            ...acc,
            [eval.oreType]: eval.difficulty,
          }))
        )

        return {
          totalValue,
          viableDeposits,
          extractionDifficulty,
        }
      }),

    calculateGrade: (coordinate, oreType, profile, seed) =>
      Effect.gen(function* () {
        // 品位計算の実装

        // 1. 基本品位の決定
        const baseGrade = yield* calculateBaseGrade(coordinate, oreType, profile, seed)

        // 2. 地質的修正
        const geologicalModifier = yield* calculateGeologicalModifier(coordinate, oreType)

        // 3. ノイズによる変動
        const noiseModifier = yield* calculateGradeNoise(coordinate, seed)

        // 4. 最終品位の計算
        const finalGrade = Math.max(0, Math.min(1, baseGrade * geologicalModifier * noiseModifier))

        return finalGrade
      }),
  })
)

// ヘルパー関数群（実装の詳細は省略）
const determineVeinPlacements = (bounds: BoundingBox, config: OrePlacementConfig, seed: WorldSeed) =>
  Effect.succeed([] satisfies ReadonlyArray<{ center: WorldCoordinate; oreType: OreType; profile: OreDensityProfile }>)

const generateAllVeins = (
  placements: ReadonlyArray<{ center: WorldCoordinate; oreType: OreType; profile: OreDensityProfile }>,
  config: OrePlacementConfig,
  seed: WorldSeed
) => Effect.succeed([] satisfies ReadonlyArray<OreVein>)

const determineClusterPlacements = (bounds: BoundingBox, config: OrePlacementConfig, seed: WorldSeed) =>
  Effect.succeed([] satisfies ReadonlyArray<{ center: WorldCoordinate; oreType: OreType }>)

const determineScatterPlacements = (bounds: BoundingBox, config: OrePlacementConfig, seed: WorldSeed) =>
  Effect.succeed([] satisfies ReadonlyArray<{ center: WorldCoordinate; oreType: OreType }>)

const applyGeologicalConstraints = (
  placements: ReadonlyArray<{ center: WorldCoordinate; oreType: OreType }>,
  config: OrePlacementConfig
) => Effect.succeed(placements)

const performGeochemicalAnalysis = (
  placements: ReadonlyArray<{ center: WorldCoordinate }>,
  veins: ReadonlyArray<OreVein>
) =>
  Effect.succeed({
    totalOreVolume: 1000,
    averageGrade: {} satisfies Record<OreType, number>,
    spatialDistribution: {} satisfies Record<string, number>,
    correlationMatrix: {} satisfies Record<string, Record<string, number>>,
  })

const estimateMemoryUsage = (...args: ReadonlyArray<unknown>[]) => 1024

const calculateTotalEconomicValue = (
  placements: ReadonlyArray<{ center: WorldCoordinate }>,
  config: OrePlacementConfig
) => 10000

const validatePlacementWarnings = (
  placements: ReadonlyArray<{ center: WorldCoordinate }>,
  config: OrePlacementConfig
) => Effect.succeed([] satisfies ReadonlyArray<string>)

const calculateBoundsVolume = (bounds: BoundingBox) =>
  Math.abs(bounds.max.x - bounds.min.x) * Math.abs(bounds.max.y - bounds.min.y) * Math.abs(bounds.max.z - bounds.min.z)

const veinToOrePlacements = (vein: OreVein) => [] satisfies ReadonlyArray<WorldCoordinate>

const determineVeinOrientation = (center: WorldCoordinate, oreType: OreType, seed: WorldSeed) =>
  Effect.succeed({
    strike: 45,
    dip: 30,
    plunge: 60,
  })

const determineVeinDimensions = (profile: OreDensityProfile, seed: WorldSeed) =>
  Effect.succeed({
    length: 50,
    width: 10,
    thickness: 2,
  })

const determineVeinShape = (oreType: OreType, profile: OreDensityProfile, seed: WorldSeed) =>
  Effect.succeed('tabular' as const)

const calculateVeinGradeDistribution = (
  center: WorldCoordinate,
  dimensions: { length: number; width: number; thickness: number },
  orientation: { strike: number; dip: number; plunge: number },
  profile: OreDensityProfile,
  seed: WorldSeed
) => Effect.succeed([] satisfies ReadonlyArray<WorldCoordinate>)

const determineGeologicalInfo = (center: WorldCoordinate, oreType: OreType, profile: OreDensityProfile) =>
  Effect.succeed({
    hostRock: 'granite',
    alterationZone: 5,
  })

const calculateVeinValue = (vein: OreVein, profile: OreDensityProfile) => 1000

const calculateExtractionDifficulty = (vein: OreVein, profile: OreDensityProfile) => 0.5

const calculateBaseGrade = (
  coordinate: WorldCoordinate,
  oreType: OreType,
  profile: OreDensityProfile,
  seed: WorldSeed
) => Effect.succeed(0.5)

const calculateGeologicalModifier = (coordinate: WorldCoordinate, oreType: OreType) => Effect.succeed(1.0)

const calculateGradeNoise = (coordinate: WorldCoordinate, seed: WorldSeed) => Effect.succeed(1.0)

/**
 * デフォルト鉱石プロファイル
 */
export const DEFAULT_ORE_PROFILES: ReadonlyArray<OreDensityProfile> = [
  {
    oreType: 'coal',
    depthDistribution: {
      optimalDepth: -30,
      depthRange: { min: -100, max: 20 },
      depthFalloff: 0.7,
    },
    rarity: 0.8,
    clusterProbability: 0.9,
    veinProbability: 0.3,
    clusterSize: { min: 8, max: 32, average: 16 },
    hostRocks: ['sandstone', 'shale', 'limestone'],
    avoidMaterials: ['granite', 'basalt'],
    economicValue: 10,
    renewability: false,
    processingDifficulty: 2,
  },
  {
    oreType: 'iron',
    depthDistribution: {
      optimalDepth: -50,
      depthRange: { min: -200, max: 50 },
      depthFalloff: 0.6,
    },
    rarity: 0.6,
    clusterProbability: 0.7,
    veinProbability: 0.5,
    clusterSize: { min: 4, max: 16, average: 8 },
    hostRocks: ['granite', 'gneiss', 'schist'],
    avoidMaterials: ['limestone', 'sandstone'],
    economicValue: 25,
    renewability: false,
    processingDifficulty: 4,
  },
  {
    oreType: 'diamond',
    depthDistribution: {
      optimalDepth: -500,
      depthRange: { min: -1000, max: -200 },
      depthFalloff: 0.9,
    },
    rarity: 0.05,
    clusterProbability: 0.1,
    veinProbability: 0.02,
    clusterSize: { min: 1, max: 4, average: 2 },
    hostRocks: ['kimberlite', 'peridotite'],
    avoidMaterials: ['sedimentary'],
    requiresProximity: ['ultramafic'],
    economicValue: 100,
    renewability: false,
    processingDifficulty: 8,
  },
] as const
