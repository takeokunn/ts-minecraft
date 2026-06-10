import type { InventoryItem } from '@ts-minecraft/core'

export const FURNACE_SMELT_DURATION_SECS = 10.0

// Items accepted as furnace fuel (priority order — coal first for best burn).
export const FURNACE_FUEL_ITEMS: ReadonlyArray<InventoryItem> = [
  'COAL',
  'STICKS',
  'WOODEN_SWORD', 'WOODEN_PICKAXE', 'WOODEN_AXE', 'WOODEN_HOE',
  'BOW', 'FISHING_ROD',
]
