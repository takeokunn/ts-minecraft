/**
 * @fileoverview GenerationSession Aggregate Root - 生成セッション管理
 *
 * チャンク生成の一連のプロセスを管理する集約ルートです。
 * - セッションライフサイクル管理
 * - 進捗追跡とレポート
 * - エラー回復とリトライ
 * - グレースフルな中断・再開
 */

import type * as WorldTypes from '@domain/world/types/core'
import type * as GenerationErrors from '@domain/world/types/errors'
import type { JsonValue } from '@shared/schema/json'
import { Chunk, Context, DateTime, Effect, Match, Option, pipe, ReadonlyArray, STM } from 'effect'
import * as ErrorHandling from './index'
import * as ProgressTracking from './index'
import * as SessionEvents from './index'
import * as SessionState from './index'
import {
  type GenerationRequest,
  type GenerationSession,
  type GenerationSessionId,
  type SessionConfiguration,
} from './index'

// ================================
// Session Operations
// ================================

/**
 * 生成セッション作成
 */
export const create = (
  id: GenerationSessionId,
  worldGeneratorId: string,
  request: GenerationRequest,
  configuration?: Partial<SessionConfiguration>
): Effect.Effect<GenerationSession, GenerationErrors.CreationError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.nowAsDate

    // デフォルト設定のマージ
    const defaultConfig: SessionConfiguration = {
      maxConcurrentChunks: 4,
      chunkBatchSize: 16,
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: 'exponential',
        baseDelayMs: 1000,
        maxDelayMs: 30000,
      },
      timeoutPolicy: {
        chunkTimeoutMs: 30000,
        sessionTimeoutMs: 300000,
        gracefulShutdownMs: 10000,
      },
      priorityPolicy: {
        enablePriorityQueuing: true,
        priorityThreshold: 7,
        highPriorityWeight: 2.0,
      },
    }

    const mergedConfig: SessionConfiguration = {
      ...defaultConfig,
      ...configuration,
    }

    // 要求検証
    yield* validateGenerationRequest(request)
    yield* validateConfiguration(mergedConfig)

    const state = yield* SessionState.createInitial()
    const metadataRecord: Record<string, JsonValue> | undefined = request.metadata ? { ...request.metadata } : undefined

    const session: GenerationSession = {
      id,
      worldGeneratorId,
      configuration: mergedConfig,
      request,
      state,
      progress: ProgressTracking.createInitial(request.coordinates.length),
      errorHistory: [],
      version: 0,
      createdAt: now,
      lastActivity: now,
    }

    // 作成イベント発行
    yield* SessionEvents.publish(
      SessionEvents.createSessionCreated(id, worldGeneratorId, request, mergedConfig, metadataRecord)
    )

    return session
  })

/**
 * セッション開始
 */
export const start = (session: GenerationSession): STM.STM<GenerationSession, GenerationErrors.SessionError> =>
  STM.gen(function* () {
    yield* pipe(
      Match.value(session.state.status),
      Match.when('created', () => STM.unit),
      Match.orElse((status) => STM.fail(GenerationErrors.createSessionError(`Cannot start session in ${status} state`)))
    )

    const now = yield* STM.fromEffect(DateTime.nowAsDate)

    // バッチ作成
    const batches = yield* STM.fromEffect(createChunkBatches(session))

    const updatedState = yield* STM.fromEffect(SessionState.startSession(session.state, batches))
    const updatedProgress = ProgressTracking.startTracking(session.progress)

    const updatedSession: GenerationSession = {
      ...session,
      state: updatedState,
      progress: updatedProgress,
      version: session.version + 1,
      startedAt: now,
      lastActivity: now,
    }

    // 開始イベント発行
    const totalChunks = batches.reduce((sum, batch) => sum + batch.coordinates.length, 0)

    yield* STM.fromEffect(
      SessionEvents.publish(SessionEvents.createSessionStarted(session.id, batches.length, totalChunks))
    )

    return updatedSession
  })

