import { Schema } from '@effect/schema'
import { Array, Brand, Data, Option } from 'effect'
import type {
  AnimationState,
  CameraRotation,
  CameraSettings,
  EntityId,
  PlayerId,
  Position3D,
} from '../../types/index.js'

// ========================================
// Scene Camera Application Types
// ========================================

/**
 * シーンID
 */
export type SceneId = Brand.Brand<string, 'SceneId'>

/**
 * シーンカメラID
 */
export type SceneCameraId = Brand.Brand<string, 'SceneCameraId'>

/**
 * シーケンスID
 */
export type SequenceId = Brand.Brand<string, 'SequenceId'>

/**
 * スケジュールID
 */
export type ScheduleId = Brand.Brand<string, 'ScheduleId'>

/**
 * シーンカメラセットアップ
 */
export type SceneCameraSetup = Brand.Brand<
  {
    readonly initialPosition: Position3D
    readonly initialRotation: CameraRotation
    readonly followMode: FollowMode
    readonly cinematicSettings: CinematicSettings
    readonly targets: Array.ReadonlyArray<SceneTarget>
    readonly constraints: CameraConstraints
    readonly priority: CameraPriority
  },
  'SceneCameraSetup'
>

/**
 * フォローモード
 */
export type FollowMode = Data.TaggedEnum<{
  Static: {}
  FollowTarget: {
    readonly target: SceneTarget
    readonly smoothing: number
    readonly maxDistance: number
  }
  Orbit: {
    readonly center: Position3D
    readonly radius: number
    readonly speed: number
    readonly direction: OrbitDirection
  }
  Path: {
    readonly waypoints: Array.ReadonlyArray<Position3D>
    readonly speed: number
    readonly looping: boolean
  }
  LookAt: {
    readonly target: SceneTarget
    readonly distance: number
    readonly angle: number
  }
}>

/**
 * 軌道方向
 */
export type OrbitDirection = Data.TaggedEnum<{
  Clockwise: {}
  CounterClockwise: {}
  PingPong: {}
}>

/**
 * シーンターゲット
 */
export type SceneTarget = Data.TaggedEnum<{
  StaticPosition: {
    readonly position: Position3D
    readonly weight: number
  }
  DynamicEntity: {
    readonly entityId: EntityId
    readonly offset: Position3D
    readonly weight: number
  }
  Player: {
    readonly playerId: PlayerId
    readonly offset: Position3D
    readonly weight: number
  }
  CustomTracker: {
    readonly trackerId: string
    readonly weight: number
    readonly updateCallback: (deltaTime: number) => Position3D
  }
  Group: {
    readonly targets: Array.ReadonlyArray<SceneTarget>
    readonly centeringMode: CenteringMode
    readonly weight: number
  }
}>

/**
 * 中心化モード
 */
export type CenteringMode = Data.TaggedEnum<{
  Arithmetic: {} // 算術平均
  Weighted: {} // 重み付き平均
  Closest: {} // 最近点
  Bounds: {} // 境界ボックス中心
}>

/**
 * カメラ制約
 */
export type CameraConstraints = Brand.Brand<
  {
    readonly minDistance: number
    readonly maxDistance: number
    readonly minHeight: number
    readonly maxHeight: number
    readonly boundingBox: Option<BoundingBox>
    readonly avoidCollisions: boolean
    readonly respectWorldBounds: boolean
  },
  'CameraConstraints'
>

/**
 * 境界ボックス
 */
export type BoundingBox = Brand.Brand<
  {
    readonly min: Position3D
    readonly max: Position3D
  },
  'BoundingBox'
>

/**
 * カメラ優先度
 */
export type CameraPriority = Data.TaggedEnum<{
  Low: {}
  Normal: {}
  High: {}
  Critical: {}
}>

/**
 * シネマティック設定
 */
export type CinematicSettings = Brand.Brand<
  {
    readonly enableMotionBlur: boolean
    readonly enableDepthOfField: boolean
    readonly enableFilmicEffects: boolean
    readonly fieldOfView: number
    readonly aspectRatio: number
    readonly nearPlane: number
    readonly farPlane: number
    readonly exposureSettings: ExposureSettings
    readonly colorGrading: ColorGradingSettings
  },
  'CinematicSettings'
>

/**
 * 露出設定
 */
