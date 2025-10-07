/**
 * PlayerCamera Aggregate
 *
 * プレイヤー専用のCamera Aggregateです。
 * プレイヤーの操作（マウス、キーボード）に応じたカメラ制御、
 * プレイヤー追従、衝突検出などの機能を提供します。
 */

import { CameraError } from '@domain/camera/types'
import { PlayerIdSchema } from '@domain/shared/entities/player_id'
import { Effect, Match, Option, pipe, Schema } from 'effect'
import {
  CameraDistance,
  CameraDistanceSchema,
  CameraRotation,
  MouseDelta,
  MouseDeltaSchema,
  MouseSensitivitySchema,
  Position3D,
  Position3DSchema,
  Smoothing,
  SmoothingSchema,
  ViewMode,
} from '../../value_object/index'
import { Camera, CameraOps, CameraSchema } from '../camera'

/**
 * Player ID Brand Type
 * 共有カーネルから再エクスポート
 */
export type { PlayerId } from '@domain/shared/entities/player_id'

/**
 * Sensitivity Value Object Schema
 */
export const SensitivitySchema = Schema.Struct({
  _tag: Schema.Literal('Sensitivity'),
  mouse: MouseSensitivitySchema,
  keyboard: Schema.Number,
  wheel: Schema.Number,
})
export type Sensitivity = Schema.Schema.Type<typeof SensitivitySchema>

/**
 * Smoothing Factor Value Object Schema
 */
export const SmoothingFactorSchema = Schema.Struct({
  _tag: Schema.Literal('SmoothingFactor'),
  movement: SmoothingSchema,
  rotation: SmoothingSchema,
  zoom: SmoothingSchema,
})
export type SmoothingFactor = Schema.Schema.Type<typeof SmoothingFactorSchema>

/**
 * Player Camera Settings Schema
 */
export const PlayerCameraSettingsSchema = Schema.Struct({
  _tag: Schema.Literal('PlayerCameraSettings'),
  sensitivity: SensitivitySchema,
  smoothing: SmoothingFactorSchema,
  invertY: Schema.Boolean,
  autoRun: Schema.Boolean,
  bobbing: Schema.Boolean,
  collisionEnabled: Schema.Boolean,
  followDistance: CameraDistanceSchema,
})
export type PlayerCameraSettings = Schema.Schema.Type<typeof PlayerCameraSettingsSchema>

/**
 * PlayerCamera Aggregate Schema
 *
 * プレイヤー固有のカメラ機能を提供するAggregateです。
 */
export const PlayerCameraSchema = Schema.Struct({
  _tag: Schema.Literal('PlayerCamera'),
  camera: CameraSchema,
  playerId: PlayerIdSchema,
  settings: PlayerCameraSettingsSchema,
  inputAccumulator: MouseDeltaSchema,
  lastPlayerPosition: Schema.OptionFromSelf(Position3DSchema),
  isFollowing: Schema.Boolean,
  collisionEnabled: Schema.Boolean,
})
export type PlayerCamera = Schema.Schema.Type<typeof PlayerCameraSchema>

/**
 * PlayerCamera Operations
 *
 * プレイヤーカメラの操作を提供します。
 */
export namespace PlayerCameraOps {
  /**
   * マウス入力の処理
   *
   * マウスの移動量に基づいてカメラの回転を更新します。
   * 感度、Y軸反転、スムージングを適用します。
   */
  export const handleMouseInput = (
    playerCamera: PlayerCamera,
    deltaX: number,
    deltaY: number
  ): Effect.Effect<PlayerCamera, CameraError> =>
    Effect.gen(function* () {
      const { settings, camera } = playerCamera

      // 感度の適用
      const sensitivityX = settings.sensitivity.mouse.x
      const sensitivityY = settings.sensitivity.mouse.y

      // Y軸反転の適用
      const adjustedDeltaY = settings.invertY ? -deltaY : deltaY

      // 感度を適用した回転量
      const rotationDeltaX = deltaX * sensitivityX
      const rotationDeltaY = adjustedDeltaY * sensitivityY

      // 現在の回転を取得
      const currentRotation = camera.rotation

      // 新しい回転値を計算（Pitch制限を適用）
      const newPitch = Math.max(-90, Math.min(90, currentRotation.pitch + rotationDeltaY))
      const newYaw = (currentRotation.yaw + rotationDeltaX) % 360

      // 新しい回転を作成
      const newRotation = yield* createCameraRotationSafe(newPitch, newYaw, currentRotation.roll)

      // スムージングの適用
      const smoothedRotation = applyRotationSmoothing(currentRotation, newRotation, settings.smoothing.rotation)

      // カメラの回転を更新
      const updatedCamera = yield* CameraOps.updateRotation(camera, smoothedRotation)

      // 入力蓄積の更新
      const newInputAccumulator = accumulateMouseInput(playerCamera.inputAccumulator, deltaX, deltaY)

      return {
        ...playerCamera,
        camera: updatedCamera,
        inputAccumulator: newInputAccumulator,
      }
    })

