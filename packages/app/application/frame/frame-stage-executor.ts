import { Effect, MutableRef } from 'effect'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import { applyKeyBindings } from '@ts-minecraft/entity/domain/key-mappings'
import {
  primeFrameEnvironment,
  runActiveFrameStages,
  runPresentationFrameStages,
  type FrameStageExecutorContext,
} from './frame-stage-executor-helpers'

const HIT_STOP_TIME_SCALE = 0.1

// Change-gate for key rebind application (module scratch).
let lastAppliedKeyBindings: Readonly<Record<string, string>> | null = null
let lastAppliedFov = Number.NaN

export const runFrameStages = (
  deps: FrameHandlerDeps,
  services: FrameHandlerServices,
  refs: FrameStageRefs,
  context: FrameStageExecutorContext,
) =>
  Effect.gen(function* () {
    const rawDeltaTime = MutableRef.get(refs.deltaTimeRef)
    // Melee hit-stop: a landed hit freezes time hard for a few frames — the
    // classic impact-juice beat. Time-scaled (not skipped) so physics stays
    // coherent; input/render keep running at full rate.
    const hitStopFrames = MutableRef.get(refs.hitStopFramesRef)
    const deltaTime = hitStopFrames > 0
      ? (rawDeltaTime * HIT_STOP_TIME_SCALE) as typeof rawDeltaTime
      : rawDeltaTime
    if (hitStopFrames > 0) MutableRef.set(refs.hitStopFramesRef, hitStopFrames - 1)
    const totalTimeSecs = MutableRef.get(refs.totalTimeSecsRef) + deltaTime
    MutableRef.set(refs.totalTimeSecsRef, totalTimeSecs)
    const currentSettings = yield* services.settingsService.getSettings()
    // Player key rebinds: apply on change only (reference compare — the
    // settings object is rebuilt when Options commits).
    if (currentSettings.keyBindings !== lastAppliedKeyBindings) {
      lastAppliedKeyBindings = currentSettings.keyBindings
      applyKeyBindings(currentSettings.keyBindings)
    }
    // FOV: apply on change only; updateProjectionMatrix is not per-frame safe.
    if (currentSettings.fov !== lastAppliedFov) {
      lastAppliedFov = currentSettings.fov
      deps.camera.fov = currentSettings.fov
      deps.camera.updateProjectionMatrix()
    }
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
      entitySnapshots: activeResult.entitySnapshots,
      resolved: context.resolved,
      sunWorldPos: context.sunWorldPos,
      markShadowMapDirty: context.markShadowMapDirty,
    })
  })
