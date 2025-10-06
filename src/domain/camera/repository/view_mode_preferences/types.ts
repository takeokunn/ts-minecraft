/**
 * View Mode Preferences Repository - Types
 *
 * ViewMode設定永続化のためのRepository専用型定義
 * プレイヤー設定、コンテキスト依存設定、人気度分析の型安全性確保
 */

import { Array, Brand, Clock, Data, Effect, Option, ReadonlyMap, Schema } from 'effect'
import type { ViewMode } from '../../value_object/index'

// ========================================
// Repository専用Brand型定義
// ========================================

/**
 * Player ID - プレイヤー識別子
 * 専用value_objectから再エクスポート
 */
export type { PlayerId } from '@domain/player/value_object/player_id'

/**
 * Key Binding - キーバインディング設定
 */
export type KeyBinding = Brand<
  {
    readonly key: string
    readonly modifiers: Array.ReadonlyArray<string>
    readonly action: string
    readonly description: string
  },
  'KeyBinding'
>

/**
 * Game Context - ゲームコンテキスト
 */
export type GameContext = Data.TaggedEnum<{
  readonly Exploration: {}
  readonly Combat: {}
  readonly Building: {}
  readonly Flying: {}
  readonly Spectating: {}
  readonly Cinematic: {}
  readonly Menu: {}
  readonly Inventory: {}
  readonly Crafting: {}
  readonly Chat: {}
}>

/**
 * View Mode Preference - ViewMode設定
 */
export type ViewModePreference = Brand<
  {
    readonly defaultMode: ViewMode
    readonly contextualModes: ReadonlyMap<GameContext, ViewMode>
    readonly autoSwitchEnabled: boolean
    readonly transitionAnimationEnabled: boolean
    readonly quickSwitchBinding: Option<KeyBinding>
    readonly smartSwitchEnabled: boolean
    readonly contextSensitivity: number // 0.0-1.0
    readonly lastModified: number
    readonly version: number
  },
  'ViewModePreference'
>

/**
 * View Mode Preference Record - ViewMode設定履歴記録
 */
export type ViewModePreferenceRecord = Brand<
  {
    readonly id: PreferenceRecordId
    readonly playerId: PlayerId
    readonly viewMode: ViewMode
    readonly context: GameContext
    readonly timestamp: number
    readonly duration: number
    readonly triggeredBy: PreferenceTrigger
    readonly sessionId: string
    readonly satisfactionScore: Option<number> // 1-5
  },
  'ViewModePreferenceRecord'
>

/**
 * Preference Record ID - 設定記録識別子
 */
export type PreferenceRecordId = Brand<string, 'PreferenceRecordId'>

/**
 * Preference Trigger - 設定変更トリガー
 */
export type PreferenceTrigger = Data.TaggedEnum<{
  readonly Manual: {
    readonly inputMethod: 'keyboard' | 'mouse' | 'gamepad' | 'touch'
  }
  readonly Automatic: {
    readonly reason: 'context-switch' | 'smart-suggestion' | 'preset-load'
  }
  readonly System: {
    readonly reason: 'performance-optimization' | 'error-recovery' | 'default-fallback'
  }
}>

/**
 * View Mode Popularity - ViewMode人気度
 */
export type ViewModePopularity = Brand<
  {
    readonly viewMode: ViewMode
    readonly context: Option<GameContext>
    readonly usageCount: number
    readonly uniqueUsers: number
    readonly averageDuration: number
    readonly satisfactionScore: number
    readonly trendDirection: TrendDirection
    readonly rankingPosition: number
    readonly lastUpdated: number
  },
  'ViewModePopularity'
>

/**
 * Trend Direction - 傾向方向
 */
export type TrendDirection = Data.TaggedEnum<{
  readonly Rising: { readonly percentageIncrease: number }
  readonly Falling: { readonly percentageDecrease: number }
  readonly Stable: { readonly variancePercentage: number }
}>

/**
 * Context Sensitivity Level - コンテキスト感度レベル
 */
export type ContextSensitivityLevel = Data.TaggedEnum<{
  readonly Low: {} // 手動切り替え重視
  readonly Medium: {} // バランス
  readonly High: {} // 自動切り替え重視
  readonly Adaptive: {} // 学習に基づく適応
}>

/**
 * Preference Analytics Data - 設定分析データ
 */
