import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import {
  isOreXpBlock,
  getOreXpDrop,
  getOreXpDropOption,
} from '@ts-minecraft/block/domain/blocks.config.ores'

// ─── isOreXpBlock ─────────────────────────────────────────────────────────────
describe('isOreXpBlock', () => {
  it('returns true for COAL_ORE', () => {
    expect(isOreXpBlock('COAL_ORE')).toBe(true)
  })

  it('returns true for DIAMOND_ORE', () => {
    expect(isOreXpBlock('DIAMOND_ORE')).toBe(true)
  })

  it('returns true for DEEPSLATE_DIAMOND_ORE', () => {
    expect(isOreXpBlock('DEEPSLATE_DIAMOND_ORE')).toBe(true)
  })

  it('returns true for IRON_ORE (even though it drops 0 XP)', () => {
    expect(isOreXpBlock('IRON_ORE')).toBe(true)
  })

  it('returns false for STONE (not an ore XP block)', () => {
    expect(isOreXpBlock('STONE')).toBe(false)
  })

  it('returns false for DIRT', () => {
    expect(isOreXpBlock('DIRT')).toBe(false)
  })

  it('returns false for IRON_BLOCK (mineral block, not ore)', () => {
    expect(isOreXpBlock('IRON_BLOCK')).toBe(false)
  })
})

// ─── getOreXpDrop ─────────────────────────────────────────────────────────────
describe('getOreXpDrop', () => {
  it('returns 5 for COAL_ORE (vanilla value)', () => {
    expect(getOreXpDrop('COAL_ORE')).toBe(5)
  })

  it('returns 7 for DIAMOND_ORE (highest XP ore)', () => {
    expect(getOreXpDrop('DIAMOND_ORE')).toBe(7)
  })

  it('returns 7 for EMERALD_ORE', () => {
    expect(getOreXpDrop('EMERALD_ORE')).toBe(7)
  })

  it('returns 0 for IRON_ORE (XP deferred to smelting in vanilla)', () => {
    expect(getOreXpDrop('IRON_ORE')).toBe(0)
  })

  it('returns 0 for GOLD_ORE (XP deferred to smelting in vanilla)', () => {
    expect(getOreXpDrop('GOLD_ORE')).toBe(0)
  })

  it('deepslate variants match their regular counterparts in XP drop', () => {
    expect(getOreXpDrop('DEEPSLATE_COAL_ORE')).toBe(getOreXpDrop('COAL_ORE'))
    expect(getOreXpDrop('DEEPSLATE_DIAMOND_ORE')).toBe(getOreXpDrop('DIAMOND_ORE'))
    expect(getOreXpDrop('DEEPSLATE_IRON_ORE')).toBe(getOreXpDrop('IRON_ORE'))
  })
})

// ─── getOreXpDropOption ───────────────────────────────────────────────────────
describe('getOreXpDropOption', () => {
  it('returns None for a non-ore block', () => {
    expect(Option.isNone(getOreXpDropOption('STONE'))).toBe(true)
  })

  it('returns Some for COAL_ORE', () => {
    const result = getOreXpDropOption('COAL_ORE')
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) expect(result.value).toBe(5)
  })

  it('returns Some(0) for IRON_ORE (0 XP is still a valid Some)', () => {
    const result = getOreXpDropOption('IRON_ORE')
    expect(Option.isSome(result)).toBe(true)
    if (Option.isSome(result)) expect(result.value).toBe(0)
  })

  it('returns the same value as getOreXpDrop when isSome', () => {
    const ores = ['COAL_ORE', 'DIAMOND_ORE', 'REDSTONE_ORE', 'LAPIS_ORE'] as const
    for (const ore of ores) {
      const opt = getOreXpDropOption(ore)
      if (Option.isSome(opt)) expect(opt.value).toBe(getOreXpDrop(ore))
    }
  })
})
