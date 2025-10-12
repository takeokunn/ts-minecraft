import type { CameraConfig, CameraError, CameraMode, CameraSnapshot, CameraState } from '@domain/camera/types'
import * as Schema from '@effect/schema/Schema'
import { Effect, Layer, Match, pipe, Ref } from 'effect'
import {
  CameraVector3Schema,
  createCameraError,
  DEFAULT_CAMERA_CONFIG,
  makeCameraSync,
  validateCameraConfig,
  validateCameraMode,
} from './index'
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

interface ThirdPersonState {
  initialized: boolean
  config: CameraConfig
  state: CameraState
  targetPosition: { x: number; y: number; z: number }
  smoothedPosition: { x: number; y: number; z: number }
  smoothedTarget: { x: number; y: number; z: number }
  spherical: {
    radius: number
    theta: number
    phi: number
  }
}

const normalizeAngle = (angle: number): number => {
  const twoPi = Math.PI * 2
  const normalized = angle % twoPi
  return Match.value(normalized).pipe(
    Match.when(
      (value) => value > Math.PI,
      (value) => value - twoPi
    ),
    Match.when(
      (value) => value < -Math.PI,
      (value) => value + twoPi
    ),
    Match.orElse((value) => value)
  )
}

const lerp = (start: number, end: number, factor: number): number => start + (end - start) * factor

const lerp3D = (
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  factor: number
) => ({
  x: lerp(start.x, end.x, factor),
  y: lerp(start.y, end.y, factor),
  z: lerp(start.z, end.z, factor),
})

const sphericalToCartesian = (
  spherical: { radius: number; theta: number; phi: number },
  target: { x: number; y: number; z: number }
) => {
  const sinPhiRadius = Math.sin(spherical.phi) * spherical.radius
  return {
    x: target.x + sinPhiRadius * Math.sin(spherical.theta),
    y: target.y + Math.cos(spherical.phi) * spherical.radius,
    z: target.z + sinPhiRadius * Math.cos(spherical.theta),
  }
}

const ensureInitialized = (state: ThirdPersonState, operation: string): Effect.Effect<ThirdPersonState, CameraError> =>
  pipe(
    state.initialized,
    Match.value,
    Match.when(false, () => Effect.fail(createCameraError.notInitialized(operation))),
    Match.orElse(() => Effect.succeed(state))
  )

const validateNumber = (value: number, parameterName: string): Effect.Effect<number, CameraError> =>
  pipe(
    Schema.decodeUnknown(Schema.Number)(value),
    Effect.mapError(() => createCameraError.invalidParameter(parameterName, value))
  )

const validateVector3 = (
  position: Position3DInput,
  paramName: string = 'position'
): Effect.Effect<{ x: number; y: number; z: number }, CameraError> =>
  pipe(
    position,
    Schema.decodeUnknown(CameraVector3Schema),
    Effect.mapError(() => createCameraError.invalidParameter(paramName, position, 'Vector3 with x, y, z coordinates'))
  )

const createQuaternion = (pitch: number, yaw: number, roll: number) => {
  const halfPitch = pitch / 2
  const halfYaw = yaw / 2
  const halfRoll = roll / 2

  const sinPitch = Math.sin(halfPitch)
  const cosPitch = Math.cos(halfPitch)
  const sinYaw = Math.sin(halfYaw)
  const cosYaw = Math.cos(halfYaw)
  const sinRoll = Math.sin(halfRoll)
  const cosRoll = Math.cos(halfRoll)

  return {
    x: sinRoll * cosPitch * cosYaw - cosRoll * sinPitch * sinYaw,
    y: cosRoll * sinPitch * cosYaw + sinRoll * cosPitch * sinYaw,
    z: cosRoll * cosPitch * sinYaw - sinRoll * sinPitch * cosYaw,
    w: cosRoll * cosPitch * cosYaw + sinRoll * sinPitch * sinYaw,
  }
}

const normalizeSpherical = (phi: number) => Math.max(0.1, Math.min(Math.PI - 0.1, phi))

