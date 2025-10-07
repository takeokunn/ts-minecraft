/**
 * @fileoverview WorldGenerator Aggregate Root - DDD原理主義実装
 *
 * このファイルはWorldGeneratorの集約ルートを定義します。
 * - 不変性と一意識別による強固な設計
 * - Event Sourcingによる状態変更の追跡
 * - STMによる並行制御の実現
 * - Effect-TS 3.17+の最新パターン活用
 */

import type * as WorldTypes from '@domain/world/types/core'
import type * as GenerationErrors from '@domain/world/types/errors'
import { Clock, Context, Effect, Schema, STM } from 'effect'
import * as BusinessRules from './index'
import * as GenerationEvents from './index'
import * as GenerationState from './index'
import {
  AggregateVersionSchema,
  type GenerateChunkCommand,
  type GenerationContext,
  type UpdateSettingsCommand,
  type WorldGenerator,
  type WorldGeneratorId,
} from './index'

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
// ================================
// Commands (操作要求)
// ================================

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

    const now = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))

    const state = yield* GenerationState.createInitial()

    const generator: WorldGenerator = {
      id,
      version: Schema.decodeSync(AggregateVersionSchema)(0),
      context,
      state,
      createdAt: now,
      updatedAt: now,
    }

    // 作成イベント発行
    yield* GenerationEvents.publish(GenerationEvents.createWorldGeneratorCreated(id, context))

    return generator
  })

/**
 * チャンク生成
 * STMによる並行制御対応
 */
export const generateChunk = (
  generator: WorldGenerator,
  command: GenerateChunkCommand
): STM.STM<[WorldGenerator, WorldTypes.ChunkData], GenerationErrors.GenerationError> =>
  STM.gen(function* () {
    // 並行性制御 - 同時生成制限チェック
    const currentLoad = yield* STM.fromEffect(GenerationState.getCurrentGenerationLoad(generator.state))

    if (currentLoad >= BusinessRules.MAX_CONCURRENT_GENERATIONS) {
      return yield* STM.fail(GenerationErrors.createGenerationOverloadError(currentLoad))
    }

    // ビジネスルール検証
    yield* STM.fromEffect(BusinessRules.validateChunkGenerationRequest(generator, command))

    // 状態更新 - 生成開始
    const updatedState = yield* STM.fromEffect(
      GenerationState.startChunkGeneration(generator.state, command.coordinate)
    )

    // チャンクデータ生成 (実際の生成ロジックはDomain Serviceに委譲)
    const chunkData = yield* STM.fromEffect(generateChunkData(generator.context, command))

    // 状態更新 - 生成完了
    const finalState = yield* STM.fromEffect(
      GenerationState.completeChunkGeneration(updatedState, command.coordinate, chunkData)
    )

    const updatedAt = yield* STM.fromEffect(Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms)))

    const updatedGenerator: WorldGenerator = {
      ...generator,
      version: Schema.decodeSync(AggregateVersionSchema)(generator.version + 1),
      state: finalState,
      updatedAt,
    }

    // 完了イベント発行
    yield* STM.fromEffect(
      GenerationEvents.publish(GenerationEvents.createChunkGenerated(generator.id, command.coordinate, chunkData))
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

    const updatedAt = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))

    const updatedGenerator: WorldGenerator = {
      ...generator,
      version: Schema.decodeSync(AggregateVersionSchema)(generator.version + 1),
      context: updatedContext,
      updatedAt,
    }

    // 設定更新イベント発行
    yield* GenerationEvents.publish(GenerationEvents.createSettingsUpdated(generator.id, command))

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

    const generatedAt = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms))

    // プレースホルダー実装
    const chunkData: WorldTypes.ChunkData = {
      coordinate: command.coordinate,
      heightMap: new Array(256).fill(64), // 16x16の高度マップ
      biomes: new Array(256).fill(0), // バイオームID配列
      structures: [],
      generatedAt,
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
  AggregateVersionSchema,
  createWorldGeneratorId,
  GenerateChunkCommandSchema,
  GenerationContextSchema,
  UpdateSettingsCommandSchema,
  WorldGeneratorIdSchema,
  WorldGeneratorSchema,
  type AggregateVersion,
  type GenerateChunkCommand,
  type GenerationContext,
  type UpdateSettingsCommand,
  type WorldGenerator,
  type WorldGeneratorId,
} from './index'
