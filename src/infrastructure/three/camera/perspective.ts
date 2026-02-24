import { Effect, Context, Layer, Schema } from 'effect'
import * as THREE from 'three'

export const PerspectiveCameraParamsSchema = Schema.Struct({
  fov: Schema.Number.pipe(Schema.between(1, 179)),
  aspect: Schema.Number.pipe(Schema.positive()),
  near: Schema.Number.pipe(Schema.positive()),
  far: Schema.Number.pipe(Schema.positive()),
})

export type PerspectiveCameraParams = Schema.Schema.Type<typeof PerspectiveCameraParamsSchema>

export interface PerspectiveCameraService {
  readonly create: (params: PerspectiveCameraParams) => Effect.Effect<THREE.PerspectiveCamera, Error>
  readonly updateAspect: (camera: THREE.PerspectiveCamera, aspect: number) => Effect.Effect<void, never>
  readonly updateProjectionMatrix: (camera: THREE.PerspectiveCamera) => Effect.Effect<void, never>
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
  })
)
