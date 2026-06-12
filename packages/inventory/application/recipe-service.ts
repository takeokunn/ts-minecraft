import { Array as Arr, Effect, HashMap, Option } from 'effect'
import { Recipe } from '../domain/crafting'
import type { InventoryItem } from '@ts-minecraft/core'
import { RecipeError } from '../domain/errors'
import type { InventoryService } from './inventory-service'
import { RecipeId } from '@ts-minecraft/core'
import { RECIPE_DEFINITIONS } from './recipes'

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

      // Atomicity: counts are pre-checked before any removal, and the body below
      // is transactional — it snapshots the inventory, then on ANY failure (a
      // mid-sequence removal error or no room for the output) restores the
      // snapshot, so a craft either fully succeeds or leaves the inventory
      // untouched. Ingredients are never consumed without producing the output
      // (verified by the "rolls back ... when there is no space for the output"
      // test). See the transaction comment on the snapshot below for mechanics.
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
          const available = Arr.reduce(slots, HashMap.empty<InventoryItem, number>(), (map, slot) => {
            const stack = Option.getOrNull(slot)
            if (stack === null) return map
            return HashMap.set(map, stack.itemType, Option.getOrElse(HashMap.get(map, stack.itemType), () => 0) + stack.count)
          })

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
          const shortage = Option.getOrNull(shortageOpt)
          if (shortage !== null) {
            yield* Effect.fail(new RecipeError({
              operation: 'craft',
              cause: `Insufficient ${shortage.itemType}: need ${shortage.count}, have ${Option.getOrElse(HashMap.get(available, shortage.itemType), () => 0)}`,
            }))
          }

          // Transactional craft: snapshot the inventory, then remove ingredients
          // and add the output. If ANY step fails — a mid-sequence removal error,
          // or no room for the output (a full inventory where ingredient removal
          // did not free a usable slot) — restore the snapshot so ingredients are
          // never silently consumed without producing the output. deserialize is
          // infallible, so the rollback always succeeds before re-failing.
          const snapshot = yield* inventoryService.serialize()
          yield* Effect.gen(function* () {
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
          }).pipe(
            Effect.catchAll((err) =>
              Effect.gen(function* () {
                yield* inventoryService.deserialize(snapshot)
                yield* Effect.fail(err)
              }),
            ),
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
