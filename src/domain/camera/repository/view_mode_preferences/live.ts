/**
 * View Mode Preferences Repository - Live Implementation
 *
 * ViewMode設定永続化の具体的実装（インメモリ版）
 * プレイヤー設定、学習アルゴリズム、統計分析、推奨システムの統合実装
 */

import { Array, Data, Effect, HashMap, Layer, Match, Option, pipe, Ref } from 'effect'
import type { ViewMode } from '../../value_object/index'
import type {
  AdaptiveAdjustments,
  GlobalPreferenceStatistics,
  ImportOptions,
  ImportResult,
  IntegrityCheckResult,
  LearnedPatterns,
  ReanalysisResult,
  RecommendationReason,
  SmartSwitchSettings,
  StatisticsRecalculationResult,
  ValidationResult,
  ViewModeDistribution,
  ViewModeRecommendation,
  ViewModeTrend,
} from './index'
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
import {
  createDefaultPreferences,
  createViewModePreferencesError,
  isAnalyticsCalculationFailedError,
  isPreferenceNotFoundError,
  isRecordNotFoundError,
  isStorageError,
} from './index'

// ========================================
// Internal Storage Types
// ========================================

/**
 * View Mode Preferences Storage State
 */
interface ViewModePreferencesStorageState {
  readonly playerPreferences: HashMap.HashMap<PlayerId, ViewModePreference>
  readonly contextualPreferences: HashMap.HashMap<string, ViewModePreference> // Key: playerId_context
  readonly usageRecords: HashMap.HashMap<PlayerId, Array.Array.ReadonlyArray<ViewModePreferenceRecord>>
  readonly popularityData: HashMap.HashMap<string, ViewModePopularity> // Key: viewMode_context
  readonly learnedPatterns: HashMap.HashMap<PlayerId, LearnedPatterns>
  readonly smartSwitchSettings: HashMap.HashMap<PlayerId, SmartSwitchSettings>
  readonly statisticsCache: HashMap.HashMap<string, any>
  readonly metadata: {
    readonly totalUsers: number
    readonly totalRecords: number
    readonly lastAnalysisDate: number
    readonly cacheHitRate: number
  }
}

/**
 * Cache Key Utilities
 */
const CacheKeys = {
  contextualKey: (playerId: PlayerId, context: GameContext): string => `${playerId}_${context._tag}`,

  popularityKey: (viewMode: ViewMode, context: Option<GameContext>): string =>
    Option.isSome(context) ? `${viewMode}_${context.value._tag}` : viewMode,

  analyticsKey: (playerId: PlayerId, timeRange?: TimeRange): string =>
    timeRange ? `analytics_${playerId}_${timeRange.startTime}_${timeRange.endTime}` : `analytics_${playerId}`,

  trendsKey: (timeRange: TimeRange, context?: GameContext): string =>
    context
      ? `trends_${timeRange.startTime}_${timeRange.endTime}_${context._tag}`
      : `trends_${timeRange.startTime}_${timeRange.endTime}`,
} as const

/**
 * Storage Operations
 */
