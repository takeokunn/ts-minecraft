import { it } from '@effect/vitest'
import { Effect } from 'effect'
import * as fc from 'effect/FastCheck'
import { describe, expect } from 'vitest'
import { FrictionCoefficient } from '../friction_coefficient'
import { vector3 } from '../../types/core'

const velocity = vector3({ x: 2, y: 0, z: 0 })
const input = vector3({ x: 1, y: 0, z: 0 })

describe('FrictionCoefficient', () => {
  it('creates from material', () => {
    const friction = FrictionCoefficient.fromMaterial('stone')
    expect(friction.coefficient).toBeLessThanOrEqual(1)
  })

  it.effect('applies movement friction', () =>
    Effect.map(
      FrictionCoefficient.apply(FrictionCoefficient.fromMaterial('stone'), velocity, input),
      (result) => expect(result.x).toBeLessThanOrEqual(velocity.x)
    )
  )

  it('clamps velocity', () => {
    const clamped = FrictionCoefficient.clampHorizontal(vector3({ x: 10, y: 0, z: 0 }), 5)
    expect(clamped.x).toBeLessThanOrEqual(5)
  })

  it.effect.prop('mix keeps coefficient within bounds', [fc.float({ min: 0.1, max: 1 })], ([modifier]) =>
    Effect.map(
      FrictionCoefficient.mix(FrictionCoefficient.fromMaterial('sand'), modifier),
      (mixed) => expect(mixed.coefficient).toBeLessThanOrEqual(1)
    )
  )
})
