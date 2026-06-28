import { TOOL_RECIPES } from './tool-recipes'
import { ARMOR_RECIPES } from './armor-recipes'
import { MISC_RECIPES } from './misc-recipes'
import type { Recipe } from '../../domain/crafting'

export const RECIPE_DEFINITIONS: ReadonlyArray<Recipe> = [
  ...MISC_RECIPES,
  ...ARMOR_RECIPES,
  ...TOOL_RECIPES,
]