  /**
   * プレイヤー追従
   *
   * プレイヤーの位置に合わせてカメラ位置を更新します。
   */
  export const followPlayer = (
    playerCamera: PlayerCamera,
    playerPosition: Position3D
  ): Effect.Effect<PlayerCamera, CameraError> =>
    Effect.gen(function* () {
      if (!playerCamera.isFollowing) {
        return playerCamera
      }

      const { camera, settings } = playerCamera

      // ビューモードに応じた位置計算
      const newCameraPosition = yield* calculateCameraPositionForPlayer(playerPosition, camera.viewMode, settings)

      // 衝突検出
      const finalPosition = playerCamera.collisionEnabled
        ? yield* performCollisionDetection(newCameraPosition, playerPosition)
        : newCameraPosition

      // スムージングの適用
      const smoothedPosition = applyPositionSmoothing(camera.position, finalPosition, settings.smoothing.movement)

      // カメラ位置の更新
      const updatedCamera = yield* CameraOps.updatePosition(camera, smoothedPosition)

      return {
        ...playerCamera,
        camera: updatedCamera,
        lastPlayerPosition: Option.some(playerPosition),
      }
    })

  /**
   * First Personモードに切り替え
   */
  export const switchToFirstPerson = (playerCamera: PlayerCamera): Effect.Effect<PlayerCamera, CameraError> =>
    Effect.gen(function* () {
      const firstPersonMode = createFirstPersonViewMode()
      const updatedCamera = yield* CameraOps.changeViewMode(playerCamera.camera, firstPersonMode)

      return {
        ...playerCamera,
        camera: updatedCamera,
      }
    })

  /**
   * Third Personモードに切り替え
   */
  export const switchToThirdPerson = (
    playerCamera: PlayerCamera,
    distance: CameraDistance
  ): Effect.Effect<PlayerCamera, CameraError> =>
    Effect.gen(function* () {
      const thirdPersonMode = createThirdPersonViewMode(distance)
      const updatedCamera = yield* CameraOps.changeViewMode(playerCamera.camera, thirdPersonMode)

      return {
        ...playerCamera,
        camera: updatedCamera,
        settings: {
          ...playerCamera.settings,
          followDistance: distance,
        },
      }
    })

  /**
   * プレイヤー追従の有効化
   */
  export const enableFollowing = (playerCamera: PlayerCamera): PlayerCamera => ({
    ...playerCamera,
    isFollowing: true,
  })

  /**
   * プレイヤー追従の無効化
   */
  export const disableFollowing = (playerCamera: PlayerCamera): PlayerCamera => ({
    ...playerCamera,
    isFollowing: false,
  })

  /**
   * 衝突検出の有効化
   */
  export const enableCollision = (playerCamera: PlayerCamera): PlayerCamera => ({
    ...playerCamera,
    collisionEnabled: true,
    settings: {
      ...playerCamera.settings,
      collisionEnabled: true,
    },
  })

  /**
   * 衝突検出の無効化
   */
  export const disableCollision = (playerCamera: PlayerCamera): PlayerCamera => ({
    ...playerCamera,
    collisionEnabled: false,
    settings: {
      ...playerCamera.settings,
      collisionEnabled: false,
    },
  })

  /**
   * 設定の更新
   */
  export const updateSettings = (
    playerCamera: PlayerCamera,
    settingsUpdate: Partial<PlayerCameraSettings>
  ): PlayerCamera => ({
    ...playerCamera,
    settings: {
      ...playerCamera.settings,
      ...settingsUpdate,
    },
  })

  /**
   * カメラの取得
   */
  export const getCamera = (playerCamera: PlayerCamera): Camera => playerCamera.camera

