import { Effect, Layer, Ref, Match, Option, pipe } from 'effect'
import * as THREE from 'three'
import {
  CameraService,
  CameraConfig,
  CameraState,
  CameraError,
  CameraMode,
  DEFAULT_CAMERA_CONFIG,
} from './CameraService.js'

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
 * カメラの存在を検証するヘルパー
 */
const ensureCameraExists = (state: FirstPersonState): Effect.Effect<THREE.PerspectiveCamera, CameraError> =>
  pipe(
    Option.fromNullable(state.camera),
    Option.match({
      onNone: () =>
        Effect.fail(
          new CameraError({
            message: 'カメラが初期化されていません',
          })
        ),
      onSome: (camera) => Effect.succeed(camera),
    })
  )

/**
 * FirstPersonCameraサービスの実装を作成
 */
const createFirstPersonCameraService = (stateRef: Ref.Ref<FirstPersonState>): CameraService => ({
  initialize: (config: CameraConfig): Effect.Effect<THREE.PerspectiveCamera, CameraError> =>
    Effect.gen(function* () {
      const camera = yield* Effect.try({
        try: () => {
          const cam = new THREE.PerspectiveCamera(
            config.fov,
            window.innerWidth / window.innerHeight,
            config.near,
            config.far
          )
          // 初期位置設定
          cam.position.set(0, 1.7, 0) // プレイヤーの目の高さ
          cam.rotation.order = 'YXZ' // ヨー→ピッチの順で回転
          return cam
        },
        catch: (error) =>
          new CameraError({
            message: 'カメラの初期化に失敗しました',
            cause: error,
          }),
      })

      const initialState: FirstPersonState = {
        camera,
        config,
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

  switchMode: (mode: CameraMode): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      yield* pipe(
        mode,
        Match.value,
        Match.when('first-person', () =>
          pipe(
            state.config.mode,
            Match.value,
            Match.when('first-person', () => Effect.succeed(undefined)),
            Match.orElse(() => {
              const newConfig = { ...state.config, mode }
              const newState: FirstPersonState = {
                ...state,
                config: newConfig,
              }
              return Ref.set(stateRef, newState)
            })
          )
        ),
        Match.when('third-person', () => Effect.succeed(undefined)), // 一人称カメラでは三人称モードを無視
        Match.orElse((m) =>
          Effect.fail(
            new CameraError({
              message: `無効なカメラモード: ${m}`,
            })
          )
        )
      )
    }),

  update: (deltaTime: number, targetPosition: { x: number; y: number; z: number }): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const camera = yield* ensureCameraExists(state)

      // スムージングファクターの計算
      const smoothingFactor = 1.0 - Math.pow(1.0 - state.config.smoothing, deltaTime * 60)

      // 位置のスムージング
      state.smoothedPosition.x = lerp(state.smoothedPosition.x, targetPosition.x, smoothingFactor)
      state.smoothedPosition.y = lerp(state.smoothedPosition.y, targetPosition.y + 1.7, smoothingFactor)
      state.smoothedPosition.z = lerp(state.smoothedPosition.z, targetPosition.z, smoothingFactor)

      // カメラ位置の更新
      camera.position.set(state.smoothedPosition.x, state.smoothedPosition.y, state.smoothedPosition.z)

      // 状態の更新
      const newState: FirstPersonState = {
        ...state,
        targetPosition,
        state: {
          ...state.state,
          position: {
            x: state.smoothedPosition.x,
            y: state.smoothedPosition.y,
            z: state.smoothedPosition.z,
          },
          target: {
            x: targetPosition.x,
            y: targetPosition.y + 1.7,
            z: targetPosition.z,
          },
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  rotate: (deltaX: number, deltaY: number): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const camera = yield* ensureCameraExists(state)

      // マウス感度を適用
      const sensitivityFactor = state.config.sensitivity * 0.002
      const yawDelta = -deltaX * sensitivityFactor
      const pitchDelta = -deltaY * sensitivityFactor

      // 新しい回転値を計算
      const newYaw = normalizeYaw(state.state.rotation.yaw + yawDelta)
      const newPitch = Math.max(
        -Math.PI / 2 + 0.01,
        Math.min(Math.PI / 2 - 0.01, state.state.rotation.pitch + pitchDelta)
      )

      // カメラの回転を更新
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

  setFOV: (fov: number): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const camera = yield* ensureCameraExists(state)

      // FOVの範囲チェック
      const clampedFov = Math.max(30, Math.min(120, fov))

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

  setSensitivity: (sensitivity: number): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      // 感度の範囲チェック
      const clampedSensitivity = Math.max(0.1, Math.min(10, sensitivity))

      const newState: FirstPersonState = {
        ...state,
        config: {
          ...state.config,
          sensitivity: clampedSensitivity,
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  setThirdPersonDistance: (_distance: number): Effect.Effect<void, CameraError> =>
    // 一人称視点では無効
    Effect.succeed(undefined),

  setSmoothing: (smoothing: number): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      // スムージングの範囲チェック
      const clampedSmoothing = Math.max(0, Math.min(1, smoothing))

      const newState: FirstPersonState = {
        ...state,
        config: {
          ...state.config,
          smoothing: clampedSmoothing,
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
      const camera = yield* ensureCameraExists(state)

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

  updateAspectRatio: (width: number, height: number): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const camera = yield* ensureCameraExists(state)

      camera.aspect = width / height
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
