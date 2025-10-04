/**
 * @fileoverview GenerationSession Aggregate Root - 生成セッション管理
 *
 * チャンク生成の一連のプロセスを管理する集約ルートです。
 * - セッションライフサイクル管理
 * - 進捗追跡とレポート
 * - エラー回復とリトライ
 * - グレースフルな中断・再開
 */

import { Context, Effect, Schema, STM, Brand, Chunk, Duration } from "effect"
import * as Coordinates from "../../value_object/coordinates/index.js"
import * as WorldSeed from "../../value_object/world_seed/index.js"
import * as SessionState from "./session_state.js"
import * as ProgressTracking from "./progress_tracking.js"
import * as ErrorHandling from "./error_handling.js"
import * as SessionEvents from "./events.js"
import type * as WorldTypes from "../../types/core/world_types.js"
import type * as GenerationErrors from "../../types/errors/generation_errors.js"

// ================================
// Session Identifier
// ================================

export type GenerationSessionId = string & Brand.Brand<'GenerationSessionId'>

export const GenerationSessionIdSchema = Schema.String.pipe(
  Schema.nonEmptyString(),
  Schema.brand('GenerationSessionId'),
  Schema.annotations({
    title: 'GenerationSessionId',
    description: 'Unique identifier for generation session',
    examples: ['gs_12345678-1234-5678-9abc-123456789abc']
  })
)

export const createGenerationSessionId = (value: string): GenerationSessionId =>
  Schema.decodeSync(GenerationSessionIdSchema)(value)

// ================================
// Session Configuration
// ================================

export const SessionConfigurationSchema = Schema.Struct({
  maxConcurrentChunks: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 16),
    Schema.annotations({ description: "Maximum chunks to generate simultaneously" })
  ),
  chunkBatchSize: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 64),
    Schema.annotations({ description: "Number of chunks to process in one batch" })
  ),
  retryPolicy: Schema.Struct({
    maxAttempts: Schema.Number.pipe(Schema.int(), Schema.between(1, 10)),
    backoffStrategy: Schema.Literal("linear", "exponential", "constant"),
    baseDelayMs: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    maxDelayMs: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  }),
  timeoutPolicy: Schema.Struct({
    chunkTimeoutMs: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    sessionTimeoutMs: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    gracefulShutdownMs: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  }),
  priorityPolicy: Schema.Struct({
    enablePriorityQueuing: Schema.Boolean,
    priorityThreshold: Schema.Number.pipe(Schema.between(1, 10)),
    highPriorityWeight: Schema.Number.pipe(Schema.between(1.0, 10.0)),
  }),
})

export type SessionConfiguration = typeof SessionConfigurationSchema.Type

// ================================
// Session Request
// ================================

export const GenerationRequestSchema = Schema.Struct({
  coordinates: Schema.Array(Coordinates.ChunkCoordinateSchema),
  priority: Schema.Number.pipe(Schema.between(1, 10)),
  options: Schema.optional(Schema.Struct({
    includeStructures: Schema.Boolean,
    includeCaves: Schema.Boolean,
    includeOres: Schema.Boolean,
    generateVegetation: Schema.Boolean,
    applyPostProcessing: Schema.Boolean,
  })),
  metadata: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  })),
})

export type GenerationRequest = typeof GenerationRequestSchema.Type

// ================================
// GenerationSession Aggregate
// ================================

export const GenerationSessionSchema = Schema.Struct({
  id: GenerationSessionIdSchema,
  worldGeneratorId: Schema.String, // WorldGeneratorId参照
  configuration: SessionConfigurationSchema,
  request: GenerationRequestSchema,
  state: SessionState.SessionStateSchema,
  progress: ProgressTracking.ProgressDataSchema,
  errorHistory: Schema.Array(ErrorHandling.SessionErrorSchema),
  version: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  createdAt: Schema.DateTimeUtc,
  startedAt: Schema.optional(Schema.DateTimeUtc),
  completedAt: Schema.optional(Schema.DateTimeUtc),
  lastActivity: Schema.DateTimeUtc,
})

