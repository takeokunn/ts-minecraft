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
 * カメラの存在を検証するヘルパー
 */
const ensureCameraExists = (state: ThirdPersonState): Effect.Effect<THREE.PerspectiveCamera, CameraError> =>
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
        config: { ...config, mode: 'third-person' as CameraMode },
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
        smoothedPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
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

  switchMode: (mode: CameraMode): Effect.Effect<void, CameraError, never> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      return yield* pipe(
        mode,
        Match.value,
        Match.when(
          'third-person',
          (): Effect.Effect<void, CameraError> =>
            pipe(
              state.config.mode,
              Match.value,
              Match.when('third-person', (): Effect.Effect<void, CameraError> => Effect.succeed(undefined)),
              Match.orElse((): Effect.Effect<void, CameraError> => {
                const newConfig = { ...state.config, mode }
                const newState: ThirdPersonState = {
                  ...state,
                  config: newConfig,
                }
                return Ref.set(stateRef, newState)
              })
            )
        ),
        Match.when('first-person', (): Effect.Effect<void, CameraError> => Effect.succeed(undefined)), // 三人称カメラでは一人称モードを無視
        Match.orElse(
          (m): Effect.Effect<void, CameraError> =>
            Effect.fail(
              new CameraError({
                message: `無効なカメラモード: ${m}`,
              })
            )
        )
      ) as Effect.Effect<void, CameraError, never>
    }),

  update: (deltaTime: number, targetPosition: { x: number; y: number; z: number }): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const camera = yield* ensureCameraExists(state)

      // スムージングファクターの計算
      const smoothingFactor = 1.0 - Math.pow(1.0 - state.config.smoothing, deltaTime * 60)

      // ターゲット位置のスムージング
      state.smoothedTarget = lerp3D(
        state.smoothedTarget,
        { x: targetPosition.x, y: targetPosition.y + state.config.thirdPersonHeight, z: targetPosition.z },
        smoothingFactor
      )

      // カメラ位置の計算（球面座標系）
      const desiredPosition = sphericalToCartesian(state.spherical, state.smoothedTarget)

      // カメラ位置のスムージング
      state.smoothedPosition = lerp3D(state.smoothedPosition, desiredPosition, smoothingFactor)

      // カメラの更新
      camera.position.set(state.smoothedPosition.x, state.smoothedPosition.y, state.smoothedPosition.z)
      camera.lookAt(state.smoothedTarget.x, state.smoothedTarget.y, state.smoothedTarget.z)

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
      const camera = yield* ensureCameraExists(state)

      // マウス感度を適用
      const sensitivityFactor = state.config.sensitivity * 0.002
      const thetaDelta = -deltaX * sensitivityFactor
      const phiDelta = deltaY * sensitivityFactor

      // 新しい角度を計算
      const newTheta = normalizeAngle(state.spherical.theta + thetaDelta)
      const newPhi = Math.max(0.1, Math.min(Math.PI - 0.1, state.spherical.phi + phiDelta))

      // 球面座標の更新
      state.spherical.theta = newTheta
      state.spherical.phi = newPhi

      // カメラ位置の再計算
      const newPosition = sphericalToCartesian(state.spherical, state.smoothedTarget)
      camera.position.set(newPosition.x, newPosition.y, newPosition.z)
      camera.lookAt(state.smoothedTarget.x, state.smoothedTarget.y, state.smoothedTarget.z)

      // 状態の更新
      const newState: ThirdPersonState = {
        ...state,
        smoothedPosition: newPosition,
        state: {
          ...state.state,
          rotation: {
            yaw: newTheta,
            pitch: newPhi - Math.PI / 2,
          },
          position: newPosition,
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
      const clampedDistance = Math.max(1, Math.min(20, distance))

      state.spherical.radius = clampedDistance

      // カメラが存在する場合のみ位置を更新
      yield* pipe(
        Option.fromNullable(state.camera),
        Option.match({
          onNone: () => Effect.succeed(undefined),
          onSome: (camera) =>
            Effect.sync(() => {
              // カメラ位置の再計算
              const newPosition = sphericalToCartesian(state.spherical, state.smoothedTarget)
              camera.position.set(newPosition.x, newPosition.y, newPosition.z)
              camera.lookAt(state.smoothedTarget.x, state.smoothedTarget.y, state.smoothedTarget.z)
              state.smoothedPosition = newPosition
            }),
        })
      )

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
      const camera = yield* ensureCameraExists(state)

      // デフォルトの球面座標
      const defaultSpherical = {
        radius: state.config.thirdPersonDistance,
        theta: state.config.thirdPersonAngle,
        phi: Math.PI / 3,
      }

      // デフォルトのターゲット位置
      const defaultTarget = { x: 0, y: state.config.thirdPersonHeight, z: 0 }

      // カメラ位置の再計算
      const defaultPosition = sphericalToCartesian(defaultSpherical, defaultTarget)

      camera.position.set(defaultPosition.x, defaultPosition.y, defaultPosition.z)
      camera.lookAt(defaultTarget.x, defaultTarget.y, defaultTarget.z)

      const newState: ThirdPersonState = {
        ...state,
        state: {
          position: defaultPosition,
          rotation: { pitch: defaultSpherical.phi - Math.PI / 2, yaw: defaultSpherical.theta },
          target: defaultTarget,
        },
        targetPosition: { x: 0, y: 0, z: 0 },
        smoothedPosition: defaultPosition,
        smoothedTarget: defaultTarget,
        spherical: defaultSpherical,
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
      const newState: ThirdPersonState = {
        camera: null,
        config: { ...DEFAULT_CAMERA_CONFIG, mode: 'third-person' as CameraMode },
        state: {
          position: { x: 5, y: 5, z: 5 },
          rotation: { pitch: 0, yaw: 0 },
          target: { x: 0, y: 0, z: 0 },
        },
        targetPosition: { x: 0, y: 0, z: 0 },
        smoothedPosition: { x: 5, y: 5, z: 5 },
        smoothedTarget: { x: 0, y: 0, z: 0 },
        spherical: {
          radius: DEFAULT_CAMERA_CONFIG.thirdPersonDistance,
          theta: DEFAULT_CAMERA_CONFIG.thirdPersonAngle,
          phi: Math.PI / 3,
        },
      }

      yield* Ref.set(stateRef, newState)
    }),
})

