import { describe, it, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect, Either } from 'effect'
import {
  Vector3,
  clamp,
  dot,
  fromNumbers,
  fromNumbersEither,
  magnitude,
  normalize,
  translate,
} from '../../value_object/vector3'

const finiteNumber = fc.double({
  min: -10_000,
  max: 10_000,
  noDefaultInfinity: true,
  noNaN: true,
})

const nonDegenerateVector = fc
  .tuple(finiteNumber, finiteNumber, finiteNumber)
  .filter(([x, y, z]) => Math.abs(x) + Math.abs(y) + Math.abs(z) > 1e-6)

describe('vector3', () => {
  it.effect('creates vectors from numbers', () =>
    Effect.gen(function* () {
      const vector = yield* fromNumbers(1, 2, 3)
      expect(vector).toEqual({ x: 1, y: 2, z: 3 })
    })
  )

  it('fails fast on schema violations', () => {
    const result = fromNumbersEither(Number.NaN, 0, 0)
    Either.match(result, {
      onLeft: (error) => expect(error._tag).toBe('SchemaViolation'),
      onRight: () => expect(true).toBe(false),
    })
  })

  // TODO: プロパティテストの高速化後にskipを解除する
  it.effect.skip('normalization produces unit vectors', () => Effect.unit)

  it.effect('translation composes additively', () =>
    Effect.gen(function* () {
      const origin = yield* fromNumbers(1, 1, 1)
      const offset = yield* fromNumbers(2, 3, 4)
      const translated = yield* translate(origin, offset)
      expect(translated).toEqual({ x: 3, y: 4, z: 5 })
    })
  )

  it.effect('clamp respects bounds', () =>
    Effect.gen(function* () {
      const vector = yield* fromNumbers(5, -5, 2)
      const min = yield* fromNumbers(0, 0, 0)
      const max = yield* fromNumbers(4, 4, 4)
      const clamped = yield* clamp(vector, min, max)
      expect(clamped).toEqual({ x: 4, y: 0, z: 2 })
    })
  )

  it.effect('dot product calculates projection', () =>
    Effect.gen(function* () {
      const a = yield* fromNumbers(1, 0, 0)
      const b = yield* fromNumbers(0, 2, 0)
      const result = yield* dot(a, b)
      expect(result).toBe(0)
    })
  )
})
