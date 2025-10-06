import { Clock, Context, Effect, Layer, Ref, Schema } from 'effect'

/**
 * Memory Monitor Service
 *
 * メモリ使用量をリアルタイムで監視し、適切なメモリ管理を行います。
 * メモリプレッシャーに基づいて自動的に読み込み戦略を調整します。
 */

// === Memory Metrics ===

export const MemoryMetrics = Schema.Struct({
  _tag: Schema.Literal('MemoryMetrics'),
  totalMemory: Schema.Number.pipe(Schema.positive()), // バイト
  usedMemory: Schema.Number.pipe(Schema.positive()), // バイト
  freeMemory: Schema.Number.pipe(Schema.positive()), // バイト
  heapUsed: Schema.Number.pipe(Schema.positive()), // バイト
  heapTotal: Schema.Number.pipe(Schema.positive()), // バイト
  external: Schema.Number.pipe(Schema.positive()), // バイト
  buffers: Schema.Number.pipe(Schema.positive()), // バイト
  cached: Schema.Number.pipe(Schema.positive()), // バイト
  timestamp: Schema.Number,
})

export const MemoryPressureLevel = Schema.Union(
  Schema.Literal('none'), // 0-50%
  Schema.Literal('low'), // 50-70%
  Schema.Literal('medium'), // 70-85%
  Schema.Literal('high'), // 85-95%
  Schema.Literal('critical') // 95%+
)

export const MemoryAlert = Schema.Struct({
  _tag: Schema.Literal('MemoryAlert'),
  id: Schema.String,
  level: MemoryPressureLevel,
  message: Schema.String,
  metrics: MemoryMetrics,
  timestamp: Schema.Number,
  suggestedActions: Schema.Array(Schema.String),
})

// === Memory Management Strategy ===

export const MemoryManagementStrategy = Schema.Union(
  Schema.Literal('conservative'), // 保守的管理
  Schema.Literal('balanced'), // バランス重視
  Schema.Literal('aggressive'), // 積極的解放
  Schema.Literal('adaptive') // 適応的管理
)

