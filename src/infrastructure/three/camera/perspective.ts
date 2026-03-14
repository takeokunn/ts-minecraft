import { Effect, Schema } from 'effect'
import * as THREE from 'three'
import type { Position } from '@/shared/kernel'
import { CameraError } from '@/domain/errors'

export const PerspectiveCameraParamsSchema = Schema.Struct({
  fov: Schema.Number.pipe(Schema.between(1, 179)),
  aspect: Schema.Number.pipe(Schema.positive()),
  near: Schema.Number.pipe(Schema.positive()),
  far: Schema.Number.pipe(Schema.positive()),
})

export type PerspectiveCameraParams = Schema.Schema.Type<typeof PerspectiveCameraParamsSchema>

export const DEFAULT_CAMERA_OFFSET: Position = { x: 0, y: 5, z: 10 }
export const DEFAULT_LERP_FACTOR = 0.1

export class PerspectiveCameraService extends Effect.Service<PerspectiveCameraService>()(
  '@minecraft/infrastructure/three/PerspectiveCameraService',
  {
    succeed: {
      create: (params: PerspectiveCameraParams): Effect.Effect<THREE.PerspectiveCamera, CameraError> =>
        Effect.try({
          try: () => new THREE.PerspectiveCamera(params.fov, params.aspect, params.near, params.far),
          catch: (error) => new CameraError({ cause: error }),
        }),
      updateAspect: (camera: THREE.PerspectiveCamera, aspect: number): Effect.Effect<void, never> =>
        Effect.sync(() => {
          camera.aspect = aspect
        }),
      updateProjectionMatrix: (camera: THREE.PerspectiveCamera): Effect.Effect<void, never> =>
        Effect.sync(() => {
          camera.updateProjectionMatrix()
        }),
      setPosition: (camera: THREE.PerspectiveCamera, position: Position): Effect.Effect<void, never> =>
        Effect.sync(() => {
          camera.position.set(position.x, position.y, position.z)
        }),
      lookAt: (camera: THREE.PerspectiveCamera, target: Position): Effect.Effect<void, never> =>
        Effect.sync(() => {
          camera.lookAt(target.x, target.y, target.z)
        }),
      smoothFollow: (
        camera: THREE.PerspectiveCamera,
        target: Position,
        offset: Position,
        lerpFactor: number
      ): Effect.Effect<void, never> =>
        Effect.sync(() => {
          const targetX = target.x + offset.x
          const targetY = target.y + offset.y
          const targetZ = target.z + offset.z

          camera.position.x += (targetX - camera.position.x) * lerpFactor
          camera.position.y += (targetY - camera.position.y) * lerpFactor
          camera.position.z += (targetZ - camera.position.z) * lerpFactor

          camera.lookAt(target.x, target.y, target.z)
        }),
    },
  }
) {}
export const PerspectiveCameraServiceLive = PerspectiveCameraService.Default
