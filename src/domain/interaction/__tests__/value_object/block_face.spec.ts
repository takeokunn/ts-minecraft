import { describe, expect, it } from '@effect/vitest'
import { Effect, Either } from 'effect'
import * as fc from 'effect/FastCheck'
import { fromNormalVector, opposite, safeFromNormalVector } from '../../value_object/block_face'
import { fromNumbers } from '../../value_object/vector3'

const propertyConfig: fc.Parameters = { numRuns: 48 }

const axisUnit = fc.constantFrom<[number, number, number]>(
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1]
)

const expectedFaceFor = ([x, y, z]: [number, number, number]): string => {
  if (x === 1) return 'east'
  if (x === -1) return 'west'
  if (y === 1) return 'up'
  if (y === -1) return 'down'
  if (z === 1) return 'south'
  if (z === -1) return 'north'
  return 'south'
}

describe('block_face', () => {
  it('derives face from axis aligned normal (PBT)', () =>
    fc.assert(
      fc.property(axisUnit, (components) => {
        const vector = Effect.runSync(fromNumbers(...components))
        const face = Effect.runSync(fromNormalVector(vector))
        expect(face).toBe(expectedFaceFor(components))
      }),
      propertyConfig
    )
  )

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
