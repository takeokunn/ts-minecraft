/**
 * @fileoverview Generation Context - 生成コンテキスト管理
 *
 * ワールド生成に必要な全設定を統合管理します。
 * - 設定の一貫性保証
 * - バリデーション付きファクトリ関数
 * - 型安全な設定操作
 */

import { Brand, Effect, Schema } from 'effect'
import type * as GenerationErrors from '../../types/errors/generation_errors.js'
import * as BiomeProperties from '../../value_object/biome_properties/index.js'
import * as GenerationParameters from '../../value_object/generation_parameters/index.js'
import * as NoiseConfiguration from '../../value_object/noise_configuration/index.js'
import * as WorldSeed from '../../value_object/world_seed/index.js'

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
    const now = yield* Effect.sync(() => new Date())
    const contextId = yield* Effect.sync(() =>
      Schema.decodeSync(GenerationContextIdSchema)(`ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)
    )

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
    const now = yield* Effect.sync(() => new Date())

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

  const params = presets[presetName]
  if (!params) {
    return Effect.fail(GenerationErrors.createValidationError(`Unknown preset: ${presetName}`))
  }

  return create(params)
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
    // シード値とノイズ設定の一貫性
    if (config.noiseConfig.baseSettings.seed !== config.seed.value) {
      return yield* Effect.fail(
        GenerationErrors.createValidationError('Seed mismatch between world seed and noise configuration')
      )
    }

    // バイオーム設定と地形パラメータの一貫性
    const maxElevation = Math.max(...Object.values(config.biomeConfig.elevationRanges))
    if (maxElevation > config.parameters.terrain.maxHeight) {
      return yield* Effect.fail(GenerationErrors.createValidationError('Biome elevation exceeds terrain max height'))
    }

    // 構造物密度の妥当性
    const totalStructureDensity = Object.values(config.parameters.structures.density).reduce(
      (sum, density) => sum + density,
      0
    )

    if (totalStructureDensity > 1.0) {
      return yield* Effect.fail(GenerationErrors.createValidationError('Total structure density exceeds 100%'))
    }

    // ノイズ設定の数値範囲検証
    if (config.noiseConfig.baseSettings.scale <= 0) {
      return yield* Effect.fail(GenerationErrors.createValidationError('Noise scale must be positive'))
    }
  })

/**
 * 生成互換性チェック
 */
export const validateGenerationCompatibility = (
  context: GenerationContext
): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // メタデータと設定の互換性チェック
    if (context.metadata.worldType === 'flat') {
      // フラットワールドでは地形生成パラメータを無視
      if (context.parameters.terrain.generateCaves || context.parameters.terrain.generateRavines) {
        return yield* Effect.fail(GenerationErrors.createValidationError('Flat world cannot have caves or ravines'))
      }
    }

    if (context.metadata.gameMode === 'creative' && context.metadata.difficulty !== 'peaceful') {
      // クリエイティブモードでは通常ピースフルが推奨
      // 警告レベルだが、エラーにはしない
    }

    // 難易度と敵対MOB生成の一貫性
    if (context.metadata.difficulty === 'peaceful' && context.parameters.mobs.hostileSpawnRate > 0) {
      return yield* Effect.fail(
        GenerationErrors.createValidationError('Peaceful difficulty cannot have hostile mob spawning')
      )
    }
  })

// ================================
// Exports
// ================================

export { type ContextMetadata, type CreateContextParams }
