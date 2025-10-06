/**
 * Animation History Repository - Service Interface
 *
 * Cameraアニメーション履歴永続化のためのRepository抽象化インターフェース
 * アニメーション記録・統計・履歴管理・パフォーマンス分析を統合
 */

import type { CameraId } from '@domain/camera/types'
import { Array, Context, Effect, Option } from 'effect'
import type {
  AnimationHistoryRepositoryError,
  AnimationQueryOptions,
  AnimationRecord,
  AnimationRecordId,
  AnimationStatistics,
  AnimationType,
  AnimationTypeDistribution,
  PerformanceMetrics,
  TimeRange,
} from './index'

// ========================================
// Repository Interface
// ========================================

/**
 * Animation History Repository Interface
 *
 * Cameraアニメーション履歴の永続化・復元・分析を抽象化するインターフェース
 * アニメーションパフォーマンス分析、統計計算、履歴管理を提供
 */
export interface AnimationHistoryRepository {
  // ========================================
  // Basic Animation Record Management
  // ========================================

  /**
   * アニメーション記録を保存
   */
  readonly recordAnimation: (
    cameraId: CameraId,
    animationRecord: AnimationRecord
  ) => Effect.Effect<void, AnimationHistoryRepositoryError>

  /**
   * アニメーション履歴を取得（時間範囲指定）
   */
  readonly getAnimationHistory: (
    cameraId: CameraId,
    timeRange: TimeRange,
    options?: AnimationQueryOptions
  ) => Effect.Effect<Array.ReadonlyArray<AnimationRecord>, AnimationHistoryRepositoryError>

  /**
   * 最新のアニメーション記録を取得
   */
  readonly getLastAnimation: (
    cameraId: CameraId
  ) => Effect.Effect<Option<AnimationRecord>, AnimationHistoryRepositoryError>

  /**
   * 特定のアニメーション記録を取得
   */
  readonly getAnimationRecord: (
    recordId: AnimationRecordId
  ) => Effect.Effect<Option<AnimationRecord>, AnimationHistoryRepositoryError>

  /**
   * アニメーション記録を更新（中断・完了状態の更新）
   */
  readonly updateAnimationRecord: (
    recordId: AnimationRecordId,
    updates: Partial<AnimationRecord>
  ) => Effect.Effect<void, AnimationHistoryRepositoryError>

  /**
   * アニメーション記録を削除
   */
  readonly deleteAnimationRecord: (recordId: AnimationRecordId) => Effect.Effect<void, AnimationHistoryRepositoryError>

  // ========================================
  // Bulk Operations
  // ========================================

  /**
   * 複数アニメーション記録の一括保存
   */
  readonly recordAnimationBatch: (
    records: Array.ReadonlyArray<[CameraId, AnimationRecord]>
  ) => Effect.Effect<void, AnimationHistoryRepositoryError>

  /**
   * 複数Camera の履歴を一括取得
   */
  readonly getMultipleCameraHistory: (
    cameraIds: Array.ReadonlyArray<CameraId>,
    timeRange: TimeRange,
    options?: AnimationQueryOptions
  ) => Effect.Effect<ReadonlyMap<CameraId, Array.ReadonlyArray<AnimationRecord>>, AnimationHistoryRepositoryError>

  /**
   * 履歴クリーンアップ（古いデータの削除）
   */
  readonly clearHistory: (cameraId: CameraId, olderThan: Date) => Effect.Effect<number, AnimationHistoryRepositoryError>

  /**
   * 全Camera の古い履歴を一括クリーンアップ
   */
  readonly clearAllHistory: (olderThan: Date) => Effect.Effect<number, AnimationHistoryRepositoryError>

  // ========================================
  // Statistics and Analytics
  // ========================================

  /**
   * アニメーション統計情報を取得
   */
  readonly getAnimationStatistics: (
    cameraId: CameraId,
    timeRange: TimeRange
  ) => Effect.Effect<AnimationStatistics, AnimationHistoryRepositoryError>

  /**
   * 全体のアニメーション統計を取得
   */
  readonly getGlobalAnimationStatistics: (
    timeRange: TimeRange
  ) => Effect.Effect<AnimationStatistics, AnimationHistoryRepositoryError>

  /**
   * パフォーマンス指標を取得
   */
  readonly getPerformanceMetrics: (
    cameraId: CameraId,
    timeRange: TimeRange
  ) => Effect.Effect<PerformanceMetrics, AnimationHistoryRepositoryError>

