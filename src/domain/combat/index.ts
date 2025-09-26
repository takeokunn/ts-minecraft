/**
 * Combat System Module
 *
 * Provides Effect-TS based combat mechanics including:
 * - Melee, Ranged, and Magic attacks
 * - Damage calculation with armor reduction
 * - Knockback physics integration
 * - Critical hit mechanics
 * - Attack cooldown management
 * - Health tracking
 */

// Service exports
export { CombatService, type EntityHealth } from './CombatService.js'
export { CombatServiceLive } from './CombatServiceLive.js'

// Type exports
export {
  // Branded types
  type AttackDamage,
  type DefenseValue,
  type KnockbackForce,
  type AttackCooldown,
  type Durability,
  createAttackDamage,
  createDefenseValue,
  createKnockbackForce,
  createAttackCooldown,
  createDurability,

  // Schemas
  AttackDamage as AttackDamageSchema,
  DefenseValue as DefenseValueSchema,
  KnockbackForce as KnockbackForceSchema,
  AttackCooldown as AttackCooldownSchema,
  Durability as DurabilitySchema,

  // Combat types
  type Weapon,
  type Armor,
  type ArmorSlot,
  type EnchantmentType,
  type AttackType,
  type ProjectileType,
  type SpellType,
  type DamageSource,
  type CombatEvent,
  type CombatResult,

  // Schemas
  Weapon as WeaponSchema,
  Armor as ArmorSchema,
  ArmorSlot as ArmorSlotSchema,
  EnchantmentType as EnchantmentTypeSchema,
  AttackType as AttackTypeSchema,
  ProjectileType as ProjectileTypeSchema,
  SpellType as SpellTypeSchema,
  DamageSource as DamageSourceSchema,
  CombatEvent as CombatEventSchema,
  CombatResult as CombatResultSchema,

  // Errors
  CombatError,
  AttackOnCooldownError,
  TargetNotFoundError,
  EntityNotFoundError,
  KnockbackError,
} from './CombatTypes.js'
