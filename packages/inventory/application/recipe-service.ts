import { Array as Arr, Effect, HashMap, Option } from 'effect'
import { Recipe } from '../domain/crafting'
import type { InventoryItem } from '@ts-minecraft/core'
import { RecipeError } from '../domain/errors'
import type { InventoryService } from './inventory-service'
import { RecipeId } from '@ts-minecraft/core'
import { RECIPE_DEFINITIONS } from './recipes'
import {
  buildRecipeMap,
  canUseRecipe,
  countAvailableItems,
  findInsufficientIngredient,
} from './recipe-service-state'
import {
  tryCraftRecipeItems,
} from './recipe-service-helpers'

export class RecipeService extends Effect.Service<RecipeService>()(
  '@minecraft/application/RecipeService',
  {
    effect: Effect.succeed((() => {
      const recipes: ReadonlyArray<Recipe> = RECIPE_DEFINITIONS

      const recipeMap = buildRecipeMap(recipes)

      const getAllRecipes = (): ReadonlyArray<Recipe> => recipes

      const findById = (id: RecipeId): Option.Option<Recipe> => HashMap.get(recipeMap, id)

      const findCraftable = (
        available: HashMap.HashMap<InventoryItem, number>,
        hasCraftingTableAccess = true,
        hasFurnaceAccess = true,
      ): ReadonlyArray<Recipe> =>
        Arr.filter(recipes, (recipe) =>
          canUseRecipe(recipe, hasCraftingTableAccess, hasFurnaceAccess)
          && Option.isNone(findInsufficientIngredient(available, recipe.ingredients))
        )

      const craft = (
        recipeId: RecipeId,
        inventoryService: InventoryService,
        hasCraftingTableAccess = true,
        hasFurnaceAccess = true,
      ): Effect.Effect<void, RecipeError> =>
        Effect.gen(function* () {
          const recipe = Option.getOrNull(findById(recipeId))
          if (recipe === null) return yield* Effect.fail(new RecipeError({ operation: 'craft', cause: `Recipe not found: ${recipeId}` }))

          const slots = yield* inventoryService.getAllSlots()
          const available = countAvailableItems(slots)

          // Pre-check all ingredients before any removal to prevent partial consumption
          const shortageOpt = findInsufficientIngredient(available, recipe.ingredients)
          if (!canUseRecipe(recipe, hasCraftingTableAccess, hasFurnaceAccess)) {
            return yield* Effect.fail(new RecipeError({
              operation: 'craft',
              cause: recipe.station === 'furnace'
                ? `Recipe requires a furnace: ${recipeId}`
                : `Recipe requires a crafting table: ${recipeId}`,
            }))
          }
          const shortage = Option.getOrNull(shortageOpt)
          if (shortage !== null) {
            yield* Effect.fail(new RecipeError({
              operation: 'craft',
              cause: `Insufficient ${shortage.itemType}: need ${shortage.count}, have ${Option.getOrElse(HashMap.get(available, shortage.itemType), () => 0)}`,
            }))
          }

          const craftFailure = yield* tryCraftRecipeItems(inventoryService, recipe)
          if (Option.isSome(craftFailure)) {
            yield* Effect.fail(new RecipeError({
              operation: 'craft',
              cause: craftFailure.value.cause,
            }))
          }
        })

      return {
        getAllRecipes,
        findById,
        findCraftable,
        craft,
      }
    })()),
  }
) {}
