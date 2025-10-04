import { Schema } from '@effect/schema'
import { describe, expect, it } from '@effect/vitest'
import { Effect, Option, pipe } from 'effect'
import {
  CraftingDifficultySchema,
  CraftingTimeSchema,
  SuccessRateSchema,
  createRecipeAggregate,
} from '../aggregate/recipe'
import {
  CraftingItemStackSchema,
  CraftingRecipeSchema,
  GridCoordinateSchema,
  GridHeightSchema,
  GridWidthSchema,
  buildEmptyGrid,
  replaceSlot,
} from '../types'
import { CraftingEngineService, CraftingEngineServiceLive } from './crafting_engine'

const decode = <A>(schema: Schema.Schema<A>) => Schema.decodeEffect(schema)

const stack = decode(CraftingItemStackSchema)({
  itemId: 'minecraft:oak_planks',
  quantity: 1,
  metadata: { tags: ['planks'] },
})

const shapelessRecipe = pipe(
  stack,
  Effect.flatMap((result) =>
    decode(CraftingRecipeSchema)({
      _tag: 'shapeless',
      id: 'minecraft:tag-consume',
      ingredients: [{ _tag: 'tag', tag: 'planks', quantity: 1 }],
      result,
    })
  )
)

const prepareGrid = Effect.gen(function* () {
  const width = yield* decode(GridWidthSchema)(1)
  const height = yield* decode(GridHeightSchema)(1)
  const coordinate = yield* decode(GridCoordinateSchema)({ x: 0, y: 0 })
  const base = yield* buildEmptyGrid(width, height)
  const value = yield* stack
  return replaceSlot(base, { _tag: 'OccupiedSlot', coordinate, stack: value })
})

describe('CraftingEngineService', () => {
  it.effect('returns no match when recipes do not fit the grid', () =>
    Effect.gen(function* () {
      const engine = yield* CraftingEngineService
      const width = yield* decode(GridWidthSchema)(1)
      const height = yield* decode(GridHeightSchema)(1)
      const emptyGrid = yield* buildEmptyGrid(width, height)
      const result = yield* engine.matchAggregate([], emptyGrid)
      expect(Option.isNone(result)).toBe(true)
    }).pipe(Effect.provide(CraftingEngineServiceLive))
  )

  it.effect('crafts successfully for matching aggregate', () =>
    Effect.gen(function* () {
      const engine = yield* CraftingEngineService
      const recipe = yield* shapelessRecipe
      const aggregate = yield* createRecipeAggregate({
        id: 'minecraft:tag-consume',
        recipe,
        difficulty: yield* decode(CraftingDifficultySchema)(2),
        craftingTime: yield* decode(CraftingTimeSchema)(400),
        successRate: yield* decode(SuccessRateSchema)(0.8),
      })
      const grid = yield* prepareGrid
      const result = yield* engine.craft(aggregate, grid)
      expect(result.success).toBe(true)
      expect(Option.isSome(result.produced)).toBe(true)
    }).pipe(Effect.provide(CraftingEngineServiceLive))
  )
})
