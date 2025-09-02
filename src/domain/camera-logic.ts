import { vec3 } from 'gl-matrix'
import { Match, Option } from 'effect'
import { Camera, Position, Target } from './components'
import { Vector3 } from './common'

const PI_HALF = Math.PI / 2

/**
 * Clamps a pitch angle (in radians) to the vertical range [-PI/2, PI/2]
 * to prevent the camera from flipping over.
 * Handles NaN by returning 0.
 * @param pitch The pitch angle to clamp.
 * @returns The clamped pitch angle.
 */
export const clampPitch = (pitch: number): number => {
  return Match.value(pitch).pipe(
    Match.when(Number.isNaN, () => 0),
    Match.when(
      (p) => p > PI_HALF,
      () => PI_HALF,
    ),
    Match.when(
      (p) => p < -PI_HALF,
      () => -PI_HALF,
    ),
    Match.orElse((p) => p),
  )
}

export const updateCamera = (camera: Camera, target: Option.Option<Target>): Camera => {
  const newTargetPositionOption = Option.flatMap(target, (t) => (t._tag === 'block' ? Option.some(t.position) : Option.none()))
  return Option.match(newTargetPositionOption, {
    onNone: () => new Camera({ ...camera, target: undefined }),
    onSome: (newTargetPosition) => new Camera({ ...camera, target: newTargetPosition }),
  })
}

export const updateCameraPosition = (camera: Camera, targetPosition: Option.Option<Vector3>, deltaTime: number): Camera => {
  return Option.match(targetPosition, {
    onNone: () => camera,
    onSome: (targetPos) => {
      const newPositionVec = vec3.create()
      const currentPositionVec: Vector3 = [camera.position.x, camera.position.y, camera.position.z]
      vec3.lerp(newPositionVec, currentPositionVec, targetPos, deltaTime * camera.damping)
      const newPosition = new Position({ x: newPositionVec[0], y: newPositionVec[1], z: newPositionVec[2] })
      return new Camera({ ...camera, position: newPosition })
    },
  })
}

export const getCameraLookAt = (camera: Camera): Vector3 => {
  const lookAt = vec3.create()
  const cameraPosition: Vector3 = [camera.position.x, camera.position.y, camera.position.z]
  vec3.add(lookAt, cameraPosition, [0, 0, -1]) // Look forward
  return [lookAt[0], lookAt[1], lookAt[2]]
}