  /**
   * プレイヤーID の取得
   */
  export const getPlayerId = (playerCamera: PlayerCamera): PlayerId => playerCamera.playerId

  /**
   * 現在のビューモードの取得
   */
  export const getViewMode = (playerCamera: PlayerCamera): ViewMode => playerCamera.camera.viewMode

  /**
   * 入力累積のリセット
   */
  export const resetInputAccumulator = (playerCamera: PlayerCamera): PlayerCamera => ({
    ...playerCamera,
    inputAccumulator: createEmptyMouseDelta(),
  })
}

// ========================================
// 内部ヘルパー関数
// ========================================

/**
 * 安全なカメラ回転作成
 */
const createCameraRotationSafe = (
  pitch: number,
  yaw: number,
  roll: number
): Effect.Effect<CameraRotation, CameraError> =>
  Effect.gen(function* () {
    // Value Objectの作成
    return yield* Effect.succeed({
      pitch,
      yaw,
      roll,
    } as CameraRotation) // 仮実装
  })

/**
 * 回転のスムージング適用
 */
const applyRotationSmoothing = (
  currentRotation: CameraRotation,
  targetRotation: CameraRotation,
  smoothing: Smoothing
): CameraRotation => {
  // 補間計算
  const factor = smoothing.value || 0.1

  return {
    pitch: lerp(currentRotation.pitch, targetRotation.pitch, factor),
    yaw: lerp(currentRotation.yaw, targetRotation.yaw, factor),
    roll: lerp(currentRotation.roll, targetRotation.roll, factor),
  } as CameraRotation
}

/**
 * 位置のスムージング適用
 */
const applyPositionSmoothing = (
  currentPosition: Position3D,
  targetPosition: Position3D,
  smoothing: Smoothing
): Position3D => {
  const factor = smoothing.value || 0.1

  return {
    x: lerp(currentPosition.x, targetPosition.x, factor),
    y: lerp(currentPosition.y, targetPosition.y, factor),
    z: lerp(currentPosition.z, targetPosition.z, factor),
  } as Position3D
}

/**
 * 線形補間
 */
const lerp = (start: number, end: number, factor: number): number => {
  return start + (end - start) * factor
}

/**
 * マウス入力の蓄積
 */
const accumulateMouseInput = (current: MouseDelta, deltaX: number, deltaY: number): MouseDelta => {
  return {
    x: current.x + deltaX,
    y: current.y + deltaY,
  } as MouseDelta
}

/**
 * プレイヤー用カメラ位置計算
 */
const calculateCameraPositionForPlayer = (
  playerPosition: Position3D,
  viewMode: ViewMode,
  settings: PlayerCameraSettings
): Effect.Effect<Position3D, CameraError> =>
  Effect.gen(function* () {
    return pipe(
      viewMode,
      Match.value,
      Match.tag('FirstPerson', () => {
        // First Person: プレイヤーの目の高さ
        return Effect.succeed({
          x: playerPosition.x,
          y: playerPosition.y + 1.8, // 目の高さ
          z: playerPosition.z,
        } as Position3D)
      }),
      Match.tag('ThirdPerson', () => {
        // Third Person: プレイヤーから距離を取った位置
        const distance = settings.followDistance.value
        return Effect.succeed({
          x: playerPosition.x,
          y: playerPosition.y + 2.0,
          z: playerPosition.z - distance,
        } as Position3D)
      }),
      Match.orElse(() => Effect.succeed(playerPosition))
    )
  })

/**
 * 衝突検出の実行
 */
const performCollisionDetection = (
  cameraPosition: Position3D,
  playerPosition: Position3D
): Effect.Effect<Position3D, CameraError> =>
  Effect.gen(function* () {
    // 簡単な衝突検出ロジック
    // 実際の実装では物理エンジンとの連携が必要
    return cameraPosition // 仮実装
  })

/**
 * First Personビューモードの作成
 */
const createFirstPersonViewMode = (): ViewMode => {
  return {} as ViewMode // 仮実装
}

/**
 * Third Personビューモードの作成
 */
const createThirdPersonViewMode = (distance: CameraDistance): ViewMode => {
  return {} as ViewMode // 仮実装
}

/**
 * 空のマウスデルタの作成
 */
const createEmptyMouseDelta = (): MouseDelta => {
  return { x: 0, y: 0 } as MouseDelta
}
