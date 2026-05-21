import { Array as Arr, Effect, Option, Schema } from 'effect';
import * as THREE from 'three';
import { Vector3Schema } from '@ts-minecraft/kernel';
export const RaycastHitSchema = Schema.Struct({
    point: Vector3Schema,
    normal: Vector3Schema,
    distance: Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
    blockX: Schema.Number.pipe(Schema.int()),
    blockY: Schema.Number.pipe(Schema.int()),
    blockZ: Schema.Number.pipe(Schema.int()),
});
export const DEFAULT_RAY_DISTANCE = 5.0;
export class RaycastingService extends Effect.Service()('@minecraft/infrastructure/three/RaycastingService', {
    effect: Effect.sync(() => {
        // Cached raycaster and screen-center vector — allocated once at service creation.
        // Prevents per-frame GC pressure from ~60 Raycaster + Vector2 allocations/second.
        const raycaster = new THREE.Raycaster();
        const center = new THREE.Vector2(0, 0);
        return {
            raycastFromCamera: (camera, scene, maxDistance = DEFAULT_RAY_DISTANCE) => Effect.sync(() => {
                raycaster.far = maxDistance;
                // Cast ray from camera center (reuses cached Vector2)
                raycaster.setFromCamera(center, camera);
                // The scene graph is flat for world geometry (direct child meshes only),
                // so we can skip recursive traversal and save per-frame tree walking.
                const intersects = raycaster.intersectObjects(scene.children, false);
                // Option.flatMap chains: None-propagates through both guards,
                // then Option.map builds the result only when both hit and face are present.
                return Option.flatMap(Arr.get(intersects, 0), (hit) => Option.map(Option.fromNullable(hit.face), (face) => {
                    // Offset slightly in the direction of the normal to get the block we hit, not the block we're standing in.
                    const blockX = Math.floor(hit.point.x - face.normal.x * 0.01);
                    const blockY = Math.floor(hit.point.y - face.normal.y * 0.01);
                    const blockZ = Math.floor(hit.point.z - face.normal.z * 0.01);
                    return {
                        point: { x: hit.point.x, y: hit.point.y, z: hit.point.z },
                        normal: { x: face.normal.x, y: face.normal.y, z: face.normal.z },
                        distance: hit.distance,
                        blockX,
                        blockY,
                        blockZ,
                    };
                }));
            }),
            worldToBlock: (worldPos) => Effect.succeed({
                x: Math.floor(worldPos.x),
                y: Math.floor(worldPos.y),
                z: Math.floor(worldPos.z),
            }),
        };
    }),
}) {
}
export const RaycastingServiceLive = RaycastingService.Default;
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/raycasting/raycasting-service.js.map