export type ExposureSettings = Brand.Brand<
  {
    readonly autoExposure: boolean
    readonly minLuminance: number
    readonly maxLuminance: number
    readonly adaptationSpeed: number
  },
  'ExposureSettings'
>

/**
 * カラーグレーディング設定
 */
export type ColorGradingSettings = Brand.Brand<
  {
    readonly contrast: number
    readonly brightness: number
    readonly saturation: number
    readonly temperature: number
    readonly tint: number
  },
  'ColorGradingSettings'
>

/**
 * シネマティックシーケンス
 */
export type CinematicSequence = Brand.Brand<
  {
    readonly id: SequenceId
    readonly name: string
    readonly description: Option<string>
    readonly keyframes: Array.ReadonlyArray<CameraKeyframe>
    readonly duration: number
    readonly loopMode: LoopMode
    readonly transitionSettings: TransitionSettings
    readonly metadata: SequenceMetadata
  },
  'CinematicSequence'
>

/**
 * カメラキーフレーム
 */
export type CameraKeyframe = Brand.Brand<
  {
    readonly time: number
    readonly position: Position3D
    readonly rotation: CameraRotation
    readonly fieldOfView: number
    readonly easing: EasingType
    readonly effects: Array.ReadonlyArray<CameraEffect>
  },
  'CameraKeyframe'
>

/**
 * イージングタイプ
 */
export type EasingType = Data.TaggedEnum<{
  Linear: {}
  EaseIn: {}
  EaseOut: {}
  EaseInOut: {}
  Bounce: {}
  Elastic: {}
  Back: {}
  Custom: {
    readonly curve: Array.ReadonlyArray<number>
  }
}>

/**
 * カメラエフェクト
 */
export type CameraEffect = Data.TaggedEnum<{
  Shake: {
    readonly intensity: number
    readonly frequency: number
    readonly duration: number
  }
  Zoom: {
    readonly targetFOV: number
    readonly duration: number
  }
  Focus: {
    readonly target: Position3D
    readonly blurRadius: number
    readonly transitionTime: number
  }
  Fade: {
    readonly fadeType: FadeType
    readonly duration: number
    readonly color: string
  }
}>

/**
 * フェードタイプ
 */
export type FadeType = Data.TaggedEnum<{
  FadeIn: {}
  FadeOut: {}
  FadeToBlack: {}
  FadeToWhite: {}
  CrossFade: {
    readonly nextSequence: SequenceId
  }
}>

/**
 * ループモード
 */
export type LoopMode = Data.TaggedEnum<{
  None: {}
  Loop: {}
  PingPong: {}
  Random: {
    readonly sequencePool: Array.ReadonlyArray<SequenceId>
  }
}>

/**
 * 遷移設定
 */
export type TransitionSettings = Brand.Brand<
  {
    readonly fadeInDuration: number
    readonly fadeOutDuration: number
    readonly smoothTransition: boolean
    readonly preserveOrientation: boolean
  },
  'TransitionSettings'
>

/**
 * シーケンスメタデータ
 */
export type SequenceMetadata = Brand.Brand<
  {
    readonly creator: string
    readonly version: string
    readonly created: number
    readonly lastModified: number
    readonly tags: Array.ReadonlyArray<string>
    readonly category: SequenceCategory
  },
  'SequenceMetadata'
>

/**
 * シーケンスカテゴリ
 */
export type SequenceCategory = Data.TaggedEnum<{
  Cinematic: {}
  Gameplay: {}
  Cutscene: {}
  Debug: {}
  Demo: {}
  Custom: {
    readonly categoryName: string
  }
}>

/**
 * シーンカメラ設定
 */
export type SceneCameraConfig = Brand.Brand<
  {
    readonly name: string
    readonly description: Option<string>
    readonly setup: SceneCameraSetup
    readonly settings: CameraSettings
    readonly isActive: boolean
    readonly autoStart: boolean
  },
  'SceneCameraConfig'
>

/**
 * シーンカメラ状態
 */
export type SceneCameraState = Brand.Brand<
  {
    readonly sceneCameraId: SceneCameraId
    readonly sceneId: SceneId
    readonly currentPosition: Position3D
    readonly currentRotation: CameraRotation
    readonly currentTargets: Array.ReadonlyArray<SceneTarget>
    readonly isActive: boolean
    readonly currentSequence: Option<CinematicSequence>
    readonly animationState: Option<AnimationState>
    readonly lastUpdate: number
    readonly statistics: SceneCameraStatistics
  },
  'SceneCameraState'
