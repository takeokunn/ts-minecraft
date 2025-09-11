import { Effect, Match, Option } from 'effect'
import { CameraComponent, PositionComponent, TargetComponent } from '@domain/entities/components'
import { Float, toFloat, Vector3Float } from '@domain/value-objects/common'
import { Vector3Port } from '@domain/ports/math.port'

const PI_HALF = Math.PI / 2

/**
 * Clamps a pitch angle (in radians) to the vertical range [-PI/2, PI/2]
 * to prevent the camera from flipping over.
 * Handles NaN by returning 0.
 * @param pitch The pitch angle to clamp.
 * @returns The clamped pitch angle.
 */
export const clampPitch = (pitch: Float): Float => {
  return Match.value(pitch).pipe(
    Match.when(Number.isNaN, () => toFloat(0)),
    Match.when(
      (p: Float) => p > PI_HALF,
      () => toFloat(PI_HALF),
    ),
    Match.when(
      (p: Float) => p < -PI_HALF,
      () => toFloat(-PI_HALF),
    ),
    Match.orElse((p) => p),
  )
}

export const updateCamera = (camera: CameraComponent, target: Option.Option<TargetComponent>): CameraComponent => {
  const newTargetPositionOption = Option.flatMap(target, (t) => (t.current.type === 'block' ? Option.some(t.current.position) : Option.none()))
  return Option.match(newTargetPositionOption, {
    onNone: () => ({ ...camera, target: undefined }),
    onSome: (newTargetPosition) => ({ ...camera, target: newTargetPosition }),
  })
}

export const updateCameraPosition = (
  camera: CameraComponent,
  currentPosition: PositionComponent,
  targetPosition: Option.Option<PositionComponent>,
  deltaTime: number,
  damping: number = 0.1,
) =>
  Effect.gen(function* ($) {
    const vector3 = yield* $(Vector3Port)

    return Option.match(targetPosition, {
      onNone: () => Effect.succeed(currentPosition),
      onSome: (targetPos) =>
        Effect.gen(function* ($) {
          const currentVec = { x: currentPosition.x, y: currentPosition.y, z: currentPosition.z }
          const targetVec = { x: targetPos.x, y: targetPos.y, z: targetPos.z }
          const lerpResult = yield* $(vector3.lerp(currentVec, targetVec, deltaTime * damping))
          return {
            x: toFloat(lerpResult.x),
            y: toFloat(lerpResult.y),
            z: toFloat(lerpResult.z),
          }
        }),
    })
  })

export const getCameraLookAt = (cameraPosition: PositionComponent) =>
  Effect.gen(function* ($) {
    const vector3 = yield* $(Vector3Port)

    const currentVec = { x: cameraPosition.x, y: cameraPosition.y, z: cameraPosition.z }
    const forwardVec = { x: 0, y: 0, z: -1 } // Look forward
    const lookAtResult = yield* $(vector3.add(currentVec, forwardVec))

    const lookAt: Vector3Float = [toFloat(lookAtResult.x), toFloat(lookAtResult.y), toFloat(lookAtResult.z)]
    return lookAt
  })