export const MemoryConfiguration = Schema.Struct({
  _tag: Schema.Literal('MemoryConfiguration'),
  strategy: MemoryManagementStrategy,
  thresholds: Schema.Struct({
    lowPressure: Schema.Number.pipe(Schema.between(0, 1)),
    mediumPressure: Schema.Number.pipe(Schema.between(0, 1)),
    highPressure: Schema.Number.pipe(Schema.between(0, 1)),
    criticalPressure: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  monitoringInterval: Schema.Number.pipe(Schema.positive()), // ミリ秒
  alertingEnabled: Schema.Boolean,
  autoGCEnabled: Schema.Boolean,
  gcTriggerThreshold: Schema.Number.pipe(Schema.between(0, 1)),
  emergencyCleanupEnabled: Schema.Boolean,
  preallocation: Schema.Struct({
    enabled: Schema.Boolean,
    chunkPoolSize: Schema.Number.pipe(Schema.positive(), Schema.int()),
    bufferPoolSize: Schema.Number.pipe(Schema.positive()), // バイト
  }),
})

// === Memory Pool Management ===

export const MemoryPool = Schema.Struct({
  _tag: Schema.Literal('MemoryPool'),
  poolId: Schema.String,
  poolType: Schema.Union(
    Schema.Literal('chunk_data'),
    Schema.Literal('texture_cache'),
    Schema.Literal('mesh_buffer'),
    Schema.Literal('audio_buffer'),
    Schema.Literal('general')
  ),
  maxSize: Schema.Number.pipe(Schema.positive()),
  currentSize: Schema.Number.pipe(Schema.nonNegativeInteger()),
  allocatedItems: Schema.Number.pipe(Schema.nonNegativeInteger()),
  freeItems: Schema.Number.pipe(Schema.nonNegativeInteger()),
  fragmentationRatio: Schema.Number.pipe(Schema.between(0, 1)),
  lastCompaction: Schema.Number,
})

export const AllocationRequest = Schema.Struct({
  _tag: Schema.Literal('AllocationRequest'),
  requestId: Schema.String,
  poolType: Schema.Union(
    Schema.Literal('chunk_data'),
    Schema.Literal('texture_cache'),
    Schema.Literal('mesh_buffer'),
    Schema.Literal('audio_buffer'),
    Schema.Literal('general')
  ),
  size: Schema.Number.pipe(Schema.positive()),
  priority: Schema.Union(
    Schema.Literal('critical'),
    Schema.Literal('high'),
    Schema.Literal('normal'),
    Schema.Literal('low')
  ),
  lifetime: Schema.Union(
    Schema.Literal('temporary'), // 短期間
    Schema.Literal('session'), // セッション間
    Schema.Literal('permanent') // 永続的
  ),
})

// === Memory Statistics ===

export const MemoryStatistics = Schema.Struct({
  _tag: Schema.Literal('MemoryStatistics'),
  totalAllocations: Schema.Number.pipe(Schema.nonNegativeInteger()),
  totalDeallocations: Schema.Number.pipe(Schema.nonNegativeInteger()),
  peakMemoryUsage: Schema.Number.pipe(Schema.positive()),
  averageMemoryUsage: Schema.Number.pipe(Schema.positive()),
  gcTriggerCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  fragmentationEvents: Schema.Number.pipe(Schema.nonNegativeInteger()),
  allocationFailures: Schema.Number.pipe(Schema.nonNegativeInteger()),
  pressureAlerts: Schema.Array(MemoryAlert),
  poolStatistics: Schema.Array(MemoryPool),
})

// === Memory Monitor Error ===

export const MemoryMonitorError = Schema.TaggedError<MemoryMonitorErrorType>()('MemoryMonitorError', {
  message: Schema.String,
  monitorId: Schema.String,
  cause: Schema.optional(Schema.Unknown),
})

export interface MemoryMonitorErrorType extends Schema.Schema.Type<typeof MemoryMonitorError> {}

// === Service Interface ===

export interface MemoryMonitorService {
  /**
   * メモリ監視を開始します
   */
  readonly startMonitoring: () => Effect.Effect<void, MemoryMonitorErrorType>

  /**
   * メモリ監視を停止します
   */
  readonly stopMonitoring: () => Effect.Effect<void, MemoryMonitorErrorType>

  /**
   * 現在のメモリメトリクスを取得します
   */
  readonly getCurrentMetrics: () => Effect.Effect<Schema.Schema.Type<typeof MemoryMetrics>, MemoryMonitorErrorType>

  /**
   * メモリプレッシャーレベルを取得します
   */
  readonly getPressureLevel: () => Effect.Effect<MemoryPressureLevel, MemoryMonitorErrorType>

  /**
   * メモリを割り当てます
   */
  readonly allocateMemory: (
    request: Schema.Schema.Type<typeof AllocationRequest>
  ) => Effect.Effect<string, MemoryMonitorErrorType> // allocation ID

  /**
   * メモリを解放します
   */
  readonly deallocateMemory: (allocationId: string) => Effect.Effect<void, MemoryMonitorErrorType>

  /**
   * ガベージコレクションを実行します
   */
  readonly triggerGarbageCollection: (
    aggressive: boolean
  ) => Effect.Effect<Schema.Schema.Type<typeof MemoryMetrics>, MemoryMonitorErrorType>

  /**
   * メモリプールを最適化します
   */
  readonly optimizeMemoryPools: () => Effect.Effect<void, MemoryMonitorErrorType>

  /**
   * 緊急メモリクリーンアップを実行します
   */
  readonly emergencyCleanup: () => Effect.Effect<number, MemoryMonitorErrorType> // 解放されたバイト数

  /**
   * メモリ統計を取得します
   */
  readonly getStatistics: () => Effect.Effect<Schema.Schema.Type<typeof MemoryStatistics>, MemoryMonitorErrorType>

  /**
   * メモリアラート履歴を取得します
   */
  readonly getAlertHistory: (
    limit?: number
  ) => Effect.Effect<Schema.Schema.Type<typeof MemoryAlert>[], MemoryMonitorErrorType>

  /**
   * メモリ設定を更新します
   */
  readonly updateConfiguration: (
    config: Partial<Schema.Schema.Type<typeof MemoryConfiguration>>
  ) => Effect.Effect<void, MemoryMonitorErrorType>

  /**
   * メモリ使用量予測を取得します
   */
  readonly predictMemoryUsage: (timeframeSeconds: number) => Effect.Effect<number, MemoryMonitorErrorType>
}

// === Live Implementation ===

const makeMemoryMonitorService = Effect.gen(function* () {
  // 内部状態管理
  const configuration = yield* Ref.make<Schema.Schema.Type<typeof MemoryConfiguration>>(DEFAULT_MEMORY_CONFIG)
  const isMonitoring = yield* Ref.make<boolean>(false)
  const initialMetrics = yield* createInitialMetrics()
  const currentMetrics = yield* Ref.make<Schema.Schema.Type<typeof MemoryMetrics>>(initialMetrics)
  const memoryPools = yield* Ref.make<Map<string, Schema.Schema.Type<typeof MemoryPool>>>(new Map())
  const allocations = yield* Ref.make<
    Map<string, { request: Schema.Schema.Type<typeof AllocationRequest>; timestamp: number }>
  >(new Map())
  const alertHistory = yield* Ref.make<Schema.Schema.Type<typeof MemoryAlert>[]>([])
  const statistics = yield* Ref.make<Schema.Schema.Type<typeof MemoryStatistics>>(createInitialStatistics())

  const startMonitoring = () =>
    Effect.gen(function* () {
      const isActive = yield* Ref.get(isMonitoring)
      if (isActive) {
        yield* Effect.logWarning('メモリ監視は既に開始されています')
        return
      }

      yield* Ref.set(isMonitoring, true)

      // 監視ループを開始
      yield* Effect.fork(monitoringLoop())

      yield* Effect.logInfo('メモリ監視開始')
    })

  const stopMonitoring = () =>
    Effect.gen(function* () {
      yield* Ref.set(isMonitoring, false)
      yield* Effect.logInfo('メモリ監視停止')
    })

  const getCurrentMetrics = () =>
    Effect.gen(function* () {
      const metrics = yield* collectMemoryMetrics()
      yield* Ref.set(currentMetrics, metrics)
      return metrics
    })

  const getPressureLevel = () =>
    Effect.gen(function* () {
      const metrics = yield* getCurrentMetrics()
      const config = yield* Ref.get(configuration)

      const usageRatio = metrics.usedMemory / metrics.totalMemory

      if (usageRatio >= config.thresholds.criticalPressure) return 'critical'
      if (usageRatio >= config.thresholds.highPressure) return 'high'
      if (usageRatio >= config.thresholds.mediumPressure) return 'medium'
      if (usageRatio >= config.thresholds.lowPressure) return 'low'
      return 'none'
    })

  const allocateMemory = (request: Schema.Schema.Type<typeof AllocationRequest>) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const randomId = yield* Effect.sync(() => Math.random().toString(36).substr(2, 9))
      const allocationId = `alloc_${now}_${randomId}`

      // メモリプレッシャーチェック
      const pressureLevel = yield* getPressureLevel()
      if (pressureLevel === 'critical' && request.priority !== 'critical') {
        return yield* Effect.fail({
          _tag: 'MemoryMonitorError' as const,
          message: 'メモリプレッシャーが高いため割り当てを拒否しました',
          monitorId: allocationId,
        })
      }

      // 割り当て記録
      yield* Ref.update(allocations, (map) => map.set(allocationId, { request, timestamp: now }))

      // プール更新
      yield* updatePoolAllocation(request.poolType, request.size, true)

      // 統計更新
      yield* Ref.update(statistics, (stats) => ({
        ...stats,
        totalAllocations: stats.totalAllocations + 1,
      }))

      yield* Effect.logDebug(`メモリ割り当て: ${allocationId} (${request.size}バイト)`)
      return allocationId
    })

  const deallocateMemory = (allocationId: string) =>
    Effect.gen(function* () {
      const allocMap = yield* Ref.get(allocations)
      const allocation = allocMap.get(allocationId)

      if (!allocation) {
        yield* Effect.logWarning(`割り当てIDが見つかりません: ${allocationId}`)
        return
      }

      // プール更新
      yield* updatePoolAllocation(allocation.request.poolType, allocation.request.size, false)

      // 割り当て記録削除
      yield* Ref.update(allocations, (map) => {
        map.delete(allocationId)
        return map
      })

      // 統計更新
      yield* Ref.update(statistics, (stats) => ({
        ...stats,
        totalDeallocations: stats.totalDeallocations + 1,
      }))

      yield* Effect.logDebug(`メモリ解放: ${allocationId}`)
    })

  const triggerGarbageCollection = (aggressive: boolean) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`ガベージコレクション実行 (アグレッシブ: ${aggressive})`)

      // GC実行シミュレーション
      yield* Effect.sleep('100 millis')

      // 統計更新
      yield* Ref.update(statistics, (stats) => ({
        ...stats,
        gcTriggerCount: stats.gcTriggerCount + 1,
      }))

      return yield* getCurrentMetrics()
    })

  const optimizeMemoryPools = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('メモリプール最適化開始')

      const pools = yield* Ref.get(memoryPools)

      for (const [poolId, pool] of pools) {
        // 断片化率が高い場合はコンパクション
        if (pool.fragmentationRatio > 0.3) {
          yield* compactMemoryPool(poolId)
        }
      }

      yield* Effect.logInfo('メモリプール最適化完了')
    })

  const emergencyCleanup = () =>
    Effect.gen(function* () {
      yield* Effect.logWarning('緊急メモリクリーンアップ実行')

      let freedBytes = 0

      // 低優先度割り当ての強制解放
      const allocMap = yield* Ref.get(allocations)
      const lowPriorityAllocs = Array.from(allocMap.entries()).filter(([_, alloc]) => alloc.request.priority === 'low')

      for (const [allocId, _] of lowPriorityAllocs) {
        yield* deallocateMemory(allocId)
        freedBytes += _.request.size
      }

      // 一時的割り当ての強制解放
      const tempAllocs = Array.from(allocMap.entries()).filter(([_, alloc]) => alloc.request.lifetime === 'temporary')

      for (const [allocId, _] of tempAllocs) {
        yield* deallocateMemory(allocId)
        freedBytes += _.request.size
      }

      // アグレッシブGC
      yield* triggerGarbageCollection(true)

      yield* Effect.logWarning(`緊急クリーンアップ完了: ${freedBytes}バイト解放`)
      return freedBytes
    })

  const getStatistics = () => Ref.get(statistics)

  const getAlertHistory = (limit: number = 50) =>
    Effect.gen(function* () {
      const alerts = yield* Ref.get(alertHistory)
      return alerts.slice(-limit)
    })

  const updateConfiguration = (configUpdate: Partial<Schema.Schema.Type<typeof MemoryConfiguration>>) =>
    Effect.gen(function* () {
      yield* Ref.update(configuration, (current) => ({ ...current, ...configUpdate }))
      yield* Effect.logInfo('メモリ監視設定更新完了')
    })

  const predictMemoryUsage = (timeframeSeconds: number) =>
    Effect.gen(function* () {
      const currentMetrics = yield* getCurrentMetrics()
      const stats = yield* getStatistics()

      // 簡易予測（線形近似）
      const allocationRate = stats.totalAllocations > 0 ? currentMetrics.usedMemory / stats.totalAllocations : 0

      const predictedUsage = currentMetrics.usedMemory + allocationRate * timeframeSeconds * 0.1 // 0.1は推定係数

      return Math.min(predictedUsage, currentMetrics.totalMemory)
    })

  // === Helper Functions ===

  const monitoringLoop = () =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configuration)

      yield* Effect.repeat(
        Effect.gen(function* () {
          const isActive = yield* Ref.get(isMonitoring)
          if (!isActive) return false

          // メトリクス収集
          const metrics = yield* collectMemoryMetrics()
          yield* Ref.set(currentMetrics, metrics)

          // プレッシャーレベル判定
          const pressureLevel = yield* getPressureLevel()

          // アラート生成
          if (pressureLevel !== 'none') {
            yield* generateAlert(pressureLevel, metrics)
          }

          // 自動GC判定
          if (config.autoGCEnabled) {
            const usageRatio = metrics.usedMemory / metrics.totalMemory
            if (usageRatio >= config.gcTriggerThreshold) {
              yield* triggerGarbageCollection(false)
            }
          }

          // 緊急クリーンアップ判定
          if (config.emergencyCleanupEnabled && pressureLevel === 'critical') {
            yield* emergencyCleanup()
          }

          return true
        }),
        { schedule: Effect.Schedule.spaced(`${config.monitoringInterval} millis`) }
      )
    })

  const collectMemoryMetrics = () =>
    Effect.gen(function* () {
      // 実際の環境では process.memoryUsage() や navigator.memory を使用
      const mockMetrics: Schema.Schema.Type<typeof MemoryMetrics> = {
        _tag: 'MemoryMetrics',
        totalMemory: 8 * 1024 * 1024 * 1024, // 8GB
        usedMemory: (4 + Math.random() * 2) * 1024 * 1024 * 1024, // 4-6GB
        freeMemory: 0, // 計算される
        heapUsed: 512 * 1024 * 1024, // 512MB
        heapTotal: 1024 * 1024 * 1024, // 1GB
        external: 256 * 1024 * 1024, // 256MB
        buffers: 128 * 1024 * 1024, // 128MB
        cached: 1024 * 1024 * 1024, // 1GB
        timestamp: yield* Clock.currentTimeMillis,
      }

      mockMetrics.freeMemory = mockMetrics.totalMemory - mockMetrics.usedMemory

      return mockMetrics
    })

  const generateAlert = (level: MemoryPressureLevel, metrics: Schema.Schema.Type<typeof MemoryMetrics>) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const alert: Schema.Schema.Type<typeof MemoryAlert> = {
        _tag: 'MemoryAlert',
        id: `alert_${now}`,
        level,
        message: `メモリプレッシャー: ${level} (使用率: ${((metrics.usedMemory / metrics.totalMemory) * 100).toFixed(1)}%)`,
        metrics,
        timestamp: now,
        suggestedActions: getSuggestedActions(level),
      }

      yield* Ref.update(alertHistory, (alerts) => [...alerts.slice(-99), alert])
      yield* Effect.logWarning(`メモリアラート: ${alert.message}`)
    })

  const getSuggestedActions = (level: MemoryPressureLevel): string[] => {
    switch (level) {
      case 'low':
        return ['一時ファイルのクリーンアップを検討']
      case 'medium':
        return ['キャッシュサイズの縮小', '未使用リソースの解放']
      case 'high':
        return ['アグレッシブキャッシュクリア', 'バックグラウンドタスクの停止']
      case 'critical':
        return ['緊急メモリクリーンアップ', '重要でない機能の無効化', 'アプリケーション再起動の検討']
      default:
        return []
    }
  }

  const updatePoolAllocation = (
    poolType: Schema.Schema.Type<typeof AllocationRequest>['poolType'],
    size: number,
    allocate: boolean
  ) =>
    Effect.gen(function* () {
      yield* Ref.update(memoryPools, (pools) => {
        const poolId = `pool_${poolType}`
        const pool = pools.get(poolId) || createDefaultPool(poolId, poolType)

        const updatedPool = {
          ...pool,
          currentSize: allocate ? pool.currentSize + size : Math.max(0, pool.currentSize - size),
          allocatedItems: allocate ? pool.allocatedItems + 1 : Math.max(0, pool.allocatedItems - 1),
          freeItems: allocate ? Math.max(0, pool.freeItems - 1) : pool.freeItems + 1,
        }

        // 断片化率更新
        updatedPool.fragmentationRatio =
          updatedPool.allocatedItems > 0
            ? 1 - updatedPool.freeItems / (updatedPool.allocatedItems + updatedPool.freeItems)
            : 0

        pools.set(poolId, updatedPool)
        return pools
      })
    })

  const compactMemoryPool = (poolId: string) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`メモリプールコンパクション: ${poolId}`)

      const now = yield* Clock.currentTimeMillis

      yield* Ref.update(memoryPools, (pools) => {
        const pool = pools.get(poolId)
        if (pool) {
          pools.set(poolId, {
            ...pool,
            fragmentationRatio: 0.1, // コンパクション後は断片化が減少
            lastCompaction: now,
          })
        }
        return pools
      })
    })

  const createDefaultPool = (
    poolId: string,
    poolType: Schema.Schema.Type<typeof AllocationRequest>['poolType']
  ): Schema.Schema.Type<typeof MemoryPool> => ({
    _tag: 'MemoryPool',
    poolId,
    poolType,
    maxSize: 512 * 1024 * 1024, // 512MB
    currentSize: 0,
    allocatedItems: 0,
    freeItems: 100,
    fragmentationRatio: 0,
    lastCompaction: yield* Clock.currentTimeMillis,
  })

  return MemoryMonitorService.of({
    startMonitoring,
    stopMonitoring,
    getCurrentMetrics,
    getPressureLevel,
    allocateMemory,
    deallocateMemory,
    triggerGarbageCollection,
    optimizeMemoryPools,
    emergencyCleanup,
    getStatistics,
    getAlertHistory,
    updateConfiguration,
    predictMemoryUsage,
  })
})

