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
} from './value_objects'
import { DomainConstants } from './types'

const growthStageArbitrary = fc.integer({ min: DomainConstants.growthStage.min, max: DomainConstants.growthStage.max })
const moistureArbitrary = fc.integer({ min: DomainConstants.moistureLevel.min, max: DomainConstants.moistureLevel.max })
const soilArbitrary = fc.integer({ min: DomainConstants.soilQuality.min, max: DomainConstants.soilQuality.max })
const breedingFactorArbitrary = fc.float({ min: DomainConstants.breedingFactor.min, max: DomainConstants.breedingFactor.max })

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

  it.effect.prop('GrowthStage advancement never exceeds max', [growthStageArbitrary, fc.integer({ min: 0, max: 20 })], ([value, steps]) =>
    Effect.gen(function* () {
      const stage = yield* makeGrowthStage(value)
      const advanced = yield* advanceGrowthStage({ stage, steps })
      expect(Number(advanced)).toBeLessThanOrEqual(DomainConstants.growthStage.max)
    })
  )

  it.effect.prop('Moisture adjustment stays within bounds', [moistureArbitrary, fc.integer({ min: -10, max: 10 })], ([value, delta]) =>
    Effect.gen(function* () {
      const level = yield* makeMoistureLevel(value)
      const adjusted = yield* adjustMoistureLevel({ level, delta })
      const numeric = Number(adjusted)
      expect(numeric).toBeGreaterThanOrEqual(DomainConstants.moistureLevel.min)
      expect(numeric).toBeLessThanOrEqual(DomainConstants.moistureLevel.max)
    })
  )

  it.effect.prop('Soil quality adjustments clamp results', [soilArbitrary, fc.integer({ min: -50, max: 50 })], ([value, delta]) =>
    Effect.gen(function* () {
      const quality = yield* makeSoilQuality(value)
      const adjusted = yield* adjustSoilQuality({ quality, delta })
      const numeric = Number(adjusted)
      expect(numeric).toBeGreaterThanOrEqual(DomainConstants.soilQuality.min)
      expect(numeric).toBeLessThanOrEqual(DomainConstants.soilQuality.max)
    })
  )

  it.effect.prop('Breeding stats merging averages inputs', [breedingStatsArbitrary, breedingStatsArbitrary], ([current, partner]) =>
    Effect.gen(function* () {
      const currentStats = yield* makeBreedingStats(current)
      const partnerStats = yield* makeBreedingStats(partner)
      const merged = yield* mergeBreedingStats(currentStats, partnerStats)
      expect(merged.fertility).toBeCloseTo((current.fertility + partner.fertility) / 2)
    })
  )

  it.effect('Descriptions yield consistent ADTs', () =>
    Effect.gen(function* () {
      const stage = yield* makeGrowthStage(DomainConstants.growthStage.max)
      const moisture = yield* makeMoistureLevel(DomainConstants.moistureLevel.max)
      const soil = yield* makeSoilQuality(DomainConstants.soilQuality.max)
      const stats = yield* makeBreedingStats({ fertility: 1, resilience: 1, harmony: 1 })

      const growth = describeGrowthStage(stage)
      const hydration = describeMoisture(moisture)
      const soilCondition = describeSoil(soil)
      const outcome = evaluateBreedingOutcome(stats)

      expect(growth.state._tag).toBe('Harvestable')
      expect(hydration._tag).toBe('Saturated')
      expect(soilCondition._tag).toBe('Exceptional')
      expect(outcome._tag).toBe('Elite')
    })
  )
})
