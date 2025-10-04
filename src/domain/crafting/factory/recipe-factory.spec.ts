import { describe, expect, it } from '@effect/vitest'
import { Schema } from '@effect/schema'
import { Effect } from 'effect'
import { RecipeFactoryService, RecipeFactoryServiceLive } from './recipe-factory'
import { CraftingItemStackSchema, CraftingRecipeSchema } from '../types'

const decode = <A>(schema: Schema.Schema<A>) => Schema.decodeEffect(schema)

const stack = decode(CraftingItemStackSchema)({
  itemId: 'minecraft:glass',
  quantity: 1,
})

const recipeEffect = Effect.flatMap(stack, (result) =>
  decode(CraftingRecipeSchema)({
    _tag: 'shapeless',
    id: 'minecraft:glass',
    ingredients: [{ _tag: 'exact', item: result, quantity: 1 }],
    result,
  })
)

describe('RecipeFactoryService', () => {
  it.effect('creates aggregates with generated identifier', () =>
    Effect.gen(function* () {
      const factory = yield* RecipeFactoryService
      const recipe = yield* recipeEffect
      const aggregate = yield* factory.create(recipe)
      expect(String(aggregate.id).length).toBeGreaterThan(0)
    }).pipe(Effect.provide(RecipeFactoryServiceLive))
  )
})
