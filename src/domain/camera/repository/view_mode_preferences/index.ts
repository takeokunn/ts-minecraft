/**
 * View Mode Preferences Repository - Module Export
 *
 * ViewMode設定永続化Repository層の統合エクスポート
 * プレイヤー設定、学習アルゴリズム、統計分析、推奨システムを統合
 */

// ========================================
// Repository Interface & Context
// ========================================

export type {
  AdaptiveAdjustments,
  GlobalPreferenceStatistics,
  ImportOptions,
  ImportResult,
  IntegrityCheckResult,
  LearnedPatterns,
  ReanalysisResult,
  RecommendationReason,
  SequencePattern,
  SmartSwitchSettings,
  StatisticsRecalculationResult,
  TimeBasedPattern,
  ValidationResult,
  ViewModeDistribution,
  ViewModePreferencesRepository,
  ViewModeRecommendation,
  ViewModeTrend,
} from './service.js'

export { ViewModePreferencesRepository, ViewModePreferencesRepositoryOps } from './service.js'

// ========================================
// Repository Types
// ========================================

export type {
  ContextSensitivityLevel,
  ContextSwitchPattern,
  GameContext,
  KeyBinding,
  PlayerId,
  PreferenceAnalyticsData,
  PreferenceQueryOptions,
  PreferenceRecordId,
  PreferenceSortBy,
  PreferenceTrigger,
  SatisfactionDataPoint,
  TimeRange,
  TrendDirection,
  ViewModePopularity,
  ViewModePreference,
  ViewModePreferenceRecord,
  ViewModePreferencesRepositoryError,
  ViewModeUsageData,
} from './types.js'

export {
  GameContextSchema,
  KeyBindingSchema,
  // Schema definitions
  PlayerIdSchema,
  PreferenceQueryOptionsSchema,
  PreferenceRecordIdSchema,
  PreferenceTriggerSchema,
  TimeRangeSchema,
  TrendDirectionSchema,
  ViewModePopularitySchema,
  ViewModePreferenceRecordSchema,
  ViewModePreferenceSchema,
  ViewModePreferencesRepositoryErrorSchema,
  // Default preferences factory
  createDefaultPreferences,
  // Error factory functions
  createViewModePreferencesError,
  isAnalyticsCalculationFailedError,
  isAutomaticTrigger,
  isBuildingContext,
  isCinematicContext,
  isCombatContext,
  isConcurrencyError,
  isExplorationContext,
  isInvalidPreferenceError,
  isManualTrigger,
  // Type guards
  isPreferenceNotFoundError,
  isRecordNotFoundError,
  isStorageError,
  isSystemTrigger,
} from './types.js'

// ========================================
// Live Implementation
// ========================================

export { ViewModePreferencesRepositoryLive } from './live.js'

// ========================================
// Module Integration Utilities
// ========================================

/**
 * Repository モジュール情報
 */
export const ViewModePreferencesRepositoryModule = {
  name: 'ViewModePreferencesRepository',
  version: '1.0.0',
  description: 'ViewMode設定永続化Repository（学習・推奨・統計分析）',
  provides: ['ViewModePreferencesRepository'] as const,
  dependencies: [] as const,
} as const

/**
 * Repository 操作のタイプセーフティユーティリティ
 */
export const ViewModePreferencesRepositoryTypeGuards = {
  isViewModePreferencesRepository: (value: unknown): value is ViewModePreferencesRepository => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'savePlayerPreference' in value &&
      'loadPlayerPreference' in value &&
      'recordPreferenceUsage' in value &&
      'getRecommendedViewMode' in value &&
      'getPopularPreferences' in value
    )
  },

  isViewModePreference: (value: unknown): value is ViewModePreference => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'defaultMode' in value &&
      'contextualModes' in value &&
      'autoSwitchEnabled' in value &&
      'lastModified' in value
    )
  },

  isViewModePreferenceRecord: (value: unknown): value is ViewModePreferenceRecord => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      'playerId' in value &&
      'viewMode' in value &&
      'context' in value &&
      'timestamp' in value &&
      'duration' in value
    )
  },

  isGameContext: (value: unknown): value is GameContext => {
    return (
      typeof value === 'object' &&
      value !== null &&
      '_tag' in value &&
      [
        'Exploration',
        'Combat',
        'Building',
        'Flying',
        'Spectating',
        'Cinematic',
        'Menu',
        'Inventory',
        'Crafting',
        'Chat',
      ].includes((value as any)._tag)
    )
  },

  isViewModeRecommendation: (value: unknown): value is ViewModeRecommendation => {
    return (
      typeof value === 'object' &&
      value !== null &&
      'recommendedMode' in value &&
      'confidence' in value &&
      'reason' in value &&
      'alternatives' in value
    )
  },
} as const

