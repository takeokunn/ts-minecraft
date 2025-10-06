import type { AnimationState, CameraId, Position3D, ViewMode } from '@domain/camera/types'
import { Array, Brand, Data, Option, Schema } from 'effect'

// ========================================
// Camera Mode Manager Application Types
// ========================================

/**
 * ビューモード遷移設定
 */
export type ViewModeTransitionConfig = Brand.Brand<
  {
    readonly duration: number
    readonly easing: EasingFunction
    readonly animationType: AnimationType
    readonly preservePosition: boolean
    readonly preserveRotation: boolean
    readonly preserveTargets: boolean
    readonly interpolationSteps: number
    readonly customParameters: Option<Record<string, unknown>>
  },
  'ViewModeTransitionConfig'
>

/**
 * イージング関数
 */
export type EasingFunction = Data.TaggedEnum<{
  Linear: {}
  EaseIn: {}
  EaseOut: {}
  EaseInOut: {}
  Bounce: {}
  Elastic: { readonly amplitude: number; readonly period: number }
  Back: { readonly overshoot: number }
  Custom: { readonly controlPoints: Array.ReadonlyArray<number> }
}>

/**
 * アニメーション種類
 */
export type AnimationType = Data.TaggedEnum<{
  Instant: {}
  Smooth: {}
  Cinematic: {}
  Bounce: {}
  Fade: { readonly fadeColor: string }
  Zoom: { readonly zoomFactor: number }
  Slide: { readonly direction: SlideDirection }
  Morph: { readonly morphSteps: number }
}>

/**
 * スライド方向
 */
export type SlideDirection = Data.TaggedEnum<{
  Left: {}
  Right: {}
  Up: {}
  Down: {}
  Forward: {}
  Backward: {}
}>

/**
 * ビューモード遷移結果
 */
export type ViewModeTransitionResult = Data.TaggedEnum<{
  Success: {
    readonly fromMode: ViewMode
    readonly toMode: ViewMode
    readonly duration: number
    readonly animated: boolean
    readonly transitionId: TransitionId
  }
  Failed: {
    readonly reason: ViewModeTransitionFailureReason
    readonly fromMode: ViewMode
    readonly targetMode: ViewMode
    readonly errorDetails: Option<string>
  }
  InProgress: {
    readonly fromMode: ViewMode
    readonly toMode: ViewMode
    readonly progress: number
    readonly estimatedRemaining: number
    readonly transitionId: TransitionId
  }
  Cancelled: {
    readonly fromMode: ViewMode
    readonly targetMode: ViewMode
    readonly reason: string
    readonly progress: number
  }
}>

/**
 * 遷移ID
 */
export type TransitionId = Brand.Brand<string, 'TransitionId'>

/**
 * ビューモード遷移失敗理由
 */
export type ViewModeTransitionFailureReason = Data.TaggedEnum<{
  ModeNotSupported: { readonly mode: ViewMode }
  AnimationInProgress: { readonly currentAnimation: AnimationState }
  InvalidConfiguration: { readonly config: ViewModeTransitionConfig }
  ResourceUnavailable: { readonly resource: string }
  PermissionDenied: { readonly requiredPermission: string }
  SystemBusy: { readonly activeOperations: number }
  NetworkError: { readonly networkDetails: string }
  TimeoutExceeded: { readonly timeoutMs: number }
}>

/**
 * カメラモード切り替え操作
 */
export type CameraModeSwitchOperation = Brand.Brand<
  {
    readonly cameraId: CameraId
    readonly targetMode: ViewMode
    readonly transitionConfig: ViewModeTransitionConfig
    readonly priority: OperationPriority
    readonly scheduledTime: Option<number>
    readonly dependencies: Array.ReadonlyArray<CameraId>
    readonly rollbackConfig: Option<RollbackConfig>
  },
  'CameraModeSwitchOperation'
>

/**
 * 操作優先度
 */
export type OperationPriority = Data.TaggedEnum<{
  Low: {}
  Normal: {}
  High: {}
  Critical: {}
  Emergency: {}
}>

/**
 * ロールバック設定
 */
