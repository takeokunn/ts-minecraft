import { Schema } from '@effect/schema'

/**
 * カメラモード
 */
export const CameraMode = Schema.Literal('first-person', 'third-person')
export type CameraMode = Schema.Schema.Type<typeof CameraMode>

/**
 * カメラ設定
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
 * カメラ状態
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
 * カメラエラーの詳細なカテゴリ分け
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
 * カメラエラー - Schema.TaggedError パターン
 */
export interface CameraError {
  readonly _tag: 'CameraError'
  readonly message: string
  readonly reason: CameraErrorReason
  readonly cause?: unknown
  readonly context?: Record<string, unknown>
}

export const CameraError = (
  message: string,
  reason: CameraErrorReason,
  cause?: unknown,
  context?: Record<string, unknown>
): CameraError => ({
  _tag: 'CameraError',
  message,
  reason,
  ...(cause !== undefined && { cause }),
  ...(context !== undefined && { context }),
})

/**
 * Vector3 位置情報のスキーマ
 */
export const Vector3Schema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
export type Vector3 = Schema.Schema.Type<typeof Vector3Schema>

/**
 * カメラパラメータのスキーマ定義
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
