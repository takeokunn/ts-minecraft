import type { InventoryItem } from '@ts-minecraft/core'

// Armor slot types — correspond to the four equipment positions.
export const ARMOR_SLOTS = ['HELMET', 'CHESTPLATE', 'LEGGINGS', 'BOOTS'] as const
export type ArmorSlot = typeof ARMOR_SLOTS[number]

export const ARMOR_ITEMS = [
  'LEATHER_HELMET',
  'LEATHER_CHESTPLATE',
  'LEATHER_LEGGINGS',
  'LEATHER_BOOTS',
  'IRON_HELMET',
  'IRON_CHESTPLATE',
  'IRON_LEGGINGS',
  'IRON_BOOTS',
  'GOLD_HELMET',
  'GOLD_CHESTPLATE',
  'GOLD_LEGGINGS',
  'GOLD_BOOTS',
  'DIAMOND_HELMET',
  'DIAMOND_CHESTPLATE',
  'DIAMOND_LEGGINGS',
  'DIAMOND_BOOTS',
] as const satisfies ReadonlyArray<InventoryItem>

export type ArmorItem = typeof ARMOR_ITEMS[number]

// Defense points per armor piece — matches Minecraft Java Edition values.
// These feed directly into combat.ts computeAttackDamage (armorPoints param).
export const ARMOR_DEFENSE_POINTS: Record<ArmorItem, number> = {
  LEATHER_HELMET: 1,
  LEATHER_CHESTPLATE: 3,
  LEATHER_LEGGINGS: 2,
  LEATHER_BOOTS: 1,
  IRON_HELMET: 2,
  IRON_CHESTPLATE: 6,
  IRON_LEGGINGS: 5,
  IRON_BOOTS: 2,
  GOLD_HELMET: 2,
  GOLD_CHESTPLATE: 5,
  GOLD_LEGGINGS: 3,
  GOLD_BOOTS: 1,
  DIAMOND_HELMET: 3,
  DIAMOND_CHESTPLATE: 8,
  DIAMOND_LEGGINGS: 6,
  DIAMOND_BOOTS: 3,
}

// Which slot a given item occupies (none → item is not armor).
export const ARMOR_SLOT_MAP: Record<ArmorItem, ArmorSlot> = {
  LEATHER_HELMET: 'HELMET',
  LEATHER_CHESTPLATE: 'CHESTPLATE',
  LEATHER_LEGGINGS: 'LEGGINGS',
  LEATHER_BOOTS: 'BOOTS',
  IRON_HELMET: 'HELMET',
  IRON_CHESTPLATE: 'CHESTPLATE',
  IRON_LEGGINGS: 'LEGGINGS',
  IRON_BOOTS: 'BOOTS',
  GOLD_HELMET: 'HELMET',
  GOLD_CHESTPLATE: 'CHESTPLATE',
  GOLD_LEGGINGS: 'LEGGINGS',
  GOLD_BOOTS: 'BOOTS',
  DIAMOND_HELMET: 'HELMET',
  DIAMOND_CHESTPLATE: 'CHESTPLATE',
  DIAMOND_LEGGINGS: 'LEGGINGS',
  DIAMOND_BOOTS: 'BOOTS',
}

// Capped at MAX_ARMOR_POINTS (20) to match Minecraft Java Edition.
export const MAX_ARMOR_POINTS = 20