export type GenerationSession = typeof GenerationSessionSchema.Type

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
    const now = yield* Effect.sync(() => new Date())

    // デフォルト設定のマージ
    const defaultConfig: SessionConfiguration = {
      maxConcurrentChunks: 4,
      chunkBatchSize: 16,
      retryPolicy: {
        maxAttempts: 3,
        backoffStrategy: "exponential",
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

    const session: GenerationSession = {
      id,
      worldGeneratorId,
      configuration: mergedConfig,
      request,
      state: SessionState.createInitial(),
      progress: ProgressTracking.createInitial(request.coordinates.length),
      errorHistory: [],
      version: 0,
      createdAt: now,
      lastActivity: now,
    }

    // 作成イベント発行
    yield* SessionEvents.publish(
      SessionEvents.createSessionCreated(id, worldGeneratorId, request)
    )

    return session
  })

/**
 * セッション開始
 */
export const start = (
  session: GenerationSession
): STM.STM<GenerationSession, GenerationErrors.SessionError> =>
  STM.gen(function* () {
    // 状態チェック
    if (session.state.status !== "created") {
      return yield* STM.fail(
        GenerationErrors.createSessionError(`Cannot start session in ${session.state.status} state`)
      )
    }

    const now = yield* STM.fromEffect(Effect.sync(() => new Date()))

    // バッチ作成
    const batches = yield* STM.fromEffect(createChunkBatches(session))

    const updatedState = SessionState.startSession(session.state, batches)
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
    yield* STM.fromEffect(
      SessionEvents.publish(
        SessionEvents.createSessionStarted(session.id, batches.length)
      )
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
    const updatedState = yield* STM.fromEffect(
      SessionState.completeBatch(session.state, batchId, results)
    )

    // 進捗更新
    const updatedProgress = yield* STM.fromEffect(
      ProgressTracking.updateProgress(session.progress, results.length, 0)
    )

    const now = yield* STM.fromEffect(Effect.sync(() => new Date()))

    const updatedSession: GenerationSession = {
      ...session,
      state: updatedState,
      progress: updatedProgress,
      version: session.version + 1,
      lastActivity: now,
    }

    // セッション完了チェック
    if (ProgressTracking.isCompleted(updatedProgress)) {
      return yield* completeSession(updatedSession)
    }

    // バッチ完了イベント発行
    yield* STM.fromEffect(
      SessionEvents.publish(
        SessionEvents.createBatchCompleted(session.id, batchId, results.length)
      )
    )

    return updatedSession
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
    const now = yield* STM.fromEffect(Effect.sync(() => new Date()))

    // エラーハンドリング
    const sessionError = ErrorHandling.createSessionError(error, batchId)
    const errorHistory = [...session.errorHistory, sessionError]

    // リトライ判定
    const shouldRetry = yield* STM.fromEffect(
      ErrorHandling.shouldRetryBatch(session.configuration.retryPolicy, sessionError)
    )

    let updatedState = session.state
    let updatedProgress = session.progress

    if (shouldRetry) {
      // リトライスケジュール
      updatedState = yield* STM.fromEffect(
        SessionState.scheduleRetry(session.state, batchId)
      )
    } else {
      // バッチ失敗として記録
      updatedState = yield* STM.fromEffect(
        SessionState.failBatch(session.state, batchId, sessionError)
      )

      // 進捗更新 (失敗として)
      const batch = SessionState.getBatch(session.state, batchId)
      if (batch) {
        updatedProgress = yield* STM.fromEffect(
          ProgressTracking.updateProgress(session.progress, 0, batch.coordinates.length)
        )
      }
    }

    const updatedSession: GenerationSession = {
      ...session,
      state: updatedState,
      progress: updatedProgress,
      errorHistory,
      version: session.version + 1,
      lastActivity: now,
    }

    // 失敗イベント発行
    yield* STM.fromEffect(
      SessionEvents.publish(
        SessionEvents.createBatchFailed(session.id, batchId, sessionError, shouldRetry)
      )
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
    if (session.state.status !== "running") {
      return yield* Effect.fail(
        GenerationErrors.createSessionError(`Cannot pause session in ${session.state.status} state`)
      )
    }

    const now = yield* Effect.sync(() => new Date())

    const updatedState = SessionState.pauseSession(session.state, reason)
    const updatedProgress = ProgressTracking.pauseTracking(session.progress)

    const updatedSession: GenerationSession = {
      ...session,
      state: updatedState,
      progress: updatedProgress,
      version: session.version + 1,
      lastActivity: now,
    }

    // 一時停止イベント発行
    yield* SessionEvents.publish(
      SessionEvents.createSessionPaused(session.id, reason)
    )

    return updatedSession
  })

/**
 * セッション再開
 */
export const resume = (
  session: GenerationSession
): Effect.Effect<GenerationSession, GenerationErrors.SessionError> =>
  Effect.gen(function* () {
    if (session.state.status !== "paused") {
      return yield* Effect.fail(
        GenerationErrors.createSessionError(`Cannot resume session in ${session.state.status} state`)
      )
    }

    const now = yield* Effect.sync(() => new Date())

    const updatedState = SessionState.resumeSession(session.state)
    const updatedProgress = ProgressTracking.resumeTracking(session.progress)

    const updatedSession: GenerationSession = {
      ...session,
      state: updatedState,
      progress: updatedProgress,
      version: session.version + 1,
      lastActivity: now,
    }

    // 再開イベント発行
    yield* SessionEvents.publish(
      SessionEvents.createSessionResumed(session.id)
    )

    return updatedSession
  })

/**
 * セッション完了処理
 */
const completeSession = (
  session: GenerationSession
): STM.STM<GenerationSession, GenerationErrors.SessionError> =>
  STM.gen(function* () {
    const now = yield* STM.fromEffect(Effect.sync(() => new Date()))

    const updatedState = SessionState.completeSession(session.state)
    const updatedProgress = ProgressTracking.completeTracking(session.progress)

    const completedSession: GenerationSession = {
      ...session,
      state: updatedState,
      progress: updatedProgress,
      version: session.version + 1,
      completedAt: now,
      lastActivity: now,
    }

    // 完了イベント発行
    yield* STM.fromEffect(
      SessionEvents.publish(
        SessionEvents.createSessionCompleted(session.id, updatedProgress.statistics)
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
    const batches: SessionState.ChunkBatch[] = []
    const chunks = Chunk.fromIterable(sortedCoordinates)
    const batchChunks = Chunk.chunksOf(chunks, chunkBatchSize)

    let batchIndex = 0
    for (const batchChunk of batchChunks) {
      const batchId = `batch_${session.id}_${batchIndex++}`
      const batch: SessionState.ChunkBatch = {
        id: batchId,
        coordinates: Chunk.toReadonlyArray(batchChunk),
        priority: session.request.priority,
        status: "pending",
        createdAt: new Date(),
        attempts: 0,
      }
      batches.push(batch)
    }

    return batches
  })

/**
 * 生成要求の検証
 */
const validateGenerationRequest = (
  request: GenerationRequest
): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    if (request.coordinates.length === 0) {
      return yield* Effect.fail(
        GenerationErrors.createValidationError('Generation request must contain at least one coordinate')
      )
    }

    if (request.coordinates.length > 10000) {
      return yield* Effect.fail(
        GenerationErrors.createValidationError('Generation request contains too many coordinates (max: 10000)')
      )
    }

    // 重複座標チェック
    const uniqueCoords = new Set(
      request.coordinates.map(coord => `${coord.x},${coord.z}`)
    )

    if (uniqueCoords.size !== request.coordinates.length) {
      return yield* Effect.fail(
        GenerationErrors.createValidationError('Generation request contains duplicate coordinates')
      )
    }
  })

/**
 * 設定の検証
 */
const validateConfiguration = (
  config: SessionConfiguration
): Effect.Effect<void, GenerationErrors.ValidationError> =>
  Effect.gen(function* () {
    if (config.retryPolicy.baseDelayMs > config.retryPolicy.maxDelayMs) {
      return yield* Effect.fail(
        GenerationErrors.createValidationError('Base delay cannot be greater than max delay')
      )
    }

    if (config.timeoutPolicy.chunkTimeoutMs > config.timeoutPolicy.sessionTimeoutMs) {
      return yield* Effect.fail(
        GenerationErrors.createValidationError('Chunk timeout cannot be greater than session timeout')
      )
    }
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

  readonly start: (
    session: GenerationSession
  ) => STM.STM<GenerationSession, GenerationErrors.SessionError>

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

  readonly resume: (
    session: GenerationSession
  ) => Effect.Effect<GenerationSession, GenerationErrors.SessionError>
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

export {
  type SessionConfiguration,
  type GenerationRequest,
}