/**
 * チャンクバッチ完了処理
 */
export const completeBatch = (
  session: GenerationSession,
  batchId: string,
  results: readonly WorldTypes.ChunkData[]
): STM.STM<GenerationSession, GenerationErrors.SessionError> =>
  STM.gen(function* () {
    // バッチ状態更新
    const updatedState = yield* STM.fromEffect(SessionState.completeBatch(session.state, batchId, results))

    // 進捗更新
    const updatedProgress = yield* STM.fromEffect(ProgressTracking.updateProgress(session.progress, results.length, 0))

    const now = yield* STM.fromEffect(DateTime.nowAsDate)

    const updatedSession: GenerationSession = {
      ...session,
      state: updatedState,
      progress: updatedProgress,
      version: session.version + 1,
      lastActivity: now,
    }

    // セッション完了チェック
    return yield* pipe(
      Match.value(ProgressTracking.isCompleted(updatedProgress)),
      Match.when(true, () => completeSession(updatedSession)),
      Match.orElse(() =>
        STM.gen(function* () {
          yield* STM.fromEffect(
            SessionEvents.publish(
              SessionEvents.createBatchCompleted(session.id, batchId, results.length, 0, {
                chunksGenerated: results.length,
              })
            )
          )
          return updatedSession
        })
      )
    )
  })

/**
 * バッチ失敗処理
 */
export const failBatch = (
  session: GenerationSession,
  batchId: string,
  error: GenerationErrors.GenerationError
): STM.STM<GenerationSession, GenerationErrors.SessionError> =>
  STM.gen(function* () {
    const now = yield* STM.fromEffect(DateTime.nowAsDate)

    // エラーハンドリング
    const sessionError = yield* STM.fromEffect(ErrorHandling.createSessionError(error, batchId))
    const errorHistory = [...session.errorHistory, sessionError]

    // リトライ判定
    const shouldRetry = yield* STM.fromEffect(
      ErrorHandling.shouldRetryBatch(session.configuration.retryPolicy, sessionError)
    )

    const retryOutcome = yield* pipe(
      Match.value(shouldRetry),
      Match.when(true, () =>
        STM.map(STM.fromEffect(SessionState.scheduleRetry(session.state, batchId)), (nextState) => ({
          state: nextState,
          progress: session.progress,
        }))
      ),
      Match.orElse(() =>
        STM.gen(function* () {
          const failedState = yield* STM.fromEffect(SessionState.failBatch(session.state, batchId, sessionError))
          const batch = SessionState.getBatch(session.state, batchId)
          const updatedProgress = yield* pipe(
            Option.fromNullable(batch),
            Option.match({
              onNone: () => STM.succeed(session.progress),
              onSome: (existingBatch) =>
                STM.fromEffect(ProgressTracking.updateProgress(session.progress, 0, existingBatch.coordinates.length)),
            })
          )
          return { state: failedState, progress: updatedProgress }
        })
      )
    )

    const updatedSession: GenerationSession = {
      ...session,
      state: retryOutcome.state,
      progress: retryOutcome.progress,
      errorHistory,
      version: session.version + 1,
      lastActivity: now,
    }

    // 失敗イベント発行
    yield* STM.fromEffect(
      SessionEvents.publish(SessionEvents.createBatchFailed(session.id, batchId, sessionError, shouldRetry))
    )

    return updatedSession
  })

/**
 * セッション一時停止
 */
