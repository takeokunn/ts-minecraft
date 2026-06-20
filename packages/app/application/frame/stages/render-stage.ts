import { Effect, MutableRef } from 'effect'
import * as THREE from 'three'
import type { DebugFeatureFlags } from '@ts-minecraft/app/application/debug-feature-flags.config'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { ResolvedDeps } from '@ts-minecraft/app/application/frame/types/runtime'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { FrameStageRefs } from '@ts-minecraft/app/application/frame/types/stage-refs'
import type { ResolvedGraphics } from '@ts-minecraft/game'
import { getAttackSwingOffset } from '@ts-minecraft/presentation'

const SWING_CAMERA_X_UNITS = 0.045
const SWING_CAMERA_Y_UNITS = 0.055
const SWING_CAMERA_ROLL_RADS = -0.025

// Module-scoped scratch objects for camera pose save/restore. The render stage
// runs once per frame on a single fiber synchronously, so reusing these avoids
// allocating a fresh Vector3 + Quaternion (~400B + GC churn) every frame.
const scratchCameraPosition = new THREE.Vector3()
const scratchCameraQuaternion = new THREE.Quaternion()

export const renderStage = (
  deps: Pick<FrameHandlerDeps, 'renderer' | 'scene' | 'camera' | 'lights'>,
  services: Pick<FrameHandlerServices, 'perfHud'>,
  refs: Pick<FrameStageRefs, 'totalTimeSecsRef' | 'attackSwingStateRef'>,
  resolved: Pick<ResolvedDeps, 'godRaysPassOrNull' | 'composerOrNull'>,
  inputs: {
    readonly resolvedGraphics: ResolvedGraphics
    readonly sunWorldPos: THREE.Vector3
    readonly debugFlags: DebugFeatureFlags
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    try {
      const totalTimeSecs = MutableRef.get(refs.totalTimeSecsRef)
      const swingState = MutableRef.get(refs.attackSwingStateRef)
      const debugFlags = inputs.debugFlags
      const swingOffset = getAttackSwingOffset(swingState, totalTimeSecs * 1000)
      scratchCameraPosition.copy(deps.camera.position)
      scratchCameraQuaternion.copy(deps.camera.quaternion)

      deps.camera.translateX(swingOffset.x * SWING_CAMERA_X_UNITS)
      deps.camera.translateY(swingOffset.y * SWING_CAMERA_Y_UNITS)
      deps.camera.rotateZ(swingOffset.x * SWING_CAMERA_ROLL_RADS)

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

      // Only pay for the EffectComposer (offscreen RT + a redundant full-screen
      // OutputPass blit) when a post-process pass is actually active. On the default
      // 'medium' preset every post-effect is off, so the composer chain reduces to
      // RenderPass→(disabled SMAA)→OutputPass — one wasted full-screen pass + an ~8MB
      // RT every frame that produces the SAME image as a direct render (the renderer
      // already applies ACESFilmic tonemapping + sRGB, exactly what OutputPass does;
      // see renderer-service.ts). Bypass it and render straight to the framebuffer.
      // `anyPostActive` is recomputed each frame from resolvedGraphics, so it follows
      // runtime preset changes (adaptive quality) automatically.
      const g = inputs.resolvedGraphics
      const anyPostActive =
        g.ssaoEnabled || g.bloomEnabled || g.smaaEnabled || g.dofEnabled || g.godRaysEnabled || g.useCompositePass
      if (resolved.composerOrNull && debugFlags['rendering.postProcessing'] && anyPostActive) {
        resolved.composerOrNull.render()
      } else {
        deps.renderer.render(deps.scene, deps.camera)
      }
      yield* services.perfHud.setDrawCalls(deps.renderer.info.render.calls)
    } finally {
      deps.camera.position.copy(scratchCameraPosition)
      deps.camera.quaternion.copy(scratchCameraQuaternion)
      deps.camera.updateMatrixWorld(true)
    }
  })
