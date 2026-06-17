import { Option } from 'effect'
import type { ItemType } from '@ts-minecraft/core'
import { type FoodItem, type FoodProperties, FOOD_TABLE } from './food.config'

// Re-export config data and types so callers can import from one location.
export type { FoodItem, FoodProperties } from './food.config'
export { FOOD_ITEMS, FOOD_TABLE } from './food.config'

export const getFoodProperties = (item: ItemType): Option.Option<FoodProperties> =>
  isFood(item) ? Option.some(FOOD_TABLE[item]) : Option.none()

export const isFood = (item: ItemType): item is FoodItem => Object.hasOwn(FOOD_TABLE, item)
