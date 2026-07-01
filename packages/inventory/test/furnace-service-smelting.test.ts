import { describe, expect, it } from 'vitest'
import {
  FURNACE_FUEL_BURN_DURATION_SECS,
  FURNACE_FUEL_ITEMS,
  type FurnaceFuelItem,
} from '../application/furnace-service.config'
import { getFuelBurnDurationSecs } from '../application/furnace-service-smelting'

// ─── getFuelBurnDurationSecs ──────────────────────────────────────────────────
describe('getFuelBurnDurationSecs', () => {
  it('returns the correct burn duration for COAL (80s)', () => {
    expect(getFuelBurnDurationSecs('COAL')).toBe(80)
  })

  it('returns the correct burn duration for STICKS (5s)', () => {
    expect(getFuelBurnDurationSecs('STICKS')).toBe(5)
  })

  it('returns the correct burn duration for BOW (15s)', () => {
    expect(getFuelBurnDurationSecs('BOW')).toBe(15)
  })

  it('matches the config record for every fuel item', () => {
    for (const fuel of FURNACE_FUEL_ITEMS) {
      expect(getFuelBurnDurationSecs(fuel as FurnaceFuelItem)).toBe(FURNACE_FUEL_BURN_DURATION_SECS[fuel as FurnaceFuelItem])
    }
  })

  it('COAL and CHARCOAL have equal burn duration', () => {
    expect(getFuelBurnDurationSecs('COAL')).toBe(getFuelBurnDurationSecs('CHARCOAL'))
  })

  it('STICKS have the shortest burn duration', () => {
    const sticksBurn = getFuelBurnDurationSecs('STICKS')
    for (const fuel of FURNACE_FUEL_ITEMS) {
      expect(getFuelBurnDurationSecs(fuel as FurnaceFuelItem)).toBeGreaterThanOrEqual(sticksBurn)
    }
  })
})
