import { Array as Arr, Effect, HashMap, Option } from 'effect'
import { Recipe } from '../domain/crafting'
import type { InventoryItem } from '@ts-minecraft/kernel'
import { RecipeError } from '../domain/errors'
import type { InventoryService } from './inventory-service'
import { RecipeId } from '@ts-minecraft/kernel'
import { RECIPE_DEFINITIONS } from './recipe-service.config'

export class RecipeService extends Effect.Service<RecipeService>()(
  '@minecraft/application/RecipeService',
  {
    effect: Effect.succeed((() => {
      const recipes: ReadonlyArray<Recipe> = RECIPE_DEFINITIONS

      const recipeMap = HashMap.fromIterable(Arr.map(recipes, (r) => [r.id, r] as [RecipeId, Recipe]))

      const getAllRecipes = (): ReadonlyArray<Recipe> => recipes

      // findById: HashMap.get already returns Option<Recipe> — no fromNullable needed
      const findById = (id: RecipeId): Option.Option<Recipe> => HashMap.get(recipeMap, id)

      const canUseRecipe = (
        recipe: Recipe,
        hasCraftingTableAccess: boolean,
        hasFurnaceAccess: boolean,
      ): boolean =>
        recipe.station === 'inventory'
        || (recipe.station === 'crafting_table' && hasCraftingTableAccess)
        || (recipe.station === 'furnace' && hasFurnaceAccess)

      const findCraftable = (
        available: HashMap.HashMap<InventoryItem, number>,
        hasCraftingTableAccess = true,
        hasFurnaceAccess = true,
      ): ReadonlyArray<Recipe> =>
        Arr.filter(recipes, (recipe) =>
          canUseRecipe(recipe, hasCraftingTableAccess, hasFurnaceAccess)
          &&
          Arr.every(recipe.ingredients, (ing) =>
            Option.getOrElse(HashMap.get(available, ing.itemType), () => 0) >= ing.count
          )
        )

      // Atomicity note: ingredient counts are checked before any removal. If all checks pass,
      // removals are performed sequentially. In practice the pre-check prevents partial failure,
      // but the operation is NOT transactional — a concurrent mutation between check and removal
      // could leave inventory in an inconsistent state.
      const craft = (
        recipeId: RecipeId,
        inventoryService: InventoryService,
        hasCraftingTableAccess = true,
        hasFurnaceAccess = true,
      ): Effect.Effect<void, RecipeError> =>
        Effect.gen(function* () {
          const recipe = yield* Option.match(findById(recipeId), {
            onNone: () => Effect.fail(new RecipeError({ operation: 'craft', cause: `Recipe not found: ${recipeId}` })),
            onSome: Effect.succeed,
          })

          const slots = yield* inventoryService.getAllSlots()
          const available = Arr.reduce(
            slots,
            HashMap.empty<InventoryItem, number>(),
            (map, slot) => Option.match(slot, {
              onSome: ({ itemType, count }) => HashMap.set(
                map,
                itemType,
                Option.getOrElse(HashMap.get(map, itemType), () => 0) + count
              ),
              onNone: () => map,
            })
          )

          // Pre-check all ingredients before any removal to prevent partial consumption
          const shortageOpt = Arr.findFirst(recipe.ingredients, (ing) =>
            Option.getOrElse(HashMap.get(available, ing.itemType), () => 0) < ing.count
          )
          if (!canUseRecipe(recipe, hasCraftingTableAccess, hasFurnaceAccess)) {
            return yield* Effect.fail(new RecipeError({
              operation: 'craft',
              cause: recipe.station === 'furnace'
                ? `Recipe requires a furnace: ${recipeId}`
                : `Recipe requires a crafting table: ${recipeId}`,
            }))
          }
          yield* Option.match(shortageOpt, {
            onNone: () => Effect.void,
            onSome: (ing) => Effect.fail(new RecipeError({
              operation: 'craft',
              cause: `Insufficient ${ing.itemType}: need ${ing.count}, have ${Option.getOrElse(HashMap.get(available, ing.itemType), () => 0)}`,
            })),
          })

          yield* Effect.forEach(
            recipe.ingredients,
            (ing) =>
              inventoryService.removeBlock(ing.itemType, ing.count).pipe(
                Effect.mapError(() => new RecipeError({
                  operation: 'craft',
                  cause: `Failed to remove ${ing.count}x ${ing.itemType} from inventory`,
                }))
              ),
            { concurrency: 1 }
          )

          yield* inventoryService.addBlock(recipe.output.itemType, recipe.output.count).pipe(
            Effect.mapError(() => new RecipeError({
              operation: 'craft',
              cause: `No space for output: ${recipe.output.count}x ${recipe.output.itemType}`,
            }))
          )
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
export const RecipeServiceLive = RecipeService.Default
