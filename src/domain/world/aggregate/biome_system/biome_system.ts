/**
 * @fileoverview BiomeSystem Aggregate Root - バイオームシステム管理
 *
 * ワールド全体のバイオーム配置・遷移・管理を行う集約ルートです。
 * - バイオーム配置の最適化
 * - 気候モデルの統合管理
 * - バイオーム間遷移の制御
 * - 生態系シミュレーション
 */

import { Context, Effect, Schema, STM } from 'effect'
import * as Coordinates from '@domain/world/value_object/coordinates/index.js'
import type * as GenerationErrors from '@domain/world/types/errors/generation_errors.js'
import * as BiomeRegistry from './biome_registry.js'
import * as BiomeTransitions from './biome_transitions.js'
import * as ClimateModel from './climate_model.js'
import * as BiomeEvents from './events.js'
import {
  BiomeDistributionSchema,
  BiomeSystemConfigurationSchema,
  BiomeSystemSchema,
  BiomeSystemIdSchema,
  createBiomeSystemId,
  type BiomeDistribution,
  type BiomeSystem,
  type BiomeSystemConfiguration,
  type BiomeSystemId,
} from './shared.js'

// ================================
// Commands
// ================================

export const GenerateBiomeDistributionCommandSchema = Schema.Struct({
  coordinate: Coordinates.ChunkCoordinateSchema,
  options: Schema.optional(
    Schema.Struct({
      forceRegeneration: Schema.Boolean,
      useDetailedAnalysis: Schema.Boolean,
      considerNeighbors: Schema.Boolean,
      applySmoothing: Schema.Boolean,
    })
  ),
})

export type GenerateBiomeDistributionCommand = typeof GenerateBiomeDistributionCommandSchema.Type

export const UpdateClimateModelCommandSchema = Schema.Struct({
  globalFactors: Schema.optional(
    Schema.Struct({
      temperatureShift: Schema.Number.pipe(Schema.between(-10, 10)),
      humidityShift: Schema.Number.pipe(Schema.between(-20, 20)),
      seasonalIntensityChange: Schema.Number.pipe(Schema.between(-0.5, 0.5)),
    })
  ),
  regionalFactors: Schema.optional(
    Schema.Array(
      Schema.Struct({
        region: Schema.Struct({
          centerX: Schema.Number,
          centerZ: Schema.Number,
          radius: Schema.Number.pipe(Schema.greaterThan(0)),
        }),
        climateModifiers: Schema.Struct({
          temperatureModifier: Schema.Number.pipe(Schema.between(-20, 20)),
          humidityModifier: Schema.Number.pipe(Schema.between(-50, 50)),
          elevationModifier: Schema.Number.pipe(Schema.between(-200, 200)),
        }),
      })
    )
  ),
})

export type UpdateClimateModelCommand = typeof UpdateClimateModelCommandSchema.Type

// ================================
// Aggregate Operations
// ================================

/**
 * BiomeSystem作成
 */
export const create = (
  id: BiomeSystemId,
  worldSeed: WorldSeed.WorldSeed,
  configuration?: Partial<BiomeSystemConfiguration>
): Effect.Effect<BiomeSystem, GenerationErrors.CreationError> =>
  Effect.gen(function* () {
    const now = yield* Effect.sync(() => new Date())

    // デフォルト設定
    const defaultConfig: BiomeSystemConfiguration = {
      globalClimateSettings: {
        baseTemperature: 15, // 15°C
        temperatureVariation: 30,
        humidityBase: 50,
        humidityVariation: 40,
        enableSeasonalCycles: true,
        seasonalIntensity: 0.3,
      },
      transitionSettings: {
        enableSmoothTransitions: true,
        transitionZoneWidth: 3,
        allowSharpBoundaries: false,
        biomeStabilityFactor: 0.7,
      },
      distributionSettings: {
        biomeScarcity: {
          desert: 0.15,
          jungle: 0.1,
          ice_plains: 0.08,
          mushroom_island: 0.02,
        },
        clusteringIntensity: 0.6,
        diversityTarget: 0.4,
        continentalScale: true,
      },
      optimizationSettings: {
        enableDynamicOptimization: true,
        recomputeInterval: 100,
        cacheSize: 1000,
        precomputeRadius: 8,
      },
    }

    const mergedConfig: BiomeSystemConfiguration = {
      ...defaultConfig,
      ...configuration,
    }

    // レジストリとモデルの初期化
    const registry = yield* BiomeRegistry.createDefault()
    const climateModel = yield* ClimateModel.create(worldSeed, mergedConfig.globalClimateSettings)
    const transitionRules = yield* BiomeTransitions.createDefaultRules()

    const biomeSystem: BiomeSystem = {
      id,
      worldSeed,
      configuration: mergedConfig,
      registry,
      climateModel,
      distributionCache: {},
      transitionRules,
      version: 0,
      statistics: {
        totalBiomesRegistered: registry.biomes.length,
        cachedDistributions: 0,
        transitionRulesCount: transitionRules.length,
        averageGenerationTime: 0,
      },
      createdAt: now,
      updatedAt: now,
    }

    // 作成イベント発行
    yield* BiomeEvents.publish(BiomeEvents.createBiomeSystemCreated(id, worldSeed, mergedConfig))

    return biomeSystem
  })

