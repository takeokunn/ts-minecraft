import { describe, it, expect } from '@effect/vitest'
import { Effect, TestClock } from 'effect'
import { makeCropAggregate } from './aggregates'
import { makeBreedingStats } from './value-objects'
import { batchSimulate, planOptimizationStrategy, simulateCropCycle } from './services'
import { DomainConstants } from './types'
import { provideLayers } from '../../testing/effect'

const cropInput = {
  id: 'service-crop',
  stage: DomainConstants.growthStage.min,
  moisture: DomainConstants.moistureLevel.min,
  soil: DomainConstants.soilQuality.min,
  stats: { fertility: 0.5, resilience: 0.5, harmony: 0.5 }
}

const withTestClock = <A, E>(effect: Effect.Effect<A, E>) => provideLayers(effect, TestClock.defaultTestClock)

describe('services', () => {
  it.effect('simulateCropCycle produces timeline and projection', () =>
    withTestClock(
      Effect.gen(function* () {
        yield* TestClock.setTime(0)
        const aggregate = yield* makeCropAggregate(cropInput)
        const result = yield* simulateCropCycle({
          aggregate,
          hydrationDelta: 3,
          soilDelta: 5,
          growthSteps: 2,
        })

        expect(result.timeline.map((event) => event._tag)).toEqual(['Hydrated', 'Fertilized', 'Advanced'])
        expect(Number(result.aggregate.stage)).toBeGreaterThan(Number(aggregate.stage))
        expect(result.projection._tag).toBe('Improving')
      })
    )
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

  it.effect('batchSimulate runs simulations for each aggregate', () =>
    withTestClock(
      Effect.gen(function* () {
        yield* TestClock.setTime(0)
        const first = yield* makeCropAggregate(cropInput)
        yield* TestClock.adjust('1 second')
        const second = yield* makeCropAggregate({ ...cropInput, id: 'service-crop-2' })

        const results = yield* batchSimulate({
          aggregates: [first, second],
          hydrationDelta: 1,
          soilDelta: 2,
          growthSteps: 1,
        })

        expect(results).toHaveLength(2)
        results.forEach((result) => expect(result.timeline.length).toBe(3))
        expect(String(results[0].aggregate.id)).toBe(String(first.id))
        expect(String(results[1].aggregate.id)).toBe(String(second.id))
      })
    )
  )
})
