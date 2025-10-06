import type {
  AnimationState,
  CameraId,
  CameraRotation,
  CameraSettings,
  MouseDelta,
  PlayerId,
  Position3D,
  ViewMode,
  ViewModeTransitionConfig,
} from '@domain/camera/types'
import { Array, Brand, Clock, Data, Effect, Option, Schema } from 'effect'

// ========================================
// Player Camera Application Types
// ========================================

/**
 * プレイヤーカメラ入力の種類
 */
export type PlayerCameraInput = Data.TaggedEnum<{
  MouseMovement: {
    readonly deltaX: MouseDelta
    readonly deltaY: MouseDelta
    readonly timestamp: number
  }
  KeyboardInput: {
    readonly action: KeyboardAction
    readonly modifiers: Array.ReadonlyArray<KeyModifier>
    readonly timestamp: number
  }
  ViewModeSwitch: {
    readonly targetMode: ViewMode
    readonly preservePosition: boolean
    readonly animationDuration: Option<number>
  }
  SettingsUpdate: {
    readonly settings: Partial<CameraSettings>
    readonly immediate: boolean
  }
}>

/**
 * キーボードアクション
 */
export type KeyboardAction = Data.TaggedEnum<{
  ZoomIn: {}
  ZoomOut: {}
  ResetCamera: {}
  ToggleFreeLook: {}
  CenterView: {}
  CycleCameraMode: {}
}>

/**
 * キー修飾子
 */
export type KeyModifier = Data.TaggedEnum<{
  Shift: {}
  Ctrl: {}
  Alt: {}
  Meta: {}
}>

/**
 * プレイヤーカメラ状態
 */
export type PlayerCameraState = Brand.Brand<
  {
    readonly playerId: PlayerId
    readonly cameraId: CameraId
    readonly position: Position3D
    readonly rotation: CameraRotation
    readonly viewMode: ViewMode
    readonly settings: CameraSettings
    readonly isInitialized: boolean
    readonly lastUpdate: number
    readonly animationState: Option<AnimationState>
  },
  'PlayerCameraState'
>

/**
 * ビューモード遷移結果
 */
export type ViewModeTransitionResult = Data.TaggedEnum<{
  Success: {
    readonly fromMode: ViewMode
    readonly toMode: ViewMode
    readonly duration: number
    readonly animated: boolean
  }
  Failed: {
    readonly reason: ViewModeTransitionFailureReason
    readonly fromMode: ViewMode
    readonly targetMode: ViewMode
  }
  InProgress: {
    readonly fromMode: ViewMode
    readonly toMode: ViewMode
    readonly progress: number
    readonly estimatedRemaining: number
  }
}>

/**
 * ビューモード遷移失敗理由
 */
export type ViewModeTransitionFailureReason = Data.TaggedEnum<{
  ModeNotSupported: { readonly mode: ViewMode }
  AnimationInProgress: { readonly currentAnimation: AnimationState }
  InvalidState: { readonly currentState: PlayerCameraState }
  ConfigurationError: { readonly config: ViewModeTransitionConfig }
  ResourceUnavailable: { readonly resource: string }
}>

/**
 * プレイヤーカメラ設定更新
 */
export type PlayerCameraSettingsUpdate = Brand.Brand<
  {
    readonly fov: Option<number>
    readonly sensitivity: Option<number>
    readonly smoothing: Option<number>
    readonly invertY: Option<boolean>
    readonly autoAdjustDistance: Option<boolean>
    readonly collisionDetection: Option<boolean>
    readonly renderDistance: Option<number>
    readonly qualityLevel: Option<string>
  },
  'PlayerCameraSettingsUpdate'
>

/**
 * プレイヤーカメラ統計情報
 */
export type PlayerCameraStatistics = Brand.Brand<
  {
    readonly totalInputEvents: number
    readonly averageFrameTime: number
    readonly cameraMovements: number
    readonly viewModeChanges: number
    readonly lastUpdateTime: number
    readonly memoryUsage: number
    readonly performanceMetrics: PerformanceMetrics
  },
  'PlayerCameraStatistics'
>

/**
 * パフォーマンスメトリクス
 */
export type PerformanceMetrics = Brand.Brand<
  {
    readonly updateFrequency: number
    readonly renderTime: number
    readonly inputLatency: number
    readonly memoryAllocations: number
    readonly gpuMemoryUsage: number
  },
  'PerformanceMetrics'
>

// ========================================
// Application Error Types
// ========================================

/**
 * カメラApplication Service専用エラー
 */
