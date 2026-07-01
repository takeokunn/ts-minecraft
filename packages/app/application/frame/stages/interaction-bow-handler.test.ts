import { describe, it, expect } from 'vitest'
import type { Enchantment } from '@ts-minecraft/inventory/domain/enchantment.types'
import { getPowerDamageMultiplier } from '@ts-minecraft/inventory/domain/enchantment'
import { computeBowDamage, computeBowCharge } from '@ts-minecraft/entity/domain/bow-resolution'
import { resolveBowEnchantments, resolveBowDamage } from './interaction-bow-handler'

const ench = (type: Enchantment['type'], level: Enchantment['level']): Enchantment => ({ type, level })

describe('resolveBowEnchantments', () => {
  it('returns defaults with an empty enchantment list', () => {
    const result = resolveBowEnchantments([])
    expect(result.hasPower).toBeUndefined()
    expect(result.hasInfinity).toBe(false)
    expect(result.hasLooting).toBeUndefined()
    expect(result.hasPunch).toBeUndefined()
    expect(result.bowUnbreaking).toBeUndefined()
  })

  it('detects POWER with its level', () => {
    const result = resolveBowEnchantments([ench('POWER', 3)])
    expect(result.hasPower).toEqual({ type: 'POWER', level: 3 })
    expect(result.hasInfinity).toBe(false)
  })

  it('detects INFINITY flag', () => {
    const result = resolveBowEnchantments([ench('INFINITY', 1)])
    expect(result.hasInfinity).toBe(true)
    expect(result.hasPower).toBeUndefined()
  })

  it('detects LOOTING with its level', () => {
    const result = resolveBowEnchantments([ench('LOOTING', 2)])
    expect(result.hasLooting).toEqual({ type: 'LOOTING', level: 2 })
  })

  it('detects PUNCH with its level', () => {
    const result = resolveBowEnchantments([ench('PUNCH', 1)])
    expect(result.hasPunch).toEqual({ type: 'PUNCH', level: 1 })
  })

  it('detects UNBREAKING for bow durability', () => {
    const result = resolveBowEnchantments([ench('UNBREAKING', 3)])
    expect(result.bowUnbreaking).toEqual({ type: 'UNBREAKING', level: 3 })
  })

  it('detects all bow enchantments simultaneously', () => {
    const result = resolveBowEnchantments([
      ench('POWER', 5),
      ench('INFINITY', 1),
      ench('LOOTING', 3),
      ench('PUNCH', 2),
      ench('UNBREAKING', 3),
    ])
    expect(result.hasPower).toEqual({ type: 'POWER', level: 5 })
    expect(result.hasInfinity).toBe(true)
    expect(result.hasLooting).toEqual({ type: 'LOOTING', level: 3 })
    expect(result.hasPunch).toEqual({ type: 'PUNCH', level: 2 })
    expect(result.bowUnbreaking).toEqual({ type: 'UNBREAKING', level: 3 })
  })

  it('ignores irrelevant enchantments', () => {
    const result = resolveBowEnchantments([ench('SHARPNESS', 5), ench('PROTECTION', 4)])
    expect(result.hasPower).toBeUndefined()
    expect(result.hasInfinity).toBe(false)
  })
})

describe('resolveBowDamage', () => {
  it('returns rounded base damage at full charge with no POWER', () => {
    const charge = computeBowCharge(10)
    const baseDamage = computeBowDamage(charge)
    expect(resolveBowDamage(charge, undefined)).toBe(baseDamage)
  })

  it('multiplies by POWER multiplier and rounds', () => {
    const charge = 1.0
    const baseDamage = computeBowDamage(charge)
    const powerLevel = 3
    const multiplier = getPowerDamageMultiplier(powerLevel)
    const expected = Math.round(baseDamage * multiplier)
    expect(resolveBowDamage(charge, ench('POWER', powerLevel))).toBe(expected)
  })

  it('POWER 1 increases damage above base', () => {
    const charge = 1.0
    const base = resolveBowDamage(charge, undefined)
    const powered = resolveBowDamage(charge, ench('POWER', 1))
    expect(powered).toBeGreaterThan(base)
  })

  it('higher POWER levels produce more damage than lower levels', () => {
    const charge = 1.0
    const dmgPower1 = resolveBowDamage(charge, ench('POWER', 1))
    const dmgPower5 = resolveBowDamage(charge, ench('POWER', 5))
    expect(dmgPower5).toBeGreaterThan(dmgPower1)
  })

  it('zero charge produces minimum damage', () => {
    expect(resolveBowDamage(0, undefined)).toBe(computeBowDamage(0))
  })
})
