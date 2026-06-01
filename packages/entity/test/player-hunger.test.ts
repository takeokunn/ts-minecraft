import { describe, it } from '@effect/vitest'
import { PlayerHunger, PlayerHungerInvariant } from '@ts-minecraft/entity'
import { Either, Schema } from 'effect'
import { expect } from 'vitest'

// ─── PlayerHunger field bounds ──────────────────────────────────────────────

describe('PlayerHunger construction', () => {
  it('accepts a full, valid hunger state', () => {
    const h = new PlayerHunger({ foodLevel: 20, saturation: 5, exhaustion: 0 })
    expect(h.foodLevel).toBe(20)
    expect(h.saturation).toBe(5)
    expect(h.exhaustion).toBe(0)
  })

  it('rejects foodLevel above 20', () => {
    expect(() => new PlayerHunger({ foodLevel: 21, saturation: 0, exhaustion: 0 })).toThrow()
  })

  it('rejects a fractional foodLevel', () => {
    expect(() => new PlayerHunger({ foodLevel: 10.5, saturation: 0, exhaustion: 0 })).toThrow()
  })

  it('rejects negative saturation', () => {
    expect(() => new PlayerHunger({ foodLevel: 10, saturation: -1, exhaustion: 0 })).toThrow()
  })
})

// ─── PlayerHungerInvariant — saturation ≤ foodLevel ─────────────────────────

describe('PlayerHungerInvariant', () => {
  const decode = Schema.decodeUnknownEither(PlayerHungerInvariant)

  it('accepts saturation equal to foodLevel', () => {
    expect(Either.isRight(decode({ foodLevel: 8, saturation: 8, exhaustion: 0 }))).toBe(true)
  })

  it('accepts saturation below foodLevel', () => {
    expect(Either.isRight(decode({ foodLevel: 20, saturation: 5, exhaustion: 2 }))).toBe(true)
  })

  it('rejects saturation exceeding foodLevel', () => {
    expect(Either.isLeft(decode({ foodLevel: 3, saturation: 10, exhaustion: 0 }))).toBe(true)
  })
})
