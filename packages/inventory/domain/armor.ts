import { Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import { ARMOR_DEFENSE_POINTS, ARMOR_SLOT_MAP, MAX_ARMOR_POINTS } from './armor.config'

export type { ArmorSlot } from './armor.config'
export { ARMOR_DEFENSE_POINTS, ARMOR_SLOT_MAP, MAX_ARMOR_POINTS }

export const isArmorItem = (item: InventoryItem): boolean =>
  item in ARMOR_DEFENSE_POINTS

export const getArmorDefensePoints = (item: InventoryItem): Option.Option<number> =>
  Option.fromNullable(ARMOR_DEFENSE_POINTS[item])

export const getArmorSlot = (item: InventoryItem): Option.Option<import('./armor.config').ArmorSlot> =>
  Option.fromNullable(ARMOR_SLOT_MAP[item])

// Sum total defense points for a set of equipped armor items.
// Capped at MAX_ARMOR_POINTS (20) to match Minecraft Java Edition.
export const computeTotalArmorPoints = (equippedItems: ReadonlyArray<InventoryItem>): number => {
  const total = equippedItems.reduce((sum, item) => {
    return sum + Option.getOrElse(getArmorDefensePoints(item), () => 0)
  }, 0)
  return Math.min(total, MAX_ARMOR_POINTS)
}
