// ========================================
// DEPRECATED: このファイルは types/ ディレクトリに移行されました
// 後方互換性のために一時的に保持していますが、新しいコードでは types/index.js を使用してください
// ========================================

import { Schema } from 'effect'

// 新しい types/ ディレクトリからの再エクスポート
export type {
  CameraDistance,
  CameraDomainError,
  CameraError,
  CameraEvent,
  CameraRotation,
  CameraSettings,
  FOV,
  CameraMode as NewCameraMode,
  Position3D,
  Sensitivity,
} from '@domain/camera/types'

export {
  CAMERA_DEFAULTS,
  CAMERA_LIMITS,
  CAMERA_MODES,
  CameraDistanceSchema,
  CameraRotationSchema,
  CameraSettingsSchema,
  createCameraError,
  createCameraEvent,
  FOVSchema,
  isCameraMode,
  isValidFOV,
  isValidSensitivity,
  CameraModeSchema as NewCameraModeSchema,
  Position3DSchema,
  SensitivitySchema,
  VALID_CAMERA_MODES,
} from '@domain/camera/types'

// ========================================
// 既存のレガシー型定義（後方互換性のため）
// ========================================

/**
 * @deprecated types/constants.js の CameraModeSchema を使用してください
 */
export const CameraMode = Schema.Literal('first-person', 'third-person')

/**
 * カメラ設定（拡張版）
 */
export const CameraConfig = Schema.Struct({
  mode: CameraMode,
  fov: Schema.Number.pipe(Schema.between(30, 120)),
  near: Schema.Number.pipe(Schema.positive()),
  far: Schema.Number.pipe(Schema.positive()),
  sensitivity: Schema.Number.pipe(Schema.between(0.1, 10)),
  smoothing: Schema.Number.pipe(Schema.between(0, 1)),
  thirdPersonDistance: Schema.Number.pipe(Schema.between(1, 50)),
  thirdPersonHeight: Schema.Number.pipe(Schema.between(-10, 30)),
  thirdPersonAngle: Schema.Number.pipe(Schema.between(-Math.PI, Math.PI)),
})
export type CameraConfig = Schema.Schema.Type<typeof CameraConfig>

/**
 * カメラ状態（拡張版）
 */
export const CameraState = Schema.Struct({
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  rotation: Schema.Struct({
    pitch: Schema.Number.pipe(Schema.between(-Math.PI / 2, Math.PI / 2)),
    yaw: Schema.Number,
  }),
  target: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
})
export type CameraState = Schema.Schema.Type<typeof CameraState>

/**
 * @deprecated types/errors.js の新しいエラー型を使用してください
 */
export const CameraErrorReason = Schema.Literal(
  'INITIALIZATION_FAILED',
  'CAMERA_NOT_INITIALIZED',
  'INVALID_CONFIGURATION',
  'INVALID_MODE',
  'INVALID_PARAMETER',
  'RESOURCE_ERROR'
)
export type CameraErrorReason = Schema.Schema.Type<typeof CameraErrorReason>

/**
 * @deprecated types/errors.js の新しいエラークラスを使用してください
 */
export interface LegacyCameraError {
  readonly _tag: 'CameraError'
  readonly message: string
  readonly reason: CameraErrorReason
  readonly cause?: unknown
  readonly context?: Record<string, unknown>
}

export const LegacyCameraError = (
  message: string,
  reason: CameraErrorReason,
  cause?: unknown,
  context?: Record<string, unknown>
): LegacyCameraError => ({
  _tag: 'CameraError',
  message,
  reason,
  ...(cause !== undefined && { cause }),
  ...(context !== undefined && { context }),
})

/**
 * @deprecated types/events.js の Position3DSchema を使用してください
 */
export const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
export type Vector3 = Schema.Schema.Type<typeof Vector3Schema>

/**
 * カメラパラメータのスキーマ定義（拡張版）
 */
export const CameraParameterSchemas = {
  fov: Schema.Number.pipe(Schema.between(30, 120)),
  sensitivity: Schema.Number.pipe(Schema.between(0.1, 10)),
  smoothing: Schema.Number.pipe(Schema.between(0, 1)),
  distance: Schema.Number.pipe(Schema.between(1, 50)),
  aspectRatio: Schema.Number.pipe(Schema.positive()),
  deltaTime: Schema.Number.pipe(Schema.nonNegative()),
  mouseDelta: Schema.Number,
}
