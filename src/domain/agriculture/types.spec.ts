import { describe, expect, it } from '@effect/vitest'
import { Effect, Either, Ref, pipe } from 'effect'
import * as fc from 'effect/FastCheck'
import {
  DomainConstants,
  DomainError,
  DomainInvariant,
  combineInvariants,
  ensurePositive,
  ensureWithinRange,
  makeBoundedNumber,
  makeBoundedNumberEither,
  makeIdentifier,
  makeIdentifierEither,
  matchDomainError,
} from './types'

const propertyConfig: fc.Parameters = { numRuns: 64 }

const identifierCharacters: ReadonlyArray<string> = [
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k',
  'l',
  'm',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '-',
  '_',
]

const validIdentifierArbitrary = fc
  .array(fc.constantFrom(...identifierCharacters), { minLength: 3, maxLength: 64 })
  .map((array) => array.join(''))

const identifierPattern = /^[A-Za-z0-9_-]+$/

const invalidIdentifierArbitrary = fc
  .string({ minLength: 1, maxLength: 80 })
  .filter((value) => {
    const trimmed = value.trim()
    return (
      trimmed.length < 3 ||
      trimmed.length > 64 ||
      trimmed.length === 0 ||
      !identifierPattern.test(trimmed)
    )
  })

const domainRangeEntries = [
  ['growthStage', DomainConstants.growthStage] as const,
  ['moistureLevel', DomainConstants.moistureLevel] as const,
  ['soilQuality', DomainConstants.soilQuality] as const,
  ['breedingFactor', DomainConstants.breedingFactor] as const,
]

