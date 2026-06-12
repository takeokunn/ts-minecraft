import { Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'

// Tool/weapon durability (Phase 12). Pure domain — the maximum number of uses a
// tool has before it breaks. Values match Minecraft Java Edition material tiers;
// swords and pickaxes of the same material share a durability budget.
//
// Items absent from this table are not damageable (blocks, food, ingredients):
// getMaxDurability → none, isDurable → false.
//
// This table is the SINGLE SOURCE OF TRUTH for "which item types are tools":
// item-stack's non-stackable set is derived from its keys (see maxStackFor), so a
// new durable tool added here is automatically both damageable and non-stackable.
export const TOOL_MAX_DURABILITY: Partial<Record<InventoryItem, number>> = {
  // Tools & weapons — Minecraft Java Edition values
  WOODEN_SWORD: 59,
  WOODEN_PICKAXE: 59,
  WOODEN_HOE: 59,
  WOODEN_AXE: 59,
  WOODEN_SHOVEL: 59,
  STONE_SWORD: 131,
  STONE_PICKAXE: 131,
  STONE_HOE: 131,
  STONE_AXE: 131,
  STONE_SHOVEL: 131,
  IRON_SWORD: 250,
  IRON_PICKAXE: 250,
  IRON_HOE: 250,
  IRON_AXE: 250,
  IRON_SHOVEL: 250,
  DIAMOND_SWORD: 1561,
  DIAMOND_PICKAXE: 1561,
  DIAMOND_HOE: 1561,
  DIAMOND_AXE: 1561,
  DIAMOND_SHOVEL: 1561,
  FISHING_ROD: 64,
  BOW: 384,
  SHIELD: 336,
  SHEARS: 238, // FR R11 — vanilla Java shears; damaged once per shear (right-click)
  // Armor — each piece has its own durability budget (Minecraft Java Edition)
  LEATHER_HELMET: 55,
  LEATHER_CHESTPLATE: 80,
  LEATHER_LEGGINGS: 75,
  LEATHER_BOOTS: 65,
  IRON_HELMET: 165,
  IRON_CHESTPLATE: 240,
  IRON_LEGGINGS: 225,
  IRON_BOOTS: 195,
  DIAMOND_HELMET: 363,
  DIAMOND_CHESTPLATE: 528,
  DIAMOND_LEGGINGS: 495,
  DIAMOND_BOOTS: 429,
}

export const getMaxDurability = (itemType: InventoryItem): Option.Option<number> =>
  Option.fromNullable(TOOL_MAX_DURABILITY[itemType])

export const isDurable = (itemType: InventoryItem): boolean =>
  Option.isSome(getMaxDurability(itemType))

// Reduces remaining durability by `amount` (default 1 per use), clamped at 0.
export const damageDurability = (current: number, amount: number = 1): number =>
  Math.max(0, current - Math.max(0, amount))

// A tool is broken once its remaining durability reaches 0.
export const isBroken = (remaining: number): boolean => remaining <= 0
