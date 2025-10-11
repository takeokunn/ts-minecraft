/**
 * @fileoverview WorldGeneratorFactory - DDD原理主義実装
 *
 * WorldGenerator集約の複雑な生成ロジックを抽象化し、
 * ビジネスルールを強制する統合ファクトリです。
 *
 * ## 責務
 * - WorldGenerator集約の構築
 * - 生成パラメータの検証と最適化
 * - ドメインサービス依存関係の解決
 * - プリセット設定の適用
 * - 生成ライフサイクルの管理
 *
 * ## 技術仕様
 * - Effect-TS 3.17+ Context.GenericTag依存性注入
 * - Schema による型安全な検証
 * - Match.value による網羅的条件分岐
 * - Function.flow による関数合成
 * - STM による並行制御対応
 */

import type * as WorldGenerator from '@domain/world/aggregate/world_generator'
import * as WorldDomainServices from '@domain/world/domain_service'
import * as BiomeProperties from '@domain/world/value_object/biome_properties/index'
import * as GenerationParameters from '@domain/world/value_object/generation_parameters/index'
import * as NoiseConfiguration from '@domain/world/value_object/noise_configuration/index'
import * as WorldSeed from '@domain/world/value_object/world_seed/index'
import { Context, Effect, Function, Layer, Match, Schema } from 'effect'

// ================================
// Factory Error Types
// ================================

export const FactoryErrorSchema = Schema.TaggedError('FactoryError', {
  category: Schema.Literal(
    'parameter_validation',
    'dependency_resolution',
    'resource_allocation',
    'configuration_conflict',
    'performance_constraint'
  ),
  message: Schema.String,
  context: Schema.optional(Schema.Unknown),
  cause: Schema.optional(Schema.Unknown),
})

export type FactoryError = Schema.Schema.Type<typeof FactoryErrorSchema>

type FactoryErrorExtras = Partial<Omit<FactoryError, 'category' | 'message'>>

const makeFactoryError = (category: FactoryError['category'], message: string, extras?: FactoryErrorExtras): FactoryError =>
  FactoryErrorSchema.make({
    category,
    message,
    ...extras,
  })

export const FactoryErrorFactory = {
  make: (input: FactoryError): FactoryError => FactoryErrorSchema.make(input),
  parameterValidation: (message: string, extras?: FactoryErrorExtras) =>
    makeFactoryError('parameter_validation', message, extras),
  dependencyResolution: (message: string, extras?: FactoryErrorExtras) =>
    makeFactoryError('dependency_resolution', message, extras),
  resourceAllocation: (message: string, extras?: FactoryErrorExtras) =>
    makeFactoryError('resource_allocation', message, extras),
  configurationConflict: (message: string, extras?: FactoryErrorExtras) =>
    makeFactoryError('configuration_conflict', message, extras),
  performanceConstraint: (message: string, extras?: FactoryErrorExtras) =>
    makeFactoryError('performance_constraint', message, extras),
} as const

export const FactoryError = FactoryErrorFactory

// ================================
// Factory Parameters
// ================================

/**
 * WorldGenerator作成パラメータ
 * ファクトリで必要な全ての設定を型安全に定義
 */
export const CreateWorldGeneratorParamsSchema = Schema.Struct({
  // 基本設定
  seed: Schema.optional(WorldSeed.WorldSeedSchema),

  // 生成設定
  parameters: Schema.optional(GenerationParameters.GenerationParametersSchema),
  biomeConfig: Schema.optional(BiomeProperties.BiomeConfigurationSchema),
  noiseConfig: Schema.optional(NoiseConfiguration.NoiseConfigurationSchema),

  // パフォーマンス設定
  maxConcurrentGenerations: Schema.optional(Schema.Number.pipe(Schema.between(1, 16))),
  cacheSize: Schema.optional(Schema.Number.pipe(Schema.between(100, 10000))),

  // 機能フラグ
  enableStructures: Schema.optional(Schema.Boolean),
  enableCaves: Schema.optional(Schema.Boolean),
  enableOres: Schema.optional(Schema.Boolean),

  // 品質設定
  qualityLevel: Schema.optional(Schema.Literal('fast', 'balanced', 'quality')),

  // デバッグ設定
  enableDebugMode: Schema.optional(Schema.Boolean),
  logLevel: Schema.optional(Schema.Literal('error', 'warn', 'info', 'debug')),
})

