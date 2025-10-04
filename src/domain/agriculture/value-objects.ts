import { Brand, Data, Effect, Match, pipe } from 'effect'
import { DomainConstants, DomainError, makeBoundedNumber } from './types'

export type GrowthStage = number & Brand.Brand<'GrowthStage'>
export type MoistureLevel = number & Brand.Brand<'MoistureLevel'>
export type SoilQuality = number & Brand.Brand<'SoilQuality'>

const GrowthStageBrand = Brand.nominal<GrowthStage>()
const MoistureLevelBrand = Brand.nominal<MoistureLevel>()
const SoilQualityBrand = Brand.nominal<SoilQuality>()

export const makeGrowthStage = (value: number): Effect.Effect<GrowthStage, DomainError> =>
  pipe(
    makeBoundedNumber({ field: 'growthStage', range: DomainConstants.growthStage, value }),
    Effect.map((number) => GrowthStageBrand(number))
  )

export const makeMoistureLevel = (value: number): Effect.Effect<MoistureLevel, DomainError> =>
  pipe(
    makeBoundedNumber({ field: 'moistureLevel', range: DomainConstants.moistureLevel, value }),
    Effect.map((number) => MoistureLevelBrand(number))
  )

export const makeSoilQuality = (value: number): Effect.Effect<SoilQuality, DomainError> =>
  pipe(
    makeBoundedNumber({ field: 'soilQuality', range: DomainConstants.soilQuality, value }),
    Effect.map((number) => SoilQualityBrand(number))
  )

export type GrowthStageType = 'seed' | 'germination' | 'seedling' | 'growing' | 'mature' | 'harvestable'

export type GrowthStageState =
  | { readonly _tag: 'Seed' }
  | { readonly _tag: 'Germinating'; readonly progress: number }
  | { readonly _tag: 'Seedling'; readonly leafPairs: number }
  | { readonly _tag: 'Growing'; readonly vigor: number }
  | { readonly _tag: 'Mature'; readonly readiness: number }
  | { readonly _tag: 'Harvestable'; readonly quality: number }

const describeStageType = (stage: number): GrowthStageType =>
  pipe(
    Match.value(stage),
    Match.when((value) => value === DomainConstants.growthStage.min, () => 'seed' as const),
    Match.when((value) => value <= 2, () => 'germination' as const),
    Match.when((value) => value <= 6, () => 'seedling' as const),
    Match.when((value) => value <= 10, () => 'growing' as const),
    Match.when((value) => value <= 14, () => 'mature' as const),
    Match.orElse(() => 'harvestable' as const)
  )

const describeStageState = (stage: number): GrowthStageState => {
  const type = describeStageType(stage)
  switch (type) {
    case 'seed':
      return { _tag: 'Seed' }
    case 'germination':
      return { _tag: 'Germinating', progress: stage / 2 }
    case 'seedling':
      return { _tag: 'Seedling', leafPairs: stage - 2 }
    case 'growing':
      return { _tag: 'Growing', vigor: stage / DomainConstants.growthStage.max }
    case 'mature':
      return { _tag: 'Mature', readiness: (stage - 10) / 4 }
    case 'harvestable':
      return { _tag: 'Harvestable', quality: 1 }
  }
}

export const describeGrowthStage = (stage: GrowthStage): { readonly type: GrowthStageType; readonly state: GrowthStageState } => ({
  type: describeStageType(stage),
  state: describeStageState(stage)
})

export const advanceGrowthStage = (params: { readonly stage: GrowthStage; readonly steps: number }): Effect.Effect<GrowthStage, DomainError> =>
  pipe(
    Number(params.stage) + Math.max(0, params.steps),
    (value) => Math.min(value, DomainConstants.growthStage.max),
    makeGrowthStage
  )

export const adjustMoistureLevel = (params: { readonly level: MoistureLevel; readonly delta: number }): Effect.Effect<MoistureLevel, DomainError> =>
  pipe(
    Number(params.level) + params.delta,
    (value) => Math.max(DomainConstants.moistureLevel.min, Math.min(DomainConstants.moistureLevel.max, value)),
    makeMoistureLevel
  )

export const adjustSoilQuality = (params: { readonly quality: SoilQuality; readonly delta: number }): Effect.Effect<SoilQuality, DomainError> =>
  pipe(
    Number(params.quality) + params.delta,
    (value) => Math.max(DomainConstants.soilQuality.min, Math.min(DomainConstants.soilQuality.max, value)),
    makeSoilQuality
  )

