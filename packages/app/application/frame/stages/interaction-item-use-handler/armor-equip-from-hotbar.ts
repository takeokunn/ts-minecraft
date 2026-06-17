import { Effect, Option } from 'effect'
import type { InventoryItem, SlotIndex } from '@ts-minecraft/core'
import { getArmorSlot } from '@ts-minecraft/inventory'
import type { FrameArmorEquipInteractionServices } from '@ts-minecraft/app/frame/frame-interaction-service-types'
import { selectedHotbarSlotIndex } from '../selected-hotbar-slot'

export const handleArmorEquipFromHotbar = (
  services: FrameArmorEquipInteractionServices,
  selectedSlot: SlotIndex,
  item: InventoryItem,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const slotIndex = selectedHotbarSlotIndex(selectedSlot)
    const stack = Option.getOrNull(yield* services.inventoryService.getSlot(slotIndex))
    if (stack === null) return false
    const armorSlot = Option.getOrNull(getArmorSlot(stack.itemType))
    if (armorSlot === null) return false
    const displaced = Option.getOrNull(yield* services.equipmentService.getEquippedItem(armorSlot))
    yield* Effect.gen(function* () {
      yield* services.inventoryService.removeBlock(item, 1, slotIndex)
      yield* services.equipmentService.equip(stack)
      if (displaced !== null) yield* services.inventoryService.addBlock(displaced.itemType, 1)
    }).pipe(Effect.catchAll(() => Effect.void))
    return true
  }).pipe(Effect.catchAll(() => Effect.succeed(false)))
