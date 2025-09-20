import { Schema } from '@effect/schema'
import { Context, Effect, Layer, pipe } from 'effect'
import { CameraService, CameraState, CameraError } from './CameraService'

// 一人称カメラの設定
export const FirstPersonConfig = Schema.Struct({
  eyeHeight: Schema.Number.pipe(
    Schema.clamp(0.5, 2.5) // プレイヤーの目の高さ
  ),
  mouseSensitivity: Schema.Number.pipe(
    Schema.clamp(0.1, 2.0) // マウス感度
  ),
  bobAmount: Schema.Number.pipe(
    Schema.clamp(0, 0.5) // 歩行時の揺れ幅
  ),
  bobSpeed: Schema.Number.pipe(
    Schema.clamp(0, 10) // 歩行時の揺れ速度
  ),
  sprintFOVMultiplier: Schema.Number.pipe(
    Schema.clamp(1.0, 1.5) // ダッシュ時のFOV倍率
  ),
})
export type FirstPersonConfig = typeof FirstPersonConfig.Type

// プレイヤーの状態（カメラ計算用）
export const PlayerState = Schema.Struct({
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  velocity: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  isWalking: Schema.Boolean,
  isSprinting: Schema.Boolean,
  isCrouching: Schema.Boolean,
  isSwimming: Schema.Boolean,
  walkTime: Schema.Number, // 歩行アニメーション時間
})
export type PlayerState = typeof PlayerState.Type

// 一人称カメラサービス
export const FirstPersonCamera = Context.GenericTag<{
  readonly updateFromPlayer: (
    player: PlayerState,
    deltaTime: number
  ) => Effect.Effect<CameraState, CameraError>
  readonly handleMouseInput: (
    deltaX: number,
    deltaY: number
  ) => Effect.Effect<void, CameraError>
  readonly getConfig: () => Effect.Effect<FirstPersonConfig, never>
  readonly setConfig: (config: Partial<FirstPersonConfig>) => Effect.Effect<void, never>
}>('@minecraft/FirstPersonCamera')

// デフォルト設定
export const defaultFirstPersonConfig: FirstPersonConfig = {
  eyeHeight: 1.7,
  mouseSensitivity: 0.5,
  bobAmount: 0.05,
  bobSpeed: 6.0,
  sprintFOVMultiplier: 1.15,
}

// 一人称カメラのLive実装
export const FirstPersonCameraLive = Layer.effect(
  FirstPersonCamera,
  Effect.gen(function* () {
    const cameraService = yield* CameraService

    let config = defaultFirstPersonConfig
    let currentRotation = { pitch: 0, yaw: 0 }

    return FirstPersonCamera.of({
      updateFromPlayer: (player, deltaTime) =>
        Effect.gen(function* () {
          // 現在のカメラ状態を取得
          const currentState = yield* cameraService.getState()

          // 基本的な目の位置を計算
          let eyeY = player.position.y + config.eyeHeight

          // しゃがみ時の高さ調整
          if (player.isCrouching) {
            eyeY -= config.eyeHeight * 0.3
          }

          // 歩行時の頭の揺れを計算
          let bobOffsetX = 0
          let bobOffsetY = 0

          if (player.isWalking && !player.isSwimming) {
            const bobPhase = player.walkTime * config.bobSpeed
            bobOffsetX = Math.sin(bobPhase) * config.bobAmount
            bobOffsetY = Math.abs(Math.cos(bobPhase * 2)) * config.bobAmount
          }

          // FOVの動的調整
          let targetFOV = 75 // デフォルトFOV
          if (player.isSprinting) {
            targetFOV *= config.sprintFOVMultiplier
          }
          if (player.isCrouching) {
            targetFOV *= 0.9 // しゃがみ時は少し狭める
          }

          // カメラ位置を更新
          const targetPosition = {
            x: player.position.x + bobOffsetX,
            y: eyeY + bobOffsetY,
            z: player.position.z,
          }

          // カメラ状態を更新
          yield* cameraService.update({
            deltaTime,
            targetPosition,
            targetRotation: currentRotation,
            mode: 'first-person',
            fov: targetFOV,
          })

          return yield* cameraService.getState()
        }),

      handleMouseInput: (deltaX, deltaY) =>
        Effect.gen(function* () {
          // マウス入力を回転に変換
          const sensitivity = config.mouseSensitivity * 0.1

          // Yaw（左右回転）の更新
          currentRotation.yaw = (currentRotation.yaw - deltaX * sensitivity) % 360
          if (currentRotation.yaw < 0) currentRotation.yaw += 360

          // Pitch（上下回転）の更新（-90〜90度に制限）
          currentRotation.pitch = Math.max(
            -90,
            Math.min(90, currentRotation.pitch - deltaY * sensitivity)
          )

          // 即座に適用（一人称は即座に反応すべき）
          yield* cameraService.update({
            deltaTime: 0.016, // 約60fps
            targetRotation: currentRotation,
            mode: 'first-person',
          })
        }),

      getConfig: () => Effect.succeed(config),

      setConfig: (newConfig) =>
        Effect.sync(() => {
          config = { ...config, ...newConfig }
        }),
    })
  })
)

// テスト用のMock実装
export const FirstPersonCameraTest = Layer.sync(
  FirstPersonCamera,
  () => {
    let config = defaultFirstPersonConfig
    let rotation = { pitch: 0, yaw: 0 }

    return FirstPersonCamera.of({
      updateFromPlayer: (player) =>
        Effect.succeed({

          position: {
            x: player.position.x + (player.isWalking ? Math.sin(player.walkTime * config.bobSpeed) * config.bobAmount : 0),
            y: player.position.y + config.eyeHeight * (player.isCrouching ? 0.7 : 1) +
                (player.isWalking ? Math.abs(Math.cos(player.walkTime * config.bobSpeed * 2)) * config.bobAmount : 0),
            z: player.position.z,
          },
          rotation: { ...rotation, roll: 0 },
          mode: 'first-person' as const,
          fov: player.isSprinting ? 75 * config.sprintFOVMultiplier : 75,
          distance: 0,
          smoothing: 0.15,
        }),

      handleMouseInput: (deltaX, deltaY) =>
        Effect.sync(() => {
          rotation.yaw = (rotation.yaw - deltaX * config.mouseSensitivity * 0.1) % 360
          rotation.pitch = Math.max(-90, Math.min(90, rotation.pitch - deltaY * config.mouseSensitivity * 0.1))
        }),

      getConfig: () => Effect.succeed(config),

      setConfig: (newConfig) =>
        Effect.sync(() => {
          config = { ...config, ...newConfig }
        }),
    })
  }
)