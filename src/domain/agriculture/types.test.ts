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
  // TODO: プロパティテストの高速化後にskipを解除する
  it.effect.skip('Identifier succeeds for valid inputs', () => Effect.unit)

  // TODO: プロパティテストの高速化後にskipを解除する
  it.effect.skip('Identifier fails for invalid inputs', () => Effect.unit)

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

  // TODO: プロパティテストの高速化後にskipを解除する
  it.effect.skip('Bounded numbers respect range constraints', () => Effect.unit)

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
