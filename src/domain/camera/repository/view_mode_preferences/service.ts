/**
 * View Mode Preferences Repository - Service Interface
 *
 * ViewMode設定永続化のためのRepository抽象化インターフェース
 * プレイヤー設定、コンテキスト依存設定、人気度分析、使用パターン学習を統合
 */

import { Array, Context, Effect, Option } from 'effect'
import type { ViewMode } from '../../value_object/index'
import type {
  GameContext,
  PlayerId,
  PreferenceAnalyticsData,
  PreferenceQueryOptions,
  PreferenceRecordId,
  TimeRange,
  ViewModePopularity,
  ViewModePreference,
  ViewModePreferenceRecord,
  ViewModePreferencesRepositoryError,
} from './index'

// ========================================
// Repository Interface
// ========================================

/**
 * View Mode Preferences Repository Interface
 *
 * ViewMode設定の永続化・復元・分析を抽象化するインターフェース
 * プレイヤー設定、コンテキスト依存設定、使用パターン分析、人気度統計を提供
 */
export interface ViewModePreferencesRepository {
  // ========================================
  // Player Preference Management
  // ========================================

  /**
   * プレイヤーのViewMode設定を保存
   */
  readonly savePlayerPreference: (
    playerId: PlayerId,
    preference: ViewModePreference
  ) => Effect.Effect<void, ViewModePreferencesRepositoryError>

  /**
   * プレイヤーのViewMode設定を読み込み
   */
  readonly loadPlayerPreference: (
    playerId: PlayerId
  ) => Effect.Effect<ViewModePreference, ViewModePreferencesRepositoryError>

  /**
   * プレイヤーのViewMode設定を削除
   */
  readonly deletePlayerPreference: (playerId: PlayerId) => Effect.Effect<void, ViewModePreferencesRepositoryError>

  /**
   * プレイヤー設定の存在確認
   */
  readonly playerPreferenceExists: (playerId: PlayerId) => Effect.Effect<boolean, ViewModePreferencesRepositoryError>

  // ========================================
  // Contextual Preference Management
  // ========================================

  /**
   * コンテキスト依存のViewMode設定を保存
   */
  readonly saveContextualPreference: (
    playerId: PlayerId,
    context: GameContext,
    preference: ViewModePreference
  ) => Effect.Effect<void, ViewModePreferencesRepositoryError>

  /**
   * コンテキスト依存のViewMode設定を読み込み
   */
  readonly loadContextualPreference: (
    playerId: PlayerId,
    context: GameContext
  ) => Effect.Effect<Option<ViewModePreference>, ViewModePreferencesRepositoryError>

  /**
   * 特定コンテキストのデフォルトViewModeを取得
   */
  readonly getContextDefaultViewMode: (
    playerId: PlayerId,
    context: GameContext
  ) => Effect.Effect<ViewMode, ViewModePreferencesRepositoryError>

  /**
   * プレイヤーの全コンテキスト設定を取得
   */
  readonly getAllContextualPreferences: (
    playerId: PlayerId
  ) => Effect.Effect<ReadonlyMap<GameContext, ViewModePreference>, ViewModePreferencesRepositoryError>

  // ========================================
  // Usage History and Analytics
  // ========================================

  /**
   * ViewMode使用履歴を記録
   */
  readonly recordPreferenceUsage: (
    record: ViewModePreferenceRecord
  ) => Effect.Effect<void, ViewModePreferencesRepositoryError>

  /**
   * プレイヤーの設定履歴を取得
   */
  readonly getPreferenceHistory: (
    playerId: PlayerId,
    options?: PreferenceQueryOptions
  ) => Effect.Effect<Array.ReadonlyArray<ViewModePreferenceRecord>, ViewModePreferencesRepositoryError>

  /**
   * プレイヤーの分析データを取得
   */
  readonly getPlayerAnalytics: (
    playerId: PlayerId,
    timeRange?: TimeRange
  ) => Effect.Effect<PreferenceAnalyticsData, ViewModePreferencesRepositoryError>

  /**
   * 使用パターンに基づくViewMode推奨を取得
   */
  readonly getRecommendedViewMode: (
    playerId: PlayerId,
    context: GameContext,
    currentTime: number
  ) => Effect.Effect<ViewModeRecommendation, ViewModePreferencesRepositoryError>

