import { Effect, Ref } from 'effect'
import * as THREE from 'three'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs, ResolvedDeps } from '@ts-minecraft/app/frame/types'
import type { ResolvedGraphics } from '@ts-minecraft/game'
import { getAttackSwingOffset } from '@ts-minecraft/presentation/hud/attack-swing'

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
  services: Pick<FrameHandlerServices, 'perfHud' | 'debugFeatureFlags'>,
  refs: Pick<FrameStageRefs, 'totalTimeSecsRef' | 'attackSwingStateRef'>,
  resolved: Pick<ResolvedDeps, 'godRaysPassOrNull' | 'composerOrNull'>,
  inputs: {
    readonly resolvedGraphics: ResolvedGraphics
    readonly sunWorldPos: THREE.Vector3
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const debugFlags = yield* services.debugFeatureFlags.getFlags()
    // Sequential reads: both are pure synchronous Ref.get; `Effect.all` with
    // unbounded concurrency would needlessly spawn fibers every frame.
    const totalTimeSecs = yield* Ref.get(refs.totalTimeSecsRef)
    const swingState = yield* Ref.get(refs.attackSwingStateRef)

    yield* Effect.sync(() => {
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

    if (resolved.composerOrNull && debugFlags['rendering.postProcessing']) {
      resolved.composerOrNull.render()
    } else {
      deps.renderer.render(deps.scene, deps.camera)
    }
    }).pipe(
      // Effect.ensuring replaces try/finally: guarantees camera restoration even
      // if the render block above throws (e.g. WebGL error), matching the previous
      // try/finally behaviour exactly.
      Effect.ensuring(Effect.sync(() => {
        deps.camera.position.copy(scratchCameraPosition)
        deps.camera.quaternion.copy(scratchCameraQuaternion)
        deps.camera.updateMatrixWorld(true)
      })),
    )
    yield* services.perfHud.setDrawCalls(deps.renderer.info.render.calls)
  })