export type PreferenceAnalyticsData = Brand<
  {
    readonly playerId: PlayerId
    readonly totalSwitches: number
    readonly averageSwitchFrequency: number // switches per hour
    readonly preferredModes: Array.ReadonlyArray<ViewModeUsageData>
    readonly contextSwitchPatterns: Array.ReadonlyArray<ContextSwitchPattern>
    readonly satisfactionTrend: Array.ReadonlyArray<SatisfactionDataPoint>
    readonly efficiencyScore: number // 0-100
    readonly adaptabilityScore: number // 0-100
  },
  'PreferenceAnalyticsData'
>

/**
 * View Mode Usage Data - ViewMode使用データ
 */
export type ViewModeUsageData = Brand<
  {
    readonly viewMode: ViewMode
    readonly usageCount: number
    readonly totalDuration: number
    readonly averageDuration: number
    readonly contexts: Array.ReadonlyArray<GameContext>
    readonly satisfactionScore: number
  },
  'ViewModeUsageData'
>

/**
 * Context Switch Pattern - コンテキスト切り替えパターン
 */
export type ContextSwitchPattern = Brand<
  {
    readonly fromContext: GameContext
    readonly toContext: GameContext
    readonly preferredViewMode: ViewMode
    readonly frequency: number
    readonly averageTransitionTime: number
    readonly confidence: number // 0-1
  },
  'ContextSwitchPattern'
>

/**
 * Satisfaction Data Point - 満足度データポイント
 */
export type SatisfactionDataPoint = Brand<
  {
    readonly timestamp: number
    readonly score: number // 1-5
    readonly context: GameContext
    readonly viewMode: ViewMode
    readonly feedback: Option<string>
  },
  'SatisfactionDataPoint'
>

/**
 * Preference Query Options - 設定クエリオプション
 */
export type PreferenceQueryOptions = Brand<
  {
    readonly filterByContext: Option<GameContext>
    readonly filterByViewMode: Option<ViewMode>
    readonly timeRange: Option<TimeRange>
    readonly includeSatisfactionData: boolean
    readonly sortBy: PreferenceSortBy
    readonly limit: Option<number>
  },
  'PreferenceQueryOptions'
>

/**
 * Time Range - 時間範囲
 */
export type TimeRange = Brand<
  {
    readonly startTime: number
    readonly endTime: number
  },
  'TimeRange'
>

/**
 * Preference Sort By - 設定ソート方法
 */
export type PreferenceSortBy = Data.TaggedEnum<{
  readonly Timestamp: { readonly ascending: boolean }
  readonly Duration: { readonly ascending: boolean }
  readonly Frequency: { readonly ascending: boolean }
  readonly Satisfaction: { readonly ascending: boolean }
}>

// ========================================
// Repository Error型定義
// ========================================

/**
 * View Mode Preferences Repository Error
 */
export type ViewModePreferencesRepositoryError = Data.TaggedEnum<{
  readonly PreferenceNotFound: {
    readonly playerId: PlayerId
    readonly context: Option<GameContext>
  }
  readonly RecordNotFound: {
    readonly recordId: PreferenceRecordId
  }
  readonly InvalidPreference: {
    readonly field: string
    readonly value: unknown
    readonly reason: string
  }
  readonly DuplicateRecord: {
    readonly playerId: PlayerId
    readonly timestamp: number
  }
  readonly AnalyticsCalculationFailed: {
    readonly playerId: PlayerId
    readonly reason: string
  }
  readonly PopularityDataUnavailable: {
    readonly context: Option<GameContext>
    readonly reason: string
  }
  readonly StorageError: {
    readonly message: string
    readonly cause: Option<unknown>
  }
  readonly EncodingFailed: {
    readonly dataType: string
    readonly reason: string
  }
  readonly DecodingFailed: {
    readonly dataType: string
    readonly reason: string
  }
  readonly ConcurrencyError: {
    readonly operation: string
    readonly conflictingPlayer: Option<PlayerId>
  }
}>

// ========================================
// Schema定義
// ========================================

/**
 * Player ID Schema
 */
export const PlayerIdSchema = Schema.String.pipe(Schema.brand('PlayerId'))

/**
 * Key Binding Schema
 */
export const KeyBindingSchema = Schema.Struct({
  key: Schema.String,
  modifiers: Schema.Array(Schema.String),
  action: Schema.String,
  description: Schema.String,
}).pipe(Schema.brand('KeyBinding'))

/**
 * Game Context Schema
 */
export const GameContextSchema = Schema.Union(
  Schema.TaggedStruct('Exploration', {}),
  Schema.TaggedStruct('Combat', {}),
  Schema.TaggedStruct('Building', {}),
  Schema.TaggedStruct('Flying', {}),
  Schema.TaggedStruct('Spectating', {}),
  Schema.TaggedStruct('Cinematic', {}),
  Schema.TaggedStruct('Menu', {}),
  Schema.TaggedStruct('Inventory', {}),
  Schema.TaggedStruct('Crafting', {}),
  Schema.TaggedStruct('Chat', {})
)

