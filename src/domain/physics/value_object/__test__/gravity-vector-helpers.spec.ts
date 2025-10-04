import { describe, expect, it } from 'vitest'
import { GravityVector } from '../gravity-vector'
import { unitInterval } from '../../types/core'

describe('GravityVector helpers', () => {
  it('fluid mediumは減速された重力を返す', () => {
    const inFluid = GravityVector.forMedium(true)
    const inAir = GravityVector.forMedium(false)

    expect(inFluid.multiplier).toBeLessThan(inAir.multiplier)
    expect(inFluid.magnitude).toBeLessThan(inAir.magnitude)
  })

  it('withMultiplierは既存の値を変更せず新しいMultiplierを適用する', () => {
    const base = GravityVector.default
    const updated = GravityVector.withMultiplier(base, unitInterval(0.5))

    expect(updated.multiplier).toBe(0.5)
    expect(base.multiplier).not.toBe(0.5)
    expect(updated.direction).toStrictEqual(base.direction)
  })
})
