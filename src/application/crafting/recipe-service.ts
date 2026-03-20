import { Effect, Option, Option as O } from 'effect'
import { Recipe, RecipeIngredient } from '@/domain/crafting'
import { RecipeError } from '@/domain/errors'
import type { InventoryService } from '@/application/inventory/inventory-service'
import { RecipeId } from '@/shared/kernel'

export class RecipeService extends Effect.Service<RecipeService>()(
  '@minecraft/application/RecipeService',
  {
    effect: Effect.sync(() => {
      const recipes: Recipe[] = [
        new Recipe({
          id: RecipeId.make('wood-to-planks'),
          ingredients: [new RecipeIngredient({ blockType: 'WOOD', count: 1 })],
          output: { blockType: 'WOOD', count: 4 },
        }),
        new Recipe({
          id: RecipeId.make('stone-to-cobblestone'),
          ingredients: [new RecipeIngredient({ blockType: 'STONE', count: 1 })],
          output: { blockType: 'COBBLESTONE', count: 1 },
        }),
        new Recipe({
          id: RecipeId.make('grass-to-dirt'),
          ingredients: [new RecipeIngredient({ blockType: 'GRASS', count: 1 })],
          output: { blockType: 'DIRT', count: 1 },
        }),
        new Recipe({
          id: RecipeId.make('sand-and-gravel-to-dirt'),
          ingredients: [
            new RecipeIngredient({ blockType: 'SAND', count: 1 }),
            new RecipeIngredient({ blockType: 'GRAVEL', count: 1 }),
          ],
          output: { blockType: 'DIRT', count: 2 },
        }),
        new Recipe({
          id: RecipeId.make('wood-and-stone-to-glass'),
          ingredients: [
            new RecipeIngredient({ blockType: 'WOOD', count: 2 }),
            new RecipeIngredient({ blockType: 'SAND', count: 4 }),
          ],
          output: { blockType: 'GLASS', count: 4 },
        }),
        new Recipe({
          id: RecipeId.make('cobblestone-bulk'),
          ingredients: [new RecipeIngredient({ blockType: 'COBBLESTONE', count: 4 })],
          output: { blockType: 'STONE', count: 4 },
        }),
        new Recipe({
          id: RecipeId.make('dirt-to-gravel'),
          ingredients: [new RecipeIngredient({ blockType: 'DIRT', count: 2 })],
          output: { blockType: 'GRAVEL', count: 1 },
        }),
      ]

      const recipeMap = new Map<RecipeId, Recipe>(recipes.map((r) => [r.id, r]))

      const getAllRecipes = (): Recipe[] => recipes

      const findById = (id: RecipeId): Option.Option<Recipe> => Option.fromNullable(recipeMap.get(id))

      const findCraftable = (available: Map<string, number>): Recipe[] =>
        recipes.filter((recipe) =>
          recipe.ingredients.every((ing) => (available.get(ing.blockType) ?? 0) >= ing.count)
        )

      /**
       * Attempts to craft a recipe by consuming ingredients from inventory and adding the output.
       *
       * Atomicity note: ingredient counts are checked before any removal. If all checks pass,
       * removals are performed sequentially. In practice the pre-check prevents partial failure,
       * but the operation is NOT transactional — a concurrent mutation between check and removal
       * could leave inventory in an inconsistent state.
       */
      const craft = (
        recipeId: RecipeId,
        inventoryService: InventoryService,
      ): Effect.Effect<void, RecipeError> =>
        Effect.gen(function* () {
          // 1. Locate the recipe
          const recipeOpt = findById(recipeId)
          if (Option.isNone(recipeOpt)) {
            return yield* Effect.fail(
              new RecipeError({ operation: 'craft', cause: `Recipe not found: ${recipeId}` }),
            )
          }
          const recipe = recipeOpt.value

          // 2. Count available items per block type in inventory
          const slots = yield* inventoryService.getAllSlots()
          const available = new Map<string, number>()
          for (const slot of slots) {
            if (O.isSome(slot)) {
              const { blockType, count } = slot.value
              available.set(blockType, (available.get(blockType) ?? 0) + count)
            }
          }

          // 3. Verify all ingredients are present before touching inventory
          for (const ing of recipe.ingredients) {
            const have = available.get(ing.blockType) ?? 0
            if (have < ing.count) {
              return yield* Effect.fail(
                new RecipeError({
                  operation: 'craft',
                  cause: `Insufficient ${ing.blockType}: need ${ing.count}, have ${have}`,
                }),
              )
            }
          }

          // 4. Remove ingredients
          for (const ing of recipe.ingredients) {
            const removed = yield* inventoryService.removeBlock(ing.blockType, ing.count)
            if (!removed) {
              return yield* Effect.fail(
                new RecipeError({
                  operation: 'craft',
                  cause: `Failed to remove ${ing.count}x ${ing.blockType} from inventory`,
                }),
              )
            }
          }

          // 5. Add output (ignore if inventory is full)
          yield* inventoryService.addBlock(recipe.output.blockType, recipe.output.count)
        })

      return {
        getAllRecipes,
        findById,
        findCraftable,
        craft,
      }
    }),
  }
) {}
export const RecipeServiceLive = RecipeService.Default
