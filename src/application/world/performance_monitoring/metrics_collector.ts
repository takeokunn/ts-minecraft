import { ErrorCauseSchema } from '@shared/schema/error'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Clock, Context, Effect, Layer, Match, Random, Ref, Schema } from 'effect'

/**
 * Metrics Collector Service
 *
 * ワールド生成とロードのパフォーマンスメトリクスをリアルタイムで収集・分析します。
 * システム全体の性能指標を統合的に監視し、最適化のための洞察を提供します。
 */

// === Metric Types ===

export const MetricType = Schema.Union(
  Schema.Literal('counter'), // カウンタメトリクス
  Schema.Literal('gauge'), // ゲージメトリクス
  Schema.Literal('histogram'), // ヒストグラムメトリクス
  Schema.Literal('summary'), // サマリーメトリクス
  Schema.Literal('timer') // タイマーメトリクス
)

export const MetricValue = Schema.Struct({
  _tag: Schema.Literal('MetricValue'),
  name: Schema.String,
  type: MetricType,
  value: Schema.Number,
  timestamp: Schema.Number,
  labels: Schema.Record(Schema.String, Schema.String),
  unit: Schema.optional(Schema.String),
})

export const PerformanceMetrics = Schema.Struct({
  _tag: Schema.Literal('PerformanceMetrics'),
  // Generation Metrics
  worldGenerationTime: Schema.Number.pipe(Schema.positive()),
  chunkGenerationTime: Schema.Number.pipe(Schema.positive()),
  averageChunkSize: Schema.Number.pipe(Schema.positive()),
  generationThroughput: Schema.Number.pipe(Schema.positive()), // chunks/sec

  // Memory Metrics
  memoryUsage: Schema.Number.pipe(Schema.positive()),
  memoryPeak: Schema.Number.pipe(Schema.positive()),
  gcCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  gcTime: Schema.Number.pipe(Schema.positive()),

  // CPU Metrics
  cpuUsage: Schema.Number.pipe(Schema.between(0, 1)),
  cpuPeak: Schema.Number.pipe(Schema.between(0, 1)),
  threadCount: Schema.Number.pipe(Schema.positive(), Schema.int()),

  // I/O Metrics
  diskReadBytes: Schema.Number.pipe(Schema.nonNegativeInteger()),
  diskWriteBytes: Schema.Number.pipe(Schema.nonNegativeInteger()),
  diskIOPS: Schema.Number.pipe(Schema.nonNegativeInteger()),
  networkLatency: Schema.Number.pipe(Schema.positive()),

  // Cache Metrics
  cacheHitRate: Schema.Number.pipe(Schema.between(0, 1)),
  cacheMissCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  cacheEvictionCount: Schema.Number.pipe(Schema.nonNegativeInteger()),

  // Error Metrics
  errorCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  timeoutCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  retryCount: Schema.Number.pipe(Schema.nonNegativeInteger()),

  timestamp: Schema.Number,
})

export const MetricAggregation = Schema.Struct({
  _tag: Schema.Literal('MetricAggregation'),
  metricName: Schema.String,
  aggregationType: Schema.Union(
    Schema.Literal('sum'),
    Schema.Literal('average'),
    Schema.Literal('min'),
    Schema.Literal('max'),
    Schema.Literal('count'),
    Schema.Literal('percentile')
  ),
  value: Schema.Number,
  sampleCount: Schema.Number.pipe(Schema.nonNegativeInteger()),
  timeWindow: Schema.Number.pipe(Schema.positive()), // ミリ秒
})

export const AlertThreshold = Schema.Struct({
  _tag: Schema.Literal('AlertThreshold'),
  metricName: Schema.String,
  operator: Schema.Union(
    Schema.Literal('greater_than'),
    Schema.Literal('less_than'),
    Schema.Literal('equals'),
    Schema.Literal('not_equals')
  ),
  threshold: Schema.Number,
  severity: Schema.Union(
    Schema.Literal('info'),
    Schema.Literal('warning'),
    Schema.Literal('error'),
    Schema.Literal('critical')
  ),
  enabled: Schema.Boolean,
})