describe('domain/agriculture/types', () => {
  it('makeIdentifierは許可された文字列を受け入れる (PBT)', () =>
    fc.assert(
      fc.property(validIdentifierArbitrary, (value) => {
        const result = Effect.runSync(Effect.either(makeIdentifier(value)))
        pipe(
          result,
          Either.match({
            onLeft: () => expect(false).toBe(true),
            onRight: (identifier) => expect(identifier).toBe(value.trim()),
          })
        )
      }),
      propertyConfig
    )
  )

  it('makeIdentifierは無効な文字列を拒否する (PBT)', () =>
    fc.assert(
      fc.property(invalidIdentifierArbitrary, (value) => {
        const result = Effect.runSync(Effect.either(makeIdentifier(value)))
        pipe(
          result,
          Either.match({
            onLeft: (error) => expect(error._tag).toBe('ValidationError'),
            onRight: () => expect(false).toBe(true),
          })
        )
      }),
      propertyConfig
    )
  )

  it('makeBoundedNumberは範囲内の値を保全する (PBT)', () =>
    fc.assert(
      fc.property(
        fc.constantFrom(...domainRangeEntries),
        fc.float({ min: 0, max: 1, noNaN: true }),
        (entry, ratio) => {
          const [field, range] = entry
          const value = range.min + (range.max - range.min) * ratio
          const result = Effect.runSync(Effect.either(makeBoundedNumber({ field, range, value })))
          pipe(
            result,
            Either.match({
              onLeft: () => expect(false).toBe(true),
              onRight: (number) => {
                expect(number).toBeGreaterThanOrEqual(range.min)
                expect(number).toBeLessThanOrEqual(range.max)
              },
            })
          )
        }
      ),
      propertyConfig
    )
  )

  it('makeBoundedNumberは範囲外と非有限値で失敗する', () => {
    fc.assert(
      fc.property(fc.constantFrom(...domainRangeEntries), (entry) => {
        const [field, range] = entry
        const invalidValues = [
          range.min - 1,
          range.max + 1,
          Number.POSITIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
          Number.NaN,
        ]

        for (const value of invalidValues) {
          const exit = Effect.runSyncExit(makeBoundedNumber({ field, range, value }))
          expect(exit._tag).toBe('Failure')
        }
      }),
      propertyConfig
    )
  })

  it('EitherヘルパーはEffect版と整合する', () => {
    const valid = makeIdentifierEither('valid_id')
    const invalid = makeIdentifierEither('!')

    pipe(
      valid,
      Either.match({
        onLeft: () => expect(false).toBe(true),
        onRight: (identifier) => expect(identifier).toBe('valid_id'),
      })
    )

    pipe(
      invalid,
      Either.match({
        onLeft: (error) => expect(error._tag).toBe('ValidationError'),
        onRight: () => expect(false).toBe(true),
      })
    )

    const bounded = makeBoundedNumberEither({
      field: 'growthStage',
      range: DomainConstants.growthStage,
      value: DomainConstants.growthStage.max + 1,
    })

    pipe(
      bounded,
      Either.match({
        onLeft: (error) => expect(error._tag).toBe('OutOfRange'),
        onRight: () => expect(false).toBe(true),
      })
    )
  })

  it.effect('combineInvariantsは全ての不変条件を評価する', () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<string>>([])

      const track = (label: string): DomainInvariant<number> => ({
        description: label,
        verify: (value) =>
          Ref.update(calls, (entries) => [...entries, label]).pipe(Effect.as(value)),
      })

      const positive = ensurePositive('value')
      const range = ensureWithinRange('value', { min: 1, max: 10 })
      const combined = combineInvariants([track('first'), positive, track('second'), range])

      const success = yield* combined.verify(5)
      expect(success).toBe(5)

      const history = yield* Ref.get(calls)
      expect(history).toEqual(['first', 'second'])

      const failureExit = Effect.runSyncExit(combined.verify(0))
      expect(failureExit._tag).toBe('Failure')
    })
  )

  it('ensurePositiveは0以下を拒否する', () => {
    const success = Effect.runSync(Effect.either(ensurePositive('value').verify(1)))
    pipe(
      success,
      Either.match({
        onLeft: () => expect(false).toBe(true),
        onRight: (value) => expect(value).toBe(1),
      })
    )

    const failure = Effect.runSyncExit(ensurePositive('value').verify(0))
    expect(failure._tag).toBe('Failure')
  })

  it('ensureWithinRangeは範囲外を拒否する', () => {
    const invariant = ensureWithinRange('growth', DomainConstants.growthStage)
    const success = Effect.runSync(
      Effect.either(invariant.verify(DomainConstants.growthStage.min))
    )
    pipe(
      success,
      Either.match({
        onLeft: () => expect(false).toBe(true),
        onRight: (value) => expect(value).toBe(DomainConstants.growthStage.min),
      })
    )

    const failure = Effect.runSyncExit(invariant.verify(DomainConstants.growthStage.max + 1))
    expect(failure._tag).toBe('Failure')
  })

  it('matchDomainErrorは各ケースを適切に分岐する', () => {
    const validation = DomainError.ValidationError({ field: 'id', message: 'too short' })
    const outOfRange = DomainError.OutOfRange({
      field: 'growthStage',
      range: DomainConstants.growthStage,
      actual: 99,
    })
    const schema = DomainError.SchemaViolation({ field: 'stats', message: 'invalid schema' })
    const invariant = DomainError.InvariantViolation({ description: 'broken invariant' })
    const unknown = { _tag: 'Unknown' } as DomainError

    expect(
      matchDomainError(validation, {
        validation: () => 'validation',
        outOfRange: () => 'outOfRange',
        schema: () => 'schema',
        invariant: () => 'invariant',
      })
    ).toBe('validation')

    expect(
      matchDomainError(outOfRange, {
        validation: () => 'validation',
        outOfRange: () => 'outOfRange',
        schema: () => 'schema',
        invariant: () => 'invariant',
      })
    ).toBe('outOfRange')

    expect(
      matchDomainError(schema, {
        validation: () => 'validation',
        outOfRange: () => 'outOfRange',
        schema: () => 'schema',
        invariant: () => 'invariant',
      })
    ).toBe('schema')

    expect(
      matchDomainError(invariant, {
        validation: () => 'validation',
        outOfRange: () => 'outOfRange',
        schema: () => 'schema',
        invariant: () => 'invariant',
      })
    ).toBe('invariant')

    expect(
      matchDomainError(unknown, {
        validation: () => 'validation',
        outOfRange: () => 'outOfRange',
        schema: () => 'schema',
        invariant: () => 'invariant',
      })
    ).toBe('validation')
  })
})
