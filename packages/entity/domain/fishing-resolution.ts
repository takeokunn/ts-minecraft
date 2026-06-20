import type { ItemType } from '@ts-minecraft/core'
import {
  type WeightedLootTable,
  type WeightedEntry,
  FISH_ENTRIES,
  TREASURE_ENTRIES,
  JUNK_ENTRIES,
  FISHING_MIN_WAIT_SECS,
  FISHING_MAX_WAIT_SECS,
} from './fishing.config'

const FIXED_JUNK_CHANCE = 0.35
const BASE_TREASURE_CHANCE = 0.05
const TREASURE_CHANCE_PER_LUCK_LEVEL = 0.02
const MAX_TREASURE_CHANCE = 0.65
const PERCENT_SCALE = 100
const FISHING_CATCH_XP_MIN = 1
const FISHING_CATCH_XP_MAX = 6

export type FishingCatch = {
  readonly item: ItemType
  readonly experience: number
}

const normalizeWeightedRoll = (seed: number, totalWeight: number): number =>
  ((seed % totalWeight) + totalWeight) % totalWeight

const hasWeightedEntries = (
  entries: ReadonlyArray<WeightedEntry>,
): entries is WeightedLootTable =>
  entries.length > 0

const pickWeightedEntry = (
  entries: WeightedLootTable,
  roll: number,
  scannedWeight = 0,
): ItemType => {
  const [entry, ...remainingEntries] = entries
  const nextScannedWeight = scannedWeight + entry.weight

  if (roll < nextScannedWeight) return entry.item
  if (!hasWeightedEntries(remainingEntries)) return entry.item

  return pickWeightedEntry(remainingEntries, roll, nextScannedWeight)
}

const pickWeighted = (entries: WeightedLootTable, seed: number): ItemType => {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)
  const roll = normalizeWeightedRoll(seed, totalWeight)
  return pickWeightedEntry(entries, roll)
}

export const resolveFishingCatch = (seed: number, luckLevel = 0): ItemType => {
  const treasureChance = Math.min(
    MAX_TREASURE_CHANCE,
    BASE_TREASURE_CHANCE + TREASURE_CHANCE_PER_LUCK_LEVEL * luckLevel,
  )
  const fishChance = 1 - FIXED_JUNK_CHANCE - treasureChance
  const fishThreshold = Math.round(fishChance * PERCENT_SCALE)
  const treasureThreshold = fishThreshold + Math.round(treasureChance * PERCENT_SCALE)
  const categoryRoll = seed % PERCENT_SCALE
  const lootSeed = Math.floor(seed / PERCENT_SCALE)

  if (categoryRoll < fishThreshold) return pickWeighted(FISH_ENTRIES, lootSeed)
  if (categoryRoll < treasureThreshold) return pickWeighted(TREASURE_ENTRIES, lootSeed)
  return pickWeighted(JUNK_ENTRIES, lootSeed)
}

export const resolveFishingExperience = (seed: number): number => {
  const range = FISHING_CATCH_XP_MAX - FISHING_CATCH_XP_MIN + 1
  return FISHING_CATCH_XP_MIN + normalizeWeightedRoll(seed, range)
}

export const resolveFishingCatchResult = (seed: number, luckLevel = 0): FishingCatch => ({
  item: resolveFishingCatch(seed, luckLevel),
  experience: resolveFishingExperience(seed),
})

export const resolveFishingWaitSecs = (seed: number, lureLevel = 0): number => {
  const range = FISHING_MAX_WAIT_SECS - FISHING_MIN_WAIT_SECS
  const base = FISHING_MIN_WAIT_SECS + (seed % range)
  return Math.max(1, base - 5 * lureLevel)
}
