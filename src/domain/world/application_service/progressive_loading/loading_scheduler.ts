import { Context, Effect, Layer, Match, Option, Ref, Schema } from 'effect'

/**
 * Loading Scheduler Service
 *
 * プレイヤーの位置と移動予測に基づいて、チャンクの段階的読み込みを制御します。
 * 優先度付きキューとスケジューリングアルゴリズムにより、効率的な読み込みを実現します。
 */

// === Loading Priority Types ===

export const LoadingPriority = Schema.Union(
  Schema.Literal('critical'), // プレイヤー周辺の必須チャンク
  Schema.Literal('high'), // 移動方向の先読みチャンク
  Schema.Literal('normal'), // 視界範囲内チャンク
  Schema.Literal('low'), // バックグラウンド読み込み
  Schema.Literal('background') // 予測読み込み
)

export const LoadingRequest = Schema.Struct({
  _tag: Schema.Literal('LoadingRequest'),
  id: Schema.String,
  chunkPosition: Schema.Struct({
    x: Schema.Number.pipe(Schema.int()),
    z: Schema.Number.pipe(Schema.int()),
  }),
  priority: LoadingPriority,
  distance: Schema.Number.pipe(Schema.positive()),
  estimatedSize: Schema.Number.pipe(Schema.positive()),
  requester: Schema.String, // プレイヤーIDまたはシステム名
  timestamp: Schema.Number,
  deadline: Schema.optional(Schema.Number),
  dependencies: Schema.Array(Schema.String),
  metadata: Schema.Record(Schema.String, Schema.Unknown),
})

export const LoadingBatch = Schema.Struct({
  _tag: Schema.Literal('LoadingBatch'),
  batchId: Schema.String,
  requests: Schema.Array(LoadingRequest),
  priority: LoadingPriority,
  totalSize: Schema.Number.pipe(Schema.positive()),
  estimatedDuration: Schema.Number.pipe(Schema.positive()),
  maxConcurrency: Schema.Number.pipe(Schema.positive(), Schema.int()),
})

// === Scheduling Strategy ===

export const SchedulingStrategy = Schema.Union(
  Schema.Literal('fifo'), // 先入先出
  Schema.Literal('priority_based'), // 優先度ベース
  Schema.Literal('distance_based'), // 距離ベース
  Schema.Literal('deadline_driven'), // 締切駆動
  Schema.Literal('adaptive') // 適応的スケジューリング
)

export const SchedulerConfiguration = Schema.Struct({
  _tag: Schema.Literal('SchedulerConfiguration'),
  strategy: SchedulingStrategy,
  maxConcurrentLoads: Schema.Number.pipe(Schema.positive(), Schema.int()),
  priorityWeights: Schema.Record(LoadingPriority, Schema.Number),
  distanceDecayFactor: Schema.Number.pipe(Schema.between(0, 1)),
  deadlineWeight: Schema.Number.pipe(Schema.positive()),
  batchingEnabled: Schema.Boolean,
  batchSizeThreshold: Schema.Number.pipe(Schema.positive()),
  adaptiveThresholds: Schema.Struct({
    memoryPressure: Schema.Number.pipe(Schema.between(0, 1)),
    cpuLoad: Schema.Number.pipe(Schema.between(0, 1)),
    networkLatency: Schema.Number.pipe(Schema.positive()),
  }),
})

// === Player Movement Prediction ===

export const MovementVector = Schema.Struct({
  _tag: Schema.Literal('MovementVector'),
  velocity: Schema.Struct({
    x: Schema.Number,
    z: Schema.Number,
  }),
  acceleration: Schema.Struct({
    x: Schema.Number,
    z: Schema.Number,
  }),
  direction: Schema.Number.pipe(Schema.between(0, 360)), // 度
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
})

