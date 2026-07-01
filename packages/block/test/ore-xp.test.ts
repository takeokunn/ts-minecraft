import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import {
  isOreXpBlock,
  getOreXpDrop,
  getOreXpDropOption,
} from '../domain/blocks.config.ores'

// ─── isOreXpBlock ─────────────────────────────────────────────────────────────

describe('isOreXpBlock', () => {
  it('returns true for COAL_ORE', () => {
    expect(isOreXpBlock('COAL_ORE')).toBe(true)
  })

  it('returns true for DIAMOND_ORE', () => {
    expect(isOreXpBlock('DIAMOND_ORE')).toBe(true)
  })

  it('returns true for deepslate variants', () => {
    expect(isOreXpBlock('DEEPSLATE_DIAMOND_ORE')).toBe(true)
    expect(isOreXpBlock('DEEPSLATE_COAL_ORE')).toBe(true)
  })

  it('returns false for non-ore blocks', () => {
    expect(isOreXpBlock('STONE')).toBe(false)
    expect(isOreXpBlock('DIRT')).toBe(false)
    expect(isOreXpBlock('AIR')).toBe(false)
  })
})

// ─── getOreXpDrop ─────────────────────────────────────────────────────────────

describe('getOreXpDrop', () => {
  it('returns 5 for COAL_ORE', () => {
    expect(getOreXpDrop('COAL_ORE')).toBe(5)
  })

  it('returns 7 for DIAMOND_ORE', () => {
    expect(getOreXpDrop('DIAMOND_ORE')).toBe(7)
  })

  it('returns 0 for IRON_ORE (XP comes from smelting)', () => {
    expect(getOreXpDrop('IRON_ORE')).toBe(0)
  })

  it('returns 0 for GOLD_ORE', () => {
    expect(getOreXpDrop('GOLD_ORE')).toBe(0)
  })

  it('normal and deepslate variants of the same ore have equal XP', () => {
    expect(getOreXpDrop('COAL_ORE')).toBe(getOreXpDrop('DEEPSLATE_COAL_ORE'))
    expect(getOreXpDrop('DIAMOND_ORE')).toBe(getOreXpDrop('DEEPSLATE_DIAMOND_ORE'))
  })
})

// ─── getOreXpDropOption ───────────────────────────────────────────────────────

describe('getOreXpDropOption', () => {
  it('returns Some(value) for an ore block', () => {
    expect(Option.isSome(getOreXpDropOption('COAL_ORE'))).toBe(true)
    expect(Option.getOrNull(getOreXpDropOption('COAL_ORE'))).toBe(5)
  })

  it('returns None for a non-ore block', () => {
    expect(Option.isNone(getOreXpDropOption('STONE'))).toBe(true)
    expect(Option.isNone(getOreXpDropOption('AIR'))).toBe(true)
  })
})
