import type { ItemType } from '@ts-minecraft/core'
import {
  type WeightedEntry,
  FISH_ENTRIES,
  TREASURE_ENTRIES,
  JUNK_ENTRIES,
  FISHING_MIN_WAIT_SECS,
  FISHING_MAX_WAIT_SECS,
} from './fishing.config'

const pickWeighted = (entries: ReadonlyArray<WeightedEntry>, seed: number): ItemType => {
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0)
  let remaining = seed % totalWeight
  for (const entry of entries) {
    remaining -= entry.weight
    if (remaining < 0) return entry.item
  }
  /* c8 ignore next -- unreachable: loop always finds a match when totalWeight > 0 */
  return entries[0]?.item ?? 'RAW_COD'
}

// Returns the caught item given a deterministic seed (e.g. totalXP + frameCount).
// Category probabilities: fish 60%, treasure 5%, junk 35% (LUCK_OF_THE_SEA shifts treasure up by 2%/level).
export const resolveFishingCatch = (seed: number, luckLevel = 0): ItemType => {
  const treasureChance = Math.min(0.65, 0.05 + 0.02 * luckLevel)
  // fish takes the remaining probability after treasure and junk (35% junk is fixed).
  const junkThreshold = Math.round((1 - 0.35 - treasureChance) * 100)
  const treasureThreshold = junkThreshold + Math.round(treasureChance * 100)
  const categoryRoll = seed % 100
  if (categoryRoll < junkThreshold) return pickWeighted(FISH_ENTRIES, Math.floor(seed / 100))
  if (categoryRoll < treasureThreshold) return pickWeighted(TREASURE_ENTRIES, Math.floor(seed / 100))
  return pickWeighted(JUNK_ENTRIES, Math.floor(seed / 100))
}

// Resolves the wait time for a cast given a seed.
// LURE reduces wait by 5s per level (minimum 1 second).
export const resolveFishingWaitSecs = (seed: number, lureLevel = 0): number => {
  const range = FISHING_MAX_WAIT_SECS - FISHING_MIN_WAIT_SECS
  const base = FISHING_MIN_WAIT_SECS + (seed % range)
  return Math.max(1, base - 5 * lureLevel)
}