/**
 * バイオーム分布生成
 */
export const generateBiomeDistribution = (
  system: BiomeSystem,
  command: GenerateBiomeDistributionCommand
): STM.STM<[BiomeSystem, BiomeDistribution], GenerationErrors.GenerationError> =>
  STM.gen(function* () {
    const startTime = yield* STM.fromEffect(Effect.sync(() => Date.now()))
    const coordinateKey = coordinateToKey(command.coordinate)

    // キャッシュチェック
    const cached = system.distributionCache[coordinateKey]
    if (cached && !command.options?.forceRegeneration) {
      return [system, cached]
    }

    // 気候因子計算
    const climateFactors = yield* STM.fromEffect(
      ClimateModel.calculateClimateFactors(system.climateModel, command.coordinate)
    )

    // バイオーム選択
    const biomeSelection = yield* STM.fromEffect(selectOptimalBiomes(system.registry, climateFactors, command.options))

    // 遷移ゾーン計算
    const transitionZones = yield* STM.fromEffect(
      calculateTransitionZones(system, command.coordinate, biomeSelection.dominantBiome, command.options)
    )

    const distribution: BiomeDistribution = {
      chunkCoordinate: command.coordinate,
      dominantBiome: biomeSelection.dominantBiome,
      biomeDistribution: biomeSelection.distribution,
      transitionZones,
      climateFactors,
      lastUpdated: new Date(),
    }

    // キャッシュ更新
    const updatedCache = {
      ...system.distributionCache,
      [coordinateKey]: distribution,
    }

    // 統計更新
    const endTime = yield* STM.fromEffect(Effect.sync(() => Date.now()))
    const generationTime = endTime - startTime
    const newAverageTime = updateAverageGenerationTime(
      system.statistics.averageGenerationTime,
      generationTime,
      system.statistics.cachedDistributions + 1
    )

    const updatedSystem: BiomeSystem = {
      ...system,
      distributionCache: updatedCache,
      version: system.version + 1,
      statistics: {
        ...system.statistics,
        cachedDistributions: system.statistics.cachedDistributions + 1,
        averageGenerationTime: newAverageTime,
      },
      updatedAt: new Date(),
    }

    // 生成イベント発行
    yield* STM.fromEffect(
      BiomeEvents.publish(BiomeEvents.createBiomeDistributionGenerated(system.id, command.coordinate, distribution))
    )

    return [updatedSystem, distribution]
  })

/**
 * 気候モデル更新
 */
export const updateClimateModel = (
  system: BiomeSystem,
  command: UpdateClimateModelCommand
): Effect.Effect<BiomeSystem, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // 気候モデルの更新
    const updatedModel = yield* ClimateModel.update(system.climateModel, command.globalFactors, command.regionalFactors)

    // 影響を受けるキャッシュをクリア
    const affectedKeys = yield* calculateAffectedCacheKeys(system, command)
    const cleanedCache = yield* clearCacheEntries(system.distributionCache, affectedKeys)

    const updatedSystem: BiomeSystem = {
      ...system,
      climateModel: updatedModel,
      distributionCache: cleanedCache,
      version: system.version + 1,
      statistics: {
        ...system.statistics,
        cachedDistributions: Object.keys(cleanedCache).length,
      },
      updatedAt: new Date(),
    }

    // 更新イベント発行
    yield* BiomeEvents.publish(BiomeEvents.createClimateModelUpdated(system.id, command))

    return updatedSystem
  })

/**
 * バイオーム遷移ルール追加
 */
