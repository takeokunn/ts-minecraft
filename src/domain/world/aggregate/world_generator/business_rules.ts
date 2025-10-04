/**
 * @fileoverview Business Rules - ビジネスルール実装
 *
 * WorldGeneratorのビジネスロジックとドメイン制約を定義します。
 * - 不変条件の強制
 * - 生成制約の検証
 * - パフォーマンス制限の管理
 */

import { Effect } from 'effect'
import type * as GenerationErrors from '../../types/errors/generation_errors.js'
import * as Coordinates from '../../value_object/coordinates/index.js'
import * as WorldSeed from '../../value_object/world_seed/index.js'
import type { GenerationState } from './generation_state.js'
import type {
  GenerateChunkCommand,
  GenerationContext,
  UpdateSettingsCommand,
  WorldGenerator,
} from './world_generator.js'

// ================================
// Business Constants
// ================================

/**
 * 最大同時生成数
 * パフォーマンスとメモリ使用量のバランス
 */
export const MAX_CONCURRENT_GENERATIONS = 8

/**
 * 最大生成試行回数
 * 無限ループ防止
 */
export const MAX_GENERATION_ATTEMPTS = 3

/**
 * 生成タイムアウト (ミリ秒)
 * 無応答防止
 */
export const GENERATION_TIMEOUT_MS = 30000

/**
 * 最大チャンク距離
 * メモリ使用量制限
 */
export const MAX_CHUNK_DISTANCE_FROM_ORIGIN = 30000000 // 3000万 = Minecraft仕様

/**
 * 最小生成優先度
 */
export const MIN_GENERATION_PRIORITY = 1

/**
 * 最大生成優先度
 */
export const MAX_GENERATION_PRIORITY = 10

// ================================
// Context Validation Rules
// ================================

/**
 * 生成コンテキスト作成時の検証
 */
export const validateCreationContext = (
  context: GenerationContext
): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // シード値の検証
    yield* validateSeedIntegrity(context.seed)

    // パラメータの整合性検証
    yield* validateParameterConsistency(context)

    // リソース制限の検証
    yield* validateResourceLimits(context)

    // 物理法則の検証
    yield* validatePhysicalConstraints(context)
  })

/**
 * シード値の整合性検証
 */
const validateSeedIntegrity = (seed: WorldSeed.WorldSeed): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // シード値の有効性確認
    if (!WorldSeed.isValid(seed)) {
      return yield* Effect.fail(GenerationErrors.createValidationError('Invalid world seed value'))
    }

    // エントロピーの確認
    const entropy = WorldSeed.calculateEntropy(seed)
    if (entropy < 0.5) {
      return yield* Effect.fail(
        GenerationErrors.createValidationError('Insufficient seed entropy for quality generation')
      )
    }
  })

/**
 * パラメータ整合性の検証
 */
const validateParameterConsistency = (
  context: GenerationContext
): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    const { parameters, biomeConfig, noiseConfig } = context

    // 地形高度の整合性
    if (parameters.terrain.minHeight >= parameters.terrain.maxHeight) {
      return yield* Effect.fail(
        GenerationErrors.createValidationError('Terrain min height must be less than max height')
      )
    }

    // バイオーム温度範囲の妥当性
    for (const [biomeId, tempRange] of Object.entries(biomeConfig.temperatureRanges)) {
      if (tempRange.min >= tempRange.max) {
        return yield* Effect.fail(
          GenerationErrors.createValidationError(`Invalid temperature range for biome ${biomeId}`)
        )
      }
    }

    // ノイズスケールの妥当性
    if (noiseConfig.baseSettings.scale <= 0 || noiseConfig.baseSettings.scale > 1000) {
      return yield* Effect.fail(GenerationErrors.createValidationError('Noise scale must be between 0 and 1000'))
    }

    // 構造物密度の総和チェック
    const totalDensity = Object.values(parameters.structures.density).reduce((sum, density) => sum + density, 0)

    if (totalDensity > 1.0) {
      return yield* Effect.fail(GenerationErrors.createValidationError('Total structure density cannot exceed 1.0'))
    }
  })

/**
 * リソース制限の検証
 */
const validateResourceLimits = (context: GenerationContext): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    const { parameters } = context

    // チャンク生成負荷の見積もり
    const estimatedLoad = estimateGenerationLoad(parameters)
    if (estimatedLoad > 100) {
      // 任意の上限値
      return yield* Effect.fail(
        GenerationErrors.createValidationError('Generation parameters would exceed system capacity')
      )
    }

    // メモリ使用量の見積もり
    const estimatedMemory = estimateMemoryUsage(parameters)
    if (estimatedMemory > 1024 * 1024 * 1024) {
      // 1GB上限
      return yield* Effect.fail(
        GenerationErrors.createValidationError('Generation parameters would exceed memory limits')
      )
    }
  })

