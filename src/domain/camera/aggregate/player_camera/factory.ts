/**
 * PlayerCamera Factory
 *
 * PlayerCamera Aggregateの生成を担当するFactoryです。
 * プレイヤー固有の設定とカメラの統合を行います。
 */

import { CameraError, CameraId } from '@domain/camera/types'
import { Effect, Option } from 'effect'
import { CameraDistance, MouseDelta, MouseSensitivity, Position3D, Smoothing } from '../../value_object/index'
import { Camera, CameraFactory } from '../camera'
import { PlayerCamera, PlayerCameraSettings, PlayerId, Sensitivity, SmoothingFactor } from './player_camera'

/**
 * PlayerCamera Factory Namespace
 */
export namespace PlayerCameraFactory {
  /**
   * PlayerCameraの基本生成
   *
   * 指定されたプレイヤーIDとカメラでPlayerCameraを生成します。
   */
  export const create = (
    playerId: PlayerId,
    camera: Camera,
    settings?: PlayerCameraSettings
  ): Effect.Effect<PlayerCamera, CameraError> =>
    Effect.gen(function* () {
      // デフォルト設定の取得
      const playerSettings = settings ?? (yield* createDefaultPlayerSettings())

      return {
        _tag: 'PlayerCamera' as const,
        camera,
        playerId,
        settings: playerSettings,
        inputAccumulator: createEmptyMouseDelta(),
        lastPlayerPosition: Option.none(),
        isFollowing: true,
        collisionEnabled: playerSettings.collisionEnabled,
      }
    })

  /**
   * デフォルトPlayerCameraの生成
   *
   * デフォルト設定でPlayerCameraを生成します。
   */
  export const createDefault = (
    playerId: PlayerId,
    initialPosition: Position3D
  ): Effect.Effect<PlayerCamera, CameraError> =>
    Effect.gen(function* () {
      // デフォルトカメラの生成
      const cameraId = generateCameraId(playerId)
      const camera = yield* CameraFactory.createFirstPerson(cameraId, initialPosition)

      // デフォルト設定の作成
      const settings = yield* createDefaultPlayerSettings()

      return yield* create(playerId, camera, settings)
    })

  /**
   * 既存カメラからPlayerCameraを生成
   *
   * 既存のカメラインスタンスからPlayerCameraを生成します。
   */
  export const fromExistingCamera = (
    playerId: PlayerId,
    camera: Camera,
    settings?: PlayerCameraSettings
  ): Effect.Effect<PlayerCamera, CameraError> =>
    Effect.gen(function* () {
      return yield* create(playerId, camera, settings)
    })

  /**
   * First Person PlayerCameraの生成
   *
   * First Person用に最適化されたPlayerCameraを生成します。
   */
  export const createFirstPerson = (
    playerId: PlayerId,
    playerPosition: Position3D
  ): Effect.Effect<PlayerCamera, CameraError> =>
    Effect.gen(function* () {
      // First Personカメラの生成
      const cameraId = generateCameraId(playerId)
      const camera = yield* CameraFactory.createFirstPerson(cameraId, playerPosition)

      // First Person用設定
      const settings = yield* createFirstPersonPlayerSettings()

      return yield* create(playerId, camera, settings)
    })

  /**
   * Third Person PlayerCameraの生成
   *
   * Third Person用に最適化されたPlayerCameraを生成します。
   */
  export const createThirdPerson = (
    playerId: PlayerId,
    playerPosition: Position3D,
    distance: CameraDistance
  ): Effect.Effect<PlayerCamera, CameraError> =>
    Effect.gen(function* () {
      // Third Personカメラの生成
      const cameraId = generateCameraId(playerId)
      const camera = yield* CameraFactory.createThirdPerson(cameraId, playerPosition, distance)

      // Third Person用設定
      const settings = yield* createThirdPersonPlayerSettings(distance)

      return yield* create(playerId, camera, settings)
    })

  /**
   * カスタム設定でPlayerCameraを生成
   */
  export const createWithCustomSettings = (
    playerId: PlayerId,
    initialPosition: Position3D,
    customSettings: Partial<PlayerCameraSettings>
  ): Effect.Effect<PlayerCamera, CameraError> =>
    Effect.gen(function* () {
      // ベース設定の作成
      const baseSettings = yield* createDefaultPlayerSettings()

      // カスタム設定の統合
      const settings = {
        ...baseSettings,
        ...customSettings,
      }

      // カメラの生成
      const cameraId = generateCameraId(playerId)
      const camera = yield* CameraFactory.createFirstPerson(cameraId, initialPosition)

      return yield* create(playerId, camera, settings)
    })
}

// ========================================
// 設定作成ヘルパー関数
// ========================================

/**
 * デフォルトプレイヤー設定の作成
 */
const createDefaultPlayerSettings = (): Effect.Effect<PlayerCameraSettings, CameraError> =>
  Effect.gen(function* () {
    return {
      _tag: 'PlayerCameraSettings' as const,
      sensitivity: yield* createDefaultSensitivity(),
      smoothing: yield* createDefaultSmoothing(),
      invertY: false,
      autoRun: false,
      bobbing: true,
      collisionEnabled: true,
      followDistance: yield* createDefaultFollowDistance(),
    }
  })

/**
 * First Person用プレイヤー設定の作成
 */
