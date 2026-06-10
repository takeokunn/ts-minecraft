import type { ItemType } from '@ts-minecraft/core'
import type { EnchantmentLevel, EnchantmentType } from './enchantment.types'

// ─── Validity ────────────────────────────────────────────────────────────────

export const MAX_LEVEL: Record<EnchantmentType, EnchantmentLevel> = {
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
  POWER: 5,
}

// ─── Fortune multipliers ─────────────────────────────────────────────────────

export const FORTUNE_MULTIPLIERS: Record<EnchantmentLevel, number> = { 1: 1.33, 2: 1.75, 3: 2.5, 4: 2.5, 5: 2.5 }

// ─── Applicable items ────────────────────────────────────────────────────────

// Which item types may carry each enchantment. Used by the enchanting service
// to validate requests.
export const APPLICABLE_TO: Partial<Record<EnchantmentType, ReadonlySet<ItemType>>> = {
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
  POWER: new Set(['BOW']),
}
