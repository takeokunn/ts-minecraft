import { Effect, Layer, Ref } from 'effect'
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
 * 三人称カメラの内部状態
 */
interface ThirdPersonState {
  camera: THREE.PerspectiveCamera | null
  config: CameraConfig
  state: CameraState
  targetPosition: { x: number; y: number; z: number }
  smoothedPosition: { x: number; y: number; z: number }
  smoothedTarget: { x: number; y: number; z: number }
  spherical: {
    radius: number
    theta: number // 水平角度
    phi: number // 垂直角度
  }
}

/**
 * 角度を正規化（-π から π の範囲に収める）
 */
const normalizeAngle = (angle: number): number => {
  const twoPi = Math.PI * 2
  const normalized = angle % twoPi
  if (normalized > Math.PI) return normalized - twoPi
  if (normalized < -Math.PI) return normalized + twoPi
  return normalized
}

/**
 * 線形補間
 */
const lerp = (start: number, end: number, factor: number): number => {
  return start + (end - start) * factor
}

/**
 * 3D線形補間
 */
const lerp3D = (
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  factor: number
): { x: number; y: number; z: number } => ({
  x: lerp(start.x, end.x, factor),
  y: lerp(start.y, end.y, factor),
  z: lerp(start.z, end.z, factor),
})

/**
 * 球面座標からデカルト座標への変換
 */
const sphericalToCartesian = (
  spherical: { radius: number; theta: number; phi: number },
  target: { x: number; y: number; z: number }
): { x: number; y: number; z: number } => {
  const sinPhiRadius = Math.sin(spherical.phi) * spherical.radius
  return {
    x: target.x + sinPhiRadius * Math.sin(spherical.theta),
    y: target.y + Math.cos(spherical.phi) * spherical.radius,
    z: target.z + sinPhiRadius * Math.cos(spherical.theta),
  }
}

/**
 * ThirdPersonCameraサービスの実装を作成
 */
