import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Either, Schema } from 'effect'
import { PlayerHealth, PlayerHealthInvariant } from '../domain/player-health'
import { expectSome } from './test-utils'

describe('PlayerHealth schema', () => {
  describe('valid construction', () => {
    it('accepts { current: 20, max: 20, invincibilityTicks: 0 }', () => {
      const result = Schema.decodeUnknownEither(PlayerHealth)({
        current: 20,
        max: 20,
        invincibilityTicks: 0,
      })
      expect(Either.isRight(result)).toBe(true)
      const h = expectSome(Either.getRight(result))
      expect(h.current).toBe(20)
      expect(h.max).toBe(20)
      expect(h.invincibilityTicks).toBe(0)
    })

    it('accepts minimum valid values { current: 0, max: 1, invincibilityTicks: 0 }', () => {
      const result = Schema.decodeUnknownEither(PlayerHealth)({
        current: 0,
        max: 1,
        invincibilityTicks: 0,
      })
      expect(Either.isRight(result)).toBe(true)
    })

    it('accepts non-zero invincibilityTicks', () => {
      const result = Schema.decodeUnknownEither(PlayerHealth)({
        current: 10,
        max: 20,
        invincibilityTicks: 5,
      })
      expect(Either.isRight(result)).toBe(true)
    })
  })

  describe('current field validation', () => {
    it('rejects current below 0', () => {
      const result = Schema.decodeUnknownEither(PlayerHealth)({
        current: -1,
        max: 20,
        invincibilityTicks: 0,
      })
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects current above 20', () => {
      const result = Schema.decodeUnknownEither(PlayerHealth)({
        current: 21,
        max: 20,
        invincibilityTicks: 0,
      })
      expect(Either.isLeft(result)).toBe(true)
    })
  })

  describe('max field validation', () => {
    it('rejects max below 1', () => {
      const result = Schema.decodeUnknownEither(PlayerHealth)({
        current: 0,
        max: 0,
        invincibilityTicks: 0,
      })
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects max above 20', () => {
      const result = Schema.decodeUnknownEither(PlayerHealth)({
        current: 20,
        max: 21,
        invincibilityTicks: 0,
      })
      expect(Either.isLeft(result)).toBe(true)
    })
  })

  describe('invincibilityTicks field validation', () => {
    it('rejects invincibilityTicks below 0', () => {
      const result = Schema.decodeUnknownEither(PlayerHealth)({
        current: 20,
        max: 20,
        invincibilityTicks: -1,
      })
      expect(Either.isLeft(result)).toBe(true)
    })

    it('rejects invincibilityTicks float (1.5)', () => {
      const result = Schema.decodeUnknownEither(PlayerHealth)({
        current: 20,
        max: 20,
        invincibilityTicks: 1.5,
      })
      expect(Either.isLeft(result)).toBe(true)
    })
  })
})

describe('PlayerHealthInvariant', () => {
  it('accepts current === max', () => {
    const result = Schema.decodeUnknownEither(PlayerHealthInvariant)({
      current: 20,
      max: 20,
      invincibilityTicks: 0,
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts current < max', () => {
    const result = Schema.decodeUnknownEither(PlayerHealthInvariant)({
      current: 15,
      max: 20,
      invincibilityTicks: 0,
    })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects current > max', () => {
    const result = Schema.decodeUnknownEither(PlayerHealthInvariant)({
      current: 20,
      max: 15,
      invincibilityTicks: 0,
    })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejection message contains "must not exceed"', () => {
    const result = Schema.decodeUnknownEither(PlayerHealthInvariant)({
      current: 20,
      max: 15,
      invincibilityTicks: 0,
    })
    expect(Either.isLeft(result)).toBe(true)
    const err = expectSome(Either.getLeft(result))
    expect(String(err)).toContain('must not exceed')
  })
})