export const PlayerMovementState = Schema.Struct({
  _tag: Schema.Literal('PlayerMovementState'),
  playerId: Schema.String,
  currentPosition: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  movementVector: MovementVector,
  viewDistance: Schema.Number.pipe(Schema.positive()),
  lastUpdate: Schema.Number,
  history: Schema.Array(
    Schema.Struct({
      position: Schema.Struct({ x: Schema.Number, z: Schema.Number }),
      timestamp: Schema.Number,
    })
  ),
})

// === Loading Queue State ===

export const LoadingQueueState = Schema.Struct({
  _tag: Schema.Literal('LoadingQueueState'),
  pending: Schema.Array(LoadingRequest),
  inProgress: Schema.Array(LoadingRequest),
  completed: Schema.Array(Schema.String), // リクエストID
  failed: Schema.Array(
    Schema.Struct({
      requestId: Schema.String,
      error: Schema.String,
      retryCount: Schema.Number,
    })
  ),
  totalProcessed: Schema.Number.pipe(Schema.nonNegativeInteger()),
  averageLoadTime: Schema.Number.pipe(Schema.positive()),
})

// === Scheduler Error ===

export const LoadingSchedulerError = Schema.TaggedError<LoadingSchedulerErrorType>()('LoadingSchedulerError', {
  message: Schema.String,
  schedulerId: Schema.String,
  requestId: Schema.optional(Schema.String),
  cause: Schema.optional(Schema.Unknown),
})

export interface LoadingSchedulerErrorType extends Schema.Schema.Type<typeof LoadingSchedulerError> {}

// === Service Interface ===

export interface LoadingSchedulerService {
  /**
   * 読み込みリクエストをスケジュールします
   */
  readonly scheduleLoad: (
    request: Schema.Schema.Type<typeof LoadingRequest>
  ) => Effect.Effect<void, LoadingSchedulerErrorType>

  /**
   * 複数のリクエストをバッチでスケジュールします
   */
  readonly scheduleBatch: (
    batch: Schema.Schema.Type<typeof LoadingBatch>
  ) => Effect.Effect<void, LoadingSchedulerErrorType>

  /**
   * プレイヤーの移動状態を更新します
   */
  readonly updatePlayerMovement: (
    state: Schema.Schema.Type<typeof PlayerMovementState>
  ) => Effect.Effect<void, LoadingSchedulerErrorType>

  /**
   * 次の読み込みタスクを取得します
   */
  readonly getNextTask: () => Effect.Effect<
    Option.Option<Schema.Schema.Type<typeof LoadingRequest>>,
    LoadingSchedulerErrorType
  >

  /**
   * 読み込み完了を報告します
   */
  readonly reportCompletion: (
    requestId: string,
    success: boolean,
    metrics?: Record<string, number>
  ) => Effect.Effect<void, LoadingSchedulerErrorType>

  /**
   * リクエストをキャンセルします
   */
  readonly cancelRequest: (requestId: string, reason?: string) => Effect.Effect<boolean, LoadingSchedulerErrorType>

  /**
   * キューの状態を取得します
   */
  readonly getQueueState: () => Effect.Effect<Schema.Schema.Type<typeof LoadingQueueState>, LoadingSchedulerErrorType>

  /**
   * 先読みチャンクを予測生成します
   */
  readonly generatePredictiveRequests: (
    playerId: string,
    lookAheadSeconds: number
  ) => Effect.Effect<Schema.Schema.Type<typeof LoadingRequest>[], LoadingSchedulerErrorType>

  /**
   * スケジューラ設定を更新します
   */
  readonly updateConfiguration: (
    config: Partial<Schema.Schema.Type<typeof SchedulerConfiguration>>
  ) => Effect.Effect<void, LoadingSchedulerErrorType>

  /**
   * パフォーマンス統計を取得します
   */
  readonly getPerformanceMetrics: () => Effect.Effect<Record<string, number>, LoadingSchedulerErrorType>
}

// === Live Implementation ===

