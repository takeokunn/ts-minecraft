import type { InventoryItem } from '@ts-minecraft/core'

// Armor slot types — correspond to the four equipment positions.
export type ArmorSlot = 'HELMET' | 'CHESTPLATE' | 'LEGGINGS' | 'BOOTS'

// Defense points per armor piece — matches Minecraft Java Edition values.
// These feed directly into combat.ts computeAttackDamage (armorPoints param).
export const ARMOR_DEFENSE_POINTS: Partial<Record<InventoryItem, number>> = {
  LEATHER_HELMET: 1,
  LEATHER_CHESTPLATE: 3,
  LEATHER_LEGGINGS: 2,
  LEATHER_BOOTS: 1,
  IRON_HELMET: 2,
  IRON_CHESTPLATE: 6,
  IRON_LEGGINGS: 5,
  IRON_BOOTS: 2,
  DIAMOND_HELMET: 3,
  DIAMOND_CHESTPLATE: 8,
  DIAMOND_LEGGINGS: 6,
  DIAMOND_BOOTS: 3,
}

// Which slot a given item occupies (none → item is not armor).
export const ARMOR_SLOT_MAP: Partial<Record<InventoryItem, ArmorSlot>> = {
  LEATHER_HELMET: 'HELMET',
  LEATHER_CHESTPLATE: 'CHESTPLATE',
  LEATHER_LEGGINGS: 'LEGGINGS',
  LEATHER_BOOTS: 'BOOTS',
  IRON_HELMET: 'HELMET',
  IRON_CHESTPLATE: 'CHESTPLATE',
  IRON_LEGGINGS: 'LEGGINGS',
  IRON_BOOTS: 'BOOTS',
  DIAMOND_HELMET: 'HELMET',
  DIAMOND_CHESTPLATE: 'CHESTPLATE',
  DIAMOND_LEGGINGS: 'LEGGINGS',
  DIAMOND_BOOTS: 'BOOTS',
}

// Capped at MAX_ARMOR_POINTS (20) to match Minecraft Java Edition.
export const MAX_ARMOR_POINTS = 20
