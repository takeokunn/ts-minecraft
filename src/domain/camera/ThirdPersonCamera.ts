import { Schema } from '@effect/schema'
import { Context, Effect, Layer, pipe } from 'effect'
import { CameraService, CameraState, CameraError } from './CameraService'

// 三人称カメラの設定
export const ThirdPersonConfig = Schema.Struct({
  minDistance: Schema.Number.pipe(
    Schema.clamp(1, 10) // 最小距離
  ),
  maxDistance: Schema.Number.pipe(
    Schema.clamp(5, 30) // 最大距離
  ),
  defaultDistance: Schema.Number.pipe(
    Schema.clamp(2, 20) // デフォルト距離
  ),
  heightOffset: Schema.Number.pipe(
    Schema.clamp(0, 5) // カメラの高さオフセット
  ),
  mouseSensitivity: Schema.Number.pipe(
    Schema.clamp(0.1, 2.0) // マウス感度
  ),
  collisionPadding: Schema.Number.pipe(
    Schema.clamp(0.1, 1.0) // 衝突判定用のパディング
  ),
  smoothFollowSpeed: Schema.Number.pipe(
    Schema.clamp(0.01, 1.0) // 追従スムージング速度
  ),
  autoRotate: Schema.Boolean, // プレイヤーの向きに自動追従
  allowZoom: Schema.Boolean, // ズームイン/アウトを許可
})
export type ThirdPersonConfig = typeof ThirdPersonConfig.Type

// カメラの衝突情報
export const CollisionInfo = Schema.Struct({
  hasCollision: Schema.Boolean,
  adjustedDistance: Schema.Number,
  collisionPoint: Schema.optional(
    Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number,
    })
  ),
})
export type CollisionInfo = typeof CollisionInfo.Type

// ターゲット（プレイヤー）の状態
export const TargetState = Schema.Struct({
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  rotation: Schema.Struct({
    pitch: Schema.Number,
    yaw: Schema.Number,
  }),
  velocity: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  isMoving: Schema.Boolean,
})
export type TargetState = typeof TargetState.Type

// 三人称カメラサービス
export const ThirdPersonCamera = Context.GenericTag<{
  readonly updateFromTarget: (
    target: TargetState,
    deltaTime: number
  ) => Effect.Effect<CameraState, CameraError>
  readonly handleMouseInput: (
    deltaX: number,
    deltaY: number
  ) => Effect.Effect<void, CameraError>
  readonly handleZoom: (delta: number) => Effect.Effect<void, CameraError>
  readonly checkCollision: (
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number }
  ) => Effect.Effect<CollisionInfo, never>
  readonly getConfig: () => Effect.Effect<ThirdPersonConfig, never>
  readonly setConfig: (config: Partial<ThirdPersonConfig>) => Effect.Effect<void, never>
}>('@minecraft/ThirdPersonCamera')

// デフォルト設定
export const defaultThirdPersonConfig: ThirdPersonConfig = {
  minDistance: 2,
  maxDistance: 15,
  defaultDistance: 5,
  heightOffset: 1.5,
  mouseSensitivity: 0.5,
  collisionPadding: 0.3,
  smoothFollowSpeed: 0.1,
  autoRotate: false,
  allowZoom: true,
}

