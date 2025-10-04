import { describe, it, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect, pipe } from 'effect'
import {
  BreedingOutcome,
  HydrationState,
  SoilCondition,
  advanceGrowthStage,
  adjustMoistureLevel,
  adjustSoilQuality,
  describeGrowthStage,
  describeMoisture,
  describeSoil,
  evaluateBreedingOutcome,
  makeBreedingStats,
  makeGrowthStage,
  makeMoistureLevel,
  makeSoilQuality,
  mergeBreedingStats
} from './value-objects'
import { DomainConstants } from './types'

const growthStageArbitrary = fc.integer({ min: DomainConstants.growthStage.min, max: DomainConstants.growthStage.max })
const moistureArbitrary = fc.integer({ min: DomainConstants.moistureLevel.min, max: DomainConstants.moistureLevel.max })
const soilArbitrary = fc.integer({ min: DomainConstants.soilQuality.min, max: DomainConstants.soilQuality.max })
const breedingFactorArbitrary = fc.float({
  min: DomainConstants.breedingFactor.min,
  max: DomainConstants.breedingFactor.max,
  noNaN: true,
  noDefaultInfinity: true,
})

const breedingStatsArbitrary = fc.record({
  fertility: breedingFactorArbitrary,
  resilience: breedingFactorArbitrary,
  harmony: breedingFactorArbitrary
})

describe('value objects', () => {
  it.effect.prop('GrowthStage creation accepts valid range', [growthStageArbitrary], ([value]) =>
    Effect.gen(function* () {
      const stage = yield* makeGrowthStage(value)
      expect(Number(stage)).toBe(value)
    })
  )

  it.effect.prop('GrowthStage advancement never exceeds max', [growthStageArbitrary, fc.integer({ min: 0, max: 64 })], ([value, steps]) =>
    Effect.gen(function* () {
      const stage = yield* makeGrowthStage(value)
      const advanced = yield* advanceGrowthStage({ stage, steps })
      expect(Number(advanced)).toBeGreaterThanOrEqual(Number(stage))
      expect(Number(advanced)).toBeLessThanOrEqual(DomainConstants.growthStage.max)
    })
  )

  it.effect.prop('Moisture adjustment stays within bounds', [moistureArbitrary, fc.integer({ min: -10, max: 10 })], ([value, delta]) =>
    Effect.gen(function* () {
      const level = yield* makeMoistureLevel(value)
      const adjusted = yield* adjustMoistureLevel({ level, delta })
      expect(Number(adjusted)).toBeGreaterThanOrEqual(DomainConstants.moistureLevel.min)
      expect(Number(adjusted)).toBeLessThanOrEqual(DomainConstants.moistureLevel.max)
    })
  )

  it.effect.prop('Soil quality adjustments clamp results', [soilArbitrary, fc.integer({ min: -200, max: 200 })], ([value, delta]) =>
    Effect.gen(function* () {
      const quality = yield* makeSoilQuality(value)
      const adjusted = yield* adjustSoilQuality({ quality, delta })
      expect(Number(adjusted)).toBeGreaterThanOrEqual(DomainConstants.soilQuality.min)
      expect(Number(adjusted)).toBeLessThanOrEqual(DomainConstants.soilQuality.max)
    })
  )

  it.effect.prop('Breeding stats merging averages inputs', [breedingStatsArbitrary, breedingStatsArbitrary], ([currentRaw, partnerRaw]) =>
    Effect.gen(function* () {
      const current = yield* makeBreedingStats(currentRaw)
      const partner = yield* makeBreedingStats(partnerRaw)
      const merged = yield* mergeBreedingStats(current, partner)
      expect(merged.fertility).toBeCloseTo((current.fertility + partner.fertility) / 2, 5)
      expect(merged.resilience).toBeCloseTo((current.resilience + partner.resilience) / 2, 5)
      expect(merged.harmony).toBeCloseTo((current.harmony + partner.harmony) / 2, 5)
    })
  )

  it('Descriptions yield consistent ADTs', () => {
    const stageCases: ReadonlyArray<{ readonly input: number; readonly type: ReturnType<typeof describeGrowthStage>['type']; readonly stateTag: ReturnType<typeof describeGrowthStage>['state']['_tag'] }>
      = [
        { input: 0, type: 'seed', stateTag: 'Seed' },
        { input: 2, type: 'germination', stateTag: 'Germinating' },
        { input: 4, type: 'seedling', stateTag: 'Seedling' },
        { input: 9, type: 'growing', stateTag: 'Growing' },
        { input: 12, type: 'mature', stateTag: 'Mature' },
        { input: 15, type: 'harvestable', stateTag: 'Harvestable' }
      ]

    stageCases.forEach(({ input, type, stateTag }) => {
      const stage = Effect.runSync(makeGrowthStage(input))
      const description = describeGrowthStage(stage)
      expect(description.type).toBe(type)
      expect(description.state._tag).toBe(stateTag)
    })

    const moistureCases: ReadonlyArray<{ readonly input: number; readonly tag: HydrationState['_tag'] }> = [
      { input: 0, tag: 'Parched' },
      { input: 2, tag: 'Dry' },
      { input: 4, tag: 'Balanced' },
      { input: 6, tag: 'Moist' },
      { input: 7, tag: 'Saturated' }
    ]

    moistureCases.forEach(({ input, tag }) => {
      const level = Effect.runSync(makeMoistureLevel(input))
      const hydration = describeMoisture(level)
      expect(hydration._tag).toBe(tag)
    })

    const soilCases: ReadonlyArray<{ readonly input: number; readonly tag: SoilCondition['_tag'] }> = [
      { input: 10, tag: 'Depleted' },
      { input: 30, tag: 'Suboptimal' },
      { input: 70, tag: 'Healthy' },
      { input: 90, tag: 'Fertile' },
      { input: 100, tag: 'Exceptional' }
    ]

    soilCases.forEach(({ input, tag }) => {
      const quality = Effect.runSync(makeSoilQuality(input))
      const condition = describeSoil(quality)
      expect(condition._tag).toBe(tag)
    })

    const eliteStats = Effect.runSync(makeBreedingStats({ fertility: 0.95, resilience: 0.92, harmony: 0.94 }))
    expect(evaluateBreedingOutcome(eliteStats)._tag).toBe('Elite')

    const stableStats = Effect.runSync(makeBreedingStats({ fertility: 0.6, resilience: 0.55, harmony: 0.65 }))
    expect(evaluateBreedingOutcome(stableStats)._tag).toBe('Stable')

    const fragileStats = Effect.runSync(makeBreedingStats({ fertility: 0.2, resilience: 0.25, harmony: 0.3 }))
    expect(evaluateBreedingOutcome(fragileStats)._tag).toBe('Fragile')
  })
})
