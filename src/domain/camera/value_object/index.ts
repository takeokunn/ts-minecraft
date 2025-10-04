/**
 * Camera Domain - Value Objects Layer
 *
 * このレイヤーはカメラドメインのValue Objectsを提供します。
 * Effect-TSのBrand型、ADT（代数的データ型）、Schema検証を活用して
 * 型安全性とドメインロジックの純粋性を実現しています。
 */

// View Mode Value Objects
export * from './view-mode'

// Camera Position Value Objects
export * from './camera-position'

// Camera Rotation Value Objects
export * from './camera-rotation'

// Camera Settings Value Objects
export * from './camera-settings'

// Animation State Value Objects
export * from './animation-state'

/**
 * 統合型定義エクスポート
 *
 * 各Value Objectの主要な型を再エクスポートして
 * 外部からの利用を簡素化します。
 */

// View Mode関連
export type {
  AnimationKeyframe,
  AnimationTimeline,
  CameraDistance,
  CinematicSettings,
  FirstPersonSettings,
  SpectatorSettings,
  ThirdPersonSettings,
  ViewMode,
  ViewModeError,
} from './view_mode/types'

// Position関連
export type {
  BoundingBox,
  Direction3D,
  LerpFactor,
  Position3D,
  CameraDistance as PositionCameraDistance,
  PositionError,
  Velocity3D,
  ViewOffset,
} from './camera_position/types'

// Rotation関連
export type {
  AngularVelocity,
  CameraRotation,
  Degrees,
  MouseDelta,
  MouseSensitivity,
  Pitch,
  Quaternion,
  Radians,
  Roll,
  RotationError,
  RotationLerpFactor,
  RotationLimits,
  Yaw,
} from './camera_rotation/types'

// Settings関連
export type {
  AntiAliasingMode,
  AspectRatio,
  CameraLimits,
  CameraSettings,
  DisplaySettings,
  FOV,
  FarPlane,
  FrameRate,
  NearPlane,
  PerformanceSettings,
  QualityLevel,
  QualityPreset,
  RenderDistance,
  RenderingMode,
  Sensitivity,
  SettingsError,
  Smoothing,
} from './camera_settings/types'

// Animation関連
export type {
  AnimationDirection,
  AnimationDuration,
  AnimationError,
  AnimationEvent,
  AnimationProgress,
  AnimationState,
  CameraAnimation,
  EasingType,
  FOVAnimation,
  FrameNumber,
  InterpolationType,
  Keyframe,
  KeyframeAnimation,
  PlaybackMode,
  PositionAnimation,
  RotationAnimation,
  Timestamp,
} from './animation_state/types'

/**
 * 統合ファクトリー関数エクスポート
 */

// ViewMode ファクトリー
export { DefaultSettings as ViewModeDefaultSettings, ViewModeFactory } from './view_mode/operations'

// Position ファクトリー
export {
  BoundingBoxOps,
  Position3DConstants,
  Position3DOps,
  createDirection3D,
  createLerpFactor,
  createPosition3D,
  createCameraDistance as createPositionCameraDistance,
  createViewOffset,
} from './camera_position/operations'

// Rotation ファクトリー
export {
  AngleConversion,
  AngleFactory,
  CameraRotationOps,
  RotationConstants,
  createCameraRotation,
  createMouseDelta,
  createMouseSensitivity,
} from './camera_rotation/operations'

// Settings ファクトリー
export {
  CameraSettingsOps,
  QualityPresets,
  SettingsFactory,
  SettingsValidation,
  createCameraLimits,
  createCameraSettings,
} from './camera_settings/operations'

// Animation ファクトリー
export {
  AnimationConstants,
  AnimationStateOps,
  AnimationValueFactory,
  CameraAnimationOps,
  EasingFunctions,
  InterpolationOps,
} from './animation_state/operations'

/**
 * 統合Schema エクスポート
 */

// ViewMode Schemas
export {
  AnimationKeyframeSchema,
  AnimationTimelineSchema,
  CinematicSettingsSchema,
  FirstPersonSettingsSchema,
  SpectatorSettingsSchema,
  ThirdPersonSettingsSchema,
  CameraDistanceSchema as ViewModeCameraDistanceSchema,
  ViewModeSchema,
} from './view_mode/schema'

// Position Schemas
export {
  BoundingBoxSchema,
  CoordinateSchemas,
  Direction3DSchema,
  LerpFactorSchema,
  Position3DSchema,
  CameraDistanceSchema as PositionCameraDistanceSchema,
  Velocity3DSchema,
  ViewOffsetSchema,
} from './camera_position/schema'

// Rotation Schemas
export {
  AngleConstraints,
  AngleConversionSchemas,
  AngularVelocitySchema,
  CameraRotationSchema,
  DegreesSchema,
  MouseDeltaSchema,
  MouseSensitivitySchema,
  PitchSchema,
  QuaternionSchema,
  RadiansSchema,
  RollSchema,
  RotationLerpFactorSchema,
  RotationLimitsSchema,
  YawSchema,
} from './camera_rotation/schema'

// Settings Schemas
export {
  AntiAliasingModeSchema,
  AspectRatioSchema,
  CameraLimitsSchema,
  CameraSettingsSchema,
  DisplaySettingsSchema,
  FOVSchema,
  FarPlaneSchema,
  FrameRateSchema,
  NearPlaneSchema,
  PerformanceSettingsSchema,
  QualityLevelSchema,
  QualityPresetSchema,
  RenderDistanceSchema,
  RenderingModeSchema,
  SensitivitySchema,
  SettingsConstraints,
  SmoothingSchema,
} from './camera_settings/schema'

// Animation Schemas
export {
  AnimationConstraints,
  AnimationDirectionSchema,
  AnimationDurationSchema,
  AnimationEventSchema,
  AnimationProgressSchema,
  AnimationStateSchema,
  CameraAnimationSchema,
  EasingTypeSchema,
  FOVAnimationSchema,
  FrameNumberSchema,
  InterpolationTypeSchema,
  KeyframeAnimationSchema,
  KeyframeSchema,
  PlaybackModeSchema,
  PositionAnimationSchema,
  RotationAnimationSchema,
  TimestampSchema,
} from './animation_state/schema'
