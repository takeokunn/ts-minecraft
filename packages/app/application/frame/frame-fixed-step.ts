import { Effect, MutableRef } from 'effect'
import type { DeltaTimeSecs } from '@ts-minecraft/core'

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
  accRef: MutableRef.MutableRef<number>,
  tick: Effect.Effect<unknown, never>,
  deltaTime: DeltaTimeSecs,
  intervalSecs: number,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const [n, remainder] = advanceFixedStep(MutableRef.get(accRef), deltaTime, intervalSecs)
    MutableRef.set(accRef, remainder)
    if (n > 0) yield* Effect.repeatN(tick, n - 1)
  })