/**
 * 物理制約の検証
 */
const validatePhysicalConstraints = (
  context: GenerationContext
): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    const { parameters, biomeConfig } = context

    // 重力と地形の関係
    if (parameters.physics.gravity <= 0) {
      return yield* Effect.fail(GenerationErrors.createValidationError('Gravity must be positive'))
    }

    // 水位と地形の関係
    const seaLevel = parameters.terrain.seaLevel
    if (seaLevel < parameters.terrain.minHeight || seaLevel > parameters.terrain.maxHeight) {
      return yield* Effect.fail(GenerationErrors.createValidationError('Sea level must be within terrain height range'))
    }

    // 気候モデルの物理的妥当性
    for (const climate of Object.values(biomeConfig.climateData)) {
      if (climate.temperature < -50 || climate.temperature > 60) {
        return yield* Effect.fail(
          GenerationErrors.createValidationError('Temperature values must be within realistic range (-50°C to 60°C)')
        )
      }

      if (climate.humidity < 0 || climate.humidity > 100) {
        return yield* Effect.fail(GenerationErrors.createValidationError('Humidity values must be between 0% and 100%'))
      }
    }
  })

// ================================
// Generation Request Validation
// ================================

/**
 * チャンク生成要求の検証
 */
export const validateChunkGenerationRequest = (
  generator: WorldGenerator,
  command: GenerateChunkCommand
): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // 座標の妥当性
    yield* validateChunkCoordinate(command.coordinate)

    // 優先度の妥当性
    yield* validatePriority(command.priority)

    // 生成オプションの妥当性
    if (command.options) {
      yield* validateGenerationOptions(generator, command.options)
    }

    // ジェネレータ状態の確認
    yield* validateGeneratorState(generator)
  })

/**
 * チャンク座標の検証
 */
const validateChunkCoordinate = (
  coordinate: Coordinates.ChunkCoordinate
): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // 座標範囲の確認
    if (
      Math.abs(coordinate.x) > MAX_CHUNK_DISTANCE_FROM_ORIGIN ||
      Math.abs(coordinate.z) > MAX_CHUNK_DISTANCE_FROM_ORIGIN
    ) {
      return yield* Effect.fail(
        GenerationErrors.createValidationError(
          `Chunk coordinate (${coordinate.x}, ${coordinate.z}) exceeds maximum distance`
        )
      )
    }

    // 座標の整数性確認 (念のため)
    if (!Number.isInteger(coordinate.x) || !Number.isInteger(coordinate.z)) {
      return yield* Effect.fail(GenerationErrors.createValidationError('Chunk coordinates must be integers'))
    }
  })

/**
 * 優先度の検証
 */
const validatePriority = (priority: number): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    if (priority < MIN_GENERATION_PRIORITY || priority > MAX_GENERATION_PRIORITY) {
      return yield* Effect.fail(
        GenerationErrors.createValidationError(
          `Priority must be between ${MIN_GENERATION_PRIORITY} and ${MAX_GENERATION_PRIORITY}`
        )
      )
    }

    if (!Number.isInteger(priority)) {
      return yield* Effect.fail(GenerationErrors.createValidationError('Priority must be an integer'))
    }
  })

/**
 * 生成オプションの検証
 */
const validateGenerationOptions = (
  generator: WorldGenerator,
  options: NonNullable<GenerateChunkCommand['options']>
): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // フラットワールドでは洞窟生成を無効化
    if (generator.context.metadata.worldType === 'flat' && options.includeCaves) {
      return yield* Effect.fail(GenerationErrors.createValidationError('Flat worlds cannot generate caves'))
    }

    // ピースフル難易度では敵対MOB関連構造物を制限
    if (generator.context.metadata.difficulty === 'peaceful' && options.includeStructures) {
      // より詳細なチェックが必要だが、ここでは簡略化
    }
  })

/**
 * ジェネレータ状態の検証
 */
const validateGeneratorState = (generator: WorldGenerator): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // 同時生成数の確認
    if (generator.state.statistics.concurrentGenerations >= MAX_CONCURRENT_GENERATIONS) {
      return yield* Effect.fail(
        GenerationErrors.createValidationError(
          `Maximum concurrent generations (${MAX_CONCURRENT_GENERATIONS}) exceeded`
        )
      )
    }

    // ジェネレータの整合性確認
    yield* validateStructuralIntegrity(generator)
  })

// ================================
// Settings Update Validation
// ================================

/**
 * 設定更新の検証
 */
