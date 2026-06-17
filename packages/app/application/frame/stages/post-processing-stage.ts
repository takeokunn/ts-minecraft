// Stages 8 + 9 — water refraction pre-pass and post-processing pass enable/setSize sync.
// Both stages live in the same file because they share the post-processing
// concern (water shader uniforms feed into the composer's render flow).
import { Effect, MutableRef } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs, ResolvedDeps } from '@ts-minecraft/app/frame/types'
import { captureCameraPose, copyCameraPoseInto, hasCameraPoseChanged } from '@ts-minecraft/app/frame/frame-camera-pose'
import type { ResolvedGraphics } from '@ts-minecraft/game'
import { resolvePostProcessingSetupLayout } from './post-processing-layout'

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
    ? Effect.sync(() => {
        const refractionFrame = MutableRef.get(refs.refractionFrameCounterRef) + 1
        MutableRef.set(refs.refractionFrameCounterRef, refractionFrame)
        return refractionFrame
      }).pipe(
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
                            Effect.flatMap(() => Effect.sync(() => {
                              const wasValid = MutableRef.get(refs.refractionValidRef)
                              MutableRef.set(refs.refractionValidRef, true)
                              return wasValid
                            })),
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
        const layout = resolvePostProcessingSetupLayout({
          width: deps.renderer.domElement.clientWidth || 1,
          height: deps.renderer.domElement.clientHeight || 1,
          pixelRatio: typeof deps.renderer.getPixelRatio === 'function' ? deps.renderer.getPixelRatio() : 1,
          isWebGL2: deps.renderer.capabilities.isWebGL2,
          resolvedGraphics: inputs.resolvedGraphics,
        })
        if (deps.lights.light.castShadow !== layout.shadowCastEnabled) {
          deps.lights.light.castShadow = layout.shadowCastEnabled
          inputs.markShadowMapDirty()
        }
        if (resolved.gtaoPassOrNull) {
          resolved.gtaoPassOrNull.enabled = layout.gtao.enabled
          resolved.gtaoPassOrNull.setSize(layout.gtao.size.width, layout.gtao.size.height)
        }
        if (resolved.bloomPassOrNull) {
          resolved.bloomPassOrNull.enabled = layout.bloom.enabled
          resolved.bloomPassOrNull.strength = layout.bloom.strength
          resolved.bloomPassOrNull.setSize(layout.bloom.size.width, layout.bloom.size.height)
        }
        if (resolved.dofPassOrNull) {
          resolved.dofPassOrNull.enabled = layout.dof.enabled
          resolved.dofPassOrNull.setSize(layout.dof.size.width, layout.dof.size.height)
        }
        if (resolved.smaaPassOrNull) {
          resolved.smaaPassOrNull.enabled = layout.smaa.enabled
          resolved.smaaPassOrNull.setSize(layout.smaa.size.width, layout.smaa.size.height)
        }
        if (resolved.godRaysPassOrNull) {
          resolved.godRaysPassOrNull.setNumSamples(layout.godRays.samples)
          resolved.godRaysPassOrNull.setSize(layout.godRays.size.width, layout.godRays.size.height)
        }
      })
    : Effect.void