export type RollbackConfig = Brand.Brand<
  {
    readonly enabled: boolean
    readonly timeoutMs: number
    readonly fallbackMode: ViewMode
    readonly preserveOriginalState: boolean
  },
  'RollbackConfig'
>

/**
 * スケジュールID
 */
export type ScheduleId = Brand.Brand<string, 'ScheduleId'>

/**
 * ビューモードコンテキスト
 */
export type ViewModeContext = Brand.Brand<
  {
    readonly currentGameMode: GameMode
    readonly playerState: PlayerContextState
    readonly environmentFactors: EnvironmentFactors
    readonly performanceConstraints: PerformanceConstraints
    readonly userPreferences: UserPreferences
    readonly systemCapabilities: SystemCapabilities
  },
  'ViewModeContext'
>

/**
 * ゲームモード
 */
export type GameMode = Data.TaggedEnum<{
  Survival: {}
  Creative: {}
  Adventure: {}
  Spectator: {}
  Hardcore: {}
  Custom: { readonly modeName: string }
}>

/**
 * プレイヤーコンテキスト状態
 */
export type PlayerContextState = Brand.Brand<
  {
    readonly position: Position3D
    readonly velocity: Option<{ readonly x: number; readonly y: number; readonly z: number }>
    readonly isMoving: boolean
    readonly isCombat: boolean
    readonly isBuilding: boolean
    readonly isFlying: boolean
    readonly health: number
    readonly alertLevel: AlertLevel
  },
  'PlayerContextState'
>

/**
 * 警戒レベル
 */
export type AlertLevel = Data.TaggedEnum<{
  Relaxed: {}
  Normal: {}
  Cautious: {}
  Alert: {}
  Combat: {}
}>

/**
 * 環境要因
 */
export type EnvironmentFactors = Brand.Brand<
  {
    readonly biome: string
    readonly weather: WeatherCondition
    readonly timeOfDay: TimeOfDay
    readonly lightLevel: number
    readonly dangerLevel: DangerLevel
    readonly visibilityConditions: VisibilityConditions
  },
  'EnvironmentFactors'
>

/**
 * 天候状態
 */
export type WeatherCondition = Data.TaggedEnum<{
  Clear: {}
  Rain: { readonly intensity: number }
  Storm: { readonly intensity: number; readonly hasLightning: boolean }
  Snow: { readonly intensity: number }
  Fog: { readonly density: number }
}>

/**
 * 時間帯
 */
export type TimeOfDay = Data.TaggedEnum<{
  Dawn: {}
  Morning: {}
  Noon: {}
  Afternoon: {}
  Dusk: {}
  Night: {}
  Midnight: {}
}>

/**
 * 危険レベル
 */
export type DangerLevel = Data.TaggedEnum<{
  Safe: {}
  Low: {}
  Medium: {}
  High: {}
  Extreme: {}
}>

/**
 * 視界条件
 */
export type VisibilityConditions = Brand.Brand<
  {
    readonly fogDensity: number
    readonly lightCondition: LightCondition
    readonly obstructions: Array.ReadonlyArray<string>
    readonly renderDistance: number
  },
  'VisibilityConditions'
>

/**
 * 光条件
 */
export type LightCondition = Data.TaggedEnum<{
  Bright: {}
  Normal: {}
  Dim: {}
  Dark: {}
  Underground: {}
}>

/**
 * パフォーマンス制約
 */
export type PerformanceConstraints = Brand.Brand<
  {
    readonly maxFPS: number
    readonly targetFPS: number
    readonly memoryLimitMB: number
    readonly cpuBudgetPercent: number
    readonly gpuBudgetPercent: number
    readonly networkBandwidthKbps: Option<number>
  },
  'PerformanceConstraints'
>

/**
 * ユーザー設定
 */
export type UserPreferences = Brand.Brand<
  {
    readonly preferredModes: Array.ReadonlyArray<ViewMode>
    readonly automaticSwitching: boolean
    readonly animationPreference: AnimationPreference
    readonly accessibilityOptions: AccessibilityOptions
    readonly customKeybindings: Record<string, string>
  },
  'UserPreferences'
>

/**
 * アニメーション設定
 */
export type AnimationPreference = Data.TaggedEnum<{
  None: {}
  Minimal: {}
  Normal: {}
  Enhanced: {}
  Cinematic: {}
}>

