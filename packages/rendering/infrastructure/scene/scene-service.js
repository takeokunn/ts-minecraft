import { Effect } from 'effect';
import * as THREE from 'three';
export class SceneService extends Effect.Service()('@minecraft/infrastructure/three/SceneService', {
    succeed: {
        create: () => Effect.sync(() => new THREE.Scene()),
        add: (scene, object) => Effect.sync(() => scene.add(object)),
        remove: (scene, object) => Effect.sync(() => scene.remove(object)),
    },
}) {
}
export const SceneServiceLive = SceneService.Default;
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/scene/scene-service.js.map