>

/**
 * シーンカメラ統計
 */
export type SceneCameraStatistics = Brand.Brand<
  {
    readonly totalSequencesPlayed: number
    readonly totalRunTime: number
    readonly averageFPS: number
    readonly lastPerformanceCheck: number
    readonly memoryUsage: number
    readonly renderingMetrics: RenderingMetrics
  },
  'SceneCameraStatistics'
>

/**
 * レンダリングメトリクス
 */
export type RenderingMetrics = Brand.Brand<
  {
    readonly drawCalls: number
    readonly trianglesRendered: number
    readonly textureMemoryUsage: number
    readonly shaderCompilationTime: number
    readonly frameTime: number
  },
  'RenderingMetrics'
>

/**
 * シーケンス実行結果
 */
export type SequenceExecutionResult = Data.TaggedEnum<{
  Started: {
    readonly sequenceId: SequenceId
    readonly estimatedDuration: number
  }
  Completed: {
    readonly sequenceId: SequenceId
    readonly actualDuration: number
    readonly statistics: SequenceStatistics
  }
  Failed: {
    readonly sequenceId: SequenceId
    readonly error: SequenceExecutionError
    readonly partialProgress: number
  }
  Interrupted: {
    readonly sequenceId: SequenceId
    readonly reason: InterruptionReason
    readonly progress: number
  }
}>

/**
 * シーケンス統計
 */
export type SequenceStatistics = Brand.Brand<
  {
    readonly keyframesProcessed: number
    readonly effectsApplied: number
    readonly averageFrameTime: number
    readonly memoryPeakUsage: number
  },
  'SequenceStatistics'
>

/**
 * シーケンス実行エラー
 */
export type SequenceExecutionError = Data.TaggedEnum<{
  InvalidKeyframe: {
    readonly keyframeIndex: number
    readonly reason: string
  }
  ResourceUnavailable: {
    readonly resource: string
    readonly requiredAmount: number
    readonly availableAmount: number
  }
  TargetNotFound: {
    readonly targetId: string
    readonly targetType: string
  }
  AnimationSystemError: {
    readonly details: string
  }
}>

/**
 * 中断理由
 */
export type InterruptionReason = Data.TaggedEnum<{
  UserRequested: {}
  SystemShutdown: {}
  ResourceExhaustion: {}
  HigherPrioritySequence: {
    readonly newSequenceId: SequenceId
  }
  ErrorOccurred: {
    readonly error: SequenceExecutionError
  }
}>

// ========================================
// Scene Camera Application Error Types
// ========================================

/**
 * シーンカメラApplication Service専用エラー
 */
export type SceneCameraApplicationError = Data.TaggedEnum<{
  SceneNotFound: { readonly sceneId: SceneId }
  SceneCameraNotFound: { readonly sceneCameraId: SceneCameraId }
  SequenceNotFound: { readonly sequenceId: SequenceId }
  InvalidCameraSetup: {
    readonly setup: SceneCameraSetup
    readonly validationErrors: Array.ReadonlyArray<string>
  }
  TargetResolutionFailed: {
    readonly target: SceneTarget
    readonly reason: string
  }
  SequenceExecutionFailed: {
    readonly sequenceId: SequenceId
    readonly error: SequenceExecutionError
  }
  CameraConstraintViolation: {
    readonly constraint: string
    readonly currentValue: number
    readonly allowedRange: [number, number]
  }
  ResourceLimitExceeded: {
    readonly resource: string
    readonly current: number
    readonly limit: number
  }
  ConcurrentOperationConflict: {
    readonly operationType: string
    readonly conflictingOperation: string
  }
}>

// ========================================
// Schema Definitions
// ========================================

export const SceneIdSchema = Schema.String.pipe(Schema.fromBrand(Brand.nominal<SceneId>()))
export const SceneCameraIdSchema = Schema.String.pipe(Schema.fromBrand(Brand.nominal<SceneCameraId>()))
export const SequenceIdSchema = Schema.String.pipe(Schema.fromBrand(Brand.nominal<SequenceId>()))
export const ScheduleIdSchema = Schema.String.pipe(Schema.fromBrand(Brand.nominal<ScheduleId>()))

