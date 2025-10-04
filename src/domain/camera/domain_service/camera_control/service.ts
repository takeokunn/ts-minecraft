/**
 * Camera Control Domain Service
 *
 * カメラ制御に関する純粋なドメインロジックを提供するサービス。
 * 各種カメラモードの位置計算、制約適用、スムージング等の
 * 核となるビジネスロジックを集約しています。
 */

import { Context, Effect } from 'effect'
import type {
  CameraDistance,
  CameraError,
  CameraRotation,
  Position3D,
  SmoothingFactor,
  Vector3D,
} from '../../value_object'

/**
 * カメラ制御ドメインサービスの型定義
 */
export interface CameraControlService {
  /**
   * 一人称視点のカメラ位置を計算
   * プレイヤーの目の高さを考慮した位置を返す
   */
  readonly calculateFirstPersonPosition: (
    playerPosition: Position3D,
    playerHeight: number
  ) => Effect.Effect<Position3D, CameraError>

  /**
   * 三人称視点のカメラ位置を計算
   * ターゲットからの距離と回転を考慮した位置を返す
   */
  readonly calculateThirdPersonPosition: (
    targetPosition: Position3D,
    rotation: CameraRotation,
    distance: CameraDistance
  ) => Effect.Effect<Position3D, CameraError>

  /**
   * 位置制約を適用
   * 世界境界、地形制限等の制約を位置に適用
   */
  readonly applyPositionConstraints: (
    position: Position3D,
    constraints: PositionConstraints
  ) => Effect.Effect<Position3D, CameraError>

  /**
   * 位置のスムージング処理
   * 現在位置から目標位置への滑らかな補間
   */
  readonly smoothPosition: (
    currentPosition: Position3D,
    targetPosition: Position3D,
    deltaTime: number,
    smoothingFactor: SmoothingFactor
  ) => Position3D

  /**
   * カメラの向きベクトルを計算
   * 回転角度から正規化されたlook directionを計算
   */
  readonly calculateLookDirection: (rotation: CameraRotation) => Vector3D

  /**
   * 球面座標変換
   * 回転角度と距離から球面座標での位置オフセットを計算
   */
  readonly sphericalToCartesian: (
    spherical: SphericalCoordinate,
    distance: CameraDistance
  ) => Effect.Effect<Vector3D, CameraError>

  /**
   * カメラのアップベクトルを計算
   * ロール角を考慮したup vectorを計算
   */
  readonly calculateUpVector: (rotation: CameraRotation) => Vector3D

  /**
   * FOVに基づくビューポート境界計算
   * 視野角と距離から可視範囲を計算
   */
  readonly calculateViewBounds: (
    position: Position3D,
    rotation: CameraRotation,
    fov: number,
    aspectRatio: number,
    distance: number
  ) => Effect.Effect<ViewBounds, CameraError>
}

/**
 * 位置制約の定義
 */
export interface PositionConstraints {
  readonly worldBounds: BoundingBox
  readonly minHeight: number
  readonly maxHeight: number
  readonly terrainCollision: boolean
  readonly entityCollision: boolean
}

/**
 * 球面座標表現
 */
export interface SphericalCoordinate {
  readonly radius: number
  readonly theta: number // 方位角（水平面での角度）
  readonly phi: number // 仰角（垂直面での角度）
}

/**
 * ビュー境界
 */
export interface ViewBounds {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
  readonly near: number
  readonly far: number
}

/**
 * Bounding Box型の再エクスポート
 */
export interface BoundingBox {
  readonly min: Position3D
  readonly max: Position3D
}

/**
 * Camera Control Service Context Tag
 * Effect-TSのDIコンテナで使用するサービスタグ
 */
export const CameraControlService = Context.GenericTag<CameraControlService>(
  '@minecraft/domain/camera/CameraControlService'
)
