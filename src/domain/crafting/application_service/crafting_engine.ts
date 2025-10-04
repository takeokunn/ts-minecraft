import { Context, Effect, Layer, Option, Schema, Array, pipe } from 'effect'
import { CraftingGrid, CraftingItemStack, ItemTag } from '../types'
import {
  RecipeAggregate,
  SuccessRateSchema,
  addTag,
  canCraftWithGrid,
  updateDescription,
  updateSuccessRate,
} from '../aggregate/recipe'
import { PatternMismatchError } from '../types'

export interface CraftingResult {
  readonly success: boolean
  readonly consumed: ReadonlyArray<CraftingItemStack>
  readonly produced: Option.Option<CraftingItemStack>
  readonly recipe: RecipeAggregate
}

export interface CraftingEngineService {
  readonly matchAggregate: (
    aggregates: ReadonlyArray<RecipeAggregate>,
    grid: CraftingGrid
  ) => Effect.Effect<Option.Option<RecipeAggregate>, never>

  readonly craft: (
    aggregate: RecipeAggregate,
    grid: CraftingGrid
  ) => Effect.Effect<CraftingResult, PatternMismatchError>

  readonly annotate: (
    aggregate: RecipeAggregate,
    description: string,
    tag: ItemTag
  ) => Effect.Effect<RecipeAggregate, never>

  readonly adjustSuccessRate: (
    aggregate: RecipeAggregate,
    delta: number
  ) => Effect.Effect<RecipeAggregate, never>
}

export const CraftingEngineService = Context.GenericTag<CraftingEngineService>(
  '@minecraft/domain/crafting/CraftingEngineService'
)

const gatherConsumedStacks = (grid: CraftingGrid): ReadonlyArray<CraftingItemStack> =>
  pipe(
    grid.slots,
    Array.filterMap((slot) => (slot._tag === 'OccupiedSlot' ? Option.some(slot.stack) : Option.none<CraftingItemStack>()))
  )

export const CraftingEngineServiceLive = Layer.effect(
  CraftingEngineService,
  Effect.gen(function* () {
    const matchAggregate: CraftingEngineService['matchAggregate'] = (aggregates, grid) =>
      Effect.reduce(aggregates, Option.none<RecipeAggregate>(), (state, aggregate) =>
        Option.match(state, {
          onNone: () =>
            pipe(
              canCraftWithGrid(aggregate, grid),
              Effect.match({
                onFailure: () => Option.none<RecipeAggregate>(),
                onSuccess: () => Option.some(aggregate),
              })
            ),
          onSome: () => Effect.succeed(state),
        })
      )

    const craft: CraftingEngineService['craft'] = (aggregate, grid) =>
      pipe(
        canCraftWithGrid(aggregate, grid),
        Effect.map(() => ({
          success: true,
          consumed: gatherConsumedStacks(grid),
          produced: Option.some(aggregate.recipe.result),
          recipe: aggregate,
        }))
      )

    const annotate: CraftingEngineService['annotate'] = (aggregate, description, tag) =>
      pipe(
        updateDescription(aggregate, description),
        Effect.flatMap((updated) => addTag(updated, tag))
      )

    const adjustSuccessRate: CraftingEngineService['adjustSuccessRate'] = (aggregate, delta) =>
      pipe(
        Schema.decodeEffect(SuccessRateSchema)(aggregate.successRate + delta),
        Effect.flatMap((rate) => updateSuccessRate(aggregate, rate))
      )

    return {
      matchAggregate,
      craft,
      annotate,
      adjustSuccessRate,
    }
  })
)