const makeLoadingSchedulerService = Effect.gen(function* () {
  // 内部状態管理
  const queueState = yield* Ref.make<Schema.Schema.Type<typeof LoadingQueueState>>({
    _tag: 'LoadingQueueState',
    pending: [],
    inProgress: [],
    completed: [],
    failed: [],
    totalProcessed: 0,
    averageLoadTime: 1000,
  })

  const playerMovements = yield* Ref.make<Map<string, Schema.Schema.Type<typeof PlayerMovementState>>>(new Map())
  const configuration = yield* Ref.make<Schema.Schema.Type<typeof SchedulerConfiguration>>(DEFAULT_SCHEDULER_CONFIG)
  const performanceMetrics = yield* Ref.make<Record<string, number>>({})

  const scheduleLoad = (request: Schema.Schema.Type<typeof LoadingRequest>) =>
    Effect.gen(function* () {
      yield* Effect.logDebug(`読み込みリクエストをスケジュール: ${request.id}`)

      yield* Ref.update(queueState, (state) => ({
        ...state,
        pending: [...state.pending, request].sort(comparePriority),
      }))

      yield* Effect.logInfo(`リクエストキューに追加: ${request.id} (優先度: ${request.priority})`)
    })

  const scheduleBatch = (batch: Schema.Schema.Type<typeof LoadingBatch>) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`バッチスケジュール: ${batch.batchId} (${batch.requests.length}件)`)

      for (const request of batch.requests) {
        yield* scheduleLoad(request)
      }

      yield* Effect.logInfo(`バッチスケジュール完了: ${batch.batchId}`)
    })

  const updatePlayerMovement = (state: Schema.Schema.Type<typeof PlayerMovementState>) =>
    Effect.gen(function* () {
      yield* Ref.update(playerMovements, (map) => map.set(state.playerId, state))

      // 移動予測に基づく先読みリクエスト生成
      const predictiveRequests = yield* generatePredictiveRequestsInternal(state.playerId, 5.0)
      for (const request of predictiveRequests) {
        yield* scheduleLoad(request)
      }

      yield* Effect.logDebug(`プレイヤー移動状態更新: ${state.playerId}`)
    })

  const getNextTask = () =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configuration)
      const state = yield* Ref.get(queueState)

      if (state.pending.length === 0) {
        return Option.none()
      }

      if (state.inProgress.length >= config.maxConcurrentLoads) {
        return Option.none()
      }

      // スケジューリング戦略に基づくタスク選択
      const selectedTask = yield* selectTaskByStrategy(state.pending, config.strategy)

      if (Option.isSome(selectedTask)) {
        const task = selectedTask.value

        yield* Ref.update(queueState, (state) => ({
          ...state,
          pending: state.pending.filter((r) => r.id !== task.id),
          inProgress: [...state.inProgress, task],
        }))

        yield* Effect.logDebug(`次のタスクを取得: ${task.id}`)
        return selectedTask
      }

      return Option.none()
    })

  const reportCompletion = (requestId: string, success: boolean, metrics?: Record<string, number>) =>
    Effect.gen(function* () {
      yield* Ref.update(queueState, (state) => {
        const inProgressIndex = state.inProgress.findIndex((r) => r.id === requestId)
        if (inProgressIndex === -1) return state

        const request = state.inProgress[inProgressIndex]
        const newInProgress = state.inProgress.filter((_, i) => i !== inProgressIndex)

        if (success) {
          return {
            ...state,
            inProgress: newInProgress,
            completed: [...state.completed, requestId],
            totalProcessed: state.totalProcessed + 1,
          }
        } else {
          return {
            ...state,
            inProgress: newInProgress,
            failed: [
              ...state.failed,
              {
                requestId,
                error: 'Loading failed',
                retryCount: 0,
              },
            ],
          }
        }
      })

      // パフォーマンスメトリクス更新
      if (metrics) {
        yield* Ref.update(performanceMetrics, (current) => ({ ...current, ...metrics }))
      }

      yield* Effect.logInfo(`読み込み完了報告: ${requestId} (成功: ${success})`)
    })

  const cancelRequest = (requestId: string, reason?: string) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(queueState)

      // ペンディングキューから削除
      const pendingIndex = state.pending.findIndex((r) => r.id === requestId)
      if (pendingIndex !== -1) {
        yield* Ref.update(queueState, (state) => ({
          ...state,
          pending: state.pending.filter((_, i) => i !== pendingIndex),
        }))
        yield* Effect.logInfo(`リクエストキャンセル (ペンディング): ${requestId}`)
        return true
      }

      // 進行中キューから削除
      const inProgressIndex = state.inProgress.findIndex((r) => r.id === requestId)
      if (inProgressIndex !== -1) {
        yield* Ref.update(queueState, (state) => ({
          ...state,
          inProgress: state.inProgress.filter((_, i) => i !== inProgressIndex),
        }))
        yield* Effect.logInfo(`リクエストキャンセル (進行中): ${requestId}`)
        return true
      }

      yield* Effect.logWarning(`キャンセル対象リクエストが見つかりません: ${requestId}`)
      return false
    })

  const getQueueState = () => Ref.get(queueState)

  const generatePredictiveRequests = (playerId: string, lookAheadSeconds: number) =>
    generatePredictiveRequestsInternal(playerId, lookAheadSeconds)

  const updateConfiguration = (configUpdate: Partial<Schema.Schema.Type<typeof SchedulerConfiguration>>) =>
    Effect.gen(function* () {
      yield* Ref.update(configuration, (current) => ({ ...current, ...configUpdate }))
      yield* Effect.logInfo('スケジューラ設定更新完了')
    })

  const getPerformanceMetrics = () => Ref.get(performanceMetrics)

  // === Helper Functions ===

  const comparePriority = (
    a: Schema.Schema.Type<typeof LoadingRequest>,
    b: Schema.Schema.Type<typeof LoadingRequest>
  ) => {
    const priorityOrder = { critical: 5, high: 4, normal: 3, low: 2, background: 1 }
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]

    if (priorityDiff !== 0) return priorityDiff

    // 同じ優先度の場合は距離で比較
    return a.distance - b.distance
  }

  const selectTaskByStrategy = (
    pending: Schema.Schema.Type<typeof LoadingRequest>[],
    strategy: Schema.Schema.Type<typeof SchedulingStrategy>
  ) =>
    Effect.gen(function* () {
      if (pending.length === 0) return Option.none()

      return Match.value(strategy).pipe(
        Match.when('fifo', () => Option.some(pending[0])),
        Match.when('priority_based', () => Option.some(pending.sort(comparePriority)[0])),
        Match.when('distance_based', () => Option.some(pending.sort((a, b) => a.distance - b.distance)[0])),
        Match.when('deadline_driven', () => {
          const now = Date.now()
          const withDeadlines = pending.filter((r) => r.deadline && r.deadline > now)
          return withDeadlines.length > 0
            ? Option.some(withDeadlines.sort((a, b) => (a.deadline || 0) - (b.deadline || 0))[0])
            : Option.some(pending[0])
        }),
        Match.when('adaptive', () => {
          // 適応的アルゴリズム（簡略化）
          const scored = pending.map((req) => ({
            request: req,
            score: calculateAdaptiveScore(req),
          }))
          const best = scored.sort((a, b) => b.score - a.score)[0]
          return Option.some(best.request)
        }),
        Match.exhaustive
      )
    })

  const calculateAdaptiveScore = (request: Schema.Schema.Type<typeof LoadingRequest>) => {
    const priorityWeight = { critical: 100, high: 80, normal: 60, low: 40, background: 20 }
    const distanceWeight = Math.max(0, 100 - request.distance * 5)
    const ageWeight = Math.min(50, (Date.now() - request.timestamp) / 1000)

    return priorityWeight[request.priority] + distanceWeight + ageWeight
  }

  const generatePredictiveRequestsInternal = (playerId: string, lookAheadSeconds: number) =>
    Effect.gen(function* () {
      const movementMap = yield* Ref.get(playerMovements)
      const movement = movementMap.get(playerId)

      if (!movement) {
        return []
      }

      const requests: Schema.Schema.Type<typeof LoadingRequest>[] = []
      const chunkSize = 16 // Minecraftのチャンクサイズ

      // 移動予測に基づく位置計算
      const predictedX = movement.currentPosition.x + movement.movementVector.velocity.x * lookAheadSeconds
      const predictedZ = movement.currentPosition.z + movement.movementVector.velocity.z * lookAheadSeconds

      const predictedChunkX = Math.floor(predictedX / chunkSize)
      const predictedChunkZ = Math.floor(predictedZ / chunkSize)

      // 予測位置周辺のチャンクをリクエスト生成
      const radius = Math.ceil(movement.viewDistance / chunkSize)
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const chunkX = predictedChunkX + dx
          const chunkZ = predictedChunkZ + dz
          const distance = Math.sqrt(dx * dx + dz * dz) * chunkSize

          if (distance <= movement.viewDistance) {
            const request: Schema.Schema.Type<typeof LoadingRequest> = {
              _tag: 'LoadingRequest',
              id: `predictive_${playerId}_${chunkX}_${chunkZ}_${Date.now()}`,
              chunkPosition: { x: chunkX, z: chunkZ },
              priority: distance < chunkSize * 2 ? 'high' : 'background',
              distance,
              estimatedSize: 1024, // 1KB推定
              requester: playerId,
              timestamp: Date.now(),
              deadline: Date.now() + lookAheadSeconds * 1000,
              dependencies: [],
              metadata: {
                predictive: true,
                confidence: movement.movementVector.confidence,
              },
            }
            requests.push(request)
          }
        }
      }

      yield* Effect.logDebug(`予測リクエスト生成: ${requests.length}件 (プレイヤー: ${playerId})`)
      return requests
    })

  return LoadingSchedulerService.of({
    scheduleLoad,
    scheduleBatch,
    updatePlayerMovement,
    getNextTask,
    reportCompletion,
    cancelRequest,
    getQueueState,
    generatePredictiveRequests,
    updateConfiguration,
    getPerformanceMetrics,
  })
})

