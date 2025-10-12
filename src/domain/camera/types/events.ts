import { JsonValueSchema } from '@shared/schema/json'
import { Schema } from 'effect'
import type {
  CameraDistance,
  FOV,
  Position3D as Position3DBrand,
  Rotation2D as Rotation2DBrand,
  Sensitivity,
} from './constants'
import { CameraModeSchema, Position3DSchema, Rotation2DSchema } from './constants'

// ========================================
// Event Base Types
// ========================================

/**
 * Position3D型（constants.jsからの再エクスポート）
 */
export type Position3D = Position3DBrand

/**
 * CameraRotation型（constants.jsのRotation2Dとしての再エクスポート）
 */
export type CameraRotation = Rotation2DBrand

/**
 * CameraSettings型
 */
export type CameraSettings = {
  readonly fov: FOV
  readonly sensitivity: Sensitivity
  readonly distance: CameraDistance
  readonly smoothing: number
}

/**
 * AnimationState型
 */
export type AnimationState = {
  readonly id: string
  readonly type: 'position' | 'rotation' | 'fov' | 'transition'
  readonly progress: number
  readonly duration: number
  readonly startTime: number
}

// ========================================
// Domain Event Tags
// ========================================

export const CameraEventTagSchema = Schema.Literal(
  'CameraInitialized',
  'ViewModeChanged',
  'PositionUpdated',
  'RotationUpdated',
  'SettingsChanged',
  'AnimationStarted',
  'AnimationCompleted',
  'AnimationCancelled',
  'CollisionDetected',
  'CameraLocked',
  'CameraUnlocked',
  'FOVChanged',
  'SensitivityChanged',
  'CameraShakeStarted',
  'CameraShakeEnded'
)

export type CameraEventTag = Schema.Schema.Type<typeof CameraEventTagSchema>

// ========================================
// Schema Definitions
// ========================================

/**
 * CameraIdスキーマ
 */
export const CameraIdSchema = Schema.String.pipe(Schema.trimmed(), Schema.minLength(1), Schema.brand('CameraId'))

export type CameraId = Schema.Schema.Type<typeof CameraIdSchema>

/**
 * CameraRotationスキーマ（constants.jsのRotation2DSchemaとしての再エクスポート）
 */
export const CameraRotationSchema = Rotation2DSchema

/**
 * CameraSettingsスキーマ
 */
export const CameraSettingsSchema = Schema.Struct({
  fov: Schema.Number.pipe(Schema.brand('FOV')),
  sensitivity: Schema.Number.pipe(Schema.brand('Sensitivity')),
  distance: Schema.Number.pipe(Schema.brand('CameraDistance')),
  smoothing: Schema.Number,
})

/**
 * AnimationStateスキーマ
 */
export const AnimationStateSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.Literal('position', 'rotation', 'fov', 'transition'),
  progress: Schema.Number.pipe(Schema.between(0, 1)),
  duration: Schema.Number.pipe(Schema.positive()),
  startTime: Schema.Number,
})

/**
 * 個別のイベントスキーマ
 */
export const CameraInitializedSchema = Schema.Struct({
  _tag: Schema.Literal('CameraInitialized'),
  cameraId: CameraIdSchema,
  viewMode: CameraModeSchema,
  timestamp: Schema.Number,
})

export const ViewModeChangedSchema = Schema.Struct({
  _tag: Schema.Literal('ViewModeChanged'),
  cameraId: CameraIdSchema,
  fromMode: CameraModeSchema,
  toMode: CameraModeSchema,
  timestamp: Schema.Number,
})

export const PositionUpdatedSchema = Schema.Struct({
  _tag: Schema.Literal('PositionUpdated'),
  cameraId: CameraIdSchema,
  fromPosition: Position3DSchema,
  toPosition: Position3DSchema,
  timestamp: Schema.Number,
})

export const RotationUpdatedSchema = Schema.Struct({
  _tag: Schema.Literal('RotationUpdated'),
  cameraId: CameraIdSchema,
  fromRotation: CameraRotationSchema,
  toRotation: CameraRotationSchema,
  timestamp: Schema.Number,
})

export const SettingsChangedSchema = Schema.Struct({
  _tag: Schema.Literal('SettingsChanged'),
  cameraId: CameraIdSchema,
  changedSettings: Schema.partial(CameraSettingsSchema),
  timestamp: Schema.Number,
})

export const AnimationStartedSchema = Schema.Struct({
  _tag: Schema.Literal('AnimationStarted'),
  cameraId: CameraIdSchema,
  animationState: AnimationStateSchema,
  timestamp: Schema.Number,
})

export const AnimationCompletedSchema = Schema.Struct({
  _tag: Schema.Literal('AnimationCompleted'),
  cameraId: CameraIdSchema,
  animationState: AnimationStateSchema,
  timestamp: Schema.Number,
})

export const AnimationCancelledSchema = Schema.Struct({
  _tag: Schema.Literal('AnimationCancelled'),
  cameraId: CameraIdSchema,
  animationState: AnimationStateSchema,
  reason: Schema.String,
  timestamp: Schema.Number,
})

export const CollisionDetectedSchema = Schema.Struct({
  _tag: Schema.Literal('CollisionDetected'),
  cameraId: CameraIdSchema,
  position: Position3DSchema,
  obstruction: JsonValueSchema,
  timestamp: Schema.Number,
})

