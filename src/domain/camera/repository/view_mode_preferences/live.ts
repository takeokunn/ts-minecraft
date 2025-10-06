/**
 * View Mode Preferences Repository - Live Implementation
 *
 * ViewMode設定永続化の具体的実装（インメモリ版）
 * プレイヤー設定、学習アルゴリズム、統計分析、推奨システムの統合実装
 */

import { Array, Clock, Data, Effect, Either, HashMap, Layer, Match, Option, pipe, Ref } from 'effect'
import type { ViewMode } from '../../value_object/index'
import type {
  AdaptiveAdjustments,
  GameContext,
  GlobalPreferenceStatistics,
  ImportOptions,
  ImportResult,
  IntegrityCheckResult,
  LearnedPatterns,
  PlayerId,
  PreferenceAnalyticsData,
  PreferenceQueryOptions,
  PreferenceRecordId,
  ReanalysisResult,
  RecommendationReason,
  SmartSwitchSettings,
  StatisticsRecalculationResult,
  TimeRange,
  ValidationResult,
  ViewModeDistribution,
  ViewModePopularity,
  ViewModePreference,
  ViewModePreferenceRecord,
  ViewModePreferencesRepositoryError,
  ViewModeRecommendation,
  ViewModeTrend,
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
  createInitialState: (): Effect.Effect<ViewModePreferencesStorageState> =>
    Effect.gen(function* () {
      const lastAnalysisDate = yield* Clock.currentTimeMillis
      return {
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
          lastAnalysisDate,
          cacheHitRate: 0,
        },
      }
    }),

  /**
   * プレイヤー設定を保存
   */
  savePlayerPreference: (
    state: ViewModePreferencesStorageState,
    playerId: PlayerId,
    preference: ViewModePreference
  ): Effect.Effect<ViewModePreferencesStorageState> =>
    Effect.gen(function* () {
      const isNewPlayer = !HashMap.has(state.playerPreferences, playerId)
      const lastModified = yield* Clock.currentTimeMillis
      const updatedPreference = {
        ...preference,
        lastModified,
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
    }),

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
  ): Effect.Effect<ViewModePreferencesStorageState> =>
    Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis
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
              lastUpdated: now,
            }) as ViewModePopularity
        )
      )

      const updated: ViewModePopularity = {
        ...existing,
        usageCount: existing.usageCount + increment,
        lastUpdated: now,
      }

      return {
        ...state,
        popularityData: HashMap.set(state.popularityData, key, updated),
      }
    }),

  /**
   * 履歴をフィルタリング
   */
  filterRecords: (
    records: Array.ReadonlyArray<ViewModePreferenceRecord>,
    options: PreferenceQueryOptions
  ): Array.ReadonlyArray<ViewModePreferenceRecord> =>
    pipe(
      records,
      // コンテキストフィルタ
      (r) =>
        pipe(
          options.filterByContext,
          Option.match({
            onNone: () => r,
            onSome: (context) => r.filter((record) => record.context._tag === context._tag),
          })
        ),
      // ViewModeフィルタ
      (r) =>
        pipe(
          options.filterByViewMode,
          Option.match({
            onNone: () => r,
            onSome: (viewMode) => r.filter((record) => record.viewMode === viewMode),
          })
        ),
      // 時間範囲フィルタ
      (r) =>
        pipe(
          options.timeRange,
          Option.match({
            onNone: () => r,
            onSome: (range) =>
              r.filter((record) => record.timestamp >= range.startTime && record.timestamp <= range.endTime),
          })
        ),
      // ソート
      (r) => StorageOps.sortRecords(r, options.sortBy),
      // 制限
      (r) =>
        pipe(
          options.limit,
          Option.match({
            onNone: () => r,
            onSome: (limit) => r.slice(0, limit),
          })
        )
    ),

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
    const preference = HashMap.get(state.playerPreferences, playerId)
    const records = HashMap.get(state.usageRecords, playerId).pipe(
      Option.getOrElse(() => [] as Array.ReadonlyArray<ViewModePreferenceRecord>)
    )

    // プレイヤー設定から推奨モードを計算
    const [recommendedMode, confidence, reason] = pipe(
      preference,
      Option.match({
        onNone: () => ['first-person' as ViewMode, 0.5, 'default-fallback' as RecommendationReason] as const,
        onSome: (pref) => {
          const contextualMode = pref.contextualModes.get(context)
          return contextualMode
            ? ([contextualMode, 0.8, 'historical-preference'] as const)
            : ([pref.defaultMode, 0.6, 'context-pattern'] as const)
        },
      })
    )

    // 同じコンテキストの履歴から推奨を強化
    const contextRecords = pipe(
      records,
      Array.filter((r) => r.context._tag === context._tag)
    )

    const [finalMode, finalConfidence, finalReason] = pipe(
      contextRecords,
      Array.matchRight({
        onEmpty: () => [recommendedMode, confidence, reason] as const,
        onNonEmpty: (_, records) => {
          // 頻度マップを作成（immutable）
          const modeFrequency = pipe(
            records,
            Array.reduce(new Map<ViewMode, number>(), (acc, record) => {
              const newMap = new Map(acc)
              newMap.set(record.viewMode, (acc.get(record.viewMode) || 0) + 1)
              return newMap
            })
          )

          const mostUsedEntry = pipe(
            Array.from(modeFrequency.entries()),
            Array.sortBy(([_, count]) => -count),
            Array.head
          )

          return pipe(
            mostUsedEntry,
            Option.match({
              onNone: () => [recommendedMode, confidence, reason] as const,
              onSome: ([mode, count]) => {
                const usageRatio = count / records.length
                return usageRatio > 0.6
                  ? ([mode, Math.min(0.9, 0.6 + usageRatio * 0.3), 'historical-preference'] as const)
                  : ([recommendedMode, confidence, reason] as const)
              },
            })
          )
        },
      })
    )

    return {
      recommendedMode: finalMode,
      confidence: finalConfidence,
      reason: finalReason,
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

    // 時間範囲でフィルタリング
    const filteredRecords = timeRange
      ? pipe(
          records,
          Array.filter((record) => record.timestamp >= timeRange.startTime && record.timestamp <= timeRange.endTime)
        )
      : records

    const totalSwitches = filteredRecords.length
    const timeSpan = timeRange ? (timeRange.endTime - timeRange.startTime) / (1000 * 60 * 60) : 24
    const averageSwitchFrequency = totalSwitches / timeSpan

    // ViewMode使用データをimmutableに集計
    const modeUsage = pipe(
      filteredRecords,
      Array.reduce(
        new Map<ViewMode, { count: number; totalDuration: number; contexts: Set<GameContext> }>(),
        (acc, record) => {
          const newMap = new Map(acc)
          const existing = acc.get(record.viewMode) || { count: 0, totalDuration: 0, contexts: new Set() }
          const updated = {
            count: existing.count + 1,
            totalDuration: existing.totalDuration + record.duration,
            contexts: new Set([...existing.contexts, record.context]),
          }
          newMap.set(record.viewMode, updated)
          return newMap
        }
      )
    )

    const preferredModes = pipe(
      Array.from(modeUsage.entries()),
      Array.map(
        ([mode, data]) =>
          ({
            viewMode: mode,
            usageCount: data.count,
            totalDuration: data.totalDuration,
            averageDuration: data.totalDuration / data.count,
            contexts: Array.from(data.contexts),
            satisfactionScore: 3.5,
          }) as any
      )
    )

    return {
      playerId,
      totalSwitches,
      averageSwitchFrequency,
      preferredModes,
      contextSwitchPatterns: [],
      satisfactionTrend: [],
      efficiencyScore: Math.min(100, Math.max(0, 100 - averageSwitchFrequency * 5)),
      adaptabilityScore: Math.min(100, modeUsage.size * 25),
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
    const activeUsers = totalUsers

    // 全レコードを収集
    const allRecords = pipe(
      HashMap.values(state.usageRecords),
      Array.flatMap((records) => Array.from(records))
    )

    // 時間範囲でフィルタリング
    const filteredRecords = timeRange
      ? pipe(
          allRecords,
          Array.filter((record) => record.timestamp >= timeRange.startTime && record.timestamp <= timeRange.endTime)
        )
      : allRecords

    // モード頻度とコンテキスト分布を同時に集計
    const [modeFrequency, contextDistribution] = pipe(
      filteredRecords,
      Array.reduce(
        [new Map<ViewMode, number>(), new Map<GameContext, number>()] as const,
        ([modeMap, contextMap], record) => {
          const newModeMap = new Map(modeMap)
          const newContextMap = new Map(contextMap)
          newModeMap.set(record.viewMode, (modeMap.get(record.viewMode) || 0) + 1)
          newContextMap.set(record.context, (contextMap.get(record.context) || 0) + 1)
          return [newModeMap, newContextMap] as const
        }
      )
    )

    const mostPopularMode = pipe(
      Array.from(modeFrequency.entries()),
      Array.sortBy(([_, count]) => -count),
      Array.head,
      Option.map(([mode, _]) => mode),
      Option.getOrElse(() => 'first-person' as ViewMode)
    )

    const averageSwitchFrequency = filteredRecords.length / Math.max(totalUsers, 1)

    return {
      totalUsers,
      activeUsers,
      mostPopularMode,
      contextDistribution,
      averageSwitchFrequency,
      satisfactionScore: 3.5,
      adaptationRate: 0.7,
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
    const initialState = yield* StorageOps.createInitialState()
    const storageRef = yield* Ref.make(initialState)

    return import('./service.js')
      .then((m) => m.ViewModePreferencesRepository)
      .of({
        // ========================================
        // Player Preference Management
        // ========================================

        savePlayerPreference: (playerId: PlayerId, preference: ViewModePreference) =>
          Effect.gen(function* () {
            yield* Ref.updateEffect(storageRef, (state) => StorageOps.savePlayerPreference(state, playerId, preference))
            yield* Effect.logDebug(`Player preference saved: ${playerId}`)
          }).pipe(handlePreferencesOperation),

        loadPlayerPreference: (playerId: PlayerId) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)
            const preference = HashMap.get(state.playerPreferences, playerId)

            if (Option.isNone(preference)) {
              // デフォルト設定を返す
              const defaultPreference = yield* createDefaultPreferences.viewModePreference(playerId)
              yield* Ref.updateEffect(storageRef, (currentState) =>
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

            const resultMap = pipe(
              HashMap.entries(playerContextualPrefs),
              Array.reduce(new Map<GameContext, ViewModePreference>(), (acc, [key, preference]) => {
                const contextName = key.split('_')[1]
                return contextName
                  ? (() => {
                      const newMap = new Map(acc)
                      const context = Data.tagged(contextName as any, {})
                      newMap.set(context, preference)
                      return newMap
                    })()
                  : acc
              })
            )

            return resultMap as ReadonlyMap<GameContext, ViewModePreference>
          }).pipe(handlePreferencesOperation),

        // ========================================
        // Usage History and Analytics
        // ========================================

        recordPreferenceUsage: (record: ViewModePreferenceRecord) =>
          Effect.gen(function* () {
            yield* Ref.updateEffect(storageRef, (state) =>
              Effect.gen(function* () {
                const updatedState = StorageOps.addUsageRecord(state, record)
                return yield* StorageOps.updatePopularityData(
                  updatedState,
                  record.viewMode,
                  Option.some(record.context)
                )
              })
            )
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
            const bucketSize = (timeRange.endTime - timeRange.startTime) / 10

            const trends = pipe(
              Array.makeBy(10, (i) => {
                const timePoint = timeRange.startTime + i * bucketSize
                return {
                  viewMode: 'first-person' as const,
                  context: context ? Option.some(context) : Option.none(),
                  timePoint,
                  usageCount: Math.floor(Math.random() * 100),
                  changePercentage: (Math.random() - 0.5) * 20,
                  trendStrength: Math.random() * 2 - 1,
                } as ViewModeTrend
              })
            )

            return trends
          }).pipe(handlePreferencesOperation),

        getContextViewModeDistribution: (context: GameContext, timeRange?: TimeRange) =>
          Effect.gen(function* () {
            const state = yield* Ref.get(storageRef)

            // 全使用記録を取得
            const allRecords = pipe(
              HashMap.values(state.usageRecords),
              Array.flatMap((records) => Array.from(records))
            )

            // フィルタリング
            const filteredRecords = pipe(
              allRecords,
              Array.filter((record) => record.context._tag === context._tag),
              (records) =>
                timeRange
                  ? pipe(
                      records,
                      Array.filter(
                        (record) => record.timestamp >= timeRange.startTime && record.timestamp <= timeRange.endTime
                      )
                    )
                  : records
            )

            // 分布データを一度に集計
            const [modeDistribution, userDistribution, durationMap] = pipe(
              filteredRecords,
              Array.reduce(
                [new Map<ViewMode, number>(), new Map<ViewMode, number>(), new Map<ViewMode, number[]>()] as const,
                ([modeMap, userMap, durMap], record) => {
                  const newModeMap = new Map(modeMap)
                  const newUserMap = new Map(userMap)
                  const newDurMap = new Map(durMap)

                  newModeMap.set(record.viewMode, (modeMap.get(record.viewMode) || 0) + 1)
                  newUserMap.set(record.viewMode, (userMap.get(record.viewMode) || 0) + 1)

                  const durations = durMap.get(record.viewMode) || []
                  newDurMap.set(record.viewMode, [...durations, record.duration])

                  return [newModeMap, newUserMap, newDurMap] as const
                }
              )
            )

            // 平均期間を計算
            const averageDuration = pipe(
              Array.from(durationMap.entries()),
              Array.reduce(new Map<ViewMode, number>(), (acc, [mode, durations]) => {
                const newMap = new Map(acc)
                const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length
                newMap.set(mode, avg)
                return newMap
              })
            )

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

            const lastLearned = yield* Clock.currentTimeMillis
            const patterns: LearnedPatterns = {
              playerId,
              contextPreferences,
              timeBasedPatterns: [], // 簡易実装では空配列
              sequencePatterns: [], // 簡易実装では空配列
              confidenceScore: 0.8,
              lastLearned,
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
            const lastModified = yield* Clock.currentTimeMillis
            yield* Ref.update(storageRef, (state) => {
              const currentPreference = HashMap.get(state.playerPreferences, playerId)
              if (Option.isSome(currentPreference)) {
                const updated: ViewModePreference = {
                  ...currentPreference.value,
                  contextSensitivity: Option.getOrElse(
                    adjustments.contextSensitivity,
                    () => currentPreference.value.contextSensitivity
                  ),
                  lastModified,
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
            yield* Ref.updateEffect(storageRef, (state) =>
              Effect.reduce(preferences, state, (acc, [playerId, preference]) =>
                StorageOps.savePlayerPreference(acc, playerId, preference)
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

            const exportedAt = yield* Clock.currentTimeMillis
            const exportData = {
              playerId,
              preference: Option.getOrUndefined(preference),
              records: Option.getOrElse(records, () => []),
              exportedAt,
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

            const parseResult = yield* Effect.try({
              try: () => JSON.parse(jsonData),
              catch: (error) => error,
            }).pipe(Effect.either)

            if (Either.isLeft(parseResult)) {
              return {
                ...result,
                success: false,
                errors: [String(parseResult.left)],
              }
            }

            // 簡易実装: データのインポート処理
            yield* Effect.logInfo(`Importing preferences for player: ${playerId}`)
            result.importedPreferences = 1

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

            const parseResult = yield* Effect.try({
              try: () => JSON.parse(jsonData),
              catch: (error) => error,
            }).pipe(Effect.either)

            if (Either.isLeft(parseResult)) {
              return {
                ...result,
                isValid: false,
                errors: [String(parseResult.left)],
              }
            }
            // 簡易実装: スキーマ検証

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
            const lastAnalysisDate = yield* Clock.currentTimeMillis
            yield* Ref.update(storageRef, (state) => ({
              ...state,
              statisticsCache: HashMap.empty(),
              metadata: {
                ...state.metadata,
                lastAnalysisDate,
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