/**
 * Preference Trigger Schema
 */
export const PreferenceTriggerSchema = Schema.Union(
  Schema.TaggedStruct('Manual', {
    inputMethod: Schema.Literal('keyboard', 'mouse', 'gamepad', 'touch'),
  }),
  Schema.TaggedStruct('Automatic', {
    reason: Schema.Literal('context-switch', 'smart-suggestion', 'preset-load'),
  }),
  Schema.TaggedStruct('System', {
    reason: Schema.Literal('performance-optimization', 'error-recovery', 'default-fallback'),
  })
)

/**
 * Trend Direction Schema
 */
export const TrendDirectionSchema = Schema.Union(
  Schema.TaggedStruct('Rising', {
    percentageIncrease: Schema.Number.pipe(Schema.nonNegative()),
  }),
  Schema.TaggedStruct('Falling', {
    percentageDecrease: Schema.Number.pipe(Schema.nonNegative()),
  }),
  Schema.TaggedStruct('Stable', {
    variancePercentage: Schema.Number.pipe(Schema.nonNegative()),
  })
)

/**
 * View Mode Preference Schema
 */
export const ViewModePreferenceSchema = Schema.Struct({
  defaultMode: Schema.String,
  contextualModes: Schema.Map({
    key: GameContextSchema,
    value: Schema.String,
  }),
  autoSwitchEnabled: Schema.Boolean,
  transitionAnimationEnabled: Schema.Boolean,
  quickSwitchBinding: Schema.OptionFromNullable(KeyBindingSchema),
  smartSwitchEnabled: Schema.Boolean,
  contextSensitivity: Schema.Number.pipe(Schema.clamp(0, 1)),
  lastModified: Schema.Number.pipe(Schema.positive()),
  version: Schema.Number.pipe(Schema.positive()),
}).pipe(Schema.brand('ViewModePreference'))

/**
 * Preference Record ID Schema
 */
export const PreferenceRecordIdSchema = Schema.String.pipe(Schema.brand('PreferenceRecordId'))

/**
 * View Mode Preference Record Schema
 */
export const ViewModePreferenceRecordSchema = Schema.Struct({
  id: PreferenceRecordIdSchema,
  playerId: PlayerIdSchema,
  viewMode: Schema.String,
  context: GameContextSchema,
  timestamp: Schema.Number.pipe(Schema.positive()),
  duration: Schema.Number.pipe(Schema.nonNegative()),
  triggeredBy: PreferenceTriggerSchema,
  sessionId: Schema.String,
  satisfactionScore: Schema.OptionFromNullable(Schema.Number.pipe(Schema.clamp(1, 5))),
}).pipe(Schema.brand('ViewModePreferenceRecord'))

/**
 * View Mode Popularity Schema
 */
export const ViewModePopularitySchema = Schema.Struct({
  viewMode: Schema.String,
  context: Schema.OptionFromNullable(GameContextSchema),
  usageCount: Schema.Number.pipe(Schema.nonNegative()),
  uniqueUsers: Schema.Number.pipe(Schema.nonNegative()),
  averageDuration: Schema.Number.pipe(Schema.nonNegative()),
  satisfactionScore: Schema.Number.pipe(Schema.clamp(1, 5)),
  trendDirection: TrendDirectionSchema,
  rankingPosition: Schema.Number.pipe(Schema.positive()),
  lastUpdated: Schema.Number.pipe(Schema.positive()),
}).pipe(Schema.brand('ViewModePopularity'))

/**
 * Time Range Schema
 */
export const TimeRangeSchema = Schema.Struct({
  startTime: Schema.Number.pipe(Schema.positive()),
  endTime: Schema.Number.pipe(Schema.positive()),
}).pipe(
  Schema.filter((range) => range.endTime > range.startTime, {
    message: () => 'End time must be greater than start time',
  }),
  Schema.brand('TimeRange')
)

/**
 * Preference Query Options Schema
 */
