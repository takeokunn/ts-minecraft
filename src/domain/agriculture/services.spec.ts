import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { makeCropAggregate } from './aggregates'
import { batchSimulate, planOptimizationStrategy, simulateCropCycle } from './services'
import { DomainConstants } from './types'
import { HydrationState, SoilCondition, makeBreedingStats } from './value_objects'

const makeAggregate = () =>
  Effect.runSync(
    makeCropAggregate({
      id: 'service-crop',
      stage: 4,
      moisture: 2,
      soil: 40,
      stats: { fertility: 0.4, resilience: 0.4, harmony: 0.4 },
    })
  )

const propertyConfig: fc.Parameters = { numRuns: 32 }

describe('domain/agriculture/services', () => {
  it.effect('simulateCropCycleはイベントタイムラインと予測を生成する', () =>
    Effect.gen(function* () {
      const aggregate = makeAggregate()

      const result = yield* simulateCropCycle({
        aggregate,
        hydrationDelta: 3,
        soilDelta: 10,
        growthSteps: 2,
      })

      expect(result.timeline).toHaveLength(3)
      expect(result.timeline[0]._tag).toBe('Hydrated')
      expect(result.timeline[1]._tag).toBe('Fertilized')
      expect(result.timeline[2]._tag).toBe('Advanced')
      expect(result.timeline[0].hydration._tag).toBe(HydrationState.Moist({})._tag)
      expect(result.timeline[1].soilCondition._tag).toBe(SoilCondition.Healthy({})._tag)
      expect(result.timeline[2].stage).toBe(result.aggregate.stage)

      expect(result.projection._tag).toBe('Improving')
      expect(Number(result.aggregate.stage)).toBe(6)
    })
  )

  it.effect('batchSimulateは一覧に対して個別にシミュレーションを実行する', () =>
    Effect.gen(function* () {
      const aggregates = [makeAggregate(), makeAggregate()]
      const results = yield* batchSimulate({
        aggregates,
        hydrationDelta: 1,
        soilDelta: 5,
        growthSteps: 1,
      })

      expect(results).toHaveLength(aggregates.length)
      results.forEach((item) => {
        expect(item.timeline).toHaveLength(3)
        expect(item.projection._tag).toBe('Improving')
      })
    })
  )

  it('planOptimizationStrategyは統計値に基づいて戦略を選択する (PBT)', () => {
    const statsArbitrary = fc.record({
      fertility: fc.float({ min: DomainConstants.breedingFactor.min, max: DomainConstants.breedingFactor.max }),
      resilience: fc.float({ min: DomainConstants.breedingFactor.min, max: DomainConstants.breedingFactor.max }),
      harmony: fc.float({ min: DomainConstants.breedingFactor.min, max: DomainConstants.breedingFactor.max }),
    })

    fc.assert(
      fc.property(statsArbitrary, (input) => {
        const stats = Effect.runSync(makeBreedingStats(input))
        const strategy = planOptimizationStrategy(stats)
        const total = stats.fertility + stats.resilience + stats.harmony

        if (total >= 2.4) {
          expect(strategy._tag).toBe('HydrationFocus')
        } else if (total <= 1.2) {
          expect(strategy._tag).toBe('SoilFocus')
        } else {
          expect(strategy._tag).toBe('Balanced')
        }
      }),
      propertyConfig
    )
  })
})
