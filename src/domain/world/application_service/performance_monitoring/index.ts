/**
 * Performance Monitoring Application Service
 *
 * ワールド生成システムの包括的なパフォーマンス監視を提供します。
 * メトリクス収集、ボトルネック検出、最適化提案、ベンチマーク実行を統合した
 * 高度な性能分析システムです。
 */

// === Metrics Collector ===
export {
  AlertThreshold,
  DEFAULT_METRICS_CONFIG,
  MetricAggregation,
  MetricsCollectorError,
  MetricsCollectorService,
  MetricsCollectorServiceLive,
  MetricsConfiguration,
  MetricValue,
  PerformanceMetrics,
} from './metrics_collector.js'

export type {
  AlertThresholdType,
  MetricAggregationType,
  MetricsCollectorErrorType,
  MetricsConfigurationType,
  MetricValueType,
  PerformanceMetricsType,
} from './metrics_collector.js'

// === Integrated Performance Monitoring Service ===

import { Context, Effect, Layer, Ref, Schema } from 'effect'
import { MetricsCollectorService } from './metrics_collector.js'

/**
 * Performance Monitoring Service Error
 */
export const PerformanceMonitoringError = Schema.TaggedError<PerformanceMonitoringErrorType>()(
  'PerformanceMonitoringError',
  {
    message: Schema.String,
    monitorId: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  }
)

export interface PerformanceMonitoringErrorType extends Schema.Schema.Type<typeof PerformanceMonitoringError> {}

/**
 * Bottleneck Detection Result
 */
export const BottleneckDetectionResult = Schema.Struct({
  _tag: Schema.Literal('BottleneckDetectionResult'),
  detectedBottlenecks: Schema.Array(
    Schema.Struct({
      component: Schema.String,
      severity: Schema.Union(
        Schema.Literal('low'),
        Schema.Literal('medium'),
        Schema.Literal('high'),
        Schema.Literal('critical')
      ),
      description: Schema.String,
      impact: Schema.Number.pipe(Schema.between(0, 1)),
      suggestions: Schema.Array(Schema.String),
    })
  ),
  overallHealth: Schema.Number.pipe(Schema.between(0, 1)),
  timestamp: Schema.Number,
})

/**
 * Optimization Recommendation
 */
export const OptimizationRecommendation = Schema.Struct({
  _tag: Schema.Literal('OptimizationRecommendation'),
  category: Schema.Union(
    Schema.Literal('memory'),
    Schema.Literal('cpu'),
    Schema.Literal('io'),
    Schema.Literal('cache'),
    Schema.Literal('algorithm')
  ),
  priority: Schema.Union(
    Schema.Literal('low'),
    Schema.Literal('medium'),
    Schema.Literal('high'),
    Schema.Literal('critical')
  ),
  title: Schema.String,
  description: Schema.String,
  expectedImprovement: Schema.String,
  implementationEffort: Schema.Union(Schema.Literal('low'), Schema.Literal('medium'), Schema.Literal('high')),
  estimatedImpact: Schema.Number.pipe(Schema.between(0, 1)),
})

/**
 * Benchmark Result
 */
export const BenchmarkResult = Schema.Struct({
  _tag: Schema.Literal('BenchmarkResult'),
  benchmarkName: Schema.String,
  duration: Schema.Number.pipe(Schema.positive()),
  operations: Schema.Number.pipe(Schema.positive(), Schema.int()),
  operationsPerSecond: Schema.Number.pipe(Schema.positive()),
  averageLatency: Schema.Number.pipe(Schema.positive()),
  p95Latency: Schema.Number.pipe(Schema.positive()),
  p99Latency: Schema.Number.pipe(Schema.positive()),
  memoryUsage: Schema.Number.pipe(Schema.positive()),
  errorRate: Schema.Number.pipe(Schema.between(0, 1)),
  timestamp: Schema.Number,
})

/**
 * Performance Monitoring Service Interface
 */
export interface PerformanceMonitoringService {
  /**
   * パフォーマンス監視システムを初期化します
   */
  readonly initialize: () => Effect.Effect<void, PerformanceMonitoringErrorType>

