/**
 * Animation History Repository - Module Export
 *
 * Cameraアニメーション履歴永続化Repository層の統合エクスポート
 * アニメーション記録・統計・パフォーマンス分析・履歴管理を統合
 */

import { Clock, Data, Effect, Match, Option, Schema } from 'effect'
import type { AnimationQueryOptions, AnimationRecord, TimeRange } from './types'
import { createAnimationRecord } from './types'

// ========================================
// Repository Interface & Context
// ========================================

export type {
  AnimationCountFilter,
  AnimationHistoryRepository,
  AnimationSearchCriteria,
  ExportOptions,
  ImportOptions,
  ImportResult,
  IntegrityCheckResult,
  InterruptionAnalysis,
  OptimizationResult,
  PerformanceThresholds,
  PerformanceTrendPoint,
} from './service'

export { AnimationHistoryRepository, AnimationHistoryRepositoryOps } from './service'

// ========================================
// Repository Types
// ========================================

export type {
  AnimationHistoryRepositoryError,
  AnimationMetadata,
  AnimationPriority,
  AnimationQueryOptions,
  AnimationRecord,
  AnimationRecordId,
  AnimationSortBy,
  AnimationStatistics,
  AnimationType,
  AnimationTypeDistribution,
  InterruptionReason,
  PerformanceMetrics,
  TimeRange,
} from './types'

export {
  AnimationHistoryExportDataSchema,
  AnimationHistoryRepositoryErrorSchema,
  AnimationMetadataSchema,
  AnimationPrioritySchema,
  AnimationQueryOptionsSchema,
  // Schema definitions
  AnimationRecordIdSchema,
  AnimationRecordSchema,
  AnimationTypeSchema,
  // Error factory functions
  createAnimationHistoryError,

  // Animation record factory functions
  createAnimationRecord,
  InterruptionReasonSchema,
  // Type guards
  isAnimationRecordNotFoundError,
  isCameraNotFoundError,
  isCinematicAnimation,
  isConcurrencyError,
  isCriticalPriority,
  isHighPriority,
  isInvalidTimeRangeError,
  isPositionChangeAnimation,
  isQueryLimitExceededError,
  isRotationChangeAnimation,
  isStorageError,
  isViewModeSwitchAnimation,
  TimeRangeSchema,
} from './types'

// ========================================
// Live Implementation
// ========================================

export { AnimationHistoryRepositoryLive } from './live'

// ========================================
// Module Integration Utilities
// ========================================

/**
 * Repository モジュール情報
 */
export const AnimationHistoryRepositoryModule = {
  name: 'AnimationHistoryRepository',
  version: '1.0.0',
  description: 'Cameraアニメーション履歴永続化Repository（記録・分析・統計）',
  provides: ['AnimationHistoryRepository'] as const,
  dependencies: [] as const,
} as const

/**
 * Repository 操作のタイプセーフティユーティリティ
 */
export const AnimationHistoryRepositoryTypeGuards = {
  isAnimationHistoryRepository: (value: unknown): value is AnimationHistoryRepository => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'recordAnimation' in value &&
      'getAnimationHistory' in value &&
      'getLastAnimation' in value &&
      'getAnimationStatistics' in value &&
      'clearHistory' in value
    )
  },

  isAnimationRecord: (value: unknown): value is AnimationRecord => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      'cameraId' in value &&
      'animationType' in value &&
      'startTime' in value &&
      'endTime' in value &&
      'duration' in value
    )
  },

  isTimeRange: (value: unknown): value is TimeRange => Schema.is(TimeRangeSchema)(value),

  isAnimationStatistics: (value: unknown): value is AnimationStatistics => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'totalAnimations' in value &&
      'successfulAnimations' in value &&
      'averageDuration' in value &&
      'performanceMetrics' in value
    )
  },
} as const

// ========================================
// Animation Analysis Utilities
// ========================================

/**
 * アニメーション分析ユーティリティ
 */
