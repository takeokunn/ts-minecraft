import { describe, it, expect } from 'vitest'
import type { Enchantment } from '@ts-minecraft/inventory/domain/enchantment.types'
import {
  isNeverDroppedBlock,
  resolveBreakExecutionEnchantments,
  REDSTONE_CLEANUP_BLOCK_TYPES,
} from './interaction-break-handler.shared'

const ench = (type: Enchantment['type'], level: Enchantment['level']): Enchantment => ({ type, level })

describe('isNeverDroppedBlock', () => {
  it('returns true for AIR, WATER, LAVA', () => {
    expect(isNeverDroppedBlock('AIR')).toBe(true)
    expect(isNeverDroppedBlock('WATER')).toBe(true)
    expect(isNeverDroppedBlock('LAVA')).toBe(true)
  })

  it('returns false for solid blocks that drop items', () => {
    expect(isNeverDroppedBlock('STONE')).toBe(false)
    expect(isNeverDroppedBlock('DIRT')).toBe(false)
    expect(isNeverDroppedBlock('DIAMOND_ORE')).toBe(false)
  })
})

describe('REDSTONE_CLEANUP_BLOCK_TYPES', () => {
  it('contains all five redstone component types', () => {
    expect(REDSTONE_CLEANUP_BLOCK_TYPES.has('REDSTONE_WIRE')).toBe(true)
    expect(REDSTONE_CLEANUP_BLOCK_TYPES.has('LEVER')).toBe(true)
    expect(REDSTONE_CLEANUP_BLOCK_TYPES.has('STONE_BUTTON')).toBe(true)
    expect(REDSTONE_CLEANUP_BLOCK_TYPES.has('REDSTONE_TORCH')).toBe(true)
    expect(REDSTONE_CLEANUP_BLOCK_TYPES.has('PRESSURE_PLATE')).toBe(true)
  })

  it('does not contain non-redstone blocks', () => {
    expect(REDSTONE_CLEANUP_BLOCK_TYPES.has('STONE')).toBe(false)
    expect(REDSTONE_CLEANUP_BLOCK_TYPES.has('DIAMOND_ORE')).toBe(false)
  })
})

describe('resolveBreakExecutionEnchantments', () => {
  it('returns undefined for both with an empty list', () => {
    const result = resolveBreakExecutionEnchantments([])
    expect(result.fortune).toBeUndefined()
    expect(result.unbreaking).toBeUndefined()
  })

  it('detects FORTUNE with its level', () => {
    const result = resolveBreakExecutionEnchantments([ench('FORTUNE', 3)])
    expect(result.fortune).toEqual({ type: 'FORTUNE', level: 3 })
    expect(result.unbreaking).toBeUndefined()
  })

  it('detects UNBREAKING with its level', () => {
    const result = resolveBreakExecutionEnchantments([ench('UNBREAKING', 2)])
    expect(result.unbreaking).toEqual({ type: 'UNBREAKING', level: 2 })
    expect(result.fortune).toBeUndefined()
  })

  it('detects both FORTUNE and UNBREAKING simultaneously', () => {
    const result = resolveBreakExecutionEnchantments([ench('FORTUNE', 3), ench('UNBREAKING', 3)])
    expect(result.fortune).toEqual({ type: 'FORTUNE', level: 3 })
    expect(result.unbreaking).toEqual({ type: 'UNBREAKING', level: 3 })
  })

  it('ignores irrelevant enchantments (EFFICIENCY, SILK_TOUCH)', () => {
    const result = resolveBreakExecutionEnchantments([ench('EFFICIENCY', 5), ench('SILK_TOUCH', 1)])
    expect(result.fortune).toBeUndefined()
    expect(result.unbreaking).toBeUndefined()
  })

  it('always resolves UNBREAKING regardless of block type (bug fix: was only resolved for ores)', () => {
    // UNBREAKING must affect non-ore blocks too — verify it is resolved from all tool enchantment lists
    const woodenPickaxe = resolveBreakExecutionEnchantments([ench('UNBREAKING', 3)])
    expect(woodenPickaxe.unbreaking).toBeDefined()
  })
})