export const addTransitionRule = (
  system: BiomeSystem,
  rule: BiomeTransitions.TransitionRule
): Effect.Effect<BiomeSystem, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // ルールの検証
    yield* BiomeTransitions.validateRule(rule, system.registry)

    // 既存ルールとの競合チェック
    yield* checkRuleConflicts(system.transitionRules, rule)

    const updatedRules = [...system.transitionRules, rule]

    const updatedSystem: BiomeSystem = {
      ...system,
      transitionRules: updatedRules,
      version: system.version + 1,
      statistics: {
        ...system.statistics,
        transitionRulesCount: updatedRules.length,
      },
      updatedAt: new Date(),
    }

    return updatedSystem
  })

/**
 * 最適化実行
 */
export const optimize = (system: BiomeSystem): Effect.Effect<BiomeSystem, GenerationErrors.OptimizationError> =>
  Effect.gen(function* () {
    if (!system.configuration.optimizationSettings.enableDynamicOptimization) {
      return system
    }

    const now = yield* Effect.sync(() => new Date())

    // キャッシュサイズ最適化
    const optimizedCache = yield* optimizeCache(
      system.distributionCache,
      system.configuration.optimizationSettings.cacheSize
    )

    // 遷移ルールの最適化
    const optimizedRules = yield* BiomeTransitions.optimizeRules(system.transitionRules)

    const updatedSystem: BiomeSystem = {
      ...system,
      distributionCache: optimizedCache,
      transitionRules: optimizedRules,
      version: system.version + 1,
      statistics: {
        ...system.statistics,
        cachedDistributions: Object.keys(optimizedCache).length,
        transitionRulesCount: optimizedRules.length,
        lastOptimization: now,
      },
      updatedAt: now,
    }

    return updatedSystem
  })

// ================================
// Helper Functions
// ================================

/**
 * 座標をキー文字列に変換
 */
const coordinateToKey = (coordinate: Coordinates.ChunkCoordinate): string => `${coordinate.x},${coordinate.z}`

/**
 * 最適なバイオーム選択
 */
const selectOptimalBiomes = (
  registry: BiomeRegistry.BiomeRegistry,
  climateFactors: BiomeDistribution['climateFactors'],
  options?: GenerateBiomeDistributionCommand['options']
): Effect.Effect<
  {
    dominantBiome: string
    distribution: Record<string, number>
  },
  GenerationErrors.GenerationError
> =>
  Effect.gen(function* () {
    // 気候適合性による候補選択
    const candidates = yield* BiomeRegistry.findCompatibleBiomes(registry, climateFactors)

    if (candidates.length === 0) {
      return yield* Effect.fail(
        GenerationErrors.createGenerationError('No compatible biomes found for climate conditions')
      )
    }

    // 詳細分析が有効な場合の追加計算
    const detailedCandidates = options?.useDetailedAnalysis
      ? yield* performDetailedBiomeAnalysis(candidates, climateFactors)
      : candidates

    // 支配的バイオームの選択
    const dominantBiome = selectDominantBiome(detailedCandidates)

    // 分布計算
    const distribution = calculateBiomeDistribution(detailedCandidates, dominantBiome)

    return {
      dominantBiome,
      distribution,
    }
  })

/**
 * 遷移ゾーン計算
 */
const calculateTransitionZones = (
  system: BiomeSystem,
  coordinate: Coordinates.ChunkCoordinate,
  dominantBiome: string,
  options?: GenerateBiomeDistributionCommand['options']
): Effect.Effect<BiomeDistribution['transitionZones'], GenerationErrors.GenerationError> =>
  Effect.gen(function* () {
    if (!options?.considerNeighbors) {
      return []
    }

    // 隣接チャンクの情報を取得
    const neighborBiomes = yield* getNeighborBiomes(system, coordinate)

    // 遷移ルールの適用
    const transitions = yield* BiomeTransitions.calculateTransitions(
      system.transitionRules,
      dominantBiome,
      neighborBiomes,
      system.configuration.transitionSettings
    )

    return transitions
  })

/**
 * 詳細バイオーム分析
 */
const performDetailedBiomeAnalysis = (
  candidates: readonly string[],
  climateFactors: BiomeDistribution['climateFactors']
): Effect.Effect<readonly string[], never> => Effect.succeed(candidates) // プレースホルダー実装

/**
 * 支配的バイオーム選択
 */
