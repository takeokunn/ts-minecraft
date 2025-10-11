/**
 * @fileoverview Domain Events - ドメインイベント実装
 *
 * WorldGeneratorのEvent Sourcing実装です。
 * - 状態変更の全てをイベントとして記録
 * - イベントの不変性保証
 * - 型安全なイベント発行・購読
 */

import type * as WorldTypes from '@domain/world/types/core'
import * as Coordinates from '@domain/world/value_object/coordinates/index'
import { ChunkDataSchema } from '@domain/chunk'
import { JsonValueSchema, type JsonValue } from '@shared/schema/json'
import { Brand, Clock, Context, DateTime, Effect, Schema, Stream } from 'effect'
import {
  GenerationContextSchema,
  ContextMetadataSchema,
  UpdateSettingsCommandSchema,
  WorldGeneratorIdSchema,
  type GenerationContext,
  type UpdateSettingsCommand,
  type WorldGeneratorId,
} from './index'

// ================================
// Event Base Schema
// ================================

/**
 * 全イベントの基底スキーマ
 */
export const BaseEventSchema = Schema.Struct({
  eventId: Schema.String.pipe(Schema.brand('EventId')),
  aggregateId: Schema.String, // WorldGeneratorId
  aggregateVersion: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  timestamp: Schema.DateTimeUtc,
  correlationId: Schema.optional(Schema.String.pipe(Schema.brand('CorrelationId'))),
  causationId: Schema.optional(Schema.String.pipe(Schema.brand('CausationId'))),
})

export type BaseEvent = typeof BaseEventSchema.Type

// ================================
// Domain Events
// ================================

/**
 * WorldGenerator作成イベント
 */
export const WorldGeneratorCreatedSchema = BaseEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('WorldGeneratorCreated'),
      payload: Schema.Struct({
        generatorId: WorldGeneratorIdSchema,
        context: GenerationContextSchema,
        metadata: ContextMetadataSchema,
      }),
    })
  )
)

export type WorldGeneratorCreated = typeof WorldGeneratorCreatedSchema.Type

/**
 * チャンク生成開始イベント
 */
export const ChunkGenerationStartedSchema = BaseEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('ChunkGenerationStarted'),
      payload: Schema.Struct({
        generatorId: WorldGeneratorIdSchema,
        coordinate: Coordinates.ChunkCoordinateSchema,
        priority: Schema.Number.pipe(Schema.between(1, 10)),
        options: Schema.optional(Schema.Record({ key: Schema.String, value: JsonValueSchema })),
        estimatedDuration: Schema.optional(Schema.Number),
      }),
    })
  )
)

export type ChunkGenerationStarted = typeof ChunkGenerationStartedSchema.Type

/**
 * チャンク生成完了イベント
 */
export const ChunkGeneratedSchema = BaseEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('ChunkGenerated'),
      payload: Schema.Struct({
        generatorId: WorldGeneratorIdSchema,
        coordinate: Coordinates.ChunkCoordinateSchema,
        chunkData: ChunkDataSchema,
        actualDuration: Schema.Number,
        performanceMetrics: Schema.Record({ key: Schema.String, value: Schema.Number }),
      }),
    })
  )
)

export type ChunkGenerated = typeof ChunkGeneratedSchema.Type

/**
 * チャンク生成失敗イベント
 */
export const ChunkGenerationFailedSchema = BaseEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('ChunkGenerationFailed'),
      payload: Schema.Struct({
        generatorId: WorldGeneratorIdSchema,
        coordinate: Coordinates.ChunkCoordinateSchema,
        error: Schema.Struct({
          code: Schema.String,
          message: Schema.String,
          details: Schema.optional(Schema.Record({ key: Schema.String, value: JsonValueSchema })),
        }),
        attempt: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
        willRetry: Schema.Boolean,
      }),
    })
  )
)

export type ChunkGenerationFailed = typeof ChunkGenerationFailedSchema.Type

/**
 * 設定更新イベント
 */
export const SettingsUpdatedSchema = BaseEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('SettingsUpdated'),
      payload: Schema.Struct({
        generatorId: WorldGeneratorIdSchema,
        changes: UpdateSettingsCommandSchema,
        previousVersion: Schema.Number.pipe(Schema.int()),
        newVersion: Schema.Number.pipe(Schema.int()),
        reason: Schema.optional(Schema.String),
      }),
    })
  )
)

export type SettingsUpdated = typeof SettingsUpdatedSchema.Type

/**
 * ジェネレータ一時停止イベント
 */
export const GeneratorPausedSchema = BaseEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('GeneratorPaused'),
      payload: Schema.Struct({
        generatorId: WorldGeneratorIdSchema,
        reason: Schema.String,
        activeGenerations: Schema.Array(Coordinates.ChunkCoordinateSchema),
        resumeAt: Schema.optional(Schema.DateTimeUtc),
      }),
    })
  )
)

