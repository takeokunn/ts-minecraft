import { Effect, MutableRef, Ref } from 'effect'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { captureCameraPose, copyCameraPoseInto, hasCameraPoseChanged } from '@ts-minecraft/app/frame/frame-runtime-logic'

export const chunkSyncStage = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<FrameHandlerServices, 'worldRendererService'>,
  refs: Pick<FrameStageRefs, 'frustumThrottleStrideRef' | 'frustumThrottleCounterRef' | 'lastFrustumCullRef' | 'currentFrustumPoseScratch'>,
): Effect.Effect<void, never> =>
  Effect.flatMap(services.worldRendererService.getSceneVersion(), (sceneVersionBeforeCull) => {
    // R89: output-parameter pattern — write into pre-allocated scratch, no per-frame allocation
    captureCameraPose(deps.camera, sceneVersionBeforeCull, refs.currentFrustumPoseScratch)
    const lastFrustumCull = MutableRef.get(refs.lastFrustumCullRef)

    return Effect.flatMap(Ref.get(refs.frustumThrottleStrideRef), (frustumStride) =>
      Effect.flatMap(
        Ref.updateAndGet(
          refs.frustumThrottleCounterRef,
          (n) => (n + 1) % Math.max(frustumStride, 1),
        ),
        (frustumTick) =>
          frustumTick === 0 && hasCameraPoseChanged(lastFrustumCull, refs.currentFrustumPoseScratch)
            ? Effect.flatMap(services.worldRendererService.applyFrustumCulling(deps.camera), () =>
                Effect.sync(() => {
                  copyCameraPoseInto(refs.currentFrustumPoseScratch, lastFrustumCull)
                })
              )
            : Effect.void,
      )
    )
  })
