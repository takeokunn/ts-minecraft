import { Context, Effect } from 'effect'
import {
  CraftingRecipe,
  DuplicateRecipeError,
  InvalidRecipeError,
  RecipeCategory,
  RecipeId,
  RecipeNotFoundError,
} from '../types'

export interface RecipeRegistryService {
  readonly register: (recipe: CraftingRecipe) => Effect.Effect<void, DuplicateRecipeError | InvalidRecipeError>

  readonly unregister: (recipeId: RecipeId) => Effect.Effect<void, RecipeNotFoundError>

  readonly getById: (recipeId: RecipeId) => Effect.Effect<CraftingRecipe, RecipeNotFoundError>

  readonly getByCategory: (category: RecipeCategory) => Effect.Effect<ReadonlyArray<CraftingRecipe>, never>

  readonly getAllRecipes: () => Effect.Effect<ReadonlyArray<CraftingRecipe>, never>

  readonly getRecipeCount: () => Effect.Effect<number, never>

  readonly hasRecipe: (recipeId: RecipeId) => Effect.Effect<boolean, never>

  readonly validateAndRegister: (
    recipe: CraftingRecipe
  ) => Effect.Effect<void, DuplicateRecipeError | InvalidRecipeError>

  readonly getRecipesByResult: (itemId: string) => Effect.Effect<ReadonlyArray<CraftingRecipe>, never>
}

export const RecipeRegistryService = Context.GenericTag<RecipeRegistryService>(
  '@minecraft/domain/RecipeRegistryService'
)
