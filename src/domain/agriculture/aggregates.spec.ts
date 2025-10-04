import { describe, it, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect, Either, TestClock, pipe } from 'effect'
import {
  CropAggregate,
  CropProjection,
  advanceCropGrowth,
  describeAggregateSummary,
  hydrateCrop,
  enrichSoilForCrop,
  makeCropAggregate,
  makeCropAggregateEither,
  projectCropTrajectory,
  validateCropAggregate,
  validateCropAggregateEither
} from './aggregates'
import { DomainConstants } from './types'
import { provideLayers } from '../../testing/effect'

const cropInputArbitrary = fc.record({
  id: fc.string({ minLength: 3, maxLength: 12 }).filter((value) => /^[A-Za-z0-9_-]+$/.test(value)),
  stage: fc.integer({ min: DomainConstants.growthStage.min, max: DomainConstants.growthStage.max }),
  moisture: fc.integer({ min: DomainConstants.moistureLevel.min, max: DomainConstants.moistureLevel.max }),
  soil: fc.float({
    min: DomainConstants.soilQuality.min,
    max: DomainConstants.soilQuality.max,
    noNaN: true,
    noDefaultInfinity: true,
  }),
  stats: fc.record({
    fertility: fc.float({
      min: DomainConstants.breedingFactor.min,
      max: DomainConstants.breedingFactor.max,
      noNaN: true,
      noDefaultInfinity: true,
    }),
    resilience: fc.float({
      min: DomainConstants.breedingFactor.min,
      max: DomainConstants.breedingFactor.max,
      noNaN: true,
      noDefaultInfinity: true,
    }),
    harmony: fc.float({
      min: DomainConstants.breedingFactor.min,
      max: DomainConstants.breedingFactor.max,
      noNaN: true,
      noDefaultInfinity: true,
    })
  })
})

const withTestClock = <A, E>(effect: Effect.Effect<A, E>) => provideLayers(effect, TestClock.defaultTestClock)

describe('aggregates', () => {
  it.effect.prop('Crop aggregate creation succeeds for valid inputs', [cropInputArbitrary], ([input]) =>
    withTestClock(
      Effect.gen(function* () {
        yield* TestClock.setTime(1_000)
        const aggregate = yield* makeCropAggregate(input)
        expect(String(aggregate.id)).toBe(input.id.trim())
        expect(Number(aggregate.stage)).toBe(input.stage)
        expect(Number(aggregate.moisture)).toBe(input.moisture)
        expect(Number(aggregate.soil)).toBeCloseTo(input.soil, 5)
        expect(aggregate.stats.fertility).toBeCloseTo(input.stats.fertility, 5)
        expect(aggregate.stats.resilience).toBeCloseTo(input.stats.resilience, 5)
        expect(aggregate.stats.harmony).toBeCloseTo(input.stats.harmony, 5)
        expect(aggregate.plantedAt.epochMillis).toBe(aggregate.updatedAt.epochMillis)
      })
    )
  )

  it.effect('Hydration and soil enrichment update aggregates safely', () =>
    withTestClock(
      Effect.gen(function* () {
        yield* TestClock.setTime(10_000)
        const base = yield* makeCropAggregate({
          id: 'crop-hydrate',
          stage: 5,
          moisture: DomainConstants.moistureLevel.max - 1,
          soil: DomainConstants.soilQuality.min + 5,
          stats: { fertility: 0.5, resilience: 0.6, harmony: 0.4 }
        })

        const initialUpdated = base.updatedAt.epochMillis

        yield* TestClock.adjust('1 second')
        const hydrated = yield* hydrateCrop({ crop: base, delta: 10 })
        expect(Number(hydrated.moisture)).toBe(DomainConstants.moistureLevel.max)
        expect(hydrated.updatedAt.epochMillis).toBeGreaterThan(initialUpdated)

        yield* TestClock.adjust('1 second')
        const enriched = yield* enrichSoilForCrop({ crop: hydrated, delta: -100 })
        expect(Number(enriched.soil)).toBeGreaterThanOrEqual(DomainConstants.soilQuality.min)
        expect(enriched.updatedAt.epochMillis).toBeGreaterThan(hydrated.updatedAt.epochMillis)
      })
    )
  )

  it.effect.prop('Growth projection reflects stage changes', [cropInputArbitrary, fc.integer({ min: 0, max: 8 })], ([input, steps]) =>
    withTestClock(
      Effect.gen(function* () {
        yield* TestClock.setTime(50_000)
        const crop = yield* makeCropAggregate(input)
        yield* TestClock.adjust('1 second')
        const projection = yield* projectCropTrajectory({ crop, steps })
        const now = yield* TestClock.currentTimeMillis

        const stageValue = Number(crop.stage)

        if (steps === 0 || stageValue === DomainConstants.growthStage.max) {
          expect(projection._tag).toBe('Stable')
          expect(projection.remainAt.epochMillis).toBe(now)
        } else {
          expect(projection._tag).toBe('Improving')
          expect(Number(projection.projectedStage)).toBeGreaterThanOrEqual(stageValue)
          expect(projection.at.epochMillis).toBe(now)
        }
      })
    )
  )

  it.effect('Either variants mirror effect variants', () =>
    Effect.gen(function* () {
      const validInput = {
        id: 'crop-test',
        stage: DomainConstants.growthStage.min,
        moisture: DomainConstants.moistureLevel.min,
        soil: DomainConstants.soilQuality.min,
        stats: { fertility: 0.5, resilience: 0.5, harmony: 0.5 }
      }

      const validResult = yield* makeCropAggregateEither(validInput)
      expect(validResult._tag).toBe('Right')

      const invalidInput = { ...validInput, id: '!' }
      const invalidResult = yield* makeCropAggregateEither(invalidInput)
      expect(invalidResult._tag).toBe('Left')
    })
  )

  it.effect('Validate helpers detect malformed aggregates', () =>
    Effect.matchEffect(validateCropAggregate({}), {
      onFailure: () => Effect.succeed(true),
      onSuccess: () => Effect.succeed(false)
    })
  )

  it.effect('Validate Either identifies malformed aggregate', () =>
    Effect.gen(function* () {
      const result = yield* validateCropAggregateEither({})
      pipe(
        result,
        Either.match({
          onLeft: () => expect(true).toBe(true),
          onRight: () => expect(true).toBe(false)
        })
      )
    })
  )
})
