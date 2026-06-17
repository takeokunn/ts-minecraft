import { Array as Arr, HashMap, Option } from 'effect'
import type { InventoryItem, RecipeId } from '@ts-minecraft/core'
import type { Recipe, RecipeIngredient } from '../domain/crafting'
import type { ItemStack } from '../domain/item-stack'

export const buildRecipeMap = (
  recipes: ReadonlyArray<Recipe>,
): HashMap.HashMap<RecipeId, Recipe> =>
  HashMap.fromIterable(Arr.map(recipes, (recipe) => [recipe.id, recipe] as const))

export const canUseRecipe = (
  recipe: Recipe,
  hasCraftingTableAccess: boolean,
  hasFurnaceAccess: boolean,
): boolean =>
  recipe.station === 'inventory'
  || (recipe.station === 'crafting_table' && hasCraftingTableAccess)
  || (recipe.station === 'furnace' && hasFurnaceAccess)

export const countAvailableItems = (
  slots: ReadonlyArray<Option.Option<ItemStack>>,
): HashMap.HashMap<InventoryItem, number> =>
  Arr.reduce(slots, HashMap.empty<InventoryItem, number>(), (map, slot) => {
    const stack = Option.getOrNull(slot)
    if (stack === null) return map
    return HashMap.set(
      map,
      stack.itemType,
      Option.getOrElse(HashMap.get(map, stack.itemType), () => 0) + stack.count,
    )
  })

export const findInsufficientIngredient = (
  available: HashMap.HashMap<InventoryItem, number>,
  ingredients: ReadonlyArray<RecipeIngredient>,
): Option.Option<RecipeIngredient> =>
  Arr.findFirst(ingredients, (ing) =>
    Option.getOrElse(HashMap.get(available, ing.itemType), () => 0) < ing.count,
  )