const selectDominantBiome = (candidates: readonly string[]): string => candidates[0] || 'plains' // 簡易実装

/**
 * バイオーム分布計算
 */
const calculateBiomeDistribution = (candidates: readonly string[], dominantBiome: string): Record<string, number> => {
  const distribution: Record<string, number> = {}

  if (candidates.length === 1) {
    distribution[dominantBiome] = 1.0
  } else {
    distribution[dominantBiome] = 0.7
    const remaining = 0.3 / (candidates.length - 1)
    for (const biome of candidates) {
      if (biome !== dominantBiome) {
        distribution[biome] = remaining
      }
    }
  }

  return distribution
}

/**
 * 隣接バイオーム取得
 */
const getNeighborBiomes = (
  system: BiomeSystem,
  coordinate: Coordinates.ChunkCoordinate
): Effect.Effect<readonly string[], never> => Effect.succeed(['plains']) // プレースホルダー実装

/**
 * 平均生成時間更新
 */
const updateAverageGenerationTime = (currentAverage: number, newTime: number, sampleCount: number): number => {
  return (currentAverage * (sampleCount - 1) + newTime) / sampleCount
}

/**
 * 影響を受けるキャッシュキー計算
 */
const calculateAffectedCacheKeys = (
  system: BiomeSystem,
  command: UpdateClimateModelCommand
): Effect.Effect<readonly string[], never> => Effect.succeed(Object.keys(system.distributionCache)) // 簡易実装：全キャッシュクリア

/**
 * キャッシュエントリクリア
 */
const clearCacheEntries = (
  cache: Record<string, BiomeDistribution>,
  keysToRemove: readonly string[]
): Effect.Effect<Record<string, BiomeDistribution>, never> =>
  Effect.sync(() => {
    const newCache = { ...cache }
    for (const key of keysToRemove) {
      delete newCache[key]
    }
    return newCache
  })

/**
 * ルール競合チェック
 */
const checkRuleConflicts = (
  existingRules: readonly BiomeTransitions.TransitionRule[],
  newRule: BiomeTransitions.TransitionRule
): Effect.Effect<void, GenerationErrors.ValidationError> => Effect.succeed(void 0) // プレースホルダー実装

/**
 * キャッシュ最適化
 */
const optimizeCache = (
  cache: Record<string, BiomeDistribution>,
  maxSize: number
): Effect.Effect<Record<string, BiomeDistribution>, never> =>
  Effect.sync(() => {
    const entries = Object.entries(cache)
    if (entries.length <= maxSize) {
      return cache
    }

    // LRU風の削除（最後更新時刻でソート）
    const sortedEntries = entries.sort((a, b) => b[1].lastUpdated.getTime() - a[1].lastUpdated.getTime())

    return Object.fromEntries(sortedEntries.slice(0, maxSize))
  })

// ================================
// Context.GenericTag
// ================================

export const BiomeSystemTag = Context.GenericTag<{
  readonly create: (
    id: BiomeSystemId,
    worldSeed: WorldSeed.WorldSeed,
    configuration?: Partial<BiomeSystemConfiguration>
  ) => Effect.Effect<BiomeSystem, GenerationErrors.CreationError>

  readonly generateBiomeDistribution: (
    system: BiomeSystem,
    command: GenerateBiomeDistributionCommand
  ) => STM.STM<[BiomeSystem, BiomeDistribution], GenerationErrors.GenerationError>

  readonly updateClimateModel: (
    system: BiomeSystem,
    command: UpdateClimateModelCommand
  ) => Effect.Effect<BiomeSystem, GenerationErrors.ValidationError>

  readonly addTransitionRule: (
    system: BiomeSystem,
    rule: BiomeTransitions.TransitionRule
  ) => Effect.Effect<BiomeSystem, GenerationErrors.ValidationError>

  readonly optimize: (system: BiomeSystem) => Effect.Effect<BiomeSystem, GenerationErrors.OptimizationError>
}>('@minecraft/domain/world/aggregate/BiomeSystem')

// ================================
// Service Implementation
// ================================

export const BiomeSystemLive = BiomeSystemTag.of({
  create,
  generateBiomeDistribution,
  updateClimateModel,
  addTransitionRule,
  optimize,
})

// ================================
// Exports
// ================================

export {
  type BiomeDistribution,
  type BiomeSystemConfiguration,
  type GenerateBiomeDistributionCommand,
  type UpdateClimateModelCommand,
}