  /**
   * アニメーション種別分布を取得
   */
  readonly getAnimationTypeDistribution: (
    cameraId: CameraId,
    timeRange: TimeRange
  ) => Effect.Effect<AnimationTypeDistribution, AnimationHistoryRepositoryError>

  /**
   * 最も頻繁に発生するアニメーション種別を取得
   */
  readonly getMostFrequentAnimationTypes: (
    cameraId: CameraId,
    timeRange: TimeRange,
    limit: number
  ) => Effect.Effect<Array.ReadonlyArray<[AnimationType, number]>, AnimationHistoryRepositoryError>

  // ========================================
  // Performance Analysis
  // ========================================

  /**
   * フレームドロップが発生したアニメーションを検索
   */
  readonly findPerformanceIssues: (
    cameraId: CameraId,
    timeRange: TimeRange,
    thresholds: PerformanceThresholds
  ) => Effect.Effect<Array.ReadonlyArray<AnimationRecord>, AnimationHistoryRepositoryError>

  /**
   * 中断されたアニメーションを分析
   */
  readonly analyzeInterruptions: (
    cameraId: CameraId,
    timeRange: TimeRange
  ) => Effect.Effect<InterruptionAnalysis, AnimationHistoryRepositoryError>

  /**
   * アニメーションのパフォーマンス傾向を分析
   */
  readonly analyzePerformanceTrends: (
    cameraId: CameraId,
    timeRange: TimeRange,
    bucketSize: number // 時間区間サイズ（ミリ秒）
  ) => Effect.Effect<Array.ReadonlyArray<PerformanceTrendPoint>, AnimationHistoryRepositoryError>

  // ========================================
  // Query and Search Operations
  // ========================================

  /**
   * 条件に基づいてアニメーション記録を検索
   */
  readonly searchAnimations: (
    searchCriteria: AnimationSearchCriteria
  ) => Effect.Effect<Array.ReadonlyArray<AnimationRecord>, AnimationHistoryRepositoryError>

  /**
   * アニメーション記録の存在確認
   */
  readonly animationRecordExists: (
    recordId: AnimationRecordId
  ) => Effect.Effect<boolean, AnimationHistoryRepositoryError>

  /**
   * 指定期間内のアニメーション総数を取得
   */
  readonly countAnimations: (
    cameraId: CameraId,
    timeRange: TimeRange,
    filter?: AnimationCountFilter
  ) => Effect.Effect<number, AnimationHistoryRepositoryError>

  // ========================================
  // Data Export and Import
  // ========================================

  /**
   * アニメーション履歴をエクスポート（JSON形式）
   */
  readonly exportHistory: (
    cameraId: CameraId,
    timeRange: TimeRange,
    options?: ExportOptions
  ) => Effect.Effect<string, AnimationHistoryRepositoryError>

  /**
   * アニメーション履歴をインポート（JSON形式）
   */
  readonly importHistory: (
    cameraId: CameraId,
    jsonData: string,
    options?: ImportOptions
  ) => Effect.Effect<ImportResult, AnimationHistoryRepositoryError>

  // ========================================
  // Maintenance Operations
  // ========================================

  /**
   * データ整合性チェック
   */
  readonly validateDataIntegrity: (
    cameraId?: CameraId
  ) => Effect.Effect<IntegrityCheckResult, AnimationHistoryRepositoryError>

  /**
   * 履歴データの最適化
   */
  readonly optimizeStorage: () => Effect.Effect<OptimizationResult, AnimationHistoryRepositoryError>

  /**
   * 孤立したアニメーション記録のクリーンアップ
   */
  readonly cleanupOrphanedRecords: () => Effect.Effect<number, AnimationHistoryRepositoryError>
}

// ========================================
// Supporting Types
// ========================================

/**
 * Performance Thresholds - パフォーマンス閾値
 */
export interface PerformanceThresholds {
  readonly minFrameRate: number
  readonly maxRenderTime: number
  readonly maxMemoryUsage: number
  readonly maxFrameDrops: number
}

/**
 * Interruption Analysis - 中断分析結果
 */
export interface InterruptionAnalysis {
  readonly totalInterruptions: number
  readonly interruptionsByReason: ReadonlyMap<string, number>
  readonly averageProgressWhenInterrupted: number
  readonly mostCommonInterruptionTime: number
  readonly interruptionImpactScore: number // 0-100
}

/**
 * Performance Trend Point - パフォーマンス傾向ポイント
 */
export interface PerformanceTrendPoint {
  readonly timestamp: number
  readonly averageFrameRate: number
  readonly averageRenderTime: number
  readonly memoryUsage: number
  readonly animationCount: number
}

/**
 * Animation Search Criteria - アニメーション検索条件
 */
