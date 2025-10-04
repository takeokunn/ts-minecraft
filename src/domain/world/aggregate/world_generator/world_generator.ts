/**
 * @fileoverview WorldGenerator Aggregate Root - DDD原理主義実装
 *
 * このファイルはWorldGeneratorの集約ルートを定義します。
 * - 不変性と一意識別による強固な設計
 * - Event Sourcingによる状態変更の追跡
 * - STMによる並行制御の実現
 * - Effect-TS 3.17+の最新パターン活用
 */

import { Context, Effect, Schema, STM, Brand } from "effect"
import * as WorldSeed from "../../value_object/world_seed/index.js"
import * as Coordinates from "../../value_object/coordinates/index.js"
import * as GenerationParameters from "../../value_object/generation_parameters/index.js"
import * as BiomeProperties from "../../value_object/biome_properties/index.js"
import * as NoiseConfiguration from "../../value_object/noise_configuration/index.js"
import * as GenerationEvents from "./events.js"
import * as BusinessRules from "./business_rules.js"
import * as GenerationState from "./generation_state.js"
import type * as WorldTypes from "../../types/core/world_types.js"
import type * as GenerationTypes from "../../types/core/generation_types.js"
import type * as GenerationErrors from "../../types/errors/generation_errors.js"

// ================================
// Aggregate Root Identifier
// ================================

/**
 * WorldGeneratorのBrand型識別子
 * 集約ルートの一意識別を保証
 */
export type WorldGeneratorId = string & Brand.Brand<'WorldGeneratorId'>

export const WorldGeneratorIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('WorldGeneratorId'),
  Schema.annotations({
    title: 'WorldGeneratorId',
    description: 'Unique identifier for WorldGenerator aggregate root',
    examples: ['wg_12345678-1234-5678-9abc-123456789abc']
  })
)

export const createWorldGeneratorId = (value: string): WorldGeneratorId =>
  Schema.decodeSync(WorldGeneratorIdSchema)(value)

// ================================
// Aggregate Version (楽観的ロック)
// ================================

export type AggregateVersion = number & Brand.Brand<'AggregateVersion'>

export const AggregateVersionSchema = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand('AggregateVersion'),
  Schema.annotations({
    title: 'AggregateVersion',
    description: 'Version number for optimistic locking',
  })
)

// ================================
// Generation Context
// ================================

/**
 * 生成コンテキスト - 生成に必要な全設定
 */
export const GenerationContextSchema = Schema.Struct({
  seed: WorldSeed.WorldSeedSchema,
  parameters: GenerationParameters.GenerationParametersSchema,
  biomeConfig: BiomeProperties.BiomeConfigurationSchema,
  noiseConfig: NoiseConfiguration.NoiseConfigurationSchema,
})

export type GenerationContext = typeof GenerationContextSchema.Type

// ================================
// WorldGenerator Aggregate Root
// ================================

/**
 * WorldGenerator集約ルート
 *
 * 責務:
 * - ワールド生成の統合制御
 * - 生成状態の管理と整合性保証
 * - ドメインイベントの発行
 * - ビジネスルールの強制
 */
export const WorldGeneratorSchema = Schema.Struct({
  id: WorldGeneratorIdSchema,
  version: AggregateVersionSchema,
  context: GenerationContextSchema,
  state: GenerationState.GenerationStateSchema,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
})

export type WorldGenerator = typeof WorldGeneratorSchema.Type

// ================================
// Commands (操作要求)
// ================================

export const GenerateChunkCommandSchema = Schema.Struct({
  coordinate: Coordinates.ChunkCoordinateSchema,
  priority: Schema.Number.pipe(Schema.between(1, 10)),
  options: Schema.optional(Schema.Struct({
    includeStructures: Schema.Boolean,
    includeCaves: Schema.Boolean,
    includeOres: Schema.Boolean,
  }))
})

export type GenerateChunkCommand = typeof GenerateChunkCommandSchema.Type

export const UpdateSettingsCommandSchema = Schema.Struct({
  parameters: Schema.optional(GenerationParameters.GenerationParametersSchema),
  biomeConfig: Schema.optional(BiomeProperties.BiomeConfigurationSchema),
  noiseConfig: Schema.optional(NoiseConfiguration.NoiseConfigurationSchema),
})

export type UpdateSettingsCommand = typeof UpdateSettingsCommandSchema.Type

// ================================
// Aggregate Operations
// ================================

/**
 * WorldGenerator作成ファクトリ
 */
export const create = (
  id: WorldGeneratorId,
  context: GenerationContext
): Effect.Effect<WorldGenerator, GenerationErrors.CreationError> =>
  Effect.gen(function* () {
    // ビジネスルール検証
    yield* BusinessRules.validateCreationContext(context)

    const now = yield* Effect.sync(() => new Date())

    const generator: WorldGenerator = {
      id,
      version: Schema.decodeSync(AggregateVersionSchema)(0),
      context,
      state: GenerationState.createInitial(),
      createdAt: now,
      updatedAt: now,
    }

    // 作成イベント発行
    yield* GenerationEvents.publish(
      GenerationEvents.createWorldGeneratorCreated(id, context)
    )

    return generator
  })

/**
 * チャンク生成
 * STMによる並行制御対応
 */