/**
 * アクセシビリティオプション
 */
export type AccessibilityOptions = Brand.Brand<
  {
    readonly reduceMotion: boolean
    readonly highContrast: boolean
    readonly largeText: boolean
    readonly colorBlindSupport: boolean
    readonly soundEnhancement: boolean
  },
  'AccessibilityOptions'
>

/**
 * システム機能
 */
export type SystemCapabilities = Brand.Brand<
  {
    readonly supportedModes: Array.ReadonlyArray<ViewMode>
    readonly maxConcurrentAnimations: number
    readonly gpuAcceleration: boolean
    readonly advancedShaders: boolean
    readonly vrSupport: boolean
    readonly multiDisplaySupport: boolean
  },
  'SystemCapabilities'
>

/**
 * ビューモード推奨結果
 */
export type ViewModeRecommendation = Brand.Brand<
  {
    readonly recommendedMode: ViewMode
    readonly confidence: number
    readonly reasoning: Array.ReadonlyArray<RecommendationReason>
    readonly alternativeModes: Array.ReadonlyArray<ViewMode>
    readonly contextFactors: ViewModeContext
    readonly timeToSwitch: Option<number>
  },
  'ViewModeRecommendation'
>

/**
 * 推奨理由
 */
export type RecommendationReason = Data.TaggedEnum<{
  GameplayOptimal: { readonly description: string }
  PerformanceBeneficial: { readonly improvementEstimate: number }
  UserPreference: { readonly preferenceSource: string }
  EnvironmentalSuitable: { readonly environmentalFactor: string }
  SafetyEnhanced: { readonly safetyAspect: string }
  AccessibilityImproved: { readonly accessibilityFeature: string }
}>

/**
 * ゲームコンテキスト
 */
export type GameContext = Brand.Brand<
  {
    readonly worldType: WorldType
    readonly gamePhase: GamePhase
    readonly multiplayerInfo: Option<MultiplayerInfo>
    readonly modInfo: Option<ModInfo>
    readonly difficulty: DifficultyLevel
  },
  'GameContext'
>

/**
 * ワールドタイプ
 */
export type WorldType = Data.TaggedEnum<{
  Normal: {}
  Flat: {}
  Amplified: {}
  LargeBiomes: {}
  Custom: { readonly generatorSettings: string }
}>

/**
 * ゲームフェーズ
 */
export type GamePhase = Data.TaggedEnum<{
  Loading: {}
  MainMenu: {}
  WorldSelection: {}
  InGame: {}
  Paused: {}
  Inventory: {}
  Menu: {}
  Cutscene: {}
}>

/**
 * マルチプレイヤー情報
 */
export type MultiplayerInfo = Brand.Brand<
  {
    readonly isMultiplayer: boolean
    readonly playerCount: number
    readonly serverType: ServerType
    readonly networkLatency: number
  },
  'MultiplayerInfo'
>

/**
 * サーバータイプ
 */
export type ServerType = Data.TaggedEnum<{
  Local: {}
  LAN: {}
  Dedicated: {}
  Realm: {}
  Modded: { readonly modCount: number }
}>

/**
 * Mod情報
 */
export type ModInfo = Brand.Brand<
  {
    readonly hasGraphicsMods: boolean
    readonly hasCameraMods: boolean
    readonly hasPerformanceMods: boolean
    readonly modCount: number
    readonly conflictingMods: Array.ReadonlyArray<string>
  },
  'ModInfo'
>

/**
 * 難易度レベル
 */
export type DifficultyLevel = Data.TaggedEnum<{
  Peaceful: {}
  Easy: {}
  Normal: {}
  Hard: {}
  Custom: { readonly customSettings: Record<string, unknown> }
}>

/**
 * プレイヤー設定
 */
export type PlayerPreferences = Brand.Brand<
  {
    readonly preferredViewModes: Array.ReadonlyArray<ViewMode>
    readonly transitionSpeed: TransitionSpeed
    readonly motionSickness: MotionSicknessLevel
    readonly fieldOfViewPreference: number
    readonly mouseSensitivity: number
    readonly keyboardShortcuts: Record<string, string>
  },
  'PlayerPreferences'
>