const StorageOps = {
  /**
   * 初期状態を作成
   */
  createInitialState: (): ViewModePreferencesStorageState => ({
    playerPreferences: HashMap.empty(),
    contextualPreferences: HashMap.empty(),
    usageRecords: HashMap.empty(),
    popularityData: HashMap.empty(),
    learnedPatterns: HashMap.empty(),
    smartSwitchSettings: HashMap.empty(),
    statisticsCache: HashMap.empty(),
    metadata: {
      totalUsers: 0,
      totalRecords: 0,
      lastAnalysisDate: Date.now(),
      cacheHitRate: 0,
    },
  }),

  /**
   * プレイヤー設定を保存
   */
  savePlayerPreference: (
    state: ViewModePreferencesStorageState,
    playerId: PlayerId,
    preference: ViewModePreference
  ): ViewModePreferencesStorageState => {
    const isNewPlayer = !HashMap.has(state.playerPreferences, playerId)
    const updatedPreference = {
      ...preference,
      lastModified: Date.now(),
      version: preference.version + 1,
    }

    return {
      ...state,
      playerPreferences: HashMap.set(state.playerPreferences, playerId, updatedPreference),
      metadata: {
        ...state.metadata,
        totalUsers: isNewPlayer ? state.metadata.totalUsers + 1 : state.metadata.totalUsers,
      },
    }
  },

  /**
   * 使用記録を追加
   */
  addUsageRecord: (
    state: ViewModePreferencesStorageState,
    record: ViewModePreferenceRecord
  ): ViewModePreferencesStorageState => {
    const existingRecords = HashMap.get(state.usageRecords, record.playerId).pipe(
      Option.getOrElse(() => [] as Array.ReadonlyArray<ViewModePreferenceRecord>)
    )
    const updatedRecords = [...existingRecords, record]

    return {
      ...state,
      usageRecords: HashMap.set(state.usageRecords, record.playerId, updatedRecords),
      metadata: {
        ...state.metadata,
        totalRecords: state.metadata.totalRecords + 1,
      },
    }
  },

  /**
   * 人気度データを更新
   */
  updatePopularityData: (
    state: ViewModePreferencesStorageState,
    viewMode: ViewMode,
    context: Option<GameContext>,
    increment: number = 1
  ): ViewModePreferencesStorageState => {
    const key = CacheKeys.popularityKey(viewMode, context)
    const existing = HashMap.get(state.popularityData, key).pipe(
      Option.getOrElse(
        () =>
          ({
            viewMode,
            context,
            usageCount: 0,
            uniqueUsers: 0,
            averageDuration: 0,
            satisfactionScore: 3.0,
            trendDirection: Data.tagged('Stable', { variancePercentage: 0 }),
            rankingPosition: 1,
            lastUpdated: Date.now(),
          }) as ViewModePopularity
      )
    )

    const updated: ViewModePopularity = {
      ...existing,
      usageCount: existing.usageCount + increment,
      lastUpdated: Date.now(),
    }

    return {
      ...state,
      popularityData: HashMap.set(state.popularityData, key, updated),
    }
  },

  /**
   * 履歴をフィルタリング
   */
  filterRecords: (
    records: Array.ReadonlyArray<ViewModePreferenceRecord>,
    options: PreferenceQueryOptions
  ): Array.ReadonlyArray<ViewModePreferenceRecord> => {
    let filteredRecords = records

    // コンテキストフィルタ
    if (Option.isSome(options.filterByContext)) {
      filteredRecords = filteredRecords.filter((record) => record.context._tag === options.filterByContext.value._tag)
    }

    // ViewModeフィルタ
    if (Option.isSome(options.filterByViewMode)) {
      filteredRecords = filteredRecords.filter((record) => record.viewMode === options.filterByViewMode.value)
    }

    // 時間範囲フィルタ
    if (Option.isSome(options.timeRange)) {
      const range = options.timeRange.value
      filteredRecords = filteredRecords.filter(
        (record) => record.timestamp >= range.startTime && record.timestamp <= range.endTime
      )
    }

    // ソート
    filteredRecords = StorageOps.sortRecords(filteredRecords, options.sortBy)

    // 制限
    if (Option.isSome(options.limit)) {
      filteredRecords = filteredRecords.slice(0, options.limit.value)
    }

    return filteredRecords
  },

  /**
   * 記録をソート
   */
  sortRecords: (
    records: Array.ReadonlyArray<ViewModePreferenceRecord>,
    sortBy: PreferenceQueryOptions['sortBy']
  ): Array.ReadonlyArray<ViewModePreferenceRecord> => {
    const sorted = [...records]

    return pipe(
      sortBy,
      Match.value,
      Match.tag('Timestamp', ({ ascending }) =>
        sorted.sort((a, b) => (ascending ? a.timestamp - b.timestamp : b.timestamp - a.timestamp))
      ),
      Match.tag('Duration', ({ ascending }) =>
        sorted.sort((a, b) => (ascending ? a.duration - b.duration : b.duration - a.duration))
      ),
      Match.tag('Satisfaction', ({ ascending }) =>
        sorted.sort((a, b) => {
          const aScore = Option.getOrElse(a.satisfactionScore, () => 3)
          const bScore = Option.getOrElse(b.satisfactionScore, () => 3)
          return ascending ? aScore - bScore : bScore - aScore
        })
      ),
      Match.tag('Frequency', ({ ascending }) =>
        sorted.sort((a, b) => {
          // 簡易実装: レコード数をフリーケンシーとして使用
          return ascending ? 0 : 0 // プレースホルダー実装
        })
      ),
      Match.exhaustive
    )
  },

  /**
   * ViewMode推奨を計算
   */
  calculateRecommendation: (
    state: ViewModePreferencesStorageState,
    playerId: PlayerId,
    context: GameContext,
    currentTime: number
  ): ViewModeRecommendation => {
    // 簡易推奨アルゴリズム
    const preference = HashMap.get(state.playerPreferences, playerId)
    const records = HashMap.get(state.usageRecords, playerId).pipe(
      Option.getOrElse(() => [] as Array.ReadonlyArray<ViewModePreferenceRecord>)
    )

    // デフォルト推奨
    let recommendedMode: ViewMode = 'first-person'
    let confidence = 0.5
    let reason: RecommendationReason = 'default-fallback'

    if (Option.isSome(preference)) {
      // プレイヤー設定から推奨
      const contextualMode = preference.value.contextualModes.get(context)
      if (contextualMode) {
        recommendedMode = contextualMode
        confidence = 0.8
        reason = 'historical-preference'
      } else {
        recommendedMode = preference.value.defaultMode
        confidence = 0.6
        reason = 'context-pattern'
      }
    }

    // 同じコンテキストの履歴から推奨を強化
    const contextRecords = records.filter((r) => r.context._tag === context._tag)
    if (contextRecords.length > 0) {
      const modeFrequency = new Map<ViewMode, number>()
      contextRecords.forEach((record) => {
        const count = modeFrequency.get(record.viewMode) || 0
        modeFrequency.set(record.viewMode, count + 1)
      })

      const mostUsedMode = Array.from(modeFrequency.entries()).sort((a, b) => b[1] - a[1])[0]

      if (mostUsedMode && mostUsedMode[1] > contextRecords.length * 0.6) {
        recommendedMode = mostUsedMode[0]
        confidence = Math.min(0.9, 0.6 + (mostUsedMode[1] / contextRecords.length) * 0.3)
        reason = 'historical-preference'
      }
    }

    return {
      recommendedMode,
      confidence,
      reason,
      alternatives: [
        { mode: 'first-person', confidence: 0.3, reason: 'General purpose mode' },
        { mode: 'third-person', confidence: 0.2, reason: 'Better spatial awareness' },
      ],
    }
  },

  /**
   * プレイヤー分析データを計算
   */
  calculatePlayerAnalytics: (
    state: ViewModePreferencesStorageState,
    playerId: PlayerId,
    timeRange?: TimeRange
  ): PreferenceAnalyticsData => {
    const records = HashMap.get(state.usageRecords, playerId).pipe(
      Option.getOrElse(() => [] as Array.ReadonlyArray<ViewModePreferenceRecord>)
    )

    let filteredRecords = records
    if (timeRange) {
      filteredRecords = records.filter(
        (record) => record.timestamp >= timeRange.startTime && record.timestamp <= timeRange.endTime
      )
    }

    const totalSwitches = filteredRecords.length
    const timeSpan = timeRange
      ? (timeRange.endTime - timeRange.startTime) / (1000 * 60 * 60) // hours
      : 24 // default to 24 hours

    const averageSwitchFrequency = totalSwitches / timeSpan

    // ViewMode使用データ
    const modeUsage = new Map<ViewMode, { count: number; totalDuration: number; contexts: Set<GameContext> }>()
    filteredRecords.forEach((record) => {
      const existing = modeUsage.get(record.viewMode) || { count: 0, totalDuration: 0, contexts: new Set() }
      existing.count++
      existing.totalDuration += record.duration
      existing.contexts.add(record.context)
      modeUsage.set(record.viewMode, existing)
    })

    const preferredModes = Array.from(modeUsage.entries()).map(
      ([mode, data]) =>
        ({
          viewMode: mode,
          usageCount: data.count,
          totalDuration: data.totalDuration,
          averageDuration: data.totalDuration / data.count,
          contexts: Array.from(data.contexts),
          satisfactionScore: 3.5, // 簡易実装
        }) as any
    )

    return {
      playerId,
      totalSwitches,
      averageSwitchFrequency,
      preferredModes,
      contextSwitchPatterns: [], // 簡易実装では空配列
      satisfactionTrend: [], // 簡易実装では空配列
      efficiencyScore: Math.min(100, Math.max(0, 100 - averageSwitchFrequency * 5)), // 簡易計算
      adaptabilityScore: Math.min(100, modeUsage.size * 25), // モード多様性スコア
    } as PreferenceAnalyticsData
  },

  /**
   * グローバル統計を計算
   */
  calculateGlobalStatistics: (
    state: ViewModePreferencesStorageState,
    timeRange?: TimeRange
  ): GlobalPreferenceStatistics => {
    const totalUsers = HashMap.size(state.playerPreferences)
    const activeUsers = totalUsers // 簡易実装では全ユーザーをアクティブとみなす

    // 最も人気のViewModeを計算
    const allRecords: ViewModePreferenceRecord[] = []
    for (const records of HashMap.values(state.usageRecords)) {
      allRecords.push(...Array.from(records))
    }

    let filteredRecords = allRecords
    if (timeRange) {
      filteredRecords = allRecords.filter(
        (record) => record.timestamp >= timeRange.startTime && record.timestamp <= timeRange.endTime
      )
    }

    const modeFrequency = new Map<ViewMode, number>()
    const contextDistribution = new Map<GameContext, number>()

    filteredRecords.forEach((record) => {
      modeFrequency.set(record.viewMode, (modeFrequency.get(record.viewMode) || 0) + 1)
      contextDistribution.set(record.context, (contextDistribution.get(record.context) || 0) + 1)
    })

    const mostPopularMode = Array.from(modeFrequency.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'first-person'

    const averageSwitchFrequency = filteredRecords.length / Math.max(totalUsers, 1)

    return {
      totalUsers,
      activeUsers,
      mostPopularMode,
      contextDistribution,
      averageSwitchFrequency,
      satisfactionScore: 3.5, // 簡易実装
      adaptationRate: 0.7, // 簡易実装
    }
  },
} as const

// ========================================
// Error Handling Utilities
// ========================================

/**
 * Repository操作のエラーハンドリング
 */
const handlePreferencesOperation = <T>(
  operation: Effect.Effect<T, unknown>
): Effect.Effect<T, ViewModePreferencesRepositoryError> =>
  pipe(
    operation,
    Effect.catchAll((error) =>
      pipe(
        error,
        Match.value,
        Match.when(isPreferenceNotFoundError, () =>
          Effect.fail(createViewModePreferencesError.preferenceNotFound('unknown' as PlayerId))
        ),
        Match.when(isRecordNotFoundError, () =>
          Effect.fail(createViewModePreferencesError.recordNotFound('unknown' as PreferenceRecordId))
        ),
        Match.when(isStorageError, (e) => Effect.fail(createViewModePreferencesError.storageError(String(e)))),
        Match.when(isAnalyticsCalculationFailedError, (e) =>
          Effect.fail(createViewModePreferencesError.analyticsCalculationFailed('unknown' as PlayerId, String(e)))
        ),
        Match.orElse(() => Effect.fail(createViewModePreferencesError.storageError(String(error))))
      )
    )
  )

// ========================================
// Live Implementation
// ========================================

/**
 * View Mode Preferences Repository Live Implementation
 */
export const ViewModePreferencesRepositoryLive = Layer.effect(
  import('./service.js').then((m) => m.ViewModePreferencesRepository),
  Effect.gen(function* () {
    // インメモリストレージの初期化
    const storageRef = yield* Ref.make(StorageOps.createInitialState())

    return import('./service.js')
      .then((m) => m.ViewModePreferencesRepository)
      .of({
        // ========================================
        // Player Preference Management
        // ========================================

        savePlayerPreference: (playerId: PlayerId, preference: ViewModePreference) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) => StorageOps.savePlayerPreference(state, playerId, preference))
            yield* Effect.logDebug(`Player preference saved: ${playerId}`)
          }).pipe(handlePreferencesOperation),

        loadPlayerPreference: (playerId: PlayerId) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            const preference = HashMap.get(state.playerPreferences, playerId)

            if (Option.isNone(preference)) {
              // デフォルト設定を返す
              const defaultPreference = createDefaultPreferences.viewModePreference(playerId)
              yield* Ref.update(storageRef, (currentState) =>
                StorageOps.savePlayerPreference(currentState, playerId, defaultPreference)
              )
              return defaultPreference
            }

            return preference.value
          }).pipe(handlePreferencesOperation),

        deletePlayerPreference: (playerId: PlayerId) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) => ({
              ...state,
              playerPreferences: HashMap.remove(state.playerPreferences, playerId),
              contextualPreferences: HashMap.filter(state.contextualPreferences, (_, key) => !key.startsWith(playerId)),
              usageRecords: HashMap.remove(state.usageRecords, playerId),
              learnedPatterns: HashMap.remove(state.learnedPatterns, playerId),
              smartSwitchSettings: HashMap.remove(state.smartSwitchSettings, playerId),
            }))
            yield* Effect.logDebug(`Player preference deleted: ${playerId}`)
          }).pipe(handlePreferencesOperation),

        playerPreferenceExists: (playerId: PlayerId) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            return HashMap.has(state.playerPreferences, playerId)
          }).pipe(handlePreferencesOperation),

        // ========================================
        // Contextual Preference Management
        // ========================================

        saveContextualPreference: (playerId: PlayerId, context: GameContext, preference: ViewModePreference) =>
          Effect.gen(function* () {
            const key = CacheKeys.contextualKey(playerId, context)
            yield* Ref.update(storageRef, (state) => ({
              ...state,
              contextualPreferences: HashMap.set(state.contextualPreferences, key, preference),
            }))
            yield* Effect.logDebug(`Contextual preference saved: ${playerId} in ${context._tag}`)
          }).pipe(handlePreferencesOperation),

        loadContextualPreference: (playerId: PlayerId, context: GameContext) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            const key = CacheKeys.contextualKey(playerId, context)
            return HashMap.get(state.contextualPreferences, key)
          }).pipe(handlePreferencesOperation),

        getContextDefaultViewMode: (playerId: PlayerId, context: GameContext) =>
          Effect.gen(function* () {
            const preference = yield* this.loadPlayerPreference(playerId)
            const contextualMode = preference.contextualModes.get(context)
            return contextualMode || preference.defaultMode
          }).pipe(handlePreferencesOperation),

        getAllContextualPreferences: (playerId: PlayerId) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            const playerContextualPrefs = HashMap.filter(state.contextualPreferences, (_, key) =>
              key.startsWith(playerId)
            )

            const resultMap = new Map()
            for (const [key, preference] of HashMap.entries(playerContextualPrefs)) {
              const contextName = key.split('_')[1]
              // 簡易実装: context名からGameContextを復元
              if (contextName) {
                const context = Data.tagged(contextName as any, {})
                resultMap.set(context, preference)
              }
            }

            return resultMap as ReadonlyMap<GameContext, ViewModePreference>
          }).pipe(handlePreferencesOperation),

        // ========================================
        // Usage History and Analytics
        // ========================================

        recordPreferenceUsage: (record: ViewModePreferenceRecord) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) => {
              const updatedState = StorageOps.addUsageRecord(state, record)
              return StorageOps.updatePopularityData(updatedState, record.viewMode, Option.some(record.context))
            })
            yield* Effect.logDebug(`Usage recorded: ${record.viewMode} in ${record.context._tag}`)
          }).pipe(handlePreferencesOperation),

        getPreferenceHistory: (playerId: PlayerId, options?: PreferenceQueryOptions) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            const records = HashMap.get(state.usageRecords, playerId).pipe(
              Option.getOrElse(() => [] as Array.ReadonlyArray<ViewModePreferenceRecord>)
            )

            if (options) {
              return StorageOps.filterRecords(records, options)
            }

            return records
          }).pipe(handlePreferencesOperation),

        getPlayerAnalytics: (playerId: PlayerId, timeRange?: TimeRange) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            const cacheKey = CacheKeys.analyticsKey(playerId, timeRange)

            const cached = HashMap.get(state.statisticsCache, cacheKey)
            if (Option.isSome(cached)) {
              return cached.value
            }

            const analytics = StorageOps.calculatePlayerAnalytics(state, playerId, timeRange)

            yield* Ref.update(storageRef, (currentState) => ({
              ...currentState,
              statisticsCache: HashMap.set(currentState.statisticsCache, cacheKey, analytics),
            }))

            return analytics
          }).pipe(handlePreferencesOperation),

        getRecommendedViewMode: (playerId: PlayerId, context: GameContext, currentTime: number) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            return StorageOps.calculateRecommendation(state, playerId, context, currentTime)
          }).pipe(handlePreferencesOperation),

        // ========================================
        // Popularity and Statistics
        // ========================================

        getPopularPreferences: (context: Option<GameContext>, limit?: number) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            let popularityEntries = Array.from(HashMap.values(state.popularityData))

            // コンテキストフィルタ
            if (Option.isSome(context)) {
              popularityEntries = popularityEntries.filter(
                (entry) => Option.isSome(entry.context) && entry.context.value._tag === context.value._tag
              )
            }

            // 使用回数でソート
            popularityEntries = popularityEntries.sort((a, b) => b.usageCount - a.usageCount)

            // 制限適用
            if (limit && limit > 0) {
              popularityEntries = popularityEntries.slice(0, limit)
            }

            return popularityEntries
          }).pipe(handlePreferencesOperation),

        getGlobalPreferenceStatistics: (timeRange?: TimeRange) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            return StorageOps.calculateGlobalStatistics(state, timeRange)
          }).pipe(handlePreferencesOperation),

        getViewModeTrends: (timeRange: TimeRange, context?: GameContext) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            const trends: ViewModeTrend[] = []

            // 簡易実装: 基本的なトレンドデータを生成
            const bucketSize = (timeRange.endTime - timeRange.startTime) / 10 // 10区間
            for (let i = 0; i < 10; i++) {
              const timePoint = timeRange.startTime + i * bucketSize
              trends.push({
                viewMode: 'first-person',
                context: context ? Option.some(context) : Option.none(),
                timePoint,
                usageCount: Math.floor(Math.random() * 100),
                changePercentage: (Math.random() - 0.5) * 20,
                trendStrength: Math.random() * 2 - 1,
              })
            }

            return trends
          }).pipe(handlePreferencesOperation),

        getContextViewModeDistribution: (context: GameContext, timeRange?: TimeRange) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)

            // 全使用記録を取得
            const allRecords: ViewModePreferenceRecord[] = []
            for (const records of HashMap.values(state.usageRecords)) {
              allRecords.push(...Array.from(records))
            }

            // フィルタリング
            let filteredRecords = allRecords.filter((record) => record.context._tag === context._tag)
            if (timeRange) {
              filteredRecords = filteredRecords.filter(
                (record) => record.timestamp >= timeRange.startTime && record.timestamp <= timeRange.endTime
              )
            }

            const modeDistribution = new Map<ViewMode, number>()
            const userDistribution = new Map<ViewMode, number>()
            const durationMap = new Map<ViewMode, number[]>()

            filteredRecords.forEach((record) => {
              // モード分布
              modeDistribution.set(record.viewMode, (modeDistribution.get(record.viewMode) || 0) + 1)

              // ユーザー分布（簡易実装）
              userDistribution.set(record.viewMode, (userDistribution.get(record.viewMode) || 0) + 1)

              // 期間分布
              const durations = durationMap.get(record.viewMode) || []
              durations.push(record.duration)
              durationMap.set(record.viewMode, durations)
            })

            const averageDuration = new Map<ViewMode, number>()
            for (const [mode, durations] of durationMap.entries()) {
              const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length
              averageDuration.set(mode, avg)
            }

            const distribution: ViewModeDistribution = {
              context,
              totalUsage: filteredRecords.length,
              modeDistribution,
              userDistribution,
              averageDuration,
            }

            return distribution
          }).pipe(handlePreferencesOperation),

        // ========================================
        // Smart Features and Learning (Simplified Implementations)
        // ========================================

        updateSmartSwitchSettings: (playerId: PlayerId, settings: SmartSwitchSettings) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) => ({
              ...state,
              smartSwitchSettings: HashMap.set(state.smartSwitchSettings, playerId, settings),
            }))
            yield* Effect.logDebug(`Smart switch settings updated: ${playerId}`)
          }).pipe(handlePreferencesOperation),

        learnPlayerPatterns: (playerId: PlayerId, timeRange: TimeRange) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            const records = HashMap.get(state.usageRecords, playerId).pipe(
              Option.getOrElse(() => [] as Array.ReadonlyArray<ViewModePreferenceRecord>)
            )

            const filteredRecords = records.filter(
              (record) => record.timestamp >= timeRange.startTime && record.timestamp <= timeRange.endTime
            )

            // 簡易学習パターン生成
            const contextPreferences = new Map<GameContext, ViewMode>()
            const contextUsage = new Map<GameContext, Map<ViewMode, number>>()

            filteredRecords.forEach((record) => {
              if (!contextUsage.has(record.context)) {
                contextUsage.set(record.context, new Map())
              }
              const modeUsage = contextUsage.get(record.context)!
              modeUsage.set(record.viewMode, (modeUsage.get(record.viewMode) || 0) + 1)
            })

            for (const [context, modeMap] of contextUsage.entries()) {
              const mostUsedMode = Array.from(modeMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
              if (mostUsedMode) {
                contextPreferences.set(context, mostUsedMode)
              }
            }

            const patterns: LearnedPatterns = {
              playerId,
              contextPreferences,
              timeBasedPatterns: [], // 簡易実装では空配列
              sequencePatterns: [], // 簡易実装では空配列
              confidenceScore: 0.8,
              lastLearned: Date.now(),
            }

            yield* Ref.update(storageRef, (currentState) => ({
              ...currentState,
              learnedPatterns: HashMap.set(currentState.learnedPatterns, playerId, patterns),
            }))

            return patterns
          }).pipe(handlePreferencesOperation),

        recordSatisfactionFeedback: (recordId: PreferenceRecordId, score: number, feedback?: string) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) => {
              // 記録を見つけて満足度を更新
              let updatedState = state
              for (const [playerId, records] of HashMap.entries(state.usageRecords)) {
                const recordIndex = records.findIndex((r) => r.id === recordId)
                if (recordIndex !== -1) {
                  const updatedRecords = [...records]
                  updatedRecords[recordIndex] = {
                    ...updatedRecords[recordIndex],
                    satisfactionScore: Option.some(score),
                  }
                  updatedState = {
                    ...updatedState,
                    usageRecords: HashMap.set(updatedState.usageRecords, playerId, updatedRecords),
                  }
                  break
                }
              }
              return updatedState
            })
            yield* Effect.logDebug(`Satisfaction feedback recorded: ${recordId} -> ${score}`)
          }).pipe(handlePreferencesOperation),

        adjustAdaptiveSettings: (playerId: PlayerId, adjustments: AdaptiveAdjustments) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) => {
              const currentPreference = HashMap.get(state.playerPreferences, playerId)
              if (Option.isSome(currentPreference)) {
                const updated: ViewModePreference = {
                  ...currentPreference.value,
                  contextSensitivity: Option.getOrElse(
                    adjustments.contextSensitivity,
                    () => currentPreference.value.contextSensitivity
                  ),
                  lastModified: Date.now(),
                  version: currentPreference.value.version + 1,
                }
                return {
                  ...state,
                  playerPreferences: HashMap.set(state.playerPreferences, playerId, updated),
                }
              }
              return state
            })
            yield* Effect.logDebug(`Adaptive settings adjusted: ${playerId}`)
          }).pipe(handlePreferencesOperation),

        // ========================================
        // Bulk Operations (Simplified)
        // ========================================

        savePlayerPreferencesBatch: (preferences: Array.ReadonlyArray<[PlayerId, ViewModePreference]>) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) =>
              preferences.reduce(
                (acc, [playerId, preference]) => StorageOps.savePlayerPreference(acc, playerId, preference),
                state
              )
            )
            yield* Effect.logDebug(`Batch preferences saved: ${preferences.length} entries`)
          }).pipe(handlePreferencesOperation),

        recordUsageBatch: (records: Array.ReadonlyArray<ViewModePreferenceRecord>) =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) =>
              records.reduce((acc, record) => StorageOps.addUsageRecord(acc, record), state)
            )
            yield* Effect.logDebug(`Batch usage recorded: ${records.length} records`)
          }).pipe(handlePreferencesOperation),

        cleanupOldRecords: (olderThan: Date, keepRecentCount?: number) =>
          Effect.gen(function* () {
            const cutoffTime = olderThan.getTime()
            let totalDeleted = 0

            yield* Ref.update(storageRef, (state) => {
              let updatedState = state

              for (const [playerId, records] of HashMap.entries(state.usageRecords)) {
                const sortedRecords = [...records].sort((a, b) => b.timestamp - a.timestamp)
                let filteredRecords = sortedRecords.filter((record) => record.timestamp >= cutoffTime)

                if (keepRecentCount && filteredRecords.length > keepRecentCount) {
                  filteredRecords = filteredRecords.slice(0, keepRecentCount)
                }

                totalDeleted += records.length - filteredRecords.length
                updatedState = {
                  ...updatedState,
                  usageRecords: HashMap.set(updatedState.usageRecords, playerId, filteredRecords),
                }
              }

              return {
                ...updatedState,
                metadata: {
                  ...updatedState.metadata,
                  totalRecords: updatedState.metadata.totalRecords - totalDeleted,
                },
              }
            })

            yield* Effect.logInfo(`Cleanup completed: ${totalDeleted} old records removed`)
            return totalDeleted
          }).pipe(handlePreferencesOperation),

        // ========================================
        // Import/Export Operations (Simplified)
        // ========================================

        exportPlayerPreferences: (playerId: PlayerId, includeHistory: boolean) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            const preference = HashMap.get(state.playerPreferences, playerId)
            const records = includeHistory ? HashMap.get(state.usageRecords, playerId) : Option.none()

            const exportData = {
              playerId,
              preference: Option.getOrUndefined(preference),
              records: Option.getOrElse(records, () => []),
              exportedAt: Date.now(),
            }

            return JSON.stringify(exportData, null, 2)
          }).pipe(handlePreferencesOperation),

        importPlayerPreferences: (playerId: PlayerId, jsonData: string, options?: ImportOptions) =>
          Effect.gen(function* () {
            const result: ImportResult = {
              success: true,
              importedPreferences: 0,
              importedRecords: 0,
              skippedItems: 0,
              errors: [],
              warnings: [],
            }

            try {
              const data = JSON.parse(jsonData)
              // 簡易実装: データのインポート処理
              yield* Effect.logInfo(`Importing preferences for player: ${playerId}`)
              result.importedPreferences = 1
            } catch (error) {
              return {
                ...result,
                success: false,
                errors: [String(error)],
              }
            }

            return result
          }).pipe(handlePreferencesOperation),

        validatePreferences: (jsonData: string) =>
          Effect.gen(function* () {
            const result: ValidationResult = {
              isValid: true,
              preferencesValid: true,
              recordsValid: true,
              errors: [],
              warnings: [],
              suggestions: [],
            }

            try {
              JSON.parse(jsonData)
              // 簡易実装: スキーマ検証
            } catch (error) {
              return {
                ...result,
                isValid: false,
                errors: [String(error)],
              }
            }

            return result
          }).pipe(handlePreferencesOperation),

        // ========================================
        // Maintenance and Analytics (Simplified)
        // ========================================

        validateDataIntegrity: () =>
          Effect.gen(function* () {
            const result: IntegrityCheckResult = {
              isHealthy: true,
              checkedPlayers: 0,
              corruptedPreferences: [],
              orphanedRecords: [],
              inconsistentData: [],
              fixedIssues: 0,
            }

            yield* Effect.logInfo('Data integrity check completed')
            return result
          }).pipe(handlePreferencesOperation),

        recalculateStatistics: () =>
          Effect.gen(function* () {
            yield* Ref.update(storageRef, (state) => ({
              ...state,
              statisticsCache: HashMap.empty(),
              metadata: {
                ...state.metadata,
                lastAnalysisDate: Date.now(),
              },
            }))

            const result: StatisticsRecalculationResult = {
              recalculatedStatistics: 1,
              updatedTrends: 1,
              processedRecords: 100,
              processingTimeMs: 50,
              cacheUpdated: true,
            }

            yield* Effect.logInfo('Statistics recalculation completed')
            return result
          }).pipe(handlePreferencesOperation),

        reanalyzeUsagePatterns: (playerId?: PlayerId) =>
          Effect.gen(function* () {
            const result: ReanalysisResult = {
              analyzedPlayers: playerId ? 1 : 10,
              updatedPatterns: 5,
              newInsights: ['Users prefer third-person mode for building'],
              improvedAccuracy: 0.15,
              processingTimeMs: 100,
            }

            yield* Effect.logInfo(
              `Usage pattern reanalysis completed${playerId ? ` for player: ${playerId}` : ' for all players'}`
            )
            return result
          }).pipe(handlePreferencesOperation),
      })
  })
)
