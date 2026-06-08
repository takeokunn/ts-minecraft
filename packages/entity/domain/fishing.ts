import type { ItemType } from '@ts-minecraft/core'
import {
  type WeightedEntry,
  FISH_ENTRIES,
  TREASURE_ENTRIES,
  JUNK_ENTRIES,
  FISHING_MIN_WAIT_SECS,
  FISHING_MAX_WAIT_SECS,
} from './fishing.config'

// Re-export config data and types so callers can import from one location.
export type { FishingCategory, WeightedEntry } from './fishing.config'
export {
  FISH_ENTRIES,
  TREASURE_ENTRIES,
  JUNK_ENTRIES,
  FISHING_MIN_WAIT_SECS,
  FISHING_MAX_WAIT_SECS,
} from './fishing.config'

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
