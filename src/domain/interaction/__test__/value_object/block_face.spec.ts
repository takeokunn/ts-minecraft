import { describe, it, expect } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Effect, Either } from 'effect'
import { fromNormalVector, opposite, safeFromNormalVector, toUnitNormal } from '../../value_object/block_face'
import { fromNumbers } from '../../value_object/vector3'

const axisUnit = fc.constantFrom<[number, number, number]>([1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1])

describe('block_face', () => {
  // TODO: プロパティテストの高速化後にskipを解除する
  it.effect.skip('derives face from axis aligned normal', () => Effect.unit)

  it.effect('computes opposite face', () =>
    Effect.gen(function* () {
      const base = yield* fromNumbers(0, 0, 1)
      const south = yield* fromNormalVector(base)
      const oppositeFace = yield* opposite(south)
      expect(oppositeFace).toBe('north')
    })
  )

  it.effect('fails gracefully on zero vector', () =>
    Effect.gen(function* () {
      const vector = yield* fromNumbers(0, 0, 0)
      const result = safeFromNormalVector(vector)
      Either.match(result, {
        onLeft: (error) => expect(['Indeterminate', 'SchemaViolation']).toContain(error._tag),
        onRight: () => expect(true).toBe(false),
      })
    })
  )
})
