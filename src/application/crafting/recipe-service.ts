import { Array as Arr, Effect, HashMap, Option } from 'effect'
import { Recipe, RecipeIngredient } from '@/domain/crafting'
import type { BlockType } from '@/domain/block'
import { RecipeError } from '@/domain/errors'
import type { InventoryService } from '@/application/inventory/inventory-service'
import { RecipeId } from '@/shared/kernel'

export class RecipeService extends Effect.Service<RecipeService>()(
  '@minecraft/application/RecipeService',
  {
    effect: Effect.succeed((() => {
      const recipes: ReadonlyArray<Recipe> = [
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

      // Immutable lookup map: RecipeId → Recipe (HashMap replaces native Map for structural equality)
      const recipeMap = HashMap.fromIterable(Arr.map(recipes, (r) => [r.id, r] as [RecipeId, Recipe]))

      const getAllRecipes = (): ReadonlyArray<Recipe> => recipes

      // findById: HashMap.get already returns Option<Recipe> — no fromNullable needed
      const findById = (id: RecipeId): Option.Option<Recipe> => HashMap.get(recipeMap, id)

      const findCraftable = (available: HashMap.HashMap<BlockType, number>): ReadonlyArray<Recipe> =>
        Arr.filter(recipes, (recipe) =>
          Arr.every(recipe.ingredients, (ing) =>
            Option.getOrElse(HashMap.get(available, ing.blockType), () => 0) >= ing.count
          )
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
          const recipe = yield* Option.match(findById(recipeId), {
            onNone: () => Effect.fail(new RecipeError({ operation: 'craft', cause: `Recipe not found: ${recipeId}` })),
            onSome: Effect.succeed,
          })

          // 2. Count available items per block type in inventory using immutable HashMap accumulation
          const slots = yield* inventoryService.getAllSlots()
          const available = Arr.reduce(
            slots,
            HashMap.empty<BlockType, number>(),
            (map, slot) => Option.match(slot, {
              onSome: ({ blockType, count }) => HashMap.set(
                map,
                blockType,
                Option.getOrElse(HashMap.get(map, blockType), () => 0) + count
              ),
              onNone: () => map,
            })
          )

          // 3. Verify all ingredients are present before touching inventory
          const shortageOpt = Arr.findFirst(recipe.ingredients, (ing) =>
            Option.getOrElse(HashMap.get(available, ing.blockType), () => 0) < ing.count
          )
          yield* Option.match(shortageOpt, {
            onNone: () => Effect.void,
            onSome: (ing) => Effect.fail(new RecipeError({
              operation: 'craft',
              cause: `Insufficient ${ing.blockType}: need ${ing.count}, have ${Option.getOrElse(HashMap.get(available, ing.blockType), () => 0)}`,
            })),
          })

          // 4. Remove ingredients
          yield* Effect.forEach(
            recipe.ingredients,
            (ing) =>
              inventoryService.removeBlock(ing.blockType, ing.count).pipe(
                Effect.flatMap((removed) =>
                  removed
                    ? Effect.void
                    : Effect.fail(
                        new RecipeError({
                          operation: 'craft',
                          cause: `Failed to remove ${ing.count}x ${ing.blockType} from inventory`,
                        })
                      )
                )
              ),
            { concurrency: 1 }
          )

          // 5. Add output (ignore if inventory is full)
          yield* inventoryService.addBlock(recipe.output.blockType, recipe.output.count)
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