export const pause = (
  session: GenerationSession,
  reason: string
): Effect.Effect<GenerationSession, GenerationErrors.SessionError> =>
  Effect.gen(function* () {
    yield* pipe(
      Match.value(session.state.status),
      Match.when('running', () => Effect.void),
      Match.orElse((status) =>
        Effect.fail(GenerationErrors.createSessionError(`Cannot pause session in ${status} state`))
      )
    )

    const now = yield* DateTime.nowAsDate

    const updatedState = yield* SessionState.pauseSession(session.state, reason)
    const updatedProgress = ProgressTracking.pauseTracking(session.progress)

    const updatedSession: GenerationSession = {
      ...session,
      state: updatedState,
      progress: updatedProgress,
      version: session.version + 1,
      lastActivity: now,
    }

    // 一時停止イベント発行
    const activeBatchIds = Object.keys(updatedState.executionContext.activeBatches)
    yield* SessionEvents.publish(
      SessionEvents.createSessionPaused(session.id, reason, activeBatchIds, updatedProgress.statistics)
    )

    return updatedSession
  })

/**
 * セッション再開
 */
export const resume = (session: GenerationSession): Effect.Effect<GenerationSession, GenerationErrors.SessionError> =>
  Effect.gen(function* () {
    yield* pipe(
      Match.value(session.state.status),
      Match.when('paused', () => Effect.void),
      Match.orElse((status) =>
        Effect.fail(GenerationErrors.createSessionError(`Cannot resume session in ${status} state`))
      )
    )

    const now = yield* DateTime.nowAsDate

    const updatedState = yield* SessionState.resumeSession(session.state)
    const updatedProgress = ProgressTracking.resumeTracking(session.progress)

    const updatedSession: GenerationSession = {
      ...session,
      state: updatedState,
      progress: updatedProgress,
      version: session.version + 1,
      lastActivity: now,
    }

    // 再開イベント発行
    const pausedDuration =
      session.state.lastStateChange != null ? now.getTime() - session.state.lastStateChange.getTime() : 0
    const remainingBatches = updatedState.executionContext.queuedBatches.length

    yield* SessionEvents.publish(SessionEvents.createSessionResumed(session.id, pausedDuration, remainingBatches))

    return updatedSession
  })

/**
 * セッション完了処理
 */
const completeSession = (session: GenerationSession): STM.STM<GenerationSession, GenerationErrors.SessionError> =>
  STM.gen(function* () {
    const now = yield* STM.fromEffect(DateTime.nowAsDate)

    const updatedState = yield* STM.fromEffect(SessionState.completeSession(session.state))
    const updatedProgress = ProgressTracking.completeTracking(session.progress)

    const completedSession: GenerationSession = {
      ...session,
      state: updatedState,
      progress: updatedProgress,
      version: session.version + 1,
      completedAt: now,
      lastActivity: now,
    }

    const startedAt = completedSession.startedAt ?? completedSession.createdAt
    const totalDuration = completedSession.completedAt
      ? completedSession.completedAt.getTime() - startedAt.getTime()
      : 0
    const totalBatchesCount =
      completedSession.state.executionContext.completedBatches.length +
      completedSession.state.executionContext.failedBatches.length
    const failedBatchesCount = completedSession.state.executionContext.failedBatches.length

    // 完了イベント発行
    yield* STM.fromEffect(
      SessionEvents.publish(
        SessionEvents.createSessionCompleted(session.id, updatedProgress.statistics, totalDuration, {
          totalBatches: totalBatchesCount,
          failedBatches: failedBatchesCount,
        })
      )
    )

    return completedSession
  })

// ================================
// Helper Functions
// ================================

/**
 * チャンクバッチ作成
 */
const createChunkBatches = (
  session: GenerationSession
): Effect.Effect<readonly SessionState.ChunkBatch[], GenerationErrors.SessionError> =>
  Effect.gen(function* () {
    const { coordinates } = session.request
    const { chunkBatchSize, priorityPolicy } = session.configuration

    // 優先度でソート
    const sortedCoordinates = priorityPolicy.enablePriorityQueuing
      ? coordinates.sort((a, b) => session.request.priority - session.request.priority)
      : coordinates

    // バッチに分割
    const chunks = Chunk.fromIterable(sortedCoordinates)
    const batchChunks = Chunk.chunksOf(chunks, chunkBatchSize)

    const now = yield* DateTime.nowAsDate

    return ReadonlyArray.mapWithIndex(Chunk.toReadonlyArray(batchChunks), (batchChunk, batchIndex) => {
      const batchId = `batch_${session.id}_${batchIndex}`
      return {
        id: batchId,
        coordinates: Chunk.toReadonlyArray(batchChunk),
        priority: session.request.priority,
        status: 'pending' as const,
        createdAt: now,
        attempts: 0,
      } satisfies SessionState.ChunkBatch
    })
  })

