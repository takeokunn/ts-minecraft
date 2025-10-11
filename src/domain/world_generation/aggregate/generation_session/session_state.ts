/**
 * @fileoverview Session State - セッション状態管理
 *
 * 生成セッションの状態を管理します。
 * - セッション状態の遷移
 * - バッチ管理
 * - 並行処理制御
 */

import { ChunkDataSchema } from '@domain/chunk'
import type * as WorldTypes from '@domain/world/types/core'
import type * as GenerationErrors from '@domain/world/types/errors'
import * as Coordinates from '@domain/world/value_object/coordinates/index'
import { DateTime, Effect, Schema } from 'effect'

// ================================
// Session Status
// ================================

export const SessionStatusSchema = Schema.Literal(
  'created', // 作成済み
  'starting', // 開始中
  'running', // 実行中
  'paused', // 一時停止
  'completing', // 完了処理中
  'completed', // 完了
  'failed', // 失敗
  'cancelled' // キャンセル
)

export type SessionStatus = typeof SessionStatusSchema.Type

// ================================
// Batch Status
// ================================

export const BatchStatusSchema = Schema.Literal(
  'pending', // 待機中
  'queued', // キュー中
  'running', // 実行中
  'completed', // 完了
  'failed', // 失敗
  'retrying', // リトライ中
  'cancelled' // キャンセル
)

export type BatchStatus = typeof BatchStatusSchema.Type

// ================================
// Chunk Batch
// ================================

export const ChunkBatchSchema = Schema.Struct({
  id: Schema.String,
  coordinates: Schema.Array(Coordinates.ChunkCoordinateSchema),
  priority: Schema.Number.pipe(Schema.between(1, 10)),
  status: BatchStatusSchema,
  createdAt: Schema.DateTimeUtc,
  startedAt: Schema.optional(Schema.DateTimeUtc),
  completedAt: Schema.optional(Schema.DateTimeUtc),
  attempts: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  lastError: Schema.optional(Schema.String),
  results: Schema.optional(Schema.Array(ChunkDataSchema)),
  estimatedDuration: Schema.optional(Schema.Number),
  actualDuration: Schema.optional(Schema.Number),
  retryScheduledAt: Schema.optional(Schema.DateTimeUtc),
})

export type ChunkBatch = typeof ChunkBatchSchema.Type

// ================================
// Execution Context
// ================================

export const ExecutionContextSchema = Schema.Struct({
  activeBatches: Schema.Record({
    key: Schema.String, // Batch ID
    value: ChunkBatchSchema,
  }),
  queuedBatches: Schema.Array(Schema.String), // Batch IDs in queue order
  completedBatches: Schema.Array(Schema.String), // Completed batch IDs
  failedBatches: Schema.Array(Schema.String), // Failed batch IDs
  maxConcurrentBatches: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  currentConcurrency: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
})

export type ExecutionContext = typeof ExecutionContextSchema.Type

// ================================
// Session State
// ================================

export const SessionStateSchema = Schema.Struct({
  status: SessionStatusSchema,
  executionContext: ExecutionContextSchema,
  pauseReason: Schema.optional(Schema.String),
  cancellationToken: Schema.optional(Schema.String),
  lastStateChange: Schema.DateTimeUtc,
  stateHistory: Schema.Array(
    Schema.Struct({
      fromStatus: SessionStatusSchema,
      toStatus: SessionStatusSchema,
      timestamp: Schema.DateTimeUtc,
      reason: Schema.optional(Schema.String),
    })
  ),
})

export type SessionState = typeof SessionStateSchema.Type

// ================================
// State Operations
// ================================

/**
 * 初期状態作成
 */
export const createInitial = (): Effect.Effect<SessionState> =>
  Effect.gen(function* () {
    const lastStateChange = yield* DateTime.nowAsDate

    return {
      status: 'created',
      executionContext: {
        activeBatches: {},
        queuedBatches: [],
        completedBatches: [],
        failedBatches: [],
        maxConcurrentBatches: 4,
        currentConcurrency: 0,
      },
      lastStateChange,
      stateHistory: [],
    }
  })

/**
 * セッション開始
 */
export const startSession = (state: SessionState, batches: readonly ChunkBatch[]): Effect.Effect<SessionState> =>
  Effect.gen(function* () {
    const now = yield* DateTime.nowAsDate

    // バッチをキューに追加
    const queuedBatchIds = batches.map((batch) => batch.id)

    const newState: SessionState = {
      ...state,
      status: 'running',
      executionContext: {
        ...state.executionContext,
        queuedBatches: queuedBatchIds,
      },
      lastStateChange: now,
      stateHistory: [
        ...state.stateHistory,
        {
          fromStatus: state.status,
          toStatus: 'running',
          timestamp: now,
          reason: 'Session started',
        },
      ],
    }

    return newState
  })

