import type { Vector3 } from '@ts-minecraft/core'
import type { Enchantment } from '@ts-minecraft/inventory/domain/enchantment.types'
import {
  getBaneOfArthropodsDamageBonus,
  getSharpnessDamageBonus,
  getSmiteDamageBonus,
} from '@ts-minecraft/inventory/domain/enchantment'
import {
  ARTHROPOD_MOB_TYPES,
  ARMOR_REDUCTION_PER_POINT,
  CRITICAL_DAMAGE_MULTIPLIER,
  KNOCKBACK_HORIZONTAL_SPEED,
  KNOCKBACK_VERTICAL_SPEED,
  MAX_ARMOR_POINTS,
  PLAYER_ATTACK_DAMAGE,
  SPRINT_ATTACK_KNOCKBACK_MULTIPLIER_BONUS,
  UNDEAD_MOB_TYPES,
  WEAPON_BASE_DAMAGE,
} from './combat.config'

// Combat damage model (Phase 12). Pure functions — no Effect, no randomness.
//
// Critical hits in Minecraft are deterministic, not random: a melee attack while
// the attacker is falling (airborne, moving down, not on a ladder/in water) deals
// 1.5× damage. Modelling `isCritical` as an input keeps damage computation pure
// and unit-testable, and matches vanilla behaviour better than a random roll.

// Reduce incoming damage by the DEFENDER's armor points (4%/point, cap 80%).
// This is the single source of the armor-mitigation formula: it backs both
// player→mob attacks (where the mob is the defender) and mob→player hits
// (where the player's equipped armor mitigates the blow). Fall damage and
// starvation BYPASS armor in vanilla, so callers must not route those here.
export const applyArmorReduction = (rawDamage: number, armorPoints: number = 0): number => {
  if (rawDamage <= 0) return 0
  const clampedArmor = Math.max(0, Math.min(MAX_ARMOR_POINTS, armorPoints))
  return rawDamage * (1 - clampedArmor * ARMOR_REDUCTION_PER_POINT)
}

// Outgoing attack damage = base × (crit ? 1.5 : 1), mitigated by the TARGET's
// armorPoints. Mobs carry no armor in this model, so the attack site passes 0;
// the param exists for future armored mobs. The player's OWN armor never
// factors here — it mitigates incoming damage in physics-stage instead.
export const computeAttackDamage = (
  baseDamage: number,
  isCritical: boolean,
  armorPoints: number = 0,
): number => {
  if (baseDamage <= 0) return 0
  const critMultiplier = isCritical ? CRITICAL_DAMAGE_MULTIPLIER : 1
  return applyArmorReduction(baseDamage * critMultiplier, armorPoints)
}

// ─── Attack cooldown (Minecraft 1.9 charged-attack model) ───────────────────
// After an attack the weapon recharges over DEFAULT_ATTACK_COOLDOWN_SECS. Hitting
// again before fully charged weakens the blow, discouraging spam-clicking.

// Charge ratio in [0, 1] from time elapsed since the previous attack.
export const computeAttackCharge = (secsSinceLastAttack: number, cooldownSecs: number): number => {
  if (cooldownSecs <= 0) return 1
  return Math.max(0, Math.min(1, secsSinceLastAttack / cooldownSecs))
}

// Vanilla damage scaling: damage × (0.2 + 0.8·charge²). A fully charged hit deals
// 100%; an instant re-hit (charge 0) deals 20%.
export const computeChargedDamage = (baseDamage: number, charge: number): number => {
  const c = Math.max(0, Math.min(1, charge))
  return baseDamage * (0.2 + 0.8 * c * c)
}

export const getWeaponBaseDamage = (itemType: string | undefined): number =>
  (itemType !== undefined ? WEAPON_BASE_DAMAGE[itemType] : undefined) ?? PLAYER_ATTACK_DAMAGE

// Returns the total enchantment damage bonus for a melee attack against a given
// mob type. SHARPNESS applies universally; SMITE targets undead; BANE targets
// arthropods. Bonuses are mutually exclusive (only the highest-priority applies).
export const computeWeaponEnchantBonus = (
  enchantments: ReadonlyArray<Enchantment>,
  entityType: string,
): number => {
  let sharpnessEnchant: Enchantment | undefined
  let smiteEnchant: Enchantment | undefined
  let baneEnchant: Enchantment | undefined
  for (const enchantment of enchantments) {
    if (enchantment.type === 'SHARPNESS') {
      sharpnessEnchant = enchantment
      break
    }
    if (enchantment.type === 'SMITE') {
      smiteEnchant = enchantment
      continue
    }
    if (enchantment.type === 'BANE_OF_ARTHROPODS') {
      baneEnchant = enchantment
    }
  }
  if (sharpnessEnchant !== undefined) return getSharpnessDamageBonus(sharpnessEnchant.level)
  if (smiteEnchant !== undefined && UNDEAD_MOB_TYPES.has(entityType)) return getSmiteDamageBonus(smiteEnchant.level)
  if (baneEnchant !== undefined && ARTHROPOD_MOB_TYPES.has(entityType)) return getBaneOfArthropodsDamageBonus(baneEnchant.level)
  return 0
}

export const computeAttackKnockbackHorizontalMultiplier = (
  enchantmentMultiplier: number,
  isSprintAttack: boolean,
): number =>
  enchantmentMultiplier + (isSprintAttack ? SPRINT_ATTACK_KNOCKBACK_MULTIPLIER_BONUS : 0)

// Builds the knockback impulse from the attacker→target horizontal direction.
// Degenerate (zero-length) direction yields a straight-up pop so a point-blank
// hit still produces feedback.
export const computeKnockback = (dirX: number, dirZ: number): Vector3 => {
  const mag = Math.hypot(dirX, dirZ)
  if (mag === 0) return { x: 0, y: KNOCKBACK_VERTICAL_SPEED, z: 0 }
  return {
    x: (dirX / mag) * KNOCKBACK_HORIZONTAL_SPEED,
    y: KNOCKBACK_VERTICAL_SPEED,
    z: (dirZ / mag) * KNOCKBACK_HORIZONTAL_SPEED,
  }
}
