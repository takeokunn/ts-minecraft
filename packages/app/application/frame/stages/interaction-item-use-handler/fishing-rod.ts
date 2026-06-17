import { Effect } from 'effect'
import type { SlotIndex } from '@ts-minecraft/core'
import { enchantmentsOf } from '@ts-minecraft/inventory'
import type { FrameFishingRodInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types'
import { selectedHotbarSlotIndex } from '../selected-hotbar-slot'

export const handleFishingRodActivation = (
  services: FrameFishingRodInteractionServices,
  selectedSlot: SlotIndex,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const alreadyFishing = yield* services.fishingService.isFishing()
    if (alreadyFishing) {
      yield* services.fishingService.cancel()
      return true
    }
    const xp = yield* services.xpService.getXP()
    const rodStack = yield* services.inventoryService.getSlot(selectedHotbarSlotIndex(selectedSlot))
    const enchantments = enchantmentsOf(rodStack)
    let lureLevel = 0
    let luckLevel = 0
    for (const enchantment of enchantments) {
      if (enchantment.type === 'LURE') {
        lureLevel = enchantment.level
      } else if (enchantment.type === 'LUCK_OF_THE_SEA') {
        luckLevel = enchantment.level
      }
    }
    yield* services.fishingService.cast(xp.totalXP + xp.xpIntoLevel, lureLevel, luckLevel)
    return true
  })
