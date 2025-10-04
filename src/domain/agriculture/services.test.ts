import { describe, it, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect } from 'effect'
import { makeCropAggregate } from './aggregates'
import { makeBreedingStats } from './value_objects'
import { batchSimulate, planOptimizationStrategy, simulateCropCycle } from './services'
import { DomainConstants } from './types'

const cropInput = {
  id: 'service-crop',
  stage: DomainConstants.growthStage.min,
  moisture: DomainConstants.moistureLevel.min,
  soil: DomainConstants.soilQuality.min,
  stats: { fertility: 0.5, resilience: 0.5, harmony: 0.5 }
}

describe('services', () => {
  it.effect('simulateCropCycle produces timeline and projection', () =>
    Effect.gen(function* () {
      const aggregate = yield* makeCropAggregate(cropInput)
      const result = yield* simulateCropCycle({
        aggregate,
        hydrationDelta: 2,
        soilDelta: 3,
        growthSteps: 2
      })

      expect(result.timeline.length).toBe(3)
      expect(result.projection._tag).toBeDefined()
    })
  )

  it('planOptimizationStrategy selects strategy from stats', () => {
    const hydrationStrategy = planOptimizationStrategy(
      Effect.runSync(makeBreedingStats({ fertility: 1, resilience: 1, harmony: 1 }))
    )
    const soilStrategy = planOptimizationStrategy(
      Effect.runSync(makeBreedingStats({ fertility: 0, resilience: 0, harmony: 0 }))
    )
    const balancedStrategy = planOptimizationStrategy(
      Effect.runSync(makeBreedingStats({ fertility: 0.4, resilience: 0.4, harmony: 0.4 }))
    )

    expect(hydrationStrategy._tag).toBe('HydrationFocus')
    expect(soilStrategy._tag).toBe('SoilFocus')
    expect(balancedStrategy._tag).toBe('Balanced')
  })

  it.effect.prop('batchSimulate runs simulations for each aggregate', [fc.integer({ min: 1, max: 3 })], ([count]) =>
    Effect.gen(function* () {
      const aggregates = yield* Effect.forEach(Array.from({ length: count }, (_, index) => ({
        id: `crop-${index}`,
        stage: DomainConstants.growthStage.min,
        moisture: DomainConstants.moistureLevel.min,
        soil: DomainConstants.soilQuality.min,
        stats: { fertility: 0.5, resilience: 0.5, harmony: 0.5 }
      })), makeCropAggregate)

      const results = yield* batchSimulate({
        aggregates,
        hydrationDelta: 1,
        soilDelta: 2,
        growthSteps: 1
      })

      expect(results.length).toBe(count)
    })
  )
})
