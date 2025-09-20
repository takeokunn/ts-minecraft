import { Context, Effect, Schema } from 'effect'
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
 * カメラエラー
 */
export class CameraError extends Schema.TaggedError<CameraError>()('CameraError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

/**
 * CameraService - カメラ管理サービス
 *
 * Issue #130: P1-007 Camera System
 * - 一人称視点の実装
 * - 三人称視点の実装
 * - スムーズな視点切り替え
 * - FOV調整機能
 */
export interface CameraService {
  /**
   * カメラの初期化
   */
  readonly initialize: (config: CameraConfig) => Effect.Effect<THREE.PerspectiveCamera, CameraError>

  /**
   * カメラモードの切り替え
   */
  readonly switchMode: (mode: CameraMode) => Effect.Effect<void, CameraError>

  /**
   * カメラの更新
   *
   * @param deltaTime - フレーム間の経過時間（秒）
   * @param targetPosition - プレイヤーの位置
   */
  readonly update: (
    deltaTime: number,
    targetPosition: { x: number; y: number; z: number }
  ) => Effect.Effect<void, CameraError>

  /**
   * マウス入力による視点操作
   *
   * @param deltaX - マウスX方向の移動量
   * @param deltaY - マウスY方向の移動量
   */
  readonly rotate: (deltaX: number, deltaY: number) => Effect.Effect<void, CameraError>

  /**
   * FOV（視野角）の設定
   */
  readonly setFOV: (fov: number) => Effect.Effect<void, CameraError>

  /**
   * カメラ感度の設定
   */
  readonly setSensitivity: (sensitivity: number) => Effect.Effect<void, CameraError>

  /**
   * 三人称視点の距離設定
   */
  readonly setThirdPersonDistance: (distance: number) => Effect.Effect<void, CameraError>

  /**
   * カメラのスムージング設定
   */
  readonly setSmoothing: (smoothing: number) => Effect.Effect<void, CameraError>

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
   * カメラのアスペクト比更新
   */
  readonly updateAspectRatio: (width: number, height: number) => Effect.Effect<void, CameraError>

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
 * デフォルトのカメラ設定
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
