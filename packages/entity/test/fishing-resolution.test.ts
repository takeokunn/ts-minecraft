import { describe, expect, it } from 'vitest'
import {
  resolveFishingCatch,
  resolveFishingExperience,
  resolveFishingCatchResult,
  resolveFishingWaitSecs,
} from '@ts-minecraft/entity/domain/fishing-resolution'
import {
  FISHING_MIN_WAIT_SECS,
  FISHING_MAX_WAIT_SECS,
} from '@ts-minecraft/entity/domain/fishing.config'

// ─── resolveFishingCatch ──────────────────────────────────────────────────────
// Fishing category allocation (luck=0):
//   fish      60%  → seeds 0..59 (categoryRoll = seed % 100)
//   treasure   5%  → seeds 60..64
//   junk      35%  → seeds 65..99
describe('resolveFishingCatch', () => {
  it('is deterministic: same seed + luck always returns the same item', () => {
    const a = resolveFishingCatch(42, 0)
    const b = resolveFishingCatch(42, 0)
    expect(a).toBe(b)
  })

  it('seed=0 (fish category) yields a fish item', () => {
    const fishItems = ['RAW_COD', 'RAW_SALMON', 'TROPICAL_FISH', 'PUFFERFISH']
    expect(fishItems).toContain(resolveFishingCatch(0, 0))
  })

  it('seed=64 (treasure category) yields a treasure item', () => {
    const treasureItems = ['BOW', 'FISHING_ROD', 'EMERALD', 'DIAMOND', 'GOLD_INGOT', 'IRON_INGOT']
    expect(treasureItems).toContain(resolveFishingCatch(64, 0))
  })

  it('seed=65 (junk category) yields a junk item', () => {
    const junkItems = ['BONE', 'STRING', 'STICKS', 'LEATHER', 'COAL']
    expect(junkItems).toContain(resolveFishingCatch(65, 0))
  })

  it('higher luck level increases treasure probability (more treasure over a seed range)', () => {
    const countCategory = (luck: number, isTreasure: (item: string) => boolean): number => {
      let count = 0
      for (let seed = 0; seed < 1000; seed++) {
        if (isTreasure(resolveFishingCatch(seed, luck))) count++
      }
      return count
    }
    const treasureItems = new Set(['BOW', 'FISHING_ROD', 'EMERALD', 'DIAMOND', 'GOLD_INGOT', 'IRON_INGOT'])
    const isTreasure = (item: string) => treasureItems.has(item)
    expect(countCategory(3, isTreasure)).toBeGreaterThan(countCategory(0, isTreasure))
  })
})

// ─── resolveFishingExperience ─────────────────────────────────────────────────
describe('resolveFishingExperience', () => {
  it('returns a value in the [1, 6] range', () => {
    for (let seed = 0; seed < 50; seed++) {
      const xp = resolveFishingExperience(seed)
      expect(xp).toBeGreaterThanOrEqual(1)
      expect(xp).toBeLessThanOrEqual(6)
    }
  })

  it('is deterministic for the same seed', () => {
    expect(resolveFishingExperience(123)).toBe(resolveFishingExperience(123))
  })

  it('returns 1 for seed=0 (min XP)', () => {
    // range=6, ((0%6)+6)%6=0 → 1+0=1
    expect(resolveFishingExperience(0)).toBe(1)
  })

  it('returns 6 for seed=5 (max XP)', () => {
    // ((5%6)+6)%6=5 → 1+5=6
    expect(resolveFishingExperience(5)).toBe(6)
  })

  it('cycles over a range of 6 seeds', () => {
    const xpByMod = Array.from({ length: 6 }, (_, i) => resolveFishingExperience(i))
    const unique = new Set(xpByMod)
    expect(unique.size).toBe(6)
  })
})

// ─── resolveFishingCatchResult ────────────────────────────────────────────────
describe('resolveFishingCatchResult', () => {
  it('returns an object with item and experience fields', () => {
    const result = resolveFishingCatchResult(42)
    expect(result).toHaveProperty('item')
    expect(result).toHaveProperty('experience')
  })

  it('is deterministic for the same seed', () => {
    expect(resolveFishingCatchResult(77, 0)).toEqual(resolveFishingCatchResult(77, 0))
  })

  it('item matches what resolveFishingCatch returns for the same seed', () => {
    const result = resolveFishingCatchResult(42, 1)
    expect(result.item).toBe(resolveFishingCatch(42, 1))
  })

  it('experience matches what resolveFishingExperience returns for the same seed', () => {
    const result = resolveFishingCatchResult(42)
    expect(result.experience).toBe(resolveFishingExperience(42))
  })
})

// ─── resolveFishingWaitSecs ───────────────────────────────────────────────────
describe('resolveFishingWaitSecs', () => {
  it('returns a value at least FISHING_MIN_WAIT_SECS for lureLevel=0', () => {
    for (let seed = 0; seed < 30; seed++) {
      expect(resolveFishingWaitSecs(seed, 0)).toBeGreaterThanOrEqual(FISHING_MIN_WAIT_SECS)
    }
  })

  it('returns at most FISHING_MAX_WAIT_SECS for lureLevel=0', () => {
    for (let seed = -50; seed < 80; seed++) {
      expect(resolveFishingWaitSecs(seed, 0)).toBeLessThanOrEqual(FISHING_MAX_WAIT_SECS)
    }
  })

  it('can return the configured maximum wait time', () => {
    expect(resolveFishingWaitSecs(FISHING_MAX_WAIT_SECS - FISHING_MIN_WAIT_SECS, 0)).toBe(FISHING_MAX_WAIT_SECS)
  })

  it('lure enchantment reduces wait time (lureLevel=1 vs 0)', () => {
    // With lure=1, time is reduced by 5s, but clamped to 1
    // seed=10: base = 5 + (10 % 25) = 15; lure=0 → 15; lure=1 → max(1,10) = 10
    expect(resolveFishingWaitSecs(10, 1)).toBeLessThan(resolveFishingWaitSecs(10, 0))
  })

  it('wait time is never less than 1 second (minimum floor)', () => {
    for (let seed = 0; seed < 30; seed++) {
      expect(resolveFishingWaitSecs(seed, 10)).toBeGreaterThanOrEqual(1)
    }
  })

  it('is deterministic for the same seed + lure', () => {
    expect(resolveFishingWaitSecs(17, 2)).toBe(resolveFishingWaitSecs(17, 2))
  })
})
