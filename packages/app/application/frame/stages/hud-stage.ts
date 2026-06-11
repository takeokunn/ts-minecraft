import { Effect, MutableRef, Option, Ref } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameSettingsView, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { decideAdaptiveQuality, type AdaptiveQualityDecision } from '@ts-minecraft/app/frame/frame-runtime-logic'
import type { DeltaTimeSecs } from '@ts-minecraft/core'

export const hudStage = (
  deps: Pick<FrameHandlerDeps, 'renderer'>,
  services: Pick<FrameHandlerServices, 'fpsCounter' | 'settingsService' | 'hotbarRenderer' | 'perfHud' | 'debugFeatureFlags'>,
  refs: Pick<FrameStageRefs, 'frustumThrottleStrideRef' | 'adaptiveQualityCooldownRef' | 'lastFpsTenthsRef' | 'chunkSyncPendingRef'>,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly currentSettings: FrameSettingsView
    readonly fpsElementOrNull: HTMLElement | null
    readonly paused?: boolean
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const debugFlags = yield* services.debugFeatureFlags.getFlags()

    // Feed the per-frame delta into the perf-HUD ring buffer. No-op when
    // `?debug=perf` is absent (PerfHudService returns trivial impl).
    yield* services.perfHud.recordFrame(inputs.deltaTime)

    // Update FPS display — tick first, then update DOM only when displayed value changes
    const fps = yield* services.fpsCounter.tick(inputs.deltaTime).pipe(Effect.andThen(services.fpsCounter.getFPS()))
    // Quantize to tenths up front; the displayed value only ever has 1 decimal,
    // so comparing integers lets us skip the toFixed allocation on unchanged frames.
    const fpsTenths = Math.round(fps * 10)
    yield* Ref.set(refs.frustumThrottleStrideRef, fps >= 100 ? 1 : fps >= 60 ? 2 : 4)
    const adaptiveCooldown = yield* Ref.get(refs.adaptiveQualityCooldownRef)
    // FR-1.4: suspend adaptive-quality evaluation while paused — pause-menu
    // overhead can briefly tank FPS without indicating a real perf problem.
    const adaptiveQualityDecision: AdaptiveQualityDecision = inputs.paused
      ? { nextCooldown: adaptiveCooldown, settingsPatch: Option.none() }
      : decideAdaptiveQuality({
          adaptivePerformanceMode: inputs.currentSettings.adaptivePerformanceMode,
          graphicsQuality: inputs.currentSettings.graphicsQuality,
          renderDistance: inputs.currentSettings.renderDistance,
          fps,
          cooldown: adaptiveCooldown,
          chunkSyncPending: MutableRef.get(refs.chunkSyncPendingRef),
        })
    if (adaptiveQualityDecision.nextCooldown !== adaptiveCooldown) {
      yield* Ref.set(refs.adaptiveQualityCooldownRef, adaptiveQualityDecision.nextCooldown)
    }
    const settingsPatch = Option.getOrNull(adaptiveQualityDecision.settingsPatch)
    if (settingsPatch !== null) {
      yield* services.settingsService.updateSettings(settingsPatch)
    }
    const fpsChanged = yield* Ref.modify(refs.lastFpsTenthsRef, (last): [boolean, number] =>
      last === fpsTenths ? [false, last] : [true, fpsTenths],
    )
    if (fpsChanged && inputs.fpsElementOrNull && debugFlags['ui.fps']) {
      // toFixed only runs on an actual change — typically a handful of times/sec.
      const fpsText = (fpsTenths / 10).toFixed(1)
      yield* Effect.sync(() => {
        inputs.fpsElementOrNull!.textContent = fpsText
      })
    }

    // Render HUD hotbar overlay (second pass; autoClear=false prevents erasing the main scene)
    if (debugFlags['ui.hotbar']) {
      yield* logErrors(
        Effect.sync(() => {
          deps.renderer.autoClear = false
        }).pipe(
          Effect.andThen(services.hotbarRenderer.render(deps.renderer)),
          Effect.andThen(
            Effect.sync(() => {
              deps.renderer.autoClear = true
            }),
          ),
        ),
        'HUD render error',
      )
    }
  })
