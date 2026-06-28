import type { Recipe } from '../../domain/crafting'
import { BASIC_MISC_RECIPES } from './basic-misc-recipes'
import { SMELTING_MISC_RECIPES } from './smelting-misc-recipes'
import { EQUIPMENT_MISC_RECIPES } from './equipment-misc-recipes'

export const MISC_RECIPES: ReadonlyArray<Recipe> = [
  ...BASIC_MISC_RECIPES,
  ...SMELTING_MISC_RECIPES,
  ...EQUIPMENT_MISC_RECIPES,
]
