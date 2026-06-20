import { Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import { ARMOR_DEFENSE_POINTS, ARMOR_SLOT_MAP, MAX_ARMOR_POINTS } from './armor.config'
import type { ArmorItem, ArmorSlot } from './armor.config'

export const isArmorItem = (item: InventoryItem): item is ArmorItem =>
  Object.hasOwn(ARMOR_DEFENSE_POINTS, item)

export const getArmorDefensePoints = (item: InventoryItem): Option.Option<number> =>
  isArmorItem(item) ? Option.some(ARMOR_DEFENSE_POINTS[item]) : Option.none()

export const getArmorSlot = (item: InventoryItem): Option.Option<ArmorSlot> =>
  isArmorItem(item) ? Option.some(ARMOR_SLOT_MAP[item]) : Option.none()

// Sum total defense points for a set of equipped armor items.
// Capped at MAX_ARMOR_POINTS (20) to match Minecraft Java Edition.
export const computeTotalArmorPoints = (equippedItems: ReadonlyArray<InventoryItem>): number => {
  const total = equippedItems.reduce((sum, item) => {
    return sum + Option.getOrElse(getArmorDefensePoints(item), () => 0)
  }, 0)
  return Math.min(total, MAX_ARMOR_POINTS)
}
