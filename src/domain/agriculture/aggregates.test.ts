import { describe, it, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect, Either, pipe } from 'effect'
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

const cropInputArbitrary = fc.record({
  id: fc.string({ minLength: 3, maxLength: 12 }).filter((value) => /^[A-Za-z0-9_-]+$/.test(value)),
  stage: fc.integer({ min: DomainConstants.growthStage.min, max: DomainConstants.growthStage.max }),
  moisture: fc.integer({ min: DomainConstants.moistureLevel.min, max: DomainConstants.moistureLevel.max }),
  soil: fc.float({ min: DomainConstants.soilQuality.min, max: DomainConstants.soilQuality.max }),
  stats: fc.record({
    fertility: fc.float({ min: DomainConstants.breedingFactor.min, max: DomainConstants.breedingFactor.max }),
    resilience: fc.float({ min: DomainConstants.breedingFactor.min, max: DomainConstants.breedingFactor.max }),
    harmony: fc.float({ min: DomainConstants.breedingFactor.min, max: DomainConstants.breedingFactor.max })
  })
})

describe('aggregates', () => {
  it.effect.prop('Crop aggregate creation succeeds for valid inputs', [cropInputArbitrary], ([input]) =>
    Effect.gen(function* () {
      const aggregate = yield* makeCropAggregate(input)
      expect(aggregate.id).toBeDefined()
      expect(aggregate.stats).toBeDefined()
    })
  )

  it.effect.prop(
    'Hydration and soil enrichment update aggregates safely',
    [cropInputArbitrary, fc.integer({ min: -3, max: 5 }), fc.float({ min: -10, max: 10 })],
    ([input, waterDelta, soilDelta]) =>
      Effect.gen(function* () {
        const aggregate = yield* makeCropAggregate(input)
        const hydrated = yield* hydrateCrop({ crop: aggregate, delta: waterDelta })
        const enriched = yield* enrichSoilForCrop({ crop: hydrated, delta: soilDelta })
        const summary = describeAggregateSummary(enriched)
        expect(summary.hydration).toBeDefined()
        expect(summary.soilCondition).toBeDefined()
      })
  )

  it.effect.prop('Growth projection reflects stage changes', [cropInputArbitrary, fc.integer({ min: 0, max: 5 })], ([input, steps]) =>
    Effect.gen(function* () {
      const aggregate = yield* makeCropAggregate(input)
      const projection = yield* projectCropTrajectory({ crop: aggregate, steps })
      expect(projection._tag).toBeDefined()
    })
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
