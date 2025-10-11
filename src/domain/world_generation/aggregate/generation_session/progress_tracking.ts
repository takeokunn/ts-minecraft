/**
 * @fileoverview Progress Tracking - 進捗追跡システム
 *
 * 生成セッションの進捗を詳細に追跡・レポートします。
 * - リアルタイム進捗計算
 * - パフォーマンス測定
 * - ETA (完了予想時刻) 計算
 * - 統計データ収集
 */

import type * as GenerationErrors from '@domain/world/types/errors'
import { DateTime, Effect, Schema } from 'effect'

// ================================
// Progress Statistics
// ================================

export const ProgressStatisticsSchema = Schema.Struct({
  totalChunks: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  completedChunks: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  failedChunks: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  remainingChunks: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  completionPercentage: Schema.Number.pipe(Schema.between(0, 100)),
  successRate: Schema.Number.pipe(Schema.between(0, 1)),
})

export type ProgressStatistics = typeof ProgressStatisticsSchema.Type

// ================================
// Performance Metrics
// ================================

export const PerformanceMetricsSchema = Schema.Struct({
  averageChunkTime: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)), // ミリ秒
  chunksPerSecond: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  totalElapsedTime: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)), // ミリ秒
  estimatedTimeRemaining: Schema.optional(Schema.Number), // ミリ秒
  estimatedCompletionTime: Schema.optional(Schema.DateTimeUtc),
  peakConcurrency: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  averageConcurrency: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
})

export type PerformanceMetrics = typeof PerformanceMetricsSchema.Type

// ================================
// Time Tracking
// ================================

export const TimeTrackingSchema = Schema.Struct({
  startTime: Schema.optional(Schema.DateTimeUtc),
  endTime: Schema.optional(Schema.DateTimeUtc),
  pausedTime: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)), // ミリ秒
  activeTime: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)), // ミリ秒
  lastUpdateTime: Schema.DateTimeUtc,
  milestones: Schema.Array(
    Schema.Struct({
      percentage: Schema.Number.pipe(Schema.between(0, 100)),
      timestamp: Schema.DateTimeUtc,
      chunksCompleted: Schema.Number.pipe(Schema.int()),
    })
  ),
})

export type TimeTracking = typeof TimeTrackingSchema.Type

// ================================
// Progress Data
// ================================

export const ProgressDataSchema = Schema.Struct({
  statistics: ProgressStatisticsSchema,
  performance: PerformanceMetricsSchema,
  timeTracking: TimeTrackingSchema,
  isTrackingActive: Schema.Boolean,
  trackingHistory: Schema.Array(
    Schema.Struct({
      timestamp: Schema.DateTimeUtc,
      statistics: ProgressStatisticsSchema,
      performance: PerformanceMetricsSchema,
    })
  ),
})

export type ProgressData = typeof ProgressDataSchema.Type

// ================================
// Progress Operations
// ================================

/**
 * 初期進捗データ作成
 */
export const createInitial = (totalChunks: number): ProgressData => {
  const now = DateTime.toDate(DateTime.unsafeNow())

  return {
    statistics: {
      totalChunks,
      completedChunks: 0,
      failedChunks: 0,
      remainingChunks: totalChunks,
      completionPercentage: 0,
      successRate: 1.0,
    },
    performance: {
      averageChunkTime: 0,
      chunksPerSecond: 0,
      totalElapsedTime: 0,
      peakConcurrency: 0,
      averageConcurrency: 0,
    },
    timeTracking: {
      pausedTime: 0,
      activeTime: 0,
      lastUpdateTime: now,
      milestones: [],
    },
    isTrackingActive: false,
    trackingHistory: [],
  }
}

/**
 * 追跡開始
 */
export const startTracking = (data: ProgressData): ProgressData => {
  const now = DateTime.toDate(DateTime.unsafeNow())

  return {
    ...data,
    timeTracking: {
      ...data.timeTracking,
      startTime: now,
      lastUpdateTime: now,
    },
    isTrackingActive: true,
  }
}

/**
 * 進捗更新
 */
