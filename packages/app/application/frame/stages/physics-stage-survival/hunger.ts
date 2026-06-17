import { Effect, MutableRef } from 'effect'
import { HUNGER_TICK_INTERVAL_SECS } from '@ts-minecraft/app/frame-handler.config'
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
  services: Pick<PhysicsStageServices, 'healthService' | 'hungerService' | 'soundManager'>,
  refs: Pick<PhysicsStageRefs, 'hungerTickAccumulatorRef'>,
  inputs: Pick<PhysicsStageInputs, 'deltaTime' | 'difficulty'>,
  refreshedPos: Position,
  applyDamage: ApplyPlayerDamage,
): Effect.Effect<void, PhysicsColumnReadError> =>
  services.healthService.getHealth().pipe(
    Effect.flatMap((healthForRegen) => {
      const canRegen = healthForRegen.current < healthForRegen.max
      const [hungerTicks, hungerRemainder] = advanceFixedStep(
        MutableRef.get(refs.hungerTickAccumulatorRef),
        inputs.deltaTime,
        HUNGER_TICK_INTERVAL_SECS,
      )
      MutableRef.set(refs.hungerTickAccumulatorRef, hungerRemainder)

      let hungerEffects: Effect.Effect<void, PhysicsColumnReadError> = Effect.void
      for (let i = 0; i < hungerTicks; i++) {
        hungerEffects = hungerEffects.pipe(
          Effect.flatMap(() =>
            services.hungerService.tick(canRegen).pipe(
              Effect.flatMap((hungerEffect) => {
                if (hungerEffect === 'regen') {
                  return services.healthService.heal(1)
                }
                if (hungerEffect === 'starve') {
                  return services.healthService.getHealth().pipe(
                    Effect.flatMap((healthForStarvation) => {
                      const starvationDamage = starvationDamageForDifficulty(inputs.difficulty, healthForStarvation.current)
                      return applyDamageAndPlayHurt(services, refreshedPos, applyDamage, starvationDamage)
                    }),
                  )
                }
                return Effect.void
              }),
            ),
          ),
        )
      }

      return hungerEffects
    }),
  )