// ========================================
// Preference Analysis Utilities
// ========================================

/**
 * ViewMode設定分析ユーティリティ
 */
export const PreferenceAnalysisUtils = {
  /**
   * 設定の多様性スコアを計算
   */
  calculateDiversityScore: (preference: ViewModePreference): number => {
    const uniqueModes = new Set([preference.defaultMode, ...Array.from(preference.contextualModes.values())])
    return (uniqueModes.size / 4) * 100 // 4つの主要モードに対する割合
  },

  /**
   * 自動化レベルを計算
   */
  calculateAutomationLevel: (preference: ViewModePreference): number => {
    let score = 0
    if (preference.autoSwitchEnabled) score += 40
    if (preference.smartSwitchEnabled) score += 30
    if (preference.transitionAnimationEnabled) score += 20
    score += preference.contextSensitivity * 10
    return Math.min(100, score)
  },

  /**
   * 推奨の信頼度を評価
   */
  evaluateRecommendationConfidence: (recommendation: ViewModeRecommendation): 'low' | 'medium' | 'high' => {
    if (recommendation.confidence >= 0.8) return 'high'
    if (recommendation.confidence >= 0.6) return 'medium'
    return 'low'
  },

  /**
   * コンテキスト使用パターンを分析
   */
  analyzeContextUsage: (
    records: Array.ReadonlyArray<ViewModePreferenceRecord>
  ): Map<GameContext, { count: number; averageDuration: number; modes: Set<ViewMode> }> => {
    const contextUsage = new Map()

    records.forEach((record) => {
      if (!contextUsage.has(record.context)) {
        contextUsage.set(record.context, {
          count: 0,
          totalDuration: 0,
          modes: new Set(),
        })
      }

      const usage = contextUsage.get(record.context)
      usage.count++
      usage.totalDuration += record.duration
      usage.modes.add(record.viewMode)
    })

    // 平均継続時間を計算
    contextUsage.forEach((usage, context) => {
      usage.averageDuration = usage.totalDuration / usage.count
      delete usage.totalDuration
    })

    return contextUsage
  },

  /**
   * 満足度傾向を分析
   */
  analyzeSatisfactionTrend: (
    records: Array.ReadonlyArray<ViewModePreferenceRecord>
  ): {
    average: number
    trend: 'improving' | 'declining' | 'stable'
    byMode: Map<ViewMode, number>
  } => {
    const satisfactionScores = records
      .map((r) => Option.getOrElse(r.satisfactionScore, () => 3))
      .filter((score) => score > 0)

    if (satisfactionScores.length === 0) {
      return {
        average: 3,
        trend: 'stable',
        byMode: new Map(),
      }
    }

    const average = satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length

    // 傾向分析（簡易実装）
    const recentScores = satisfactionScores.slice(-10)
    const earlierScores = satisfactionScores.slice(0, Math.min(10, satisfactionScores.length - 10))

    let trend: 'improving' | 'declining' | 'stable' = 'stable'
    if (recentScores.length > 0 && earlierScores.length > 0) {
      const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length
      const earlierAvg = earlierScores.reduce((sum, score) => sum + score, 0) / earlierScores.length

      if (recentAvg > earlierAvg + 0.2) trend = 'improving'
      else if (recentAvg < earlierAvg - 0.2) trend = 'declining'
    }

    // モード別満足度
    const byMode = new Map<ViewMode, number>()
    const modeScores = new Map<ViewMode, number[]>()

    records.forEach((record) => {
      if (Option.isSome(record.satisfactionScore)) {
        if (!modeScores.has(record.viewMode)) {
          modeScores.set(record.viewMode, [])
        }
        modeScores.get(record.viewMode)!.push(record.satisfactionScore.value)
      }
    })

    modeScores.forEach((scores, mode) => {
      const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length
      byMode.set(mode, avg)
    })

    return { average, trend, byMode }
  },

  /**
   * 学習効果を測定
   */
  measureLearningEffectiveness: (
    patterns: LearnedPatterns,
    recentRecords: Array.ReadonlyArray<ViewModePreferenceRecord>
  ): number => {
    if (recentRecords.length === 0) return 0

    let correctPredictions = 0
    let totalPredictions = 0

    recentRecords.forEach((record) => {
      const predictedMode = patterns.contextPreferences.get(record.context)
      if (predictedMode) {
        totalPredictions++
        if (predictedMode === record.viewMode) {
          correctPredictions++
        }
      }
    })

    return totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0
  },
} as const

