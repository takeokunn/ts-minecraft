import { Effect, Option } from 'effect'
import type { FrameUnequipArmorInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types'

export const handleUnequipArmor = (
  services: FrameUnequipArmorInteractionServices,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const slots = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'] as const
    for (const slot of slots) {
      const removed = Option.getOrNull(yield* services.equipmentService.unequipSlot(slot))
      if (removed !== null) {
        yield* services.inventoryService
          .addBlock(removed.itemType, 1)
          .pipe(Effect.catchAll(() => Effect.gen(function* () { yield* services.equipmentService.equip(removed) })))
        return
      }
    }
  })
