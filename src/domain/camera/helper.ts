import { Schema } from '@effect/schema'
import { Effect, pipe, Predicate } from 'effect'
import type {
  AnimationDuration,
  CameraDistance,
  CameraError,
  DeltaTime,
  FOV,
  MouseDelta,
  PitchAngle,
  Position3D,
  Rotation2D,
  Sensitivity,
  YawAngle,
  CameraConfig,
  CameraState,
} from './types/index.js'
import {
  AnimationDurationSchema,
  CameraDistanceSchema,
  createCameraError,
  DeltaTimeSchema,
  FOVSchema,
  MouseDeltaSchema,
  CameraModeSchema,
  PitchAngleSchema,
  Position3DSchema,
  Rotation2DSchema,
  SensitivitySchema,
  YawAngleSchema,
} from './types/index.js'

export const isCameraError = (error: unknown): error is CameraError =>
  Predicate.isRecord(error) &&
  '_tag' in error &&
  (error['_tag'] === 'InitializationFailed' ||
    error['_tag'] === 'CameraNotInitialized' ||
    error['_tag'] === 'InvalidConfiguration' ||
    error['_tag'] === 'InvalidMode' ||
    error['_tag'] === 'InvalidParameter' ||
    error['_tag'] === 'ResourceError' ||
    error['_tag'] === 'AnimationError' ||
    error['_tag'] === 'CollisionError')

/**
 * カメラエラー作成ヘルパー（新しい型システム用）
 */
export { createCameraError }

/**
 * カメラ設定の検証ヘルパー
 */
export const validateCameraConfig = (config: unknown): Effect.Effect<CameraConfig, CameraError> =>
  pipe(
    Schema.decodeUnknown(CameraConfig)(config),
    Effect.mapError((parseError) =>
      createCameraError.invalidConfiguration(`カメラ設定の検証に失敗しました: ${parseError.message}`, config)
    )
  )

/**
 * カメラ状態の検証ヘルパー
 */
export const validateCameraState = (state: unknown): Effect.Effect<CameraState, CameraError> =>
  pipe(
    Schema.decodeUnknown(CameraState)(state),
    Effect.mapError((parseError) =>
      createCameraError.invalidParameter('カメラ状態', state, `Valid CameraState: ${parseError.message}`)
    )
  )

/**
 * カメラモードの検証ヘルパー
 */
export const validateCameraMode = (mode: unknown): Effect.Effect<typeof CameraModeSchema.Type, CameraError> =>
  pipe(
    Schema.decodeUnknown(CameraModeSchema)(mode),
    Effect.mapError(() => createCameraError.invalidMode(String(mode), ['first-person', 'third-person']))
  )

// ========================================
// Brand型検証関数
// ========================================

/**
 * FOVの検証ヘルパー
 */
export const validateFOV = (value: unknown): Effect.Effect<FOV, CameraError, never> =>
  pipe(
    Schema.decodeUnknown(FOVSchema)(value),
    Effect.mapError(() => createCameraError.invalidParameter('fov', value, 'between 30-120'))
  )

/**
 * 感度の検証ヘルパー
 */
export const validateSensitivity = (value: unknown): Effect.Effect<Sensitivity, CameraError, never> =>
  pipe(
    Schema.decodeUnknown(SensitivitySchema)(value),
    Effect.mapError(() => createCameraError.invalidParameter('sensitivity', value, 'between 0.1-5.0'))
  )

/**
 * カメラ距離の検証ヘルパー
 */
export const validateCameraDistance = (value: unknown): Effect.Effect<CameraDistance, CameraError, never> =>
  pipe(
    Schema.decodeUnknown(CameraDistanceSchema)(value),
    Effect.mapError(() => createCameraError.invalidParameter('distance', value, 'between 1-50'))
  )

/**
 * ピッチ角の検証ヘルパー
 */
export const validatePitchAngle = (value: unknown): Effect.Effect<PitchAngle, CameraError, never> =>
  pipe(
    Schema.decodeUnknown(PitchAngleSchema)(value),
    Effect.mapError(() => createCameraError.invalidParameter('pitch', value, 'between -90 to 90 degrees'))
  )

/**
 * ヨー角の検証ヘルパー
 */
export const validateYawAngle = (value: unknown): Effect.Effect<YawAngle, CameraError, never> =>
  pipe(
    Schema.decodeUnknown(YawAngleSchema)(value),
    Effect.mapError(() => createCameraError.invalidParameter('yaw', value, 'finite number'))
  )

/**
 * アニメーション時間の検証ヘルパー
 */
export const validateAnimationDuration = (value: unknown): Effect.Effect<AnimationDuration, CameraError, never> =>
  pipe(
    Schema.decodeUnknown(AnimationDurationSchema)(value),
    Effect.mapError(() => createCameraError.invalidParameter('animationDuration', value, 'between 50-2000ms'))
  )

/**
 * マウス移動量の検証ヘルパー
 */
export const validateMouseDelta = (value: unknown): Effect.Effect<MouseDelta, CameraError, never> =>
  pipe(
    Schema.decodeUnknown(MouseDeltaSchema)(value),
    Effect.mapError(() => createCameraError.invalidParameter('mouseDelta', value, 'finite number'))
  )

/**
 * デルタ時間の検証ヘルパー
 */
export const validateDeltaTime = (value: unknown): Effect.Effect<DeltaTime, CameraError, never> =>
  pipe(
    Schema.decodeUnknown(DeltaTimeSchema)(value),
    Effect.mapError(() => createCameraError.invalidParameter('deltaTime', value, 'non-negative number'))
  )

/**
 * 3D位置の検証ヘルパー
 */
export const validatePosition3D = (value: unknown): Effect.Effect<Position3D, CameraError, never> =>
  pipe(
    Schema.decodeUnknown(Position3DSchema)(value),
    Effect.mapError(() => createCameraError.invalidParameter('position', value, 'object with x, y, z coordinates'))
  )

/**
 * 2D回転の検証ヘルパー
 */
export const validateRotation2D = (value: unknown): Effect.Effect<Rotation2D, CameraError, never> =>
  pipe(
    Schema.decodeUnknown(Rotation2DSchema)(value),
    Effect.mapError(() => createCameraError.invalidParameter('rotation', value, 'object with pitch and yaw angles'))
  )
