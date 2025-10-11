/**
 * @fileoverview Generation Context - 生成コンテキスト管理
 *
 * ワールド生成に必要な全設定を統合管理します。
 * - 設定の一貫性保証
 * - バリデーション付きファクトリ関数
 * - 型安全な設定操作
 */

import * as BiomeProperties from '@/domain/biome/value_object/biome_properties/index'
import type * as GenerationErrors from '@domain/world/types/errors'
import * as GenerationParameters from '@domain/world/value_object/generation_parameters/index'
import * as NoiseConfiguration from '@domain/world/value_object/noise_configuration/index'
import * as WorldSeed from '@domain/world/value_object/world_seed/index'
import { Brand, Clock, DateTime, Effect, Random, Schema } from 'effect'

// ================================
// Generation Context ID
// ================================

export type GenerationContextId = string & Brand.Brand<'GenerationContextId'>

export const GenerationContextIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('GenerationContextId'),
  Schema.annotations({
    title: 'GenerationContextId',
    description: 'Unique identifier for generation context',
  })
)

// ================================
// Context Metadata
// ================================

export const ContextMetadataSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.nonEmptyString()),
  description: Schema.optional(Schema.String),
  tags: Schema.Array(Schema.String),
  difficulty: Schema.Literal('peaceful', 'easy', 'normal', 'hard'),
  gameMode: Schema.Literal('survival', 'creative', 'adventure', 'spectator'),
  worldType: Schema.Literal('default', 'flat', 'largeBiomes', 'amplified', 'buffet'),
})

export type ContextMetadata = typeof ContextMetadataSchema.Type

// ================================
// Generation Context
// ================================

export const GenerationContextSchema = Schema.Struct({
  id: GenerationContextIdSchema,
  metadata: ContextMetadataSchema,
  seed: WorldSeed.WorldSeedSchema,
  parameters: GenerationParameters.GenerationParametersSchema,
  biomeConfig: BiomeProperties.BiomeConfigurationSchema,
  noiseConfig: NoiseConfiguration.NoiseConfigurationSchema,
  version: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
})

export type GenerationContext = typeof GenerationContextSchema.Type

// ================================
// Creation Parameters
// ================================

export const CreateContextParamsSchema = Schema.Struct({
  metadata: ContextMetadataSchema,
  seed: Schema.optional(WorldSeed.WorldSeedSchema),
  parameters: Schema.optional(GenerationParameters.GenerationParametersSchema),
  biomeConfig: Schema.optional(BiomeProperties.BiomeConfigurationSchema),
  noiseConfig: Schema.optional(NoiseConfiguration.NoiseConfigurationSchema),
})

export type CreateContextParams = typeof CreateContextParamsSchema.Type

// ================================
// Context Operations
// ================================

/**
 * 生成コンテキスト作成
 */
export const create = (
  params: CreateContextParams
): Effect.Effect<GenerationContext, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.nowAsDate
    const timestamp = yield* Clock.currentTimeMillis
    // Random Serviceで決定的なID生成（再現性保証）
    const randomValue = yield* Random.nextIntBetween(0, 2176782336) // 36^6
    const randomStr = randomValue.toString(36).padStart(6, '0')
    const contextId = yield* Schema.decode(GenerationContextIdSchema)(`ctx_${timestamp}_${randomStr}`)

    // デフォルト値の設定
    const seed = params.seed ?? WorldSeed.generateRandom()
    const parameters = params.parameters ?? GenerationParameters.createDefault()
    const biomeConfig = params.biomeConfig ?? BiomeProperties.createDefault()
    const noiseConfig = params.noiseConfig ?? NoiseConfiguration.createDefault()

    // 設定間の一貫性検証
    yield* validateContextConsistency({
      seed,
      parameters,
      biomeConfig,
      noiseConfig,
    })

    const context: GenerationContext = {
      id: contextId,
      metadata: params.metadata,
      seed,
      parameters,
      biomeConfig,
      noiseConfig,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }

    return context
  })

/**
 * コンテキスト更新
 */
export const update = (
  context: GenerationContext,
  updates: Partial<Omit<GenerationContext, 'id' | 'version' | 'createdAt' | 'updatedAt'>>
): Effect.Effect<GenerationContext, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.nowAsDate

    const updatedContext: GenerationContext = {
      ...context,
      ...updates,
      version: context.version + 1,
      updatedAt: now,
    }

    // 更新後の一貫性検証
    yield* validateContextConsistency({
      seed: updatedContext.seed,
      parameters: updatedContext.parameters,
      biomeConfig: updatedContext.biomeConfig,
      noiseConfig: updatedContext.noiseConfig,
    })

    return updatedContext
  })

