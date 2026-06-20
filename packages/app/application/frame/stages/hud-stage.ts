import { Effect, MutableRef } from 'effect'
import type { DebugFeatureFlags } from '@ts-minecraft/app/application/debug-feature-flags.config'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameSettingsView } from '@ts-minecraft/app/application/frame/types/runtime'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { FrameHudServices } from '@ts-minecraft/app/frame/frame-service-types/hud'
import type { FrameSettingsServices } from '@ts-minecraft/app/frame/frame-service-types/settings'
import { decideAdaptiveQuality } from '@ts-minecraft/app/frame/frame-adaptive-quality'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import { isGameplayHudHidden } from '@ts-minecraft/presentation'

export const hudStage = (
  deps: Pick<FrameHandlerDeps, 'renderer'>,
  services: FrameHudServices & Pick<FrameSettingsServices, 'settingsService'>,
  refs: Pick<FrameStageRefs, 'frustumThrottleStrideRef' | 'adaptiveQualityCooldownRef' | 'lastFpsTenthsRef' | 'chunkSyncPendingRef'>,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly debugFlags: DebugFeatureFlags
    readonly currentSettings: FrameSettingsView
    readonly fpsElementOrNull: HTMLElement | null
    readonly paused?: boolean
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const debugFlags = inputs.debugFlags

    // Feed the per-frame delta into the perf-HUD ring buffer. No-op when
    // `?debug=perf` is absent (PerfHudService returns trivial impl).
    yield* services.perfHud.recordFrame(inputs.deltaTime)

    // Update FPS display — tick returns the current sampled FPS, avoiding a
    // second FPSCounter Effect on every frame.
    const fps = yield* services.fpsCounter.tick(inputs.deltaTime)
    // Quantize to tenths up front; the displayed value only ever has 1 decimal,
    // so comparing integers lets us skip the toFixed allocation on unchanged frames.
    const fpsTenths = Math.round(fps * 10)
    MutableRef.set(refs.frustumThrottleStrideRef, fps >= 100 ? 1 : fps >= 60 ? 2 : 4)
    const adaptiveCooldown = MutableRef.get(refs.adaptiveQualityCooldownRef)
    // FR-1.4: suspend adaptive-quality evaluation while paused — pause-menu
    // overhead can briefly tank FPS without indicating a real perf problem.
    const adaptiveQualityDecision = inputs.paused
      ? adaptiveCooldown
      : decideAdaptiveQuality({
          adaptivePerformanceMode: inputs.currentSettings.adaptivePerformanceMode,
          graphicsQuality: inputs.currentSettings.graphicsQuality,
          renderDistance: inputs.currentSettings.renderDistance,
          fps,
          cooldown: adaptiveCooldown,
          chunkSyncPending: MutableRef.get(refs.chunkSyncPendingRef),
        })
    if (typeof adaptiveQualityDecision === 'number') {
      if (adaptiveQualityDecision !== adaptiveCooldown) {
        MutableRef.set(refs.adaptiveQualityCooldownRef, adaptiveQualityDecision)
      }
    } else {
      MutableRef.set(refs.adaptiveQualityCooldownRef, adaptiveQualityDecision.nextCooldown)
      yield* services.settingsService.updateSettings(adaptiveQualityDecision.settingsPatch)
    }
    const lastFpsTenths = MutableRef.get(refs.lastFpsTenthsRef)
    const fpsChanged = lastFpsTenths !== fpsTenths
    if (fpsChanged) MutableRef.set(refs.lastFpsTenthsRef, fpsTenths)
    if (fpsChanged && inputs.fpsElementOrNull && debugFlags['ui.fps']) {
      // toFixed only runs on an actual change — typically a handful of times/sec.
      const fpsText = (fpsTenths / 10).toFixed(1)
      yield* Effect.sync(() => {
        inputs.fpsElementOrNull!.textContent = fpsText
      })
    }

    // Render HUD hotbar overlay (second pass; autoClear=false prevents erasing the main scene)
    if (debugFlags['ui.hotbar'] && !isGameplayHudHidden()) {
      yield* logErrors(
        Effect.sync(() => { deps.renderer.autoClear = false }).pipe(
          Effect.flatMap(() => services.hotbarRenderer.render(deps.renderer)),
          Effect.ensuring(Effect.sync(() => { deps.renderer.autoClear = true })),
        ),
        'HUD render error',
      )
    }
  })
