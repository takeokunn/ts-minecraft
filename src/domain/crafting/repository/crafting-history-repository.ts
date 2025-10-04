import { Array, Context, Effect, Layer, Option, Ref, pipe } from 'effect'
import { CraftingResult } from '../application_service/crafting-engine'
import { RecipeId } from '../types'

export interface CraftingHistoryRepository {
  readonly append: (result: CraftingResult) => Effect.Effect<void, never>
  readonly recent: (limit: number) => Effect.Effect<ReadonlyArray<CraftingResult>, never>
  readonly byRecipe: (recipeId: RecipeId) => Effect.Effect<ReadonlyArray<CraftingResult>, never>
}

export const CraftingHistoryRepository = Context.GenericTag<CraftingHistoryRepository>(
  '@minecraft/domain/crafting/CraftingHistoryRepository'
)

export const CraftingHistoryRepositoryLive = Layer.scoped(
  CraftingHistoryRepository,
  Effect.gen(function* () {
    const state = yield* Ref.make<ReadonlyArray<CraftingResult>>([])

    const append: CraftingHistoryRepository['append'] = (result) =>
      Ref.update(state, (current) => [...current, result])

    const recent: CraftingHistoryRepository['recent'] = (limit) =>
      pipe(
        Ref.get(state),
        Effect.map((history) => history.slice(-limit))
      )

    const byRecipe: CraftingHistoryRepository['byRecipe'] = (recipeId) =>
      pipe(
        Ref.get(state),
        Effect.map((history) => history.filter((entry) => entry.recipe.id === recipeId))
      )

    return {
      append,
      recent,
      byRecipe,
    }
  })
)