  /**
   * 監視を開始します
   */
  readonly startMonitoring: () => Effect.Effect<void, PerformanceMonitoringErrorType>

  /**
   * 監視を停止します
   */
  readonly stopMonitoring: () => Effect.Effect<void, PerformanceMonitoringErrorType>

  /**
   * ボトルネック検出を実行します
   */
  readonly detectBottlenecks: () => Effect.Effect<
    Schema.Schema.Type<typeof BottleneckDetectionResult>,
    PerformanceMonitoringErrorType
  >

  /**
   * 最適化提案を生成します
   */
  readonly generateOptimizationRecommendations: () => Effect.Effect<
    Schema.Schema.Type<typeof OptimizationRecommendation>[],
    PerformanceMonitoringErrorType
  >

  /**
   * ベンチマークを実行します
   */
  readonly runBenchmark: (
    benchmarkName: string,
    operations: number,
    concurrency?: number
  ) => Effect.Effect<Schema.Schema.Type<typeof BenchmarkResult>, PerformanceMonitoringErrorType>

  /**
   * パフォーマンスレポートを生成します
   */
  readonly generatePerformanceReport: (timeRange?: { start: number; end: number }) => Effect.Effect<
    {
      summary: {
        overallHealth: number
        avgResponseTime: number
        throughput: number
        errorRate: number
      }
      bottlenecks: Schema.Schema.Type<typeof BottleneckDetectionResult>
      recommendations: Schema.Schema.Type<typeof OptimizationRecommendation>[]
      trends: Array<{ metric: string; trend: 'improving' | 'stable' | 'degrading' }>
    },
    PerformanceMonitoringErrorType
  >

  /**
   * アラートルールを設定します
   */
  readonly configureAlerts: (
    rules: Array<{
      metricName: string
      threshold: number
      operator: 'greater_than' | 'less_than'
      severity: 'info' | 'warning' | 'error' | 'critical'
    }>
  ) => Effect.Effect<void, PerformanceMonitoringErrorType>

  /**
   * リアルタイムメトリクスを取得します
   */
  readonly getRealTimeMetrics: () => Effect.Effect<
    {
      timestamp: number
      metrics: Record<string, number>
      health: number
    },
    PerformanceMonitoringErrorType
  >
}

// === Live Implementation ===

