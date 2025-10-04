/**
 * @fileoverview Session Events - セッションドメインイベント
 *
 * GenerationSessionのEvent Sourcing実装です。
 * - セッションライフサイクルイベント
 * - バッチ処理イベント
 * - エラー・回復イベント
 */

import { Brand, Context, Effect, Schema, Stream } from 'effect'
import type { SessionError } from './error_handling.js'
import type { GenerationRequest, GenerationSessionId } from './generation_session.js'
import type { ProgressStatistics } from './progress_tracking.js'

// ================================
// Base Event Schema
// ================================

export const BaseSessionEventSchema = Schema.Struct({
  eventId: Schema.String.pipe(Schema.brand('SessionEventId')),
  sessionId: Schema.String, // GenerationSessionId
  aggregateVersion: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  timestamp: Schema.DateTimeUtc,
  correlationId: Schema.optional(Schema.String.pipe(Schema.brand('CorrelationId'))),
  causationId: Schema.optional(Schema.String.pipe(Schema.brand('CausationId'))),
})

export type BaseSessionEvent = typeof BaseSessionEventSchema.Type

// ================================
// Session Lifecycle Events
// ================================

/**
 * セッション作成イベント
 */
export const SessionCreatedSchema = BaseSessionEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('SessionCreated'),
      payload: Schema.Struct({
        sessionId: Schema.String, // GenerationSessionId
        worldGeneratorId: Schema.String,
        request: Schema.Unknown, // GenerationRequestSchema
        configuration: Schema.Unknown, // SessionConfigurationSchema
        metadata: Schema.optional(
          Schema.Record({
            key: Schema.String,
            value: Schema.Unknown,
          })
        ),
      }),
    })
  )
)

export type SessionCreated = typeof SessionCreatedSchema.Type

/**
 * セッション開始イベント
 */
export const SessionStartedSchema = BaseSessionEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('SessionStarted'),
      payload: Schema.Struct({
        sessionId: Schema.String, // GenerationSessionId
        totalBatches: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
        totalChunks: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
        estimatedDuration: Schema.optional(Schema.Number), // ミリ秒
      }),
    })
  )
)

export type SessionStarted = typeof SessionStartedSchema.Type

/**
 * セッション一時停止イベント
 */
export const SessionPausedSchema = BaseSessionEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('SessionPaused'),
      payload: Schema.Struct({
        sessionId: Schema.String, // GenerationSessionId
        reason: Schema.String,
        activeBatches: Schema.Array(Schema.String), // バッチID配列
        progress: Schema.Unknown, // ProgressStatistics
      }),
    })
  )
)

export type SessionPaused = typeof SessionPausedSchema.Type

/**
 * セッション再開イベント
 */
export const SessionResumedSchema = BaseSessionEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('SessionResumed'),
      payload: Schema.Struct({
        sessionId: Schema.String, // GenerationSessionId
        pausedDuration: Schema.Number, // ミリ秒
        remainingBatches: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
      }),
    })
  )
)

export type SessionResumed = typeof SessionResumedSchema.Type

/**
 * セッション完了イベント
 */
export const SessionCompletedSchema = BaseSessionEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('SessionCompleted'),
      payload: Schema.Struct({
        sessionId: Schema.String, // GenerationSessionId
        finalStatistics: Schema.Unknown, // ProgressStatistics
        totalDuration: Schema.Number, // ミリ秒
        successRate: Schema.Number.pipe(Schema.between(0, 1)),
        summary: Schema.Struct({
          totalChunks: Schema.Number.pipe(Schema.int()),
          successfulChunks: Schema.Number.pipe(Schema.int()),
          failedChunks: Schema.Number.pipe(Schema.int()),
          totalBatches: Schema.Number.pipe(Schema.int()),
          failedBatches: Schema.Number.pipe(Schema.int()),
        }),
      }),
    })
  )
)

export type SessionCompleted = typeof SessionCompletedSchema.Type

/**
 * セッション失敗イベント
 */
export const SessionFailedSchema = BaseSessionEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('SessionFailed'),
      payload: Schema.Struct({
        sessionId: Schema.String, // GenerationSessionId
        error: Schema.Unknown, // SessionError
        progress: Schema.Unknown, // ProgressStatistics
        partialResults: Schema.Struct({
          completedBatches: Schema.Number.pipe(Schema.int()),
          completedChunks: Schema.Number.pipe(Schema.int()),
        }),
      }),
    })
  )
)

export type SessionFailed = typeof SessionFailedSchema.Type

// ================================
// Batch Processing Events
// ================================

/**
 * バッチ開始イベント
 */
export const BatchStartedSchema = BaseSessionEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('BatchStarted'),
      payload: Schema.Struct({
        sessionId: Schema.String, // GenerationSessionId
        batchId: Schema.String,
        chunkCount: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
        priority: Schema.Number.pipe(Schema.between(1, 10)),
        attempt: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
      }),
    })
  )
)

