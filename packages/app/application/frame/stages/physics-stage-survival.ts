import { Effect } from 'effect'
import { applySurvivalEnvironmentEffects } from './physics-stage-survival/environment'
import { applySurvivalMovementAndHunger } from './physics-stage-survival/movement'
import type { ApplyPlayerDamage } from './physics-stage-survival/types'
import type { PhysicsStageInputs } from './physics-stage-types/inputs'
import type { PhysicsStageRefs } from './physics-stage-types/refs'
import type { PhysicsStageServices } from './physics-stage-types/services'
import type { PhysicsColumnReadError } from './physics-stage-utils'
import type { Position } from '@ts-minecraft/core'

export const applySurvivalEffects = (
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
  refreshedPos: Position,
  isGrounded: boolean,
  applyDamage: ApplyPlayerDamage,
): Effect.Effect<void, PhysicsColumnReadError> =>
  Effect.gen(function* () {
    const movement = yield* applySurvivalMovementAndHunger(services, refs, inputs, refreshedPos, isGrounded, applyDamage)
    yield* applySurvivalEnvironmentEffects(services, refs, inputs, refreshedPos, movement, applyDamage)
  })
