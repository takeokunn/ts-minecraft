import { Data, Effect, Match, pipe } from 'effect'
import {
  CropAggregate,
  CropProjection,
  advanceCropGrowth,
  describeAggregateSummary,
  enrichSoilForCrop,
  hydrateCrop,
  projectCropTrajectory,
} from './aggregates'
import { DomainError } from './types'
import { BreedingStats, HydrationState, SoilCondition } from './value_objects'

export type SimulationEvent = Data.TaggedEnum<{
  Hydrated: { readonly hydration: HydrationState }
  Fertilized: { readonly soilCondition: SoilCondition }
  Advanced: { readonly stage: CropAggregate['stage'] }
}>

export const SimulationEvent = Data.taggedEnum<SimulationEvent>()

export type CropSimulationResult = Readonly<{
  readonly aggregate: CropAggregate
  readonly timeline: ReadonlyArray<SimulationEvent>
  readonly projection: CropProjection
}>

export const simulateCropCycle = (params: {
  readonly aggregate: CropAggregate
  readonly hydrationDelta: number
  readonly soilDelta: number
  readonly growthSteps: number
}): Effect.Effect<CropSimulationResult, DomainError> =>
  Effect.gen(function* () {
    const timeline: SimulationEvent[] = []

    const hydrated = yield* hydrateCrop({ crop: params.aggregate, delta: params.hydrationDelta })
    const hydratedSummary = describeAggregateSummary(hydrated)
    timeline.push(SimulationEvent.Hydrated({ hydration: hydratedSummary.hydration }))

    const fertilized = yield* enrichSoilForCrop({ crop: hydrated, delta: params.soilDelta })
    const fertilizedSummary = describeAggregateSummary(fertilized)
    timeline.push(SimulationEvent.Fertilized({ soilCondition: fertilizedSummary.soilCondition }))

    const advanced = yield* advanceCropGrowth({ crop: fertilized, steps: params.growthSteps })
    timeline.push(SimulationEvent.Advanced({ stage: advanced.stage }))

    const projection = yield* projectCropTrajectory({ crop: advanced, steps: params.growthSteps })

    return {
      aggregate: advanced,
      timeline,
      projection,
    }
  })

export type OptimizationStrategy = Data.TaggedEnum<{
  HydrationFocus: { readonly hydrationDelta: number }
  SoilFocus: { readonly soilDelta: number }
  Balanced: { readonly hydrationDelta: number; readonly soilDelta: number }
}>

export const OptimizationStrategy = Data.taggedEnum<OptimizationStrategy>()

export const planOptimizationStrategy = (stats: BreedingStats): OptimizationStrategy =>
  pipe(
    Match.value(stats.fertility + stats.resilience + stats.harmony),
    Match.when(
      (score: number) => score >= 2.4,
      () => OptimizationStrategy.HydrationFocus({ hydrationDelta: 3 })
    ),
    Match.when(
      (score: number) => score <= 1.2,
      () => OptimizationStrategy.SoilFocus({ soilDelta: 5 })
    ),
    Match.orElse(() => OptimizationStrategy.Balanced({ hydrationDelta: 2, soilDelta: 3 }))
  )

export const batchSimulate = (params: {
  readonly aggregates: ReadonlyArray<CropAggregate>
  readonly hydrationDelta: number
  readonly soilDelta: number
  readonly growthSteps: number
}): Effect.Effect<ReadonlyArray<CropSimulationResult>, DomainError> =>
  Effect.forEach(params.aggregates, (aggregate) =>
    simulateCropCycle({
      aggregate,
      hydrationDelta: params.hydrationDelta,
      soilDelta: params.soilDelta,
      growthSteps: params.growthSteps,
    })
  )