/**
 * ThirdPersonCameraLive - 三人称カメラサービスのLayer
 */
export const ThirdPersonCameraLive = Layer.effect(
  CameraService,
  Effect.gen(function* () {
    const initialPosition = sphericalToCartesian(
      {
        radius: DEFAULT_CAMERA_CONFIG.thirdPersonDistance,
        theta: DEFAULT_CAMERA_CONFIG.thirdPersonAngle,
        phi: Math.PI / 3,
      },
      { x: 0, y: DEFAULT_CAMERA_CONFIG.thirdPersonHeight, z: 0 }
    )

    const stateRef = yield* Ref.make<ThirdPersonState>({
      camera: null,
      config: { ...DEFAULT_CAMERA_CONFIG, mode: 'third-person' as CameraMode },
      state: {
        position: initialPosition,
        rotation: { pitch: Math.PI / 3 - Math.PI / 2, yaw: DEFAULT_CAMERA_CONFIG.thirdPersonAngle },
        target: { x: 0, y: DEFAULT_CAMERA_CONFIG.thirdPersonHeight, z: 0 },
      },
      targetPosition: { x: 0, y: 0, z: 0 },
      smoothedPosition: initialPosition,
      smoothedTarget: { x: 0, y: DEFAULT_CAMERA_CONFIG.thirdPersonHeight, z: 0 },
      spherical: {
        radius: DEFAULT_CAMERA_CONFIG.thirdPersonDistance,
        theta: DEFAULT_CAMERA_CONFIG.thirdPersonAngle,
        phi: Math.PI / 3,
      },
    })

    return createThirdPersonCameraService(stateRef)
  })
)
