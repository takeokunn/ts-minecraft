import { Option } from 'effect'
import type { ItemType } from '@ts-minecraft/core'
import { APPLICABLE_TO, MAX_LEVEL } from './enchantment.config'
import { ENCHANTMENT_TYPES, type Enchantment, type EnchantmentType, type EnchantmentLevel } from './enchantment.types'

export const canEnchantItem = (item: ItemType, enchantment: EnchantmentType): boolean =>
  APPLICABLE_TO[enchantment].has(item)

const EMPTY_ENCHANTMENTS: ReadonlyArray<EnchantmentType> = Object.freeze([])

const appendItemEnchantment = (
  enchantmentsByItem: Map<ItemType, EnchantmentType[]>,
  item: ItemType,
  enchantment: EnchantmentType,
): void => {
  const existingEnchantments = enchantmentsByItem.get(item)

  if (existingEnchantments === undefined) {
    enchantmentsByItem.set(item, [enchantment])
    return
  }

  existingEnchantments.push(enchantment)
}

const freezeItemEnchantments = (
  enchantmentsByItem: ReadonlyMap<ItemType, ReadonlyArray<EnchantmentType>>,
): ReadonlyMap<ItemType, ReadonlyArray<EnchantmentType>> =>
  new Map(
    Array.from(enchantmentsByItem, ([item, enchantments]) => [
      item,
      Object.freeze([...enchantments]),
    ]),
  )

const buildItemEnchantments = (): ReadonlyMap<ItemType, ReadonlyArray<EnchantmentType>> => {
  const enchantmentsByItem = new Map<ItemType, EnchantmentType[]>()

  for (const enchantment of ENCHANTMENT_TYPES) {
    for (const item of APPLICABLE_TO[enchantment]) {
      appendItemEnchantment(enchantmentsByItem, item, enchantment)
    }
  }

  return freezeItemEnchantments(enchantmentsByItem)
}

const ITEM_ENCHANTMENTS = buildItemEnchantments()

export const isEnchantableItem = (item: ItemType): boolean => ITEM_ENCHANTMENTS.has(item)

export const getApplicableEnchantments = (item: ItemType): ReadonlyArray<EnchantmentType> => {
  if (!isEnchantableItem(item)) return EMPTY_ENCHANTMENTS

  const enchantments = ITEM_ENCHANTMENTS.get(item)
  return enchantments === undefined ? EMPTY_ENCHANTMENTS : enchantments
}

// Simple deterministic string hash (djb2-style).
const hashStr = (value: string): number => {
  let hash = 5381
  for (let index = 0; index < value.length; index++) hash = (hash * 33 ^ value.charCodeAt(index)) >>> 0
  return hash
}

// Returns the enchantment to apply to an item given the current XP level.
// The result is deterministic: same item + same level always picks the same enchantment.
// XP level controls the maximum enchantment level offered (higher XP -> stronger enchantments).
// Returns Option.none() if no enchantment applies to the item.
export const selectEnchantment = (itemType: ItemType, xpLevel: number): Option.Option<Enchantment> => {
  const applicable = getApplicableEnchantments(itemType)
  if (applicable.length === 0) return Option.none()

  const enchantmentType = applicable.at(hashStr(itemType + String(xpLevel)) % applicable.length)
  if (enchantmentType === undefined) return Option.none()

  const maxForType = MAX_LEVEL[enchantmentType]
  const enchantmentLevel = Math.min(maxForType, Math.max(1, Math.floor(xpLevel / 5))) as EnchantmentLevel
  return Option.some({ type: enchantmentType, level: enchantmentLevel })
}