const makePerformanceMonitoringService = Effect.gen(function* () {
  const metricsCollector = yield* MetricsCollectorService
  const isMonitoring = yield* Ref.make<boolean>(false)
  const monitoringStartTime = yield* Ref.make<number>(0)

  const initialize = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('Performance Monitoring システム初期化開始')

      // デフォルトアラート設定
      yield* metricsCollector.setAlertThreshold({
        _tag: 'AlertThreshold',
        metricName: 'memory_usage',
        operator: 'greater_than',
        threshold: 6 * 1024 * 1024 * 1024, // 6GB
        severity: 'warning',
        enabled: true,
      })

      yield* metricsCollector.setAlertThreshold({
        _tag: 'AlertThreshold',
        metricName: 'cpu_usage',
        operator: 'greater_than',
        threshold: 0.8, // 80%
        severity: 'warning',
        enabled: true,
      })

      yield* Effect.logInfo('Performance Monitoring システム初期化完了')
    })

  const startMonitoring = () =>
    Effect.gen(function* () {
      const isActive = yield* Ref.get(isMonitoring)
      if (isActive) {
        yield* Effect.logWarning('パフォーマンス監視は既に開始されています')
        return
      }

      yield* Ref.set(isMonitoring, true)
      yield* Ref.set(monitoringStartTime, Date.now())

      // メトリクス収集開始
      yield* metricsCollector.startCollection()

      yield* Effect.logInfo('パフォーマンス監視開始')
    })

  const stopMonitoring = () =>
    Effect.gen(function* () {
      yield* Ref.set(isMonitoring, false)
      yield* metricsCollector.stopCollection()
      yield* Effect.logInfo('パフォーマンス監視停止')
    })

  const detectBottlenecks = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('ボトルネック検出開始')

      const snapshot = yield* metricsCollector.getPerformanceSnapshot()
      const bottlenecks = []

      // CPU使用率チェック
      if (snapshot.cpuUsage > 0.8) {
        bottlenecks.push({
          component: 'CPU',
          severity: 'high' as const,
          description: `CPU使用率が高すぎます: ${(snapshot.cpuUsage * 100).toFixed(1)}%`,
          impact: Math.min(snapshot.cpuUsage, 1.0),
          suggestions: ['チャンク生成の並列度を下げる', 'テレインジェネレーションの最適化', '不要な計算の削減'],
        })
      }

      // メモリ使用量チェック
      if (snapshot.memoryUsage > 6 * 1024 * 1024 * 1024) {
        // 6GB
        bottlenecks.push({
          component: 'Memory',
          severity: 'medium' as const,
          description: `メモリ使用量が高いです: ${(snapshot.memoryUsage / (1024 * 1024 * 1024)).toFixed(1)}GB`,
          impact: 0.6,
          suggestions: ['チャンクキャッシュサイズの調整', 'ガベージコレクションの実行', 'メモリプールの最適化'],
        })
      }

      // キャッシュヒット率チェック
      if (snapshot.cacheHitRate < 0.7) {
        bottlenecks.push({
          component: 'Cache',
          severity: 'medium' as const,
          description: `キャッシュヒット率が低いです: ${(snapshot.cacheHitRate * 100).toFixed(1)}%`,
          impact: 1.0 - snapshot.cacheHitRate,
          suggestions: ['プリローディング戦略の見直し', 'キャッシュサイズの増加', 'エビクションポリシーの調整'],
        })
      }

      // I/O パフォーマンスチェック
      if (snapshot.diskIOPS > 1000) {
        bottlenecks.push({
          component: 'Disk I/O',
          severity: 'low' as const,
          description: `ディスクI/O負荷が高いです: ${snapshot.diskIOPS} IOPS`,
          impact: 0.3,
          suggestions: ['SSDへの移行検討', 'I/Oバッファリングの最適化', '非同期書き込みの活用'],
        })
      }

      const overallHealth = 1.0 - bottlenecks.reduce((sum, b) => sum + b.impact, 0) / Math.max(bottlenecks.length, 1)

      const result: Schema.Schema.Type<typeof BottleneckDetectionResult> = {
        _tag: 'BottleneckDetectionResult',
        detectedBottlenecks: bottlenecks,
        overallHealth: Math.max(0, overallHealth),
        timestamp: Date.now(),
      }

      yield* Effect.logInfo(
        `ボトルネック検出完了: ${bottlenecks.length}個検出, 健全性: ${(overallHealth * 100).toFixed(1)}%`
      )
      return result
    })

  const generateOptimizationRecommendations = () =>
    Effect.gen(function* () {
      yield* Effect.logInfo('最適化提案生成開始')

      const snapshot = yield* metricsCollector.getPerformanceSnapshot()
      const recommendations: Schema.Schema.Type<typeof OptimizationRecommendation>[] = []

      // メモリ最適化提案
      if (snapshot.memoryUsage > 4 * 1024 * 1024 * 1024) {
        // 4GB
        recommendations.push({
          _tag: 'OptimizationRecommendation',
          category: 'memory',
          priority: 'high',
          title: 'メモリ使用量の最適化',
          description: 'チャンクプールサイズを調整し、未使用チャンクを積極的に解放する',
          expectedImprovement: '20-30%のメモリ使用量削減',
          implementationEffort: 'medium',
          estimatedImpact: 0.7,
        })
      }

      // CPU最適化提案
      if (snapshot.cpuUsage > 0.6) {
        recommendations.push({
          _tag: 'OptimizationRecommendation',
          category: 'cpu',
          priority: 'medium',
          title: 'CPU負荷の分散',
          description: 'ワールド生成タスクをワーカースレッドに分散し、メインスレッドの負荷を軽減',
          expectedImprovement: '15-25%のCPU使用率改善',
          implementationEffort: 'high',
          estimatedImpact: 0.6,
        })
      }

      // キャッシュ最適化提案
      if (snapshot.cacheHitRate < 0.8) {
        recommendations.push({
          _tag: 'OptimizationRecommendation',
          category: 'cache',
          priority: 'medium',
          title: 'キャッシュ戦略の改善',
          description: 'プレイヤーの移動パターンを学習し、予測的なプリローディングを実装',
          expectedImprovement: '10-20%のキャッシュヒット率向上',
          implementationEffort: 'medium',
          estimatedImpact: 0.5,
        })
      }

      // I/O最適化提案
      if (snapshot.diskIOPS > 500) {
        recommendations.push({
          _tag: 'OptimizationRecommendation',
          category: 'io',
          priority: 'low',
          title: 'I/O操作の最適化',
          description: 'バッチ書き込みと非同期I/Oを活用してディスク負荷を軽減',
          expectedImprovement: '30-40%のI/O効率向上',
          implementationEffort: 'low',
          estimatedImpact: 0.4,
        })
      }

      yield* Effect.logInfo(`最適化提案生成完了: ${recommendations.length}件`)
      return recommendations
    })

  const runBenchmark = (benchmarkName: string, operations: number, concurrency: number = 1) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`ベンチマーク開始: ${benchmarkName} (${operations}操作, ${concurrency}並行)`)

      const startTime = Date.now()
      const startMemory = (yield* metricsCollector.getPerformanceSnapshot()).memoryUsage

      // ベンチマーク実行（簡略化）
      const latencies: number[] = []
      let errorCount = 0

      for (let i = 0; i < operations; i++) {
        const opStart = Date.now()

        try {
          // ダミー操作（実際のベンチマークではワールド生成などを実行）
          yield* Effect.sleep(`${Math.random() * 10 + 5} millis`)
        } catch (error) {
          errorCount++
        }

        const opEnd = Date.now()
        latencies.push(opEnd - opStart)
      }

      const endTime = Date.now()
      const endMemory = (yield* metricsCollector.getPerformanceSnapshot()).memoryUsage
      const duration = endTime - startTime

      // 統計計算
      const sortedLatencies = latencies.sort((a, b) => a - b)
      const averageLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
      const p95Index = Math.floor(sortedLatencies.length * 0.95)
      const p99Index = Math.floor(sortedLatencies.length * 0.99)

      const result: Schema.Schema.Type<typeof BenchmarkResult> = {
        _tag: 'BenchmarkResult',
        benchmarkName,
        duration,
        operations,
        operationsPerSecond: operations / (duration / 1000),
        averageLatency,
        p95Latency: sortedLatencies[p95Index] || averageLatency,
        p99Latency: sortedLatencies[p99Index] || averageLatency,
        memoryUsage: endMemory - startMemory,
        errorRate: errorCount / operations,
        timestamp: Date.now(),
      }

      yield* Effect.logInfo(
        `ベンチマーク完了: ${benchmarkName} - ${result.operationsPerSecond.toFixed(1)} ops/sec, ` +
          `平均レイテンシ: ${result.averageLatency.toFixed(1)}ms`
      )

      return result
    })

  const generatePerformanceReport = (timeRange?: { start: number; end: number }) =>
    Effect.gen(function* () {
      yield* Effect.logInfo('パフォーマンスレポート生成開始')

      const snapshot = yield* metricsCollector.getPerformanceSnapshot()
      const bottlenecks = yield* detectBottlenecks()
      const recommendations = yield* generateOptimizationRecommendations()

      // サマリー計算
      const summary = {
        overallHealth: bottlenecks.overallHealth,
        avgResponseTime: snapshot.chunkGenerationTime,
        throughput: snapshot.generationThroughput,
        errorRate: snapshot.errorCount / Math.max(snapshot.errorCount + 1000, 1), // 仮の成功数
      }

      // トレンド分析（簡略化）
      const trends = [
        { metric: 'memory_usage', trend: 'stable' as const },
        { metric: 'cpu_usage', trend: 'improving' as const },
        { metric: 'cache_hit_rate', trend: 'stable' as const },
        { metric: 'generation_throughput', trend: 'improving' as const },
      ]

      const report = {
        summary,
        bottlenecks,
        recommendations,
        trends,
      }

      yield* Effect.logInfo('パフォーマンスレポート生成完了')
      return report
    })

  const configureAlerts = (
    rules: Array<{
      metricName: string
      threshold: number
      operator: 'greater_than' | 'less_than'
      severity: 'info' | 'warning' | 'error' | 'critical'
    }>
  ) =>
    Effect.gen(function* () {
      for (const rule of rules) {
        yield* metricsCollector.setAlertThreshold({
          _tag: 'AlertThreshold',
          metricName: rule.metricName,
          operator: rule.operator,
          threshold: rule.threshold,
          severity: rule.severity,
          enabled: true,
        })
      }

      yield* Effect.logInfo(`アラートルール設定完了: ${rules.length}件`)
    })

  const getRealTimeMetrics = () =>
    Effect.gen(function* () {
      const snapshot = yield* metricsCollector.getPerformanceSnapshot()
      const bottlenecks = yield* detectBottlenecks()

      return {
        timestamp: Date.now(),
        metrics: {
          memory_usage: snapshot.memoryUsage,
          cpu_usage: snapshot.cpuUsage,
          cache_hit_rate: snapshot.cacheHitRate,
          generation_throughput: snapshot.generationThroughput,
          error_count: snapshot.errorCount,
        },
        health: bottlenecks.overallHealth,
      }
    })

  return PerformanceMonitoringService.of({
    initialize,
    startMonitoring,
    stopMonitoring,
    detectBottlenecks,
    generateOptimizationRecommendations,
    runBenchmark,
    generatePerformanceReport,
    configureAlerts,
    getRealTimeMetrics,
  })
})

