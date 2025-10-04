import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { FrictionCoefficient } from '../friction-coefficient'
import { unitInterval, vector3 } from '../../types/core'

const run = <A>(program: Effect.Effect<A>) => Effect.runPromise(program)
const runExit = <A>(program: Effect.Effect<A, unknown>) => Effect.runPromiseExit(program)

describe('physics/value_object/friction_coefficient', () => {
  it('creates coefficient for material when value is valid', async () => {
    const friction = await run(FrictionCoefficient.create('stone', 0.42))
    expect(friction.material).toBe('stone')
    expect(friction.coefficient).toBeCloseTo(0.42)
  })

  it('fails to create coefficient when value is out of range', async () => {
    const exit = await runExit(FrictionCoefficient.create('stone', 1.4))
    expect(exit._tag).toBe('Failure')
  })

  it('derives coefficient from material constants', () => {
    const friction = FrictionCoefficient.fromMaterial('glass')
    expect(friction.coefficient).toBeCloseTo(0.5)
  })

  it('mix scales coefficient by modifier', async () => {
    const base = FrictionCoefficient.fromMaterial('stone')
    const mixed = await run(FrictionCoefficient.mix(base, unitInterval(0.5)))
    expect(mixed.coefficient).toBeCloseTo(0.35)
  })

  describe('apply', () => {
    const velocity = vector3({ x: 4, y: 1, z: -3 })
    const input = vector3({ x: 1, y: 0, z: 1 })

    it('scales velocity for very high friction', async () => {
      const high = await run(FrictionCoefficient.create('metal', 0.98))
      const updated = await run(FrictionCoefficient.apply(high, velocity, input))
      expect(updated.x).toBeCloseTo(velocity.x * high.coefficient)
      expect(updated.y).toBeCloseTo(velocity.y)
      expect(updated.z).toBeCloseTo(velocity.z * high.coefficient)
    })

    it('applies input assist for very low friction', async () => {
      const low = await run(FrictionCoefficient.create('ice', 0.05))
      const updated = await run(FrictionCoefficient.apply(low, velocity, input))
      expect(updated.x).toBeCloseTo(velocity.x * low.coefficient + input.x * 0.05)
      expect(updated.z).toBeCloseTo(velocity.z * low.coefficient + input.z * 0.05)
    })

    it('passes through input for mid-range friction', async () => {
      const medium = FrictionCoefficient.fromMaterial('wood')
      const updated = await run(FrictionCoefficient.apply(medium, velocity, input))
      expect(updated.x).toBeCloseTo(input.x)
      expect(updated.z).toBeCloseTo(input.z)
    })
  })

  it('clamps horizontal velocity when exceeding limit', () => {
    const velocity = vector3({ x: 10, y: 0, z: 10 })
    const clamped = FrictionCoefficient.clampHorizontal(velocity, 5)
    const speed = Math.hypot(clamped.x, clamped.z)
    expect(speed).toBeCloseTo(5)
    expect(clamped.y).toBe(0)
  })
})
