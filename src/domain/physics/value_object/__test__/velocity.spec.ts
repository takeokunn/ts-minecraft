import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { GravityVector } from '../gravity-vector'
import { FrictionCoefficient } from '../friction-coefficient'
import { vector3, unitInterval, positiveFloat } from '../../types/core'

const run = <A>(program: Effect.Effect<A>) => Effect.runPromise(program)

describe('physics/value_object/velocity', () => {
  it('clamps horizontal speed after friction is applied', async () => {
    const friction = FrictionCoefficient.fromMaterial('stone')
    const velocity = vector3({ x: 12, y: 0, z: -16 })
    const input = vector3({ x: 0, y: 0, z: 0 })

    const afterFriction = await run(FrictionCoefficient.apply(friction, velocity, input))
    const clamped = FrictionCoefficient.clampHorizontal(afterFriction, 8)

    expect(Math.hypot(clamped.x, clamped.z)).toBeLessThanOrEqual(8)
    expect(clamped.y).toBe(afterFriction.y)
  })

  it('integrates friction and gravity within a single step', async () => {
    const friction = FrictionCoefficient.fromMaterial('stone')
    const gravity = await run(GravityVector.create({}))

    const startVelocity = vector3({ x: 5, y: 3, z: 0 })
    const input = vector3({ x: 1, y: 0, z: 0 })

    const afterFriction = await run(FrictionCoefficient.apply(friction, startVelocity, input))
    const afterGravity = await run(
      GravityVector.apply(gravity, afterFriction, positiveFloat(0.2))
    )

    expect(afterGravity.y).toBeLessThan(afterFriction.y)
    expect(afterGravity.x).toBeGreaterThan(0)
    expect(Math.abs(afterGravity.x)).toBeLessThanOrEqual(Math.abs(startVelocity.x))
  })

  it('respects multiplier adjustments when applying gravity', async () => {
    const gravity = await run(GravityVector.create({ multiplier: unitInterval(0.5) }))
    const velocity = vector3({ x: 0, y: 0, z: 0 })

    const afterGravity = await run(
      GravityVector.apply(gravity, velocity, positiveFloat(1))
    )

    expect(afterGravity.y).toBeCloseTo(gravity.direction.y * gravity.magnitude * gravity.multiplier)
  })
})
