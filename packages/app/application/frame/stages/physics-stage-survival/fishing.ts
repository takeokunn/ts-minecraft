import { Effect, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { XP_ORB_PICKUP_DELAY_TICKS } from '@ts-minecraft/entity/domain/dropped-xp-orb'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import { selectedHotbarSlotIndex } from '../selected-hotbar-slot'

export const handleFishingCatch = (
  services: Pick<PhysicsStageServices, 'fishingService' | 'inventoryService' | 'hotbarService' | 'droppedXpOrbService' | 'soundManager'>,
  position: Position,
  deltaSecs: number,
): Effect.Effect<void, never> =>
  services.fishingService.tick(deltaSecs).pipe(
    Effect.flatMap((caught) => {
      const catchResult = Option.getOrNull(caught)
      if (catchResult === null) {
        return Effect.void
      }

      return Effect.gen(function* () {
        yield* services.inventoryService.addBlock(catchResult.item, 1).pipe(Effect.catchAll(() => Effect.void))
        const selectedSlot = yield* services.hotbarService.getSelectedSlot()
        yield* services.inventoryService.damageSlot(selectedHotbarSlotIndex(selectedSlot), 1)
        if (catchResult.experience > 0) {
          yield* services.droppedXpOrbService.spawn({
            amount: catchResult.experience,
            position: { x: position.x, y: position.y + 0.5, z: position.z },
            pickupDelayTicks: XP_ORB_PICKUP_DELAY_TICKS,
          }).pipe(Effect.asVoid, Effect.catchAllCause(() => Effect.void))
        }
        yield* services.soundManager.playEffect('blockPlace', { position })
      })
    }),
  )