export interface AnimationSearchCriteria {
  readonly cameraIds: Option<Array.ReadonlyArray<CameraId>>
  readonly animationTypes: Option<Array.ReadonlyArray<AnimationType>>
  readonly timeRange: Option<TimeRange>
  readonly successOnly: Option<boolean>
  readonly minDuration: Option<number>
  readonly maxDuration: Option<number>
  readonly textSearch: Option<string> // 説明文やタグでの検索
}

/**
 * Animation Count Filter - アニメーション数カウントフィルタ
 */
export interface AnimationCountFilter {
  readonly animationType: Option<AnimationType>
  readonly successOnly: Option<boolean>
  readonly excludeInterrupted: Option<boolean>
}

/**
 * Export Options - エクスポートオプション
 */
export interface ExportOptions {
  readonly includeMetadata: boolean
  readonly includePerformanceData: boolean
  readonly compressionLevel: 'none' | 'low' | 'medium' | 'high'
  readonly format: 'json' | 'csv' | 'binary'
}

/**
 * Import Options - インポートオプション
 */
export interface ImportOptions {
  readonly overwriteExisting: boolean
  readonly validateIntegrity: boolean
  readonly performanceMode: boolean
  readonly batchSize: number
}

/**
 * Import Result - インポート結果
 */
export interface ImportResult {
  readonly success: boolean
  readonly importedRecords: number
  readonly skippedRecords: number
  readonly errors: Array.ReadonlyArray<string>
  readonly processingTimeMs: number
}

/**
 * Integrity Check Result - 整合性チェック結果
 */
export interface IntegrityCheckResult {
  readonly isValid: boolean
  readonly checkedRecords: number
  readonly corruptedRecords: Array.ReadonlyArray<AnimationRecordId>
  readonly missingReferences: Array.ReadonlyArray<string>
  readonly fixedIssues: number
  readonly remainingIssues: number
}

/**
 * Optimization Result - 最適化結果
 */
export interface OptimizationResult {
  readonly beforeSizeBytes: number
  readonly afterSizeBytes: number
  readonly compressionRatio: number
  readonly duplicatesRemoved: number
  readonly fragmentationReduced: number
  readonly processingTimeMs: number
}

// ========================================
// Context Tag Definition
// ========================================

/**
 * Animation History Repository Context Tag
 */
export const AnimationHistoryRepository = Context.GenericTag<AnimationHistoryRepository>(
  '@minecraft/domain/camera/AnimationHistoryRepository'
)

// ========================================
// Repository Access Helpers
// ========================================

/**
 * Repository操作のヘルパー関数群
 */
export const AnimationHistoryRepositoryOps = {
  /**
   * アニメーション記録の安全な保存
   */
  safeRecordAnimation: (cameraId: CameraId, record: AnimationRecord) =>
    Effect.gen(function* () {
      const repository = yield* AnimationHistoryRepository
      yield* repository.recordAnimation(cameraId, record)
    }),

  /**
   * 履歴の安全な取得
   */
  safeGetHistory: (cameraId: CameraId, timeRange: TimeRange, options?: AnimationQueryOptions) =>
    Effect.gen(function* () {
      const repository = yield* AnimationHistoryRepository
      return yield* repository.getAnimationHistory(cameraId, timeRange, options)
    }),

  /**
   * 統計情報の安全な取得
   */
  safeGetStatistics: (cameraId: CameraId, timeRange: TimeRange) =>
    Effect.gen(function* () {
      const repository = yield* AnimationHistoryRepository
      return yield* repository.getAnimationStatistics(cameraId, timeRange)
    }),

  /**
   * パフォーマンス分析の安全な実行
   */
  safeAnalyzePerformance: (cameraId: CameraId, timeRange: TimeRange) =>
    Effect.gen(function* () {
      const repository = yield* AnimationHistoryRepository
      return yield* repository.getPerformanceMetrics(cameraId, timeRange)
    }),

  /**
   * クリーンアップの安全な実行
   */
  safeCleanup: (cameraId: CameraId, olderThan: Date) =>
    Effect.gen(function* () {
      const repository = yield* AnimationHistoryRepository
      return yield* repository.clearHistory(cameraId, olderThan)
    }),
} as const

// ========================================
// Export Types for Consumer Modules
// ========================================

export type {
  AnimationHistoryRepositoryError,
  AnimationQueryOptions,
  AnimationRecord,
  AnimationRecordId,
  AnimationStatistics,
  AnimationType,
  AnimationTypeDistribution,
  InterruptionReason,
  PerformanceMetrics,
  TimeRange,
} from './index'