/**
 * 遷移速度
 */
export type TransitionSpeed = Data.TaggedEnum<{
  Slow: {}
  Normal: {}
  Fast: {}
  Instant: {}
  Custom: { readonly durationMs: number }
}>

/**
 * 酔い気味レベル
 */
export type MotionSicknessLevel = Data.TaggedEnum<{
  None: {}
  Low: {}
  Medium: {}
  High: {}
  Severe: {}
}>

// ========================================
// Camera Mode Manager Application Error Types
// ========================================

/**
 * カメラモードマネージャーApplication Service専用エラー
 */
export type CameraModeManagerApplicationError = Data.TaggedEnum<{
  ModeTransitionFailed: {
    readonly cameraId: CameraId
    readonly fromMode: ViewMode
    readonly toMode: ViewMode
    readonly reason: ViewModeTransitionFailureReason
  }
  InvalidModeConfiguration: {
    readonly mode: ViewMode
    readonly configurationErrors: Array.ReadonlyArray<string>
  }
  ConcurrentTransitionConflict: {
    readonly cameraId: CameraId
    readonly activeTransition: TransitionId
    readonly requestedTransition: ViewModeTransitionConfig
  }
  SchedulingConflict: {
    readonly scheduleId: ScheduleId
    readonly conflictingScheduleId: ScheduleId
    readonly scheduledTime: number
  }
  ContextResolutionFailed: {
    readonly context: ViewModeContext
    readonly missingFactors: Array.ReadonlyArray<string>
  }
  RecommendationSystemUnavailable: {
    readonly systemStatus: string
    readonly estimatedRestoreTime: Option<number>
  }
  PerformanceConstraintViolated: {
    readonly constraint: string
    readonly current: number
    readonly limit: number
  }
  UnsupportedModeCombo: {
    readonly modes: Array.ReadonlyArray<ViewMode>
    readonly reason: string
  }
}>

// ========================================
// Schema Definitions
// ========================================

export const TransitionIdSchema = Schema.String.pipe(Schema.fromBrand(Brand.nominal<TransitionId>()))
export const ScheduleIdSchema = Schema.String.pipe(Schema.fromBrand(Brand.nominal<ScheduleId>()))

