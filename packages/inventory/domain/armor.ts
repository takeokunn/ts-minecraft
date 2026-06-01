import { Option } from 'effect'
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

export const isArmorItem = (item: InventoryItem): boolean =>
  item in ARMOR_DEFENSE_POINTS

export const getArmorDefensePoints = (item: InventoryItem): Option.Option<number> =>
  Option.fromNullable(ARMOR_DEFENSE_POINTS[item])

export const getArmorSlot = (item: InventoryItem): Option.Option<ArmorSlot> =>
  Option.fromNullable(ARMOR_SLOT_MAP[item])

// Sum total defense points for a set of equipped armor items.
// Capped at MAX_ARMOR_POINTS (20) to match Minecraft Java Edition.
export const MAX_ARMOR_POINTS = 20

export const computeTotalArmorPoints = (equippedItems: ReadonlyArray<InventoryItem>): number => {
  const total = equippedItems.reduce((sum, item) => {
    return sum + Option.getOrElse(getArmorDefensePoints(item), () => 0)
  }, 0)
  return Math.min(total, MAX_ARMOR_POINTS)
}