export const CameraLockedSchema = Schema.Struct({
  _tag: Schema.Literal('CameraLocked'),
  cameraId: CameraIdSchema,
  reason: Schema.String,
  timestamp: Schema.Number,
})

export const CameraUnlockedSchema = Schema.Struct({
  _tag: Schema.Literal('CameraUnlocked'),
  cameraId: CameraIdSchema,
  timestamp: Schema.Number,
})

export const FOVChangedSchema = Schema.Struct({
  _tag: Schema.Literal('FOVChanged'),
  cameraId: CameraIdSchema,
  fromFOV: Schema.Number.pipe(Schema.brand('FOV')),
  toFOV: Schema.Number.pipe(Schema.brand('FOV')),
  timestamp: Schema.Number,
})

export const SensitivityChangedSchema = Schema.Struct({
  _tag: Schema.Literal('SensitivityChanged'),
  cameraId: CameraIdSchema,
  fromSensitivity: Schema.Number.pipe(Schema.brand('Sensitivity')),
  toSensitivity: Schema.Number.pipe(Schema.brand('Sensitivity')),
  timestamp: Schema.Number,
})

export const CameraShakeStartedSchema = Schema.Struct({
  _tag: Schema.Literal('CameraShakeStarted'),
  cameraId: CameraIdSchema,
  intensity: Schema.Number.pipe(Schema.between(0, 1)),
  duration: Schema.Number.pipe(Schema.positive()),
  timestamp: Schema.Number,
})

export const CameraShakeEndedSchema = Schema.Struct({
  _tag: Schema.Literal('CameraShakeEnded'),
  cameraId: CameraIdSchema,
  timestamp: Schema.Number,
})

/**
 * カメライベント統合スキーマ
 */
export const CameraEventSchema = Schema.Union(
  CameraInitializedSchema,
  ViewModeChangedSchema,
  PositionUpdatedSchema,
  RotationUpdatedSchema,
  SettingsChangedSchema,
  AnimationStartedSchema,
  AnimationCompletedSchema,
  AnimationCancelledSchema,
  CollisionDetectedSchema,
  CameraLockedSchema,
  CameraUnlockedSchema,
  FOVChangedSchema,
  SensitivityChangedSchema,
  CameraShakeStartedSchema,
  CameraShakeEndedSchema
)

export type CameraEvent = Schema.Schema.Type<typeof CameraEventSchema>

export const CameraEventSchemas = {
  CameraInitialized: CameraInitializedSchema,
  ViewModeChanged: ViewModeChangedSchema,
  PositionUpdated: PositionUpdatedSchema,
  RotationUpdated: RotationUpdatedSchema,
  SettingsChanged: SettingsChangedSchema,
  AnimationStarted: AnimationStartedSchema,
  AnimationCompleted: AnimationCompletedSchema,
  AnimationCancelled: AnimationCancelledSchema,
  CollisionDetected: CollisionDetectedSchema,
  CameraLocked: CameraLockedSchema,
  CameraUnlocked: CameraUnlockedSchema,
  FOVChanged: FOVChangedSchema,
  SensitivityChanged: SensitivityChangedSchema,
  CameraShakeStarted: CameraShakeStartedSchema,
  CameraShakeEnded: CameraShakeEndedSchema,
} as const

export const validateCameraEvent = Schema.decodeUnknown(CameraEventSchema)
export const isCameraEvent = Schema.is(CameraEventSchema)
export const parseCameraEvent = Schema.decodeSync(CameraEventSchema)

// ========================================
// Event Type Guards
// ========================================

/**
 * カメラ初期化イベントかチェック
 */
export const isCameraInitializedEvent = (event: CameraEvent): event is CameraEvent & { _tag: 'CameraInitialized' } =>
  event._tag === 'CameraInitialized'

/**
 * ビューモード変更イベントかチェック
 */
export const isViewModeChangedEvent = (event: CameraEvent): event is CameraEvent & { _tag: 'ViewModeChanged' } =>
  event._tag === 'ViewModeChanged'

/**
 * 位置更新イベントかチェック
 */
export const isPositionUpdatedEvent = (event: CameraEvent): event is CameraEvent & { _tag: 'PositionUpdated' } =>
  event._tag === 'PositionUpdated'

/**
 * 回転更新イベントかチェック
 */
export const isRotationUpdatedEvent = (event: CameraEvent): event is CameraEvent & { _tag: 'RotationUpdated' } =>
  event._tag === 'RotationUpdated'

/**
 * 設定変更イベントかチェック
 */
export const isSettingsChangedEvent = (event: CameraEvent): event is CameraEvent & { _tag: 'SettingsChanged' } =>
  event._tag === 'SettingsChanged'

/**
 * アニメーション関連イベントかチェック
 */
export const isAnimationEvent = (event: CameraEvent): boolean =>
  event._tag === 'AnimationStarted' || event._tag === 'AnimationCompleted' || event._tag === 'AnimationCancelled'

/**
 * 衝突検出イベントかチェック
 */
export const isCollisionDetectedEvent = (event: CameraEvent): event is CameraEvent & { _tag: 'CollisionDetected' } =>
  event._tag === 'CollisionDetected'