export const EasingFunctionSchema = Schema.Union(
  Schema.TaggedStruct('Linear', {}),
  Schema.TaggedStruct('EaseIn', {}),
  Schema.TaggedStruct('EaseOut', {}),
  Schema.TaggedStruct('EaseInOut', {}),
  Schema.TaggedStruct('Bounce', {}),
  Schema.TaggedStruct('Elastic', {
    amplitude: Schema.Number.pipe(Schema.positive()),
    period: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.TaggedStruct('Back', {
    overshoot: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.TaggedStruct('Custom', {
    controlPoints: Schema.Array(Schema.Number.pipe(Schema.between(0, 1))),
  })
)

export const AnimationTypeSchema = Schema.Union(
  Schema.TaggedStruct('Instant', {}),
  Schema.TaggedStruct('Smooth', {}),
  Schema.TaggedStruct('Cinematic', {}),
  Schema.TaggedStruct('Bounce', {}),
  Schema.TaggedStruct('Fade', {
    fadeColor: Schema.String,
  }),
  Schema.TaggedStruct('Zoom', {
    zoomFactor: Schema.Number.pipe(Schema.positive()),
  }),
  Schema.TaggedStruct('Slide', {
    direction: Schema.Union(
      Schema.TaggedStruct('Left', {}),
      Schema.TaggedStruct('Right', {}),
      Schema.TaggedStruct('Up', {}),
      Schema.TaggedStruct('Down', {}),
      Schema.TaggedStruct('Forward', {}),
      Schema.TaggedStruct('Backward', {})
    ),
  }),
  Schema.TaggedStruct('Morph', {
    morphSteps: Schema.Number.pipe(Schema.int(), Schema.positive()),
  })
)

export const ViewModeTransitionConfigSchema = Schema.Struct({
  duration: Schema.Number.pipe(Schema.positive()),
  easing: EasingFunctionSchema,
  animationType: AnimationTypeSchema,
  preservePosition: Schema.Boolean,
  preserveRotation: Schema.Boolean,
  preserveTargets: Schema.Boolean,
  interpolationSteps: Schema.Number.pipe(Schema.int(), Schema.positive()),
  customParameters: Schema.OptionFromSelf(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}).pipe(Schema.fromBrand(Brand.nominal<ViewModeTransitionConfig>()))

export const ViewModeTransitionResultSchema = Schema.Union(
  Schema.TaggedStruct('Success', {
    fromMode: Schema.Unknown, // ViewModeSchemaを参照
    toMode: Schema.Unknown, // ViewModeSchemaを参照
    duration: Schema.Number.pipe(Schema.positive()),
    animated: Schema.Boolean,
    transitionId: TransitionIdSchema,
  }),
  Schema.TaggedStruct('Failed', {
    reason: Schema.Union(
      Schema.TaggedStruct('ModeNotSupported', {
        mode: Schema.Unknown, // ViewModeSchemaを参照
      }),
      Schema.TaggedStruct('AnimationInProgress', {
        currentAnimation: Schema.Unknown, // AnimationStateSchemaを参照
      }),
      Schema.TaggedStruct('InvalidConfiguration', {
        config: ViewModeTransitionConfigSchema,
      }),
      Schema.TaggedStruct('ResourceUnavailable', {
        resource: Schema.String,
      }),
      Schema.TaggedStruct('PermissionDenied', {
        requiredPermission: Schema.String,
      }),
      Schema.TaggedStruct('SystemBusy', {
        activeOperations: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
      }),
      Schema.TaggedStruct('NetworkError', {
        networkDetails: Schema.String,
      }),
      Schema.TaggedStruct('TimeoutExceeded', {
        timeoutMs: Schema.Number.pipe(Schema.positive()),
      })
    ),
    fromMode: Schema.Unknown, // ViewModeSchemaを参照
    targetMode: Schema.Unknown, // ViewModeSchemaを参照
    errorDetails: Schema.OptionFromSelf(Schema.String),
  }),
  Schema.TaggedStruct('InProgress', {
    fromMode: Schema.Unknown, // ViewModeSchemaを参照
    toMode: Schema.Unknown, // ViewModeSchemaを参照
    progress: Schema.Number.pipe(Schema.between(0, 1)),
    estimatedRemaining: Schema.Number.pipe(Schema.positive()),
    transitionId: TransitionIdSchema,
  }),
  Schema.TaggedStruct('Cancelled', {
    fromMode: Schema.Unknown, // ViewModeSchemaを参照
    targetMode: Schema.Unknown, // ViewModeSchemaを参照
    reason: Schema.String,
    progress: Schema.Number.pipe(Schema.between(0, 1)),
  })
)

export const CameraModeManagerApplicationErrorSchema = Schema.Union(
  Schema.TaggedStruct('ModeTransitionFailed', {
    cameraId: Schema.String,
    fromMode: Schema.Unknown, // ViewModeSchemaを参照
    toMode: Schema.Unknown, // ViewModeSchemaを参照
    reason: Schema.Unknown, // ViewModeTransitionFailureReasonSchemaを参照
  }),
  Schema.TaggedStruct('InvalidModeConfiguration', {
    mode: Schema.Unknown, // ViewModeSchemaを参照
    configurationErrors: Schema.Array(Schema.String),
  }),
  Schema.TaggedStruct('ConcurrentTransitionConflict', {
    cameraId: Schema.String,
    activeTransition: TransitionIdSchema,
    requestedTransition: ViewModeTransitionConfigSchema,
  }),
  Schema.TaggedStruct('SchedulingConflict', {
    scheduleId: ScheduleIdSchema,
    conflictingScheduleId: ScheduleIdSchema,
    scheduledTime: Schema.Number,
  }),
  Schema.TaggedStruct('ContextResolutionFailed', {
    context: Schema.Unknown, // ViewModeContextSchemaを参照
    missingFactors: Schema.Array(Schema.String),
  }),
  Schema.TaggedStruct('RecommendationSystemUnavailable', {
    systemStatus: Schema.String,
    estimatedRestoreTime: Schema.OptionFromSelf(Schema.Number),
  }),
  Schema.TaggedStruct('PerformanceConstraintViolated', {
    constraint: Schema.String,
    current: Schema.Number,
    limit: Schema.Number,
  }),
  Schema.TaggedStruct('UnsupportedModeCombo', {
    modes: Schema.Array(Schema.Unknown), // ViewModeSchemaの配列を参照
    reason: Schema.String,
  })
)

// ========================================
// Factory Functions
// ========================================

export const createCameraModeManagerApplicationError = {
  modeTransitionFailed: (
    cameraId: CameraId,
    fromMode: ViewMode,
    toMode: ViewMode,
    reason: ViewModeTransitionFailureReason
  ): CameraModeManagerApplicationError =>
    Data.struct({
      _tag: 'ModeTransitionFailed' as const,
      cameraId,
      fromMode,
      toMode,
      reason,
    }),

  invalidModeConfiguration: (
    mode: ViewMode,
    configurationErrors: Array.ReadonlyArray<string>
  ): CameraModeManagerApplicationError =>
    Data.struct({
      _tag: 'InvalidModeConfiguration' as const,
      mode,
      configurationErrors,
    }),

  concurrentTransitionConflict: (
    cameraId: CameraId,
    activeTransition: TransitionId,
    requestedTransition: ViewModeTransitionConfig
  ): CameraModeManagerApplicationError =>
    Data.struct({
      _tag: 'ConcurrentTransitionConflict' as const,
      cameraId,
      activeTransition,
      requestedTransition,
    }),

  schedulingConflict: (
    scheduleId: ScheduleId,
    conflictingScheduleId: ScheduleId,
    scheduledTime: number
  ): CameraModeManagerApplicationError =>
    Data.struct({
      _tag: 'SchedulingConflict' as const,
      scheduleId,
      conflictingScheduleId,
      scheduledTime,
    }),

  contextResolutionFailed: (
    context: ViewModeContext,
    missingFactors: Array.ReadonlyArray<string>
  ): CameraModeManagerApplicationError =>
    Data.struct({
      _tag: 'ContextResolutionFailed' as const,
      context,
      missingFactors,
    }),

  recommendationSystemUnavailable: (
    systemStatus: string,
    estimatedRestoreTime: Option<number>
  ): CameraModeManagerApplicationError =>
    Data.struct({
      _tag: 'RecommendationSystemUnavailable' as const,
      systemStatus,
      estimatedRestoreTime,
    }),

  performanceConstraintViolated: (
    constraint: string,
    current: number,
    limit: number
  ): CameraModeManagerApplicationError =>
    Data.struct({
      _tag: 'PerformanceConstraintViolated' as const,
      constraint,
      current,
      limit,
    }),

  unsupportedModeCombo: (modes: Array.ReadonlyArray<ViewMode>, reason: string): CameraModeManagerApplicationError =>
    Data.struct({
      _tag: 'UnsupportedModeCombo' as const,
      modes,
      reason,
    }),
}

export const createViewModeTransitionResult = {
  success: (
    fromMode: ViewMode,
    toMode: ViewMode,
    duration: number,
    animated: boolean,
    transitionId: TransitionId
  ): ViewModeTransitionResult =>
    Data.struct({
      _tag: 'Success' as const,
      fromMode,
      toMode,
      duration,
      animated,
      transitionId,
    }),

  failed: (
    reason: ViewModeTransitionFailureReason,
    fromMode: ViewMode,
    targetMode: ViewMode,
    errorDetails: Option<string>
  ): ViewModeTransitionResult =>
    Data.struct({
      _tag: 'Failed' as const,
      reason,
      fromMode,
      targetMode,
      errorDetails,
    }),

  inProgress: (
    fromMode: ViewMode,
    toMode: ViewMode,
    progress: number,
    estimatedRemaining: number,
    transitionId: TransitionId
  ): ViewModeTransitionResult =>
    Data.struct({
      _tag: 'InProgress' as const,
      fromMode,
      toMode,
      progress,
      estimatedRemaining,
      transitionId,
    }),

  cancelled: (fromMode: ViewMode, targetMode: ViewMode, reason: string, progress: number): ViewModeTransitionResult =>
    Data.struct({
      _tag: 'Cancelled' as const,
      fromMode,
      targetMode,
      reason,
      progress,
    }),
}
