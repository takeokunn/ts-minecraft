// Stages 8 + 9 — water refraction pre-pass and post-processing pass enable/setSize sync.
// Both stages live in the same file because they share the post-processing
// concern (water shader uniforms feed into the composer's render flow).
import { Effect, MutableRef, Ref } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs, ResolvedDeps } from '@ts-minecraft/app/frame/types'
import { captureCameraPose, copyCameraPoseInto, hasCameraPoseChanged } from '@ts-minecraft/app/frame/frame-runtime-logic'
import type { ResolvedGraphics } from '@ts-minecraft/game'

// ---------------------------------------------------------------------------
// Stage 8: refractionPrepassStage — water refraction RT (throttled by quality preset)
// ---------------------------------------------------------------------------

export const refractionPrepassStage = (
  deps: Pick<FrameHandlerDeps, 'renderer' | 'scene' | 'camera' | 'lights'>,
  services: Pick<FrameHandlerServices, 'worldRendererService'>,
  refs: Pick<
    FrameStageRefs,
    'refractionFrameCounterRef' | 'refractionValidRef' | 'lastRefractionFrameRef' | 'totalTimeSecsRef' | 'currentRefractionPoseScratch'
  >,
  inputs: {
    readonly resolvedGraphics: ResolvedGraphics
    readonly totalTimeSecs: number
    readonly sunIntensity: number
  },
): Effect.Effect<void, never> =>
  inputs.resolvedGraphics.refractionThrottleFrames > 0
    ? Ref.updateAndGet(refs.refractionFrameCounterRef, (n) => n + 1).pipe(
        Effect.flatMap((refractionFrame) =>
          (refractionFrame - 1) % inputs.resolvedGraphics.refractionThrottleFrames === 0
            ? services.worldRendererService.getSceneVersion().pipe(
                Effect.flatMap((sceneVersionBeforeRefraction) =>
                  Effect.sync(() =>
                    captureCameraPose(deps.camera, sceneVersionBeforeRefraction, refs.currentRefractionPoseScratch),
                  ).pipe(
                    Effect.flatMap(() => {
                      const lastRefractionFrame = MutableRef.get(refs.lastRefractionFrameRef)
                      return hasCameraPoseChanged(lastRefractionFrame, refs.currentRefractionPoseScratch)
                        ? logErrors(
                            services.worldRendererService.doRefractionPrePass(
                              deps.renderer, deps.scene, deps.camera,
                              inputs.resolvedGraphics.refractionMinScreenRatio,
                            ),
                            'Refraction pre-pass error',
                          ).pipe(
                            Effect.flatMap(() =>
                              Effect.sync(() =>
                                copyCameraPoseInto(refs.currentRefractionPoseScratch, lastRefractionFrame),
                              ),
                            ),
                            Effect.flatMap(() =>
                              Ref.getAndSet(refs.refractionValidRef, true),
                            ),
                            Effect.flatMap((wasValid) =>
                              /* c8 ignore next */
                              wasValid ? Effect.void : services.worldRendererService.setRefractionValid(true),
                            ),
                          )
                        : Effect.void
                    }),
                  ),
                ),
              )
            : Effect.void,
        ),
        Effect.flatMap(() =>
          services.worldRendererService.updateWaterUniforms(inputs.totalTimeSecs, deps.camera.position, inputs.sunIntensity),
        ),
      )
    : services.worldRendererService.updateWaterUniforms(inputs.totalTimeSecs, deps.camera.position, inputs.sunIntensity)

// ---------------------------------------------------------------------------
// Stage 9: postProcessingSetupStage — sync pass enable/setSize from quality preset.
// ---------------------------------------------------------------------------

export const postProcessingSetupStage = (
  deps: Pick<FrameHandlerDeps, 'renderer' | 'lights'>,
  resolved: Pick<
    ResolvedDeps,
    'gtaoPassOrNull' | 'bloomPassOrNull' | 'dofPassOrNull' | 'smaaPassOrNull' | 'godRaysPassOrNull'
  >,
  inputs: {
    readonly resolvedGraphics: ResolvedGraphics
    readonly graphicsChanged: boolean
    readonly pixelRatioChanged: boolean
    readonly markShadowMapDirty: () => void
  },
): Effect.Effect<void, never> =>
  (inputs.graphicsChanged || inputs.pixelRatioChanged)
    ? Effect.sync(() => {
        const w = deps.renderer.domElement.clientWidth || 1
        const h = deps.renderer.domElement.clientHeight || 1
        const pixelRatio = typeof deps.renderer.getPixelRatio === 'function' ? deps.renderer.getPixelRatio() : 1
        const rw = Math.max(1, Math.ceil(w * pixelRatio))
        const rh = Math.max(1, Math.ceil(h * pixelRatio))
        if (deps.lights.light.castShadow !== inputs.resolvedGraphics.shadowsEnabled) {
          deps.lights.light.castShadow = inputs.resolvedGraphics.shadowsEnabled
          inputs.markShadowMapDirty()
        }
        if (resolved.gtaoPassOrNull) {
          const enabled = inputs.resolvedGraphics.ssaoEnabled && deps.renderer.capabilities.isWebGL2
          resolved.gtaoPassOrNull.enabled = enabled
          resolved.gtaoPassOrNull.setSize(enabled ? Math.ceil(rw / 2) : 1, enabled ? Math.ceil(rh / 2) : 1)
        }
        if (resolved.bloomPassOrNull) {
          resolved.bloomPassOrNull.enabled = inputs.resolvedGraphics.bloomEnabled
          resolved.bloomPassOrNull.strength = inputs.resolvedGraphics.bloomStrength
          resolved.bloomPassOrNull.setSize(inputs.resolvedGraphics.bloomEnabled ? rw : 1, inputs.resolvedGraphics.bloomEnabled ? rh : 1)
        }
        if (resolved.dofPassOrNull) {
          resolved.dofPassOrNull.enabled = inputs.resolvedGraphics.dofEnabled
          resolved.dofPassOrNull.setSize(inputs.resolvedGraphics.dofEnabled ? rw : 1, inputs.resolvedGraphics.dofEnabled ? rh : 1)
        }
        if (resolved.smaaPassOrNull) {
          resolved.smaaPassOrNull.enabled = inputs.resolvedGraphics.smaaEnabled
          resolved.smaaPassOrNull.setSize(inputs.resolvedGraphics.smaaEnabled ? rw : 1, inputs.resolvedGraphics.smaaEnabled ? rh : 1)
        }
        if (resolved.godRaysPassOrNull) {
          resolved.godRaysPassOrNull.setNumSamples(inputs.resolvedGraphics.godRaysSamples)
          resolved.godRaysPassOrNull.setSize(inputs.resolvedGraphics.godRaysEnabled ? rw : 1, inputs.resolvedGraphics.godRaysEnabled ? rh : 1)
        }
      })
    : Effect.void
