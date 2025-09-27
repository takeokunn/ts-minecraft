import { Context, Effect } from 'effect'
import type { EntityId } from '@shared/types/branded'
import type { Vector3D } from '@shared/types/spatial-brands'
import type {
  AttackType,
  CombatResult,
  CombatError,
  AttackDamage,
  Armor,
  EnchantmentType,
  KnockbackForce,
  KnockbackError,
  EntityNotFoundError,
  AttackOnCooldownError,
  TargetNotFoundError,
  DefenseValue,
  DamageSource,
} from '../types/CombatTypes'

// ================================
// Health Management (Simple)
// ================================

export interface EntityHealth {
  readonly current: number
  readonly max: number
  readonly entityId: EntityId
}

// ================================
// Combat Service Interface
// ================================

export interface CombatService {
  /**
   * Execute an attack from one entity to another
   */
  readonly attack: (
    attackerId: EntityId,
    targetId: EntityId,
    attackType: AttackType
  ) => Effect.Effect<CombatResult, AttackOnCooldownError | TargetNotFoundError | KnockbackError>

  /**
   * Calculate final damage after armor reduction
   */
  readonly calculateDamage: (
    baseDamage: AttackDamage,
    armor: ReadonlyArray<Armor>,
    enchantments: ReadonlyArray<EnchantmentType>
  ) => Effect.Effect<AttackDamage, never>

  /**
   * Apply knockback force to target
   */
  readonly applyKnockback: (
    targetId: EntityId,
    sourcePosition: Vector3D,
    force: KnockbackForce
  ) => Effect.Effect<void, KnockbackError>

  /**
   * Check if entity can attack (cooldown check)
   */
  readonly canAttack: (attackerId: EntityId) => Effect.Effect<boolean, never>

  /**
   * Get total defense value for entity
   */
  readonly getDefenseValue: (entityId: EntityId) => Effect.Effect<DefenseValue, EntityNotFoundError>

  /**
   * Apply damage to entity (simplified health management)
   */
  readonly applyDamage: (
    targetId: EntityId,
    damage: AttackDamage,
    source: DamageSource
  ) => Effect.Effect<EntityHealth, EntityNotFoundError>

  /**
   * Get entity health
   */
  readonly getHealth: (entityId: EntityId) => Effect.Effect<EntityHealth, EntityNotFoundError>

  /**
   * Set entity health
   */
  readonly setHealth: (entityId: EntityId, health: number) => Effect.Effect<EntityHealth, EntityNotFoundError>

  /**
   * Check if entity is alive
   */
  readonly isAlive: (entityId: EntityId) => Effect.Effect<boolean, never>

  /**
   * Calculate critical hit chance
   */
  readonly getCriticalChance: (attackerId: EntityId) => Effect.Effect<number, never>

  /**
   * Set attack cooldown
   */
  readonly setAttackCooldown: (attackerId: EntityId, attackType: AttackType) => Effect.Effect<void, never>

  /**
   * Check remaining cooldown
   */
  readonly getRemainingCooldown: (attackerId: EntityId) => Effect.Effect<number, never>
}

// ================================
// Service Tag
// ================================

export const CombatService = Context.GenericTag<CombatService>('@minecraft/domain/CombatService')
