import { MAX_LEVEL, FORTUNE_MULTIPLIERS } from './enchantment.config'
import type { EnchantmentType, EnchantmentLevel, Enchantment } from './enchantment.types'

export type { EnchantmentType, EnchantmentLevel, Enchantment }
export {
  canEnchantItem,
  getApplicableEnchantments,
  isEnchantableItem,
  selectEnchantment,
} from './enchantment-applicability'
export { ENCHANTMENT_TYPES, EnchantmentTypeSchema, EnchantmentLevelSchema, EnchantmentSchema } from './enchantment.types'

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

// Power enchantment multiplier for bows. Vanilla adds 25% × (level + 1) of the arrow's
// damage, i.e. damage × (1 + 0.25·(level + 1)).
// POWER I = ×1.5, II = ×1.75, III = ×2.0, IV = ×2.25, V = ×2.5.
export const getPowerDamageMultiplier = (level: EnchantmentLevel): number =>
  1.0 + 0.25 * (level + 1)

// BaneOfArthropods applies to Spider. +2.5 per level.
export const getBaneOfArthropodsDamageBonus = (level: EnchantmentLevel): number =>
  2.5 * level

// KNOCKBACK: each level multiplies the horizontal knockback speed by 1.5.
// Vanilla: I=3 blocks, II=6 blocks extra. We model as a scale on the base impulse.
export const getKnockbackHorizontalMultiplier = (level: EnchantmentLevel): number =>
  1 + 0.5 * level

// FIRE_ASPECT: vanilla burns targets for 4 seconds per level.
export const getFireAspectDurationSecs = (level: EnchantmentLevel): number =>
  4 * level

// PUNCH (bow): each level adds 3 blocks of extra horizontal knockback on arrow impact.
export const getPunchKnockbackBonus = (level: EnchantmentLevel): number =>
  3 * level

// ─── Defence bonus ───────────────────────────────────────────────────────────

// Protection reduces damage. Each level reduces by 4% (stacks multiplicatively in vanilla;
// we simplify to additive, capped at 64% across all pieces).
export const getProtectionDamageReduction = (level: EnchantmentLevel): number =>
  0.04 * level

// FIRE_PROTECTION: each level reduces fire/lava damage by 8%. Additive across pieces,
// capped at 64% total (mirrors PROTECTION cap for simplicity).
export const getFireProtectionReduction = (level: EnchantmentLevel): number =>
  0.08 * level

// PROJECTILE_PROTECTION: each level reduces arrow/projectile damage by 8%.
export const getProjectileProtectionReduction = (level: EnchantmentLevel): number =>
  0.08 * level

// BLAST_PROTECTION: each level reduces explosion damage by 8%.
export const getBlastProtectionReduction = (level: EnchantmentLevel): number =>
  0.08 * level

// FEATHER_FALLING: each level reduces fall damage by 12% (vanilla value).
export const getFeatherFallingReduction = (level: EnchantmentLevel): number =>
  0.12 * level

// RESPIRATION: each level adds 15 extra seconds of air supply (vanilla: +15s per level).
export const getRespirationBonusSecs = (level: EnchantmentLevel): number =>
  15 * level

// ─── Fishing bonuses ─────────────────────────────────────────────────────────

// LURE: reduces wait time by 5 seconds per level (clamped to minimum 1s in caller).
export const getLureWaitReductionSecs = (level: EnchantmentLevel): number =>
  5 * level

// LUCK_OF_THE_SEA: each level shifts 2% from junk to treasure.
// Returns the adjusted treasure probability as a fraction [0, 1].
export const getLuckTreasureChance = (level: EnchantmentLevel, baseTreasureChance = 0.05): number =>
  Math.min(0.65, baseTreasureChance + 0.02 * level)

// ─── Utility bonuses ─────────────────────────────────────────────────────────

// Unbreaking: probability that a durability point is NOT consumed on each use.
export const getUnbreakingSkipChance = (level: EnchantmentLevel): number =>
  1 - 1 / (level + 1)

// Fortune: bonus multiplier on ore drops. Level 1 = 1.33×, 2 = 1.75×, 3 = 2.5×.
export const getFortuneDropMultiplier = (level: EnchantmentLevel): number =>
  FORTUNE_MULTIPLIERS[level]

// Extra drops (beyond the base 1) granted by a Fortune enchantment, given a uniform random
// roll in [0, 1). The configured multiplier is the EXPECTED total drops, so the extra is its
// fractional expectation realised probabilistically: the integer part is guaranteed and the
// fractional part is the chance of one more drop. This makes Fortune I (×1.33) actually grant a
// bonus ~1/3 of the time instead of Math.round-ing 1.33 down to a flat zero-extra no-op, and
// keeps Fortune II/III stochastic (avg +0.75 / +1.5) rather than a fixed +1 / +2.
export const rollFortuneExtraDrops = (level: EnchantmentLevel, rng: number): number => {
  const expectedExtra = FORTUNE_MULTIPLIERS[level] - 1
  const guaranteed = Math.floor(expectedExtra)
  return guaranteed + (rng < expectedExtra - guaranteed ? 1 : 0)
}

// XP levels consumed when enchanting at a given enchantment level.
export const enchantXPCost = (enchLevel: EnchantmentLevel): number => enchLevel
