import { Context, Effect, Layer } from 'effect'
import { RecipeValidationReport, validateRecipe, validateRecipeStructure } from '../aggregate'
import { CraftingRecipe, InvalidRecipeError } from '../types'

export interface RecipeValidationService {
  readonly validate: (recipe: CraftingRecipe) => Effect.Effect<RecipeValidationReport, never>
  readonly ensureValid: (recipe: CraftingRecipe) => Effect.Effect<void, InvalidRecipeError>
}

export const RecipeValidationService = Context.GenericTag<RecipeValidationService>(
  '@minecraft/domain/crafting/RecipeValidationService'
)

export const RecipeValidationServiceLive = Layer.effect(
  RecipeValidationService,
  Effect.succeed({
    validate: (recipe: CraftingRecipe) => validateRecipe(recipe),
    ensureValid: (recipe: CraftingRecipe) => validateRecipeStructure(recipe),
  })
)
