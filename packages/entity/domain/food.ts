import { Option } from 'effect'
import type { ItemType } from '@ts-minecraft/core'
import { type FoodProperties, FOOD_TABLE } from './food.config'

// Re-export config data and types so callers can import from one location.
export type { FoodProperties } from './food.config'
export { FOOD_TABLE } from './food.config'

export const getFoodProperties = (item: ItemType): Option.Option<FoodProperties> =>
  Option.fromNullable(FOOD_TABLE[item])

export const isFood = (item: ItemType): boolean => Option.isSome(getFoodProperties(item))