export type HydrationState = Data.TaggedEnum<{
  Parched: {}
  Dry: {}
  Balanced: {}
  Moist: {}
  Saturated: {}
}>

export const HydrationState = Data.taggedEnum<HydrationState>()

export const describeMoisture = (level: MoistureLevel): HydrationState =>
  pipe(
    Match.value(Number(level)),
    Match.when((value) => value === 0, () => HydrationState.Parched({})),
    Match.when((value) => value <= 2, () => HydrationState.Dry({})),
    Match.when((value) => value <= 4, () => HydrationState.Balanced({})),
    Match.when((value) => value <= 6, () => HydrationState.Moist({})),
    Match.orElse(() => HydrationState.Saturated({}))
  )

export type SoilCondition = Data.TaggedEnum<{
  Depleted: { readonly severity: number }
  Suboptimal: { readonly severity: number }
  Healthy: {}
  Fertile: { readonly bonus: number }
  Exceptional: { readonly bonus: number }
}>

export const SoilCondition = Data.taggedEnum<SoilCondition>()

export const describeSoil = (quality: SoilQuality): SoilCondition =>
  pipe(
    Match.value(Number(quality)),
    Match.when((value) => value < 20, (value) => SoilCondition.Depleted({ severity: value / DomainConstants.soilQuality.max })),
    Match.when((value) => value < 50, (value) => SoilCondition.Suboptimal({ severity: value / DomainConstants.soilQuality.max })),
    Match.when((value) => value < 80, () => SoilCondition.Healthy({})),
    Match.when((value) => value < 95, (value) => SoilCondition.Fertile({ bonus: value / DomainConstants.soilQuality.max })),
    Match.orElse(() => SoilCondition.Exceptional({ bonus: 1 }))
  )

export type BreedingStats = {
  readonly fertility: number
  readonly resilience: number
  readonly harmony: number
}

export const makeBreedingStats = (input: { readonly fertility: number; readonly resilience: number; readonly harmony: number }): Effect.Effect<BreedingStats, DomainError> =>
  Effect.gen(function* () {
    const fertility = yield* makeBoundedNumber({ field: 'fertility', range: DomainConstants.breedingFactor, value: input.fertility })
    const resilience = yield* makeBoundedNumber({ field: 'resilience', range: DomainConstants.breedingFactor, value: input.resilience })
    const harmony = yield* makeBoundedNumber({ field: 'harmony', range: DomainConstants.breedingFactor, value: input.harmony })
    return { fertility, resilience, harmony }
  })

export const makeBreedingStatsEither = (input: { readonly fertility: number; readonly resilience: number; readonly harmony: number }) =>
  Effect.runSync(Effect.either(makeBreedingStats(input)))

export const mergeBreedingStats = (current: BreedingStats, partner: BreedingStats): Effect.Effect<BreedingStats, DomainError> =>
  makeBreedingStats({
    fertility: (current.fertility + partner.fertility) / 2,
    resilience: (current.resilience + partner.resilience) / 2,
    harmony: (current.harmony + partner.harmony) / 2
  })

export type BreedingOutcome = Data.TaggedEnum<{
  Elite: { readonly score: number }
  Stable: { readonly score: number }
  Fragile: { readonly score: number }
}>

export const BreedingOutcome = Data.taggedEnum<BreedingOutcome>()

const breedingScore = (stats: BreedingStats): number =>
  (stats.fertility + stats.resilience + stats.harmony) / 3

export const evaluateBreedingOutcome = (stats: BreedingStats): BreedingOutcome =>
  pipe(
    breedingScore(stats),
    (score) => {
      if (score >= 0.8) {
        return BreedingOutcome.Elite({ score })
      }
      if (score >= 0.5) {
        return BreedingOutcome.Stable({ score })
      }
      return BreedingOutcome.Fragile({ score })
    }
  )

export const summarizeValueObjects = (
  stage: GrowthStage,
  moisture: MoistureLevel,
  soil: SoilQuality,
  stats: BreedingStats
): Readonly<{
  readonly stage: ReturnType<typeof describeGrowthStage>
  readonly hydration: HydrationState
  readonly soilCondition: SoilCondition
  readonly outcome: BreedingOutcome
}> => ({
  stage: describeGrowthStage(stage),
  hydration: describeMoisture(moisture),
  soilCondition: describeSoil(soil),
  outcome: evaluateBreedingOutcome(stats)
})
