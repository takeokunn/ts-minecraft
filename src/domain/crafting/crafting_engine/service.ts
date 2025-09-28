import { Context, Effect, Option } from 'effect'
import {
  CraftingGrid,
  CraftingRecipe,
  CraftingResult,
  PatternMismatchError
} from '../types'

export interface CraftingEngineService {
  readonly matchRecipe: (grid: CraftingGrid) => Effect.Effect<Option.Option<CraftingRecipe>, never>

  readonly validateRecipeMatch: (
    grid: CraftingGrid,
    recipe: CraftingRecipe
  ) => Effect.Effect<boolean, PatternMismatchError>

  readonly executeCrafting: (
    grid: CraftingGrid,
    recipe: CraftingRecipe
  ) => Effect.Effect<CraftingResult, PatternMismatchError>

  readonly findMatchingRecipes: (grid: CraftingGrid) => Effect.Effect<ReadonlyArray<CraftingRecipe>, never>
}

export const CraftingEngineService = Context.GenericTag<CraftingEngineService>(
  '@minecraft/domain/CraftingEngineService'
)
