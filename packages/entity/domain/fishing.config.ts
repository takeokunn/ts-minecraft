import type { ItemType } from '@ts-minecraft/core'

// Fishing loot table — vanilla Java Edition catch categories.
// Fish: 60%, Treasure: 5%, Junk: 35% (simplified from vanilla).
//
// Each category has weighted entries; a deterministic hash seed picks
// the outcome so the service is pure and testable.

export type FishingCategory = 'fish' | 'treasure' | 'junk'

export type WeightedEntry = { readonly item: ItemType; readonly weight: number }

export const FISH_ENTRIES: ReadonlyArray<WeightedEntry> = [
  { item: 'RAW_COD', weight: 60 },
  { item: 'RAW_SALMON', weight: 25 },
  { item: 'TROPICAL_FISH', weight: 10 },
  { item: 'PUFFERFISH', weight: 5 },
]

export const TREASURE_ENTRIES: ReadonlyArray<WeightedEntry> = [
  { item: 'BOW', weight: 20 },
  { item: 'FISHING_ROD', weight: 15 },
  { item: 'EMERALD', weight: 15 },
  { item: 'DIAMOND', weight: 10 },
  { item: 'GOLD_INGOT', weight: 20 },
  { item: 'IRON_INGOT', weight: 20 },
]

export const JUNK_ENTRIES: ReadonlyArray<WeightedEntry> = [
  { item: 'BONE', weight: 30 },
  { item: 'STRING', weight: 25 },
  { item: 'STICKS', weight: 20 },
  { item: 'LEATHER', weight: 15 },
  { item: 'COAL', weight: 10 },
]

// Min and max wait time in seconds before a bite (vanilla: 5-30 s without lure).
export const FISHING_MIN_WAIT_SECS = 5
export const FISHING_MAX_WAIT_SECS = 30
