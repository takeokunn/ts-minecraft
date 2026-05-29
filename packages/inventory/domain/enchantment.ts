import { Option } from 'effect'
import type { ItemType } from '@ts-minecraft/kernel'

// ─── Enchantment types (vanilla subset) ────────────────────────────────────

export type EnchantmentType =
  | 'SHARPNESS'           // +damage to all mobs
  | 'SMITE'              // +damage to undead (Zombie, Skeleton)
  | 'BANE_OF_ARTHROPODS' // +damage to spiders
  | 'PROTECTION'         // reduces incoming damage
  | 'PROJECTILE_PROTECTION'
  | 'FIRE_PROTECTION'
  | 'BLAST_PROTECTION'
  | 'EFFICIENCY'         // faster block breaking
  | 'FORTUNE'            // extra drops from ores
  | 'SILK_TOUCH'         // drops block itself instead of resource
  | 'UNBREAKING'         // chance to not consume durability
  | 'LOOTING'            // extra drops from mobs
  | 'INFINITY'           // bow doesn't consume arrows

export type EnchantmentLevel = 1 | 2 | 3 | 4 | 5

export type Enchantment = {
  readonly type: EnchantmentType
  readonly level: EnchantmentLevel
}

// ─── Validity ────────────────────────────────────────────────────────────────

const MAX_LEVEL: Record<EnchantmentType, EnchantmentLevel> = {
  SHARPNESS: 5,
  SMITE: 5,
  BANE_OF_ARTHROPODS: 5,
  PROTECTION: 4,
  PROJECTILE_PROTECTION: 4,
  FIRE_PROTECTION: 4,
  BLAST_PROTECTION: 4,
  EFFICIENCY: 5,
  FORTUNE: 3,
  SILK_TOUCH: 1,
  UNBREAKING: 3,
  LOOTING: 3,
  INFINITY: 1,
}

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

// BaneOfArthropods applies to Spider. +2.5 per level.
export const getBaneOfArthropodsDamageBonus = (level: EnchantmentLevel): number =>
  2.5 * level

// ─── Defence bonus ───────────────────────────────────────────────────────────

// Protection reduces damage. Each level reduces by 4% (stacks multiplicatively in vanilla;
// we simplify to additive, capped at 64% across all pieces).
export const getProtectionDamageReduction = (level: EnchantmentLevel): number =>
  0.04 * level

// ─── Utility bonuses ─────────────────────────────────────────────────────────

// Unbreaking: probability that a durability point is NOT consumed on each use.
export const getUnbreakingSkipChance = (level: EnchantmentLevel): number =>
  1 - 1 / (level + 1)

// Fortune: bonus multiplier on ore drops. Level 1 = 1.33×, 2 = 1.75×, 3 = 2.5×.
const FORTUNE_MULTIPLIERS: Record<EnchantmentLevel, number> = { 1: 1.33, 2: 1.75, 3: 2.5, 4: 2.5, 5: 2.5 }
export const getFortuneDropMultiplier = (level: EnchantmentLevel): number =>
  FORTUNE_MULTIPLIERS[level]

// ─── Applicable items ────────────────────────────────────────────────────────

// Which item types may carry each enchantment. Used by the enchanting service
// to validate requests.
const APPLICABLE_TO: Partial<Record<EnchantmentType, ReadonlySet<ItemType>>> = {
  SHARPNESS: new Set(['WOODEN_SWORD', 'STONE_SWORD', 'IRON_SWORD', 'DIAMOND_SWORD',
    'WOODEN_AXE', 'STONE_AXE', 'IRON_AXE', 'DIAMOND_AXE']),
  SMITE: new Set(['WOODEN_SWORD', 'STONE_SWORD', 'IRON_SWORD', 'DIAMOND_SWORD']),
  BANE_OF_ARTHROPODS: new Set(['WOODEN_SWORD', 'STONE_SWORD', 'IRON_SWORD', 'DIAMOND_SWORD']),
  PROTECTION: new Set(['LEATHER_HELMET', 'LEATHER_CHESTPLATE', 'LEATHER_LEGGINGS', 'LEATHER_BOOTS',
    'IRON_HELMET', 'IRON_CHESTPLATE', 'IRON_LEGGINGS', 'IRON_BOOTS',
    'DIAMOND_HELMET', 'DIAMOND_CHESTPLATE', 'DIAMOND_LEGGINGS', 'DIAMOND_BOOTS']),
  EFFICIENCY: new Set(['WOODEN_PICKAXE', 'STONE_PICKAXE', 'IRON_PICKAXE', 'DIAMOND_PICKAXE',
    'WOODEN_AXE', 'STONE_AXE', 'IRON_AXE', 'DIAMOND_AXE',
    'WOODEN_HOE', 'STONE_HOE', 'IRON_HOE', 'DIAMOND_HOE']),
  FORTUNE: new Set(['WOODEN_PICKAXE', 'STONE_PICKAXE', 'IRON_PICKAXE', 'DIAMOND_PICKAXE']),
  UNBREAKING: new Set(['WOODEN_SWORD', 'STONE_SWORD', 'IRON_SWORD', 'DIAMOND_SWORD',
    'WOODEN_PICKAXE', 'STONE_PICKAXE', 'IRON_PICKAXE', 'DIAMOND_PICKAXE',
    'WOODEN_AXE', 'STONE_AXE', 'IRON_AXE', 'DIAMOND_AXE',
    'LEATHER_HELMET', 'IRON_HELMET', 'DIAMOND_HELMET',
    'BOW', 'FISHING_ROD', 'SHIELD']),
  LOOTING: new Set(['WOODEN_SWORD', 'STONE_SWORD', 'IRON_SWORD', 'DIAMOND_SWORD']),
  INFINITY: new Set(['BOW']),
}

export const canEnchantItem = (item: ItemType, enchantment: EnchantmentType): boolean =>
  Option.getOrElse(
    Option.map(Option.fromNullable(APPLICABLE_TO[enchantment]), (set) => set.has(item)),
    () => false,
  )
