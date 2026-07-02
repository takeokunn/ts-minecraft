import { Option } from 'effect'
import type { ItemType } from '@ts-minecraft/core'
import { isArmorItem } from '@ts-minecraft/inventory/domain/armor'
import { getFoodProperties, type FoodProperties } from '@ts-minecraft/entity/domain/food-resolution'
import { getPotionUse, type PotionUse } from '@ts-minecraft/entity/domain/potion'

export type HeldItemUseRoute =
  | { readonly kind: 'fishingRod' }
  | { readonly kind: 'armor' }
  | { readonly kind: 'food'; readonly food: FoodProperties }
  | { readonly kind: 'potion'; readonly potion: PotionUse }
  | { readonly kind: 'none' }

export const resolveHeldItemUseRoute = (item: ItemType | null): HeldItemUseRoute => {
  if (item === null) return { kind: 'none' }
  if (item === 'FISHING_ROD') return { kind: 'fishingRod' }
  if (isArmorItem(item)) return { kind: 'armor' }

  const potion = Option.getOrNull(getPotionUse(item))
  if (potion !== null) return { kind: 'potion', potion }

  const food = Option.getOrNull(getFoodProperties(item))
  if (food !== null) return { kind: 'food', food }
  return { kind: 'none' }
}
