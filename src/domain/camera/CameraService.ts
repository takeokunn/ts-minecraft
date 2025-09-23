import { Context, Effect, Schema, Match, pipe } from 'effect'
import * as THREE from 'three'

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

export const isCameraError = (error: unknown): error is CameraError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'CameraError'

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

/**
 * CameraService - カメラ管理サービス
 *
 * Issue #130: P1-007 Camera System
 * - 一人称視点の実装
 * - 三人称視点の実装
 * - スムーズな視点切り替え
 * - FOV調整機能
 * - 型安全性の強化
 * - Schema検証による実行時安全性
 */
export interface CameraService {
  /**
   * カメラの初期化 - Schema検証付き
   */
  readonly initialize: (config: unknown) => Effect.Effect<THREE.PerspectiveCamera, CameraError>

  /**
   * カメラモードの切り替え - Schema検証付き
   */
  readonly switchMode: (mode: unknown) => Effect.Effect<void, CameraError>

  /**
   * カメラの更新 - Schema検証付き
   *
   * @param deltaTime - フレーム間の経過時間（秒）
   * @param targetPosition - プレイヤーの位置
   */
  readonly update: (deltaTime: unknown, targetPosition: unknown) => Effect.Effect<void, CameraError>

  /**
   * マウス入力による視点操作 - Schema検証付き
   *
   * @param deltaX - マウスX方向の移動量
   * @param deltaY - マウスY方向の移動量
   */
  readonly rotate: (deltaX: unknown, deltaY: unknown) => Effect.Effect<void, CameraError>

  /**
   * FOV（視野角）の設定 - Schema検証付き
   */
  readonly setFOV: (fov: unknown) => Effect.Effect<void, CameraError>

  /**
   * カメラ感度の設定 - Schema検証付き
   */
  readonly setSensitivity: (sensitivity: unknown) => Effect.Effect<void, CameraError>

  /**
   * 三人称視点の距離設定 - Schema検証付き
   */
  readonly setThirdPersonDistance: (distance: unknown) => Effect.Effect<void, CameraError>

  /**
   * カメラのスムージング設定 - Schema検証付き
   */
  readonly setSmoothing: (smoothing: unknown) => Effect.Effect<void, CameraError>

  /**
   * 現在のカメラ状態を取得
   */
  readonly getState: () => Effect.Effect<CameraState, never>

  /**
   * 現在のカメラ設定を取得
   */
  readonly getConfig: () => Effect.Effect<CameraConfig, never>

  /**
   * 現在のThree.jsカメラインスタンスを取得
   */
  readonly getCamera: () => Effect.Effect<THREE.PerspectiveCamera | null, never>

  /**
   * カメラのリセット
   */
  readonly reset: () => Effect.Effect<void, CameraError>

  /**
   * カメラのアスペクト比更新 - Schema検証付き
   */
  readonly updateAspectRatio: (width: unknown, height: unknown) => Effect.Effect<void, CameraError>

  /**
   * リソースの解放
   */
  readonly dispose: () => Effect.Effect<void, never>
}

/**
 * CameraService サービスタグ
 */
export const CameraService = Context.GenericTag<CameraService>('@minecraft/domain/CameraService')

/**
 * デフォルトのカメラ設定 - Schema検証済み
 */
export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  mode: 'first-person',
  fov: 75,
  near: 0.1,
  far: 1000,
  sensitivity: 1.0,
  smoothing: 0.15,
  thirdPersonDistance: 5,
  thirdPersonHeight: 2,
  thirdPersonAngle: 0,
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
