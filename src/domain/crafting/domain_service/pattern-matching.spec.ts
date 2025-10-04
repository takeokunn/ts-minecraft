import { describe, expect, it } from '@effect/vitest'
import { Schema } from '@effect/schema'
import { Effect, Option, pipe } from 'effect'
import { PatternMatchingService, PatternMatchingServiceLive } from './pattern-matching'
import {
  CraftingItemStackSchema,
  CraftingRecipeSchema,
  GridCoordinateSchema,
  GridHeightSchema,
  GridWidthSchema,
  buildEmptyGrid,
  replaceSlot,
} from '../types'
import {
  CraftingDifficultySchema,
  CraftingTimeSchema,
  SuccessRateSchema,
  createRecipeAggregate,
} from '../aggregate/recipe'

const decode = <A>(schema: Schema.Schema<A>) => Schema.decodeEffect(schema)

const stack = decode(CraftingItemStackSchema)({
  itemId: 'minecraft:stone',
  quantity: 1,
  metadata: { tags: ['stone'] },
})

const recipeEffect = pipe(
  stack,
  Effect.flatMap((item) =>
    decode(CraftingRecipeSchema)({
      _tag: 'shapeless',
      id: 'minecraft:stone-polish',
      ingredients: [{ _tag: 'tag', tag: 'stone', quantity: 1 }],
      result: item,
    })
  )
)

const gridEffect = Effect.gen(function* () {
  const width = yield* decode(GridWidthSchema)(1)
  const height = yield* decode(GridHeightSchema)(1)
  const coordinate = yield* decode(GridCoordinateSchema)({ x: 0, y: 0 })
  const base = yield* buildEmptyGrid(width, height)
  const value = yield* stack
  return replaceSlot(base, { _tag: 'OccupiedSlot', coordinate, stack: value })
})

describe('PatternMatchingService', () => {
  it.effect('locates first matching aggregate', () =>
    Effect.gen(function* () {
      const service = yield* PatternMatchingService
      const recipe = yield* recipeEffect
      const aggregate = yield* createRecipeAggregate({
        id: 'minecraft:stone-polish',
        recipe,
        difficulty: yield* decode(CraftingDifficultySchema)(1),
        craftingTime: yield* decode(CraftingTimeSchema)(200),
        successRate: yield* decode(SuccessRateSchema)(0.9),
      })
      const grid = yield* gridEffect
      const outcome = yield* service.locateFirstMatch([aggregate], grid)
      expect(outcome.matched).toBe(true)
      expect(Option.isSome(outcome.aggregate)).toBe(true)
    }).pipe(Effect.provide(PatternMatchingServiceLive))
  )
})
