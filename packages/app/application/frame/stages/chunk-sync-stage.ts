import { Effect, MutableRef, Ref } from 'effect'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { captureCameraPose, hasCameraPoseChanged } from '@ts-minecraft/app/frame/frame-runtime-logic'

export const chunkSyncStage = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<FrameHandlerServices, 'worldRendererService'>,
  refs: Pick<FrameStageRefs, 'frustumThrottleStrideRef' | 'frustumThrottleCounterRef' | 'lastFrustumCullRef'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const sceneVersionBeforeCull = yield* services.worldRendererService.getSceneVersion()
    const currentFrustumPose = captureCameraPose(deps.camera, sceneVersionBeforeCull)
    const lastFrustumCull = MutableRef.get(refs.lastFrustumCullRef)
    const frustumStride = yield* Ref.get(refs.frustumThrottleStrideRef)
    const frustumTick = yield* Ref.updateAndGet(
      refs.frustumThrottleCounterRef,
      (n) => (n + 1) % Math.max(frustumStride, 1),
    )
    if (frustumTick === 0 && hasCameraPoseChanged(lastFrustumCull, currentFrustumPose)) {
      yield* services.worldRendererService.applyFrustumCulling(deps.camera)
      MutableRef.set(refs.lastFrustumCullRef, currentFrustumPose)
    }
  })
