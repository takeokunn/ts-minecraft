import { SlotIndex } from '@ts-minecraft/core'
import { HOTBAR_START } from '@ts-minecraft/inventory'

export const selectedHotbarSlotIndex = (selectedSlot: SlotIndex) =>
  SlotIndex.make(HOTBAR_START + SlotIndex.toNumber(selectedSlot))
