import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr, HashMap, Option } from 'effect'
import { getSlotColor, getSlotImageStyle, collectAvailableCounts } from './inventory-renderer-helpers'
import { DEFAULT_SLOT_COLOR } from './inventory-renderer.config'

describe('getSlotColor', () => {
  it('returns configured color for known block type', () => {
    expect(getSlotColor('GRASS')).toBe('#5a8a3a')
    expect(getSlotColor('STONE')).toBe('#888888')
    expect(getSlotColor('DIAMOND')).toBe('#71e0e0')
    expect(getSlotColor('COAL')).toBe('#262626')
  })

  it('returns default color for unknown block type', () => {
    expect(getSlotColor('BEDROCK' as never)).toBe(DEFAULT_SLOT_COLOR)
  })
})

describe('collectAvailableCounts', () => {
  it('returns empty map for all-none slots', () => {
    const counts = collectAvailableCounts([Option.none(), Option.none()])
    expect(HashMap.size(counts)).toBe(0)
  })

  it('returns empty map for empty slot array', () => {
    const counts = collectAvailableCounts([])
    expect(HashMap.size(counts)).toBe(0)
  })

  it('counts a single block type', () => {
    const slots = [Option.some({ itemType: 'STONE' as const, count: 3 })]
    const counts = collectAvailableCounts(slots)
    expect(Option.getOrElse(HashMap.get(counts, 'STONE'), () => 0)).toBe(3)
  })

  it('accumulates counts for the same block type across slots', () => {
    const slots = [
      Option.some({ itemType: 'STONE' as const, count: 3 }),
      Option.none(),
      Option.some({ itemType: 'STONE' as const, count: 2 }),
    ]
    const counts = collectAvailableCounts(slots)
    expect(Option.getOrElse(HashMap.get(counts, 'STONE'), () => 0)).toBe(5)
  })

  it('tracks multiple distinct block types independently', () => {
    const slots = [
      Option.some({ itemType: 'STONE' as const, count: 5 }),
      Option.some({ itemType: 'DIRT' as const, count: 10 }),
      Option.none(),
      Option.some({ itemType: 'STONE' as const, count: 1 }),
    ]
    const counts = collectAvailableCounts(slots)
    expect(Option.getOrElse(HashMap.get(counts, 'STONE'), () => 0)).toBe(6)
    expect(Option.getOrElse(HashMap.get(counts, 'DIRT'), () => 0)).toBe(10)
    expect(HashMap.size(counts)).toBe(2)
  })

  it('skips None slots without affecting counts', () => {
    const slots = Arr.makeBy(5, () => Option.none<{ itemType: 'AIR'; count: number }>())
    const counts = collectAvailableCounts(slots)
    expect(HashMap.size(counts)).toBe(0)
  })
})

describe('getSlotImageStyle', () => {
  it('returns null for AIR (no texture icon)', () => {
    expect(getSlotImageStyle('AIR')).toBeNull()
  })

  it('returns url style for inventory-only items', () => {
    const style = getSlotImageStyle('STICKS')
    expect(style).toContain("url('/textures/tile-48-item-sticks.png')")
  })
})
