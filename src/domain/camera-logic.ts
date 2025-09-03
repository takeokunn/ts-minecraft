import { vec3 } from 'gl-matrix'
import { Effect, Match, Option } from 'effect'
import * as S from 'effect/Schema'
import { ParseError } from 'effect/ParseResult'
import { Camera, Position, Target } from './components'
import { Float, toFloat, Vector3, Vector3FloatSchema } from './common'

const PI_HALF = Math.PI / 2

/**
 * Clamps a pitch angle (in radians) to the vertical range [-PI/2, PI/2]
 * to prevent the camera from flipping over.
 * Handles NaN by returning 0.
 * @param pitch The pitch angle to clamp.
 * @returns The clamped pitch angle.
 */
export const clampPitch = (pitch: Float): Effect.Effect<Float, ParseError> => {
  return Match.value(pitch).pipe(
    Match.when(Number.isNaN, () => toFloat(0)),
    Match.when(
      (p) => p > PI_HALF,
      () => toFloat(PI_HALF),
    ),
    Match.when(
      (p) => p < -PI_HALF,
      () => toFloat(-PI_HALF),
    ),
    Match.orElse((p) => Effect.succeed(p)),
  )
}

import { vec3 } from 'gl-matrix'
import { Effect, Option } from 'effect'
import * as S from 'effect/Schema'
import { Camera, Position, Target } from './components'
import { Float, toFloat, Vector3, Vector3FloatSchema } from './common'

const PI_HALF = Math.PI / 2

/**
 * Clamps a pitch angle (in radians) to the vertical range [-PI/2, PI/2]
 * to prevent the camera from flipping over.
 * Handles NaN by returning 0.
 * @param pitch The pitch angle to clamp.
 * @returns The clamped pitch angle.
 */
export const clampPitch = (pitch: Float): Effect.Effect<Float, S.ParseError> => {
  if (Number.isNaN(pitch)) {
    return toFloat(0)
  }
  return toFloat(Math.max(-PI_HALF, Math.min(PI_HALF, pitch)))
}

export const updateCamera = (camera: Camera, target: Option.Option<Target>): Effect.Effect<Camera, S.ParseError> => {
  const newTargetPositionOption = Option.flatMap(target, (t) => (t._tag === 'block' ? Option.some(t.position) : Option.none()))
  return S.decode(Camera)({ ...camera, target: Option.getOrUndefined(newTargetPositionOption) })
}

export const updateCameraPosition = (
  camera: Camera,
  targetPosition: Option.Option<Position>,
  deltaTime: number,
): Effect.Effect<Camera, S.ParseError> => {
  return Option.match(targetPosition, {
    onNone: () => Effect.succeed(camera),
    onSome: (targetPos) => {
      const newPositionVec = vec3.create()
      const { x, y, z } = camera.position
      const currentPositionVec: Vector3 = [x, y, z]
      const targetPositionVec: Vector3 = [targetPos.x, targetPos.y, targetPos.z]
      vec3.lerp(newPositionVec, currentPositionVec, targetPositionVec, deltaTime * camera.damping)
      return Effect.gen(function* (_) {
        const newPosition = yield* _(
          S.decode(Position)({
            x: newPositionVec[0],
            y: newPositionVec[1],
            z: newPositionVec[2],
          }),
        )
        return yield* _(S.decode(Camera)({ ...camera, position: newPosition }))
      })
    },
  })
}

export const getCameraLookAt = (camera: Camera): Effect.Effect<Vector3, S.ParseError> => {
  const lookAt = vec3.create()
  const { x, y, z } = camera.position
  const cameraPosition: Vector3 = [x, y, z]
  vec3.add(lookAt, cameraPosition, [0, 0, -1]) // Look forward
  return S.decode(Vector3FloatSchema)([lookAt[0], lookAt[1], lookAt[2]])
}

  const newTargetPositionOption = Option.flatMap(target, (t) => (t._tag === 'block' ? Option.some(t.position) : Option.none()))
  return Option.match(newTargetPositionOption, {
    onNone: () => S.decode(Camera)({ ...camera, target: undefined }),
    onSome: (newTargetPosition) => S.decode(Camera)({ ...camera, target: newTargetPosition }),
  })
}

export const updateCameraPosition = (
  camera: Camera,
  targetPosition: Option.Option<Position>,
  deltaTime: number,
): Effect.Effect<Camera, ParseError> => {
  return Option.match(targetPosition, {
    onNone: () => Effect.succeed(camera),
    onSome: (targetPos) => {
      const newPositionVec = vec3.create()
      const { x, y, z } = camera.position
      const currentPositionVec: Vector3 = [x, y, z]
      const targetPositionVec: Vector3 = [targetPos.x, targetPos.y, targetPos.z]
      vec3.lerp(newPositionVec, currentPositionVec, targetPositionVec, deltaTime * camera.damping)
      return Effect.gen(function* (_) {
        const newPosition = yield* _(
          S.decode(Position)({
            x: newPositionVec[0],
            y: newPositionVec[1],
            z: newPositionVec[2],
          }),
        )
        return yield* _(S.decode(Camera)({ ...camera, position: newPosition }))
      })
    },
  })
}

export const getCameraLookAt = (camera: Camera): Effect.Effect<Vector3, ParseError> => {
  const lookAt = vec3.create()
  const { x, y, z } = camera.position
  const cameraPosition: Vector3 = [x, y, z]
  vec3.add(lookAt, cameraPosition, [0, 0, -1]) // Look forward
  return S.decode(Vector3FloatSchema)([lookAt[0], lookAt[1], lookAt[2]])
}