export type GeneratorPaused = typeof GeneratorPausedSchema.Type

/**
 * ジェネレータ再開イベント
 */
export const GeneratorResumedSchema = BaseEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('GeneratorResumed'),
      payload: Schema.Struct({
        generatorId: WorldGeneratorIdSchema,
        pausedDuration: Schema.Number, // ミリ秒
        restoredGenerations: Schema.Array(Coordinates.ChunkCoordinateSchema),
      }),
    })
  )
)

export type GeneratorResumed = typeof GeneratorResumedSchema.Type

/**
 * 統計更新イベント
 */
export const StatisticsUpdatedSchema = BaseEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('StatisticsUpdated'),
      payload: Schema.Struct({
        generatorId: Schema.String, // WorldGeneratorId
        statistics: Schema.Record({ key: Schema.String, value: Schema.Number }),
        deltaStatistics: Schema.Record({ key: Schema.String, value: Schema.Number }),
        updateTrigger: Schema.String, // 更新トリガーの説明
      }),
    })
  )
)

export type StatisticsUpdated = typeof StatisticsUpdatedSchema.Type

// ================================
// Union Type for All Events
// ================================

export const WorldGeneratorEventSchema = Schema.Union(
  WorldGeneratorCreatedSchema,
  ChunkGenerationStartedSchema,
  ChunkGeneratedSchema,
  ChunkGenerationFailedSchema,
  SettingsUpdatedSchema,
  GeneratorPausedSchema,
  GeneratorResumedSchema,
  StatisticsUpdatedSchema
)

export type WorldGeneratorEvent = typeof WorldGeneratorEventSchema.Type

// ================================
// Event Factory Functions
// ================================

/**
 * ユニークなイベントIDを生成
 */
const generateEventId = (): Effect.Effect<string & Brand.Brand<'EventId'>> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    const random = Math.random().toString(36).substr(2, 9)
    return Schema.decodeSync(Schema.String.pipe(Schema.brand('EventId')))(`evt_${timestamp}_${random}`)
  })

/**
 * WorldGeneratorCreatedイベント作成
 */
export const createWorldGeneratorCreated = (
  generatorId: WorldGeneratorId,
  context: GenerationContext,
  correlationId?: string
): Effect.Effect<WorldGeneratorCreated> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* DateTime.nowAsDate

    return Schema.decodeSync(WorldGeneratorCreatedSchema)({
      eventId,
      aggregateId: generatorId,
      aggregateVersion: 1,
      timestamp,
      correlationId,
      eventType: 'WorldGeneratorCreated',
      payload: {
        generatorId,
        context,
        metadata: context.metadata,
      },
    })
  })

/**
 * ChunkGenerationStartedイベント作成
 */
export const createChunkGenerationStarted = (
  generatorId: WorldGeneratorId,
  coordinate: Coordinates.ChunkCoordinate,
  priority: number,
  aggregateVersion: number,
  options?: Record<string, unknown>
): Effect.Effect<ChunkGenerationStarted> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* DateTime.nowAsDate
    const encodedOptions = options
      ? Schema.decodeSync(Schema.Record({ key: Schema.String, value: JsonValueSchema }))(options)
      : undefined

    return Schema.decodeSync(ChunkGenerationStartedSchema)({
      eventId,
      aggregateId: generatorId,
      aggregateVersion,
      timestamp,
      eventType: 'ChunkGenerationStarted',
      payload: {
        generatorId,
        coordinate,
        priority,
        options: encodedOptions,
      },
    })
  })

/**
 * ChunkGeneratedイベント作成
 */
export const createChunkGenerated = (
  generatorId: WorldGeneratorId,
  coordinate: Coordinates.ChunkCoordinate,
  chunkData: WorldTypes.ChunkData,
  aggregateVersion?: number
): Effect.Effect<ChunkGenerated> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* DateTime.nowAsDate

    // パフォーマンスメトリクス計算
    const performanceMetrics = {
      blocksGenerated: 16 * 16 * 256, // チャンクサイズ
      structureCount: chunkData.structures.length,
      biomeVariety: new Set(chunkData.biomes).size,
    }

    return Schema.decodeSync(ChunkGeneratedSchema)({
      eventId,
      aggregateId: generatorId,
      aggregateVersion: aggregateVersion ?? 1,
      timestamp,
      eventType: 'ChunkGenerated',
      payload: {
        generatorId,
        coordinate,
        chunkData,
        actualDuration: timestamp.getTime() - chunkData.generatedAt.getTime(),
        performanceMetrics,
      },
    })
  })

/**
 * ChunkGenerationFailedイベント作成
 */
