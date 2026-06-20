import { Effect, Option } from 'effect'
import type { Position } from '@ts-minecraft/core'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import { selectedHotbarSlotIndex } from '../selected-hotbar-slot'

export const handleFishingCatch = (
  services: Pick<PhysicsStageServices, 'fishingService' | 'inventoryService' | 'hotbarService' | 'xpService' | 'soundManager'>,
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
        yield* services.xpService.addXP(catchResult.experience)
        yield* services.soundManager.playEffect('blockPlace', { position })
      })
    }),
  )
