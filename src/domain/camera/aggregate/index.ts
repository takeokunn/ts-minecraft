/**
 * Camera Domain - Aggregate Layer
 *
 * カメラドメインのAggregate Root層を統合エクスポートします。
 * DDD（ドメイン駆動設計）に基づくAggregate Rootパターンで実装された
 * カメラ関連のビジネスロジックを提供します。
 *
 * ## Aggregate構成
 *
 * - **Camera**: コアカメラAggregate Root
 * - **PlayerCamera**: プレイヤー専用カメラAggregate
 * - **SceneCamera**: シーン管理専用カメラAggregate
 *
 * ## 設計原則
 *
 * - **不変性**: 全てのAggregateが不変オブジェクト
 * - **ビジネスロジック内包**: ドメインルールをAggregateに集約
 * - **イベント駆動**: 状態変更時にドメインイベントを発行
 * - **型安全性**: Effect-TSとBrand型による完全な型安全性
 */

import { Effect, Match } from 'effect'
import type { Position3D } from '../value_object/camera_position/types'
import type { CameraRotation } from '../value_object/camera_rotation/types'
import type { ViewMode } from '../value_object/view_mode/types'
import type { Camera } from './camera/index'
import { UnknownCameraTypeError } from './errors'

// ========================================
// Camera Core Aggregate
// ========================================

export {
  // Core Aggregate Root
  Camera,
  // Factory
  CameraFactory,
  CameraOps,
  // Type Guards
  isCamera,
  type CameraSnapshot,
} from './camera/index'

// ========================================
// PlayerCamera Aggregate
// ========================================

export {
  // Type Guards
  isPlayerCamera,
  isPlayerId,
  // Player Camera Aggregate
  PlayerCamera,
  // Factory
  PlayerCameraFactory,
  PlayerCameraOps,
  PlayerCameraSettings,
  // Value Objects
  PlayerId,
  Sensitivity,
  SmoothingFactor,
} from './player_camera/index'

// ========================================
// SceneCamera Aggregate
// ========================================

export {
  CinematicKeyframe,
  CinematicSequence,
  CinematicSettings,
  FollowMode,
  isCinematicSequence,
  // Type Guards
  isSceneCamera,
  isSceneId,
  // Scene Camera Aggregate
  SceneCamera,
  // Factory
  SceneCameraFactory,
  SceneCameraOps,

  // Value Objects & ADTs
  SceneId,
  TargetStrategy,
  type EasingType,
} from './scene_camera/index'
export type { CameraError }

// ========================================
// 統合型定義エクスポート
// ========================================

/**
 * 全カメラAggregateの統合型
 */
export type CameraAggregate = Camera | PlayerCamera | SceneCamera

/**
 * カメラAggregate判定
 */
export const isCameraAggregate = (value: unknown): value is CameraAggregate => {
  return isCamera(value) || isPlayerCamera(value) || isSceneCamera(value)
}

/**
 * Aggregateタイプの取得
 */
export const getCameraAggregateType = (aggregate: CameraAggregate): string =>
  Match.value(aggregate).pipe(
    Match.when(isCamera, () => 'Camera' as const),
    Match.when(isPlayerCamera, () => 'PlayerCamera' as const),
    Match.when(isSceneCamera, () => 'SceneCamera' as const),
    Match.exhaustive
  )

// ========================================
// 統合ファクトリー関数
// ========================================

/**
 * Camera Aggregate Factory Namespace
 *
 * 全てのカメラAggregateの生成を統合する便利なインターフェースです。
 */
export namespace CameraAggregateFactory {
  /**
   * 基本カメラの作成
   */
  export const createCamera = CameraFactory.create

  /**
   * プレイヤーカメラの作成
   */
  export const createPlayerCamera = PlayerCameraFactory.create

  /**
   * シーンカメラの作成
   */
  export const createSceneCamera = SceneCameraFactory.create

  /**
   * デフォルトプレイヤーカメラの作成
   */
  export const createDefaultPlayerCamera = PlayerCameraFactory.createDefault

  /**
   * デフォルトシーンカメラの作成
   */
  export const createDefaultSceneCamera = SceneCameraFactory.createDefault

  /**
   * First Personプレイヤーカメラの作成
   */
  export const createFirstPersonPlayer = PlayerCameraFactory.createFirstPerson

  /**
   * Third Personプレイヤーカメラの作成
   */
  export const createThirdPersonPlayer = PlayerCameraFactory.createThirdPerson