export type BatchStarted = typeof BatchStartedSchema.Type

/**
 * バッチ完了イベント
 */
export const BatchCompletedSchema = BaseSessionEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('BatchCompleted'),
      payload: Schema.Struct({
        sessionId: Schema.String, // GenerationSessionId
        batchId: Schema.String,
        chunksGenerated: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
        duration: Schema.Number, // ミリ秒
        performanceMetrics: Schema.Record({
          key: Schema.String,
          value: Schema.Number,
        }),
      }),
    })
  )
)

export type BatchCompleted = typeof BatchCompletedSchema.Type

/**
 * バッチ失敗イベント
 */
export const BatchFailedSchema = BaseSessionEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('BatchFailed'),
      payload: Schema.Struct({
        sessionId: Schema.String, // GenerationSessionId
        batchId: Schema.String,
        error: Schema.Unknown, // SessionError
        attempt: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
        willRetry: Schema.Boolean,
        retryScheduledAt: Schema.optional(Schema.DateTimeUtc),
      }),
    })
  )
)

export type BatchFailed = typeof BatchFailedSchema.Type

/**
 * バッチリトライイベント
 */
export const BatchRetriedSchema = BaseSessionEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('BatchRetried'),
      payload: Schema.Struct({
        sessionId: Schema.String, // GenerationSessionId
        batchId: Schema.String,
        retryAttempt: Schema.Number.pipe(Schema.int(), Schema.greaterThan(1)),
        previousError: Schema.Unknown, // SessionError
        retryDelay: Schema.Number, // ミリ秒
      }),
    })
  )
)

export type BatchRetried = typeof BatchRetriedSchema.Type

// ================================
// Progress Events
// ================================

/**
 * 進捗更新イベント
 */
export const ProgressUpdatedSchema = BaseSessionEventSchema.pipe(
  Schema.extend(
    Schema.Struct({
      eventType: Schema.Literal('ProgressUpdated'),
      payload: Schema.Struct({
        sessionId: Schema.String, // GenerationSessionId
        progress: Schema.Unknown, // ProgressStatistics
        milestone: Schema.optional(
          Schema.Struct({
            percentage: Schema.Number.pipe(Schema.between(0, 100)),
            description: Schema.String,
          })
        ),
        eta: Schema.optional(Schema.DateTimeUtc),
      }),
    })
  )
)

export type ProgressUpdated = typeof ProgressUpdatedSchema.Type

// ================================
// Union Type for All Events
// ================================

export const SessionEventSchema = Schema.Union(
  SessionCreatedSchema,
  SessionStartedSchema,
  SessionPausedSchema,
  SessionResumedSchema,
  SessionCompletedSchema,
  SessionFailedSchema,
  BatchStartedSchema,
  BatchCompletedSchema,
  BatchFailedSchema,
  BatchRetriedSchema,
  ProgressUpdatedSchema
)

export type SessionEvent = typeof SessionEventSchema.Type

// ================================
// Event Factory Functions
// ================================

/**
 * ユニークなイベントIDを生成
 */
const generateEventId = (): Effect.Effect<string & Brand.Brand<'SessionEventId'>> =>
  Effect.sync(() => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return Schema.decodeSync(Schema.String.pipe(Schema.brand('SessionEventId')))(`sevt_${timestamp}_${random}`)
  })

/**
 * SessionCreatedイベント作成
 */
export const createSessionCreated = (
  sessionId: GenerationSessionId,
  worldGeneratorId: string,
  request: GenerationRequest,
  correlationId?: string
): Effect.Effect<SessionCreated> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* Effect.sync(() => new Date())

    return Schema.decodeSync(SessionCreatedSchema)({
      eventId,
      sessionId,
      aggregateVersion: 1,
      timestamp,
      correlationId,
      eventType: 'SessionCreated',
      payload: {
        sessionId,
        worldGeneratorId,
        request,
        configuration: {}, // 実際の設定を渡す
      },
    })
  })

/**
 * SessionStartedイベント作成
 */
export const createSessionStarted = (
  sessionId: GenerationSessionId,
  totalBatches: number,
  aggregateVersion: number = 2
): Effect.Effect<SessionStarted> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* Effect.sync(() => new Date())

    return Schema.decodeSync(SessionStartedSchema)({
      eventId,
      sessionId,
      aggregateVersion,
      timestamp,
      eventType: 'SessionStarted',
      payload: {
        sessionId,
        totalBatches,
        totalChunks: totalBatches * 16, // 仮定: バッチあたり16チャンク
      },
    })
  })

/**
 * SessionPausedイベント作成
 */
export const createSessionPaused = (
  sessionId: GenerationSessionId,
  reason: string,
  aggregateVersion?: number
): Effect.Effect<SessionPaused> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* Effect.sync(() => new Date())

    return Schema.decodeSync(SessionPausedSchema)({
      eventId,
      sessionId,
      aggregateVersion: aggregateVersion ?? 1,
      timestamp,
      eventType: 'SessionPaused',
      payload: {
        sessionId,
        reason,
        activeBatches: [], // 実際のアクティブバッチIDを渡す
        progress: {}, // 実際の進捗を渡す
      },
    })
  })