export const generateChunk = (
  generator: WorldGenerator,
  command: GenerateChunkCommand
): STM.STM<
  [WorldGenerator, WorldTypes.ChunkData],
  GenerationErrors.GenerationError
> =>
  STM.gen(function* () {
    // 並行性制御 - 同時生成制限チェック
    const currentLoad = yield* STM.fromEffect(
      GenerationState.getCurrentGenerationLoad(generator.state)
    )

    if (currentLoad >= BusinessRules.MAX_CONCURRENT_GENERATIONS) {
      return yield* STM.fail(
        GenerationErrors.createGenerationOverloadError(currentLoad)
      )
    }

    // ビジネスルール検証
    yield* STM.fromEffect(
      BusinessRules.validateChunkGenerationRequest(generator, command)
    )

    // 状態更新 - 生成開始
    const updatedState = yield* STM.fromEffect(
      GenerationState.startChunkGeneration(generator.state, command.coordinate)
    )

    // チャンクデータ生成 (実際の生成ロジックはDomain Serviceに委譲)
    const chunkData = yield* STM.fromEffect(
      generateChunkData(generator.context, command)
    )

    // 状態更新 - 生成完了
    const finalState = yield* STM.fromEffect(
      GenerationState.completeChunkGeneration(updatedState, command.coordinate, chunkData)
    )

    const updatedGenerator: WorldGenerator = {
      ...generator,
      version: Schema.decodeSync(AggregateVersionSchema)(generator.version + 1),
      state: finalState,
      updatedAt: new Date(),
    }

    // 完了イベント発行
    yield* STM.fromEffect(
      GenerationEvents.publish(
        GenerationEvents.createChunkGenerated(generator.id, command.coordinate, chunkData)
      )
    )

    return [updatedGenerator, chunkData]
  })

/**
 * 設定更新
 */
export const updateSettings = (
  generator: WorldGenerator,
  command: UpdateSettingsCommand
): Effect.Effect<WorldGenerator, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    // ビジネスルール検証
    yield* BusinessRules.validateSettingsUpdate(generator, command)

    const updatedContext: GenerationContext = {
      ...generator.context,
      ...(command.parameters && { parameters: command.parameters }),
      ...(command.biomeConfig && { biomeConfig: command.biomeConfig }),
      ...(command.noiseConfig && { noiseConfig: command.noiseConfig }),
    }

    const updatedGenerator: WorldGenerator = {
      ...generator,
      version: Schema.decodeSync(AggregateVersionSchema)(generator.version + 1),
      context: updatedContext,
      updatedAt: new Date(),
    }

    // 設定更新イベント発行
    yield* GenerationEvents.publish(
      GenerationEvents.createSettingsUpdated(generator.id, command)
    )

    return updatedGenerator
  })

/**
 * 整合性検証
 * 定期的な健全性チェック用
 */
export const validateIntegrity = (
  generator: WorldGenerator
): Effect.Effect<WorldGenerator, GenerationErrors.IntegrityError> =>
  Effect.gen(function* () {
    // 構造的整合性チェック
    yield* BusinessRules.validateStructuralIntegrity(generator)

    // データ整合性チェック
    yield* BusinessRules.validateDataIntegrity(generator)

    // 状態整合性チェック
    yield* BusinessRules.validateStateIntegrity(generator.state)

    return generator
  })

// ================================
// Private Helper Functions
// ================================

/**
 * チャンクデータ生成 (Domain Serviceに委譲)
 */
const generateChunkData = (
  context: GenerationContext,
  command: GenerateChunkCommand
): Effect.Effect<WorldTypes.ChunkData, GenerationErrors.GenerationError> =>
  Effect.gen(function* () {
    // この実装はDomain Service層に委譲する
    // 実際の地形生成、バイオーム計算、構造物配置など

    // プレースホルダー実装
    const chunkData: WorldTypes.ChunkData = {
      coordinate: command.coordinate,
      heightMap: new Array(256).fill(64), // 16x16の高度マップ
      biomes: new Array(256).fill(0), // バイオームID配列
      structures: [],
      generatedAt: new Date(),
    }

    return chunkData
  })

// ================================
// Context.GenericTag (依存性注入)
// ================================

export const WorldGeneratorTag = Context.GenericTag<{
  readonly create: (
    id: WorldGeneratorId,
    context: GenerationContext
  ) => Effect.Effect<WorldGenerator, GenerationErrors.CreationError>

  readonly generateChunk: (
    generator: WorldGenerator,
    command: GenerateChunkCommand
  ) => STM.STM<[WorldGenerator, WorldTypes.ChunkData], GenerationErrors.GenerationError>

  readonly updateSettings: (
    generator: WorldGenerator,
    command: UpdateSettingsCommand
  ) => Effect.Effect<WorldGenerator, GenerationErrors.ValidationError>

  readonly validateIntegrity: (
    generator: WorldGenerator
  ) => Effect.Effect<WorldGenerator, GenerationErrors.IntegrityError>
}>('@minecraft/domain/world/aggregate/WorldGenerator')

// ================================
// Service Implementation
// ================================

export const WorldGeneratorLive = WorldGeneratorTag.of({
  create,
  generateChunk,
  updateSettings,
  validateIntegrity,
})

// ================================
// Exports
// ================================

export {
  type GenerationContext,
  type GenerateChunkCommand,
  type UpdateSettingsCommand,
}