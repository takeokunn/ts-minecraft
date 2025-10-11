import { Clock, Context, Effect, Layer, Match, Option, pipe, Queue, ReadonlyArray, Ref, Schema } from 'effect'
import { ErrorCauseSchema } from '@shared/schema/error'
import { JsonValueSchema } from '@shared/schema/json'

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
  metadata: Schema.Record(Schema.String, JsonValueSchema),
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

// === Queue-Based Internal State (Phase 4-1-C) ===

/**
 * Queue統計情報
 */
export const LoadingQueueStatistics = Schema.Struct({
  _tag: Schema.Literal('LoadingQueueStatistics'),
  pendingCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  inProgressCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  completedCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  failedCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  priorityBreakdown: Schema.Struct({
    Critical: Schema.Number.pipe(Schema.nonNegativeInteger()),
    High: Schema.Number.pipe(Schema.nonNegativeInteger()),
    Normal: Schema.Number.pipe(Schema.nonNegativeInteger()),
    Low: Schema.Number.pipe(Schema.nonNegativeInteger()),
    Background: Schema.Number.pipe(Schema.nonNegativeInteger()),
  }),
})

/**
 * 実行中リクエスト情報
 */
interface InProgressRequest {
  request: Schema.Schema.Type<typeof LoadingRequest>
  startTime: number
}

/**
 * Queue化された内部状態
 * 
 * 優先度別Queueとキャンセル管理を実装
 */
interface QueuedSchedulerState {
  // 優先度別Queue（5段階）
  criticalQueue: Queue.Queue<Schema.Schema.Type<typeof LoadingRequest>>
  highQueue: Queue.Queue<Schema.Schema.Type<typeof LoadingRequest>>
  normalQueue: Queue.Queue<Schema.Schema.Type<typeof LoadingRequest>>
  lowQueue: Queue.Queue<Schema.Schema.Type<typeof LoadingRequest>>
  backgroundQueue: Queue.Queue<Schema.Schema.Type<typeof LoadingRequest>>

  // 実行状態管理（O(1)化）
  inProgress: Map<string, InProgressRequest>
  completed: Set<string>
  failed: Map<
    string,
    {
      requestId: string
      error: string
      retryCount: number
    }
  >

  // キャンセル管理
  cancelled: Set<string>

  // 統計情報
  totalProcessed: number
  averageLoadTime: number
}

// === Scheduler Error ===