const directionToRotation = (
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number }
) => {
  const dx = target.x - position.x
  const dy = target.y - position.y
  const dz = target.z - position.z
  const length = Math.max(Math.hypot(dx, dy, dz), 1e-6)
  const nx = dx / length
  const ny = dy / length
  const nz = dz / length

  const pitch = Math.asin(-ny)
  const yaw = Math.atan2(nx, nz)

  return { pitch, yaw }
}

const toSnapshot = (state: ThirdPersonState): CameraSnapshot =>
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
        quaternion: createQuaternion(state.state.rotation.pitch, state.state.rotation.yaw, 0),
      },
    },
  })

const createDefaultThirdPersonState = (): ThirdPersonState => {
  const config: CameraConfig = { ...DEFAULT_CAMERA_CONFIG, mode: 'third-person' as CameraMode }
  const spherical = {
    radius: config.thirdPersonDistance,
    theta: config.thirdPersonAngle,
    phi: Math.PI / 3,
  }
  const target = { x: 0, y: config.thirdPersonHeight, z: 0 }
  const position = sphericalToCartesian(spherical, target)
  const rotation = directionToRotation(position, target)

  return {
    initialized: false,
    config,
    state: {
      position,
      rotation,
      target,
    },
    targetPosition: { x: 0, y: 0, z: 0 },
    smoothedPosition: position,
    smoothedTarget: target,
    spherical,
  }
}

