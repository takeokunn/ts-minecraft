import * as Schema from '@effect/schema/Schema'
import { Effect, Layer, Match, Option, pipe, Ref } from 'effect'
import * as THREE from 'three'
import { Vector3Schema } from './types'
import type { Vector3, CameraConfig, CameraState, CameraError } from './types'
import { CameraService } from './service'
import { DEFAULT_CAMERA_CONFIG } from './constant'
import {
  createCameraError,
  validateCameraConfig,
  validateCameraMode,
} from './helper'

/**
 * 一人称カメラの内部状態
 */
interface FirstPersonState {
  camera: THREE.PerspectiveCamera | null
  config: CameraConfig
  state: CameraState
  targetPosition: { x: number; y: number; z: number }
  smoothedPosition: { x: number; y: number; z: number }
}

/**
 * ヨー角を正規化（-π から π の範囲に収める）
 */
const normalizeYaw = (yaw: number): number => {
  const twoPi = Math.PI * 2
  const normalized = yaw % twoPi
  return pipe(
    normalized,
    Match.value,
    Match.when(
      (n) => n > Math.PI,
      (n) => n - twoPi
    ),
    Match.when(
      (n) => n < -Math.PI,
      (n) => n + twoPi
    ),
    Match.orElse((n) => n)
  )
}

/**
 * 線形補間
 */
const lerp = (start: number, end: number, factor: number): number => {
  return start + (end - start) * factor
}

/**
 * カメラの存在を検証するヘルパー - 型安全性強化
 */
const ensureCameraExists = (
  state: FirstPersonState,
  operation?: string
): Effect.Effect<THREE.PerspectiveCamera, CameraError> =>
  pipe(
    Option.fromNullable(state.camera),
    Option.match({
      onNone: () => Effect.fail(createCameraError.notInitialized(operation || 'unknown operation')),
      onSome: (camera) => Effect.succeed(camera),
    })
  )

/**
 * 数値パラメータ検証ヘルパー
 */
const validateNumber = (value: unknown, parameterName: string): Effect.Effect<number, CameraError> =>
  pipe(
    Schema.decodeUnknown(Schema.Number)(value),
    Effect.mapError(() => createCameraError.invalidParameter(parameterName, value))
  )

/**
 * Vector3位置情報の検証
 */
const validateVector3 = (position: unknown, paramName: string = 'position'): Effect.Effect<Vector3, CameraError> => {
  return pipe(
    position,
    Schema.decodeUnknown(Vector3Schema as unknown as Schema.Schema<Vector3, unknown>),
    Effect.mapError(() => createCameraError.invalidParameter(paramName, position, 'Vector3 with x, y, z coordinates'))
  ) as Effect.Effect<Vector3, CameraError>
}

/**
 * FirstPersonCameraサービスの実装を作成
 */