export const PreferenceQueryOptionsSchema = Schema.Struct({
  filterByContext: Schema.OptionFromNullable(GameContextSchema),
  filterByViewMode: Schema.OptionFromNullable(Schema.String),
  timeRange: Schema.OptionFromNullable(TimeRangeSchema),
  includeSatisfactionData: Schema.Boolean,
  sortBy: Schema.Union(
    Schema.TaggedStruct('Timestamp', { ascending: Schema.Boolean }),
    Schema.TaggedStruct('Duration', { ascending: Schema.Boolean }),
    Schema.TaggedStruct('Frequency', { ascending: Schema.Boolean }),
    Schema.TaggedStruct('Satisfaction', { ascending: Schema.Boolean })
  ),
  limit: Schema.OptionFromNullable(Schema.Number.pipe(Schema.positive())),
}).pipe(Schema.brand('PreferenceQueryOptions'))

/**
 * View Mode Preferences Repository Error Schema
 */
export const ViewModePreferencesRepositoryErrorSchema = Schema.Union(
  Schema.TaggedStruct('PreferenceNotFound', {
    playerId: PlayerIdSchema,
    context: Schema.OptionFromNullable(GameContextSchema),
  }),
  Schema.TaggedStruct('RecordNotFound', {
    recordId: PreferenceRecordIdSchema,
  }),
  Schema.TaggedStruct('InvalidPreference', {
    field: Schema.String,
    value: Schema.Unknown,
    reason: Schema.String,
  }),
  Schema.TaggedStruct('DuplicateRecord', {
    playerId: PlayerIdSchema,
    timestamp: Schema.Number,
  }),
  Schema.TaggedStruct('AnalyticsCalculationFailed', {
    playerId: PlayerIdSchema,
    reason: Schema.String,
  }),
  Schema.TaggedStruct('PopularityDataUnavailable', {
    context: Schema.OptionFromNullable(GameContextSchema),
    reason: Schema.String,
  }),
  Schema.TaggedStruct('StorageError', {
    message: Schema.String,
    cause: Schema.OptionFromNullable(Schema.Unknown),
  }),
  Schema.TaggedStruct('EncodingFailed', {
    dataType: Schema.String,
    reason: Schema.String,
  }),
  Schema.TaggedStruct('DecodingFailed', {
    dataType: Schema.String,
    reason: Schema.String,
  }),
  Schema.TaggedStruct('ConcurrencyError', {
    operation: Schema.String,
    conflictingPlayer: Schema.OptionFromNullable(PlayerIdSchema),
  })
)

/**
 * Export Data Schema - エクスポートデータ検証用
 * exportPlayerPreferences/importPlayerPreferences で使用
 */
export const PreferenceExportDataSchema = Schema.Struct({
  playerId: PlayerIdSchema,
  preference: Schema.UndefinedOr(ViewModePreferenceSchema),
  records: Schema.Array(ViewModePreferenceRecordSchema),
  exportedAt: Schema.Number.pipe(Schema.positive()),
})

// ========================================
// Factory Functions
// ========================================

/**
 * View Mode Preferences Repository Error Factory
 */
export const createViewModePreferencesError = {
  preferenceNotFound: (playerId: PlayerId, context?: GameContext): ViewModePreferencesRepositoryError =>
    Data.tagged('PreferenceNotFound', {
      playerId,
      context: context ? Option.some(context) : Option.none(),
    }),

  recordNotFound: (recordId: PreferenceRecordId): ViewModePreferencesRepositoryError =>
    Data.tagged('RecordNotFound', { recordId }),

  invalidPreference: (field: string, value: unknown, reason: string): ViewModePreferencesRepositoryError =>
    Data.tagged('InvalidPreference', { field, value, reason }),

  duplicateRecord: (playerId: PlayerId, timestamp: number): ViewModePreferencesRepositoryError =>
    Data.tagged('DuplicateRecord', { playerId, timestamp }),

  analyticsCalculationFailed: (playerId: PlayerId, reason: string): ViewModePreferencesRepositoryError =>
    Data.tagged('AnalyticsCalculationFailed', { playerId, reason }),

  popularityDataUnavailable: (context: Option<GameContext>, reason: string): ViewModePreferencesRepositoryError =>
    Data.tagged('PopularityDataUnavailable', { context, reason }),

  storageError: (message: string, cause?: unknown): ViewModePreferencesRepositoryError =>
    Data.tagged('StorageError', {
      message,
      cause: cause ? Option.some(cause) : Option.none(),
    }),

  encodingFailed: (dataType: string, reason: string): ViewModePreferencesRepositoryError =>
    Data.tagged('EncodingFailed', { dataType, reason }),

  decodingFailed: (dataType: string, reason: string): ViewModePreferencesRepositoryError =>
    Data.tagged('DecodingFailed', { dataType, reason }),

  concurrencyError: (operation: string, conflictingPlayer?: PlayerId): ViewModePreferencesRepositoryError =>
    Data.tagged('ConcurrencyError', {
      operation,
      conflictingPlayer: conflictingPlayer ? Option.some(conflictingPlayer) : Option.none(),
    }),
} as const