  /**
   * シネマティックシーンカメラの作成
   */
  export const createCinematicScene = SceneCameraFactory.createCinematic

  /**
   * フライバイシーケンスの作成
   */
  export const createFlybySequence = SceneCameraFactory.createFlybySequence
}

// ========================================
// 統合操作関数
// ========================================

/**
 * Camera Aggregate Operations Namespace
 *
 * 全てのカメラAggregateに対する統合操作を提供します。
 */
export namespace CameraAggregateOps {
  /**
   * Aggregateからカメラ位置を取得
   */
  export const getPosition = (aggregate: CameraAggregate): Effect.Effect<Position3D, UnknownCameraTypeError> =>
    Match.value(aggregate).pipe(
      Match.when(isCamera, (cam) => Effect.succeed(cam.position)),
      Match.when(isPlayerCamera, (cam) => Effect.succeed(cam.camera.position)),
      Match.when(isSceneCamera, (cam) => Effect.succeed(cam.camera.position)),
      Match.exhaustive
    )

  /**
   * Aggregateからカメラ回転を取得
   */
  export const getRotation = (aggregate: CameraAggregate): Effect.Effect<CameraRotation, UnknownCameraTypeError> =>
    Match.value(aggregate).pipe(
      Match.when(isCamera, (cam) => Effect.succeed(cam.rotation)),
      Match.when(isPlayerCamera, (cam) => Effect.succeed(cam.camera.rotation)),
      Match.when(isSceneCamera, (cam) => Effect.succeed(cam.camera.rotation)),
      Match.exhaustive
    )

  /**
   * Aggregateからビューモードを取得
   */
  export const getViewMode = (aggregate: CameraAggregate): Effect.Effect<ViewMode, UnknownCameraTypeError> =>
    Match.value(aggregate).pipe(
      Match.when(isCamera, (cam) => Effect.succeed(cam.viewMode)),
      Match.when(isPlayerCamera, (cam) => Effect.succeed(cam.camera.viewMode)),
      Match.when(isSceneCamera, (cam) => Effect.succeed(cam.camera.viewMode)),
      Match.exhaustive
    )

  /**
   * Aggregateが有効かどうかを確認
   */
  export const isEnabled = (aggregate: CameraAggregate): boolean =>
    Match.value(aggregate).pipe(
      Match.when(isCamera, (cam) => cam.isEnabled),
      Match.when(isPlayerCamera, (cam) => cam.camera.isEnabled),
      Match.when(isSceneCamera, (cam) => cam.camera.isEnabled),
      Match.exhaustive
    )

  /**
   * Aggregateのコアカメラを取得
   */
  export const getCoreCamera = (aggregate: CameraAggregate): Camera =>
    Match.value(aggregate).pipe(
      Match.when(isCamera, (cam) => cam),
      Match.when(isPlayerCamera, (cam) => cam.camera),
      Match.when(isSceneCamera, (cam) => cam.camera),
      Match.exhaustive
    )
}

// ========================================
// 便利な型エイリアス
// ========================================

/**
 * カメラID統合型
 */
export type AnyCameraId = string

/**
 * カメラ設定統合型
 */
import type { CameraSettings } from '../value_object/index'
export type AnyCameraSettings = CameraSettings | PlayerCameraSettings | CinematicSettings

/**
 * カメラエラー統合型
 */
import type { CameraError } from '@domain/camera/types'

/**
 * カメライベント統合型
 */
import type { CameraEvent } from '@domain/camera/types'
export type { CameraEvent }

/**
 * Aggregate層の設計パターン参考
 *
 * このAggregate層は以下のDDDパターンを実装しています：
 *
 * 1. **Aggregate Root パターン**: 不変性とビジネスルール保証
 * 2. **Factory パターン**: 複雑な生成ロジックの分離
 * 3. **Event Sourcing パターン**: ドメインイベントによる状態追跡
 * 4. **Value Object 統合**: 型安全なドメインモデル
 * 5. **Effect-TS 活用**: 関数型プログラミングとエラーハンドリング
 *
 * 使用例:
 * ```typescript
 * import { PlayerCameraFactory, PlayerCameraOps } from './aggregate'
 *
 * // プレイヤーカメラ作成
 * const playerCamera = yield* PlayerCameraFactory.createFirstPerson(
 *   'player-1' as PlayerId,
 *   playerPosition
 * )
 *
 * // マウス入力処理
 * const updatedCamera = yield* PlayerCameraOps.handleMouseInput(
 *   playerCamera,
 *   deltaX,
 *   deltaY
 * )
 * ```
 */