/**
 * 生成要求の検証
 */
const validateGenerationRequest = (request: GenerationRequest): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    yield* pipe(
      Match.value(request.coordinates.length === 0),
      Match.when(true, () =>
        Effect.fail(GenerationErrors.createValidationError('Generation request must contain at least one coordinate'))
      ),
      Match.orElse(() => Effect.void)
    )

    yield* pipe(
      Match.value(request.coordinates.length > 10000),
      Match.when(true, () =>
        Effect.fail(
          GenerationErrors.createValidationError('Generation request contains too many coordinates (max: 10000)')
        )
      ),
      Match.orElse(() => Effect.void)
    )

    const uniqueCoords = new Set(request.coordinates.map((coord) => `${coord.x},${coord.z}`))

    yield* pipe(
      Match.value(uniqueCoords.size !== request.coordinates.length),
      Match.when(true, () =>
        Effect.fail(GenerationErrors.createValidationError('Generation request contains duplicate coordinates'))
      ),
      Match.orElse(() => Effect.void)
    )
  })

/**
 * 設定の検証
 */
const validateConfiguration = (config: SessionConfiguration): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    yield* pipe(
      Match.value(config.retryPolicy.baseDelayMs > config.retryPolicy.maxDelayMs),
      Match.when(true, () =>
        Effect.fail(GenerationErrors.createValidationError('Base delay cannot be greater than max delay'))
      ),
      Match.orElse(() => Effect.void)
    )

    yield* pipe(
      Match.value(config.timeoutPolicy.chunkTimeoutMs > config.timeoutPolicy.sessionTimeoutMs),
      Match.when(true, () =>
        Effect.fail(GenerationErrors.createValidationError('Chunk timeout cannot be greater than session timeout'))
      ),
      Match.orElse(() => Effect.void)
    )
  })

// ================================
// Context.GenericTag
// ================================

export const GenerationSessionTag = Context.GenericTag<{
  readonly create: (
    id: GenerationSessionId,
    worldGeneratorId: string,
    request: GenerationRequest,
    configuration?: Partial<SessionConfiguration>
  ) => Effect.Effect<GenerationSession, GenerationErrors.CreationError>

  readonly start: (session: GenerationSession) => STM.STM<GenerationSession, GenerationErrors.SessionError>

  readonly completeBatch: (
    session: GenerationSession,
    batchId: string,
    results: readonly WorldTypes.ChunkData[]
  ) => STM.STM<GenerationSession, GenerationErrors.SessionError>

  readonly failBatch: (
    session: GenerationSession,
    batchId: string,
    error: GenerationErrors.GenerationError
  ) => STM.STM<GenerationSession, GenerationErrors.SessionError>

  readonly pause: (
    session: GenerationSession,
    reason: string
  ) => Effect.Effect<GenerationSession, GenerationErrors.SessionError>

  readonly resume: (session: GenerationSession) => Effect.Effect<GenerationSession, GenerationErrors.SessionError>
}>('@minecraft/domain/world/aggregate/GenerationSession')

// ================================
// Service Implementation
// ================================

export const GenerationSessionLive = GenerationSessionTag.of({
  create,
  start,
  completeBatch,
  failBatch,
  pause,
  resume,
})

// ================================
// Exports
// ================================

export { type GenerationRequest, type SessionConfiguration }