// === Metrics Configuration ===

export const MetricsConfiguration = Schema.Struct({
  _tag: Schema.Literal('MetricsConfiguration'),
  collectionInterval: Schema.Number.pipe(Schema.positive()), // ミリ秒
  retentionPeriod: Schema.Number.pipe(Schema.positive()), // ミリ秒
  aggregationEnabled: Schema.Boolean,
  alertingEnabled: Schema.Boolean,
  exportEnabled: Schema.Boolean,
  exportFormat: Schema.Union(Schema.Literal('prometheus'), Schema.Literal('json'), Schema.Literal('csv')),
  thresholds: Schema.Array(AlertThreshold),
  sampling: Schema.Struct({
    enabled: Schema.Boolean,
    rate: Schema.Number.pipe(Schema.between(0, 1)),
    strategy: Schema.Union(Schema.Literal('uniform'), Schema.Literal('adaptive'), Schema.Literal('weighted')),
  }),
})

// === Metrics Collector Error ===

export const MetricsCollectorErrorSchema = Schema.TaggedError('MetricsCollectorError', {
  message: Schema.String,
  collectorId: Schema.String,
  metric: Schema.optional(Schema.String),
  cause: Schema.optional(ErrorCauseSchema),
})

export type MetricsCollectorErrorType = Schema.Schema.Type<typeof MetricsCollectorErrorSchema>

export const MetricsCollectorError = {
  ...makeErrorFactory(MetricsCollectorErrorSchema),
  timerNotFound: (timerId: string): MetricsCollectorErrorType =>
    MetricsCollectorErrorSchema.make({
      message: `タイマーが見つかりません: ${timerId}`,
      collectorId: 'timer',
    }),
} as const

// === Service Interface ===

export interface MetricsCollectorService {
  /**
   * メトリクス収集を開始します
   */
  readonly startCollection: () => Effect.Effect<void, MetricsCollectorErrorType>

  /**
   * メトリクス収集を停止します
   */
  readonly stopCollection: () => Effect.Effect<void, MetricsCollectorErrorType>

  /**
   * カウンタメトリクスを記録します
   */
  readonly recordCounter: (
    name: string,
    value: number,
    labels?: Record<string, string>
  ) => Effect.Effect<void, MetricsCollectorErrorType>

  /**
   * ゲージメトリクスを記録します
   */
  readonly recordGauge: (
    name: string,
    value: number,
    labels?: Record<string, string>
  ) => Effect.Effect<void, MetricsCollectorErrorType>

  /**
   * ヒストグラムメトリクスを記録します
   */
  readonly recordHistogram: (
    name: string,
    value: number,
    buckets?: number[],
    labels?: Record<string, string>
  ) => Effect.Effect<void, MetricsCollectorErrorType>

  /**
   * タイマーを開始します
   */
  readonly startTimer: (
    name: string,
    labels?: Record<string, string>
  ) => Effect.Effect<string, MetricsCollectorErrorType> // タイマーID

  /**
   * タイマーを停止し、経過時間を記録します
   */
  readonly stopTimer: (timerId: string) => Effect.Effect<number, MetricsCollectorErrorType> // 経過時間（ミリ秒）

  /**
   * パフォーマンススナップショットを取得します
   */
  readonly getPerformanceSnapshot: () => Effect.Effect<
    Schema.Schema.Type<typeof PerformanceMetrics>,
    MetricsCollectorErrorType
  >

  /**
   * メトリクス集計を取得します
   */
  readonly getAggregation: (
    metricName: string,
    aggregationType: 'sum' | 'average' | 'min' | 'max' | 'count' | 'percentile',
    timeWindow: number
  ) => Effect.Effect<Schema.Schema.Type<typeof MetricAggregation>, MetricsCollectorErrorType>

