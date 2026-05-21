import { Effect, MutableRef, Ref } from 'effect';
import { captureCameraPose, hasCameraPoseChanged } from '@ts-minecraft/app/frame/frame-runtime-logic';
export const chunkSyncStage = (deps, services, refs) => Effect.gen(function* () {
    const sceneVersionBeforeCull = yield* services.worldRendererService.getSceneVersion();
    const currentFrustumPose = captureCameraPose(deps.camera, sceneVersionBeforeCull);
    const lastFrustumCull = MutableRef.get(refs.lastFrustumCullRef);
    const frustumStride = yield* Ref.get(refs.frustumThrottleStrideRef);
    const frustumTick = yield* Ref.updateAndGet(refs.frustumThrottleCounterRef, (n) => (n + 1) % Math.max(frustumStride, 1));
    if (frustumTick === 0 && hasCameraPoseChanged(lastFrustumCull, currentFrustumPose)) {
        yield* services.worldRendererService.applyFrustumCulling(deps.camera);
        MutableRef.set(refs.lastFrustumCullRef, currentFrustumPose);
    }
});
//# sourceMappingURL=../../../../../dist/packages/app/application/frame/stages/chunk-sync-stage.js.map