// === Context Tag ===

export const PerformanceMonitoringService = Context.GenericTag<PerformanceMonitoringService>(
  '@minecraft/domain/world/PerformanceMonitoringService'
)

// === Layer ===

export const PerformanceMonitoringServiceLive = Layer.effect(
  PerformanceMonitoringService,
  makePerformanceMonitoringService
).pipe(Layer.provide(MetricsCollectorServiceLive))

// === Complete Service Layer ===

export const PerformanceMonitoringServicesLayer = Layer.mergeAll(
  MetricsCollectorServiceLive,
  PerformanceMonitoringServiceLive
)

// === Helper Functions ===

export const PerformanceMonitoringUtils = {
  /**
   * パフォーマンススコアを計算
   */
  calculatePerformanceScore: (cpuUsage: number, memoryUsage: number, cacheHitRate: number, errorRate: number) => {
    const cpuScore = Math.max(0, 1 - cpuUsage)
    const memoryScore = Math.max(0, 1 - memoryUsage / (8 * 1024 * 1024 * 1024))
    const cacheScore = cacheHitRate
    const errorScore = Math.max(0, 1 - errorRate)

    return cpuScore * 0.3 + memoryScore * 0.25 + cacheScore * 0.25 + errorScore * 0.2
  },

  /**
   * ベンチマーク結果の比較
   */
  compareBenchmarkResults: (
    baseline: Schema.Schema.Type<typeof BenchmarkResult>,
    current: Schema.Schema.Type<typeof BenchmarkResult>
  ) => {
    const throughputImprovement =
      (current.operationsPerSecond - baseline.operationsPerSecond) / baseline.operationsPerSecond
    const latencyImprovement = (baseline.averageLatency - current.averageLatency) / baseline.averageLatency
    const memoryImprovement = (baseline.memoryUsage - current.memoryUsage) / baseline.memoryUsage

    return {
      throughputChange: throughputImprovement,
      latencyChange: latencyImprovement,
      memoryChange: memoryImprovement,
      overallImprovement: (throughputImprovement + latencyImprovement + memoryImprovement) / 3,
    }
  },

  /**
   * アラート重要度の判定
   */
  assessAlertSeverity: (metricName: string, value: number, threshold: number) => {
    const ratio = value / threshold

    if (ratio > 2.0) return 'critical'
    if (ratio > 1.5) return 'error'
    if (ratio > 1.1) return 'warning'
    return 'info'
  },
}

export type {
  BenchmarkResult as BenchmarkResultType,
  BottleneckDetectionResult as BottleneckDetectionResultType,
  OptimizationRecommendation as OptimizationRecommendationType,
  PerformanceMonitoringErrorType,
} from './index.js'