// ========================================
// Preference Recommendation Helpers
// ========================================

/**
 * ViewMode推奨ヘルパー
 */
export const PreferenceRecommendationHelpers = {
  /**
   * コンテキスト別のデフォルト推奨を取得
   */
  getContextDefaultRecommendations: (): Map<GameContext, ViewMode> => {
    return new Map([
      [Data.tagged('Exploration', {}), 'first-person'],
      [Data.tagged('Combat', {}), 'first-person'],
      [Data.tagged('Building', {}), 'third-person'],
      [Data.tagged('Flying', {}), 'third-person'],
      [Data.tagged('Spectating', {}), 'spectator'],
      [Data.tagged('Cinematic', {}), 'cinematic'],
      [Data.tagged('Menu', {}), 'first-person'],
      [Data.tagged('Inventory', {}), 'first-person'],
      [Data.tagged('Crafting', {}), 'third-person'],
      [Data.tagged('Chat', {}), 'first-person'],
    ])
  },

  /**
   * 時間ベースの推奨を生成
   */
  generateTimeBasedRecommendation: (
    currentHour: number,
    timePatterns: Array.ReadonlyArray<TimeBasedPattern>
  ): Option<ViewMode> => {
    const relevantPatterns = timePatterns.filter((pattern) => Math.abs(pattern.timeOfDay - currentHour) <= 1)

    if (relevantPatterns.length === 0) return Option.none()

    const bestPattern = relevantPatterns.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    )

    return bestPattern.confidence > 0.6 ? Option.some(bestPattern.preferredMode) : Option.none()
  },

  /**
   * 類似プレイヤーベースの推奨を生成
   */
  generateSimilarUserRecommendation: (
    targetAnalytics: PreferenceAnalyticsData,
    allAnalytics: Array.ReadonlyArray<PreferenceAnalyticsData>,
    context: GameContext
  ): Option<ViewMode> => {
    // 類似度計算（簡易実装）
    const similarities = allAnalytics
      .filter((analytics) => analytics.playerId !== targetAnalytics.playerId)
      .map((analytics) => {
        // プレイスタイルの類似度を計算
        let similarity = 0
        const sharedModes = analytics.preferredModes.filter((mode) =>
          targetAnalytics.preferredModes.some((targetMode) => targetMode.viewMode === mode.viewMode)
        )

        similarity =
          sharedModes.length / Math.max(analytics.preferredModes.length, targetAnalytics.preferredModes.length)

        return { analytics, similarity }
      })
      .filter((item) => item.similarity > 0.3)
      .sort((a, b) => b.similarity - a.similarity)

    if (similarities.length === 0) return Option.none()

    // 類似プレイヤーのコンテキスト使用パターンから推奨を抽出
    const contextModes = new Map<ViewMode, number>()

    similarities.slice(0, 5).forEach(({ analytics }) => {
      analytics.contextSwitchPatterns.forEach((pattern) => {
        if (pattern.toContext._tag === context._tag) {
          const currentCount = contextModes.get(pattern.preferredViewMode) || 0
          contextModes.set(pattern.preferredViewMode, currentCount + pattern.frequency)
        }
      })
    })

    if (contextModes.size === 0) return Option.none()

    const recommendedMode = Array.from(contextModes.entries()).sort((a, b) => b[1] - a[1])[0][0]

    return Option.some(recommendedMode)
  },

  /**
   * 推奨の説明文を生成
   */
  generateRecommendationExplanation: (recommendation: ViewModeRecommendation): string => {
    const { recommendedMode, confidence, reason } = recommendation

    const confidenceText =
      confidence >= 0.8 ? 'highly confident' : confidence >= 0.6 ? 'confident' : 'somewhat confident'

    const baseText = `We ${confidenceText} recommend ${recommendedMode} mode`

    switch (reason) {
      case 'historical-preference':
        return `${baseText} based on your past usage patterns.`
      case 'context-pattern':
        return `${baseText} as it's commonly used in this context.`
      case 'similar-users':
        return `${baseText} based on preferences of similar players.`
      case 'time-based-pattern':
        return `${baseText} based on your typical usage at this time.`
      case 'performance-optimization':
        return `${baseText} for optimal performance in this scenario.`
      default:
        return `${baseText}.`
    }
  },
} as const