  // ========================================
  // Popularity and Statistics
  // ========================================

  /**
   * 人気のViewMode設定を取得
   */
  readonly getPopularPreferences: (
    context: Option<GameContext>,
    limit?: number
  ) => Effect.Effect<Array.ReadonlyArray<ViewModePopularity>, ViewModePreferencesRepositoryError>

  /**
   * 全体のViewMode統計を取得
   */
  readonly getGlobalPreferenceStatistics: (
    timeRange?: TimeRange
  ) => Effect.Effect<GlobalPreferenceStatistics, ViewModePreferencesRepositoryError>

  /**
   * ViewModeトレンド分析を取得
   */
  readonly getViewModeTrends: (
    timeRange: TimeRange,
    context?: GameContext
  ) => Effect.Effect<Array.ReadonlyArray<ViewModeTrend>, ViewModePreferencesRepositoryError>

  /**
   * コンテキスト別ViewMode分布を取得
   */
  readonly getContextViewModeDistribution: (
    context: GameContext,
    timeRange?: TimeRange
  ) => Effect.Effect<ViewModeDistribution, ViewModePreferencesRepositoryError>

  // ========================================
  // Smart Features and Learning
  // ========================================

  /**
   * スマート切り替え設定を更新
   */
  readonly updateSmartSwitchSettings: (
    playerId: PlayerId,
    settings: SmartSwitchSettings
  ) => Effect.Effect<void, ViewModePreferencesRepositoryError>

  /**
   * プレイヤーの使用パターンを学習
   */
  readonly learnPlayerPatterns: (
    playerId: PlayerId,
    timeRange: TimeRange
  ) => Effect.Effect<LearnedPatterns, ViewModePreferencesRepositoryError>

  /**
   * 満足度フィードバックを記録
   */
  readonly recordSatisfactionFeedback: (
    recordId: PreferenceRecordId,
    score: number,
    feedback?: string
  ) => Effect.Effect<void, ViewModePreferencesRepositoryError>

  /**
   * 適応的設定の調整
   */
  readonly adjustAdaptiveSettings: (
    playerId: PlayerId,
    adjustments: AdaptiveAdjustments
  ) => Effect.Effect<void, ViewModePreferencesRepositoryError>

  // ========================================
  // Bulk Operations
  // ========================================

  /**
   * 複数プレイヤー設定の一括保存
   */
  readonly savePlayerPreferencesBatch: (
    preferences: Array.ReadonlyArray<[PlayerId, ViewModePreference]>
  ) => Effect.Effect<void, ViewModePreferencesRepositoryError>

  /**
   * 複数使用記録の一括保存
   */
  readonly recordUsageBatch: (
    records: Array.ReadonlyArray<ViewModePreferenceRecord>
  ) => Effect.Effect<void, ViewModePreferencesRepositoryError>

  /**
   * 古い履歴データのクリーンアップ
   */
  readonly cleanupOldRecords: (
    olderThan: Date,
    keepRecentCount?: number
  ) => Effect.Effect<number, ViewModePreferencesRepositoryError>

  // ========================================
  // Import/Export Operations
  // ========================================

  /**
   * プレイヤー設定をエクスポート
   */
  readonly exportPlayerPreferences: (
    playerId: PlayerId,
    includeHistory: boolean
  ) => Effect.Effect<string, ViewModePreferencesRepositoryError>

  /**
   * プレイヤー設定をインポート
   */
  readonly importPlayerPreferences: (
    playerId: PlayerId,
    jsonData: string,
    options?: ImportOptions
  ) => Effect.Effect<ImportResult, ViewModePreferencesRepositoryError>

  /**
   * 設定の検証
   */
  readonly validatePreferences: (
    jsonData: string
  ) => Effect.Effect<ValidationResult, ViewModePreferencesRepositoryError>

  // ========================================
  // Maintenance and Analytics
  // ========================================

  /**
   * データ整合性チェック
   */
  readonly validateDataIntegrity: () => Effect.Effect<IntegrityCheckResult, ViewModePreferencesRepositoryError>

  /**
   * 統計情報の再計算
   */
  readonly recalculateStatistics: () => Effect.Effect<StatisticsRecalculationResult, ViewModePreferencesRepositoryError>

