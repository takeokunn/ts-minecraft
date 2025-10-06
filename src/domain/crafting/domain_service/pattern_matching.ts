import { Context, Effect, Layer, Match, Option, pipe } from 'effect'
import { RecipeAggregate, canCraftWithGrid, matchShapedRecipe, matchShapelessRecipe } from '../aggregate'
import { CraftingGrid, CraftingRecipe, PatternMismatchError } from '../types'

export interface PatternMatchOutcome {
  readonly matched: boolean
  readonly aggregate: Option.Option<RecipeAggregate>
}

export interface PatternMatchingService {
  readonly matchRecipe: (recipe: CraftingRecipe, grid: CraftingGrid) => Effect.Effect<boolean, never>

  readonly matchAggregate: (
    aggregate: RecipeAggregate,
    grid: CraftingGrid
  ) => Effect.Effect<boolean, PatternMismatchError>

  readonly locateFirstMatch: (
    recipes: ReadonlyArray<RecipeAggregate>,
    grid: CraftingGrid
  ) => Effect.Effect<PatternMatchOutcome, never>
}

export const PatternMatchingService = Context.GenericTag<PatternMatchingService>(
  '@minecraft/domain/crafting/PatternMatchingService'
)

const evaluateRecipe = (recipe: CraftingRecipe, grid: CraftingGrid): boolean =>
  Match.value(recipe).pipe(
    Match.tags({
      shaped: (shaped) => matchShapedRecipe(shaped, grid),
      shapeless: (shapeless) => matchShapelessRecipe(shapeless, grid),
    })
  )

export const PatternMatchingServiceLive = Layer.effect(
  PatternMatchingService,
  Effect.gen(function* () {
    const matchRecipe: PatternMatchingService['matchRecipe'] = (recipe, grid) =>
      Effect.succeed(evaluateRecipe(recipe, grid))

    const matchAggregate: PatternMatchingService['matchAggregate'] = (aggregate, grid) =>
      canCraftWithGrid(aggregate, grid)

    const locateFirstMatch: PatternMatchingService['locateFirstMatch'] = (recipes, grid) =>
      Effect.reduce(recipes, Option.none<RecipeAggregate>(), (state, aggregate) =>
        Option.match(state, {
          onSome: () => Effect.succeed(state),
          onNone: () =>
            pipe(
              canCraftWithGrid(aggregate, grid),
              Effect.match({
                onFailure: () => Option.none<RecipeAggregate>(),
                onSuccess: () => Option.some(aggregate),
              })
            ),
        })
      ).pipe(Effect.map((aggregate) => ({ matched: Option.isSome(aggregate), aggregate })))

    return {
      matchRecipe,
      matchAggregate,
      locateFirstMatch,
    }
  })
)