  /**
   * アラート閾値を設定します
   */
  readonly setAlertThreshold: (
    threshold: Schema.Schema.Type<typeof AlertThreshold>
  ) => Effect.Effect<void, MetricsCollectorErrorType>

  /**
   * メトリクスをエクスポートします
   */
  readonly exportMetrics: (
    format: 'prometheus' | 'json' | 'csv',
    timeRange?: { start: number; end: number }
  ) => Effect.Effect<string, MetricsCollectorErrorType>

  /**
   * メトリクス設定を更新します
   */
  readonly updateConfiguration: (
    config: Partial<Schema.Schema.Type<typeof MetricsConfiguration>>
  ) => Effect.Effect<void, MetricsCollectorErrorType>

  /**
   * メトリクス統計を取得します
   */
  readonly getMetricsStatistics: () => Effect.Effect<
    {
      totalMetrics: number
      activeTimers: number
      memoryUsage: number
      lastCollection: number
    },
    MetricsCollectorErrorType
  >
}

// === Live Implementation ===

const makeMetricsCollectorService = Effect.gen(function* () {
  // 内部状態管理
  const configuration = yield* Ref.make<Schema.Schema.Type<typeof MetricsConfiguration>>(DEFAULT_METRICS_CONFIG)
  const isCollecting = yield* Ref.make<boolean>(false)
  const metrics = yield* Ref.make<Map<string, Schema.Schema.Type<typeof MetricValue>[]>>(new Map())
  const activeTimers = yield* Ref.make<
    Map<string, { name: string; startTime: number; labels?: Record<string, string> }>
  >(new Map())
  const alertThresholds = yield* Ref.make<Map<string, Schema.Schema.Type<typeof AlertThreshold>>>(new Map())

  const startCollection = () =>
    Effect.gen(function* () {
      const isActive = yield* Ref.get(isCollecting)

      // 早期return → Effect.when
      yield* Effect.when(isActive, () => Effect.logWarning('メトリクス収集は既に開始されています'))

      yield* Effect.unless(isActive, () =>
        Effect.gen(function* () {
          yield* Ref.set(isCollecting, true)

          // 収集ループを開始
          yield* Effect.forkScoped(collectionLoop())

          yield* Effect.logInfo('メトリクス収集開始')
        })
      )
    })

  const stopCollection = () =>
    Effect.gen(function* () {
      yield* Ref.set(isCollecting, false)
      yield* Effect.logInfo('メトリクス収集停止')
    })

  const recordCounter = (name: string, value: number, labels?: Record<string, string>) =>
    Effect.gen(function* () {
      const metricValue: Schema.Schema.Type<typeof MetricValue> = {
        _tag: 'MetricValue',
        name,
        type: 'counter',
        value,
        timestamp: yield* Clock.currentTimeMillis,
        labels: labels || {},
      }

      yield* addMetric(name, metricValue)
      yield* checkAlerts(name, value)
    })

  const recordGauge = (name: string, value: number, labels?: Record<string, string>) =>
    Effect.gen(function* () {
      const metricValue: Schema.Schema.Type<typeof MetricValue> = {
        _tag: 'MetricValue',
        name,
        type: 'gauge',
        value,
        timestamp: yield* Clock.currentTimeMillis,
        labels: labels || {},
      }

      yield* addMetric(name, metricValue)
      yield* checkAlerts(name, value)
    })

  const recordHistogram = (name: string, value: number, buckets?: number[], labels?: Record<string, string>) =>
    Effect.gen(function* () {
      const metricValue: Schema.Schema.Type<typeof MetricValue> = {
        _tag: 'MetricValue',
        name,
        type: 'histogram',
        value,
        timestamp: yield* Clock.currentTimeMillis,
        labels: labels || {},
      }

      yield* addMetric(name, metricValue)
      yield* checkAlerts(name, value)
    })

  const startTimer = (name: string, labels?: Record<string, string>) =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const randomValue = yield* Random.nextIntBetween(0, 36 ** 9 - 1)
      const nonce = randomValue.toString(36).padStart(9, '0')
      const timerId = `timer_${now}_${nonce}`
      const timer = {
        name,
        startTime: now,
        labels,
      }

      yield* Ref.update(activeTimers, (map) => map.set(timerId, timer))
      yield* Effect.logDebug(`タイマー開始: ${name} (${timerId})`)

      return timerId
    })

  const stopTimer = (timerId: string) =>
    Effect.gen(function* () {
      const timers = yield* Ref.get(activeTimers)
      const timer = timers.get(timerId)

      // Option.fromNullable + Option.match
      const validTimer = yield* pipe(
        Option.fromNullable(timer),
        Option.match({
          onNone: () => Effect.fail(MetricsCollectorError.timerNotFound(timerId)),
          onSome: (t) => Effect.succeed(t),
        })
      )

      const elapsedTime = yield* Clock.currentTimeMillis - validTimer.startTime

      // タイマーメトリクスを記録
      yield* recordHistogram(timer.name, elapsedTime, undefined, timer.labels)

      // アクティブタイマーから削除
      yield* Ref.update(activeTimers, (map) => {
        map.delete(timerId)
        return map
      })

      yield* Effect.logDebug(`タイマー停止: ${timer.name} (${elapsedTime}ms)`)
      return elapsedTime
    })

  const getPerformanceSnapshot = () =>
    Effect.gen(function* () {
      const metricsMap = yield* Ref.get(metrics)

      // 各メトリクスの最新値を取得
      const snapshot: Schema.Schema.Type<typeof PerformanceMetrics> = {
        _tag: 'PerformanceMetrics',
        worldGenerationTime: getLatestMetricValue(metricsMap, 'world_generation_time') || 0,
        chunkGenerationTime: getLatestMetricValue(metricsMap, 'chunk_generation_time') || 0,
        averageChunkSize: getLatestMetricValue(metricsMap, 'average_chunk_size') || 0,
        generationThroughput: getLatestMetricValue(metricsMap, 'generation_throughput') || 0,
        memoryUsage: getLatestMetricValue(metricsMap, 'memory_usage') || 0,
        memoryPeak: getLatestMetricValue(metricsMap, 'memory_peak') || 0,
        gcCount: getLatestMetricValue(metricsMap, 'gc_count') || 0,
        gcTime: getLatestMetricValue(metricsMap, 'gc_time') || 0,
        cpuUsage: getLatestMetricValue(metricsMap, 'cpu_usage') || 0,
        cpuPeak: getLatestMetricValue(metricsMap, 'cpu_peak') || 0,
        threadCount: getLatestMetricValue(metricsMap, 'thread_count') || 0,
        diskReadBytes: getLatestMetricValue(metricsMap, 'disk_read_bytes') || 0,
        diskWriteBytes: getLatestMetricValue(metricsMap, 'disk_write_bytes') || 0,
        diskIOPS: getLatestMetricValue(metricsMap, 'disk_iops') || 0,
        networkLatency: getLatestMetricValue(metricsMap, 'network_latency') || 0,
        cacheHitRate: getLatestMetricValue(metricsMap, 'cache_hit_rate') || 0,
        cacheMissCount: getLatestMetricValue(metricsMap, 'cache_miss_count') || 0,
        cacheEvictionCount: getLatestMetricValue(metricsMap, 'cache_eviction_count') || 0,
        errorCount: getLatestMetricValue(metricsMap, 'error_count') || 0,
        timeoutCount: getLatestMetricValue(metricsMap, 'timeout_count') || 0,
        retryCount: getLatestMetricValue(metricsMap, 'retry_count') || 0,
        timestamp: yield* Clock.currentTimeMillis,
      }

      return snapshot
    })

  const getAggregation = (
    metricName: string,
    aggregationType: 'sum' | 'average' | 'min' | 'max' | 'count' | 'percentile',
    timeWindow: number
  ) =>
    Effect.gen(function* () {
      const metricsMap = yield* Ref.get(metrics)
      const metricData = metricsMap.get(metricName) || []

      const now = yield* Clock.currentTimeMillis
      const filteredData = metricData.filter((m) => now - m.timestamp <= timeWindow)

      // 早期return → Option.match
      return yield* pipe(
        filteredData.length === 0
          ? Option.none<ReadonlyArray<Schema.Schema.Type<typeof MetricValue>>>()
          : Option.some(filteredData as ReadonlyArray<Schema.Schema.Type<typeof MetricValue>>),
        Option.match({
          onNone: () =>
            Effect.succeed({
              _tag: 'MetricAggregation' as const,
              metricName,
              aggregationType,
              value: 0,
              sampleCount: 0,
              timeWindow,
            }),
          onSome: (data) =>
            Effect.gen(function* () {
              const values = data.map((m) => m.value)

              const aggregatedValue = Match.value(aggregationType).pipe(
                Match.when('sum', () => values.reduce((sum, val) => sum + val, 0)),
                Match.when('average', () => values.reduce((sum, val) => sum + val, 0) / values.length),
                Match.when('min', () => Math.min(...values)),
                Match.when('max', () => Math.max(...values)),
                Match.when('count', () => values.length),
                Match.when('percentile', () => {
                  // 95パーセンタイルを計算
                  const sorted = [...values].sort((a, b) => a - b)
                  const index = Math.ceil(sorted.length * 0.95) - 1
                  return sorted[Math.max(0, index)]
                }),
                Match.exhaustive
              )

              return {
                _tag: 'MetricAggregation' as const,
                metricName,
                aggregationType,
                value: aggregatedValue,
                sampleCount: data.length,
                timeWindow,
              }
            }),
        })
      )
    })

  const setAlertThreshold = (threshold: Schema.Schema.Type<typeof AlertThreshold>) =>
    Effect.gen(function* () {
      yield* Ref.update(alertThresholds, (map) => map.set(threshold.metricName, threshold))
      yield* Effect.logInfo(`アラート閾値設定: ${threshold.metricName} ${threshold.operator} ${threshold.threshold}`)
    })

  const exportMetrics = (format: 'prometheus' | 'json' | 'csv', timeRange?: { start: number; end: number }) =>
    Effect.gen(function* () {
      const metricsMap = yield* Ref.get(metrics)

      // Map iterationのfor-of撲滅 → Option.match + pipe
      const filteredMetrics = yield* pipe(
        Option.fromNullable(timeRange),
        Option.match({
          onNone: () => Effect.succeed(new Map(metricsMap)),
          onSome: (range) =>
            Effect.sync(() => {
              const filtered = new Map<string, Schema.Schema.Type<typeof MetricValue>[]>()
              pipe(
                Array.from(metricsMap.entries()),
                ReadonlyArray.forEach(([name, metricList]) => {
                  const filteredList = metricList.filter((m) => m.timestamp >= range.start && m.timestamp <= range.end)
                  filtered.set(name, filteredList)
                })
              )
              return filtered
            }),
        })
      )

      return Match.value(format).pipe(
        Match.when('prometheus', () => exportToPrometheus(filteredMetrics)),
        Match.when('json', () => exportToJSON(filteredMetrics)),
        Match.when('csv', () => exportToCSV(filteredMetrics)),
        Match.exhaustive
      )
    })

  const updateConfiguration = (configUpdate: Partial<Schema.Schema.Type<typeof MetricsConfiguration>>) =>
    Effect.gen(function* () {
      yield* Ref.update(configuration, (current) => ({ ...current, ...configUpdate }))
      yield* Effect.logInfo('メトリクス設定更新完了')
    })

  const getMetricsStatistics = () =>
    Effect.gen(function* () {
      const metricsMap = yield* Ref.get(metrics)
      const timers = yield* Ref.get(activeTimers)

      const totalMetrics = Array.from(metricsMap.values()).reduce((sum, metricList) => sum + metricList.length, 0)

      const memoryUsage = estimateMemoryUsage(metricsMap)

      return {
        totalMetrics,
        activeTimers: timers.size,
        memoryUsage,
        lastCollection: yield* Clock.currentTimeMillis,
      }
    })

  // === Helper Functions ===

  const collectionLoop = () =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configuration)

      yield* Effect.repeat(
        Effect.gen(function* () {
          const isActive = yield* Ref.get(isCollecting)

          // 早期return → Effect.ifの変換
          return yield* Effect.if(isActive, {
            onTrue: () =>
              Effect.gen(function* () {
                // システムメトリクス収集
                yield* collectSystemMetrics()

                // 古いメトリクスのクリーンアップ
                yield* cleanupOldMetrics()

                return true
              }),
            onFalse: () => Effect.succeed(false),
          })
        }),
        { schedule: Effect.Schedule.spaced(`${config.collectionInterval} millis`) }
      )
    })

  const addMetric = (name: string, metric: Schema.Schema.Type<typeof MetricValue>) =>
    Effect.gen(function* () {
      yield* Ref.update(metrics, (map) => {
        const existing = map.get(name) || []
        map.set(name, [...existing, metric])
        return map
      })

      yield* Effect.logDebug(`メトリクス記録: ${name} = ${metric.value}`)
    })

  const checkAlerts = (metricName: string, value: number) =>
    Effect.gen(function* () {
      const thresholds = yield* Ref.get(alertThresholds)
      const threshold = thresholds.get(metricName)

      // Option.fromNullable + Option.match
      yield* pipe(
        Option.fromNullable(threshold),
        Option.filter((t) => t.enabled),
        Option.match({
          onNone: () => Effect.void,
          onSome: (t) =>
            Effect.gen(function* () {
              const triggered = Match.value(t.operator).pipe(
                Match.when('greater_than', () => value > t.threshold),
                Match.when('less_than', () => value < t.threshold),
                Match.when('equals', () => value === t.threshold),
                Match.when('not_equals', () => value !== t.threshold),
                Match.exhaustive
              )

              yield* Effect.when(triggered, () =>
                Effect.logWarning(
                  `アラート発生: ${metricName} = ${value} (閾値: ${t.threshold}, 重要度: ${t.severity})`
                )
              )
            }),
        })
      )
    })

  const collectSystemMetrics = () =>
    Effect.gen(function* () {
      // システムメトリクスの収集（簡略化）
      const now = yield* Clock.currentTimeMillis

      const memoryOffset = yield* Random.nextIntBetween(0, 1024 * 1024 * 1024) // 0-1GB
      const cpuOffset = yield* Random.nextIntBetween(0, 40) // 0-40 -> 0.0-0.4
      const cacheHitOffset = yield* Random.nextIntBetween(0, 20) // 0-20 -> 0.0-0.2
      const throughputOffset = yield* Random.nextIntBetween(0, 5) // 0-5

      yield* recordGauge('memory_usage', 4 * 1024 * 1024 * 1024 + memoryOffset)
      yield* recordGauge('cpu_usage', 0.3 + cpuOffset / 100)
      yield* recordGauge('cache_hit_rate', 0.7 + cacheHitOffset / 100)
      yield* recordCounter('generation_throughput', 10 + throughputOffset)

      yield* Effect.logDebug('システムメトリクス収集完了')
    })

  const cleanupOldMetrics = () =>
    Effect.gen(function* () {
      const config = yield* Ref.get(configuration)
      const cutoffTime = yield* Clock.currentTimeMillis - config.retentionPeriod

      // Map iterationのfor-of撲滅 → ReadonlyArray.forEach
      yield* Ref.update(metrics, (map) => {
        pipe(
          Array.from(map.entries()),
          ReadonlyArray.forEach(([name, metricList]) => {
            const filtered = metricList.filter((m) => m.timestamp >= cutoffTime)
            map.set(name, filtered)
          })
        )
        return map
      })
    })

  const getLatestMetricValue = (
    metricsMap: Map<string, Schema.Schema.Type<typeof MetricValue>[]>,
    metricName: string
  ): number | undefined => {
    const metricList = metricsMap.get(metricName)

    // Option.fromNullable + Option.match
    return pipe(
      Option.fromNullable(metricList),
      Option.filter((list) => list.length > 0),
      Option.map((list) => list[list.length - 1].value),
      Option.getOrUndefined
    )
  }

  const exportToPrometheus = (metricsMap: Map<string, Schema.Schema.Type<typeof MetricValue>[]>) => {
    // Map iterationのfor-of撲滅 → pipe + reduce
    return pipe(
      Array.from(metricsMap.entries()),
      ReadonlyArray.filterMap(([name, metricList]) =>
        pipe(
          Option.fromNullable(metricList),
          Option.filter((list) => list.length > 0),
          Option.map((list) => list[list.length - 1]),
          Option.map((latest) => {
            const labelStr = Object.entries(latest.labels)
              .map(([key, value]) => `${key}="${value}"`)
              .join(',')

            return `# TYPE ${name} ${latest.type}\n${name}{${labelStr}} ${latest.value} ${latest.timestamp}\n`
          })
        )
      ),
      ReadonlyArray.join('')
    )
  }

  const exportToJSON = (metricsMap: Map<string, Schema.Schema.Type<typeof MetricValue>[]>) => {
    const exportData = Object.fromEntries(metricsMap)
    return JSON.stringify(exportData, null, 2)
  }

  const exportToCSV = (metricsMap: Map<string, Schema.Schema.Type<typeof MetricValue>[]>) => {
    const header = 'metric_name,type,value,timestamp,labels\n'

    // 2重ネストfor-of撲滅 → flatMap + map
    const rows = pipe(
      Array.from(metricsMap.entries()),
      ReadonlyArray.flatMap(([name, metricList]) =>
        pipe(
          metricList,
          ReadonlyArray.map((metric) => {
            const labelsStr = JSON.stringify(metric.labels)
            return `${name},${metric.type},${metric.value},${metric.timestamp},"${labelsStr}"\n`
          })
        )
      ),
      ReadonlyArray.join('')
    )

    return header + rows
  }

  const estimateMemoryUsage = (metricsMap: Map<string, Schema.Schema.Type<typeof MetricValue>[]>) => {
    // Map.values() iterationのfor-of撲滅 → reduce
    return pipe(
      Array.from(metricsMap.values()),
      ReadonlyArray.reduce(0, (totalSize, metricList) => totalSize + metricList.length * 100) // 1メトリクス約100バイトと仮定
    )
  }

  return MetricsCollectorService.of({
    startCollection,
    stopCollection,
    recordCounter,
    recordGauge,
    recordHistogram,
    startTimer,
    stopTimer,
    getPerformanceSnapshot,
    getAggregation,
    setAlertThreshold,
    exportMetrics,
    updateConfiguration,
    getMetricsStatistics,
  })
})

// === Context Tag ===

export const MetricsCollectorService = Context.GenericTag<MetricsCollectorService>(
  '@minecraft/domain/world/MetricsCollectorService'
)

// === Layer ===

export const MetricsCollectorServiceLive = Layer.scoped(MetricsCollectorService, makeMetricsCollectorService)

// === Default Configuration ===

export const DEFAULT_METRICS_CONFIG: Schema.Schema.Type<typeof MetricsConfiguration> = {
  _tag: 'MetricsConfiguration',
  collectionInterval: 5000, // 5秒
  retentionPeriod: 3600000, // 1時間
  aggregationEnabled: true,
  alertingEnabled: true,
  exportEnabled: true,
  exportFormat: 'prometheus',
  thresholds: [],
  sampling: {
    enabled: false,
    rate: 1.0,
    strategy: 'uniform',
  },
}

export type {
  AlertThreshold as AlertThresholdType,
  MetricAggregation as MetricAggregationType,
  MetricsConfiguration as MetricsConfigurationType,
  MetricValue as MetricValueType,
  PerformanceMetrics as PerformanceMetricsType,
} from './metrics_collector'
