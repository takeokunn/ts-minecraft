/**
 * Stage 10: renderStage — god-rays sun projection + composer.render (or fallback).
 */
import { Effect } from 'effect'
import * as THREE from 'three'
import type { FrameHandlerDeps, FrameHandlerServices, ResolvedDeps } from '@ts-minecraft/app/frame/types'
import type { ResolvedGraphics } from '@ts-minecraft/settings-manager'

export const renderStage = (
  deps: Pick<FrameHandlerDeps, 'renderer' | 'scene' | 'camera' | 'lights'>,
  services: Pick<FrameHandlerServices, 'perfHud'>,
  resolved: Pick<ResolvedDeps, 'godRaysPassOrNull' | 'composerOrNull'>,
  inputs: {
    readonly resolvedGraphics: ResolvedGraphics
    readonly sunWorldPos: THREE.Vector3
  },
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    if (resolved.godRaysPassOrNull) {
      if (inputs.resolvedGraphics.godRaysEnabled) {
        const lightPos = deps.lights.light.position
        inputs.sunWorldPos.copy(lightPos).normalize().multiplyScalar(100)
        inputs.sunWorldPos.project(deps.camera)
        const sunU = (inputs.sunWorldPos.x + 1) * 0.5
        const sunV = (inputs.sunWorldPos.y + 1) * 0.5
        const behindCamera = inputs.sunWorldPos.z > 1
        const offScreen = sunU < -0.2 || sunU > 1.2 || sunV < -0.2 || sunV > 1.2
        if (behindCamera || offScreen) {
          resolved.godRaysPassOrNull.enabled = false
        } else {
          resolved.godRaysPassOrNull.sunScreenPos.set(sunU, sunV)
          // FR-003: Adaptive god-rays sample count — reduce by 50% when
          // sun is in the outer 40% of the screen where quality loss is imperceptible.
          const distFromCenter = Math.hypot(sunU - 0.5, sunV - 0.5)
          const baseSamples = inputs.resolvedGraphics.godRaysSamples
          const adaptiveSamples = distFromCenter > 0.3 ? Math.max(5, Math.floor(baseSamples * 0.5)) : baseSamples
          resolved.godRaysPassOrNull.setNumSamples(adaptiveSamples)
          resolved.godRaysPassOrNull.enabled = true
        }
      } else {
        resolved.godRaysPassOrNull.enabled = false
      }
    }

    if (resolved.composerOrNull) {
      resolved.composerOrNull.render()
    } else {
      deps.renderer.render(deps.scene, deps.camera)
    }
  }).pipe(Effect.andThen(services.perfHud.setDrawCalls(deps.renderer.info.render.calls)))
