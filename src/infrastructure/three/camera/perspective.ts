import { Effect, Context, Layer, Schema } from 'effect'
import * as THREE from 'three'
import type { Position } from '@/shared/kernel'

export const PerspectiveCameraParamsSchema = Schema.Struct({
  fov: Schema.Number.pipe(Schema.between(1, 179)),
  aspect: Schema.Number.pipe(Schema.positive()),
  near: Schema.Number.pipe(Schema.positive()),
  far: Schema.Number.pipe(Schema.positive()),
})

export type PerspectiveCameraParams = Schema.Schema.Type<typeof PerspectiveCameraParamsSchema>

export const DEFAULT_CAMERA_OFFSET: Position = { x: 0, y: 5, z: 10 }
export const DEFAULT_LERP_FACTOR = 0.1

export interface PerspectiveCameraService {
  readonly create: (params: PerspectiveCameraParams) => Effect.Effect<THREE.PerspectiveCamera, Error>
  readonly updateAspect: (camera: THREE.PerspectiveCamera, aspect: number) => Effect.Effect<void, never>
  readonly updateProjectionMatrix: (camera: THREE.PerspectiveCamera) => Effect.Effect<void, never>
  readonly setPosition: (
    camera: THREE.PerspectiveCamera,
    position: Position
  ) => Effect.Effect<void, never>
  readonly lookAt: (
    camera: THREE.PerspectiveCamera,
    target: Position
  ) => Effect.Effect<void, never>
  readonly smoothFollow: (
    camera: THREE.PerspectiveCamera,
    target: Position,
    offset: Position,
    lerpFactor: number
  ) => Effect.Effect<void, never>
}

export const PerspectiveCameraService = Context.GenericTag<PerspectiveCameraService>('@minecraft/infrastructure/three/PerspectiveCameraService')

export const PerspectiveCameraServiceLive = Layer.succeed(
  PerspectiveCameraService,
  PerspectiveCameraService.of({
    create: (params) =>
      Effect.try({
        try: () => new THREE.PerspectiveCamera(params.fov, params.aspect, params.near, params.far),
        catch: (error) => new Error(`Failed to create camera: ${error}`),
      }),
    updateAspect: (camera, aspect) =>
      Effect.sync(() => {
        camera.aspect = aspect
      }),
    updateProjectionMatrix: (camera) =>
      Effect.sync(() => {
        camera.updateProjectionMatrix()
      }),
    setPosition: (camera, position) =>
      Effect.sync(() => {
        camera.position.set(position.x, position.y, position.z)
      }),
    lookAt: (camera, target) =>
      Effect.sync(() => {
        camera.lookAt(target.x, target.y, target.z)
      }),
    smoothFollow: (camera, target, offset, lerpFactor) =>
      Effect.gen(function* () {
        const targetX = target.x + offset.x
        const targetY = target.y + offset.y
        const targetZ = target.z + offset.z

        camera.position.x += (targetX - camera.position.x) * lerpFactor
        camera.position.y += (targetY - camera.position.y) * lerpFactor
        camera.position.z += (targetZ - camera.position.z) * lerpFactor

        camera.lookAt(target.x, target.y, target.z)
      }),
  })
)