export const updateProgress = (
  data: ProgressData,
  completedDelta: number,
  failedDelta: number
): Effect.Effect<ProgressData, GenerationErrors.StateError> =>
  Effect.gen(function* () {
    const now = yield* DateTime.nowAsDate

    // 統計更新
    const newCompleted = data.statistics.completedChunks + completedDelta
    const newFailed = data.statistics.failedChunks + failedDelta
    const newRemaining = data.statistics.totalChunks - newCompleted - newFailed
    const newCompletionPercentage =
      data.statistics.totalChunks > 0 ? (newCompleted / data.statistics.totalChunks) * 100 : 0
    const totalProcessed = newCompleted + newFailed
    const newSuccessRate = totalProcessed > 0 ? newCompleted / totalProcessed : 1.0

    const updatedStatistics: ProgressStatistics = {
      ...data.statistics,
      completedChunks: newCompleted,
      failedChunks: newFailed,
      remainingChunks: newRemaining,
      completionPercentage: newCompletionPercentage,
      successRate: newSuccessRate,
    }

    // パフォーマンス計算
    const elapsedTime = data.timeTracking.startTime
      ? now.getTime() - data.timeTracking.startTime.getTime() - data.timeTracking.pausedTime
      : 0

    const updatedPerformance = yield* calculatePerformanceMetrics(data.performance, updatedStatistics, elapsedTime, now)

    // マイルストーン記録（for文 → ReadonlyArray.filterMap）
    const milestoneThresholds = [10, 25, 50, 75, 90, 95]
    const newMilestones = pipe(
      milestoneThresholds,
      ReadonlyArray.filterMap((threshold) => {
        const alreadyRecorded = data.timeTracking.milestones.some((m) => m.percentage === threshold)
        if (!alreadyRecorded && newCompletionPercentage >= threshold) {
          return Option.some({
            percentage: threshold,
            timestamp: now,
            chunksCompleted: newCompleted,
          })
        }
        return Option.none()
      })
    )

    const milestones = [...data.timeTracking.milestones, ...newMilestones]

    const updatedTimeTracking: TimeTracking = {
      ...data.timeTracking,
      activeTime: elapsedTime,
      lastUpdateTime: now,
      milestones,
    }

    // 履歴に追加 (間引きして保存)
    const shouldRecordHistory = shouldAddToHistory(data.trackingHistory, now)
    const updatedHistory = shouldRecordHistory
      ? [
          ...data.trackingHistory.slice(-100), // 最新100エントリを保持
          {
            timestamp: now,
            statistics: updatedStatistics,
            performance: updatedPerformance,
          },
        ]
      : data.trackingHistory

    return {
      ...data,
      statistics: updatedStatistics,
      performance: updatedPerformance,
      timeTracking: updatedTimeTracking,
      trackingHistory: updatedHistory,
    }
  })

/**
 * 追跡一時停止
 */
export const pauseTracking = (data: ProgressData): ProgressData => {
  const now = DateTime.toDate(DateTime.unsafeNow())

  return {
    ...data,
    timeTracking: {
      ...data.timeTracking,
      lastUpdateTime: now,
    },
    isTrackingActive: false,
  }
}

/**
 * 追跡再開
 */
export const resumeTracking = (data: ProgressData): ProgressData => {
  const now = DateTime.toDate(DateTime.unsafeNow())

  // 一時停止期間を計算
  const pauseDuration = data.timeTracking.lastUpdateTime
    ? now.getTime() - data.timeTracking.lastUpdateTime.getTime()
    : 0

  return {
    ...data,
    timeTracking: {
      ...data.timeTracking,
      pausedTime: data.timeTracking.pausedTime + pauseDuration,
      lastUpdateTime: now,
    },
    isTrackingActive: true,
  }
}

/**
 * 追跡完了
 */
export const completeTracking = (data: ProgressData): ProgressData => {
  const now = DateTime.toDate(DateTime.unsafeNow())

  return {
    ...data,
    timeTracking: {
      ...data.timeTracking,
      endTime: now,
      lastUpdateTime: now,
    },
    isTrackingActive: false,
  }
}

/**
 * 完了チェック
 */
export const isCompleted = (data: ProgressData): boolean => {
  return data.statistics.remainingChunks === 0
}

/**
 * 進捗レポート生成
 */
export const generateProgressReport = (
  data: ProgressData
): Effect.Effect<
  {
    summary: string
    statistics: ProgressStatistics
    performance: PerformanceMetrics
    eta: string | null
    recommendations: string[]
  },
  never
