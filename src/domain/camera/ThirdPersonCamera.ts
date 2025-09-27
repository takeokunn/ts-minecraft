import * as Schema from '@effect/schema/Schema'
import { Effect, Layer, Match, Option, pipe, Ref } from 'effect'
import * as THREE from 'three'
import type { Vector3 } from './CameraService'
import {
  CameraConfig,
  CameraError,
  CameraMode,
  CameraService,
  CameraState,
  createCameraError,
  DEFAULT_CAMERA_CONFIG,
  validateCameraConfig,
  validateCameraMode,
  Vector3Schema,
} from './CameraService'

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
 * カメラの存在を検証するヘルパー - 型安全性強化
 */
const ensureCameraExists = (
  state: ThirdPersonState,
  operation?: string
): Effect.Effect<THREE.PerspectiveCamera, CameraError> =>
  pipe(
    Option.fromNullable(state.camera),
    Option.match({
      onNone: () => Effect.fail(createCameraError.notInitialized(operation || 'camera operation')),
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
 * ThirdPersonCameraサービスの実装を作成
 */
const createThirdPersonCameraService = (stateRef: Ref.Ref<ThirdPersonState>): CameraService => ({
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
          // 初期位置設定（プレイヤーの後方上方）
          const initialPos = sphericalToCartesian(
            {
              radius: validatedConfig.thirdPersonDistance,
              theta: validatedConfig.thirdPersonAngle,
              phi: Math.PI / 3, // 60度の見下ろし角
            },
            { x: 0, y: validatedConfig.thirdPersonHeight, z: 0 }
          )
          cam.position.set(initialPos.x, initialPos.y, initialPos.z)
          cam.lookAt(0, validatedConfig.thirdPersonHeight, 0)
          return cam
        },
        catch: (error) => createCameraError.initializationFailed('カメラの初期化に失敗しました', error),
      })

      const initialState: ThirdPersonState = {
        camera,
        config: { ...validatedConfig, mode: 'third-person' as CameraMode },
        state: {
          position: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
          },
          rotation: { pitch: Math.PI / 3 - Math.PI / 2, yaw: validatedConfig.thirdPersonAngle },
          target: { x: 0, y: validatedConfig.thirdPersonHeight, z: 0 },
        },
        targetPosition: { x: 0, y: 0, z: 0 },
        smoothedPosition: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        smoothedTarget: { x: 0, y: validatedConfig.thirdPersonHeight, z: 0 },
        spherical: {
          radius: validatedConfig.thirdPersonDistance,
          theta: validatedConfig.thirdPersonAngle,
          phi: Math.PI / 3,
        },
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
          'third-person',
          (): Effect.Effect<void, CameraError> =>
            pipe(
              state.config.mode,
              Match.value,
              Match.when('third-person', (): Effect.Effect<void, CameraError> => Effect.succeed(undefined)),
              Match.orElse((): Effect.Effect<void, CameraError> => {
                const newConfig = { ...state.config, mode: validatedMode }
                const newState: ThirdPersonState = {
                  ...state,
                  config: newConfig,
                }
                return Ref.set(stateRef, newState)
              })
            )
        ),
        Match.when('first-person', (): Effect.Effect<void, CameraError> => Effect.succeed(undefined)), // 三人称カメラでは一人称モードを無視
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

      // ターゲット位置のスムージング
      state.smoothedTarget = lerp3D(
        state.smoothedTarget,
        {
          x: validTargetPosition.x,
          y: validTargetPosition.y + state.config.thirdPersonHeight,
          z: validTargetPosition.z,
        },
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
        targetPosition: validTargetPosition,
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

      // 球面座標を更新（アジマス角と極角）
      state.spherical.theta = normalizeAngle(state.spherical.theta - rotationX)
      state.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, state.spherical.phi - rotationY))

      // 新しい回転値の計算
      const yaw = state.spherical.theta
      const pitch = state.spherical.phi - Math.PI / 2

      // 状態の更新
      const newState: ThirdPersonState = {
        ...state,
        state: {
          ...state.state,
          rotation: {
            yaw,
            pitch,
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

      const newState: ThirdPersonState = {
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

      const newState: ThirdPersonState = {
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
      const state = yield* Ref.get(stateRef)

      const newState: ThirdPersonState = {
        ...state,
        config: {
          ...state.config,
          thirdPersonDistance: Math.max(1, Math.min(20, validDistance)),
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  setSmoothing: (smoothing: unknown): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validSmoothing = yield* validateNumber(smoothing, 'smoothing')
      const state = yield* Ref.get(stateRef)

      const newState: ThirdPersonState = {
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
