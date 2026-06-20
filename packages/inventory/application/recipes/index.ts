import { TOOL_RECIPES } from './tool-recipes'
import { ARMOR_RECIPES } from './armor-recipes'
import { BASIC_MISC_RECIPES } from './basic-misc-recipes'
import { SMELTING_MISC_RECIPES } from './smelting-misc-recipes'
import { EQUIPMENT_MISC_RECIPES } from './equipment-misc-recipes'
import type { Recipe } from '../../domain/crafting'

export const RECIPE_DEFINITIONS: ReadonlyArray<Recipe> = [
  ...BASIC_MISC_RECIPES,
  ...SMELTING_MISC_RECIPES,
  ...EQUIPMENT_MISC_RECIPES,
  ...ARMOR_RECIPES,
  ...TOOL_RECIPES,
]
