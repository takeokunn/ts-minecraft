import type { CameraConfig, CameraError, CameraSnapshot, CameraState } from '@domain/camera/types'
import {
  CameraVector3Schema,
  createCameraError,
  DEFAULT_CAMERA_CONFIG,
  makeCameraSync,
  validateCameraConfig,
  validateCameraMode,
} from './index'
import * as Schema from '@effect/schema/Schema'
import { Effect, Layer, Match, pipe, Ref } from 'effect'
import type {
  CameraConfigInput,
  CameraDistanceInput,
  CameraModeInput,
  CameraService,
  DeltaTimeInput,
  FOVInput,
  MouseDeltaInput,
  Position3DInput,
  SensitivityInput,
  SmoothingInput,
} from './service'

/**
 * 一人称カメラの内部状態
 */
interface FirstPersonState {
  initialized: boolean
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
const ensureInitialized = (state: FirstPersonState, operation: string): Effect.Effect<FirstPersonState, CameraError> =>
  pipe(
    state.initialized,
    Match.value,
    Match.when(
      false,
      () => Effect.fail(createCameraError.notInitialized(operation))
    ),
    Match.orElse(() => Effect.succeed(state))
  )

/**
 * 数値パラメータ検証ヘルパー
 */
const validateNumber = (value: number, parameterName: string): Effect.Effect<number, CameraError> =>
  pipe(
    Schema.decodeUnknown(Schema.Number)(value),
    Effect.mapError(() => createCameraError.invalidParameter(parameterName, value))
  )

/**
 * Vector3位置情報の検証
 */
const validateVector3 = (
  position: Position3DInput,
  paramName: string = 'position'
): Effect.Effect<{ x: number; y: number; z: number }, CameraError> => {
  return pipe(
    position,
    Schema.decodeUnknown(CameraVector3Schema),
    Effect.mapError(() => createCameraError.invalidParameter(paramName, position, 'Vector3 with x, y, z coordinates'))
  )
}

const createQuaternion = (pitch: number, yaw: number) => {
  const halfPitch = pitch / 2
  const halfYaw = yaw / 2
  const cosPitch = Math.cos(halfPitch)
  const sinPitch = Math.sin(halfPitch)
  const cosYaw = Math.cos(halfYaw)
  const sinYaw = Math.sin(halfYaw)

  return {
    x: -sinPitch * sinYaw,
    y: sinPitch * cosYaw,
    z: cosPitch * sinYaw,
    w: cosPitch * cosYaw,
  }
}

const toSnapshot = (state: FirstPersonState): CameraSnapshot =>
  makeCameraSync({
    projection: {
      fov: state.config.fov,
      aspect: state.config.aspect,
      near: state.config.near,
      far: state.config.far,
    },
    transform: {
      position: { ...state.state.position },
      target: { ...state.state.target },
      orientation: {
        rotation: {
          pitch: state.state.rotation.pitch,
          yaw: state.state.rotation.yaw,
          roll: 0,
        },
        quaternion: createQuaternion(state.state.rotation.pitch, state.state.rotation.yaw),
      },
    },
  })

/**
 * FirstPersonCameraサービスの実装を作成
 */
const createFirstPersonCameraService = (stateRef: Ref.Ref<FirstPersonState>): CameraService => ({
  initialize: (config: CameraConfigInput): Effect.Effect<CameraSnapshot, CameraError> =>
    Effect.gen(function* () {
      // 設定の検証
      const validatedConfig = yield* validateCameraConfig(config)

      const initialState: FirstPersonState = {
        initialized: true,
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
      return toSnapshot(initialState)
    }),

  switchMode: (mode: CameraModeInput): Effect.Effect<void, CameraError, never> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const validatedMode = yield* validateCameraMode(mode)

      return yield* pipe(
        validatedMode,
        Match.value,
        Match.when('first-person', () =>
          pipe(
            state.config.mode,
            Match.value,
            Match.when('first-person', () => Effect.succeed(undefined)),
            Match.orElse(() => Ref.update(stateRef, (s) => ({ ...s, config: { ...s.config, mode: 'first-person' } })))
          )
        ),
        Match.orElse((m): Effect.Effect<void, CameraError> =>
          Effect.fail(createCameraError.invalidMode(String(m), ['first-person']))
        )
      )
    }),

  update: (deltaTime: DeltaTimeInput, targetPosition: Position3DInput): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validDeltaTime = yield* validateNumber(deltaTime, 'deltaTime')
      const validTargetPosition = yield* validateVector3(targetPosition, 'targetPosition')

      const currentState = yield* Ref.get(stateRef)
      yield* ensureInitialized(currentState, 'update')

      // スムージングファクターの計算
      const smoothingFactor = 1.0 - Math.pow(1.0 - currentState.config.smoothing, validDeltaTime * 60)

      // 位置のスムージング
      const smoothedPosition = {
        x: lerp(currentState.smoothedPosition.x, validTargetPosition.x, smoothingFactor),
        y: lerp(currentState.smoothedPosition.y, validTargetPosition.y + 1.7, smoothingFactor),
        z: lerp(currentState.smoothedPosition.z, validTargetPosition.z, smoothingFactor),
      }

      const newState: FirstPersonState = {
        ...currentState,
        targetPosition: validTargetPosition,
        smoothedPosition,
        state: {
          ...currentState.state,
          position: {
            x: smoothedPosition.x,
            y: smoothedPosition.y,
            z: smoothedPosition.z,
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

  rotate: (deltaX: MouseDeltaInput, deltaY: MouseDeltaInput): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validDeltaX = yield* validateNumber(deltaX, 'deltaX')
      const validDeltaY = yield* validateNumber(deltaY, 'deltaY')

      const state = yield* Ref.get(stateRef)
      yield* ensureInitialized(state, 'rotate')

      // マウス感度を適用
      const sensitivityFactor = state.config.sensitivity * 0.002
      const rotationX = validDeltaX * sensitivityFactor
      const rotationY = validDeltaY * sensitivityFactor

      // 新しいヨーとピッチを計算
      const newYaw = normalizeYaw(state.state.rotation.yaw - rotationX)
      const newPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, state.state.rotation.pitch - rotationY))

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

  setFOV: (fov: FOVInput): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validFov = yield* validateNumber(fov, 'fov')
      const state = yield* Ref.get(stateRef)
      yield* ensureInitialized(state, 'setFOV')

      // FOVの範囲チェック
      const clampedFov = Math.max(30, Math.min(120, validFov))

      const newState: FirstPersonState = {
        ...state,
        config: {
          ...state.config,
          fov: clampedFov,
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  setSensitivity: (sensitivity: SensitivityInput): Effect.Effect<void, CameraError> =>
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

  setThirdPersonDistance: (_distance: CameraDistanceInput): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      yield* validateNumber(_distance, 'distance')
      yield* Effect.succeed(undefined)
    }),

  setSmoothing: (smoothing: SmoothingInput): Effect.Effect<void, CameraError> =>
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

  getCamera: (): Effect.Effect<CameraSnapshot | null, never> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return state.initialized ? toSnapshot(state) : null
    }),

  reset: (): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      yield* ensureInitialized(state, 'reset')

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

  updateAspectRatio: (aspect: number): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validAspect = yield* validateNumber(aspect, 'aspect')
      const state = yield* Ref.get(stateRef)
      yield* ensureInitialized(state, 'updateAspectRatio')

      const newState: FirstPersonState = {
        ...state,
        config: {
          ...state.config,
          aspect: validAspect,
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  dispose: (): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)

      // 状態をリセット
      const newState: FirstPersonState = {
        initialized: false,
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
      initialized: false,
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