// 三人称カメラのLive実装
export const ThirdPersonCameraLive = Layer.effect(
  ThirdPersonCamera,
  Effect.gen(function* () {
    const cameraService = yield* CameraService

    let config = defaultThirdPersonConfig
    let currentDistance = config.defaultDistance
    let currentRotation = { pitch: -20, yaw: 0 } // デフォルトで少し上から見下ろす
    let smoothedTargetPosition = { x: 0, y: 0, z: 0 }

    // 球面座標からデカルト座標への変換
    const sphericalToCartesian = (
      distance: number,
      pitch: number,
      yaw: number,
      target: { x: number; y: number; z: number }
    ): { x: number; y: number; z: number } => {
      const pitchRad = (pitch * Math.PI) / 180
      const yawRad = (yaw * Math.PI) / 180

      const x = target.x - distance * Math.sin(yawRad) * Math.cos(pitchRad)
      const y = target.y + distance * Math.sin(pitchRad) + config.heightOffset
      const z = target.z - distance * Math.cos(yawRad) * Math.cos(pitchRad)

      return { x, y, z }
    }

    return ThirdPersonCamera.of({
      updateFromTarget: (target, deltaTime): Effect.Effect<CameraState, CameraError> =>
        Effect.gen(function* () {
          // ターゲット位置のスムージング
          const smoothSpeed = config.smoothFollowSpeed * deltaTime * 60 // 60FPS基準
          smoothedTargetPosition = {
            x: smoothedTargetPosition.x + (target.position.x - smoothedTargetPosition.x) * smoothSpeed,
            y: smoothedTargetPosition.y + (target.position.y - smoothedTargetPosition.y) * smoothSpeed,
            z: smoothedTargetPosition.z + (target.position.z - smoothedTargetPosition.z) * smoothSpeed,
          }

          // 自動回転が有効な場合、プレイヤーの向きに追従
          if (config.autoRotate && target.isMoving) {
            const targetYaw = target.rotation.yaw
            const diff = targetYaw - currentRotation.yaw
            const adjustedDiff = ((diff + 180) % 360) - 180
            currentRotation.yaw += adjustedDiff * smoothSpeed * 0.5
          }

          // カメラ位置を計算
          const idealPosition = sphericalToCartesian(
            currentDistance,
            currentRotation.pitch,
            currentRotation.yaw,
            smoothedTargetPosition
          )

          // 衝突検出（簡易版 - 実際のゲームではレイキャストを使用）
          // 衝突検出（簡易版 - 実際のゲームではレイキャストを使用）
          const collision: CollisionInfo = {
            hasCollision: false,
            adjustedDistance: currentDistance
          }

          let finalPosition = idealPosition
          if (collision.hasCollision) {
            // 衝突がある場合、距離を調整
            const adjustedPosition = sphericalToCartesian(
              collision.adjustedDistance,
              currentRotation.pitch,
              currentRotation.yaw,
              smoothedTargetPosition
            )
            finalPosition = adjustedPosition
          }

          // カメラの向きをターゲットに向ける
          const dx = smoothedTargetPosition.x - finalPosition.x
          const dy = smoothedTargetPosition.y + config.heightOffset * 0.5 - finalPosition.y
          const dz = smoothedTargetPosition.z - finalPosition.z

          const distance = Math.sqrt(dx * dx + dz * dz)
          const lookAtPitch = Math.atan2(dy, distance) * (180 / Math.PI)
          const lookAtYaw = Math.atan2(dx, dz) * (180 / Math.PI)

          // カメラ状態を更新
          yield* cameraService.update({
            deltaTime,
            targetPosition: finalPosition,
            targetRotation: {
              pitch: lookAtPitch,
              yaw: lookAtYaw,
            },
            mode: 'third-person',
            distance: currentDistance,
          })

          return yield* cameraService.getState()
        }),

      handleMouseInput: (deltaX, deltaY) =>
        Effect.gen(function* () {
          const sensitivity = config.mouseSensitivity * 0.1

          // Yaw（水平回転）の更新
          currentRotation.yaw = (currentRotation.yaw - deltaX * sensitivity) % 360
          if (currentRotation.yaw < 0) currentRotation.yaw += 360

          // Pitch（垂直回転）の更新（-80〜80度に制限）
          currentRotation.pitch = Math.max(
            -80,
            Math.min(80, currentRotation.pitch + deltaY * sensitivity)
          )

          // 回転を適用
          yield* cameraService.update({
            deltaTime: 0.016,
            targetRotation: currentRotation,
            mode: 'third-person',
          })
        }),

      handleZoom: (delta) =>
        Effect.gen(function* () {
          if (!config.allowZoom) return

          // ズーム処理（マウスホイール）
          currentDistance = Math.max(
            config.minDistance,
            Math.min(config.maxDistance, currentDistance - delta * 0.5)
          )

          yield* cameraService.update({
            deltaTime: 0.016,
            distance: currentDistance,
            mode: 'third-person',
          })
        }),

      checkCollision: (from, to) =>
        Effect.succeed({
          hasCollision: false,
          adjustedDistance: currentDistance,
          // 実際のゲームではここでレイキャストを実行
          // 簡易実装のため、常に衝突なしを返す
        }),

      getConfig: () => Effect.succeed(config),

      setConfig: (newConfig) =>
        Effect.sync(() => {
          config = { ...config, ...newConfig }
          // 距離の設定が変更された場合、現在の距離も更新
          if (newConfig.defaultDistance !== undefined) {
            currentDistance = newConfig.defaultDistance
          }
        }),
    })
  })
)

// テスト用のMock実装
export const ThirdPersonCameraTest = Layer.sync(
  ThirdPersonCamera,
  () => {
    let config = defaultThirdPersonConfig
    let distance = config.defaultDistance
    let rotation = { pitch: -20, yaw: 0 }

    return ThirdPersonCamera.of({
      updateFromTarget: (target) =>
        Effect.succeed({
          position: {
            x: target.position.x - distance * Math.sin((rotation.yaw * Math.PI) / 180) * Math.cos((rotation.pitch * Math.PI) / 180),
            y: target.position.y + config.heightOffset + distance * Math.sin((rotation.pitch * Math.PI) / 180),
            z: target.position.z - distance * Math.cos((rotation.yaw * Math.PI) / 180) * Math.cos((rotation.pitch * Math.PI) / 180),
          },
          rotation: { ...rotation, roll: 0 },
          mode: 'third-person' as const,
          fov: 75,
          distance,
          smoothing: 0.15,
        }),

      handleMouseInput: (deltaX, deltaY) =>
        Effect.sync(() => {
          rotation.yaw = (rotation.yaw - deltaX * config.mouseSensitivity * 0.1) % 360
          rotation.pitch = Math.max(-80, Math.min(80, rotation.pitch + deltaY * config.mouseSensitivity * 0.1))
        }),

      handleZoom: (delta) =>
        Effect.sync(() => {
          if (config.allowZoom) {
            distance = Math.max(config.minDistance, Math.min(config.maxDistance, distance - delta * 0.5))
          }
        }),

      checkCollision: () =>
        Effect.succeed({
          hasCollision: false,
          adjustedDistance: distance,
        }),

      getConfig: () => Effect.succeed(config),

      setConfig: (newConfig) =>
        Effect.sync(() => {
          config = { ...config, ...newConfig }
          if (newConfig.defaultDistance !== undefined) {
            distance = newConfig.defaultDistance
          }
        }),
    })
  }
)