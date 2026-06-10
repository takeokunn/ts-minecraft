import { Option } from 'effect'
import type { ItemType } from '@ts-minecraft/core'
import { MAX_LEVEL, FORTUNE_MULTIPLIERS, APPLICABLE_TO } from './enchantment.config'
import type { EnchantmentType, EnchantmentLevel, Enchantment } from './enchantment.types'

export type { EnchantmentType, EnchantmentLevel, Enchantment }
export { EnchantmentTypeSchema, EnchantmentLevelSchema, EnchantmentSchema } from './enchantment.types'

// ─── Validity ────────────────────────────────────────────────────────────────

export const getMaxEnchantmentLevel = (type: EnchantmentType): EnchantmentLevel =>
  MAX_LEVEL[type]

// ─── Combat bonuses ──────────────────────────────────────────────────────────

// Additional attack damage per Sharpness level. Vanilla (1.9+): +1 at level 1, then
// +0.5 per level above 1 — i.e. 0.5·level + 0.5. So L1=1, L2=1.5, L3=2, L4=2.5, L5=3.
export const getSharpnessDamageBonus = (level: EnchantmentLevel): number =>
  level === 1 ? 1 : 1 + 0.5 * (level - 1)

// Smite bonus applies to undead mobs (Zombie, Skeleton). +2.5 per level.
export const getSmiteDamageBonus = (level: EnchantmentLevel): number =>
  2.5 * level

// Power enchantment multiplier for bows. Vanilla: damage × (1 + 0.5·level).
// POWER I = ×1.5, II = ×2.0, III = ×2.5, IV = ×3.0, V = ×3.5.
export const getPowerDamageMultiplier = (level: EnchantmentLevel): number =>
  1.0 + 0.5 * level

// BaneOfArthropods applies to Spider. +2.5 per level.
export const getBaneOfArthropodsDamageBonus = (level: EnchantmentLevel): number =>
  2.5 * level

// KNOCKBACK: each level multiplies the horizontal knockback speed by 1.5.
// Vanilla: I=3 blocks, II=6 blocks extra. We model as a scale on the base impulse.
export const getKnockbackHorizontalMultiplier = (level: EnchantmentLevel): number =>
  1 + 0.5 * level

// PUNCH (bow): each level adds 3 blocks of extra horizontal knockback on arrow impact.
export const getPunchKnockbackBonus = (level: EnchantmentLevel): number =>
  3 * level

// ─── Defence bonus ───────────────────────────────────────────────────────────

// Protection reduces damage. Each level reduces by 4% (stacks multiplicatively in vanilla;
// we simplify to additive, capped at 64% across all pieces).
export const getProtectionDamageReduction = (level: EnchantmentLevel): number =>
  0.04 * level

// FEATHER_FALLING: each level reduces fall damage by 12% (vanilla value).
export const getFeatherFallingReduction = (level: EnchantmentLevel): number =>
  0.12 * level

// RESPIRATION: each level adds 15 extra seconds of air supply (vanilla: +15s per level).
export const getRespirationBonusSecs = (level: EnchantmentLevel): number =>
  15 * level

// ─── Utility bonuses ─────────────────────────────────────────────────────────

// Unbreaking: probability that a durability point is NOT consumed on each use.
export const getUnbreakingSkipChance = (level: EnchantmentLevel): number =>
  1 - 1 / (level + 1)

// Fortune: bonus multiplier on ore drops. Level 1 = 1.33×, 2 = 1.75×, 3 = 2.5×.
export const getFortuneDropMultiplier = (level: EnchantmentLevel): number =>
  FORTUNE_MULTIPLIERS[level]

// ─── Applicable items ────────────────────────────────────────────────────────

export const canEnchantItem = (item: ItemType, enchantment: EnchantmentType): boolean =>
  Option.getOrElse(
    Option.map(Option.fromNullable(APPLICABLE_TO[enchantment]), (set) => set.has(item)),
    () => false,
  )

// ─── Enchanting selection ─────────────────────────────────────────────────────

// Reverse map built once at module load: item type → applicable enchantment types.
const ITEM_ENCHANTMENTS: ReadonlyMap<string, ReadonlyArray<EnchantmentType>> = (() => {
  const map = new Map<string, EnchantmentType[]>()
  for (const [etype, items] of Object.entries(APPLICABLE_TO) as Array<[EnchantmentType, ReadonlySet<string>]>) {
    for (const item of items) {
      const existing = map.get(item) ?? []
      existing.push(etype)
      map.set(item, existing)
    }
  }
  return map
})()

// Simple deterministic string hash (djb2-style).
const hashStr = (s: string): number => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) >>> 0
  return h
}

// Returns the enchantment to apply to an item given the current XP level.
// The result is deterministic: same item + same level always picks the same enchantment.
// XP level controls the maximum enchantment level offered (higher XP → stronger enchantments).
// Returns Option.none() if no enchantment applies to the item.
export const selectEnchantment = (itemType: ItemType, xpLevel: number): Option.Option<Enchantment> => {
  const applicable = ITEM_ENCHANTMENTS.get(itemType)
  if (!applicable || applicable.length === 0) return Option.none()
  const enchType = applicable[hashStr(itemType + String(xpLevel)) % applicable.length]!
  const maxForType = MAX_LEVEL[enchType]
  // Scale enchantment level with XP: 1 level per 5 XP levels, capped at the enchantment's max.
  const enchLevel = Math.min(maxForType, Math.max(1, Math.floor(xpLevel / 5))) as EnchantmentLevel
  return Option.some({ type: enchType, level: enchLevel })
}

// XP levels consumed when enchanting at a given enchantment level.
export const enchantXPCost = (enchLevel: EnchantmentLevel): number => enchLevel
