import { Effect, MutableRef } from 'effect'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import { captureCameraPose, copyCameraPoseInto, hasCameraPoseChanged } from '@ts-minecraft/app/frame/frame-camera-pose'

export const chunkSyncStage = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<FrameHandlerServices, 'worldRendererService'>,
  refs: Pick<FrameStageRefs, 'frustumThrottleStrideRef' | 'frustumThrottleCounterRef' | 'lastFrustumCullRef' | 'currentFrustumPoseScratch'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const sceneVersionBeforeCull = yield* services.worldRendererService.getSceneVersion()
    // R89: output-parameter pattern — write into pre-allocated scratch, no per-frame allocation
    captureCameraPose(deps.camera, sceneVersionBeforeCull, refs.currentFrustumPoseScratch)
    const lastFrustumCull = MutableRef.get(refs.lastFrustumCullRef)
    const frustumStride = Math.max(MutableRef.get(refs.frustumThrottleStrideRef), 1)
    const frustumTick = (MutableRef.get(refs.frustumThrottleCounterRef) + 1) % frustumStride
    MutableRef.set(refs.frustumThrottleCounterRef, frustumTick)

    if (frustumTick === 0 && hasCameraPoseChanged(lastFrustumCull, refs.currentFrustumPoseScratch)) {
      yield* services.worldRendererService.applyFrustumCulling(deps.camera)
      yield* Effect.sync(() => {
        copyCameraPoseInto(refs.currentFrustumPoseScratch, lastFrustumCull)
      })
    }
  })