> =>
  Effect.gen(function* () {
    const { statistics, performance } = data

    // サマリー生成
    const summary = `${statistics.completedChunks}/${statistics.totalChunks} chunks completed (${statistics.completionPercentage.toFixed(1)}%)`

    // ETA計算
    const eta = performance.estimatedCompletionTime ? performance.estimatedCompletionTime.toISOString() : null

    // 推奨事項
    const recommendations: string[] = []

    if (statistics.successRate < 0.9) {
      recommendations.push('Success rate is low - consider checking error logs')
    }

    if (performance.chunksPerSecond < 1.0 && statistics.totalChunks > 100) {
      recommendations.push('Generation speed is slow - consider optimizing parameters')
    }

    if (performance.averageConcurrency < 2.0) {
      recommendations.push('Low concurrency detected - consider increasing parallel processing')
    }

    return {
      summary,
      statistics,
      performance,
      eta,
      recommendations,
    }
  })

// ================================
// Helper Functions
// ================================

/**
 * パフォーマンスメトリクス計算
 */
const calculatePerformanceMetrics = (
  currentMetrics: PerformanceMetrics,
  statistics: ProgressStatistics,
  elapsedTime: number,
  now: Date
): Effect.Effect<PerformanceMetrics, never> =>
  Effect.gen(function* () {
    // 基本計算
    const chunksPerSecond = elapsedTime > 0 ? (statistics.completedChunks / elapsedTime) * 1000 : 0

    const averageChunkTime = statistics.completedChunks > 0 ? elapsedTime / statistics.completedChunks : 0

    // ETA計算
    let estimatedTimeRemaining: number | undefined
    let estimatedCompletionTime: Date | undefined

    if (chunksPerSecond > 0 && statistics.remainingChunks > 0) {
      estimatedTimeRemaining = (statistics.remainingChunks / chunksPerSecond) * 1000
      estimatedCompletionTime = DateTime.toDate(DateTime.unsafeMake(now.getTime() + estimatedTimeRemaining))
    }

    return {
      averageChunkTime,
      chunksPerSecond,
      totalElapsedTime: elapsedTime,
      estimatedTimeRemaining,
      estimatedCompletionTime,
      peakConcurrency: Math.max(currentMetrics.peakConcurrency, 1), // 現在値は別途更新
      averageConcurrency: currentMetrics.averageConcurrency, // 別途計算が必要
    }
  })

/**
 * 履歴記録判定
 */
const shouldAddToHistory = (history: ProgressData['trackingHistory'], now: Date): boolean => {
  if (history.length === 0) return true

  const lastEntry = history[history.length - 1]
  const timeSinceLastEntry = now.getTime() - lastEntry.timestamp.getTime()

  // 30秒ごと、または大きな変化がある場合に記録
  return timeSinceLastEntry >= 30000
}

// ================================
// Query Functions
// ================================

/**
 * 進捗速度取得
 */
export const getProgressVelocity = (
  data: ProgressData
): {
  recentChunksPerSecond: number
  trendDirection: 'up' | 'down' | 'stable'
  confidence: number
} => {
  if (data.trackingHistory.length < 2) {
    return {
      recentChunksPerSecond: data.performance.chunksPerSecond,
      trendDirection: 'stable',
      confidence: 0,
    }
  }

  // 最近の5エントリで速度計算
  const recentEntries = data.trackingHistory.slice(-5)
  const speeds = recentEntries.map((entry) => entry.performance.chunksPerSecond)

  const recentSpeed = speeds[speeds.length - 1]
  const previousSpeed = speeds[0]

  const trendDirection: 'up' | 'down' | 'stable' =
    recentSpeed > previousSpeed * 1.1 ? 'up' : recentSpeed < previousSpeed * 0.9 ? 'down' : 'stable'

  const confidence = Math.min(recentEntries.length / 5, 1)

  return {
    recentChunksPerSecond: recentSpeed,
    trendDirection,
    confidence,
  }
}

/**
 * マイルストーン達成チェック
 */
export const getAchievedMilestones = (
  data: ProgressData
): readonly {
  percentage: number
  timestamp: Date
  chunksCompleted: number
}[] => {
  return data.timeTracking.milestones
}

// ================================
// Exports
// ================================

export { type PerformanceMetrics, type ProgressStatistics, type TimeTracking }
