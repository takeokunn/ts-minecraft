import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { MetersPerSec } from './physics'

describe('MetersPerSec', () => {
  it('make(10) succeeds', () => {
    expect(MetersPerSec.make(10)).toBe(10)
  })

  it('make(-5) succeeds (negative is valid for deceleration)', () => {
    expect(MetersPerSec.make(-5)).toBe(-5)
  })

  it('make(0) succeeds (zero is valid for stationary)', () => {
    expect(MetersPerSec.make(0)).toBe(0)
  })

  it('make(Infinity) throws', () => {
    expect(() => MetersPerSec.make(Infinity)).toThrow()
  })

  it('make(NaN) throws', () => {
    expect(() => MetersPerSec.make(NaN)).toThrow()
  })

  it('toNumber(make(5)) equals 5', () => {
    expect(MetersPerSec.toNumber(MetersPerSec.make(5))).toBe(5)
  })
})