export const AnimationAnalysisUtils = {
  /**
   * アニメーション成功率を計算
   */
  calculateSuccessRate: (statistics: AnimationStatistics): number =>
    Match.value(statistics.totalAnimations).pipe(
      Match.when(
        (total) => total === 0,
        () => 0
      ),
      Match.orElse((total) => (statistics.successfulAnimations / total) * 100)
    ),

  /**
   * 中断率を計算
   */
  calculateInterruptionRate: (statistics: AnimationStatistics): number =>
    Match.value(statistics.totalAnimations).pipe(
      Match.when(
        (total) => total === 0,
        () => 0
      ),
      Match.orElse((total) => (statistics.interruptedAnimations / total) * 100)
    ),

  /**
   * パフォーマンススコアを計算
   */
  calculatePerformanceScore: (metrics: PerformanceMetrics): number => {
    const frameRateScore = Math.min(metrics.averageFrameRate / 60, 1) * 40 // 40点満点
    const renderTimeScore = Math.max(0, (20 - metrics.renderTimeP95) / 20) * 30 // 30点満点
    const stutterScore = Math.max(0, 1 - metrics.stutterEvents / 100) * 20 // 20点満点
    const memoryScore = Math.max(0, 1 - metrics.memoryPeakMB / 1024) * 10 // 10点満点

    return Math.round(frameRateScore + renderTimeScore + stutterScore + memoryScore)
  },

  /**
   * 最も問題のあるアニメーション種別を特定
   */
  identifyProblematicAnimationType: (distribution: AnimationTypeDistribution): string => {
    const types = [
      { name: 'Position Changes', count: distribution.positionChanges },
      { name: 'Rotation Changes', count: distribution.rotationChanges },
      { name: 'View Mode Switches', count: distribution.viewModeSwitches },
      { name: 'Cinematics', count: distribution.cinematics },
      { name: 'FOV Changes', count: distribution.fovChanges },
      { name: 'Collision Adjustments', count: distribution.collisionAdjustments },
    ]

    const maxType = types.reduce((max, current) => (current.count > max.count ? current : max))

    return maxType.name
  },

  /**
   * 時間範囲の妥当性をチェック
   */
  validateTimeRange: (timeRange: TimeRange): boolean => {
    return (
      timeRange.startTime > 0 &&
      timeRange.endTime > timeRange.startTime &&
      timeRange.endTime - timeRange.startTime <= 7 * 24 * 60 * 60 * 1000 // 最大7日
    )
  },

  /**
   * アニメーション品質グレードを判定
   */
  getQualityGrade: (performanceScore: number): 'S' | 'A' | 'B' | 'C' | 'D' =>
    Match.value(performanceScore).pipe(
      Match.when(
        (score) => score >= 90,
        () => 'S' as const
      ),
      Match.when(
        (score) => score >= 80,
        () => 'A' as const
      ),
      Match.when(
        (score) => score >= 70,
        () => 'B' as const
      ),
      Match.when(
        (score) => score >= 60,
        () => 'C' as const
      ),
      Match.orElse(() => 'D' as const)
    ),
} as const

// ========================================
// Animation Query Helpers
// ========================================

/**
 * アニメーションクエリヘルパー
 */
export const AnimationQueryHelpers = {
  /**
   * 最新24時間の時間範囲を作成
   */
  createLast24HoursRange: (): Effect.Effect<TimeRange> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const yesterday = now - 24 * 60 * 60 * 1000
      return createAnimationRecord.timeRange(yesterday, now)
    }),

  /**
   * 最新1週間の時間範囲を作成
   */
  createLastWeekRange: (): Effect.Effect<TimeRange> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000
      return createAnimationRecord.timeRange(weekAgo, now)
    }),

  /**
   * 成功したアニメーションのみ取得するクエリオプション
   */
  createSuccessOnlyOptions: (limit: number = 100): AnimationQueryOptions =>
    ({
      ...createAnimationRecord.defaultQueryOptions(),
      filterBySuccess: Option.some(true),
      limit: Option.some(limit),
    }) as AnimationQueryOptions,

  /**
   * 高優先度アニメーションのみ取得するクエリオプション
   */
  createHighPriorityOptions: (limit: number = 50): AnimationQueryOptions =>
    ({
      ...createAnimationRecord.defaultQueryOptions(),
      filterByPriority: Option.some(Data.tagged('High', {})),
      limit: Option.some(limit),
    }) as AnimationQueryOptions,

  /**
   * パフォーマンス問題のアニメーションを検索するクエリオプション
   */
  createPerformanceIssueOptions: (): AnimationQueryOptions =>
    ({
      ...createAnimationRecord.defaultQueryOptions(),
      sortBy: Data.tagged('PerformanceScore', { ascending: true }),
      includeMetadata: true,
      limit: Option.some(20),
    }) as AnimationQueryOptions,
} as const

// ========================================
// Re-export for Convenience
// ========================================

/**
 * Repository層で頻繁に使用される型の便利エクスポート
 */
export type { CameraId } from '@domain/camera/types'
export type { EasingType, ViewMode } from '../../value_object/index'

// ========================================
// Documentation Export
// ========================================