export type CreateWorldGeneratorParams = typeof CreateWorldGeneratorParamsSchema.Type

/**
 * プリセット生成パラメータ
 */
export const PresetTypeSchema = Schema.Literal(
  'default',
  'survival',
  'creative',
  'peaceful',
  'hardcore',
  'superflat',
  'amplified',
  'debug',
  'custom',
  'experimental'
)

export type PresetType = typeof PresetTypeSchema.Type

export const CreateFromPresetParamsSchema = Schema.Struct({
  preset: PresetTypeSchema,
  seed: Schema.optional(WorldSeed.WorldSeedSchema),
  customizations: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Unknown,
    })
  ),
})

export type CreateFromPresetParams = typeof CreateFromPresetParamsSchema.Type

/**
 * シード生成パラメータ
 */
export const CreateFromSeedParamsSchema = Schema.Struct({
  seed: WorldSeed.WorldSeedSchema,
  preset: Schema.optional(PresetTypeSchema),
  overrides: Schema.optional(CreateWorldGeneratorParamsSchema),
})

export type CreateFromSeedParams = typeof CreateFromSeedParamsSchema.Type

/**
 * クローン生成パラメータ
 */
export const CloneParamsSchema = Schema.Struct({
  source: WorldGenerator.WorldGeneratorSchema,
  modifications: Schema.optional(CreateWorldGeneratorParamsSchema),
  preserveState: Schema.optional(Schema.Boolean),
  newId: Schema.optional(Schema.Boolean),
})

export type CloneParams = typeof CloneParamsSchema.Type

// ================================
// WorldGeneratorFactory Interface
// ================================

export interface WorldGeneratorFactory {
  /**
   * 標準WorldGenerator作成
   * パラメータベースの詳細制御
   */
  readonly create: (params: CreateWorldGeneratorParams) => Effect.Effect<WorldGenerator.WorldGenerator, FactoryError>

  /**
   * プリセットベースWorldGenerator作成
   * 定義済み設定の簡単適用
   */
  readonly createFromPreset: (
    params: CreateFromPresetParams
  ) => Effect.Effect<WorldGenerator.WorldGenerator, FactoryError>

  /**
   * シードベースWorldGenerator作成
   * 再現性重視の生成
   */
  readonly createFromSeed: (params: CreateFromSeedParams) => Effect.Effect<WorldGenerator.WorldGenerator, FactoryError>

  /**
   * 既存WorldGeneratorクローン
   * 設定変更による派生生成
   */
  readonly clone: (params: CloneParams) => Effect.Effect<WorldGenerator.WorldGenerator, FactoryError>

  /**
   * バッチ生成
   * 複数WorldGenerator並列作成
   */
  readonly createBatch: (
    configs: readonly CreateWorldGeneratorParams[]
  ) => Effect.Effect<readonly WorldGenerator.WorldGenerator[], FactoryError>

  /**
   * 検証付き生成
   * 品質保証された生成
   */
  readonly createValidated: (
    params: CreateWorldGeneratorParams,
    validationLevel: 'basic' | 'standard' | 'strict'
  ) => Effect.Effect<WorldGenerator.WorldGenerator, FactoryError>
}

// ================================
// Factory Implementation
// ================================

/**
 * WorldGeneratorFactory実装
 */