// ========================================
// Query Helpers
// ========================================

/**
 * クエリヘルパー
 */
export const PreferenceQueryHelpers = {
  /**
   * 最新24時間のクエリオプションを作成
   */
  createLast24HoursQuery: (context?: GameContext): PreferenceQueryOptions => {
    const now = Date.now()
    const yesterday = now - 24 * 60 * 60 * 1000

    return {
      ...createDefaultPreferences.defaultQueryOptions(),
      timeRange: Option.some(createDefaultPreferences.timeRange(yesterday, now)),
      filterByContext: context ? Option.some(context) : Option.none(),
    } as PreferenceQueryOptions
  },

  /**
   * 最新1週間のクエリオプションを作成
   */
  createLastWeekQuery: (viewMode?: ViewMode): PreferenceQueryOptions => {
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000

    return {
      ...createDefaultPreferences.defaultQueryOptions(),
      timeRange: Option.some(createDefaultPreferences.timeRange(weekAgo, now)),
      filterByViewMode: viewMode ? Option.some(viewMode) : Option.none(),
    } as PreferenceQueryOptions
  },

  /**
   * 満足度データ付きクエリオプションを作成
   */
  createSatisfactionQuery: (limit: number = 50): PreferenceQueryOptions => {
    return {
      ...createDefaultPreferences.defaultQueryOptions(),
      includeSatisfactionData: true,
      sortBy: Data.tagged('Satisfaction', { ascending: false }),
      limit: Option.some(limit),
    } as PreferenceQueryOptions
  },

  /**
   * 頻度分析用クエリオプションを作成
   */
  createFrequencyAnalysisQuery: (context: GameContext): PreferenceQueryOptions => {
    return {
      ...createDefaultPreferences.defaultQueryOptions(),
      filterByContext: Option.some(context),
      sortBy: Data.tagged('Frequency', { ascending: false }),
      includesSatisfactionData: true,
    } as PreferenceQueryOptions
  },
} as const

// ========================================
// Re-export for Convenience
// ========================================

/**
 * Repository層で頻繁に使用される型の便利エクスポート
 */
export type { ViewMode } from '../../value_object/index.js'

// ========================================
// Documentation Export
// ========================================

