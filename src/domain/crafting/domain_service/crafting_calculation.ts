import { Context, Effect, Layer, Schema } from 'effect'
import {
  CraftingDifficulty,
  CraftingDifficultySchema,
  CraftingTime,
  CraftingTimeSchema,
  RecipeAggregate,
  SuccessRate,
  SuccessRateSchema,
} from '../aggregate/recipe'

export interface CraftingCalculationService {
  readonly computeCraftingTime: (aggregate: RecipeAggregate, multiplier: number) => Effect.Effect<CraftingTime, never>

  readonly computeSuccessRate: (aggregate: RecipeAggregate, adjustment: number) => Effect.Effect<SuccessRate, never>

  readonly adjustDifficulty: (difficulty: CraftingDifficulty, delta: number) => Effect.Effect<CraftingDifficulty, never>
}

export const CraftingCalculationService = Context.GenericTag<CraftingCalculationService>(
  '@minecraft/domain/crafting/CraftingCalculationService'
)

export const CraftingCalculationServiceLive = Layer.effect(
  CraftingCalculationService,
  Effect.succeed({
    computeCraftingTime: (aggregate, multiplier) =>
      Schema.decodeEffect(CraftingTimeSchema)(Math.round(Number(aggregate.craftingTime) * multiplier)),

    computeSuccessRate: (aggregate, adjustment) =>
      Schema.decodeEffect(SuccessRateSchema)(aggregate.successRate + adjustment),

    adjustDifficulty: (difficulty, delta) => Schema.decodeEffect(CraftingDifficultySchema)(difficulty + delta),
  })
)
