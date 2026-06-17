import { Effect, MutableRef, Ref } from 'effect'
import type { Position } from '@ts-minecraft/core'
import type { PhysicsStageDeps } from '../physics-stage-types/deps'
import type { PhysicsStageInputs } from '../physics-stage-types/inputs'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import type { PhysicsColumnReadError } from '../physics-stage-utils'
import { applySurvivalEffects } from '../physics-stage-survival'
import type { ApplyPlayerDamage } from '../physics-stage-survival/types'

export const handleDeathOrSurvival = (
  deps: PhysicsStageDeps,
  services: PhysicsStageServices,
  refs: PhysicsStageRefs,
  inputs: PhysicsStageInputs,
  refreshedPos: Position,
  isGrounded: boolean,
  applyDamage: ApplyPlayerDamage,
): Effect.Effect<void, PhysicsColumnReadError> =>
  Effect.gen(function* () {
    const isDead = yield* services.healthService.isDead()
    if (isDead) {
      yield* services.xpService.reset()
      yield* services.equipmentService.reset()
      yield* services.fishingService.cancel()
      const isCreative = yield* services.gameMode.isCreative()
      if (isCreative) {
        yield* services.healthService.reset()
        const respawnPos = MutableRef.get(deps.respawnPositionRef)
        yield* services.gameState.respawn(respawnPos).pipe(Effect.catchAllCause(() => Effect.void))
        yield* Ref.set(refs.finalPosRef, respawnPos)
      }
    } else {
      yield* applySurvivalEffects(services, refs, inputs, refreshedPos, isGrounded, applyDamage)
    }
  })
