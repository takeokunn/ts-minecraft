import type { InventoryItem } from '@ts-minecraft/core'

export const FURNACE_SMELT_DURATION_SECS = 10.0

export const FURNACE_FUEL_ITEMS = [
  'COAL',
  'CHARCOAL',
  'STICKS',
  'WOODEN_SWORD',
  'WOODEN_PICKAXE',
  'WOODEN_AXE',
  'WOODEN_HOE',
  'BOW',
  'FISHING_ROD',
  'PLANKS',
  'WOOD',
] as const satisfies ReadonlyArray<InventoryItem>

export type FurnaceFuelItem = typeof FURNACE_FUEL_ITEMS[number]

export const FURNACE_FUEL_BURN_DURATION_SECS: Record<FurnaceFuelItem, number> = {
  COAL: 80,
  CHARCOAL: 80,
  STICKS: 5,
  WOODEN_SWORD: 10,
  WOODEN_PICKAXE: 10,
  WOODEN_AXE: 10,
  WOODEN_HOE: 10,
  BOW: 15,
  FISHING_ROD: 15,
  PLANKS: 15,
  WOOD: 15,
}

export const SMELTING_XP_ITEMS = [
  'IRON_INGOT',
  'GOLD_INGOT',
  'STONE',
  'GLASS',
  'CHARCOAL',
  'COOKED_BEEF',
  'COOKED_CHICKEN',
  'COOKED_COD',
  'COOKED_SALMON',
] as const satisfies ReadonlyArray<InventoryItem>

export type SmeltingXpItem = typeof SMELTING_XP_ITEMS[number]

export const SMELTING_XP_PER_ITEM: Record<SmeltingXpItem, number> = {
  IRON_INGOT: 0.7,
  GOLD_INGOT: 1.0,
  STONE: 0.1,
  GLASS: 0.1,
  CHARCOAL: 0.15,
  COOKED_BEEF: 0.35,
  COOKED_CHICKEN: 0.35,
  COOKED_COD: 0.35,
  COOKED_SALMON: 0.35,
}
