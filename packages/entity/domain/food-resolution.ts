import { Option } from 'effect'
import type { ItemType } from '@ts-minecraft/core'
import { FOOD_TABLE, type FoodItem, type FoodProperties } from './food'

export type { FoodItem, FoodProperties } from './food'

export const isFood = (item: ItemType): item is FoodItem => Object.hasOwn(FOOD_TABLE, item)

export const getFoodProperties = (item: ItemType): Option.Option<FoodProperties> =>
  isFood(item) ? Option.some(FOOD_TABLE[item]) : Option.none()