export const validateSettingsUpdate = (
  generator: WorldGenerator,
  command: UpdateSettingsCommand
): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // アクティブな生成中の更新制限
    if (generator.state.statistics.concurrentGenerations > 0) {
      return yield* Effect.fail(
        GenerationErrors.createValidationError('Cannot update settings while chunk generation is active')
      )
    }

    // 更新内容の検証
    if (command.parameters || command.biomeConfig || command.noiseConfig) {
      const updatedContext = {
        ...generator.context,
        ...(command.parameters && { parameters: command.parameters }),
        ...(command.biomeConfig && { biomeConfig: command.biomeConfig }),
        ...(command.noiseConfig && { noiseConfig: command.noiseConfig }),
      }

      yield* validateParameterConsistency(updatedContext)
    }
  })

// ================================
// Integrity Validation
// ================================

/**
 * 構造的整合性の検証
 */
export const validateStructuralIntegrity = (
  generator: WorldGenerator
): Effect.Effect<void, GenerationErrors.IntegrityError> =>
  Effect.gen(function* () {
    // 必須フィールドの存在確認
    if (!generator.id || !generator.context || !generator.state) {
      return yield* Effect.fail(GenerationErrors.createIntegrityError('Missing required generator fields'))
    }

    // バージョンの整合性
    if (generator.version < 0) {
      return yield* Effect.fail(GenerationErrors.createIntegrityError('Invalid aggregate version'))
    }

    // タイムスタンプの整合性
    if (generator.createdAt > generator.updatedAt) {
      return yield* Effect.fail(
        GenerationErrors.createIntegrityError('Created timestamp cannot be after updated timestamp')
      )
    }
  })

/**
 * データ整合性の検証
 */
export const validateDataIntegrity = (
  generator: WorldGenerator
): Effect.Effect<void, GenerationErrors.IntegrityError> =>
  Effect.gen(function* () {
    // コンテキストデータの整合性
    yield* Effect.catchAll(validateCreationContext(generator.context), (error) =>
      Effect.fail(GenerationErrors.createIntegrityError(`Context integrity violation: ${error.message}`))
    )

    // 統計データの整合性
    const stats = generator.state.statistics
    if (stats.totalChunksGenerated < 0 || stats.failureCount < 0) {
      return yield* Effect.fail(GenerationErrors.createIntegrityError('Invalid statistics values'))
    }

    if (stats.successRate < 0 || stats.successRate > 1) {
      return yield* Effect.fail(GenerationErrors.createIntegrityError('Invalid success rate'))
    }
  })

/**
 * 状態整合性の検証
 */
export const validateStateIntegrity = (state: GenerationState): Effect.Effect<void, GenerationErrors.IntegrityError> =>
  Effect.gen(function* () {
    // アクティブ生成数の整合性
    const activeCount = Object.keys(state.activeGenerations).length
    if (activeCount !== state.statistics.concurrentGenerations) {
      return yield* Effect.fail(
        GenerationErrors.createIntegrityError('Active generations count mismatch between state and statistics')
      )
    }

    // 生成状態の論理的整合性
    for (const [key, info] of Object.entries(state.activeGenerations)) {
      if (info.status === 'completed' || info.status === 'failed') {
        return yield* Effect.fail(
          GenerationErrors.createIntegrityError(`Active generation ${key} has terminal status ${info.status}`)
        )
      }

      if (info.attempts <= 0) {
        return yield* Effect.fail(GenerationErrors.createIntegrityError(`Invalid attempt count for generation ${key}`))
      }
    }
  })

// ================================
// Helper Functions
// ================================

/**
 * 生成負荷の見積もり
 */
const estimateGenerationLoad = (parameters: any): number => {
  // 簡易的な負荷計算
  let load = 0

  // 地形の複雑さ
  const terrainComplexity = parameters.terrain.maxHeight - parameters.terrain.minHeight
  load += (terrainComplexity / 256) * 10

  // 構造物密度
  const structureDensity = Object.values(parameters.structures.density).reduce(
    (sum: number, density: number) => sum + density,
    0
  )
  load += structureDensity * 20

  // バイオーム複雑さ (仮定)
  load += 5

  return load
}

/**
 * メモリ使用量の見積もり
 */
const estimateMemoryUsage = (parameters: any): number => {
  // 簡易的なメモリ計算 (バイト単位)
  let memory = 0

  // チャンクあたりの基本サイズ
  memory += 16 * 16 * 256 * 4 // 高度マップ

  // 構造物データ
  const structureCount = Object.keys(parameters.structures.density).length
  memory += structureCount * 1024 // 構造物あたり1KB

  return memory
}

// ================================
// Exports
// ================================

export { GENERATION_TIMEOUT_MS, MAX_CHUNK_DISTANCE_FROM_ORIGIN, MAX_CONCURRENT_GENERATIONS, MAX_GENERATION_ATTEMPTS }
