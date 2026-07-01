import { describe, expect, it } from 'vitest'
import {
  applyExhaustionCascade,
  addExhaustionToHunger,
  eatFood,
  advanceFoodTimer,
} from '@ts-minecraft/entity/domain/player-hunger-resolution'
import { PlayerHunger, type HungerState } from '@ts-minecraft/entity/domain/player-hunger'

// ─── helpers ─────────────────────────────────────────────────────────────────

const makeHunger = (foodLevel: number, saturation = 0, exhaustion = 0): PlayerHunger =>
  new PlayerHunger({ foodLevel, saturation, exhaustion })

const makeState = (
  foodLevel: number,
  saturation = 0,
  exhaustion = 0,
  tickTimer = 0,
): HungerState => ({
  hunger: makeHunger(foodLevel, saturation, exhaustion),
  tickTimer,
})

// ─── applyExhaustionCascade ───────────────────────────────────────────────────
describe('applyExhaustionCascade', () => {
  it('returns the same hunger when exhaustion is below max (no cascade)', () => {
    const h = makeHunger(10, 5, 2)
    const result = applyExhaustionCascade(h)
    expect(result.foodLevel).toBe(10)
    expect(result.saturation).toBe(5)
  })

  it('drains saturation by 1 when exhaustion reaches 4 with saturation available', () => {
    const h = makeHunger(10, 5, 4)
    const result = applyExhaustionCascade(h)
    expect(result.saturation).toBe(4)
    expect(result.foodLevel).toBe(10)
  })

  it('drains foodLevel when saturation is 0 and exhaustion reaches 4', () => {
    const h = makeHunger(10, 0, 4)
    const result = applyExhaustionCascade(h)
    expect(result.foodLevel).toBe(9)
    expect(result.saturation).toBe(0)
  })

  it('clamps foodLevel at 0 when starving with max exhaustion', () => {
    const h = makeHunger(0, 0, 4)
    const result = applyExhaustionCascade(h)
    expect(result.foodLevel).toBe(0)
  })

  it('carries remainder exhaustion after cascade', () => {
    // exhaustion=5 → cascade: drain 1 saturation, remainder=1
    const h = makeHunger(10, 5, 5)
    const result = applyExhaustionCascade(h)
    expect(result.exhaustion).toBeCloseTo(1)
  })

  it('cascades multiple times for large exhaustion values', () => {
    // exhaustion=8 → 2 cascade steps → saturation drains by 2
    const h = makeHunger(10, 5, 8)
    const result = applyExhaustionCascade(h)
    expect(result.saturation).toBe(3)
  })
})

// ─── addExhaustionToHunger ────────────────────────────────────────────────────
describe('addExhaustionToHunger', () => {
  it('adds exhaustion without cascading when accumulator stays below 4', () => {
    const h = makeHunger(10, 5, 0)
    const result = addExhaustionToHunger(h, 1)
    expect(result.exhaustion).toBeCloseTo(1)
    expect(result.saturation).toBe(5)
  })

  it('is a no-op for zero exhaustion', () => {
    const h = makeHunger(10, 5, 0)
    expect(addExhaustionToHunger(h, 0)).toBe(h)
  })

  it('is a no-op for negative exhaustion', () => {
    const h = makeHunger(10, 5, 0)
    expect(addExhaustionToHunger(h, -1)).toBe(h)
  })

  it('is a no-op for infinite exhaustion (physics blow-up guard)', () => {
    const h = makeHunger(10, 5, 0)
    expect(addExhaustionToHunger(h, Infinity)).toBe(h)
  })

  it('is a no-op for NaN exhaustion', () => {
    const h = makeHunger(10, 5, 0)
    expect(addExhaustionToHunger(h, NaN)).toBe(h)
  })

  it('triggers cascade when accumulator exceeds 4', () => {
    // exhaustion=3.5 + 1.0 = 4.5 → cascade fires
    const h = makeHunger(10, 5, 3.5)
    const result = addExhaustionToHunger(h, 1.0)
    expect(result.saturation).toBe(4)
  })
})

// ─── eatFood ──────────────────────────────────────────────────────────────────
describe('eatFood', () => {
  it('increases foodLevel by the food amount', () => {
    const result = eatFood(makeHunger(10, 0), 4, 0.3)
    expect(result.foodLevel).toBe(14)
  })

  it('clamps foodLevel to 20 (maxFoodLevel)', () => {
    const result = eatFood(makeHunger(18, 0), 5, 0.3)
    expect(result.foodLevel).toBe(20)
  })

  it('is a no-op for zero food', () => {
    const h = makeHunger(10, 0)
    expect(eatFood(h, 0, 0.3)).toBe(h)
  })

  it('is a no-op for negative food', () => {
    const h = makeHunger(10, 0)
    expect(eatFood(h, -1, 0.3)).toBe(h)
  })

  it('adds saturation based on food * modifier * 2, capped at new foodLevel', () => {
    // foodLevel: 10 + 4 = 14; saturation: 0 + 4*0.3*2 = 2.4, capped at 14
    const result = eatFood(makeHunger(10, 0), 4, 0.3)
    expect(result.saturation).toBeCloseTo(2.4)
  })

  it('caps saturation at the resulting foodLevel (not 20)', () => {
    // foodLevel becomes 14, saturation would be 0 + 4 * 2 * 2 = 16 → capped at 14
    const result = eatFood(makeHunger(10, 0), 4, 2.0)
    expect(result.saturation).toBe(result.foodLevel)
  })

  it('preserves exhaustion (eating does not change exhaustion)', () => {
    const result = eatFood(makeHunger(10, 0, 2), 4, 0.3)
    expect(result.exhaustion).toBeCloseTo(2)
  })
})

// ─── advanceFoodTimer ─────────────────────────────────────────────────────────
describe('advanceFoodTimer', () => {
  it('returns none and increments tickTimer before interval', () => {
    const [effect, next] = advanceFoodTimer(makeState(20, 5, 0, 70))
    expect(effect).toBe('none')
    expect(next.tickTimer).toBe(71)
  })

  it('returns regen and resets timer when food is above threshold at interval', () => {
    // foodLevel=18 >= 18 threshold, timer reaches 80
    const [effect, next] = advanceFoodTimer(makeState(20, 5, 0, 79))
    expect(effect).toBe('regen')
    expect(next.tickTimer).toBe(0)
  })

  it('returns starve and resets timer when food is 0 at interval', () => {
    const [effect, next] = advanceFoodTimer(makeState(0, 0, 0, 79))
    expect(effect).toBe('starve')
    expect(next.tickTimer).toBe(0)
  })

  it('returns none at interval when food is between 1 and 17 (no regen, no starve)', () => {
    const [effect, next] = advanceFoodTimer(makeState(10, 0, 0, 79))
    expect(effect).toBe('none')
    expect(next.tickTimer).toBe(0)
  })

  it('skips regen when canRegen=false (full-health idle anti-drain guard)', () => {
    const [effect] = advanceFoodTimer(makeState(20, 5, 0, 79), 80, 18, 6, 4, false)
    expect(effect).toBe('none')
  })
})
