/**
 * Camera Factory
 *
 * Camera Aggregate Rootの生成を担当するFactoryです。
 * 複雑な生成ロジックを分離し、型安全な生成を保証します。
 */

import { Effect, Option } from 'effect'
import { CameraError } from '@domain/camera/types'
import { CameraId } from '@domain/camera/types'
import {
  CameraDistance,
  CameraRotation,
  CameraSettings,
  createCameraRotation,
  createPosition3D,
  Position3D,
  SettingsFactory,
  ViewMode,
  ViewModeFactory,
} from '../../value_object/index'
import { Camera } from './index'

/**
 * Camera Snapshot Type
 *
 * カメラの状態を復元するためのスナップショット型です。
 */
export interface CameraSnapshot {
  readonly id: CameraId
  readonly position: Position3D
  readonly rotation: CameraRotation
  readonly viewMode: ViewMode
  readonly settings: CameraSettings
  readonly isEnabled: boolean
  readonly lastUpdated?: Date
}

/**
 * Camera Factory Namespace
 *
 * Camera Aggregate Rootの生成メソッドを提供します。
 */
export namespace CameraFactory {
  /**
   * カメラの基本生成
   *
   * 指定されたパラメータでカメラを生成します。
   */
  export const create = (
    id: CameraId,
    initialPosition: Position3D,
    initialRotation: CameraRotation,
    viewMode: ViewMode,
    settings?: CameraSettings
  ): Effect.Effect<Camera, CameraError> =>
    Effect.gen(function* () {
      // デフォルト設定の取得
      const cameraSettings = settings ?? (yield* createDefaultSettings())

      // 基本設定の検証
      const validatedSettings = yield* validateCameraSettings(cameraSettings)

      // Camera Aggregateの作成
      const camera = Camera({
        _tag: 'Camera',
        id,
        position: initialPosition,
        rotation: initialRotation,
        viewMode,
        settings: validatedSettings,
        animationState: Option.none(),
        events: [createCameraInitializedEvent(id, viewMode)],
        isEnabled: true,
        lastUpdated: new Date(),
      })

      return camera
    })

  /**
   * デフォルトカメラの生成
   *
   * デフォルト設定でカメラを生成します。
   */
  export const createDefault = (id: CameraId): Effect.Effect<Camera, CameraError> =>
    Effect.gen(function* () {
      // デフォルト値の生成
      const defaultPosition = yield* createPosition3D(0, 0, 0)
      const defaultRotation = yield* createCameraRotation(0, 0, 0)
      const defaultViewMode = ViewModeFactory.createFirstPerson()
      const defaultSettings = yield* createDefaultSettings()

      return yield* create(id, defaultPosition, defaultRotation, defaultViewMode, defaultSettings)
    })

  /**
   * スナップショットからの復元
   *
   * 保存されたスナップショットからカメラを復元します。
   */
  export const fromSnapshot = (snapshot: CameraSnapshot): Effect.Effect<Camera, CameraError> =>
    Effect.gen(function* () {
      // スナップショットの検証
      yield* validateSnapshot(snapshot)

      // Camera Aggregateの復元
      const camera = Camera({
        _tag: 'Camera',
        id: snapshot.id,
        position: snapshot.position,
        rotation: snapshot.rotation,
        viewMode: snapshot.viewMode,
        settings: snapshot.settings,
        animationState: Option.none(), // アニメーション状態はスナップショットには含めない
        events: [], // イベントは復元時にクリア
        isEnabled: snapshot.isEnabled,
        lastUpdated: snapshot.lastUpdated ?? new Date(),
      })

      return camera
    })

  /**
   * First Personカメラの生成
   *
   * プレイヤー位置に基づいてFirst Personカメラを生成します。
   */
  export const createFirstPerson = (id: CameraId, playerPosition: Position3D): Effect.Effect<Camera, CameraError> =>
    Effect.gen(function* () {
      // First Person用位置計算（プレイヤーの目の高さ）
      const eyeHeight = 1.8 // メートル
      const cameraPosition = yield* createPosition3D(playerPosition.x, playerPosition.y + eyeHeight, playerPosition.z)

      // First Person用デフォルト回転
      const defaultRotation = yield* createCameraRotation(0, 0, 0)

      // First Personビューモード
      const viewMode = ViewModeFactory.createFirstPerson()

      // First Person用設定
      const settings = yield* createFirstPersonSettings()

      return yield* create(id, cameraPosition, defaultRotation, viewMode, settings)
    })

  /**
   * Third Personカメラの生成
   *
   * ターゲット位置と距離に基づいてThird Personカメラを生成します。
   */
  export const createThirdPerson = (
    id: CameraId,
    targetPosition: Position3D,
    distance: CameraDistance
  ): Effect.Effect<Camera, CameraError> =>
    Effect.gen(function* () {
      // Third Person用位置計算（ターゲットから距離を取って後方に配置）
      const cameraPosition = yield* calculateThirdPersonPosition(targetPosition, distance)

      // ターゲットを向く回転
      const cameraRotation = yield* calculateLookAtRotation(cameraPosition, targetPosition)

      // Third Personビューモード
      const viewMode = ViewModeFactory.createThirdPerson(distance)

      // Third Person用設定
      const settings = yield* createThirdPersonSettings()

      return yield* create(id, cameraPosition, cameraRotation, viewMode, settings)
    })