  /**
   * 使用パターンのリアナライズ
   */
  readonly reanalyzeUsagePatterns: (
    playerId?: PlayerId
  ) => Effect.Effect<ReanalysisResult, ViewModePreferencesRepositoryError>
}

// ========================================
// Supporting Types
// ========================================

/**
 * View Mode Recommendation - ViewMode推奨情報
 */
export interface ViewModeRecommendation {
  readonly recommendedMode: ViewMode
  readonly confidence: number // 0-1
  readonly reason: RecommendationReason
  readonly alternatives: Array.ReadonlyArray<{
    readonly mode: ViewMode
    readonly confidence: number
    readonly reason: string
  }>
}

/**
 * Recommendation Reason - 推奨理由
 */
export type RecommendationReason =
  | 'historical-preference'
  | 'context-pattern'
  | 'similar-users'
  | 'time-based-pattern'
  | 'performance-optimization'
  | 'default-fallback'

/**
 * Global Preference Statistics - 全体設定統計
 */
export interface GlobalPreferenceStatistics {
  readonly totalUsers: number
  readonly activeUsers: number
  readonly mostPopularMode: ViewMode
  readonly contextDistribution: ReadonlyMap<GameContext, number>
  readonly averageSwitchFrequency: number
  readonly satisfactionScore: number
  readonly adaptationRate: number
}

/**
 * View Mode Trend - ViewModeトレンド
 */
export interface ViewModeTrend {
  readonly viewMode: ViewMode
  readonly context: Option<GameContext>
  readonly timePoint: number
  readonly usageCount: number
  readonly changePercentage: number
  readonly trendStrength: number // -1 to 1
}

/**
 * View Mode Distribution - ViewMode分布
 */
export interface ViewModeDistribution {
  readonly context: GameContext
  readonly totalUsage: number
  readonly modeDistribution: ReadonlyMap<ViewMode, number>
  readonly userDistribution: ReadonlyMap<ViewMode, number>
  readonly averageDuration: ReadonlyMap<ViewMode, number>
}

/**
 * Smart Switch Settings - スマート切り替え設定
 */
export interface SmartSwitchSettings {
  readonly enabled: boolean
  readonly sensitivity: number // 0-1
  readonly learningRate: number // 0-1
  readonly contextWeights: ReadonlyMap<GameContext, number>
  readonly timeBasedAdjustment: boolean
  readonly performanceConsideration: boolean
}

/**
 * Learned Patterns - 学習パターン
 */
export interface LearnedPatterns {
  readonly playerId: PlayerId
  readonly contextPreferences: ReadonlyMap<GameContext, ViewMode>
  readonly timeBasedPatterns: Array.ReadonlyArray<TimeBasedPattern>
  readonly sequencePatterns: Array.ReadonlyArray<SequencePattern>
  readonly confidenceScore: number
  readonly lastLearned: number
}

/**
 * Time Based Pattern - 時間ベースパターン
 */
export interface TimeBasedPattern {
  readonly timeOfDay: number // 0-23
  readonly dayOfWeek: number // 0-6
  readonly preferredMode: ViewMode
  readonly confidence: number
}

/**
 * Sequence Pattern - シーケンスパターン
 */
export interface SequencePattern {
  readonly contextSequence: Array.ReadonlyArray<GameContext>
  readonly expectedNextMode: ViewMode
  readonly frequency: number
  readonly accuracy: number
}

/**
 * Adaptive Adjustments - 適応的調整
 */
export interface AdaptiveAdjustments {
  readonly contextSensitivity: Option<number>
  readonly autoSwitchThreshold: Option<number>
  readonly learningWeights: Option<ReadonlyMap<string, number>>
  readonly personalizedFactors: Option<ReadonlyMap<string, number>>
}

/**
 * Import Options - インポートオプション
 */
export interface ImportOptions {
  readonly overwriteExisting: boolean
  readonly validateIntegrity: boolean
  readonly preserveHistory: boolean
  readonly mergeStrategy: 'replace' | 'merge' | 'append'
}

/**
 * Import Result - インポート結果
 */
