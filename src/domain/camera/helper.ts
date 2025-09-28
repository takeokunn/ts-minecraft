import { Schema } from '@effect/schema'
import { Effect, pipe, Predicate } from 'effect'
import { CameraConfig, CameraError, CameraMode, CameraState } from './types'

export const isCameraError = (error: unknown): error is CameraError =>
  Predicate.isRecord(error) && '_tag' in error && error['_tag'] === 'CameraError'

/**
 * カメラエラー作成ヘルパー
 */
export const createCameraError = {
  initializationFailed: (message: string, cause?: unknown) => CameraError(message, 'INITIALIZATION_FAILED', cause),
  notInitialized: (operation: string) =>
    CameraError(`カメラが初期化されていません: ${operation}`, 'CAMERA_NOT_INITIALIZED', undefined, { operation }),
  invalidConfiguration: (message: string, config?: unknown) =>
    CameraError(message, 'INVALID_CONFIGURATION', undefined, { config }),
  invalidMode: (mode: string) => CameraError(`無効なカメラモード: ${mode}`, 'INVALID_MODE', undefined, { mode }),
  invalidParameter: (parameter: string, value: unknown, expected?: string) =>
    CameraError(`無効なパラメータ: ${parameter}`, 'INVALID_PARAMETER', undefined, { parameter, value, expected }),
  resourceError: (message: string, cause?: unknown) => CameraError(message, 'RESOURCE_ERROR', cause),
}

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
export const validateCameraMode = (mode: unknown): Effect.Effect<CameraMode, CameraError> =>
  pipe(
    Schema.decodeUnknown(CameraMode)(mode),
    Effect.mapError(() => createCameraError.invalidMode(String(mode)))
  )
