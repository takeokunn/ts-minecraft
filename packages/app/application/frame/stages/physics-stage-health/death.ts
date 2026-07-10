import { Effect, MutableRef, Option, Ref } from 'effect'
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
      // Vanilla death drops: scatter the whole inventory at the death position,
      // then clear. Runs once in practice — this handler repeats while dead,
      // but after clear() every slot is None so re-entry is a no-op.
      const slots = yield* services.inventoryService.getAllSlots()
      yield* Effect.forEach(slots, (slot) =>
        Option.isSome(slot)
          ? services.droppedItemService.spawn({
              itemType: slot.value.itemType,
              count: slot.value.count,
              position: { x: refreshedPos.x, y: refreshedPos.y + 0.5, z: refreshedPos.z },
              velocity: { x: 0, y: 0.12, z: 0 },
            }).pipe(Effect.catchAllCause(() => Effect.void), Effect.asVoid)
          : Effect.void,
      )
      yield* services.inventoryService.clear()
      // Vanilla: death drops a recoverable XP orb worth min(7 × level, 100);
      // the rest of the XP is lost. Idempotent like the item drops — after
      // reset() the level is 0 so re-entry spawns nothing.
      const xp = yield* services.xpService.getXP()
      const orbAmount = Math.min(7 * xp.level, 100)
      if (orbAmount > 0) {
        yield* services.droppedXpOrbService.spawn({
          amount: orbAmount,
          position: { x: refreshedPos.x, y: refreshedPos.y + 0.5, z: refreshedPos.z },
        }).pipe(Effect.asVoid, Effect.catchAllCause(() => Effect.void))
      }
      yield* services.xpService.reset()
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
