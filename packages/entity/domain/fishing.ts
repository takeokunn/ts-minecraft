import type { ItemType } from '@ts-minecraft/core'

// Fishing loot table — vanilla Java Edition catch categories.
// Fish: 60%, Treasure: 5%, Junk: 35% (simplified from vanilla).
//
// Each category has weighted entries; a deterministic hash seed picks
// the outcome so the service is pure and testable.

export type FishingCategory = 'fish' | 'treasure' | 'junk'

type WeightedEntry = { readonly item: ItemType; readonly weight: number }

const FISH_ENTRIES: ReadonlyArray<WeightedEntry> = [
  { item: 'RAW_COD', weight: 60 },
  { item: 'RAW_SALMON', weight: 25 },
  { item: 'TROPICAL_FISH', weight: 10 },
  { item: 'PUFFERFISH', weight: 5 },
]

const TREASURE_ENTRIES: ReadonlyArray<WeightedEntry> = [
  { item: 'BOW', weight: 20 },
  { item: 'FISHING_ROD', weight: 15 },
  { item: 'EMERALD', weight: 15 },
  { item: 'DIAMOND', weight: 10 },
  { item: 'GOLD_INGOT', weight: 20 },
  { item: 'IRON_INGOT', weight: 20 },
]

const JUNK_ENTRIES: ReadonlyArray<WeightedEntry> = [
  { item: 'BONE', weight: 30 },
  { item: 'STRING', weight: 25 },
  { item: 'STICKS', weight: 20 },
  { item: 'LEATHER', weight: 15 },
  { item: 'COAL', weight: 10 },
]

// Min and max wait time in seconds before a bite (vanilla: 5-30 s without lure).
export const FISHING_MIN_WAIT_SECS = 5
export const FISHING_MAX_WAIT_SECS = 30

const pickWeighted = (entries: ReadonlyArray<WeightedEntry>, seed: number): ItemType => {
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0)
  let remaining = seed % totalWeight
  /* c8 ignore start */
  for (const entry of entries) {
    remaining -= entry.weight
    if (remaining < 0) return entry.item
  }
  return entries[0]?.item ?? 'RAW_COD'
  /* c8 ignore end */
}

// Returns the caught item given a deterministic seed (e.g. totalXP + frameCount).
// Category probabilities: fish 60%, treasure 5%, junk 35%.
export const resolveFishingCatch = (seed: number): ItemType => {
  const categoryRoll = seed % 100
  if (categoryRoll < 60) return pickWeighted(FISH_ENTRIES, Math.floor(seed / 100))
  if (categoryRoll < 65) return pickWeighted(TREASURE_ENTRIES, Math.floor(seed / 100))
  return pickWeighted(JUNK_ENTRIES, Math.floor(seed / 100))
}

// Resolves the wait time for a cast given a seed.
export const resolveFishingWaitSecs = (seed: number): number => {
  const range = FISHING_MAX_WAIT_SECS - FISHING_MIN_WAIT_SECS
  return FISHING_MIN_WAIT_SECS + (seed % range)
}