// === Context Tag ===

export const LoadingSchedulerService = Context.GenericTag<LoadingSchedulerService>(
  '@minecraft/domain/world/LoadingSchedulerService'
)

// === Layer ===

export const LoadingSchedulerServiceLive = Layer.effect(LoadingSchedulerService, makeLoadingSchedulerService)

// === Default Configuration ===

export const DEFAULT_SCHEDULER_CONFIG: Schema.Schema.Type<typeof SchedulerConfiguration> = {
  _tag: 'SchedulerConfiguration',
  strategy: 'adaptive',
  maxConcurrentLoads: 4,
  priorityWeights: {
    critical: 1.0,
    high: 0.8,
    normal: 0.6,
    low: 0.4,
    background: 0.2,
  },
  distanceDecayFactor: 0.9,
  deadlineWeight: 2.0,
  batchingEnabled: true,
  batchSizeThreshold: 5,
  adaptiveThresholds: {
    memoryPressure: 0.8,
    cpuLoad: 0.7,
    networkLatency: 100,
  },
}

export type {
  LoadingBatch as LoadingBatchType,
  LoadingQueueState as LoadingQueueStateType,
  LoadingRequest as LoadingRequestType,
  MovementVector as MovementVectorType,
  PlayerMovementState as PlayerMovementStateType,
  SchedulerConfiguration as SchedulerConfigurationType,
} from './loading_scheduler'
