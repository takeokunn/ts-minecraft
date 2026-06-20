import { describe, it } from '@effect/vitest'
import { PlayerHunger, PlayerHungerInvariant } from '@ts-minecraft/entity/domain/player-hunger'
import { addExhaustionToHunger, advanceFoodTimer, applyExhaustionCascade, eatFood } from '@ts-minecraft/entity/domain/player-hunger-resolution'
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

// ─── addExhaustionToHunger ────────────────────────────────────────────────────

describe('addExhaustionToHunger', () => {
  const full = new PlayerHunger({ foodLevel: 20, saturation: 5, exhaustion: 0 })

  it('accumulates exhaustion below the cascade threshold', () => {
    const result = addExhaustionToHunger(full, 2)
    expect(result.exhaustion).toBe(2)
    expect(result.saturation).toBe(5)
    expect(result.foodLevel).toBe(20)
  })

  it('ignores a zero amount (no-op)', () => {
    expect(addExhaustionToHunger(full, 0)).toBe(full)
  })

  it('ignores a negative amount (no-op)', () => {
    expect(addExhaustionToHunger(full, -1)).toBe(full)
  })

  it('ignores Infinity to guard against physics blow-ups', () => {
    expect(addExhaustionToHunger(full, Infinity)).toBe(full)
  })

  it('drains saturation when exhaustion exceeds maxExhaustion (4)', () => {
    const result = addExhaustionToHunger(full, 5) // 0 + 5 = 5 ≥ 4 → cascade
    expect(result.saturation).toBe(4) // 5 - 1
    expect(result.foodLevel).toBe(20)
  })

  it('drains foodLevel once saturation is zero', () => {
    const starving = new PlayerHunger({ foodLevel: 10, saturation: 0, exhaustion: 0 })
    const result = addExhaustionToHunger(starving, 5)
    expect(result.saturation).toBe(0)
    expect(result.foodLevel).toBe(9)
  })
})

// ─── applyExhaustionCascade ───────────────────────────────────────────────────

describe('applyExhaustionCascade', () => {
  it('no-ops when exhaustion is below the threshold', () => {
    const h = new PlayerHunger({ foodLevel: 15, saturation: 3, exhaustion: 2 })
    const result = applyExhaustionCascade(h)
    expect(result.exhaustion).toBe(2)
    expect(result.saturation).toBe(3)
  })

  it('drains 1 saturation per exhaustion cycle and resets remainder', () => {
    const h = new PlayerHunger({ foodLevel: 20, saturation: 5, exhaustion: 5 }) // 5 - 4 = 1 remainder
    const result = applyExhaustionCascade(h)
    expect(result.saturation).toBe(4)
    expect(result.exhaustion).toBe(1)
  })

  it('cascades multiple cycles (exhaustion=9: two cycles, 1 remainder)', () => {
    const h = new PlayerHunger({ foodLevel: 20, saturation: 5, exhaustion: 9 })
    const result = applyExhaustionCascade(h)
    expect(result.saturation).toBe(3)
    expect(result.exhaustion).toBe(1)
  })

  it('switches to draining foodLevel when saturation hits 0', () => {
    const h = new PlayerHunger({ foodLevel: 10, saturation: 0, exhaustion: 6 })
    const result = applyExhaustionCascade(h)
    expect(result.foodLevel).toBe(9)
    expect(result.saturation).toBe(0)
  })

  it('clamps foodLevel at 0 (does not go negative)', () => {
    const h = new PlayerHunger({ foodLevel: 0, saturation: 0, exhaustion: 8 })
    const result = applyExhaustionCascade(h)
    expect(result.foodLevel).toBe(0)
  })
})

// ─── eatFood ──────────────────────────────────────────────────────────────────

describe('eatFood', () => {
  const hungry = new PlayerHunger({ foodLevel: 8, saturation: 2, exhaustion: 1 })

  it('increases foodLevel by the food value', () => {
    const result = eatFood(hungry, 4, 0.3)
    expect(result.foodLevel).toBe(12)
  })

  it('increases saturation (food * saturationModifier * 2)', () => {
    // APPLE: food=4, sat=0.3 → added sat = 4 * 0.3 * 2 = 2.4 → 2 + 2.4 = 4.4
    const result = eatFood(hungry, 4, 0.3)
    expect(result.saturation).toBeCloseTo(4.4)
  })

  it('caps foodLevel at 20 (max)', () => {
    const result = eatFood(hungry, 20, 0.6)
    expect(result.foodLevel).toBe(20)
  })

  it('caps saturation at the new foodLevel (not absolute max)', () => {
    // eating to exactly foodLevel=12 with high saturation modifier
    const result = eatFood(hungry, 4, 5) // saturation would be 2 + 4*5*2=42 → capped at 12
    expect(result.saturation).toBe(12)
  })

  it('no-ops when food <= 0', () => {
    expect(eatFood(hungry, 0, 0.3)).toBe(hungry)
    expect(eatFood(hungry, -1, 0.3)).toBe(hungry)
  })

  it('preserves exhaustion after eating', () => {
    const result = eatFood(hungry, 4, 0.3)
    expect(result.exhaustion).toBe(1)
  })
})

// ─── advanceFoodTimer ─────────────────────────────────────────────────────────

describe('advanceFoodTimer', () => {
  const makeState = (foodLevel: number, saturation = 5, tickTimer = 0) => ({
    hunger: new PlayerHunger({ foodLevel, saturation, exhaustion: 0 }),
    tickTimer,
  })

  it('advances the timer without any effect before the interval', () => {
    const [effect, next] = advanceFoodTimer(makeState(20, 5, 50), 80)
    expect(effect).toBe('none')
    expect(next.tickTimer).toBe(51)
  })

  it('triggers regen when foodLevel >= 18 at the interval boundary', () => {
    const [effect, next] = advanceFoodTimer(makeState(20, 5, 79), 80)
    expect(effect).toBe('regen')
    expect(next.tickTimer).toBe(0)
  })

  it('triggers starve when foodLevel is 0', () => {
    const [effect] = advanceFoodTimer(makeState(0, 0, 79), 80)
    expect(effect).toBe('starve')
  })

  it('returns none (timer reset) when foodLevel is between 1 and 17', () => {
    const [effect, next] = advanceFoodTimer(makeState(15, 5, 79), 80)
    expect(effect).toBe('none')
    expect(next.tickTimer).toBe(0)
  })

  it('skips regen when canRegen=false even at high food level', () => {
    const [effect] = advanceFoodTimer(makeState(20), 80, 18, 6, 4, false)
    // timer 0 + 1 = 1 which is < 80 → 'none' without ever reaching the regen branch
    expect(effect).toBe('none')
  })

  it('regen adds exhaustion to hunger (exhaustion cost of natural healing)', () => {
    // food=20, sat=5 at timer=79 → triggers regen → adds exhaustion=6
    const [, next] = advanceFoodTimer(makeState(20, 5, 79), 80)
    expect(next.hunger.exhaustion).toBeGreaterThan(0)
  })
})