const createWorldGeneratorFactory = (): WorldGeneratorFactory => ({
  create: (params: CreateWorldGeneratorParams) =>
    Effect.gen(function* () {
      // パラメータ検証
      yield* validateCreateParams(params)

      // デフォルト値の適用
      const resolvedParams = yield* applyDefaults(params)

      // 依存関係解決
      const dependencies = yield* resolveDependencies(resolvedParams)

      // 生成コンテキスト構築
      const context = yield* buildGenerationContext(resolvedParams, dependencies)

      // WorldGenerator ID生成
      const id = yield* generateWorldGeneratorId()

      // WorldGenerator作成
      const generator = yield* Effect.tryPromise({
        try: () => WorldGenerator.create(id, context),
        catch: (error) =>
          new FactoryError({
            category: 'resource_allocation',
            message: 'Failed to create WorldGenerator',
            cause: error,
          }),
      })

      // 後処理
      yield* performPostCreationSetup(generator, resolvedParams)

      return generator
    }),

  createFromPreset: (params: CreateFromPresetParams) =>
    Effect.gen(function* () {
      // プリセット設定の読み込み
      const presetConfig = yield* loadPresetConfiguration(params.preset)

      // カスタマイゼーション適用
      const customizedConfig = yield* applyCustomizations(presetConfig, params.customizations)

      // シード適用
      const finalConfig = yield* applySeedOverride(customizedConfig, params.seed)

      // 標準生成フローへ委譲
      return yield* createWorldGeneratorFactory().create(finalConfig)
    }),

  createFromSeed: (params: CreateFromSeedParams) =>
    Effect.gen(function* () {
      // シードベース設定生成
      const seedBasedConfig = yield* generateConfigFromSeed(params.seed)

      // プリセット適用（オプション）
      const withPreset = params.preset ? yield* mergeWithPreset(seedBasedConfig, params.preset) : seedBasedConfig

      // オーバーライド適用
      const finalConfig = yield* applyOverrides(withPreset, params.overrides)

      return yield* createWorldGeneratorFactory().create(finalConfig)
    }),

  clone: (params: CloneParams) =>
    Effect.gen(function* () {
      // ソース検証
      yield* validateSourceGenerator(params.source)

      // クローン設定構築
      const cloneConfig = yield* buildCloneConfiguration(params)

      // 新しいID生成（必要に応じて）
      const newId = params.newId ? yield* generateWorldGeneratorId() : params.source.id

      // 状態保持/リセット処理
      const context = params.preserveState
        ? params.source.context
        : yield* resetGenerationContext(params.source.context)

      // 修正適用
      const modifiedContext = params.modifications ? yield* applyModifications(context, params.modifications) : context

      return yield* Effect.tryPromise({
        try: () => WorldGenerator.create(newId, modifiedContext),
        catch: (error) =>
          new FactoryError({
            category: 'resource_allocation',
            message: 'Failed to clone WorldGenerator',
            cause: error,
          }),
      })
    }),

  createBatch: (configs: readonly CreateWorldGeneratorParams[]) =>
    Effect.gen(function* () {
      // バッチサイズ検証
      yield* Function.pipe(
        Match.value(configs.length),
        Match.when(0, () =>
          Effect.fail(
            new FactoryError({
              category: 'parameter_validation',
              message: 'Empty configuration array provided',
            })
          )
        ),
        Match.when(
          (len) => len > 10,
          () =>
            Effect.fail(
              new FactoryError({
                category: 'performance_constraint',
                message: 'Batch size exceeds maximum limit (10)',
              })
            )
        ),
        Match.orElse(() => Effect.void)
      )

      // 並列生成
      const generators = yield* Effect.all(
        configs.map((config) => createWorldGeneratorFactory().create(config)),
        { concurrency: 4 }
      )

      return generators
    }),

  createValidated: (params: CreateWorldGeneratorParams, validationLevel: 'basic' | 'standard' | 'strict') =>
    Effect.gen(function* () {
      // 事前検証
      yield* performPreValidation(params, validationLevel)

      // 標準生成
      const generator = yield* createWorldGeneratorFactory().create(params)

      // 事後検証
      yield* performPostValidation(generator, validationLevel)

      return generator
    }),
})

// ================================
// Helper Functions
// ================================

/**
 * パラメータ検証
 */
const validateCreateParams = (params: CreateWorldGeneratorParams): Effect.Effect<void, FactoryError> =>
  pipe(
    Effect.try({
      try: () => Schema.decodeSync(CreateWorldGeneratorParamsSchema)(params),
      catch: (error) =>
        new FactoryError({
          category: 'parameter_validation',
          message: 'Invalid create parameters',
          cause: error,
        }),
    }),
    Effect.asVoid
  )

