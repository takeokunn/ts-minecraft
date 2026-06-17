import { Effect, MutableRef } from 'effect'
import { accrueHazardTicks } from '@ts-minecraft/entity'
import type { PhysicsColumnReadError } from '../physics-stage-utils'

type ApplyCadencedHazardInput = {
  readonly active: boolean
  readonly accumulatorRef: MutableRef.MutableRef<number>
  readonly deltaTime: number
  readonly intervalSecs: number
  readonly onTicks: (ticks: number) => Effect.Effect<void, PhysicsColumnReadError>
}

export const applyCadencedHazard = (input: ApplyCadencedHazardInput): Effect.Effect<void, PhysicsColumnReadError> => {
  if (!input.active) {
    MutableRef.set(input.accumulatorRef, 0)
    return Effect.void
  }

  const { acc, ticks } = accrueHazardTicks(MutableRef.get(input.accumulatorRef), input.deltaTime, input.intervalSecs)
  MutableRef.set(input.accumulatorRef, acc)
  return ticks > 0 ? input.onTicks(ticks) : Effect.void
}
