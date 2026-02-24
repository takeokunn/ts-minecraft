import { Effect, Context, Layer } from 'effect'
import * as THREE from 'three'

export interface SceneService {
  readonly create: () => Effect.Effect<THREE.Scene, never>
  readonly add: (scene: THREE.Scene, object: THREE.Object3D) => Effect.Effect<void, never>
  readonly remove: (scene: THREE.Scene, object: THREE.Object3D) => Effect.Effect<void, never>
}

export const SceneService = Context.GenericTag<SceneService>('@minecraft/infrastructure/three/SceneService')

export const SceneServiceLive = Layer.succeed(
  SceneService,
  SceneService.of({
    create: () =>
      Effect.sync(() => new THREE.Scene()),
    add: (scene, object) =>
      Effect.sync(() => scene.add(object)),
    remove: (scene, object) =>
      Effect.sync(() => scene.remove(object)),
  })
)
