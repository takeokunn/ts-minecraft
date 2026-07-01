import { Effect, MutableRef } from 'effect'
import { HUNGER_TICK_INTERVAL_SECS } from './survival-timing.config'
import { advanceFixedStep } from '@ts-minecraft/app/frame/frame-fixed-step'
import type { Position } from '@ts-minecraft/core'
import { starvationDamageForDifficulty } from '../physics-stage-damage-logic'
import type { PhysicsStageInputs } from '../physics-stage-types/inputs'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import type { PhysicsColumnReadError } from '../physics-stage-utils'
import { applyDamageAndPlayHurt } from './feedback'
import type { ApplyPlayerDamage } from './types'

export const applyHungerTicks = (
  services: Pick<PhysicsStageServices, 'healthService' | 'hungerService' | 'soundManager' | 'damageOverlay'>,
  refs: Pick<PhysicsStageRefs, 'hungerTickAccumulatorRef'>,
  inputs: Pick<PhysicsStageInputs, 'deltaTime' | 'difficulty'>,
  refreshedPos: Position,
  applyDamage: ApplyPlayerDamage,
): Effect.Effect<void, PhysicsColumnReadError> =>
  Effect.gen(function* () {
    const health = yield* services.healthService.getHealth()
    const canRegen = health.current < health.max
    const [hungerTicks, hungerRemainder] = advanceFixedStep(
      MutableRef.get(refs.hungerTickAccumulatorRef),
      inputs.deltaTime,
      HUNGER_TICK_INTERVAL_SECS,
    )
    MutableRef.set(refs.hungerTickAccumulatorRef, hungerRemainder)

    for (let i = 0; i < hungerTicks; i++) {
      const hungerEffect = yield* services.hungerService.tick(canRegen)
      if (hungerEffect === 'regen') {
        yield* services.healthService.heal(1)
      } else if (hungerEffect === 'starve') {
        const starvationDamage = starvationDamageForDifficulty(inputs.difficulty, health.current)
        yield* applyDamageAndPlayHurt(services, refreshedPos, applyDamage, starvationDamage)
      }
    }
  })
