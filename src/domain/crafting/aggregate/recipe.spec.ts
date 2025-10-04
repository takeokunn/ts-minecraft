import { describe, expect, it } from '@effect/vitest'
import { Schema } from '@effect/schema'
import * as FastCheck from 'effect/FastCheck'
import { ParseResult } from '@effect/schema/ParseResult'
import { Effect, Option, pipe } from 'effect'
import {
  CraftingDifficultySchema,
  CraftingTimeSchema,
  RecipeAggregate,
  SuccessRateSchema,
  addTag,
  canCraftWithGrid,
  createRecipeAggregate,
  removeTag,
  updateSuccessRate,
} from './recipe'
import {
  CraftingGrid,
  CraftingItemStack,
  CraftingItemStackSchema,
  CraftingRecipe,
  CraftingRecipeSchema,
  GridCoordinateSchema,
  GridHeightSchema,
  GridWidthSchema,
  RecipeIdSchema,
  buildEmptyGrid,
  replaceSlot,
} from '../types'

const decode = <A>(schema: Schema.Schema<A>) => Schema.decodeEffect(schema)

const sampleStack: Effect.Effect<CraftingItemStack, ParseResult.ParseError> = decode(CraftingItemStackSchema)({
  itemId: 'minecraft:oak_planks',
  quantity: 1,
  metadata: { tags: ['planks'] },
})

const shapedRecipe: Effect.Effect<CraftingRecipe, ParseResult.ParseError> = pipe(
  sampleStack,
  Effect.flatMap((stack) =>
    decode(CraftingRecipeSchema)({
      _tag: 'shaped',
      id: 'minecraft:planks_to_slab',
      pattern: [
        ['A', 'A', 'A'],
      ],
      ingredients: [
        {
          key: 'A',
          matcher: { _tag: 'exact', item: stack },
          quantity: 1,
        },
      ],
      result: stack,
    })
  )
)

const gridWithPlanks: Effect.Effect<CraftingGrid, ParseResult.ParseError> = pipe(
  Effect.all([
    decode(GridWidthSchema)(1),
    decode(GridHeightSchema)(1),
    decode(GridCoordinateSchema)({ x: 0, y: 0 }),
    sampleStack,
  ]),
  Effect.flatMap(([width, height, coordinate, stack]) =>
    pipe(
      buildEmptyGrid(width, height),
      Effect.map((grid) =>
        replaceSlot(grid, {
          _tag: 'OccupiedSlot',
          coordinate,
          stack,
        })
      )
    )
  )
)

describe('RecipeAggregate', () => {
  it.effect('creates aggregate from shapeless recipe', () =>
    Effect.gen(function* () {
      const recipe = yield* decode(CraftingRecipeSchema)({
        _tag: 'shapeless',
        id: 'minecraft:planks_mix',
        ingredients: [{ _tag: 'tag', tag: 'planks', quantity: 1 }],
        result: yield* sampleStack,
      })

      const aggregate = yield* createRecipeAggregate({
        id: yield* decode(RecipeIdSchema)('minecraft:planks_mix'),
        recipe,
        difficulty: yield* decode(CraftingDifficultySchema)(2),
        craftingTime: yield* decode(CraftingTimeSchema)(500),
        successRate: yield* decode(SuccessRateSchema)(0.9),
      })

      expect(aggregate.metadata.version).toBe(1)
      expect(aggregate.recipe._tag).toBe('shapeless')
    })
  )

  it.effect('matches shaped recipe with grid and fails on mismatch', () =>
    Effect.gen(function* () {
      const recipe = yield* shapedRecipe
      const aggregate = yield* createRecipeAggregate({
        id: yield* decode(RecipeIdSchema)('minecraft:slab'),
        recipe,
        difficulty: yield* decode(CraftingDifficultySchema)(3),
        craftingTime: yield* decode(CraftingTimeSchema)(1_000),
        successRate: yield* decode(SuccessRateSchema)(0.8),
      })

      const grid = yield* gridWithPlanks
      const success = yield* canCraftWithGrid(aggregate, grid)
      expect(success).toBe(true)

      const emptyGrid = yield* buildEmptyGrid(yield* decode(GridWidthSchema)(1), yield* decode(GridHeightSchema)(1))
      const failure = yield* Effect.either(canCraftWithGrid(aggregate, emptyGrid))
      expect(failure._tag).toBe('Left')
    })
  )

  it.effect('updates success rate safely', () =>
    Effect.gen(function* () {
      const recipe = yield* shapedRecipe
      const aggregate = yield* createRecipeAggregate({
        id: yield* decode(RecipeIdSchema)('minecraft:update'),
        recipe,
        difficulty: yield* decode(CraftingDifficultySchema)(4),
        craftingTime: yield* decode(CraftingTimeSchema)(1_500),
        successRate: yield* decode(SuccessRateSchema)(0.5),
      })

      const updated = yield* updateSuccessRate(aggregate, yield* decode(SuccessRateSchema)(0.55))
      expect(updated.metadata.version).toBe(2)
      expect(updated.successRate).toBe(0.55)
    })
  )

  it.effect('adds and removes tags immutably', () =>
    Effect.gen(function* () {
      const recipe = yield* shapedRecipe
      const aggregate = yield* createRecipeAggregate({
        id: yield* decode(RecipeIdSchema)('minecraft:tag'),
        recipe,
        difficulty: yield* decode(CraftingDifficultySchema)(1),
        craftingTime: yield* decode(CraftingTimeSchema)(400),
        successRate: yield* decode(SuccessRateSchema)(0.95),
      })

      const tagged = yield* addTag(aggregate, 'featured')
      expect(tagged.metadata.tags).toContain('featured')

      const unchanged = yield* addTag(tagged, 'featured')
      expect(unchanged.metadata.tags).toHaveLength(1)

      const cleared = yield* removeTag(tagged, 'featured')
      expect(cleared.metadata.tags).not.toContain('featured')
    })
  )

  it('fast-check validates success rate bounds', () =>
    Effect.sync(() =>
      FastCheck.assert(
        FastCheck.property(FastCheck.float({ min: 1.01, max: 5, noNaN: true }), (value) => {
          const program = Schema.decodeEffect(SuccessRateSchema)(value)
          const exit = Effect.runSyncExit(program)
          expect(exit._tag).toBe('Failure')
        })
      )
    )
  )
})