export type CameraApplicationError = Data.TaggedEnum<{
  CameraNotFound: { readonly cameraId: CameraId }
  PlayerNotFound: { readonly playerId: PlayerId }
  ViewModeSwitchNotAllowed: {
    readonly currentMode: ViewMode
    readonly targetMode: ViewMode
    readonly reason: string
  }
  SystemNotInitialized: {}
  ConcurrentUpdateConflict: {
    readonly cameraId: CameraId
    readonly version: number
    readonly conflictingOperation: string
  }
  PerformanceLimitExceeded: {
    readonly metric: string
    readonly current: number
    readonly limit: number
  }
  InvalidInputFormat: {
    readonly input: unknown
    readonly expectedFormat: string
  }
  ConfigurationValidationFailed: {
    readonly config: unknown
    readonly validationErrors: Array.ReadonlyArray<string>
  }
  ResourceAllocationFailed: {
    readonly resource: string
    readonly availableMemory: number
    readonly requiredMemory: number
  }
}>

// ========================================
// Schema Definitions
// ========================================

export const PlayerCameraInputSchema = Schema.Union(
  Schema.TaggedStruct('MouseMovement', {
    deltaX: Schema.Number,
    deltaY: Schema.Number,
    timestamp: Schema.Number,
  }),
  Schema.TaggedStruct('KeyboardInput', {
    action: Schema.Union(
      Schema.TaggedStruct('ZoomIn', {}),
      Schema.TaggedStruct('ZoomOut', {}),
      Schema.TaggedStruct('ResetCamera', {}),
      Schema.TaggedStruct('ToggleFreeLook', {}),
      Schema.TaggedStruct('CenterView', {}),
      Schema.TaggedStruct('CycleCameraMode', {})
    ),
    modifiers: Schema.Array(
      Schema.Union(
        Schema.TaggedStruct('Shift', {}),
        Schema.TaggedStruct('Ctrl', {}),
        Schema.TaggedStruct('Alt', {}),
        Schema.TaggedStruct('Meta', {})
      )
    ),
    timestamp: Schema.Number,
  }),
  Schema.TaggedStruct('ViewModeSwitch', {
    targetMode: Schema.Unknown, // ViewModeSchemaを参照
    preservePosition: Schema.Boolean,
    animationDuration: Schema.OptionFromSelf(Schema.Number),
  }),
  Schema.TaggedStruct('SettingsUpdate', {
    settings: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    immediate: Schema.Boolean,
  })
)

export const PlayerCameraStateSchema = Schema.Struct({
  playerId: Schema.String,
  cameraId: Schema.String,
  position: Schema.Unknown, // Position3DSchemaを参照
  rotation: Schema.Unknown, // CameraRotationSchemaを参照
  viewMode: Schema.Unknown, // ViewModeSchemaを参照
  settings: Schema.Unknown, // CameraSettingsSchemaを参照
  isInitialized: Schema.Boolean,
  lastUpdate: Schema.Number,
  animationState: Schema.OptionFromSelf(Schema.Unknown), // AnimationStateSchemaを参照
}).pipe(Schema.fromBrand(Brand.nominal<PlayerCameraState>()))

export const export const ViewModeTransitionResultSchema = Schema.Union(
  Schema.TaggedStruct('Success', {
    fromMode: Schema.Unknown, // ViewModeSchemaを参照
    toMode: Schema.Unknown, // ViewModeSchemaを参照
    duration: Schema.Number,
    animated: Schema.Boolean,
  }),
  Schema.TaggedStruct('Failed', {
    reason: Schema.Union(
      Schema.TaggedStruct('ModeNotSupported', {
        mode: Schema.Unknown, // ViewModeSchemaを参照
      }),
      Schema.TaggedStruct('AnimationInProgress', {
        currentAnimation: Schema.Unknown, // AnimationStateSchemaを参照
      }),
      Schema.TaggedStruct('InvalidState', {
        currentState: PlayerCameraStateSchema,
      }),
      Schema.TaggedStruct('ConfigurationError', {
        config: Schema.Unknown, // ViewModeTransitionConfigSchemaを参照
      }),
      Schema.TaggedStruct('ResourceUnavailable', {
        resource: Schema.String,
      })
    ),
    fromMode: Schema.Unknown, // ViewModeSchemaを参照
    targetMode: Schema.Unknown, // ViewModeSchemaを参照
  }),
  Schema.TaggedStruct('InProgress', {
    fromMode: Schema.Unknown, // ViewModeSchemaを参照
    toMode: Schema.Unknown, // ViewModeSchemaを参照
    progress: Schema.Number.pipe(Schema.between(0, 1)),
    estimatedRemaining: Schema.Number.pipe(Schema.positive()),
  })
)

