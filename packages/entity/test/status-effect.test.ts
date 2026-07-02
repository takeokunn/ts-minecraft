import { describe, expect, it } from 'vitest'
import {
  advanceStatusEffectsOneTick,
  makeStatusEffect,
  statusEffectIntervalTicks,
  upsertStatusEffect,
  type ActiveStatusEffect,
} from '@ts-minecraft/entity/domain/status-effect'

const tickTimes = (
  effects: ReadonlyArray<ActiveStatusEffect>,
  times: number,
): { effects: ReadonlyArray<ActiveStatusEffect>; healed: number; poisoned: number } => {
  let current = effects
  let healed = 0
  let poisoned = 0
  for (let i = 0; i < times; i++) {
    const result = advanceStatusEffectsOneTick(current)
    current = result.effects
    healed += result.healAmount
    poisoned += result.poisonDamage
  }
  return { effects: current, healed, poisoned }
}

describe('status effect domain', () => {
  it('Regeneration I heals 1 HP every 50 ticks (2.5s)', () => {
    const start = [makeStatusEffect('REGENERATION', 0, 10)] // 200 ticks
    const { healed } = tickTimes(start, 100)
    expect(healed).toBe(2)
  })

  it('Regeneration II halves the interval (25 ticks)', () => {
    const start = [makeStatusEffect('REGENERATION', 1, 10)]
    const { healed } = tickTimes(start, 100)
    expect(healed).toBe(4)
  })

  it('Poison I damages 1 HP every 25 ticks', () => {
    const start = [makeStatusEffect('POISON', 0, 10)]
    const { poisoned } = tickTimes(start, 50)
    expect(poisoned).toBe(2)
  })

  it('effects expire after their duration', () => {
    const start = [makeStatusEffect('REGENERATION', 0, 1)] // 20 ticks
    const { effects } = tickTimes(start, 20)
    expect(effects).toHaveLength(0)
  })

  it('a stronger application replaces a weaker active effect', () => {
    const base = [makeStatusEffect('REGENERATION', 0, 30)]
    const next = upsertStatusEffect(base, makeStatusEffect('REGENERATION', 1, 5))
    expect(next).toHaveLength(1)
    expect(next[0]!.amplifier).toBe(1)
  })

  it('an equal-strength application keeps the longer duration', () => {
    const base = [makeStatusEffect('REGENERATION', 0, 30)]
    const next = upsertStatusEffect(base, makeStatusEffect('REGENERATION', 0, 5))
    expect(next[0]!.remainingTicks).toBe(30 * 20)
  })

  it('a weaker application is ignored while the stronger one is active', () => {
    const base = [makeStatusEffect('POISON', 1, 10)]
    const next = upsertStatusEffect(base, makeStatusEffect('POISON', 0, 60))
    expect(next[0]!.amplifier).toBe(1)
  })

  it('distinct effect types coexist', () => {
    const both = upsertStatusEffect(
      [makeStatusEffect('REGENERATION', 0, 10)],
      makeStatusEffect('POISON', 0, 10),
    )
    expect(both).toHaveLength(2)
  })

  it('non-periodic effect types have no tick interval', () => {
    expect(statusEffectIntervalTicks(makeStatusEffect('SPEED', 0, 10))).toBe(0)
  })
})