  /**
   * Spectatorカメラの生成
   *
   * 自由移動可能なSpectatorカメラを生成します。
   */
  export const createSpectator = (id: CameraId, initialPosition: Position3D): Effect.Effect<Camera, CameraError> =>
    Effect.gen(function* () {
      // デフォルト回転
      const defaultRotation = yield* createCameraRotation(0, 0, 0)

      // Spectatorビューモード
      const viewMode = ViewModeFactory.createSpectator()

      // Spectator用設定（高速移動、衝突無し）
      const settings = yield* createSpectatorSettings()

      return yield* create(id, initialPosition, defaultRotation, viewMode, settings)
    })

  /**
   * Cinematicカメラの生成
   *
   * シネマティック用のカメラを生成します。
   */
  export const createCinematic = (
    id: CameraId,
    initialPosition: Position3D,
    initialRotation: CameraRotation
  ): Effect.Effect<Camera, CameraError> =>
    Effect.gen(function* () {
      // Cinematicビューモード
      const viewMode = ViewModeFactory.createCinematic()

      // Cinematic用設定（スムーズな動き、特殊エフェクト）
      const settings = yield* createCinematicSettings()

      return yield* create(id, initialPosition, initialRotation, viewMode, settings)
    })
}

// ========================================
// 内部ヘルパー関数
// ========================================

/**
 * デフォルト設定の作成
 */
const createDefaultSettings = (): Effect.Effect<CameraSettings, CameraError> =>
  Effect.gen(function* () {
    return SettingsFactory.createDefault()
  })

/**
 * First Person用設定の作成
 */
const createFirstPersonSettings = (): Effect.Effect<CameraSettings, CameraError> =>
  Effect.gen(function* () {
    return SettingsFactory.createFirstPersonPreset()
  })

/**
 * Third Person用設定の作成
 */
const createThirdPersonSettings = (): Effect.Effect<CameraSettings, CameraError> =>
  Effect.gen(function* () {
    return SettingsFactory.createThirdPersonPreset()
  })

/**
 * Spectator用設定の作成
 */
const createSpectatorSettings = (): Effect.Effect<CameraSettings, CameraError> =>
  Effect.gen(function* () {
    return SettingsFactory.createSpectatorPreset()
  })

/**
 * Cinematic用設定の作成
 */
const createCinematicSettings = (): Effect.Effect<CameraSettings, CameraError> =>
  Effect.gen(function* () {
    return SettingsFactory.createCinematicPreset()
  })

/**
 * カメラ設定の検証
 */
const validateCameraSettings = (settings: CameraSettings): Effect.Effect<CameraSettings, CameraError> =>
  Effect.gen(function* () {
    // 設定値の検証ロジック
    // FOV、Sensitivity、その他の制約チェック
    return settings // 仮実装
  })

/**
 * スナップショットの検証
 */
const validateSnapshot = (snapshot: CameraSnapshot): Effect.Effect<void, CameraError> =>
  Effect.gen(function* () {
    // スナップショットデータの整合性チェック
    if (!snapshot.id) {
      return yield* Effect.fail(
        CameraError({
          _tag: 'InvalidParameterError',
          message: 'Camera ID is required in snapshot',
        })
      )
    }

    // その他の必須フィールドチェック
    return yield* Effect.void
  })

/**
 * Third Person位置の計算
 */
const calculateThirdPersonPosition = (
  targetPosition: Position3D,
  distance: CameraDistance
): Effect.Effect<Position3D, CameraError> =>
  Effect.gen(function* () {
    // ターゲットから指定距離後方の位置を計算
    // 仮実装：単純に後方に配置
    return yield* createPosition3D(
      targetPosition.x,
      targetPosition.y + 2.0, // 少し上に
      targetPosition.z - distance.value // 後方に
    )
  })

/**
 * LookAt回転の計算
 */
const calculateLookAtRotation = (
  cameraPosition: Position3D,
  targetPosition: Position3D
): Effect.Effect<CameraRotation, CameraError> =>
  Effect.gen(function* () {
    // カメラ位置からターゲットを向く回転を計算
    // ベクトル計算によるPitch/Yaw算出
    const deltaX = targetPosition.x - cameraPosition.x
    const deltaY = targetPosition.y - cameraPosition.y
    const deltaZ = targetPosition.z - cameraPosition.z

    const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ)
    const pitch = Math.atan2(deltaY, distance)
    const yaw = Math.atan2(deltaX, deltaZ)

    return yield* createCameraRotation(
      pitch * (180 / Math.PI), // ラジアンから度に変換
      yaw * (180 / Math.PI),
      0 // Roll
    )
  })

/**
 * カメラ初期化イベントの作成
 */
const createCameraInitializedEvent = (cameraId: CameraId, viewMode: ViewMode) => {
  // イベント作成の実装
  return {} as any // 仮実装
}