export interface ImportResult {
  readonly success: boolean
  readonly importedPreferences: number
  readonly importedRecords: number
  readonly skippedItems: number
  readonly errors: Array.ReadonlyArray<string>
  readonly warnings: Array.ReadonlyArray<string>
}

/**
 * Validation Result - 検証結果
 */
export interface ValidationResult {
  readonly isValid: boolean
  readonly preferencesValid: boolean
  readonly recordsValid: boolean
  readonly errors: Array.ReadonlyArray<string>
  readonly warnings: Array.ReadonlyArray<string>
  readonly suggestions: Array.ReadonlyArray<string>
}

/**
 * Integrity Check Result - 整合性チェック結果
 */
export interface IntegrityCheckResult {
  readonly isHealthy: boolean
  readonly checkedPlayers: number
  readonly corruptedPreferences: Array.ReadonlyArray<PlayerId>
  readonly orphanedRecords: Array.ReadonlyArray<PreferenceRecordId>
  readonly inconsistentData: Array.ReadonlyArray<string>
  readonly fixedIssues: number
}

/**
 * Statistics Recalculation Result - 統計再計算結果
 */
export interface StatisticsRecalculationResult {
  readonly recalculatedStatistics: number
  readonly updatedTrends: number
  readonly processedRecords: number
  readonly processingTimeMs: number
  readonly cacheUpdated: boolean
}

/**
 * Reanalysis Result - 再分析結果
 */
export interface ReanalysisResult {
  readonly analyzedPlayers: number
  readonly updatedPatterns: number
  readonly newInsights: Array.ReadonlyArray<string>
  readonly improvedAccuracy: number
  readonly processingTimeMs: number
}

// ========================================
// Context Tag Definition
// ========================================

/**
 * View Mode Preferences Repository Context Tag
 */
export const ViewModePreferencesRepository = Context.GenericTag<ViewModePreferencesRepository>(
  '@minecraft/domain/camera/ViewModePreferencesRepository'
)

// ========================================
// Repository Access Helpers
// ========================================

/**
 * Repository操作のヘルパー関数群
 */
export const ViewModePreferencesRepositoryOps = {
  /**
   * プレイヤー設定の安全な保存
   */
  safeSavePlayerPreference: (playerId: PlayerId, preference: ViewModePreference) =>
    Effect.gen(function* () {
      const repository = yield* ViewModePreferencesRepository
      yield* repository.savePlayerPreference(playerId, preference)
    }),

  /**
   * プレイヤー設定の安全な読み込み
   */
  safeLoadPlayerPreference: (playerId: PlayerId) =>
    Effect.gen(function* () {
      const repository = yield* ViewModePreferencesRepository
      return yield* repository.loadPlayerPreference(playerId)
    }),

  /**
   * コンテキスト依存設定の安全な取得
   */
  safeGetContextualPreference: (playerId: PlayerId, context: GameContext) =>
    Effect.gen(function* () {
      const repository = yield* ViewModePreferencesRepository
      return yield* repository.loadContextualPreference(playerId, context)
    }),

  /**
   * 使用履歴の安全な記録
   */
  safeRecordUsage: (record: ViewModePreferenceRecord) =>
    Effect.gen(function* () {
      const repository = yield* ViewModePreferencesRepository
      yield* repository.recordPreferenceUsage(record)
    }),

  /**
   * 人気設定の安全な取得
   */
  safeGetPopularPreferences: (context?: GameContext, limit?: number) =>
    Effect.gen(function* () {
      const repository = yield* ViewModePreferencesRepository
      return yield* repository.getPopularPreferences(context ? Option.some(context) : Option.none(), limit)
    }),

  /**
   * 推奨ViewModeの安全な取得
   */
  safeGetRecommendation: (playerId: PlayerId, context: GameContext) =>
    Effect.gen(function* () {
      const repository = yield* ViewModePreferencesRepository
      return yield* repository.getRecommendedViewMode(playerId, context, Date.now())
    }),
} as const

// ========================================
// Export Types for Consumer Modules
// ========================================

export type {
  GameContext,
  PlayerId,
  PreferenceAnalyticsData,
  PreferenceQueryOptions,
  PreferenceRecordId,
  TimeRange,
  ViewModePopularity,
  ViewModePreference,
  ViewModePreferenceRecord,
  ViewModePreferencesRepositoryError,
} from './index'