export const FollowModeSchema = Schema.TaggedEnum<FollowMode>({
  Static: Schema.Struct({}),
  FollowTarget: Schema.Struct({
    target: Schema.Unknown, // SceneTargetSchemaを参照
    smoothing: Schema.Number.pipe(Schema.between(0, 1)),
    maxDistance: Schema.Number.pipe(Schema.positive()),
  }),
  Orbit: Schema.Struct({
    center: Schema.Unknown, // Position3DSchemaを参照
    radius: Schema.Number.pipe(Schema.positive()),
    speed: Schema.Number.pipe(Schema.positive()),
    direction: Schema.TaggedEnum<OrbitDirection>({
      Clockwise: Schema.Struct({}),
      CounterClockwise: Schema.Struct({}),
      PingPong: Schema.Struct({}),
    }),
  }),
  Path: Schema.Struct({
    waypoints: Schema.Array(Schema.Unknown), // Position3DSchemaの配列
    speed: Schema.Number.pipe(Schema.positive()),
    looping: Schema.Boolean,
  }),
  LookAt: Schema.Struct({
    target: Schema.Unknown, // SceneTargetSchemaを参照
    distance: Schema.Number.pipe(Schema.positive()),
    angle: Schema.Number,
  }),
})

export const SceneTargetSchema = Schema.TaggedEnum<SceneTarget>({
  StaticPosition: Schema.Struct({
    position: Schema.Unknown, // Position3DSchemaを参照
    weight: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  DynamicEntity: Schema.Struct({
    entityId: Schema.String,
    offset: Schema.Unknown, // Position3DSchemaを参照
    weight: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  Player: Schema.Struct({
    playerId: Schema.String,
    offset: Schema.Unknown, // Position3DSchemaを参照
    weight: Schema.Number.pipe(Schema.between(0, 1)),
  }),
  CustomTracker: Schema.Struct({
    trackerId: Schema.String,
    weight: Schema.Number.pipe(Schema.between(0, 1)),
    updateCallback: Schema.Function, // 実際の実装では詳細な関数型定義が必要
  }),
  Group: Schema.Struct({
    targets: Schema.Array(Schema.Unknown), // 再帰的SceneTargetSchema
    centeringMode: Schema.TaggedEnum<CenteringMode>({
      Arithmetic: Schema.Struct({}),
      Weighted: Schema.Struct({}),
      Closest: Schema.Struct({}),
      Bounds: Schema.Struct({}),
    }),
    weight: Schema.Number.pipe(Schema.between(0, 1)),
  }),
})

export const CinematicSequenceSchema = Schema.Struct({
  id: SequenceIdSchema,
  name: Schema.String,
  description: Schema.OptionFromSelf(Schema.String),
  keyframes: Schema.Array(Schema.Unknown), // CameraKeyframeSchemaを参照
  duration: Schema.Number.pipe(Schema.positive()),
  loopMode: Schema.TaggedEnum<LoopMode>({
    None: Schema.Struct({}),
    Loop: Schema.Struct({}),
    PingPong: Schema.Struct({}),
    Random: Schema.Struct({
      sequencePool: Schema.Array(SequenceIdSchema),
    }),
  }),
  transitionSettings: Schema.Unknown, // TransitionSettingsSchemaを参照
  metadata: Schema.Unknown, // SequenceMetadataSchemaを参照
}).pipe(Schema.fromBrand(Brand.nominal<CinematicSequence>()))

export const SceneCameraApplicationErrorSchema = Schema.TaggedEnum<SceneCameraApplicationError>({
  SceneNotFound: Schema.Struct({
    sceneId: SceneIdSchema,
  }),
  SceneCameraNotFound: Schema.Struct({
    sceneCameraId: SceneCameraIdSchema,
  }),
  SequenceNotFound: Schema.Struct({
    sequenceId: SequenceIdSchema,
  }),
  InvalidCameraSetup: Schema.Struct({
    setup: Schema.Unknown, // SceneCameraSetupSchemaを参照
    validationErrors: Schema.Array(Schema.String),
  }),
  TargetResolutionFailed: Schema.Struct({
    target: SceneTargetSchema,
    reason: Schema.String,
  }),
  SequenceExecutionFailed: Schema.Struct({
    sequenceId: SequenceIdSchema,
    error: Schema.TaggedEnum<SequenceExecutionError>({
      InvalidKeyframe: Schema.Struct({
        keyframeIndex: Schema.Number,
        reason: Schema.String,
      }),
      ResourceUnavailable: Schema.Struct({
        resource: Schema.String,
        requiredAmount: Schema.Number,
        availableAmount: Schema.Number,
      }),
      TargetNotFound: Schema.Struct({
        targetId: Schema.String,
        targetType: Schema.String,
      }),
      AnimationSystemError: Schema.Struct({
        details: Schema.String,
      }),
    }),
  }),
  CameraConstraintViolation: Schema.Struct({
    constraint: Schema.String,
    currentValue: Schema.Number,
    allowedRange: Schema.Tuple(Schema.Number, Schema.Number),
  }),
  ResourceLimitExceeded: Schema.Struct({
    resource: Schema.String,
    current: Schema.Number,
    limit: Schema.Number,
  }),
  ConcurrentOperationConflict: Schema.Struct({
    operationType: Schema.String,
    conflictingOperation: Schema.String,
  }),
})

// ========================================
// Factory Functions
// ========================================

export const createSceneCameraApplicationError = {
  sceneNotFound: (sceneId: SceneId): SceneCameraApplicationError =>
    Data.struct({
      _tag: 'SceneNotFound' as const,
      sceneId,
    }),

  sceneCameraNotFound: (sceneCameraId: SceneCameraId): SceneCameraApplicationError =>
    Data.struct({
      _tag: 'SceneCameraNotFound' as const,
      sceneCameraId,
    }),

  sequenceNotFound: (sequenceId: SequenceId): SceneCameraApplicationError =>
    Data.struct({
      _tag: 'SequenceNotFound' as const,
      sequenceId,
    }),

  invalidCameraSetup: (
    setup: SceneCameraSetup,
    validationErrors: Array.ReadonlyArray<string>
  ): SceneCameraApplicationError =>
    Data.struct({
      _tag: 'InvalidCameraSetup' as const,
      setup,
      validationErrors,
    }),

  targetResolutionFailed: (target: SceneTarget, reason: string): SceneCameraApplicationError =>
    Data.struct({
      _tag: 'TargetResolutionFailed' as const,
      target,
      reason,
    }),

  sequenceExecutionFailed: (sequenceId: SequenceId, error: SequenceExecutionError): SceneCameraApplicationError =>
    Data.struct({
      _tag: 'SequenceExecutionFailed' as const,
      sequenceId,
      error,
    }),

  cameraConstraintViolation: (
    constraint: string,
    currentValue: number,
    allowedRange: [number, number]
  ): SceneCameraApplicationError =>
    Data.struct({
      _tag: 'CameraConstraintViolation' as const,
      constraint,
      currentValue,
      allowedRange,
    }),

  resourceLimitExceeded: (resource: string, current: number, limit: number): SceneCameraApplicationError =>
    Data.struct({
      _tag: 'ResourceLimitExceeded' as const,
      resource,
      current,
      limit,
    }),

  concurrentOperationConflict: (operationType: string, conflictingOperation: string): SceneCameraApplicationError =>
    Data.struct({
      _tag: 'ConcurrentOperationConflict' as const,
      operationType,
      conflictingOperation,
    }),
}

export const createSequenceExecutionResult = {
  started: (sequenceId: SequenceId, estimatedDuration: number): SequenceExecutionResult =>
    Data.struct({
      _tag: 'Started' as const,
      sequenceId,
      estimatedDuration,
    }),

  completed: (
    sequenceId: SequenceId,
    actualDuration: number,
    statistics: SequenceStatistics
  ): SequenceExecutionResult =>
    Data.struct({
      _tag: 'Completed' as const,
      sequenceId,
      actualDuration,
      statistics,
    }),

  failed: (sequenceId: SequenceId, error: SequenceExecutionError, partialProgress: number): SequenceExecutionResult =>
    Data.struct({
      _tag: 'Failed' as const,
      sequenceId,
      error,
      partialProgress,
    }),

  interrupted: (sequenceId: SequenceId, reason: InterruptionReason, progress: number): SequenceExecutionResult =>
    Data.struct({
      _tag: 'Interrupted' as const,
      sequenceId,
      reason,
      progress,
    }),
}