/**
 * Animation History Repository Documentation
 *
 * ## 概要
 * Cameraアニメーション履歴の永続化・復元・分析を抽象化するRepository層の実装
 * アニメーションパフォーマンス分析、統計計算、履歴管理を統合提供
 *
 * ## 設計原則
 * - Effect-TSのContext.GenericTagによる依存性注入
 * - Brand型とSchema検証による型安全性
 * - インメモリ実装によるドメイン層での技術的関心事の分離
 * - パフォーマンス分析とリアルタイム統計の統合
 * - 大量データに対応したキャッシュ機能
 *
 * ## 主要機能カテゴリ
 *
 * ### Basic Animation Record Management
 * - `recordAnimation`: アニメーション記録保存
 * - `getAnimationHistory`: 履歴取得（時間範囲・フィルタ指定）
 * - `getLastAnimation`: 最新アニメーション取得
 * - `getAnimationRecord`: 特定記録取得
 * - `updateAnimationRecord`: 記録更新（中断・完了状態）
 * - `deleteAnimationRecord`: 記録削除
 *
 * ### Bulk Operations
 * - `recordAnimationBatch`: 一括記録保存
 * - `getMultipleCameraHistory`: 複数Camera履歴取得
 * - `clearHistory`: 履歴クリーンアップ
 * - `clearAllHistory`: 全Camera履歴クリーンアップ
 *
 * ### Statistics and Analytics
 * - `getAnimationStatistics`: 統計情報取得
 * - `getGlobalAnimationStatistics`: 全体統計取得
 * - `getPerformanceMetrics`: パフォーマンス指標取得
 * - `getAnimationTypeDistribution`: 種別分布取得
 * - `getMostFrequentAnimationTypes`: 頻出種別取得
 *
 * ### Performance Analysis
 * - `findPerformanceIssues`: パフォーマンス問題検索
 * - `analyzeInterruptions`: 中断分析
 * - `analyzePerformanceTrends`: パフォーマンス傾向分析
 *
 * ### Query and Search Operations
 * - `searchAnimations`: 条件検索
 * - `animationRecordExists`: 存在確認
 * - `countAnimations`: 件数取得
 *
 * ### Data Export and Import
 * - `exportHistory`: 履歴エクスポート（JSON）
 * - `importHistory`: 履歴インポート（JSON）
 *
 * ### Maintenance Operations
 * - `validateDataIntegrity`: データ整合性チェック
 * - `optimizeStorage`: ストレージ最適化
 * - `cleanupOrphanedRecords`: 孤立レコードクリーンアップ
 *
 * ## 使用例
 * ```typescript
 * import { AnimationHistoryRepository, AnimationHistoryRepositoryLive } from './animation_history'
 * import { Effect, Layer } from 'effect'
 *
 * // アニメーション記録
 * const recordAnimation = (cameraId: CameraId, record: AnimationRecord) =>
 *   Effect.gen(function* () {
 *     const repo = yield* AnimationHistoryRepository
 *     yield* repo.recordAnimation(cameraId, record)
 *   })
 *
 * // 統計分析
 * const analyzePerformance = (cameraId: CameraId, timeRange: TimeRange) =>
 *   Effect.gen(function* () {
 *     const repo = yield* AnimationHistoryRepository
 *     const stats = yield* repo.getAnimationStatistics(cameraId, timeRange)
 *     const metrics = yield* repo.getPerformanceMetrics(cameraId, timeRange)
 *     return { stats, metrics }
 *   })
 *
 * // Layer提供
 * const program = Effect.all([
 *   recordAnimation(cameraId, record),
 *   analyzePerformance(cameraId, timeRange)
 * ]).pipe(
 *   Effect.provide(AnimationHistoryRepositoryLive)
 * )
 * ```
 *
 * ## パフォーマンス特徴
 * - インメモリキャッシュによる高速統計計算
 * - 時間範囲クエリの最適化
 * - バッチ操作による効率的な大量データ処理
 * - パフォーマンス指標のリアルタイム計算
 *
 * ## アニメーション分析機能
 * - 成功率・中断率の自動計算
 * - フレームドロップ・スタッター検出
 * - メモリ使用量・レンダリング時間追跡
 * - アニメーション種別別の傾向分析
 */
export const AnimationHistoryRepositoryDocs = {
  overview: 'Cameraアニメーション履歴永続化Repository（記録・分析・統計）',
  version: '1.0.0',
  lastUpdated: '2025-01-XX',
  maintainer: 'Camera Domain Team',
  features: [
    'アニメーション記録・履歴管理',
    'リアルタイムパフォーマンス分析',
    '統計計算・傾向分析',
    '中断原因分析',
    'データエクスポート・インポート',
    'ストレージ最適化',
    'データ整合性チェック',
  ],
  performanceFeatures: ['インメモリキャッシュ', 'バッチ処理対応', '時間範囲クエリ最適化', '統計計算高速化'],
} as const
