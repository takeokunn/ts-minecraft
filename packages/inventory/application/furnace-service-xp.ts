import { Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import { SMELTING_XP_PER_ITEM, type SmeltingXpItem } from './furnace-service.config'

export const isSmeltingXpItem = (itemType: InventoryItem): itemType is SmeltingXpItem =>
  Object.hasOwn(SMELTING_XP_PER_ITEM, itemType)

export const getSmeltingXpRate = (itemType: InventoryItem): Option.Option<number> =>
  isSmeltingXpItem(itemType) ? Option.some(SMELTING_XP_PER_ITEM[itemType]) : Option.none()

export const calculateSmeltingXp = (output: { readonly itemType: InventoryItem; readonly count: number }): number => {
  const rate = Option.getOrNull(getSmeltingXpRate(output.itemType))
  if (rate === null || rate <= 0 || output.count <= 0) return 0
  return Math.max(1, Math.round(output.count * rate))
}