const createFirstPersonCameraService = (stateRef: Ref.Ref<FirstPersonState>): CameraService => ({
  initialize: (config: unknown): Effect.Effect<THREE.PerspectiveCamera, CameraError> =>
    Effect.gen(function* () {
      // 設定の検証
      const validatedConfig = yield* validateCameraConfig(config)

      const camera = yield* Effect.try({
        try: () => {
          const cam = new THREE.PerspectiveCamera(
            validatedConfig.fov,
            window.innerWidth / window.innerHeight,
            validatedConfig.near,
            validatedConfig.far
          )
          // 初期位置設定
          cam.position.set(0, 1.7, 0) // プレイヤーの目の高さ
          cam.rotation.order = 'YXZ' // ヨー→ピッチの順で回転
          return cam
        },
        catch: (error) => createCameraError.initializationFailed('カメラの初期化に失敗しました', error),
      })

      const initialState: FirstPersonState = {
        camera,
        config: validatedConfig,
        state: {
          position: { x: 0, y: 1.7, z: 0 },
          rotation: { pitch: 0, yaw: 0 },
          target: { x: 0, y: 1.7, z: 0 },
        },
        targetPosition: { x: 0, y: 0, z: 0 },
        smoothedPosition: { x: 0, y: 1.7, z: 0 },
      }

      yield* Ref.set(stateRef, initialState)
      return camera
    }),

  switchMode: (mode: unknown): Effect.Effect<void, CameraError, never> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const validatedMode = yield* validateCameraMode(mode)

      return yield* pipe(
        validatedMode,
        Match.value,
        Match.when(
          'first-person',
          (): Effect.Effect<void, CameraError> =>
            pipe(
              state.config.mode,
              Match.value,
              Match.when('first-person', (): Effect.Effect<void, CameraError> => Effect.succeed(undefined)),
              Match.orElse((): Effect.Effect<void, CameraError> => {
                const newConfig = { ...state.config, mode: validatedMode }
                const newState: FirstPersonState = {
                  ...state,
                  config: newConfig,
                }
                return Ref.set(stateRef, newState)
              })
            )
        ),
        Match.when('third-person', (): Effect.Effect<void, CameraError> => Effect.succeed(undefined)), // 一人称カメラでは三人称モードを無視
        Match.orElse((m): Effect.Effect<void, CameraError> => Effect.fail(createCameraError.invalidMode(String(m))))
      ) as Effect.Effect<void, CameraError, never>
    }),

  update: (deltaTime: unknown, targetPosition: unknown): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validDeltaTime = yield* validateNumber(deltaTime, 'deltaTime')
      const validTargetPosition = yield* validateVector3(targetPosition, 'targetPosition')

      const state = yield* Ref.get(stateRef)
      const camera = yield* ensureCameraExists(state, 'update')

      // スムージングファクターの計算
      const smoothingFactor = 1.0 - Math.pow(1.0 - state.config.smoothing, validDeltaTime * 60)

      // 位置のスムージング
      state.smoothedPosition.x = lerp(state.smoothedPosition.x, validTargetPosition.x, smoothingFactor)
      state.smoothedPosition.y = lerp(state.smoothedPosition.y, validTargetPosition.y + 1.7, smoothingFactor)
      state.smoothedPosition.z = lerp(state.smoothedPosition.z, validTargetPosition.z, smoothingFactor)

      // カメラ位置の更新
      camera.position.set(state.smoothedPosition.x, state.smoothedPosition.y, state.smoothedPosition.z)

      // 状態の更新
      const newState: FirstPersonState = {
        ...state,
        targetPosition: validTargetPosition,
        state: {
          ...state.state,
          position: {
            x: state.smoothedPosition.x,
            y: state.smoothedPosition.y,
            z: state.smoothedPosition.z,
          },
          target: {
            x: validTargetPosition.x,
            y: validTargetPosition.y + 1.7,
            z: validTargetPosition.z,
          },
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  rotate: (deltaX: unknown, deltaY: unknown): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validDeltaX = yield* validateNumber(deltaX, 'deltaX')
      const validDeltaY = yield* validateNumber(deltaY, 'deltaY')

      const state = yield* Ref.get(stateRef)
      const camera = yield* ensureCameraExists(state, 'rotate')

      // マウス感度を適用
      const sensitivityFactor = state.config.sensitivity * 0.002
      const rotationX = validDeltaX * sensitivityFactor
      const rotationY = validDeltaY * sensitivityFactor

      // 新しいヨーとピッチを計算
      const newYaw = normalizeYaw(state.state.rotation.yaw - rotationX)
      const newPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, state.state.rotation.pitch - rotationY))

      // カメラの回転を更新
      camera.rotation.order = 'YXZ'
      camera.rotation.y = newYaw
      camera.rotation.x = newPitch

      // 状態の更新
      const newState: FirstPersonState = {
        ...state,
        state: {
          ...state.state,
          rotation: {
            yaw: newYaw,
            pitch: newPitch,
          },
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  setFOV: (fov: unknown): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validFov = yield* validateNumber(fov, 'fov')
      const state = yield* Ref.get(stateRef)
      const camera = yield* ensureCameraExists(state, 'setFOV')

      // FOVの範囲チェック
      const clampedFov = Math.max(30, Math.min(120, validFov))

      camera.fov = clampedFov
      camera.updateProjectionMatrix()

      const newState: FirstPersonState = {
        ...state,
        config: {
          ...state.config,
          fov: clampedFov,
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  setSensitivity: (sensitivity: unknown): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validSensitivity = yield* validateNumber(sensitivity, 'sensitivity')
      const state = yield* Ref.get(stateRef)

      // Clamp sensitivity to valid range [0.1, 10.0]
      const clampedSensitivity = Math.max(0.1, Math.min(10.0, validSensitivity))

      const newState: FirstPersonState = {
        ...state,
        config: {
          ...state.config,
          sensitivity: clampedSensitivity,
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  setThirdPersonDistance: (distance: unknown): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validDistance = yield* validateNumber(distance, 'distance')
      // ファーストパーソンモードでは距離設定は無効
      yield* Effect.succeed(undefined)
    }),

  setSmoothing: (smoothing: unknown): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validSmoothing = yield* validateNumber(smoothing, 'smoothing')
      const state = yield* Ref.get(stateRef)

      const newState: FirstPersonState = {
        ...state,
        config: {
          ...state.config,
          smoothing: Math.max(0, Math.min(1, validSmoothing)),
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  getState: (): Effect.Effect<CameraState, never> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return state.state
    }),

  getConfig: (): Effect.Effect<CameraConfig, never> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return state.config
    }),

  getCamera: (): Effect.Effect<THREE.PerspectiveCamera | null, never> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return state.camera
    }),

  reset: (): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const camera = yield* ensureCameraExists(state, 'reset')

      // カメラを初期状態にリセット
      camera.position.set(0, 1.7, 0)
      camera.rotation.set(0, 0, 0)
      camera.rotation.order = 'YXZ'

      const newState: FirstPersonState = {
        ...state,
        state: {
          position: { x: 0, y: 1.7, z: 0 },
          rotation: { pitch: 0, yaw: 0 },
          target: { x: 0, y: 1.7, z: 0 },
        },
        targetPosition: { x: 0, y: 0, z: 0 },
        smoothedPosition: { x: 0, y: 1.7, z: 0 },
      }

      yield* Ref.set(stateRef, newState)
    }),

  updateAspectRatio: (width: unknown, height: unknown): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validWidth = yield* validateNumber(width, 'width')
      const validHeight = yield* validateNumber(height, 'height')
      const state = yield* Ref.get(stateRef)
      const camera = yield* ensureCameraExists(state, 'updateAspectRatio')
      camera.aspect = validWidth / validHeight
      camera.updateProjectionMatrix()
    }),

  dispose: (): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      yield* pipe(
        Option.fromNullable(state.camera),
        Option.match({
          onNone: () => Effect.succeed(undefined),
          onSome: (camera) =>
            Effect.sync(() => {
              // Three.jsカメラのリソースをクリア
              camera.clear()
            }),
        })
      )

      // 状態をリセット
      const newState: FirstPersonState = {
        camera: null,
        config: DEFAULT_CAMERA_CONFIG,
        state: {
          position: { x: 0, y: 1.7, z: 0 },
          rotation: { pitch: 0, yaw: 0 },
          target: { x: 0, y: 0, z: 0 },
        },
        targetPosition: { x: 0, y: 0, z: 0 },
        smoothedPosition: { x: 0, y: 1.7, z: 0 },
      }

      yield* Ref.set(stateRef, newState)
    }),
})

/**
 * FirstPersonCameraLive - 一人称カメラサービスのLayer
 */
export const FirstPersonCameraLive = Layer.effect(
  CameraService,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<FirstPersonState>({
      camera: null,
      config: DEFAULT_CAMERA_CONFIG,
      state: {
        position: { x: 0, y: 1.7, z: 0 },
        rotation: { pitch: 0, yaw: 0 },
        target: { x: 0, y: 0, z: 0 },
      },
      targetPosition: { x: 0, y: 0, z: 0 },
      smoothedPosition: { x: 0, y: 1.7, z: 0 },
    })

    return createFirstPersonCameraService(stateRef)
  })
)