const createThirdPersonCameraService = (stateRef: Ref.Ref<ThirdPersonState>): CameraService => ({
  initialize: (config: CameraConfigInput): Effect.Effect<CameraSnapshot, CameraError> =>
    Effect.gen(function* () {
      const validatedConfig = yield* validateCameraConfig(config)

      const target = {
        x: 0,
        y: validatedConfig.thirdPersonHeight,
        z: 0,
      }
      const spherical = {
        radius: validatedConfig.thirdPersonDistance,
        theta: validatedConfig.thirdPersonAngle,
        phi: Math.PI / 3,
      }
      const position = sphericalToCartesian(spherical, target)
      const rotation = directionToRotation(position, target)

      const initialState: ThirdPersonState = {
        initialized: true,
        config: { ...validatedConfig, mode: 'third-person' as CameraMode },
        state: {
          position,
          rotation,
          target,
        },
        targetPosition: { x: 0, y: 0, z: 0 },
        smoothedPosition: position,
        smoothedTarget: target,
        spherical,
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
        Match.when('third-person', () =>
          pipe(
            state.config.mode,
            Match.value,
            Match.when('third-person', () => Effect.succeed(undefined)),
            Match.orElse(() =>
              Ref.update(stateRef, (current) => ({
                ...current,
                config: { ...current.config, mode: 'third-person' },
              }))
            )
          )
        ),
        Match.orElse(
          (m): Effect.Effect<void, CameraError> =>
            Effect.fail(createCameraError.invalidMode(String(m), ['third-person']))
        )
      )
    }),

  update: (deltaTime: DeltaTimeInput, targetPosition: Position3DInput): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validDeltaTime = yield* validateNumber(deltaTime, 'deltaTime')
      const validTargetPosition = yield* validateVector3(targetPosition, 'targetPosition')

      const currentState = yield* Ref.get(stateRef)
      yield* ensureInitialized(currentState, 'update')

      const smoothingFactor = 1.0 - Math.pow(1.0 - currentState.config.smoothing, validDeltaTime * 60)

      const target = {
        x: validTargetPosition.x,
        y: validTargetPosition.y + currentState.config.thirdPersonHeight,
        z: validTargetPosition.z,
      }

      const desiredPosition = sphericalToCartesian(currentState.spherical, target)

      const smoothedPosition = lerp3D(currentState.smoothedPosition, desiredPosition, smoothingFactor)
      const smoothedTarget = lerp3D(currentState.smoothedTarget, target, smoothingFactor)
      const rotation = directionToRotation(smoothedPosition, smoothedTarget)

      const newState: ThirdPersonState = {
        ...currentState,
        targetPosition: validTargetPosition,
        smoothedPosition,
        smoothedTarget,
        state: {
          position: smoothedPosition,
          rotation,
          target: smoothedTarget,
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

      const sensitivityFactor = state.config.sensitivity * 0.002
      const rotationX = validDeltaX * sensitivityFactor
      const rotationY = validDeltaY * sensitivityFactor

      const spherical = {
        radius: state.spherical.radius,
        theta: normalizeAngle(state.spherical.theta - rotationX),
        phi: normalizeSpherical(state.spherical.phi - rotationY),
      }

      const target = {
        x: state.targetPosition.x,
        y: state.targetPosition.y + state.config.thirdPersonHeight,
        z: state.targetPosition.z,
      }

      const position = sphericalToCartesian(spherical, target)
      const rotation = directionToRotation(position, target)

      const newState: ThirdPersonState = {
        ...state,
        spherical,
        smoothedPosition: position,
        smoothedTarget: target,
        state: {
          position,
          rotation,
          target,
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  setFOV: (fov: FOVInput): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validFov = yield* validateNumber(fov, 'fov')
      const state = yield* Ref.get(stateRef)
      yield* ensureInitialized(state, 'setFOV')

      const clampedFov = Math.max(30, Math.min(120, validFov))

      yield* Ref.update(stateRef, (current) => ({
        ...current,
        config: {
          ...current.config,
          fov: clampedFov,
        },
      }))
    }),

  setSensitivity: (sensitivity: SensitivityInput): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validSensitivity = yield* validateNumber(sensitivity, 'sensitivity')

      yield* Ref.update(stateRef, (current) => ({
        ...current,
        config: {
          ...current.config,
          sensitivity: Math.max(0.1, Math.min(10.0, validSensitivity)),
        },
      }))
    }),

  setThirdPersonDistance: (distance: CameraDistanceInput): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validDistance = yield* validateNumber(distance, 'distance')
      const clampedDistance = Math.max(1, Math.min(50, validDistance))

      const state = yield* Ref.get(stateRef)
      yield* ensureInitialized(state, 'setThirdPersonDistance')

      const spherical = {
        ...state.spherical,
        radius: clampedDistance,
      }

      const target = {
        x: state.targetPosition.x,
        y: state.targetPosition.y + state.config.thirdPersonHeight,
        z: state.targetPosition.z,
      }

      const position = sphericalToCartesian(spherical, target)
      const rotation = directionToRotation(position, target)

      const newState: ThirdPersonState = {
        ...state,
        spherical,
        smoothedPosition: position,
        smoothedTarget: target,
        config: {
          ...state.config,
          thirdPersonDistance: clampedDistance,
        },
        state: {
          position,
          rotation,
          target,
        },
      }

      yield* Ref.set(stateRef, newState)
    }),

  setSmoothing: (smoothing: SmoothingInput): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validSmoothing = yield* validateNumber(smoothing, 'smoothing')

      yield* Ref.update(stateRef, (current) => ({
        ...current,
        config: {
          ...current.config,
          smoothing: Math.max(0, Math.min(1, validSmoothing)),
        },
      }))
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

      const defaultState = createDefaultThirdPersonState()
      yield* Ref.set(stateRef, { ...defaultState, initialized: true })
    }),

  updateAspectRatio: (aspect: number): Effect.Effect<void, CameraError> =>
    Effect.gen(function* () {
      const validAspect = yield* validateNumber(aspect, 'aspect')

      yield* Ref.update(stateRef, (current) => ({
        ...current,
        config: {
          ...current.config,
          aspect: validAspect,
        },
      }))
    }),

  dispose: (): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const defaultState = createDefaultThirdPersonState()
      yield* Ref.set(stateRef, defaultState)
    }),
})

export const ThirdPersonCameraLive = Layer.effect(
  CameraService,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<ThirdPersonState>(createDefaultThirdPersonState())
    return createThirdPersonCameraService(stateRef)
  })
)
