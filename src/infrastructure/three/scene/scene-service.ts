import { Effect } from 'effect'
import * as THREE from 'three'

export class SceneService extends Effect.Service<SceneService>()(
  '@minecraft/infrastructure/three/SceneService',
  {
    succeed: {
      create: (): Effect.Effect<THREE.Scene, never> =>
        Effect.sync(() => new THREE.Scene()),
      add: (scene: THREE.Scene, object: THREE.Object3D): Effect.Effect<void, never> =>
        Effect.sync(() => scene.add(object)),
      remove: (scene: THREE.Scene, object: THREE.Object3D): Effect.Effect<void, never> =>
        Effect.sync(() => scene.remove(object)),
    },
  }
) {}
export { SceneService as SceneServiceLive }