/**
 * SessionResumedイベント作成
 */
export const createSessionResumed = (
  sessionId: GenerationSessionId,
  aggregateVersion?: number
): Effect.Effect<SessionResumed> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* Effect.sync(() => new Date())

    return Schema.decodeSync(SessionResumedSchema)({
      eventId,
      sessionId,
      aggregateVersion: aggregateVersion ?? 1,
      timestamp,
      eventType: 'SessionResumed',
      payload: {
        sessionId,
        pausedDuration: 0, // 実際の一時停止時間を計算
        remainingBatches: 0, // 実際の残りバッチ数を渡す
      },
    })
  })

/**
 * SessionCompletedイベント作成
 */
export const createSessionCompleted = (
  sessionId: GenerationSessionId,
  statistics: ProgressStatistics,
  aggregateVersion?: number
): Effect.Effect<SessionCompleted> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* Effect.sync(() => new Date())

    return Schema.decodeSync(SessionCompletedSchema)({
      eventId,
      sessionId,
      aggregateVersion: aggregateVersion ?? 1,
      timestamp,
      eventType: 'SessionCompleted',
      payload: {
        sessionId,
        finalStatistics: statistics,
        totalDuration: 0, // 実際の実行時間を計算
        successRate: statistics.successRate,
        summary: {
          totalChunks: statistics.totalChunks,
          successfulChunks: statistics.completedChunks,
          failedChunks: statistics.failedChunks,
          totalBatches: 0, // 実際のバッチ数を渡す
          failedBatches: 0, // 実際の失敗バッチ数を渡す
        },
      },
    })
  })

/**
 * BatchCompletedイベント作成
 */
export const createBatchCompleted = (
  sessionId: GenerationSessionId,
  batchId: string,
  chunksGenerated: number,
  aggregateVersion?: number
): Effect.Effect<BatchCompleted> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* Effect.sync(() => new Date())

    return Schema.decodeSync(BatchCompletedSchema)({
      eventId,
      sessionId,
      aggregateVersion: aggregateVersion ?? 1,
      timestamp,
      eventType: 'BatchCompleted',
      payload: {
        sessionId,
        batchId,
        chunksGenerated,
        duration: 0, // 実際の実行時間を計算
        performanceMetrics: {
          chunksPerSecond: 0, // 実際のメトリクスを計算
        },
      },
    })
  })

/**
 * BatchFailedイベント作成
 */
export const createBatchFailed = (
  sessionId: GenerationSessionId,
  batchId: string,
  error: SessionError,
  willRetry: boolean,
  aggregateVersion?: number
): Effect.Effect<BatchFailed> =>
  Effect.gen(function* () {
    const eventId = yield* generateEventId()
    const timestamp = yield* Effect.sync(() => new Date())

    return Schema.decodeSync(BatchFailedSchema)({
      eventId,
      sessionId,
      aggregateVersion: aggregateVersion ?? 1,
      timestamp,
      eventType: 'BatchFailed',
      payload: {
        sessionId,
        batchId,
        error,
        attempt: error.context.attempt,
        willRetry,
        retryScheduledAt: willRetry ? new Date(timestamp.getTime() + 5000) : undefined,
      },
    })
  })

// ================================
// Event Services
// ================================

/**
 * セッションイベント発行者
 */
export interface SessionEventPublisher {
  readonly publish: (event: SessionEvent) => Effect.Effect<void, Error>
  readonly subscribe: (eventType: SessionEvent['eventType']) => Stream.Stream<SessionEvent, Error>
}

export const SessionEventPublisherTag = Context.GenericTag<SessionEventPublisher>(
  '@minecraft/domain/world/SessionEventPublisher'
)

/**
 * イベント発行
 */
export const publish = (event: SessionEvent): Effect.Effect<void, Error> =>
  Effect.gen(function* () {
    const publisher = yield* SessionEventPublisherTag
    yield* publisher.publish(event)
  })

/**
 * イベント購読
 */
export const subscribe = (
  eventType: SessionEvent['eventType']
): Effect.Effect<Stream.Stream<SessionEvent, Error>, Error> =>
  Effect.gen(function* () {
    const publisher = yield* SessionEventPublisherTag
    return publisher.subscribe(eventType)
  })

// ================================
// In-Memory Implementation
// ================================

export const InMemorySessionEventPublisher: SessionEventPublisher = {
  publish: (event) =>
    Effect.gen(function* () {
      yield* Effect.log(`Publishing session event: ${event.eventType} for session ${event.sessionId}`)
    }),

  subscribe: (eventType) => Stream.empty, // プレースホルダー実装
}

// ================================
// Exports
// ================================

export { type BaseSessionEvent, type SessionEventPublisher }