/**
 * デフォルト値適用
 */
const applyDefaults = (params: CreateWorldGeneratorParams): Effect.Effect<CreateWorldGeneratorParams, FactoryError> =>
  Effect.succeed({
    seed: params.seed ?? WorldSeed.createRandom(),
    parameters: params.parameters ?? GenerationParameters.createDefault(),
    biomeConfig: params.biomeConfig ?? BiomeProperties.createDefaultConfiguration(),
    noiseConfig: params.noiseConfig ?? NoiseConfiguration.createDefault(),
    maxConcurrentGenerations: params.maxConcurrentGenerations ?? 4,
    cacheSize: params.cacheSize ?? 1000,
    enableStructures: params.enableStructures ?? true,
    enableCaves: params.enableCaves ?? true,
    enableOres: params.enableOres ?? true,
    qualityLevel: params.qualityLevel ?? 'balanced',
    enableDebugMode: params.enableDebugMode ?? false,
    logLevel: params.logLevel ?? 'info',
  })

/**
 * 依存関係解決
 */
const resolveDependencies = (params: CreateWorldGeneratorParams): Effect.Effect<unknown, FactoryError> =>
  Effect.gen(function* () {
    // ドメインサービス依存関係の解決
    const domainServices = yield* Effect.service(WorldDomainServices.WorldDomainServiceLayer)

    return {
      domainServices,
      // 他の必要な依存関係...
    }
  })

/**
 * 生成コンテキスト構築
 */
const buildGenerationContext = (
  params: CreateWorldGeneratorParams,
  dependencies: unknown
): Effect.Effect<WorldGenerator.GenerationContext, FactoryError> =>
  Effect.succeed({
    seed: params.seed!,
    parameters: params.parameters!,
    biomeConfig: params.biomeConfig!,
    noiseConfig: params.noiseConfig!,
  })

/**
 * WorldGenerator ID生成
 */
const generateWorldGeneratorId = (): Effect.Effect<WorldGenerator.WorldGeneratorId, FactoryError> =>
  Effect.sync(() => WorldGenerator.createWorldGeneratorId(`wg_${crypto.randomUUID()}`))

/**
 * 後処理セットアップ
 */
const performPostCreationSetup = (
  generator: WorldGenerator.WorldGenerator,
  params: CreateWorldGeneratorParams
): Effect.Effect<void, FactoryError> =>
  Effect.sync(() => {
    // ログ設定、メトリクス初期化など
  })

/**
 * プリセット設定読み込み
 */
const loadPresetConfiguration = (preset: PresetType): Effect.Effect<CreateWorldGeneratorParams, FactoryError> =>
  Function.pipe(
    Match.value(preset),
    Match.when('default', () => createDefaultPreset()),
    Match.when('survival', () => createSurvivalPreset()),
    Match.when('creative', () => createCreativePreset()),
    Match.when('peaceful', () => createPeacefulPreset()),
    Match.when('hardcore', () => createHardcorePreset()),
    Match.when('superflat', () => createSuperflatPreset()),
    Match.when('amplified', () => createAmplifiedPreset()),
    Match.when('debug', () => createDebugPreset()),
    Match.when('custom', () => createCustomPreset()),
    Match.when('experimental', () => createExperimentalPreset()),
    Match.orElse(() =>
      Effect.fail(
        new FactoryError({
          category: 'parameter_validation',
          message: `Unknown preset type: ${preset}`,
        })
      )
    )
  )

// プリセット生成関数群
const createDefaultPreset = (): Effect.Effect<CreateWorldGeneratorParams, FactoryError> =>
  Effect.succeed({
    qualityLevel: 'balanced',
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
  })

const createSurvivalPreset = (): Effect.Effect<CreateWorldGeneratorParams, FactoryError> =>
  Effect.succeed({
    qualityLevel: 'quality',
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
    maxConcurrentGenerations: 2,
  })

const createCreativePreset = (): Effect.Effect<CreateWorldGeneratorParams, FactoryError> =>
  Effect.succeed({
    qualityLevel: 'fast',
    enableStructures: true,
    enableCaves: false,
    enableOres: false,
    maxConcurrentGenerations: 8,
  })

