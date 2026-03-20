import { Effect } from 'effect'
import { Recipe, RecipeIngredient } from '@/domain/crafting'

export class RecipeService extends Effect.Service<RecipeService>()(
  '@minecraft/application/RecipeService',
  {
    effect: Effect.sync(() => {
      const recipes: Recipe[] = [
        new Recipe({
          id: 'wood-to-planks',
          ingredients: [new RecipeIngredient({ blockType: 'WOOD', count: 1 })],
          output: { blockType: 'WOOD', count: 4 },
        }),
        new Recipe({
          id: 'stone-to-cobblestone',
          ingredients: [new RecipeIngredient({ blockType: 'STONE', count: 1 })],
          output: { blockType: 'COBBLESTONE', count: 1 },
        }),
        new Recipe({
          id: 'grass-to-dirt',
          ingredients: [new RecipeIngredient({ blockType: 'GRASS', count: 1 })],
          output: { blockType: 'DIRT', count: 1 },
        }),
        new Recipe({
          id: 'sand-and-gravel-to-dirt',
          ingredients: [
            new RecipeIngredient({ blockType: 'SAND', count: 1 }),
            new RecipeIngredient({ blockType: 'GRAVEL', count: 1 }),
          ],
          output: { blockType: 'DIRT', count: 2 },
        }),
        new Recipe({
          id: 'wood-and-stone-to-glass',
          ingredients: [
            new RecipeIngredient({ blockType: 'WOOD', count: 2 }),
            new RecipeIngredient({ blockType: 'SAND', count: 4 }),
          ],
          output: { blockType: 'GLASS', count: 4 },
        }),
        new Recipe({
          id: 'cobblestone-bulk',
          ingredients: [new RecipeIngredient({ blockType: 'COBBLESTONE', count: 4 })],
          output: { blockType: 'STONE', count: 4 },
        }),
        new Recipe({
          id: 'dirt-to-gravel',
          ingredients: [new RecipeIngredient({ blockType: 'DIRT', count: 2 })],
          output: { blockType: 'GRAVEL', count: 1 },
        }),
      ]

      const recipeMap = new Map<string, Recipe>(recipes.map((r) => [r.id, r]))

      return {
        getAllRecipes: (): Recipe[] => recipes,

        findById: (id: string): Recipe | undefined => recipeMap.get(id),

        findCraftable: (available: Map<string, number>): Recipe[] =>
          recipes.filter((recipe) =>
            recipe.ingredients.every((ing) => (available.get(ing.blockType) ?? 0) >= ing.count)
          ),
      }
    }),
  }
) {}
export const RecipeServiceLive = RecipeService.Default
