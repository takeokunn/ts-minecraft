import * as THREE from 'three'
import { Effect, Option, Ref } from 'effect'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import { ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD } from '@ts-minecraft/app/frame-handler.config'

export type CameraPoseSnapshot = {
  version: number
  x: number
  y: number
  z: number
  qx: number
  qy: number
  qz: number
  qw: number
  p0: number
  p5: number
  p10: number
  p14: number
}

export type AdaptiveQualityInput = {
  readonly adaptivePerformanceMode: boolean
  readonly graphicsQuality: 'low' | 'medium' | 'high' | 'ultra'
  readonly renderDistance: number
  readonly fps: number
  readonly cooldown: number
  readonly chunkSyncPending?: boolean
}

export type SettingsPatch = {
  readonly graphicsQuality?: 'low' | 'medium' | 'high'
  readonly renderDistance?: number
}

export type AdaptiveQualityDecision = {
  readonly nextCooldown: number
  readonly settingsPatch: Option.Option<SettingsPatch>
}

// Output-parameter pattern: writes camera state into `out` in-place.
// No object allocation on the hot path — callers pass a pre-allocated CameraPoseSnapshot.
export const captureCameraPose = (
  camera: THREE.PerspectiveCamera,
  version: number,
  out: CameraPoseSnapshot,
): void => {
  const projection = camera.projectionMatrix.elements
  out.version = version
  out.x = camera.position.x
  out.y = camera.position.y
  out.z = camera.position.z
  out.qx = camera.quaternion.x
  out.qy = camera.quaternion.y
  out.qz = camera.quaternion.z
  out.qw = camera.quaternion.w
  out.p0 = projection[0] as number
  out.p5 = projection[5] as number
  out.p10 = projection[10] as number
  out.p14 = projection[14] as number
}

// Copy all fields from `src` into `dst` in-place.
// Used to update the stored "last" snapshot without allocating a new object.
export const copyCameraPoseInto = (src: CameraPoseSnapshot, dst: CameraPoseSnapshot): void => {
  dst.version = src.version
  dst.x = src.x
  dst.y = src.y
  dst.z = src.z
  dst.qx = src.qx
  dst.qy = src.qy
  dst.qz = src.qz
  dst.qw = src.qw
  dst.p0 = src.p0
  dst.p5 = src.p5
  dst.p10 = src.p10
  dst.p14 = src.p14
}

export const hasCameraPoseChanged = (
  previous: CameraPoseSnapshot,
  current: CameraPoseSnapshot,
): boolean =>
  previous.version !== current.version
  || previous.x !== current.x
  || previous.y !== current.y
  || previous.z !== current.z
  || previous.qx !== current.qx
  || previous.qy !== current.qy
  || previous.qz !== current.qz
  || previous.qw !== current.qw
  || previous.p0 !== current.p0
  || previous.p5 !== current.p5
  || previous.p10 !== current.p10
  || previous.p14 !== current.p14

// Returns [ticks, remainder] as a tuple to avoid per-frame plain-object
// allocation (R102). Callers destructure via const [ticks, remainder].
export const advanceFixedStep = (
  accumulated: number,
  deltaTime: number,
  intervalSeconds: number,
): readonly [ticks: number, remainder: number] => {
  const nextAccumulated = accumulated + deltaTime
  const ticks = Math.floor(nextAccumulated / intervalSeconds)
  return [ticks, nextAccumulated - ticks * intervalSeconds]
}

// Drives a fixed-step simulation service: advances the accumulator by deltaTime, then
// runs `tick` exactly `ticks` times. This decouples a 20Hz game-tick simulation from the
// (variable, ~60fps) render frame rate — without it, counting one tick per frame makes
// the simulation run at the display refresh rate. Shared by the redstone/fluid (entity
// stage) and health-invincibility (physics stage) tick paths.
export const runTickable = (
  accRef: Ref.Ref<number>,
  tick: Effect.Effect<unknown, never>,
  deltaTime: DeltaTimeSecs,
  intervalSecs: number,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const n = yield* Ref.modify(accRef, (accumulated): [number, number] => {
      const [ticks, remainder] = advanceFixedStep(accumulated, deltaTime, intervalSecs)
      return [ticks, remainder]
    })
    if (n > 0) yield* Effect.repeatN(tick, n - 1)
  })

const nextGraphicsQuality = (
  graphicsQuality: AdaptiveQualityInput['graphicsQuality'],
): 'low' | 'medium' | 'high' =>
  graphicsQuality === 'ultra'
    ? 'high'
    : graphicsQuality === 'high'
      ? 'medium'
      : 'low'

const noChange = (cooldown: number): AdaptiveQualityDecision =>
  ({ nextCooldown: cooldown, settingsPatch: Option.none() })

export const decideAdaptiveQuality = ({
  adaptivePerformanceMode,
  graphicsQuality,
  renderDistance,
  fps,
  cooldown,
}: AdaptiveQualityInput): AdaptiveQualityDecision => {
  if (!adaptivePerformanceMode) {
    return noChange(cooldown)
  }

  if (cooldown > 0) {
    return noChange(cooldown - 1)
  }

  if (fps <= 0 || fps >= ADAPTIVE_QUALITY_HIGH_FPS_THRESHOLD) {
    return noChange(cooldown)
  }

  if (graphicsQuality !== 'low') {
    return {
      nextCooldown: 20,
      settingsPatch: Option.some({ graphicsQuality: nextGraphicsQuality(graphicsQuality) }),
    }
  }

  // Lower view distance even while chunk sync is draining; waiting keeps cold-load
  // worlds stuck in the most expensive state for too long.
  if (renderDistance > 4) {
    return {
      nextCooldown: 20,
      settingsPatch: Option.some({ renderDistance: renderDistance - 1 }),
    }
  }

  return noChange(cooldown)
}
