import { Effect, MutableRef } from 'effect'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import {
  primeFrameEnvironment,
  runActiveFrameStages,
  runPresentationFrameStages,
  type FrameStageExecutorContext,
} from './frame-stage-executor-helpers'

export const runFrameStages = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
  refs: FrameStageRefs,
  context: FrameStageExecutorContext,
) =>
  Effect.gen(function* () {
    const deltaTime = MutableRef.get(refs.deltaTimeRef)
    const totalTimeSecs = MutableRef.get(refs.totalTimeSecsRef) + deltaTime
    MutableRef.set(refs.totalTimeSecsRef, totalTimeSecs)
    const currentSettings = yield* services.settingsService.getSettings()
    const debugFlags = yield* services.debugFeatureFlags.getFlags()
    const environment = yield* primeFrameEnvironment(deps, services, refs, context, currentSettings, debugFlags)
    const sessionPaused = MutableRef.get(deps.sessionPausedRef)

    const activeResult = yield* runActiveFrameStages(deps, services, refs, {
      deltaTime,
      totalTimeSecs,
      currentSettings,
      debugFlags,
      resolvedGraphics: environment.resolvedGraphics,
      effectiveLights: environment.effectiveLights,
      initialPlayerPos: environment.initialPlayerPos,
      resolved: context.resolved,
      sessionPaused,
      markShadowMapDirty: context.markShadowMapDirty,
    })

    yield* runPresentationFrameStages(deps, services, refs, {
      deltaTime,
      totalTimeSecs,
      currentSettings,
      debugFlags,
      resolvedGraphics: environment.resolvedGraphics,
      graphicsChanged: environment.graphicsChanged,
      pixelRatioChanged: environment.pixelRatioChanged,
      sessionPaused,
      playerPos: activeResult.playerPos,
      sunIntensity: activeResult.sunIntensity,
      resolved: context.resolved,
      sunWorldPos: context.sunWorldPos,
      markShadowMapDirty: context.markShadowMapDirty,
    })
  })
