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

describe('types', () => {
  it.effect.prop('Identifier succeeds for valid inputs', [validIdentifierArbitrary], ([value]) =>
    Effect.gen(function* () {
      const identifier = yield* makeIdentifier(value)
      expect(identifier).toHaveLength(value.length)
    })
  )

  it.effect.prop('Identifier fails for invalid inputs', [invalidIdentifierArbitrary], ([value]) =>
    Effect.gen(function* () {
      const exit = yield* Effect.either(makeIdentifier(value))
      pipe(
        exit,
        Either.match({
          onLeft: (error) =>
            expect(
              matchDomainError(error, {
                validation: () => true,
                outOfRange: () => false,
                schema: () => true,
                invariant: () => false
              })
            ).toBe(true),
          onRight: () => expect(true).toBe(false)
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
        onRight: (identifier) => expect(identifier).toBe('abc_def')
      })
    )

    pipe(
      invalid,
      Either.match({
        onLeft: (error) => expect(matchDomainError(error, {
          validation: () => true,
          schema: () => true,
          outOfRange: () => false,
          invariant: () => false
        })).toBe(true),
        onRight: () => expect(true).toBe(false)
      })
    )
  })

  it.effect.prop(
    'Bounded numbers respect range constraints',
    [fc.integer({ min: DomainConstants.growthStage.min, max: DomainConstants.growthStage.max })],
    ([value]) =>
      Effect.gen(function* () {
        const result = yield* makeBoundedNumber({ field: 'growth', range: DomainConstants.growthStage, value })
        expect(result).toBe(value)
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