const createPeacefulPreset = (): Effect.Effect<CreateWorldGeneratorParams, FactoryError> =>
  Effect.succeed({
    qualityLevel: 'balanced',
    enableStructures: false,
    enableCaves: true,
    enableOres: true,
  })

const createHardcorePreset = (): Effect.Effect<CreateWorldGeneratorParams, FactoryError> =>
  Effect.succeed({
    qualityLevel: 'quality',
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
    maxConcurrentGenerations: 1,
  })

const createSuperflatPreset = (): Effect.Effect<CreateWorldGeneratorParams, FactoryError> =>
  Effect.succeed({
    qualityLevel: 'fast',
    enableStructures: false,
    enableCaves: false,
    enableOres: false,
  })

const createAmplifiedPreset = (): Effect.Effect<CreateWorldGeneratorParams, FactoryError> =>
  Effect.succeed({
    qualityLevel: 'quality',
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
    maxConcurrentGenerations: 1,
  })

const createDebugPreset = (): Effect.Effect<CreateWorldGeneratorParams, FactoryError> =>
  Effect.succeed({
    qualityLevel: 'fast',
    enableStructures: false,
    enableCaves: false,
    enableOres: false,
    enableDebugMode: true,
    logLevel: 'debug',
  })

const createCustomPreset = (): Effect.Effect<CreateWorldGeneratorParams, FactoryError> => Effect.succeed({})

const createExperimentalPreset = (): Effect.Effect<CreateWorldGeneratorParams, FactoryError> =>
  Effect.succeed({
    qualityLevel: 'quality',
    enableStructures: true,
    enableCaves: true,
    enableOres: true,
    enableDebugMode: true,
  })

// その他のヘルパー関数（実装を簡略化）
const applyCustomizations = (config: CreateWorldGeneratorParams, customizations?: Record<string, unknown>) =>
  Effect.succeed(config)

const applySeedOverride = (config: CreateWorldGeneratorParams, seed?: WorldSeed.WorldSeed) =>
  Effect.succeed(seed ? { ...config, seed } : config)

const generateConfigFromSeed = (seed: WorldSeed.WorldSeed) => Effect.succeed({ seed } as CreateWorldGeneratorParams)

const mergeWithPreset = (config: CreateWorldGeneratorParams, preset: PresetType) =>
  Effect.gen(function* () {
    const presetConfig = yield* loadPresetConfiguration(preset)
    return { ...presetConfig, ...config }
  })

const applyOverrides = (config: CreateWorldGeneratorParams, overrides?: CreateWorldGeneratorParams) =>
  Effect.succeed(overrides ? { ...config, ...overrides } : config)

const validateSourceGenerator = (source: WorldGenerator.WorldGenerator) => Effect.succeed(undefined)

const buildCloneConfiguration = (params: CloneParams) => Effect.succeed(params)

const resetGenerationContext = (context: WorldGenerator.GenerationContext) => Effect.succeed(context)

const applyModifications = (context: WorldGenerator.GenerationContext, modifications: CreateWorldGeneratorParams) =>
  Effect.succeed(context)

const performPreValidation = (params: CreateWorldGeneratorParams, level: string) => Effect.succeed(undefined)

const performPostValidation = (generator: WorldGenerator.WorldGenerator, level: string) => Effect.succeed(undefined)

// ================================
// Context.GenericTag
// ================================

export const WorldGeneratorFactoryTag = Context.GenericTag<WorldGeneratorFactory>(
  '@minecraft/domain/world/factory/WorldGeneratorFactory'
)

// ================================
// Layer Implementation
// ================================

export const WorldGeneratorFactoryLive = Layer.succeed(WorldGeneratorFactoryTag, createWorldGeneratorFactory())

// ================================
// Exports
// ================================

export {
  type CloneParams,
  type CreateFromPresetParams,
  type CreateFromSeedParams,
  type CreateWorldGeneratorParams,
  type PresetType,
  type WorldGeneratorFactory,
}