/**
 * View Mode Preferences Repository Documentation
 *
 * ## 概要
 * ViewMode設定の永続化・復元・分析を抽象化するRepository層の実装
 * プレイヤー設定、学習アルゴリズム、統計分析、推奨システムを統合提供
 *
 * ## 設計原則
 * - Effect-TSのContext.GenericTagによる依存性注入
 * - Brand型とSchema検証による型安全性
 * - インメモリ実装によるドメイン層での技術的関心事の分離
 * - 機械学習アプローチによる個人化推奨システム
 * - リアルタイム統計分析とトレンド予測
 *
 * ## 主要機能カテゴリ
 *
 * ### Player Preference Management
 * - `savePlayerPreference`: プレイヤー設定保存
 * - `loadPlayerPreference`: プレイヤー設定読み込み
 * - `deletePlayerPreference`: プレイヤー設定削除
 * - `playerPreferenceExists`: 設定存在確認
 *
 * ### Contextual Preference Management
 * - `saveContextualPreference`: コンテキスト依存設定保存
 * - `loadContextualPreference`: コンテキスト依存設定読み込み
 * - `getContextDefaultViewMode`: デフォルトViewMode取得
 * - `getAllContextualPreferences`: 全コンテキスト設定取得
 *
 * ### Usage History and Analytics
 * - `recordPreferenceUsage`: 使用履歴記録
 * - `getPreferenceHistory`: 設定履歴取得
 * - `getPlayerAnalytics`: プレイヤー分析データ取得
 * - `getRecommendedViewMode`: ViewMode推奨取得
 *
 * ### Popularity and Statistics
 * - `getPopularPreferences`: 人気設定取得
 * - `getGlobalPreferenceStatistics`: 全体統計取得
 * - `getViewModeTrends`: ViewModeトレンド分析
 * - `getContextViewModeDistribution`: コンテキスト別分布取得
 *
 * ### Smart Features and Learning
 * - `updateSmartSwitchSettings`: スマート切り替え設定更新
 * - `learnPlayerPatterns`: プレイヤーパターン学習
 * - `recordSatisfactionFeedback`: 満足度フィードバック記録
 * - `adjustAdaptiveSettings`: 適応的設定調整
 *
 * ### Bulk Operations
 * - `savePlayerPreferencesBatch`: 一括設定保存
 * - `recordUsageBatch`: 一括使用記録
 * - `cleanupOldRecords`: 古いデータクリーンアップ
 *
 * ### Import/Export Operations
 * - `exportPlayerPreferences`: 設定エクスポート
 * - `importPlayerPreferences`: 設定インポート
 * - `validatePreferences`: 設定検証
 *
 * ### Maintenance and Analytics
 * - `validateDataIntegrity`: データ整合性チェック
 * - `recalculateStatistics`: 統計再計算
 * - `reanalyzeUsagePatterns`: 使用パターン再分析
 *
 * ## 使用例
 * ```typescript
 * import { ViewModePreferencesRepository, ViewModePreferencesRepositoryLive } from './view_mode_preferences'
 * import { Effect, Layer } from 'effect'
 *
 * // プレイヤー設定管理
 * const managePlayerPreference = (playerId: PlayerId) =>
 *   Effect.gen(function* () {
 *     const repo = yield* ViewModePreferencesRepository
 *     const preference = yield* repo.loadPlayerPreference(playerId)
 *
 *     // コンテキスト別推奨取得
 *     const recommendation = yield* repo.getRecommendedViewMode(
 *       playerId,
 *       Data.tagged('Building', {}),
 *       Date.now()
 *     )
 *
 *     return { preference, recommendation }
 *   })
 *
 * // 使用分析
 * const analyzeUsage = (playerId: PlayerId) =>
 *   Effect.gen(function* () {
 *     const repo = yield* ViewModePreferencesRepository
 *     const analytics = yield* repo.getPlayerAnalytics(playerId)
 *     const patterns = yield* repo.learnPlayerPatterns(playerId, last24Hours)
 *
 *     return { analytics, patterns }
 *   })
 *
 * // Layer提供
 * const program = Effect.all([
 *   managePlayerPreference(playerId),
 *   analyzeUsage(playerId)
 * ]).pipe(
 *   Effect.provide(ViewModePreferencesRepositoryLive)
 * )
 * ```
 *
 * ## 学習・推奨システム特徴
 * - 個人使用パターンの自動学習
 * - コンテキスト依存推奨アルゴリズム
 * - 類似プレイヤーベースの協調フィルタリング
 * - 時間ベース使用パターン分析
 * - 満足度フィードバックによる継続的改善
 *
 * ## 統計・分析機能
 * - リアルタイム人気度計算
 * - ViewModeトレンド予測
 * - コンテキスト使用分布分析
 * - プレイヤー行動パターン分析
 * - 満足度傾向分析
 */
export const ViewModePreferencesRepositoryDocs = {
  overview: 'ViewMode設定永続化Repository（学習・推奨・統計分析）',
  version: '1.0.0',
  lastUpdated: '2025-01-XX',
  maintainer: 'Camera Domain Team',
  features: [
    'プレイヤー設定・コンテキスト依存設定管理',
    '個人化推奨システム',
    '機械学習ベース使用パターン分析',
    '人気度・トレンド統計',
    '満足度フィードバックシステム',
    'スマート自動切り替え',
    'データエクスポート・インポート',
    '適応的設定調整',
  ],
  learningFeatures: [
    '個人使用パターン学習',
    'コンテキスト依存推奨',
    '類似プレイヤー分析',
    '時間ベースパターン認識',
    '満足度ベース最適化',
  ],
  analyticsFeatures: [
    'リアルタイム人気度分析',
    'ViewModeトレンド予測',
    'プレイヤー行動分析',
    '満足度傾向分析',
    'パフォーマンス影響分析',
  ],
} as const
