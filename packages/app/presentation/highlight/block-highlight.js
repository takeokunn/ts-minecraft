import { Effect, Option, Ref, Schema } from 'effect';
import * as THREE from 'three';
import { RaycastingService } from '@ts-minecraft/rendering';
export const BlockTargetSchema = Schema.Struct({
    x: Schema.Int,
    y: Schema.Int,
    z: Schema.Int,
});
export const DEFAULT_HIGHLIGHT_COLOR = 0x000000;
export const createWireframeCube = (color = DEFAULT_HIGHLIGHT_COLOR) => {
    // Create a slightly larger box to avoid z-fighting with the block
    const geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
    const edges = new THREE.EdgesGeometry(geometry);
    const material = new THREE.LineBasicMaterial({
        color,
        linewidth: 2,
    });
    return new THREE.LineSegments(edges, material);
};
const EMPTY_HIT_STATE = { target: Option.none(), hit: Option.none() };
export class BlockHighlightService extends Effect.Service()('@minecraft/presentation/BlockHighlight', {
    effect: Effect.all([
        RaycastingService,
        // Wireframe cube mesh for highlighting
        Ref.make(Option.none()),
        // target and hit always change together — one atomic Ref instead of two
        Ref.make(EMPTY_HIT_STATE),
        Ref.make(Option.none()),
        // Last camera pose used for raycast; invalidated whenever the scene changes.
        Ref.make({ x: NaN, y: NaN, z: NaN, qx: NaN, qy: NaN, qz: NaN, qw: NaN }),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([raycastingService, highlightMeshRef, hitStateRef, overrideHitStateRef, lastCameraPoseRef]) => ({
        initialize: (scene) => Effect.gen(function* () {
            const mesh = createWireframeCube();
            yield* Effect.sync(() => { mesh.visible = false; scene.add(mesh); });
            yield* Ref.set(highlightMeshRef, Option.some(mesh));
        }),
        update: (camera, scene) => Effect.gen(function* () {
            const currentPose = {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z,
                qx: camera.quaternion.x,
                qy: camera.quaternion.y,
                qz: camera.quaternion.z,
                qw: camera.quaternion.w,
            };
            const lastPose = yield* Ref.get(lastCameraPoseRef);
            if (lastPose.x === currentPose.x &&
                lastPose.y === currentPose.y &&
                lastPose.z === currentPose.z &&
                lastPose.qx === currentPose.qx &&
                lastPose.qy === currentPose.qy &&
                lastPose.qz === currentPose.qz &&
                lastPose.qw === currentPose.qw) {
                return;
            }
            yield* Option.match(yield* Ref.get(highlightMeshRef), {
                onNone: () => Effect.void,
                onSome: (highlightMesh) => Effect.gen(function* () {
                    const overrideState = yield* Ref.get(overrideHitStateRef);
                    yield* Option.match(overrideState, {
                        onSome: (forced) => Effect.gen(function* () {
                            yield* Option.match(forced.target, {
                                /* c8 ignore next */
                                onNone: () => Effect.sync(() => { highlightMesh.visible = false; }),
                                onSome: (target) => Effect.sync(() => {
                                    highlightMesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
                                    highlightMesh.visible = true;
                                }),
                            });
                            yield* Ref.set(hitStateRef, forced);
                            yield* Ref.set(lastCameraPoseRef, currentPose);
                        }),
                        onNone: () => Effect.gen(function* () {
                            const hitOption = yield* raycastingService.raycastFromCamera(camera, scene);
                            yield* Option.match(hitOption, {
                                onSome: (hit) => Effect.gen(function* () {
                                    // Position highlight at block coordinates (center of the block)
                                    yield* Effect.sync(() => {
                                        highlightMesh.position.set(hit.blockX + 0.5, hit.blockY + 0.5, hit.blockZ + 0.5);
                                        highlightMesh.visible = true;
                                    });
                                    // Atomic write: target and hit always set together
                                    yield* Ref.set(hitStateRef, {
                                        target: Option.some({ x: hit.blockX, y: hit.blockY, z: hit.blockZ }),
                                        hit: Option.some(hit),
                                    });
                                }),
                                onNone: () => Effect.gen(function* () {
                                    yield* Effect.sync(() => { highlightMesh.visible = false; });
                                    yield* Ref.set(hitStateRef, EMPTY_HIT_STATE);
                                }),
                            });
                            yield* Ref.set(lastCameraPoseRef, currentPose);
                        }),
                    });
                }),
            });
        }),
        // Invalidated whenever scene changes so next update re-runs the raycast.
        invalidateCache: () => Ref.set(lastCameraPoseRef, { x: NaN, y: NaN, z: NaN, qx: NaN, qy: NaN, qz: NaN, qw: NaN }),
        setVisible: (visible) => Ref.get(highlightMeshRef).pipe(Effect.flatMap((opt) => Effect.sync(() => { Option.map(opt, (m) => { m.visible = visible; }); }))),
        getTargetBlock: () => Ref.get(hitStateRef).pipe(Effect.map((s) => s.target)),
        // Full hit required for computing adjacent block position during placement.
        getTargetHit: () => Ref.get(hitStateRef).pipe(Effect.map((s) => s.hit)),
        setTargetForQA: (target, hit) => Effect.gen(function* () {
            yield* Option.match(yield* Ref.get(highlightMeshRef), {
                onNone: () => Effect.void,
                onSome: (highlightMesh) => Effect.sync(() => {
                    highlightMesh.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
                    highlightMesh.visible = true;
                }),
            });
            yield* Ref.set(hitStateRef, {
                target: Option.some(target),
                hit: Option.some(hit),
            });
            yield* Ref.set(overrideHitStateRef, Option.some({
                target: Option.some(target),
                hit: Option.some(hit),
            }));
        }),
        clearTargetForQA: () => Effect.gen(function* () {
            yield* Option.match(yield* Ref.get(highlightMeshRef), {
                onNone: () => Effect.void,
                onSome: (highlightMesh) => Effect.sync(() => { highlightMesh.visible = false; }),
            });
            yield* Ref.set(overrideHitStateRef, Option.none());
            yield* Ref.set(hitStateRef, EMPTY_HIT_STATE);
        }),
    })))
}) {
}
export const BlockHighlightLive = BlockHighlightService.Default;
//# sourceMappingURL=../../../../dist/packages/app/presentation/highlight/block-highlight.js.map