// === Helper Functions ===

const createInitialMetrics = (): Effect.Effect<Schema.Schema.Type<typeof MemoryMetrics>> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    return {
      _tag: 'MemoryMetrics',
      totalMemory: 8 * 1024 * 1024 * 1024, // 8GB
      usedMemory: 2 * 1024 * 1024 * 1024, // 2GB
      freeMemory: 6 * 1024 * 1024 * 1024, // 6GB
      heapUsed: 256 * 1024 * 1024, // 256MB
      heapTotal: 512 * 1024 * 1024, // 512MB
      external: 128 * 1024 * 1024, // 128MB
      buffers: 64 * 1024 * 1024, // 64MB
      cached: 512 * 1024 * 1024, // 512MB
      timestamp,
    }
  })

const createInitialStatistics = (): Schema.Schema.Type<typeof MemoryStatistics> => ({
  _tag: 'MemoryStatistics',
  totalAllocations: 0,
  totalDeallocations: 0,
  peakMemoryUsage: 0,
  averageMemoryUsage: 0,
  gcTriggerCount: 0,
  fragmentationEvents: 0,
  allocationFailures: 0,
  pressureAlerts: [],
  poolStatistics: [],
})

// === Context Tag ===

export const MemoryMonitorService = Context.GenericTag<MemoryMonitorService>(
  '@minecraft/domain/world/MemoryMonitorService'
)

// === Layer ===

export const MemoryMonitorServiceLive = Layer.effect(MemoryMonitorService, makeMemoryMonitorService)

// === Default Configuration ===

export const DEFAULT_MEMORY_CONFIG: Schema.Schema.Type<typeof MemoryConfiguration> = {
  _tag: 'MemoryConfiguration',
  strategy: 'adaptive',
  thresholds: {
    lowPressure: 0.5,
    mediumPressure: 0.7,
    highPressure: 0.85,
    criticalPressure: 0.95,
  },
  monitoringInterval: 5000, // 5秒
  alertingEnabled: true,
  autoGCEnabled: true,
  gcTriggerThreshold: 0.8,
  emergencyCleanupEnabled: true,
  preallocation: {
    enabled: true,
    chunkPoolSize: 1000,
    bufferPoolSize: 256 * 1024 * 1024, // 256MB
  },
}

export type {
  AllocationRequest as AllocationRequestType,
  MemoryAlert as MemoryAlertType,
  MemoryConfiguration as MemoryConfigurationType,
  MemoryMetrics as MemoryMetricsType,
  MemoryPool as MemoryPoolType,
  MemoryStatistics as MemoryStatisticsType,
} from './memory_monitor'