/**
 * コンテキストの複製 (新しいIDで)
 */
export const clone = (
  context: GenerationContext,
  metadata: ContextMetadata
): Effect.Effect<GenerationContext, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    const createParams: CreateContextParams = {
      metadata,
      seed: context.seed,
      parameters: context.parameters,
      biomeConfig: context.biomeConfig,
      noiseConfig: context.noiseConfig,
    }

    return yield* create(createParams)
  })

/**
 * プリセット作成
 */
export const createPreset = (
  presetName: string
): Effect.Effect<GenerationContext, GenerationErrors.ValidationError> => {
  const presets: Record<string, CreateContextParams> = {
    default: {
      metadata: {
        name: 'Default World',
        description: 'Standard Minecraft world generation',
        tags: ['default', 'survival'],
        difficulty: 'normal',
        gameMode: 'survival',
        worldType: 'default',
      },
    },
    flat: {
      metadata: {
        name: 'Flat World',
        description: 'Super flat world for building',
        tags: ['flat', 'creative'],
        difficulty: 'peaceful',
        gameMode: 'creative',
        worldType: 'flat',
      },
    },
    amplified: {
      metadata: {
        name: 'Amplified World',
        description: 'Extreme terrain generation',
        tags: ['amplified', 'extreme'],
        difficulty: 'hard',
        gameMode: 'survival',
        worldType: 'amplified',
      },
    },
  }

  return pipe(
    Option.fromNullable(presets[presetName]),
    Option.match({
      onNone: () => Effect.fail(GenerationErrors.createValidationError(`Unknown preset: ${presetName}`)),
      onSome: (params) => create(params),
    })
  )
}

// ================================
// Validation Functions
// ================================

/**
 * コンテキスト設定間の一貫性検証
 */
const validateContextConsistency = (config: {
  seed: WorldSeed.WorldSeed
  parameters: GenerationParameters.GenerationParameters
  biomeConfig: BiomeProperties.BiomeConfiguration
  noiseConfig: NoiseConfiguration.NoiseConfiguration
}): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // ルールベース検証：独立した条件を配列化
    const validationRules = [
      {
        name: 'seed-consistency',
        condition: config.noiseConfig.baseSettings.seed !== config.seed.value,
        error: 'Seed mismatch between world seed and noise configuration',
      },
      {
        name: 'elevation-range',
        condition: Math.max(...Object.values(config.biomeConfig.elevationRanges)) > config.parameters.terrain.maxHeight,
        error: 'Biome elevation exceeds terrain max height',
      },
      {
        name: 'structure-density',
        condition: Object.values(config.parameters.structures.density).reduce((sum, density) => sum + density, 0) > 1.0,
        error: 'Total structure density exceeds 100%',
      },
      {
        name: 'noise-scale',
        condition: config.noiseConfig.baseSettings.scale <= 0,
        error: 'Noise scale must be positive',
      },
    ]

    // 全ルール検証
    yield* Effect.forEach(validationRules, (rule) =>
      Effect.when(rule.condition, {
        onTrue: () => Effect.fail(GenerationErrors.createValidationError(rule.error)),
        onFalse: () => Effect.void,
      })
    )
  })

/**
 * 生成互換性チェック
 */
export const validateGenerationCompatibility = (
  context: GenerationContext
): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // ルールベース検証：メタデータと設定の互換性チェック
    const compatibilityRules = [
      {
        name: 'flat-world-terrain',
        condition:
          context.metadata.worldType === 'flat' &&
          (context.parameters.terrain.generateCaves || context.parameters.terrain.generateRavines),
        error: 'Flat world cannot have caves or ravines',
      },
      {
        name: 'peaceful-hostile-mobs',
        condition: context.metadata.difficulty === 'peaceful' && context.parameters.mobs.hostileSpawnRate > 0,
        error: 'Peaceful difficulty cannot have hostile mob spawning',
      },
    ]

    // 全ルール検証
    yield* Effect.forEach(compatibilityRules, (rule) =>
      Effect.when(rule.condition, {
        onTrue: () => Effect.fail(GenerationErrors.createValidationError(rule.error)),
        onFalse: () => Effect.void,
      })
    )
  })

// ================================
// Exports
// ================================

export { type ContextMetadata, type CreateContextParams }
