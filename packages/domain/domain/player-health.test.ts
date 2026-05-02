import { describe, it } from 'vitest'
import { expect } from 'vitest'
import { Schema } from 'effect'
import { PlayerHealth, PlayerHealthInvariant } from './player-health'

describe('PlayerHealth', () => {
  it('creates valid PlayerHealth with current=10, max=20, invincibilityTicks=0', () => {
    const h = new PlayerHealth({ current: 10, max: 20, invincibilityTicks: 0 })
    expect(h['current']).toBe(10)
    expect(h['max']).toBe(20)
    expect(h['invincibilityTicks']).toBe(0)
  })

  it('creates valid PlayerHealth at maximum: current=20, max=20', () => {
    const h = new PlayerHealth({ current: 20, max: 20, invincibilityTicks: 0 })
    expect(h['current']).toBe(20)
    expect(h['max']).toBe(20)
  })

  it('creates valid PlayerHealth at minimum: current=0, max=1', () => {
    const h = new PlayerHealth({ current: 0, max: 1, invincibilityTicks: 0 })
    expect(h['current']).toBe(0)
    expect(h['max']).toBe(1)
  })

  it('current can equal max', () => {
    const h = new PlayerHealth({ current: 15, max: 15, invincibilityTicks: 0 })
    expect(h['current']).toBe(h['max'])
  })

  it('rejects current < 0', () => {
    expect(() =>
      Schema.decodeUnknownSync(PlayerHealth)({ current: -1, max: 20, invincibilityTicks: 0 })
    ).toThrow()
  })

  it('rejects current > 20', () => {
    expect(() =>
      Schema.decodeUnknownSync(PlayerHealth)({ current: 21, max: 20, invincibilityTicks: 0 })
    ).toThrow()
  })

  it('rejects max < 1 (minimum is 1)', () => {
    expect(() =>
      Schema.decodeUnknownSync(PlayerHealth)({ current: 0, max: 0, invincibilityTicks: 0 })
    ).toThrow()
  })

  it('rejects max > 20', () => {
    expect(() =>
      Schema.decodeUnknownSync(PlayerHealth)({ current: 20, max: 21, invincibilityTicks: 0 })
    ).toThrow()
  })

  it('rejects invincibilityTicks < 0', () => {
    expect(() =>
      Schema.decodeUnknownSync(PlayerHealth)({ current: 10, max: 20, invincibilityTicks: -1 })
    ).toThrow()
  })

  it('accepts positive invincibilityTicks', () => {
    const h = new PlayerHealth({ current: 10, max: 20, invincibilityTicks: 5 })
    expect(h['invincibilityTicks']).toBe(5)
  })

  it('encode/decode roundtrip for PlayerHealth', () => {
    const original = new PlayerHealth({ current: 8, max: 18, invincibilityTicks: 3 })
    const encoded = Schema.encodeSync(PlayerHealth)(original)
    const decoded = Schema.decodeUnknownSync(PlayerHealth)(encoded)
    expect(decoded['current']).toBe(8)
    expect(decoded['max']).toBe(18)
    expect(decoded['invincibilityTicks']).toBe(3)
  })
})

describe('PlayerHealthInvariant', () => {
  it('accepts current == max', () => {
    const h = Schema.decodeUnknownSync(PlayerHealthInvariant)({ current: 10, max: 10, invincibilityTicks: 0 })
    expect(h['current']).toBe(10)
    expect(h['max']).toBe(10)
  })

  it('accepts current < max', () => {
    const h = Schema.decodeUnknownSync(PlayerHealthInvariant)({ current: 5, max: 20, invincibilityTicks: 0 })
    expect(h['current']).toBe(5)
  })

  it('rejects current > max (cross-field invariant violation)', () => {
    expect(() =>
      Schema.decodeUnknownSync(PlayerHealthInvariant)({ current: 15, max: 10, invincibilityTicks: 0 })
    ).toThrow()
  })

  it('rejects current > max at boundary (current=2, max=1)', () => {
    expect(() =>
      Schema.decodeUnknownSync(PlayerHealthInvariant)({ current: 2, max: 1, invincibilityTicks: 0 })
    ).toThrow()
  })

  it('still rejects field-level violations (current < 0)', () => {
    expect(() =>
      Schema.decodeUnknownSync(PlayerHealthInvariant)({ current: -1, max: 20, invincibilityTicks: 0 })
    ).toThrow()
  })
})
