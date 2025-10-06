/**
 * View Mode Preferences Repository - Module Export
 *
 * ViewMode設定永続化Repository層の統合エクスポート
 * プレイヤー設定、学習アルゴリズム、統計分析、推奨システムを統合
 */

import { Clock, Data, Effect, Match, Option, ReadonlyArray, Schema, pipe } from 'effect'

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
} from './service'

export { ViewModePreferencesRepository, ViewModePreferencesRepositoryOps } from './service'

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
} from './types'

export {
  // Default preferences factory
  createDefaultPreferences,
  // Error factory functions
  createViewModePreferencesError,
  GameContextSchema,
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
} from './types'

// ========================================
// Live Implementation
// ========================================

export { ViewModePreferencesRepositoryLive } from './live'

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
    return typeof value === 'object' && value !== null && '_tag' in value && Schema.is(ViewContextSchema)(value)
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
    return pipe(
      0,
      (score) => score + (preference.autoSwitchEnabled ? 40 : 0),
      (score) => score + (preference.smartSwitchEnabled ? 30 : 0),
      (score) => score + (preference.transitionAnimationEnabled ? 20 : 0),
      (score) => score + preference.contextSensitivity * 10,
      (score) => Math.min(100, score)
    )
  },

  /**
   * 推奨の信頼度を評価
   */
  evaluateRecommendationConfidence: (recommendation: ViewModeRecommendation): 'low' | 'medium' | 'high' => {
    return pipe(
      recommendation.confidence,
      Match.value,
      Match.when(
        (c) => c >= 0.8,
        () => 'high' as const
      ),
      Match.when(
        (c) => c >= 0.6,
        () => 'medium' as const
      ),
      Match.orElse(() => 'low' as const)
    )
  },

  /**
   * コンテキスト使用パターンを分析
   */
  analyzeContextUsage: (
    records: Array.ReadonlyArray<ViewModePreferenceRecord>
  ): Map<GameContext, { count: number; averageDuration: number; modes: Set<ViewMode> }> => {
    const contextUsage = pipe(
      records,
      ReadonlyArray.reduce(
        new Map<GameContext, { count: number; totalDuration: number; modes: Set<ViewMode> }>(),
        (acc, record) => {
          const existing = acc.get(record.context)
          const updated = existing
            ? {
                count: existing.count + 1,
                totalDuration: existing.totalDuration + record.duration,
                modes: new Set([...existing.modes, record.viewMode]),
              }
            : {
                count: 1,
                totalDuration: record.duration,
                modes: new Set([record.viewMode]),
              }
          acc.set(record.context, updated)
          return acc
        }
      )
    )

    // 平均継続時間を計算
    return new Map(
      Array.from(contextUsage.entries()).map(([context, usage]) => [
        context,
        {
          count: usage.count,
          averageDuration: usage.totalDuration / usage.count,
          modes: usage.modes,
        },
      ])
    )
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

    // 早期return → 三項演算子で統合
    return satisfactionScores.length === 0
      ? { average: 3, trend: 'stable' as const, byMode: new Map() }
      : pipe(satisfactionScores, (scores) => {
          const average = scores.reduce((sum, score) => sum + score, 0) / scores.length

          // 傾向分析（簡易実装）
          const recentScores = scores.slice(-10)
          const earlierScores = scores.slice(0, Math.min(10, scores.length - 10))

          const trend: 'improving' | 'declining' | 'stable' =
            recentScores.length > 0 && earlierScores.length > 0
              ? pipe(
                  {
                    recent: recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length,
                    earlier: earlierScores.reduce((sum, score) => sum + score, 0) / earlierScores.length,
                  },
                  ({ recent, earlier }) =>
                    recent > earlier + 0.2
                      ? ('improving' as const)
                      : recent < earlier - 0.2
                        ? ('declining' as const)
                        : ('stable' as const)
                )
              : ('stable' as const)

          // モード別満足度 - ReadonlyArray.reduce + Option.match
          const modeScores = pipe(
            records,
            ReadonlyArray.reduce(new Map<ViewMode, number[]>(), (acc, record) =>
              pipe(
                record.satisfactionScore,
                Option.match({
                  onNone: () => acc,
                  onSome: (score) => {
                    const existing = acc.get(record.viewMode) || []
                    acc.set(record.viewMode, [...existing, score])
                    return acc
                  },
                })
              )
            )
          )

          const byMode = new Map(
            Array.from(modeScores.entries()).map(([mode, scores]) => [
              mode,
              scores.reduce((sum, score) => sum + score, 0) / scores.length,
            ])
          )

          return { average, trend, byMode }
        })
  },

  /**
   * 学習効果を測定
   */
  measureLearningEffectiveness: (
    patterns: LearnedPatterns,
    recentRecords: Array.ReadonlyArray<ViewModePreferenceRecord>
  ): number => {
    return recentRecords.length === 0
      ? 0
      : pipe(
          recentRecords,
          ReadonlyArray.reduce({ correctPredictions: 0, totalPredictions: 0 }, (acc, record) => {
            const predictedMode = patterns.contextPreferences.get(record.context)
            return predictedMode
              ? {
                  correctPredictions: acc.correctPredictions + (predictedMode === record.viewMode ? 1 : 0),
                  totalPredictions: acc.totalPredictions + 1,
                }
              : acc
          }),
          ({ correctPredictions, totalPredictions }) =>
            totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0
        )
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
    return pipe(
      timePatterns.filter((pattern) => Math.abs(pattern.timeOfDay - currentHour) <= 1),
      ReadonlyArray.fromIterable,
      Option.liftPredicate((patterns) => patterns.length > 0),
      Option.map((patterns) => patterns.reduce((best, current) => (current.confidence > best.confidence ? current : best))),
      Option.flatMap((bestPattern) =>
        bestPattern.confidence > 0.6 ? Option.some(bestPattern.preferredMode) : Option.none()
      )
    )
  },

  /**
   * 類似プレイヤーベースの推奨を生成
   */
  generateSimilarUserRecommendation: (
    targetAnalytics: PreferenceAnalyticsData,
    allAnalytics: Array.ReadonlyArray<PreferenceAnalyticsData>,
    context: GameContext
  ): Option<ViewMode> => {
    return pipe(
      allAnalytics
        .filter((analytics) => analytics.playerId !== targetAnalytics.playerId)
        .map((analytics) => {
          const sharedModes = analytics.preferredModes.filter((mode) =>
            targetAnalytics.preferredModes.some((targetMode) => targetMode.viewMode === mode.viewMode)
          )

          const similarity =
            sharedModes.length / Math.max(analytics.preferredModes.length, targetAnalytics.preferredModes.length)

          return { analytics, similarity }
        })
        .filter((item) => item.similarity > 0.3)
        .sort((a, b) => b.similarity - a.similarity),
      ReadonlyArray.fromIterable,
      Option.liftPredicate((similarities) => similarities.length > 0),
      Option.flatMap((similarities) =>
        pipe(
          similarities.slice(0, 5),
          ReadonlyArray.reduce(new Map<ViewMode, number>(), (contextModes, { analytics }) =>
            pipe(
              analytics.contextSwitchPatterns,
              ReadonlyArray.reduce(contextModes, (acc, pattern) =>
                pattern.toContext._tag === context._tag
                  ? (() => {
                      const currentCount = acc.get(pattern.preferredViewMode) || 0
                      acc.set(pattern.preferredViewMode, currentCount + pattern.frequency)
                      return acc
                    })()
                  : acc
              )
            )
          ),
          (contextModes) => Array.from(contextModes.entries()),
          ReadonlyArray.fromIterable,
          Option.liftPredicate((entries) => entries.length > 0),
          Option.map((entries) => entries.sort((a, b) => b[1] - a[1])[0][0])
        )
      )
    )
  },

  /**
   * 推奨の説明文を生成
   */
  generateRecommendationExplanation: (recommendation: ViewModeRecommendation): string => {
    const { recommendedMode, confidence, reason } = recommendation

    const confidenceText =
      confidence >= 0.8 ? 'highly confident' : confidence >= 0.6 ? 'confident' : 'somewhat confident'

    const baseText = `We ${confidenceText} recommend ${recommendedMode} mode`

    return pipe(
      reason,
      Match.value,
      Match.when('historical-preference', () => `${baseText} based on your past usage patterns.`),
      Match.when('context-pattern', () => `${baseText} as it's commonly used in this context.`),
      Match.when('similar-users', () => `${baseText} based on preferences of similar players.`),
      Match.when('time-based-pattern', () => `${baseText} based on your typical usage at this time.`),
      Match.when('performance-optimization', () => `${baseText} for optimal performance in this scenario.`),
      Match.orElse(() => `${baseText}.`)
    )
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
  createLast24HoursQuery: (context?: GameContext): Effect.Effect<PreferenceQueryOptions> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const yesterday = now - 24 * 60 * 60 * 1000

      return {
        ...createDefaultPreferences.defaultQueryOptions(),
        timeRange: Option.some(createDefaultPreferences.timeRange(yesterday, now)),
        filterByContext: context ? Option.some(context) : Option.none(),
      } as PreferenceQueryOptions
    }),

  /**
   * 最新1週間のクエリオプションを作成
   */
  createLastWeekQuery: (viewMode?: ViewMode): Effect.Effect<PreferenceQueryOptions> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
      const weekAgo = now - 7 * 24 * 60 * 60 * 1000

      return {
        ...createDefaultPreferences.defaultQueryOptions(),
        timeRange: Option.some(createDefaultPreferences.timeRange(weekAgo, now)),
        filterByViewMode: viewMode ? Option.some(viewMode) : Option.none(),
      } as PreferenceQueryOptions
    }),

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
export type { ViewMode } from '../../value_object/index'

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
 *     const now = yield* Clock.currentTimeMillis
 *     const recommendation = yield* repo.getRecommendedViewMode(
 *       playerId,
 *       Data.tagged('Building', {}),
 *       now
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