export const LoadingSchedulerError = Schema.TaggedError<LoadingSchedulerErrorType>()('LoadingSchedulerError', {
  message: Schema.String,
  schedulerId: Schema.String,
  requestId: Schema.optional(Schema.String),
  cause: Schema.optional(ErrorCauseSchema),
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

  /**
   * Queue統計情報を取得します（Phase 4-1-C）
   */
  readonly getQueueStatistics: () => Effect.Effect<
    Schema.Schema.Type<typeof LoadingQueueStatistics>,
    LoadingSchedulerErrorType
  >
  readonly getPerformanceMetrics: () => Effect.Effect<Record<string, number>, LoadingSchedulerErrorType>
}

// === Live Implementation ===

const makeLoadingSchedulerService = Effect.gen(function* () {
  // Queue化された内部状態管理（Phase 4-1-C）
  const criticalQueue = yield* Queue.bounded<Schema.Schema.Type<typeof LoadingRequest>>(20)
  const highQueue = yield* Queue.bounded<Schema.Schema.Type<typeof LoadingRequest>>(50)
  const normalQueue = yield* Queue.bounded<Schema.Schema.Type<typeof LoadingRequest>>(100)
  const lowQueue = yield* Queue.bounded<Schema.Schema.Type<typeof LoadingRequest>>(200)
  const backgroundQueue = yield* Queue.unbounded<Schema.Schema.Type<typeof LoadingRequest>>()

  const schedulerState = yield* Ref.make<QueuedSchedulerState>({
    criticalQueue,
    highQueue,
    normalQueue,
    lowQueue,
    backgroundQueue,
    inProgress: new Map(),
    completed: new Set(),
    failed: new Map(),
    cancelled: new Set(),
    totalProcessed: 0,
    averageLoadTime: 1000,
  })

  const playerMovements = yield* Ref.make<Map<string, Schema.Schema.Type<typeof PlayerMovementState>>>(new Map())
  const configuration = yield* Ref.make<Schema.Schema.Type<typeof SchedulerConfiguration>>(DEFAULT_SCHEDULER_CONFIG)
  const performanceMetrics = yield* Ref.make<Record<string, number>>({})

  // === Helper Functions ===

  // Queue選択ヘルパー
  const selectQueue = (priority: Schema.Schema.Type<typeof LoadingPriority>): Effect.Effect<Queue.Queue<Schema.Schema.Type<typeof LoadingRequest>>> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(schedulerState)
      return Match.value(priority).pipe(
        Match.when('critical', () => state.criticalQueue),
        Match.when('high', () => state.highQueue),
        Match.when('normal', () => state.normalQueue),
        Match.when('low', () => state.lowQueue),
        Match.when('background', () => state.backgroundQueue),
        Match.exhaustive
      )
    })

  // 優先度降格ヘルパー
  const downgradePriority = (priority: Schema.Schema.Type<typeof LoadingPriority>): Schema.Schema.Type<typeof LoadingPriority> =>
    Match.value(priority).pipe(
      Match.when('critical', () => 'high' as const),
      Match.when('high', () => 'normal' as const),
      Match.when('normal', () => 'low' as const),
      Match.when('low', () => 'background' as const),
      Match.when('background', () => 'background' as const),
      Match.exhaustive
    )

  const scheduleLoad = (request: Schema.Schema.Type<typeof LoadingRequest>): Effect.Effect<void, LoadingSchedulerErrorType> =>
    Effect.gen(function* () {
      yield* Effect.logDebug(`読み込みリクエストをスケジュール: ${request.id}`)

      const queue = yield* selectQueue(request.priority)
      
      // Queue投入（バックプレッシャー制御）
      const offered = yield* Queue.offer(queue, request)

      if (!offered) {
        // Queue満杯時は優先度降格して再試行
        const downgradedPriority = downgradePriority(request.priority)
        
        if (downgradedPriority === request.priority) {
          // backgroundは無制限なのでここには到達しないはず
          yield* Effect.logError(`全キュー満杯: ${request.id}`)
          return
        }

        yield* Effect.logWarning(`Queue満杯により優先度降格: ${request.priority} → ${downgradedPriority}`)
        yield* scheduleLoad({ ...request, priority: downgradedPriority })
        return
      }

      yield* Effect.logInfo(`リクエストキューに追加: ${request.id} (優先度: ${request.priority})`)
    })

  const scheduleBatch = (batch: Schema.Schema.Type<typeof LoadingBatch>) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`バッチスケジュール: ${batch.batchId} (${batch.requests.length}件)`)

      yield* pipe(
        batch.requests,
        Effect.forEach((request) => scheduleLoad(request), { concurrency: 4 })
      )

      yield* Effect.logInfo(`バッチスケジュール完了: ${batch.batchId}`)
    })

  const updatePlayerMovement = (state: Schema.Schema.Type<typeof PlayerMovementState>) =>
    Effect.gen(function* () {
      yield* Ref.update(playerMovements, (map) => map.set(state.playerId, state))

      // 移動予測に基づく先読みリクエスト生成
      const predictiveRequests = yield* generatePredictiveRequestsInternal(state.playerId, 5.0)

      yield* pipe(
        predictiveRequests,
        Effect.forEach((request) => scheduleLoad(request), { concurrency: 4 })
      )

      yield* Effect.logDebug(`プレイヤー移動状態更新: ${state.playerId}`)
    })

  const getNextTask = (): Effect.Effect<Option.Option<Schema.Schema.Type<typeof LoadingRequest>>, LoadingSchedulerErrorType> =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configuration)
      const state = yield* Ref.get(schedulerState)

      // 早期return条件チェック
      if (state.inProgress.size >= config.maxConcurrentLoads) {
        return Option.none()
      }

      // 優先度順にQueueをポーリング
      const queues = [
        state.criticalQueue,
        state.highQueue,
        state.normalQueue,
        state.lowQueue,
        state.backgroundQueue,
      ]

      for (const queue of queues) {
        const taskOption = yield* Queue.poll(queue)

        if (Option.isSome(taskOption)) {
          const task = taskOption.value

          // キャンセル確認
          if (state.cancelled.has(task.id)) {
            yield* Ref.update(schedulerState, (s) => ({
              ...s,
              cancelled: new Set([...s.cancelled].filter((id) => id !== task.id)),
            }))
            // 次のタスクを再帰的に取得
            return yield* getNextTask()
          }

          // inProgressに移動
          const now = yield* Clock.currentTimeMillis
          yield* Ref.update(schedulerState, (s) => ({
            ...s,
            inProgress: new Map(s.inProgress).set(task.id, {
              request: task,
              startTime: now,
            }),
          }))

          yield* Effect.logDebug(`次のタスクを取得: ${task.id}`)
          return Option.some(task)
        }
      }

      return Option.none()
    })

  const reportCompletion = (requestId: string, success: boolean, metrics?: Record<string, number>): Effect.Effect<void, LoadingSchedulerErrorType> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis

      yield* Ref.update(schedulerState, (state) => {
        const inProgressData = state.inProgress.get(requestId)
        if (!inProgressData) return state

        const newInProgress = new Map(state.inProgress)
        newInProgress.delete(requestId)

        const loadTime = now - inProgressData.startTime
        const newAverageLoadTime =
          (state.averageLoadTime * state.totalProcessed + loadTime) / (state.totalProcessed + 1)

        if (success) {
          const newCompleted = new Set(state.completed)
          newCompleted.add(requestId)

          return {
            ...state,
            inProgress: newInProgress,
            completed: newCompleted,
            totalProcessed: state.totalProcessed + 1,
            averageLoadTime: newAverageLoadTime,
          }
        } else {
          const newFailed = new Map(state.failed)
          newFailed.set(requestId, {
            requestId,
            error: 'Loading failed',
            retryCount: 0,
          })

          return {
            ...state,
            inProgress: newInProgress,
            failed: newFailed,
          }
        }
      })

      // パフォーマンスメトリクス更新
      yield* Effect.when(metrics !== undefined, () =>
        Ref.update(performanceMetrics, (current) => ({ ...current, ...metrics }))
      )

      yield* Effect.logInfo(`読み込み完了報告: ${requestId} (成功: ${success})`)
    })

  const cancelRequest = (requestId: string, reason?: string): Effect.Effect<boolean, LoadingSchedulerErrorType> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(schedulerState)

      // inProgress確認
      if (state.inProgress.has(requestId)) {
        // 実行中は即座にキャンセル不可
        yield* Effect.logWarning(`実行中のリクエストはキャンセル不可: ${requestId}`)
        return false
      }

      // cancelled Setに追加（getNextTask時にスキップされる）
      yield* Ref.update(schedulerState, (s) => ({
        ...s,
        cancelled: new Set(s.cancelled).add(requestId),
      }))

      yield* Effect.logInfo(`リクエストキャンセル: ${requestId}${reason ? ` (理由: ${reason})` : ''}`)
      return true
    })

  const getQueueState = (): Effect.Effect<Schema.Schema.Type<typeof LoadingQueueState>, LoadingSchedulerErrorType> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(schedulerState)

      return {
        _tag: 'LoadingQueueState' as const,
        pending: [], // Queue内部は参照不可のため空配列
        inProgress: Array.from(state.inProgress.values()).map((ip) => ip.request),
        completed: Array.from(state.completed),
        failed: Array.from(state.failed.values()),
        totalProcessed: state.totalProcessed,
        averageLoadTime: state.averageLoadTime,
      }
    })

  const getQueueStatistics = (): Effect.Effect<Schema.Schema.Type<typeof LoadingQueueStatistics>, LoadingSchedulerErrorType> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(schedulerState)

      const criticalSize = yield* Queue.size(state.criticalQueue)
      const highSize = yield* Queue.size(state.highQueue)
      const normalSize = yield* Queue.size(state.normalQueue)
      const lowSize = yield* Queue.size(state.lowQueue)
      const backgroundSize = yield* Queue.size(state.backgroundQueue)

      return {
        _tag: 'LoadingQueueStatistics' as const,
        pendingCount: criticalSize + highSize + normalSize + lowSize + backgroundSize,
        inProgressCount: state.inProgress.size,
        completedCount: state.completed.size,
        failedCount: state.failed.size,
        priorityBreakdown: {
          Critical: criticalSize,
          High: highSize,
          Normal: normalSize,
          Low: lowSize,
          Background: backgroundSize,
        },
      }
    })

  const generatePredictiveRequests = (playerId: string, lookAheadSeconds: number) =>
    generatePredictiveRequestsInternal(playerId, lookAheadSeconds)

  const updateConfiguration = (configUpdate: Partial<Schema.Schema.Type<typeof SchedulerConfiguration>>) =>
    Effect.gen(function* () {
      yield* Ref.update(configuration, (current) => ({ ...current, ...configUpdate }))
      yield* Effect.logInfo('スケジューラ設定更新完了')
    })

  const getPerformanceMetrics = () => Ref.get(performanceMetrics)

  const generatePredictiveRequestsInternal = (playerId: string, lookAheadSeconds: number) =>
    Effect.gen(function* () {
      const movementMap = yield* Ref.get(playerMovements)
      const movement = movementMap.get(playerId)

      if (!movement) return []

      const chunkSize = 16 // Minecraftのチャンクサイズ

      // 移動予測に基づく位置計算
      const predictedX = movement.currentPosition.x + movement.movementVector.velocity.x * lookAheadSeconds
      const predictedZ = movement.currentPosition.z + movement.movementVector.velocity.z * lookAheadSeconds

      const predictedChunkX = Math.floor(predictedX / chunkSize)
      const predictedChunkZ = Math.floor(predictedZ / chunkSize)

      const now = yield* Clock.currentTimeMillis

      // 予測位置周辺のチャンクをリクエスト生成
      const radius = Math.ceil(movement.viewDistance / chunkSize)
      const requests: Schema.Schema.Type<typeof LoadingRequest>[] = pipe(
        ReadonlyArray.range(-radius, radius + 1),
        ReadonlyArray.flatMap((dx) =>
          pipe(
            ReadonlyArray.range(-radius, radius + 1),
            ReadonlyArray.filterMap((dz) => {
              const chunkX = predictedChunkX + dx
              const chunkZ = predictedChunkZ + dz
              const distance = Math.sqrt(dx * dx + dz * dz) * chunkSize

              return distance > movement.viewDistance
                ? Option.none()
                : Option.some({
                    _tag: 'LoadingRequest' as const,
                    id: `predictive_${playerId}_${chunkX}_${chunkZ}_${now}`,
                    chunkPosition: { x: chunkX, z: chunkZ },
                    priority: distance < chunkSize * 2 ? ('high' as const) : ('background' as const),
                    distance,
                    estimatedSize: 1024,
                    requester: playerId,
                    timestamp: now,
                    deadline: now,
                    dependencies: [],
                    metadata: {
                      predictive: true,
                      confidence: movement.movementVector.confidence,
                    },
                  })
            })
          )
        )
      )

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
    getQueueStatistics,
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
