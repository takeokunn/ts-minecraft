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
export { CombatService, type EntityHealth } from './services/CombatService'
export { CombatServiceLive } from './services/CombatServiceLive'

// Type exports
export {
  Armor as ArmorSchema,
  ArmorSlot as ArmorSlotSchema,
  AttackCooldown as AttackCooldownSchema,
  // Schemas
  AttackDamage as AttackDamageSchema,
  AttackOnCooldownError,
  AttackType as AttackTypeSchema,
  // Errors
  CombatError,
  CombatEvent as CombatEventSchema,
  CombatResult as CombatResultSchema,
  DamageSource as DamageSourceSchema,
  DefenseValue as DefenseValueSchema,
  Durability as DurabilitySchema,
  EnchantmentType as EnchantmentTypeSchema,
  EntityNotFoundError,
  KnockbackError,
  KnockbackForce as KnockbackForceSchema,
  ProjectileType as ProjectileTypeSchema,
  SpellType as SpellTypeSchema,
  TargetNotFoundError,
  // Schemas
  Weapon as WeaponSchema,
  createAttackCooldown,
  createAttackDamage,
  createDefenseValue,
  createDurability,
  createKnockbackForce,
  type Armor,
  type ArmorSlot,
  type AttackCooldown,
  // Branded types
  type AttackDamage,
  type AttackType,
  type CombatEvent,
  type CombatResult,
  type DamageSource,
  type DefenseValue,
  type Durability,
  type EnchantmentType,
  type KnockbackForce,
  type ProjectileType,
  type SpellType,
  // Combat types
  type Weapon,
} from './types/CombatTypes'
