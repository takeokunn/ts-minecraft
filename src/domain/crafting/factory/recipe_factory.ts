import { ParseResult } from '@effect/schema/ParseResult'
import { Context, Effect, Layer, Random, Schema, pipe } from 'effect'
import {
  CraftingDifficulty,
  CraftingDifficultySchema,
  CraftingTime,
  CraftingTimeSchema,
  RecipeAggregate,
  SuccessRate,
  SuccessRateSchema,
  cloneRecipeAggregate,
  createRecipeAggregate,
} from '../aggregate'
import { CraftingRecipe, RecipeId, RecipeIdSchema } from '../types'

export interface RecipeFactoryService {
  readonly create: (
    recipe: CraftingRecipe,
    options?: Partial<{
      id: RecipeId
      difficulty: CraftingDifficulty
      craftingTime: CraftingTime
      successRate: SuccessRate
    }>
  ) => Effect.Effect<RecipeAggregate, ParseResult.ParseError>

  readonly cloneWithId: (
    aggregate: RecipeAggregate,
    id?: RecipeId
  ) => Effect.Effect<RecipeAggregate, ParseResult.ParseError>

  readonly createBatch: (
    recipes: ReadonlyArray<CraftingRecipe>
  ) => Effect.Effect<ReadonlyArray<RecipeAggregate>, ParseResult.ParseError>
}

export const RecipeFactoryService = Context.GenericTag<RecipeFactoryService>(
  '@minecraft/domain/crafting/RecipeFactoryService'
)

const randomRecipeId = (): Effect.Effect<RecipeId, never> =>
  pipe(
    Random.nextIntBetween(1000, 9_999_999),
    Effect.map((value) => `recipe-${value}`),
    Effect.flatMap((id) => Schema.decodeEffect(RecipeIdSchema)(id))
  )

const defaultDifficulty = Schema.decodeEffect(CraftingDifficultySchema)(3)
const defaultTime = Schema.decodeEffect(CraftingTimeSchema)(1_000)
const defaultSuccess = Schema.decodeEffect(SuccessRateSchema)(0.85)

export const RecipeFactoryServiceLive = Layer.effect(
  RecipeFactoryService,
  Effect.gen(function* () {
    const create: RecipeFactoryService['create'] = (recipe, options = {}) =>
      Effect.gen(function* () {
        const id = options.id ?? (yield* randomRecipeId())
        const difficulty = options.difficulty ?? (yield* defaultDifficulty)
        const craftingTime = options.craftingTime ?? (yield* defaultTime)
        const successRate = options.successRate ?? (yield* defaultSuccess)

        return yield* createRecipeAggregate({
          id,
          recipe,
          difficulty,
          craftingTime,
          successRate,
        })
      })

    const cloneWithId: RecipeFactoryService['cloneWithId'] = (aggregate, id) =>
      Effect.gen(function* () {
        const nextId = id ?? (yield* randomRecipeId())
        return yield* cloneRecipeAggregate(aggregate, nextId)
      })

    const createBatch: RecipeFactoryService['createBatch'] = (recipes) =>
      Effect.all(recipes.map((recipe) => create(recipe)))

    return {
      create,
      cloneWithId,
      createBatch,
    }
  })
)