/**
 * Default Preferences Factory
 */
export const createDefaultPreferences = {
  /**
   * デフォルトのViewMode設定を作成
   */
  viewModePreference: (playerId: PlayerId): Effect.Effect<ViewModePreference> =>
    Effect.gen(function* () {
      const lastModified = yield* Clock.currentTimeMillis
      return {
        defaultMode: 'first-person' as ViewMode,
        contextualModes: new Map([
          [Data.tagged('Exploration', {}), 'first-person' as ViewMode],
          [Data.tagged('Combat', {}), 'first-person' as ViewMode],
          [Data.tagged('Building', {}), 'third-person' as ViewMode],
          [Data.tagged('Flying', {}), 'third-person' as ViewMode],
          [Data.tagged('Spectating', {}), 'spectator' as ViewMode],
          [Data.tagged('Cinematic', {}), 'cinematic' as ViewMode],
        ]),
        autoSwitchEnabled: true,
        transitionAnimationEnabled: true,
        quickSwitchBinding: Option.some({
          key: 'F',
          modifiers: [],
          action: 'toggle-view-mode',
          description: 'Quick view mode toggle',
        } as KeyBinding),
        smartSwitchEnabled: true,
        contextSensitivity: 0.7,
        lastModified,
        version: 1,
      } as ViewModePreference
    }),

  /**
   * ViewMode使用記録を作成
   */
  preferenceRecord: (
    playerId: PlayerId,
    viewMode: ViewMode,
    context: GameContext,
    duration: number
  ): Effect.Effect<ViewModePreferenceRecord> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      const randomId = yield* Effect.sync(() => Math.random().toString(36).slice(2, 11))
      return {
        id: `pref_${timestamp}_${randomId}` as PreferenceRecordId,
        playerId,
        viewMode,
        context,
        timestamp,
        duration,
        triggeredBy: Data.tagged('Manual', { inputMethod: 'keyboard' }),
        sessionId: `session_${timestamp}`,
        satisfactionScore: Option.none(),
      } as ViewModePreferenceRecord
    }),

  /**
   * 時間範囲を作成
   */
  timeRange: (startTime: number, endTime: number): TimeRange =>
    ({
      startTime,
      endTime,
    }) as TimeRange,

  /**
   * デフォルトクエリオプションを作成
   */
  defaultQueryOptions: (): PreferenceQueryOptions =>
    ({
      filterByContext: Option.none(),
      filterByViewMode: Option.none(),
      timeRange: Option.none(),
      includeSatisfactionData: true,
      sortBy: Data.tagged('Timestamp', { ascending: false }),
      limit: Option.some(100),
    }) as PreferenceQueryOptions,
} as const

// ========================================
// Type Guards
// ========================================

/**
 * View Mode Preferences Repository Error Type Guards
 */
export const isPreferenceNotFoundError = (error: ViewModePreferencesRepositoryError): boolean =>
  error._tag === 'PreferenceNotFound'

export const isRecordNotFoundError = (error: ViewModePreferencesRepositoryError): boolean =>
  error._tag === 'RecordNotFound'

export const isInvalidPreferenceError = (error: ViewModePreferencesRepositoryError): boolean =>
  error._tag === 'InvalidPreference'

export const isAnalyticsCalculationFailedError = (error: ViewModePreferencesRepositoryError): boolean =>
  error._tag === 'AnalyticsCalculationFailed'

export const isStorageError = (error: ViewModePreferencesRepositoryError): boolean => error._tag === 'StorageError'

export const isConcurrencyError = (error: ViewModePreferencesRepositoryError): boolean =>
  error._tag === 'ConcurrencyError'

/**
 * Game Context Guards
 */
export const isExplorationContext = (context: GameContext): boolean => context._tag === 'Exploration'

export const isCombatContext = (context: GameContext): boolean => context._tag === 'Combat'

export const isBuildingContext = (context: GameContext): boolean => context._tag === 'Building'

export const isCinematicContext = (context: GameContext): boolean => context._tag === 'Cinematic'

/**
 * Trigger Guards
 */
export const isManualTrigger = (trigger: PreferenceTrigger): boolean => trigger._tag === 'Manual'

export const isAutomaticTrigger = (trigger: PreferenceTrigger): boolean => trigger._tag === 'Automatic'

export const isSystemTrigger = (trigger: PreferenceTrigger): boolean => trigger._tag === 'System'
