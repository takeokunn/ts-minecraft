import type { InventoryItem } from '@ts-minecraft/core'

export const FURNACE_SMELT_DURATION_SECS = 10.0

// Items accepted as furnace fuel (priority order — coal/charcoal first for best burn,
// then wooden items, planks/logs last as they burn fastest in vanilla).
export const FURNACE_FUEL_ITEMS: ReadonlyArray<InventoryItem> = [
  'COAL',
  'CHARCOAL',
  'STICKS',
  'WOODEN_SWORD', 'WOODEN_PICKAXE', 'WOODEN_AXE', 'WOODEN_HOE',
  'BOW', 'FISHING_ROD',
  'PLANKS',
  'WOOD',
]

// XP awarded per output item when collecting from the furnace (vanilla Java Edition
// fractional XP values, rounded to whole numbers at the point of collection).
export const SMELTING_XP_PER_ITEM: Partial<Record<InventoryItem, number>> = {
  IRON_INGOT: 0.7,
  GOLD_INGOT: 1.0,
  STONE: 0.1,
  GLASS: 0.1,
  CHARCOAL: 0.15,
  COOKED_BEEF: 0.35,
  COOKED_COD: 0.35,
  COOKED_SALMON: 0.35,
}