/**
 * バッチ開始
 */
export const startBatch = (
  state: SessionState,
  batchId: string,
  batch: ChunkBatch
): Effect.Effect<SessionState, GenerationErrors.StateError> =>
  Effect.gen(function* () {
    // 並行性チェック
    if (state.executionContext.currentConcurrency >= state.executionContext.maxConcurrentBatches) {
      return yield* Effect.fail(
        GenerationErrors.createStateError(
          `Maximum concurrent batches (${state.executionContext.maxConcurrentBatches}) exceeded`
        )
      )
    }

    // キューからバッチを削除
    const queuedBatches = state.executionContext.queuedBatches.filter((id) => id !== batchId)

    const now = yield* DateTime.nowAsDate

    const startedBatch: ChunkBatch = {
      ...batch,
      status: 'running',
      startedAt: now,
      attempts: batch.attempts + 1,
    }

    const updatedState: SessionState = {
      ...state,
      executionContext: {
        ...state.executionContext,
        activeBatches: {
          ...state.executionContext.activeBatches,
          [batchId]: startedBatch,
        },
        queuedBatches,
        currentConcurrency: state.executionContext.currentConcurrency + 1,
      },
      lastStateChange: now,
    }

    return updatedState
  })

/**
 * バッチ完了
 */
export const completeBatch = (
  state: SessionState,
  batchId: string,
  results: readonly WorldTypes.ChunkData[]
): Effect.Effect<SessionState, GenerationErrors.StateError> =>
  Effect.gen(function* () {
    const activeBatch = state.executionContext.activeBatches[batchId]
    if (!activeBatch) {
      return yield* Effect.fail(GenerationErrors.createStateError(`Batch ${batchId} not found in active batches`))
    }

    const now = yield* DateTime.nowAsDate

    const completedBatch: ChunkBatch = {
      ...activeBatch,
      status: 'completed',
      completedAt: now,
      results,
      actualDuration: activeBatch.startedAt ? now.getTime() - activeBatch.startedAt.getTime() : undefined,
    }

    // アクティブバッチから削除し、完了バッチに追加
    const { [batchId]: _, ...remainingActiveBatches } = state.executionContext.activeBatches

    const updatedState: SessionState = {
      ...state,
      executionContext: {
        ...state.executionContext,
        activeBatches: remainingActiveBatches,
        completedBatches: [...state.executionContext.completedBatches, batchId],
        currentConcurrency: state.executionContext.currentConcurrency - 1,
      },
      lastStateChange: now,
    }

    return updatedState
  })

/**
 * バッチ失敗
 */
export const failBatch = (
  state: SessionState,
  batchId: string,
  error: GenerationErrors.GenerationError
): Effect.Effect<SessionState, GenerationErrors.StateError> =>
  Effect.gen(function* () {
    const activeBatch = state.executionContext.activeBatches[batchId]
    if (!activeBatch) {
      return yield* Effect.fail(GenerationErrors.createStateError(`Batch ${batchId} not found in active batches`))
    }

    const now = yield* DateTime.nowAsDate

    const failedBatch: ChunkBatch = {
      ...activeBatch,
      status: 'failed',
      completedAt: now,
      lastError: error.message ?? 'Unknown error',
    }

    // アクティブバッチから削除し、失敗バッチに追加
    const { [batchId]: _, ...remainingActiveBatches } = state.executionContext.activeBatches

    const updatedState: SessionState = {
      ...state,
      executionContext: {
        ...state.executionContext,
        activeBatches: remainingActiveBatches,
        failedBatches: [...state.executionContext.failedBatches, batchId],
        currentConcurrency: state.executionContext.currentConcurrency - 1,
      },
      lastStateChange: now,
    }

    return updatedState
  })

/**
 * リトライスケジュール
 */
