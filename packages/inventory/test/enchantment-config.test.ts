import { describe, it, expect } from 'vitest'
import {
  MAX_LEVEL,
  FORTUNE_MULTIPLIERS,
  APPLICABLE_TO,
} from '../domain/enchantment.config'
import { ENCHANTMENT_TYPES } from '../domain/enchantment.types'

describe('MAX_LEVEL', () => {
  it('has entries for all enchantment types', () => {
    for (const enchantment of ENCHANTMENT_TYPES) {
      expect(MAX_LEVEL[enchantment]).toBeDefined()
    }
  })

  it('SILK_TOUCH has max level 1 (cannot be leveled up)', () => {
    expect(MAX_LEVEL['SILK_TOUCH']).toBe(1)
  })

  it('AQUA_AFFINITY has max level 1', () => {
    expect(MAX_LEVEL['AQUA_AFFINITY']).toBe(1)
  })

  it('DEPTH_STRIDER has max level 3', () => {
    expect(MAX_LEVEL['DEPTH_STRIDER']).toBe(3)
  })

  it('FIRE_ASPECT has max level 2', () => {
    expect(MAX_LEVEL['FIRE_ASPECT']).toBe(2)
  })

  it('most sword/tool enchantments have max level >= 2', () => {
    expect(MAX_LEVEL['SHARPNESS']).toBe(5)
    expect(MAX_LEVEL['EFFICIENCY']).toBe(5)
    expect(MAX_LEVEL['PROTECTION']).toBe(4)
    expect(MAX_LEVEL['UNBREAKING']).toBe(3)
  })

  it('all max levels are positive integers', () => {
    for (const [, level] of Object.entries(MAX_LEVEL)) {
      expect(Number.isInteger(level)).toBe(true)
      expect(level).toBeGreaterThan(0)
    }
  })
})

describe('FORTUNE_MULTIPLIERS', () => {
  it('has increasing multipliers for levels 1-3', () => {
    expect(FORTUNE_MULTIPLIERS[1]).toBeLessThan(FORTUNE_MULTIPLIERS[2])
    expect(FORTUNE_MULTIPLIERS[2]).toBeLessThan(FORTUNE_MULTIPLIERS[3])
  })

  it('level 1 multiplier is > 1 (more drops)', () => {
    expect(FORTUNE_MULTIPLIERS[1]).toBeGreaterThan(1)
  })

  it('level 3 multiplier is approximately 2.5 (vanilla Java Edition)', () => {
    expect(FORTUNE_MULTIPLIERS[3]).toBeCloseTo(2.5, 1)
  })
})

describe('APPLICABLE_TO', () => {
  it('SHARPNESS applies to swords', () => {
    expect(APPLICABLE_TO['SHARPNESS'].has('IRON_SWORD')).toBe(true)
    expect(APPLICABLE_TO['SHARPNESS'].has('DIAMOND_SWORD')).toBe(true)
  })

  it('FORTUNE applies to pickaxes', () => {
    expect(APPLICABLE_TO['FORTUNE'].has('IRON_PICKAXE')).toBe(true)
    expect(APPLICABLE_TO['FORTUNE'].has('DIAMOND_PICKAXE')).toBe(true)
  })

  it('SILK_TOUCH applies to pickaxes', () => {
    expect(APPLICABLE_TO['SILK_TOUCH'].has('IRON_PICKAXE')).toBe(true)
  })

  it('FEATHER_FALLING only applies to boots', () => {
    const items = Array.from(APPLICABLE_TO['FEATHER_FALLING'])
    expect(items.every(item => item.endsWith('BOOTS'))).toBe(true)
  })

  it('AQUA_AFFINITY only applies to helmets', () => {
    const items = Array.from(APPLICABLE_TO['AQUA_AFFINITY'])
    expect(items.every(item => item.endsWith('HELMET'))).toBe(true)
    expect(APPLICABLE_TO['AQUA_AFFINITY'].has('DIAMOND_HELMET')).toBe(true)
  })

  it('DEPTH_STRIDER only applies to boots', () => {
    const items = Array.from(APPLICABLE_TO['DEPTH_STRIDER'])
    expect(items.every(item => item.endsWith('BOOTS'))).toBe(true)
    expect(APPLICABLE_TO['DEPTH_STRIDER'].has('DIAMOND_BOOTS')).toBe(true)
  })

  it('bow-specific enchantments only apply to bow', () => {
    expect(APPLICABLE_TO['INFINITY'].has('BOW')).toBe(true)
    expect(APPLICABLE_TO['POWER'].has('BOW')).toBe(true)
    expect(APPLICABLE_TO['INFINITY'].has('IRON_SWORD')).toBe(false)
  })

  it('FIRE_ASPECT applies only to swords', () => {
    const items = Array.from(APPLICABLE_TO['FIRE_ASPECT'])
    expect(items.every(item => item.endsWith('SWORD'))).toBe(true)
    expect(APPLICABLE_TO['FIRE_ASPECT'].has('DIAMOND_SWORD')).toBe(true)
    expect(APPLICABLE_TO['FIRE_ASPECT'].has('DIAMOND_AXE')).toBe(false)
  })

  it('PROTECTION applies to all armor pieces', () => {
    const armorItems = [
      'LEATHER_HELMET', 'IRON_HELMET', 'GOLD_HELMET', 'DIAMOND_HELMET',
      'LEATHER_CHESTPLATE', 'IRON_CHESTPLATE', 'GOLD_CHESTPLATE', 'DIAMOND_CHESTPLATE',
    ]
    for (const item of armorItems) {
      expect(APPLICABLE_TO['PROTECTION'].has(item)).toBe(true)
    }
  })
})
