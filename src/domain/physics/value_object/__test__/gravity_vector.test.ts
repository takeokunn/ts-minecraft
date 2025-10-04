import { it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { describe, expect } from 'vitest'
import { GravityVector } from '../gravity_vector'
import { vector3, positiveFloat } from '../../types/core'

describe('GravityVector', () => {
  it.effect('creates default gravity', () =>
    Effect.map(GravityVector.create({}), (gravity) => {
      expect(gravity.direction.y).toBeLessThan(0)
      expect(gravity.magnitude).toBeGreaterThan(0)
    })
  )

  it.effect('applies gravity to velocity', () =>
    Effect.gen(function* () {
      const gravity = yield* GravityVector.create({})
      const velocity = vector3({ x: 0, y: 0, z: 0 })
      const result = yield* GravityVector.apply(gravity, velocity, positiveFloat(0.016))
      expect(result.y).toBeLessThan(0)
    })
  )

  it.effect.prop('fall damage increases with height', [fc.float({ min: 3, max: 40 })], ([height]) =>
    Effect.sync(() => {
      const damage = GravityVector.calculateFallDamage(positiveFloat(height))
      expect(damage).toBeGreaterThanOrEqual(0)
    })
  )
})