export const createChunkGenerationFailed = (
  generatorId: WorldGeneratorId,
  coordinate: Coordinates.ChunkCoordinate,
  error: { code: string; message: string; details?: Record<string, unknown> },
  attempt: number,
  willRetry: boolean,
  aggregateVersion?: number
): Effect.Effect<ChunkGenerationFailed> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* DateTime.nowAsDate

    return Schema.decodeSync(ChunkGenerationFailedSchema)({
      eventId,
      aggregateId: generatorId,
      aggregateVersion: aggregateVersion ?? 1,
      timestamp,
      eventType: 'ChunkGenerationFailed',
      payload: {
        generatorId,
        coordinate,
        error: {
          ...error,
          details: error.details
            ? Schema.decodeSync(Schema.Record({ key: Schema.String, value: JsonValueSchema }))(error.details)
            : undefined,
        },
        attempt,
        willRetry,
      },
    })
  })

/**
 * SettingsUpdatedイベント作成
 */
export const createSettingsUpdated = (
  generatorId: WorldGeneratorId,
  command: UpdateSettingsCommand,
  previousVersion: number = 1,
  newVersion: number = 2
): Effect.Effect<SettingsUpdated> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* DateTime.nowAsDate

    return Schema.decodeSync(SettingsUpdatedSchema)({
      eventId,
      aggregateId: generatorId,
      aggregateVersion: newVersion,
      timestamp,
      eventType: 'SettingsUpdated',
      payload: {
        generatorId,
        changes: command,
        previousVersion,
        newVersion,
      },
    })
  })

// ================================
// Event Store Interface
// ================================

/**
 * イベントストアインターフェース
 */
export interface EventStore {
  readonly save: (events: readonly WorldGeneratorEvent[]) => Effect.Effect<void, Error>

  readonly load: (aggregateId: string, fromVersion?: number) => Stream.Stream<WorldGeneratorEvent, Error>

  readonly loadAll: () => Stream.Stream<WorldGeneratorEvent, Error>

  readonly getSnapshot: (aggregateId: string) => Effect.Effect<WorldGeneratorEvent | null, Error>
}

export const EventStoreTag = Context.GenericTag<EventStore>('@minecraft/domain/world/EventStore')

// ================================
// Event Publisher
// ================================

/**
 * イベント発行者
 */
export interface EventPublisher {
  readonly publish: (event: WorldGeneratorEvent) => Effect.Effect<void, Error>
  readonly subscribe: (eventType: WorldGeneratorEvent['eventType']) => Stream.Stream<WorldGeneratorEvent, Error>
}

export const EventPublisherTag = Context.GenericTag<EventPublisher>('@minecraft/domain/world/EventPublisher')

// ================================
// Event Service
// ================================

/**
 * イベント発行
 */
export const publish = (event: WorldGeneratorEvent): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const publisher = yield* EventPublisherTag
    yield* publisher.publish(event)
  })

/**
 * イベント購読
 */
export const subscribe = (
  eventType: WorldGeneratorEvent['eventType']
): Effect.Effect<Stream.Stream<WorldGeneratorEvent, Error>, Error> =>
  Effect.gen(function* () {
    const publisher = yield* EventPublisherTag
    return publisher.subscribe(eventType)
  })

/**
 * イベント保存
 */
export const saveEvents = (events: readonly WorldGeneratorEvent[]): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const store = yield* EventStoreTag
    yield* store.save(events)
  })

/**
 * イベント読み込み
 */
export const loadEvents = (
  aggregateId: string,
  fromVersion?: number
): Effect.Effect<Stream.Stream<WorldGeneratorEvent, Error>, Error> =>
  Effect.gen(function* () {
    const store = yield* EventStoreTag
    return store.load(aggregateId, fromVersion)
  })

// ================================
// In-Memory Event Store Implementation
// ================================

/**
 * インメモリイベントストア実装 (開発・テスト用)
 */
export const InMemoryEventStore: EventStore = {
  save: (events) =>
    Effect.gen(function* () {
      // 実装はシンプルな配列に保存
      // 本番環境では永続化ストレージを使用
      yield* Effect.log(`Saving ${events.length} events`)
    }),

  load: (aggregateId, fromVersion) => Stream.empty, // プレースホルダー実装

  loadAll: () => Stream.empty, // プレースホルダー実装

  getSnapshot: (aggregateId) => Effect.succeed(null), // プレースホルダー実装
}

/**
 * インメモリイベント発行者実装 (開発・テスト用)
 */
export const InMemoryEventPublisher: EventPublisher = {
  publish: (event) =>
    Effect.gen(function* () {
      yield* Effect.log(`Publishing event: ${event.eventType}`)
    }),

  subscribe: (eventType) => Stream.empty, // プレースホルダー実装
}

// ================================
// Exports
// ================================

export { type BaseEvent, type EventPublisher, type EventStore }
