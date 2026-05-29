import { Option } from 'effect'
import type { ItemType } from '@ts-minecraft/kernel'

// How much an edible item restores when consumed. Saturation gained on eating is
// `foodLevel * saturationModifier * 2` (the vanilla formula applied in
// HungerService.eat), capped at the resulting foodLevel.
export type FoodProperties = {
  readonly foodLevel: number
  readonly saturationModifier: number
}

// Edible items and their Minecraft Java Edition restoration values. Items absent
// from this table are not food (getFoodProperties → none, isFood → false).
const FOOD_TABLE: Partial<Record<ItemType, FoodProperties>> = {
  APPLE: { foodLevel: 4, saturationModifier: 0.3 },
  // Fish — raw restores 2, cooked restores 5 (vanilla Java)
  RAW_COD: { foodLevel: 2, saturationModifier: 0.1 },
  COOKED_COD: { foodLevel: 5, saturationModifier: 0.6 },
  RAW_SALMON: { foodLevel: 2, saturationModifier: 0.1 },
  COOKED_SALMON: { foodLevel: 6, saturationModifier: 0.8 },
  TROPICAL_FISH: { foodLevel: 1, saturationModifier: 0.1 },
  PUFFERFISH: { foodLevel: 1, saturationModifier: 0.1 },
  BREAD: { foodLevel: 5, saturationModifier: 0.6 },
  CARROT: { foodLevel: 3, saturationModifier: 0.6 },
  COOKED_PORKCHOP: { foodLevel: 8, saturationModifier: 0.8 },
  COOKED_BEEF: { foodLevel: 8, saturationModifier: 0.8 },
  // Raw beef (cow drop) is edible like the raw fish above — vanilla restores 3
  // hunger / 1.8 saturation. Smelting it into COOKED_BEEF is still better value.
  RAW_BEEF: { foodLevel: 3, saturationModifier: 0.3 },
  // Best food in the game — full hunger + very high saturation (vanilla Java).
  GOLDEN_APPLE: { foodLevel: 4, saturationModifier: 1.2 },
  // Farming harvest
  WHEAT: { foodLevel: 1, saturationModifier: 0 },
  // Zombie drop — edible but barely nourishing (vanilla also applies Hunger).
  ROTTEN_FLESH: { foodLevel: 4, saturationModifier: 0.1 },
}

export const getFoodProperties = (item: ItemType): Option.Option<FoodProperties> =>
  Option.fromNullable(FOOD_TABLE[item])

export const isFood = (item: ItemType): boolean => Option.isSome(getFoodProperties(item))
