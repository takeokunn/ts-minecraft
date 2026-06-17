import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { createStack, enchantItem } from '../domain/item-stack'
import {
  computeTotalBlastProtectionReduction,
  computeTotalProtectionReduction,
  computeTotalProjectileProtectionReduction,
} from '../domain/armor-protection'
import type { InventoryItem } from '@ts-minecraft/core'

const armor = (
  itemType: InventoryItem,
  enchantmentType: 'PROTECTION' | 'PROJECTILE_PROTECTION' | 'BLAST_PROTECTION',
  level: 1 | 2 | 3 | 4,
) =>
  enchantItem(createStack(itemType, 1), {
    type: enchantmentType,
    level,
  })

describe('domain/armor-protection', () => {
  it('returns 0 when no matching enchantments are present', () => {
    const worn = [createStack('IRON_HELMET'), createStack('IRON_CHESTPLATE')]
    expect(computeTotalProtectionReduction(worn)).toBe(0)
  })

  it('sums matching protection enchantments and ignores mismatched ones', () => {
    const worn = [
      armor('IRON_HELMET', 'PROTECTION', 2),
      armor('IRON_CHESTPLATE', 'BLAST_PROTECTION', 4),
      armor('IRON_LEGGINGS', 'PROTECTION', 1),
    ]
    expect(computeTotalProtectionReduction(worn)).toBeCloseTo(0.12)
  })

  it('caps total protection reduction at 0.64', () => {
    const worn = [
      armor('DIAMOND_HELMET', 'PROTECTION', 4),
      armor('DIAMOND_CHESTPLATE', 'PROTECTION', 4),
      armor('DIAMOND_LEGGINGS', 'PROTECTION', 4),
      armor('DIAMOND_BOOTS', 'PROTECTION', 4),
    ]
    expect(computeTotalProtectionReduction(worn)).toBeCloseTo(0.64)
  })

  it('uses the projectile protection curve', () => {
    const worn = [armor('IRON_HELMET', 'PROJECTILE_PROTECTION', 4)]
    expect(computeTotalProjectileProtectionReduction(worn)).toBeCloseTo(0.32)
  })

  it('uses the blast protection curve and caps at 0.64', () => {
    const worn = [
      armor('DIAMOND_HELMET', 'BLAST_PROTECTION', 4),
      armor('DIAMOND_CHESTPLATE', 'BLAST_PROTECTION', 4),
      armor('DIAMOND_LEGGINGS', 'BLAST_PROTECTION', 4),
      armor('DIAMOND_BOOTS', 'BLAST_PROTECTION', 4),
    ]
    expect(computeTotalBlastProtectionReduction(worn)).toBeCloseTo(0.64)
  })
})