export const scheduleRetry = (
  state: SessionState,
  batchId: string,
  retryAt?: Date
): Effect.Effect<SessionState, GenerationErrors.StateError> =>
  Effect.gen(function* () {
    const activeBatch = state.executionContext.activeBatches[batchId]
    if (!activeBatch) {
      return yield* Effect.fail(GenerationErrors.createStateError(`Batch ${batchId} not found in active batches`))
    }

    const now = yield* DateTime.nowAsDate
    const scheduleTime =
      retryAt ??
      DateTime.toDate(
        DateTime.unsafeMake(now.getTime() + 5_000) // 5秒後にデフォルト
      )

    const retryingBatch: ChunkBatch = {
      ...activeBatch,
      status: 'retrying',
      retryScheduledAt: scheduleTime,
    }

    // アクティブバッチから削除し、キューに戻す
    const { [batchId]: _, ...remainingActiveBatches } = state.executionContext.activeBatches

    const updatedState: SessionState = {
      ...state,
      executionContext: {
        ...state.executionContext,
        activeBatches: remainingActiveBatches,
        queuedBatches: [batchId, ...state.executionContext.queuedBatches], // 優先度を上げて先頭に
        currentConcurrency: state.executionContext.currentConcurrency - 1,
      },
      lastStateChange: now,
    }

    return updatedState
  })

/**
 * セッション一時停止
 */
export const pauseSession = (state: SessionState, reason: string): Effect.Effect<SessionState> =>
  Effect.gen(function* () {
    const now = yield* DateTime.nowAsDate

    return {
      ...state,
      status: 'paused',
      pauseReason: reason,
      lastStateChange: now,
      stateHistory: [
        ...state.stateHistory,
        {
          fromStatus: state.status,
          toStatus: 'paused',
          timestamp: now,
          reason,
        },
      ],
    }
  })

/**
 * セッション再開
 */
export const resumeSession = (state: SessionState): Effect.Effect<SessionState> =>
  Effect.gen(function* () {
    const now = yield* DateTime.nowAsDate

    return {
      ...state,
      status: 'running',
      pauseReason: undefined,
      lastStateChange: now,
      stateHistory: [
        ...state.stateHistory,
        {
          fromStatus: state.status,
          toStatus: 'running',
          timestamp: now,
          reason: 'Session resumed',
        },
      ],
    }
  })

/**
 * セッション完了
 */
export const completeSession = (state: SessionState): Effect.Effect<SessionState> =>
  Effect.gen(function* () {
    const now = yield* DateTime.nowAsDate

    return {
      ...state,
      status: 'completed',
      lastStateChange: now,
      stateHistory: [
        ...state.stateHistory,
        {
          fromStatus: state.status,
          toStatus: 'completed',
          timestamp: now,
          reason: 'All batches completed',
        },
      ],
    }
  })

/**
 * セッションキャンセル
 */
export const cancelSession = (
  state: SessionState,
  reason: string,
  cancellationToken: string
): Effect.Effect<SessionState> =>
  Effect.gen(function* () {
    const now = yield* DateTime.nowAsDate

    return {
      ...state,
      status: 'cancelled',
      pauseReason: reason,
      cancellationToken,
      lastStateChange: now,
      stateHistory: [
        ...state.stateHistory,
        {
          fromStatus: state.status,
          toStatus: 'cancelled',
          timestamp: now,
          reason,
        },
      ],
    }
  })

// ================================
// Query Functions
// ================================

/**
 * バッチ取得
 */
export const getBatch = (state: SessionState, batchId: string): ChunkBatch | null => {
  return state.executionContext.activeBatches[batchId] || null
}

/**
 * 実行可能なバッチ取得
 */
export const getNextExecutableBatch = (state: SessionState): string | null => {
  if (state.executionContext.currentConcurrency >= state.executionContext.maxConcurrentBatches) {
    return null
  }

  return state.executionContext.queuedBatches[0] || null
}

/**
 * 進捗統計取得
 */
export const getProgressStatistics = (
  state: SessionState
): {
  totalBatches: number
  completedBatches: number
  failedBatches: number
  activeBatches: number
  queuedBatches: number
  completionRate: number
} => {
  const completed = state.executionContext.completedBatches.length
  const failed = state.executionContext.failedBatches.length
  const active = Object.keys(state.executionContext.activeBatches).length
  const queued = state.executionContext.queuedBatches.length
  const total = completed + failed + active + queued

  return {
    totalBatches: total,
    completedBatches: completed,
    failedBatches: failed,
    activeBatches: active,
    queuedBatches: queued,
    completionRate: total > 0 ? completed / total : 0,
  }
}

/**
 * セッション完了チェック
 */
export const isSessionCompleted = (state: SessionState): boolean => {
  return (
    state.executionContext.queuedBatches.length === 0 &&
    Object.keys(state.executionContext.activeBatches).length === 0 &&
    (state.executionContext.completedBatches.length > 0 || state.executionContext.failedBatches.length > 0)
  )
}

// ================================
// Exports
// ================================

export { type BatchStatus, type ExecutionContext, type SessionStatus }
