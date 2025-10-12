/**
 * @fileoverview Business Rules - ビジネスルール実装
 *
 * WorldGeneratorのビジネスロジックとドメイン制約を定義します。
 * - 不変条件の強制
 * - 生成制約の検証
 * - パフォーマンス制限の管理
 */

import type * as GenerationErrors from '@domain/world/types/errors'
import * as Coordinates from '@domain/biome/value_object/coordinates'
import * as WorldSeed from '@domain/shared/value_object/world_seed/index'
import { Effect } from 'effect'
import type {
  GenerateChunkCommand,
  GenerationContext,
  GenerationState,
  UpdateSettingsCommand,
  WorldGenerator,
} from './index'

type GenerationParametersConfig = GenerationContext['parameters']

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
    yield* Effect.when(!WorldSeed.isValid(seed), () =>
      Effect.fail(GenerationErrors.createValidationError('Invalid world seed value'))
    )

    // エントロピーの確認
    const entropy = WorldSeed.calculateEntropy(seed)
    yield* Effect.when(entropy < 0.5, () =>
      Effect.fail(GenerationErrors.createValidationError('Insufficient seed entropy for quality generation'))
    )
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
    yield* Effect.when(parameters.terrain.minHeight >= parameters.terrain.maxHeight, () =>
      Effect.fail(GenerationErrors.createValidationError('Terrain min height must be less than max height'))
    )

    // バイオーム温度範囲の妥当性
    yield* pipe(
      Object.entries(biomeConfig.temperatureRanges),
      Effect.forEach(([biomeId, tempRange]) =>
        Effect.when(tempRange.min >= tempRange.max, () =>
          Effect.fail(GenerationErrors.createValidationError(`Invalid temperature range for biome ${biomeId}`))
        )
      ),
      Effect.asVoid
    )

    // ノイズスケールの妥当性
    yield* Effect.when(noiseConfig.baseSettings.scale <= 0 || noiseConfig.baseSettings.scale > 1000, () =>
      Effect.fail(GenerationErrors.createValidationError('Noise scale must be between 0 and 1000'))
    )

    // 構造物密度の総和チェック
    const totalDensity = Object.values(parameters.structures.density).reduce((sum, density) => sum + density, 0)

    yield* Effect.when(totalDensity > 1.0, () =>
      Effect.fail(GenerationErrors.createValidationError('Total structure density cannot exceed 1.0'))
    )
  })

/**
 * リソース制限の検証
 */
const validateResourceLimits = (context: GenerationContext): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    const { parameters } = context

    // チャンク生成負荷の見積もり
    const estimatedLoad = estimateGenerationLoad(parameters)
    yield* Effect.when(estimatedLoad > 100, () =>
      Effect.fail(GenerationErrors.createValidationError('Generation parameters would exceed system capacity'))
    )

    // メモリ使用量の見積もり
    const estimatedMemory = estimateMemoryUsage(parameters)
    yield* Effect.when(estimatedMemory > 1024 * 1024 * 1024, () =>
      Effect.fail(GenerationErrors.createValidationError('Generation parameters would exceed memory limits'))
    )
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
    yield* Effect.when(parameters.physics.gravity <= 0, () =>
      Effect.fail(GenerationErrors.createValidationError('Gravity must be positive'))
    )

    // 水位と地形の関係
    const seaLevel = parameters.terrain.seaLevel
    yield* Effect.when(seaLevel < parameters.terrain.minHeight || seaLevel > parameters.terrain.maxHeight, () =>
      Effect.fail(GenerationErrors.createValidationError('Sea level must be within terrain height range'))
    )

    // 気候モデルの物理的妥当性
    yield* pipe(
      Object.values(biomeConfig.climateData),
      Effect.forEach((climate) =>
        pipe(
          Effect.when(climate.temperature < -50 || climate.temperature > 60, () =>
            Effect.fail(
              GenerationErrors.createValidationError(
                'Temperature values must be within realistic range (-50°C to 60°C)'
              )
            )
          ),
          Effect.flatMap(() =>
            Effect.when(climate.humidity < 0 || climate.humidity > 100, () =>
              Effect.fail(GenerationErrors.createValidationError('Humidity values must be between 0% and 100%'))
            )
          )
        )
      ),
      Effect.asVoid
    )
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

    // 生成オプションの妥当性（Option.matchパターン）
    yield* pipe(
      Option.fromNullable(command.options),
      Option.match({
        onNone: () => Effect.void,
        onSome: (options) => validateGenerationOptions(generator, options),
      })
    )

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
    yield* Effect.when(
      Math.abs(coordinate.x) > MAX_CHUNK_DISTANCE_FROM_ORIGIN ||
        Math.abs(coordinate.z) > MAX_CHUNK_DISTANCE_FROM_ORIGIN,
      () =>
        Effect.fail(
          GenerationErrors.createValidationError(
            `Chunk coordinate (${coordinate.x}, ${coordinate.z}) exceeds maximum distance`
          )
        )
    )

    // 座標の整数性確認 (念のため)
    yield* Effect.when(!Number.isInteger(coordinate.x) || !Number.isInteger(coordinate.z), () =>
      Effect.fail(GenerationErrors.createValidationError('Chunk coordinates must be integers'))
    )
  })

