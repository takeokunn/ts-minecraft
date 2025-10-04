import { describe, it, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect, Either, pipe } from 'effect'
import {
  DomainConstants,
  makeBoundedNumber,
  makeBoundedNumberEither,
  makeIdentifier,
  makeIdentifierEither,
  matchDomainError
} from './types'

const identifierCharacters: ReadonlyArray<string> = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '_'
]

const validIdentifierArbitrary = fc
  .array(fc.constantFrom(...identifierCharacters), { minLength: 3, maxLength: 30 })
  .map((array) => array.join(''))

const invalidIdentifierArbitrary = fc.oneof(
  fc.string({ maxLength: 2 }),
  fc.string().filter((value) => /[^A-Za-z0-9_-]/.test(value))
)

const boundedNumberWithinRangeArbitrary = fc.oneof(
  fc.integer({ min: DomainConstants.growthStage.min, max: DomainConstants.growthStage.max }).map((value) => ({
    field: 'growthStage',
    range: DomainConstants.growthStage,
    value,
  })),
  fc.integer({ min: DomainConstants.moistureLevel.min, max: DomainConstants.moistureLevel.max }).map((value) => ({
    field: 'moistureLevel',
    range: DomainConstants.moistureLevel,
    value,
  })),
  fc.float({
    min: DomainConstants.soilQuality.min,
    max: DomainConstants.soilQuality.max,
    noNaN: true,
    noDefaultInfinity: true,
  }).map((value) => ({
    field: 'soilQuality',
    range: DomainConstants.soilQuality,
    value,
  })),
  fc.float({
    min: DomainConstants.breedingFactor.min,
    max: DomainConstants.breedingFactor.max,
    noNaN: true,
    noDefaultInfinity: true,
  }).map((value) => ({
    field: 'breedingFactor',
    range: DomainConstants.breedingFactor,
    value,
  }))
)

describe('types', () => {
  it.effect.prop('Identifier succeeds for valid inputs', [validIdentifierArbitrary], ([candidate]) =>
    Effect.gen(function* () {
      const identifier = yield* makeIdentifier(candidate)
      expect(identifier).toBe(candidate.trim())
    })
  )

  it.effect.prop('Identifier fails for invalid inputs', [invalidIdentifierArbitrary], ([candidate]) =>
    Effect.gen(function* () {
      const result = yield* Effect.either(makeIdentifier(candidate))
      pipe(
        result,
        Either.match({
          onLeft: (error) =>
            expect(
              matchDomainError(error, {
                validation: () => true,
                schema: () => false,
                outOfRange: () => false,
                invariant: () => false,
              })
            ).toBe(true),
          onRight: () => expect(true).toBe(false),
        })
      )
    })
  )

  it('Either helpers mirror Effect helpers', () => {
    const valid = makeIdentifierEither('abc_def')
    const invalid = makeIdentifierEither('!')

    pipe(
      valid,
      Either.match({
        onLeft: () => expect(true).toBe(false),
        onRight: (identifier) => expect(identifier).toBe('abc_def'),
      })
    )

    pipe(
      invalid,
      Either.match({
        onLeft: (error) =>
          expect(
            matchDomainError(error, {
              validation: () => true,
              schema: () => true,
              outOfRange: () => false,
              invariant: () => false,
            })
          ).toBe(true),
        onRight: () => expect(true).toBe(false),
      })
    )
  })

  it.effect.prop('Bounded numbers respect range constraints', [boundedNumberWithinRangeArbitrary], ([params]) =>
    Effect.gen(function* () {
      const value = yield* makeBoundedNumber(params)
      expect(value).toBeGreaterThanOrEqual(params.range.min)
      expect(value).toBeLessThanOrEqual(params.range.max)
    })
  )

  it('Bounded number Either fails outside range', () => {
    const result = makeBoundedNumberEither({
      field: 'growth',
      range: DomainConstants.growthStage,
      value: DomainConstants.growthStage.max + 5
    })

    pipe(
      result,
      Either.match({
        onLeft: (error) => expect(matchDomainError(error, {
          validation: () => false,
          schema: () => true,
          outOfRange: () => true,
          invariant: () => false
        })).toBe(true),
        onRight: () => expect(true).toBe(false)
      })
    )
  })
})
