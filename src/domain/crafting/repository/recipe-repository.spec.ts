import { describe, expect, it } from '@effect/vitest'
import { Schema } from '@effect/schema'
import { Effect, Option, pipe } from 'effect'
import { RecipeRepository, RecipeRepositoryLive } from './recipe-repository'
import {
  CraftingDifficultySchema,
  CraftingTimeSchema,
  SuccessRateSchema,
  createRecipeAggregate,
} from '../aggregate/recipe'
import { CraftingItemStackSchema, CraftingRecipeSchema, RecipeIdSchema } from '../types'

const decode = <A>(schema: Schema.Schema<A>) => Schema.decodeEffect(schema)

const stack = decode(CraftingItemStackSchema)({
  itemId: 'minecraft:brick',
  quantity: 1,
})

const recipe = pipe(
  stack,
  Effect.flatMap((result) =>
    decode(CraftingRecipeSchema)({
      _tag: 'shapeless',
      id: 'minecraft:brick',
      ingredients: [{ _tag: 'exact', item: result, quantity: 1 }],
      result,
    })
  )
)

describe('RecipeRepository', () => {
  it.effect('saves and retrieves aggregates', () =>
    Effect.gen(function* () {
      const repository = yield* RecipeRepository
      const aggregate = yield* createRecipeAggregate({
        id: yield* decode(RecipeIdSchema)('minecraft:brick'),
        recipe: yield* recipe,
        difficulty: yield* decode(CraftingDifficultySchema)(2),
        craftingTime: yield* decode(CraftingTimeSchema)(600),
        successRate: yield* decode(SuccessRateSchema)(0.7),
      })

      yield* repository.save(aggregate)
      const result = yield* repository.findById(aggregate.id)
      expect(Option.isSome(result)).toBe(true)

      yield* repository.delete(aggregate.id)
      const missing = yield* repository.findById(aggregate.id)
      expect(Option.isNone(missing)).toBe(true)
    }).pipe(Effect.provide(RecipeRepositoryLive))
  )
})
