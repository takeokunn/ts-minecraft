import { vec3 } from 'gl-matrix'
import { Match, Option } from 'effect'
import { CameraComponent, PositionComponent, TargetComponent } from '@/core/components'
import { Float, toFloat, Vector3Float } from './common'

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
      (p) => p > PI_HALF,
      () => toFloat(PI_HALF),
    ),
    Match.when(
      (p) => p < -PI_HALF,
      () => toFloat(-PI_HALF),
    ),
    Match.orElse((p) => p),
  )
}

export const updateCamera = (camera: CameraComponent, target: Option.Option<TargetComponent>): CameraComponent => {
  const newTargetPositionOption = Option.flatMap(target, (t) => (t._tag === 'block' ? Option.some(t.position) : Option.none()))
  return Option.match(newTargetPositionOption, {
    onNone: () => ({ ...camera, target: undefined }),
    onSome: (newTargetPosition) => ({ ...camera, target: newTargetPosition }),
  })
}

export const updateCameraPosition = (
  camera: CameraComponent,
  targetPosition: Option.Option<PositionComponent>,
  deltaTime: number,
): CameraComponent => {
  return Option.match(targetPosition, {
    onNone: () => camera,
    onSome: (targetPos) => {
      const newPositionVec = vec3.create()
      const { x, y, z } = camera.position
      const currentPositionVec: Vector3Float = [toFloat(x), toFloat(y), toFloat(z)]
      const targetPositionVec: Vector3Float = [toFloat(targetPos.x), toFloat(targetPos.y), toFloat(targetPos.z)]
      vec3.lerp(newPositionVec, currentPositionVec, targetPositionVec, deltaTime * camera.damping)
      const newPosition: PositionComponent = {
        x: toFloat(newPositionVec[0]),
        y: toFloat(newPositionVec[1]),
        z: toFloat(newPositionVec[2]),
      }
      return { ...camera, position: newPosition }
    },
  })
}

export const getCameraLookAt = (camera: CameraComponent): Vector3Float => {
  const lookAt = vec3.create()
  const { x, y, z } = camera.position
  const cameraPosition = [toFloat(x), toFloat(y), toFloat(z)]
  vec3.add(lookAt, cameraPosition, [0, 0, -1]) // Look forward
  return [toFloat(lookAt[0]), toFloat(lookAt[1]), toFloat(lookAt[2])]
}