export const export const CameraApplicationErrorSchema = Schema.Union(
  Schema.TaggedStruct('CameraNotFound', {
    cameraId: Schema.String,
  }),
  Schema.TaggedStruct('PlayerNotFound', {
    playerId: Schema.String,
  }),
  Schema.TaggedStruct('ViewModeSwitchNotAllowed', {
    currentMode: Schema.Unknown, // ViewModeSchemaを参照
    targetMode: Schema.Unknown, // ViewModeSchemaを参照
    reason: Schema.String,
  }),
  Schema.TaggedStruct('SystemNotInitialized', {}),
  Schema.TaggedStruct('ConcurrentUpdateConflict', {
    cameraId: Schema.String,
    version: Schema.Number,
    conflictingOperation: Schema.String,
  }),
  Schema.TaggedStruct('PerformanceLimitExceeded', {
    metric: Schema.String,
    current: Schema.Number,
    limit: Schema.Number,
  }),
  Schema.TaggedStruct('InvalidInputFormat', {
    input: Schema.Unknown,
    expectedFormat: Schema.String,
  }),
  Schema.TaggedStruct('ConfigurationValidationFailed', {
    config: Schema.Unknown,
    validationErrors: Schema.Array(Schema.String),
  }),
  Schema.TaggedStruct('ResourceAllocationFailed', {
    resource: Schema.String,
    availableMemory: Schema.Number,
    requiredMemory: Schema.Number,
  })
)

// ========================================
// Factory Functions
// ========================================

export const createPlayerCameraInput = {
  mouseMovement: (deltaX: MouseDelta, deltaY: MouseDelta): Effect.Effect<PlayerCameraInput> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'MouseMovement' as const,
        deltaX,
        deltaY,
        timestamp,
      })
    }),

  keyboardInput: (
    action: KeyboardAction,
    modifiers: Array.ReadonlyArray<KeyModifier> = []
  ): Effect.Effect<PlayerCameraInput> =>
    Effect.gen(function* () {
      const timestamp = yield* Clock.currentTimeMillis
      return Data.struct({
        _tag: 'KeyboardInput' as const,
        action,
        modifiers,
        timestamp,
      })
    }),

  viewModeSwitch: (
    targetMode: ViewMode,
    preservePosition = true,
    animationDuration: Option<number> = Option.none()
  ): PlayerCameraInput =>
    Data.struct({
      _tag: 'ViewModeSwitch' as const,
      targetMode,
      preservePosition,
      animationDuration,
    }),

  settingsUpdate: (settings: Partial<CameraSettings>, immediate = false): PlayerCameraInput =>
    Data.struct({
      _tag: 'SettingsUpdate' as const,
      settings,
      immediate,
    }),
}

export const createCameraApplicationError = {
  cameraNotFound: (cameraId: CameraId): CameraApplicationError =>
    Data.struct({
      _tag: 'CameraNotFound' as const,
      cameraId,
    }),

  playerNotFound: (playerId: PlayerId): CameraApplicationError =>
    Data.struct({
      _tag: 'PlayerNotFound' as const,
      playerId,
    }),

  viewModeSwitchNotAllowed: (currentMode: ViewMode, targetMode: ViewMode, reason: string): CameraApplicationError =>
    Data.struct({
      _tag: 'ViewModeSwitchNotAllowed' as const,
      currentMode,
      targetMode,
      reason,
    }),

  systemNotInitialized: (): CameraApplicationError =>
    Data.struct({
      _tag: 'SystemNotInitialized' as const,
    }),

  concurrentUpdateConflict: (
    cameraId: CameraId,
    version: number,
    conflictingOperation: string
  ): CameraApplicationError =>
    Data.struct({
      _tag: 'ConcurrentUpdateConflict' as const,
      cameraId,
      version,
      conflictingOperation,
    }),

  performanceLimitExceeded: (metric: string, current: number, limit: number): CameraApplicationError =>
    Data.struct({
      _tag: 'PerformanceLimitExceeded' as const,
      metric,
      current,
      limit,
    }),

  invalidInputFormat: (input: unknown, expectedFormat: string): CameraApplicationError =>
    Data.struct({
      _tag: 'InvalidInputFormat' as const,
      input,
      expectedFormat,
    }),

  configurationValidationFailed: (
    config: unknown,
    validationErrors: Array.ReadonlyArray<string>
  ): CameraApplicationError =>
    Data.struct({
      _tag: 'ConfigurationValidationFailed' as const,
      config,
      validationErrors,
    }),

  resourceAllocationFailed: (
    resource: string,
    availableMemory: number,
    requiredMemory: number
  ): CameraApplicationError =>
    Data.struct({
      _tag: 'ResourceAllocationFailed' as const,
      resource,
      availableMemory,
      requiredMemory,
    }),
}

export const createViewModeTransitionResult = {
  success: (fromMode: ViewMode, toMode: ViewMode, duration: number, animated = true): ViewModeTransitionResult =>
    Data.struct({
      _tag: 'Success' as const,
      fromMode,
      toMode,
      duration,
      animated,
    }),

  failed: (
    reason: ViewModeTransitionFailureReason,
    fromMode: ViewMode,
    targetMode: ViewMode
  ): ViewModeTransitionResult =>
    Data.struct({
      _tag: 'Failed' as const,
      reason,
      fromMode,
      targetMode,
    }),

  inProgress: (
    fromMode: ViewMode,
    toMode: ViewMode,
    progress: number,
    estimatedRemaining: number
  ): ViewModeTransitionResult =>
    Data.struct({
      _tag: 'InProgress' as const,
      fromMode,
      toMode,
      progress,
      estimatedRemaining,
    }),
}
