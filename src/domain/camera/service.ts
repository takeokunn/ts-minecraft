import { Context, Effect } from 'effect'
import * as THREE from 'three'
import { CameraError, CameraConfig, CameraState } from './types'

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