const createFirstPersonPlayerSettings = (): Effect.Effect<PlayerCameraSettings, CameraError> =>
  Effect.gen(function* () {
    const baseSettings = yield* createDefaultPlayerSettings()

    return {
      ...baseSettings,
      sensitivity: yield* createFirstPersonSensitivity(),
      smoothing: yield* createFirstPersonSmoothing(),
      collisionEnabled: false, // First Personでは衝突検出を無効
      bobbing: true,
    }
  })

/**
 * Third Person用プレイヤー設定の作成
 */
const createThirdPersonPlayerSettings = (distance: CameraDistance): Effect.Effect<PlayerCameraSettings, CameraError> =>
  Effect.gen(function* () {
    const baseSettings = yield* createDefaultPlayerSettings()

    return {
      ...baseSettings,
      sensitivity: yield* createThirdPersonSensitivity(),
      smoothing: yield* createThirdPersonSmoothing(),
      collisionEnabled: true, // Third Personでは衝突検出を有効
      followDistance: distance,
      bobbing: false, // Third Personではカメラボビング無効
    }
  })

/**
 * デフォルト感度の作成
 */
const createDefaultSensitivity = (): Effect.Effect<Sensitivity, CameraError> =>
  Effect.gen(function* () {
    const mouseSensitivity = yield* createMouseSensitivity(1.0, 1.0)

    return {
      _tag: 'Sensitivity' as const,
      mouse: mouseSensitivity,
      keyboard: 1.0,
      wheel: 1.0,
    }
  })

/**
 * First Person用感度の作成
 */
const createFirstPersonSensitivity = (): Effect.Effect<Sensitivity, CameraError> =>
  Effect.gen(function* () {
    const mouseSensitivity = yield* createMouseSensitivity(0.8, 0.8)

    return {
      _tag: 'Sensitivity' as const,
      mouse: mouseSensitivity,
      keyboard: 1.2,
      wheel: 1.0,
    }
  })

/**
 * Third Person用感度の作成
 */
const createThirdPersonSensitivity = (): Effect.Effect<Sensitivity, CameraError> =>
  Effect.gen(function* () {
    const mouseSensitivity = yield* createMouseSensitivity(1.2, 1.2)

    return {
      _tag: 'Sensitivity' as const,
      mouse: mouseSensitivity,
      keyboard: 1.0,
      wheel: 1.5, // Third Personではズーム感度を高める
    }
  })

/**
 * デフォルトスムージングの作成
 */
const createDefaultSmoothing = (): Effect.Effect<SmoothingFactor, CameraError> =>
  Effect.gen(function* () {
    const movementSmoothing = yield* createSmoothing(0.1)
    const rotationSmoothing = yield* createSmoothing(0.2)
    const zoomSmoothing = yield* createSmoothing(0.15)

    return {
      _tag: 'SmoothingFactor' as const,
      movement: movementSmoothing,
      rotation: rotationSmoothing,
      zoom: zoomSmoothing,
    }
  })

/**
 * First Person用スムージングの作成
 */
const createFirstPersonSmoothing = (): Effect.Effect<SmoothingFactor, CameraError> =>
  Effect.gen(function* () {
    const movementSmoothing = yield* createSmoothing(0.05) // 即座に反応
    const rotationSmoothing = yield* createSmoothing(0.1) // やや即座に
    const zoomSmoothing = yield* createSmoothing(0.1)

    return {
      _tag: 'SmoothingFactor' as const,
      movement: movementSmoothing,
      rotation: rotationSmoothing,
      zoom: zoomSmoothing,
    }
  })

/**
 * Third Person用スムージングの作成
 */
const createThirdPersonSmoothing = (): Effect.Effect<SmoothingFactor, CameraError> =>
  Effect.gen(function* () {
    const movementSmoothing = yield* createSmoothing(0.2) // よりスムーズに
    const rotationSmoothing = yield* createSmoothing(0.3) // 滑らかな回転
    const zoomSmoothing = yield* createSmoothing(0.25)

    return {
      _tag: 'SmoothingFactor' as const,
      movement: movementSmoothing,
      rotation: rotationSmoothing,
      zoom: zoomSmoothing,
    }
  })

// ========================================
// Value Object作成ヘルパー関数
// ========================================

/**
 * マウス感度の作成
 */
const createMouseSensitivity = (x: number, y: number): Effect.Effect<MouseSensitivity, CameraError> =>
  Effect.gen(function* () {
    return { x, y } as MouseSensitivity // 仮実装
  })

/**
 * スムージングの作成
 */
const createSmoothing = (value: number): Effect.Effect<Smoothing, CameraError> =>
  Effect.gen(function* () {
    return { value } as Smoothing // 仮実装
  })

/**
 * デフォルト追従距離の作成
 */
const createDefaultFollowDistance = (): Effect.Effect<CameraDistance, CameraError> =>
  Effect.gen(function* () {
    return { value: 5.0 } as CameraDistance // 仮実装
  })

/**
 * 空のマウスデルタの作成
 */
const createEmptyMouseDelta = (): MouseDelta => {
  return { x: 0, y: 0 } as MouseDelta
}

/**
 * カメラIDの生成
 */
const generateCameraId = (playerId: PlayerId): CameraId => {
  return `camera-${playerId}` as CameraId
}