/**
 * 優先度の検証
 */
const validatePriority = (priority: number): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    yield* Effect.when(priority < MIN_GENERATION_PRIORITY || priority > MAX_GENERATION_PRIORITY, () =>
      Effect.fail(
        GenerationErrors.createValidationError(
          `Priority must be between ${MIN_GENERATION_PRIORITY} and ${MAX_GENERATION_PRIORITY}`
        )
      )
    )

    yield* Effect.when(!Number.isInteger(priority), () =>
      Effect.fail(GenerationErrors.createValidationError('Priority must be an integer'))
    )
  })

/**
 * 生成オプションの検証
 */
const validateGenerationOptions = (
  generator: WorldGenerator,
  options: NonNullable<GenerateChunkCommand['options']>
): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // ルールベース検証：生成オプションの制約チェック
    const optionRules = [
      {
        name: 'flat-world-caves',
        condition: generator.context.metadata.worldType === 'flat' && options.includeCaves,
        error: 'Flat worlds cannot generate caves',
      },
    ]

    yield* Effect.forEach(optionRules, (rule) =>
      Effect.when(rule.condition, {
        onTrue: () => Effect.fail(GenerationErrors.createValidationError(rule.error)),
        onFalse: () => Effect.void,
      })
    )
  })

/**
 * ジェネレータ状態の検証
 */
const validateGeneratorState = (generator: WorldGenerator): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // 同時生成数の確認
    yield* Effect.when(generator.state.statistics.concurrentGenerations >= MAX_CONCURRENT_GENERATIONS, () =>
      Effect.fail(
        GenerationErrors.createValidationError(
          `Maximum concurrent generations (${MAX_CONCURRENT_GENERATIONS}) exceeded`
        )
      )
    )

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
    yield* Effect.when(generator.state.statistics.concurrentGenerations > 0, () =>
      Effect.fail(GenerationErrors.createValidationError('Cannot update settings while chunk generation is active'))
    )

    // 更新内容の検証（Option.matchパターン）
    const hasUpdates = command.parameters || command.biomeConfig || command.noiseConfig

    yield* pipe(
      Option.fromNullable(hasUpdates ? command : null),
      Option.match({
        onNone: () => Effect.void,
        onSome: (cmd) => {
          const updatedContext = {
            ...generator.context,
            ...(cmd.parameters && { parameters: cmd.parameters }),
            ...(cmd.biomeConfig && { biomeConfig: cmd.biomeConfig }),
            ...(cmd.noiseConfig && { noiseConfig: cmd.noiseConfig }),
          }
          return validateParameterConsistency(updatedContext)
        },
      })
    )
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
    yield* Effect.when(!generator.id || !generator.context || !generator.state, () =>
      Effect.fail(GenerationErrors.createIntegrityError('Missing required generator fields'))
    )

    // バージョンの整合性
    yield* Effect.when(generator.version < 0, () =>
      Effect.fail(GenerationErrors.createIntegrityError('Invalid aggregate version'))
    )

    // タイムスタンプの整合性
    yield* Effect.when(generator.createdAt > generator.updatedAt, () =>
      Effect.fail(GenerationErrors.createIntegrityError('Created timestamp cannot be after updated timestamp'))
    )
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
    yield* Effect.when(stats.totalChunksGenerated < 0 || stats.failureCount < 0, () =>
      Effect.fail(GenerationErrors.createIntegrityError('Invalid statistics values'))
    )

    yield* Effect.when(stats.successRate < 0 || stats.successRate > 1, () =>
      Effect.fail(GenerationErrors.createIntegrityError('Invalid success rate'))
    )
  })

/**
 * 状態整合性の検証
 */
export const validateStateIntegrity = (state: GenerationState): Effect.Effect<void, GenerationErrors.IntegrityError> =>
  Effect.gen(function* () {
    // アクティブ生成数の整合性
    const activeCount = Object.keys(state.activeGenerations).length
    yield* Effect.when(activeCount !== state.statistics.concurrentGenerations, () =>
      Effect.fail(
        GenerationErrors.createIntegrityError('Active generations count mismatch between state and statistics')
      )
    )

    // 生成状態の論理的整合性
    yield* pipe(
      Object.entries(state.activeGenerations),
      Effect.forEach(([key, info]) =>
        pipe(
          Effect.when(info.status === 'completed' || info.status === 'failed', () =>
            Effect.fail(
              GenerationErrors.createIntegrityError(`Active generation ${key} has terminal status ${info.status}`)
            )
          ),
          Effect.flatMap(() =>
            Effect.when(info.attempts <= 0, () =>
              Effect.fail(GenerationErrors.createIntegrityError(`Invalid attempt count for generation ${key}`))
            )
          )
        )
      ),
      Effect.asVoid
    )
  })

// ================================
// Helper Functions
// ================================

/**
 * 生成負荷の見積もり
 */
const estimateGenerationLoad = (parameters: GenerationParametersConfig): number => {
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
const estimateMemoryUsage = (parameters: GenerationParametersConfig): number => {
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
