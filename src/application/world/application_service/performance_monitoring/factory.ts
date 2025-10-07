/**
 * Performance Monitoring Service Factory
 *
 * パフォーマンス監視サービスのファクトリー関数
 */

import { Clock, Effect, Ref, Schema } from 'effect'
import { MetricsCollectorService } from './metrics_collector/index'
import {
  BenchmarkResult,
  BottleneckDetectionResult,
  OptimizationRecommendation,
  PerformanceMonitoringService as PerformanceMonitoringServiceTag,
} from './service'

export const makePerformanceMonitoringService = Effect.gen(function* () {
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

      // 早期return → Effect.when
      yield* Effect.when(isActive, () => Effect.logWarning('パフォーマンス監視は既に開始されています'))

      yield* Effect.unless(isActive, () =>
        Effect.gen(function* () {
          yield* Ref.set(isMonitoring, true)
          const startTime = yield* Clock.currentTimeMillis
          yield* Ref.set(monitoringStartTime, startTime)

          // メトリクス収集開始
          yield* metricsCollector.startCollection()

          yield* Effect.logInfo('パフォーマンス監視開始')
        })
      )
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

      // データ駆動型設計：しきい値ルールをデータ構造化
      type BottleneckRule = {
        readonly check: (snapshot: typeof snapshot) => boolean
        readonly component: string
        readonly severity: 'low' | 'medium' | 'high' | 'critical'
        readonly description: (snapshot: typeof snapshot) => string
        readonly impact: number | ((snapshot: typeof snapshot) => number)
        readonly suggestions: ReadonlyArray<string>
      }

      const bottleneckRules: ReadonlyArray<BottleneckRule> = [
        {
          check: (s) => s.cpuUsage > 0.8,
          component: 'CPU',
          severity: 'high' as const,
          description: (s) => `CPU使用率が高すぎます: ${(s.cpuUsage * 100).toFixed(1)}%`,
          impact: (s) => Math.min(s.cpuUsage, 1.0),
          suggestions: ['チャンク生成の並列度を下げる', 'テレインジェネレーションの最適化', '不要な計算の削減'],
        },
        {
          check: (s) => s.memoryUsage > 6 * 1024 * 1024 * 1024,
          component: 'Memory',
          severity: 'medium' as const,
          description: (s) => `メモリ使用量が高いです: ${(s.memoryUsage / (1024 * 1024 * 1024)).toFixed(1)}GB`,
          impact: 0.6,
          suggestions: ['チャンクキャッシュサイズの調整', 'ガベージコレクションの実行', 'メモリプールの最適化'],
        },
        {
          check: (s) => s.cacheHitRate < 0.7,
          component: 'Cache',
          severity: 'medium' as const,
          description: (s) => `キャッシュヒット率が低いです: ${(s.cacheHitRate * 100).toFixed(1)}%`,
          impact: (s) => 1.0 - s.cacheHitRate,
          suggestions: ['プリローディング戦略の見直し', 'キャッシュサイズの増加', 'エビクションポリシーの調整'],
        },
        {
          check: (s) => s.diskIOPS > 1000,
          component: 'Disk I/O',
          severity: 'low' as const,
          description: (s) => `ディスクI/O負荷が高いです: ${s.diskIOPS} IOPS`,
          impact: 0.3,
          suggestions: ['SSDへの移行検討', 'I/Oバッファリングの最適化', '非同期書き込みの活用'],
        },
      ] as const

      // ルールベース検出：filter + map
      const bottlenecks = bottleneckRules
        .filter((rule) => rule.check(snapshot))
        .map((rule) => ({
          component: rule.component,
          severity: rule.severity,
          description: rule.description(snapshot),
          impact: typeof rule.impact === 'function' ? rule.impact(snapshot) : rule.impact,
          suggestions: [...rule.suggestions],
        }))

      const overallHealth = 1.0 - bottlenecks.reduce((sum, b) => sum + b.impact, 0) / Math.max(bottlenecks.length, 1)

      const result: Schema.Schema.Type<typeof BottleneckDetectionResult> = {
        _tag: 'BottleneckDetectionResult',
        detectedBottlenecks: bottlenecks,
        overallHealth: Math.max(0, overallHealth),
        timestamp: yield* Clock.currentTimeMillis,
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

      // データ駆動型設計：最適化ルールをデータ構造化
      type OptimizationRule = {
        readonly check: (snapshot: typeof snapshot) => boolean
        readonly recommendation: Schema.Schema.Type<typeof OptimizationRecommendation>
      }

      const optimizationRules: ReadonlyArray<OptimizationRule> = [
        {
          check: (s) => s.memoryUsage > 4 * 1024 * 1024 * 1024,
          recommendation: {
            _tag: 'OptimizationRecommendation',
            category: 'memory',
            priority: 'high',
            title: 'メモリ使用量の最適化',
            description: 'チャンクプールサイズを調整し、未使用チャンクを積極的に解放する',
            expectedImprovement: '20-30%のメモリ使用量削減',
            implementationEffort: 'medium',
            estimatedImpact: 0.7,
          },
        },
        {
          check: (s) => s.cpuUsage > 0.6,
          recommendation: {
            _tag: 'OptimizationRecommendation',
            category: 'cpu',
            priority: 'medium',
            title: 'CPU負荷の分散',
            description: 'ワールド生成タスクをワーカースレッドに分散し、メインスレッドの負荷を軽減',
            expectedImprovement: '15-25%のCPU使用率改善',
            implementationEffort: 'high',
            estimatedImpact: 0.6,
          },
        },
        {
          check: (s) => s.cacheHitRate < 0.8,
          recommendation: {
            _tag: 'OptimizationRecommendation',
            category: 'cache',
            priority: 'medium',
            title: 'キャッシュ戦略の改善',
            description: 'プレイヤーの移動パターンを学習し、予測的なプリローディングを実装',
            expectedImprovement: '10-20%のキャッシュヒット率向上',
            implementationEffort: 'medium',
            estimatedImpact: 0.5,
          },
        },
        {
          check: (s) => s.diskIOPS > 500,
          recommendation: {
            _tag: 'OptimizationRecommendation',
            category: 'io',
            priority: 'low',
            title: 'I/O操作の最適化',
            description: 'バッチ書き込みと非同期I/Oを活用してディスク負荷を軽減',
            expectedImprovement: '30-40%のI/O効率向上',
            implementationEffort: 'low',
            estimatedImpact: 0.4,
          },
        },
      ] as const

      // ルールベース推奨：filter + map
      const recommendations = optimizationRules
        .filter((rule) => rule.check(snapshot))
        .map((rule) => rule.recommendation)

      yield* Effect.logInfo(`最適化提案生成完了: ${recommendations.length}件`)
      return recommendations
    })

  const runBenchmark = (benchmarkName: string, operations: number, concurrency: number = 1) =>
    Effect.gen(function* () {
      yield* Effect.logInfo(`ベンチマーク開始: ${benchmarkName} (${operations}操作, ${concurrency}並行)`)

      const startTime = yield* Clock.currentTimeMillis
      const startMemory = (yield* metricsCollector.getPerformanceSnapshot()).memoryUsage

      // ベンチマーク実行（for文撲滅 → Effect.reduce with immutable accumulator）
      const { latencies, errorCount } = yield* pipe(
        ReadonlyArray.range(0, operations),
        Effect.reduce({ latencies: [] as number[], errorCount: 0 }, (acc, _i) =>
          Effect.gen(function* () {
            const opStart = yield* Clock.currentTimeMillis

            // Effect.catchAllでエラーを捕捉してerrorCountをインクリメント
            const isError = yield* Effect.sleep(`${Math.random() * 10 + 5} millis`).pipe(
              Effect.map(() => false),
              Effect.catchAll(() => Effect.succeed(true))
            )

            const opEnd = yield* Clock.currentTimeMillis

            return {
              latencies: [...acc.latencies, opEnd - opStart],
              errorCount: acc.errorCount + (isError ? 1 : 0),
            }
          })
        )
      )

      const endTime = yield* Clock.currentTimeMillis
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
        timestamp: yield* Clock.currentTimeMillis,
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
      // for-of撲滅 → Effect.forEach
      yield* pipe(
        rules,
        Effect.forEach((rule) =>
          metricsCollector.setAlertThreshold({
            _tag: 'AlertThreshold',
            metricName: rule.metricName,
            operator: rule.operator,
            threshold: rule.threshold,
            severity: rule.severity,
            enabled: true,
          })
        )
      )

      yield* Effect.logInfo(`アラートルール設定完了: ${rules.length}件`)
    })

  const getRealTimeMetrics = () =>
    Effect.gen(function* () {
      const snapshot = yield* metricsCollector.getPerformanceSnapshot()
      const bottlenecks = yield* detectBottlenecks()

      return {
        timestamp: yield* Clock.currentTimeMillis,
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

  return PerformanceMonitoringServiceTag.of({
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