const createThirdPersonCameraService = (stateRef: Ref.Ref<ThirdPersonState>): CameraService => ({
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
          // 初期位置設定（プレイヤーの後方上方）
          const initialPos = sphericalToCartesian(
            {
              radius: config.thirdPersonDistance,
              theta: config.thirdPersonAngle,
              phi: Math.PI / 3, // 60度の見下ろし角
            },
            { x: 0, y: config.thirdPersonHeight, z: 0 }
          )
          cam.position.set(initialPos.x, initialPos.y, initialPos.z)
          cam.lookAt(0, config.thirdPersonHeight, 0)
          return cam
        },
        catch: (error) =>
          new CameraError({
            message: 'カメラの初期化に失敗しました',
            cause: error,
          }),
      })

      const initialState: ThirdPersonState = {
        camera,
        config,
        state: {
          position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
          },
          rotation: { pitch: Math.PI / 3 - Math.PI / 2, yaw: config.thirdPersonAngle },
          target: { x: 0, y: config.thirdPersonHeight, z: 0 },
        },
        targetPosition: { x: 0, y: 0, z: 0 },
        smoothedPosition: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
        },
        smoothedTarget: { x: 0, y: config.thirdPersonHeight, z: 0 },
        spherical: {
          radius: config.thirdPersonDistance,
          theta: config.thirdPersonAngle,
          phi: Math.PI / 3,
        },
      }

      yield* Ref.set(stateRef, initialState)
      return camera
    }),

  switchMode: (mode: CameraMode): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      if (mode !== 'first-person' && mode !== 'third-person') {
        yield* Effect.fail(
          new CameraError({
            message: `無効なカメラモード: ${mode}`,
          })
        )
      }

      // 三人称モードへの切り替え処理
      if (mode === 'third-person' && state.config.mode !== 'third-person') {
        const newConfig = { ...state.config, mode }
        const newState: ThirdPersonState = {
          ...state,
          config: newConfig,
        }
        yield* Ref.set(stateRef, newState)
      }
    }),

  update: (deltaTime: number, targetPosition: { x: number; y: number; z: number }): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      if (!state.camera) {
        yield* Effect.fail(
          new CameraError({
            message: 'カメラが初期化されていません',
          })
        )
      }

      // スムージングファクターの計算
      const smoothingFactor = 1.0 - Math.pow(1.0 - state.config.smoothing, deltaTime * 60)

      // ターゲット位置のスムージング
      const targetWithHeight = {
        x: targetPosition.x,
        y: targetPosition.y + state.config.thirdPersonHeight,
        z: targetPosition.z,
      }
      state.smoothedTarget = lerp3D(state.smoothedTarget, targetWithHeight, smoothingFactor)

      // カメラ位置の計算（球面座標を使用）
      const desiredPosition = sphericalToCartesian(state.spherical, state.smoothedTarget)

      // カメラ位置のスムージング
      state.smoothedPosition = lerp3D(state.smoothedPosition, desiredPosition, smoothingFactor)

      // カメラの更新
      state.camera!.position.set(state.smoothedPosition.x, state.smoothedPosition.y, state.smoothedPosition.z)
      state.camera!.lookAt(state.smoothedTarget.x, state.smoothedTarget.y, state.smoothedTarget.z)

      // 状態の更新
      const newState: ThirdPersonState = {
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
            x: state.smoothedTarget.x,
            y: state.smoothedTarget.y,
            z: state.smoothedTarget.z,
          },
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  rotate: (deltaX: number, deltaY: number): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      if (!state.camera) {
        yield* Effect.fail(
          new CameraError({
            message: 'カメラが初期化されていません',
          })
        )
      }

      // マウス感度を適用
      const sensitivityFactor = state.config.sensitivity * 0.002
      const thetaDelta = -deltaX * sensitivityFactor
      const phiDelta = deltaY * sensitivityFactor

      // 新しい球面座標を計算
      const newTheta = normalizeAngle(state.spherical.theta + thetaDelta)
      const newPhi = Math.max(0.1, Math.min(Math.PI - 0.1, state.spherical.phi + phiDelta))

      // 球面座標の更新
      state.spherical.theta = newTheta
      state.spherical.phi = newPhi

      // 状態の更新
      const newState: ThirdPersonState = {
        ...state,
        state: {
          ...state.state,
          rotation: {
            yaw: newTheta,
            pitch: newPhi - Math.PI / 2, // ピッチを-90度から90度の範囲に変換
          },
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  setFOV: (fov: number): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      if (!state.camera) {
        yield* Effect.fail(
          new CameraError({
            message: 'カメラが初期化されていません',
          })
        )
      }

      // FOVの範囲チェック
      const clampedFov = Math.max(30, Math.min(120, fov))

      state.camera!.fov = clampedFov
      state.camera!.updateProjectionMatrix()

      const newState: ThirdPersonState = {
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

      const newState: ThirdPersonState = {
        ...state,
        config: {
          ...state.config,
          sensitivity: clampedSensitivity,
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  setThirdPersonDistance: (distance: number): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      // 距離の範囲チェック
      const clampedDistance = Math.max(1, Math.min(50, distance))

      state.spherical.radius = clampedDistance

      const newState: ThirdPersonState = {
        ...state,
        config: {
          ...state.config,
          thirdPersonDistance: clampedDistance,
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  setSmoothing: (smoothing: number): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      // スムージングの範囲チェック
      const clampedSmoothing = Math.max(0, Math.min(1, smoothing))

      const newState: ThirdPersonState = {
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

      if (!state.camera) {
        yield* Effect.fail(
          new CameraError({
            message: 'カメラが初期化されていません',
          })
        )
      }

      // 球面座標をリセット
      state.spherical = {
        radius: state.config.thirdPersonDistance,
        theta: state.config.thirdPersonAngle,
        phi: Math.PI / 3,
      }

      // カメラを初期状態にリセット
      const initialPos = sphericalToCartesian(state.spherical, { x: 0, y: state.config.thirdPersonHeight, z: 0 })
      state.camera!.position.set(initialPos.x, initialPos.y, initialPos.z)
      state.camera!.lookAt(0, state.config.thirdPersonHeight, 0)

      const newState: ThirdPersonState = {
        ...state,
        state: {
          position: {
            x: initialPos.x,
            y: initialPos.y,
            z: initialPos.z,
          },
          rotation: { pitch: state.spherical.phi - Math.PI / 2, yaw: state.spherical.theta },
          target: { x: 0, y: state.config.thirdPersonHeight, z: 0 },
        },
        targetPosition: { x: 0, y: 0, z: 0 },
        smoothedPosition: {
          x: initialPos.x,
          y: initialPos.y,
          z: initialPos.z,
        },
        smoothedTarget: { x: 0, y: state.config.thirdPersonHeight, z: 0 },
      }

      yield* Ref.set(stateRef, newState)
    }),

  updateAspectRatio: (width: number, height: number): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      if (!state.camera) {
        yield* Effect.fail(
          new CameraError({
            message: 'カメラが初期化されていません',
          })
        )
      }

      state.camera!.aspect = width / height
      state.camera!.updateProjectionMatrix()
    }),

  dispose: (): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      if (state.camera) {
        // Three.jsカメラのリソースをクリア
        state.camera.clear()
      }

      // 状態をリセット
      const initialConfig = { ...DEFAULT_CAMERA_CONFIG, mode: 'third-person' as CameraMode }
      const newState: ThirdPersonState = {
        camera: null,
        config: initialConfig,
        state: {
          position: { x: 0, y: 0, z: 0 },
          rotation: { pitch: Math.PI / 3 - Math.PI / 2, yaw: initialConfig.thirdPersonAngle },
          target: { x: 0, y: 0, z: 0 },
        },
        targetPosition: { x: 0, y: 0, z: 0 },
        smoothedPosition: { x: 0, y: 0, z: 0 },
        smoothedTarget: { x: 0, y: 0, z: 0 },
        spherical: {
          radius: initialConfig.thirdPersonDistance,
          theta: initialConfig.thirdPersonAngle,
          phi: Math.PI / 3,
        },
      }

      yield* Ref.set(stateRef, newState)
    }),
})

/**
 * ThirdPersonCameraLive - 三人称視点カメラの実装
 *
 * Issue #130: P1-007 Camera System
 * - 三人称視点の実装
 * - スムーズな動作
 * - 距離調整機能
 * - FOV調整機能
 */
export const ThirdPersonCameraLive = Layer.effect(
  CameraService,
  Effect.gen(function* () {
    const initialConfig = { ...DEFAULT_CAMERA_CONFIG, mode: 'third-person' as CameraMode }
    const stateRef = yield* Ref.make<ThirdPersonState>({
      camera: null,
      config: initialConfig,
      state: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { pitch: 0, yaw: 0 },
        target: { x: 0, y: 0, z: 0 },
      },
      targetPosition: { x: 0, y: 0, z: 0 },
      smoothedPosition: { x: 0, y: 0, z: 0 },
      smoothedTarget: { x: 0, y: 0, z: 0 },
      spherical: {
        radius: initialConfig.thirdPersonDistance,
        theta: initialConfig.thirdPersonAngle,
        phi: Math.PI / 3,
      },
    })

    return createThirdPersonCameraService(stateRef)
  })
)
