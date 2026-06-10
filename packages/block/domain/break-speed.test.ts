import { describe, expect, it } from 'vitest'
import { Option } from 'effect'
import { getBlockHardness, computeBreakTicks } from './break-speed'

describe('getBlockHardness', () => {
  it('returns 0 for AIR (instant-break)', () => {
    expect(getBlockHardness('AIR')).toBe(0)
  })

  it('returns 8 for DIRT', () => {
    expect(getBlockHardness('DIRT')).toBe(8)
  })

  it('returns 25 for STONE', () => {
    expect(getBlockHardness('STONE')).toBe(25)
  })

  it('returns 0 for unknown block types', () => {
    expect(getBlockHardness('DEFINITELY_NOT_A_BLOCK')).toBe(0)
  })
})

describe('computeBreakTicks', () => {
  it('returns 0 for hardness 0 (instant-break blocks)', () => {
    expect(computeBreakTicks(0, Option.none())).toBe(0)
  })

  it('returns 0 for negative hardness', () => {
    expect(computeBreakTicks(-1, Option.none())).toBe(0)
  })

  it('returns ceil(hardness * 3) with no tool', () => {
    // dirt: hardness=8 → ceil(24/1) = 24 ticks at 60fps ≈ 0.4s
    expect(computeBreakTicks(8, Option.none())).toBe(24)
    // stone: hardness=25 → ceil(75/1) = 75 ticks ≈ 1.25s
    expect(computeBreakTicks(25, Option.none())).toBe(75)
  })

  it('applies wooden tool speed multiplier (×2)', () => {
    expect(computeBreakTicks(25, Option.some('WOODEN_PICKAXE'))).toBe(38)  // ceil(75/2)
    expect(computeBreakTicks(8, Option.some('WOODEN_SHOVEL'))).toBe(12)   // ceil(24/2)
    expect(computeBreakTicks(10, Option.some('WOODEN_AXE'))).toBe(15)     // ceil(30/2)
  })

  it('applies stone tool speed multiplier (×4)', () => {
    expect(computeBreakTicks(25, Option.some('STONE_PICKAXE'))).toBe(19)  // ceil(75/4)
  })

  it('applies iron tool speed multiplier (×6)', () => {
    expect(computeBreakTicks(25, Option.some('IRON_PICKAXE'))).toBe(13)   // ceil(75/6)
    expect(computeBreakTicks(8, Option.some('IRON_SHOVEL'))).toBe(4)      // ceil(24/6)
  })

  it('applies diamond tool speed multiplier (×8)', () => {
    expect(computeBreakTicks(25, Option.some('DIAMOND_PICKAXE'))).toBe(10) // ceil(75/8)
    expect(computeBreakTicks(8, Option.some('DIAMOND_SHOVEL'))).toBe(3)    // ceil(24/8)
    expect(computeBreakTicks(35, Option.some('DIAMOND_AXE'))).toBe(14)     // ceil(105/8)
  })

  it('falls back to 1× multiplier for non-tool items', () => {
    expect(computeBreakTicks(25, Option.some('STONE'))).toBe(75)
    expect(computeBreakTicks(25, Option.some('APPLE'))).toBe(75)
  })

  it('rounds up fractional ticks', () => {
    expect(computeBreakTicks(1, Option.none())).toBe(3)  // ceil(3/1) = 3
    expect(computeBreakTicks(1, Option.some('STONE_PICKAXE'))).toBe(1)  // ceil(3/4) = 1
  })

  it('EFFICIENCY I adds level²+1=2 to speed multiplier', () => {
    // iron pickaxe base=6, EFFICIENCY I: 6+2=8 → ceil(75/8) = 10 (same as diamond pickaxe base)
    expect(computeBreakTicks(25, Option.some('IRON_PICKAXE'), 1)).toBe(10)
  })

  it('EFFICIENCY V adds level²+1=26 to speed multiplier', () => {
    // iron pickaxe base=6, EFFICIENCY V: 6+26=32 → ceil(75/32) = 3
    expect(computeBreakTicks(25, Option.some('IRON_PICKAXE'), 5)).toBe(3)
    // no tool + EFFICIENCY V: 1+26=27 → ceil(75/27) = 3
    expect(computeBreakTicks(25, Option.none(), 5)).toBe(3)
  })

  it('EFFICIENCY without a tool still adds speed bonus', () => {
    // EFFICIENCY I, no tool: 1+2=3 → ceil(24/3) = 8
    expect(computeBreakTicks(8, Option.none(), 1)).toBe(8)
  })

  it('omitting efficiencyLevel behaves same as before', () => {
    // Backward-compat: undefined efficiencyLevel must match the original formula
    expect(computeBreakTicks(25, Option.some('DIAMOND_PICKAXE'))).toBe(10)
    expect(computeBreakTicks(25, Option.none())).toBe(75)
  })
})
