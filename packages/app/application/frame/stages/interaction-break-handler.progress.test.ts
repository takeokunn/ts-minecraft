import { describe, it, expect } from 'vitest'
import type { Enchantment } from '@ts-minecraft/inventory/domain/enchantment.types'
import { resolveBreakModifiers, resolveEffectiveBreakTicks } from './interaction-break-handler.progress'

const ench = (type: Enchantment['type'], level: Enchantment['level']): Enchantment => ({ type, level })

describe('resolveBreakModifiers', () => {
  it('returns defaults when enchantment arrays are empty', () => {
    const result = resolveBreakModifiers([], [])
    expect(result.hasSilkTouch).toBe(false)
    expect(result.efficiencyEnchant).toBeUndefined()
    expect(result.hasAquaAffinity).toBe(false)
  })

  it('detects SILK_TOUCH on the tool', () => {
    const result = resolveBreakModifiers([ench('SILK_TOUCH', 1)], [])
    expect(result.hasSilkTouch).toBe(true)
    expect(result.efficiencyEnchant).toBeUndefined()
  })

  it('captures EFFICIENCY enchantment with its level', () => {
    const result = resolveBreakModifiers([ench('EFFICIENCY', 3)], [])
    expect(result.hasSilkTouch).toBe(false)
    expect(result.efficiencyEnchant).toEqual({ type: 'EFFICIENCY', level: 3 })
  })

  it('captures both SILK_TOUCH and EFFICIENCY when both are present', () => {
    const result = resolveBreakModifiers([ench('EFFICIENCY', 5), ench('SILK_TOUCH', 1)], [])
    expect(result.hasSilkTouch).toBe(true)
    expect(result.efficiencyEnchant).toEqual({ type: 'EFFICIENCY', level: 5 })
  })

  it('detects AQUA_AFFINITY on the helmet', () => {
    const result = resolveBreakModifiers([], [ench('AQUA_AFFINITY', 1)])
    expect(result.hasAquaAffinity).toBe(true)
    expect(result.hasSilkTouch).toBe(false)
    expect(result.efficiencyEnchant).toBeUndefined()
  })

  it('does not mistake helmet enchantments for tool enchantments', () => {
    const result = resolveBreakModifiers([ench('RESPIRATION', 2)], [ench('EFFICIENCY', 3)])
    expect(result.efficiencyEnchant).toBeUndefined()
    expect(result.hasAquaAffinity).toBe(false)
  })

  it('ignores unrelated tool enchantments (FORTUNE does not affect break modifiers)', () => {
    const result = resolveBreakModifiers([ench('FORTUNE', 3)], [])
    expect(result.hasSilkTouch).toBe(false)
    expect(result.efficiencyEnchant).toBeUndefined()
  })

  it('takes the last EFFICIENCY when multiple are present (loop override)', () => {
    const result = resolveBreakModifiers([ench('EFFICIENCY', 1), ench('EFFICIENCY', 4)], [])
    expect(result.efficiencyEnchant?.level).toBe(4)
  })
})

describe('resolveEffectiveBreakTicks', () => {
  it('returns base ticks when not underwater', () => {
    expect(resolveEffectiveBreakTicks(10, false, false)).toBe(10)
    expect(resolveEffectiveBreakTicks(10, false, true)).toBe(10)
  })

  it('multiplies by 5 when underwater without AQUA_AFFINITY', () => {
    expect(resolveEffectiveBreakTicks(10, true, false)).toBe(50)
  })

  it('returns base ticks underwater when AQUA_AFFINITY is present', () => {
    expect(resolveEffectiveBreakTicks(10, true, true)).toBe(10)
  })

  it('preserves fractional ticks', () => {
    expect(resolveEffectiveBreakTicks(7, true, false)).toBe(35)
    expect(resolveEffectiveBreakTicks(3.5, true, false)).toBe(17.5)
  })

  it('handles zero base ticks', () => {
    expect(resolveEffectiveBreakTicks(0, true, false)).toBe(0)
  })
})
