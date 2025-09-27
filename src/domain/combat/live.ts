import type { EntityId } from '@domain/core/types/brands'
import type { Vector3D } from '@domain/core/types/spatial'
import { SpatialBrands } from '@domain/core/types/spatial'
import { EventBus } from '@infrastructure/events/EventBus'
import { Effect, HashMap, Layer, Option, pipe, Ref } from 'effect'
import { CannonPhysicsService } from '../physics/CannonPhysicsService'
import type {
  Armor,
  AttackDamage,
  AttackType,
  CombatEvent,
  CombatResult,
  DamageSource,
  EnchantmentType,
  KnockbackForce,
  ProjectileType,
  Weapon,
  SpellType
} from './types'
import {
  AttackOnCooldownError,
  KnockbackError,
} from './types'
import {
  createAttackDamage,
  createDefenseValue,
  createKnockbackForce,
} from './helper'
import { CombatService, type EntityHealth } from './service'

// ================================
// Constants
// ================================

const COMBAT_CONSTANTS = {
  BASE_CRITICAL_CHANCE: 0.05,
  CRITICAL_DAMAGE_MULTIPLIER: 1.5,
  DEFENSE_REDUCTION_FACTOR: 0.04, // 1 point = 4% reduction
  DEFAULT_ATTACK_COOLDOWN_MS: 500,
  DEFAULT_MAX_HEALTH: 20,
  KNOCKBACK_UPWARD_FORCE: 0.5,
  MELEE_BASE_DAMAGE: 1,
  RANGED_BASE_DAMAGE: 2,
  MAGIC_BASE_DAMAGE: 3,
} as const

// ================================
// Helper Functions
// ================================

const calculateMeleeDamage = (weapon: Option.Option<Weapon>, chargeTime: number) =>
  Effect.gen(function* () {
    const baseDamage = pipe(
      weapon,
      Option.match({
        onNone: () => COMBAT_CONSTANTS.MELEE_BASE_DAMAGE,
        onSome: (w: Weapon) => w.baseDamage as number,
      })
    )
    // Apply charge time multiplier (0 to 1)
    const charged = baseDamage * (0.5 + chargeTime * 0.5)
    return createAttackDamage(Math.max(1, charged))
  })

const calculateRangedDamage = (projectileType: ProjectileType, power: number) =>
  Effect.gen(function* () {
    let baseDamage = 2
    switch (projectileType) {
      case 'arrow':
        baseDamage = 2
        break
      case 'trident':
        baseDamage = 8
        break
      case 'snowball':
        baseDamage = 0
        break
      case 'egg':
        baseDamage = 0
        break
      case 'fireball':
        baseDamage = 6
        break
    }
    const powered = baseDamage * power
    return createAttackDamage(Math.max(1, powered))
  })

const calculateMagicDamage = (spellType: SpellType) =>
  Effect.gen(function* () {
    let baseDamage = 0
    switch (spellType) {
      case 'fireball':
        baseDamage = 6
        break
      case 'ice_shard':
        baseDamage = 4
        break
      case 'lightning':
        baseDamage = 8
        break
      case 'heal':
        baseDamage = 0
        break
      case 'shield':
        baseDamage = 0
        break
    }
    return createAttackDamage(Math.max(0, baseDamage))
  })

const calculateTotalDefense = (armor: ReadonlyArray<Armor>) =>
  Effect.gen(function* () {
    const totalDefense = armor.reduce((sum, piece) => sum + piece.defense, 0)
    return createDefenseValue(Math.min(20, totalDefense))
  })

const applyEnchantmentEffects = (
  damage: number,
  enchantments: ReadonlyArray<EnchantmentType>
): Effect.Effect<AttackDamage> =>
  Effect.gen(function* () {
    let modifiedDamage = damage

    enchantments.forEach((enchantment) => {
      switch (enchantment) {
        case 'sharpness':
          modifiedDamage *= 1.25
          break
        case 'fire_aspect':
          modifiedDamage += 2
          break
        case 'protection':
          modifiedDamage *= 0.9
          break
        default:
          // Other enchantments don't affect damage
          break
      }
    })

    return createAttackDamage(Math.max(1, Math.floor(modifiedDamage)))
  })

const calculateKnockback = (attackType: AttackType): Effect.Effect<KnockbackForce> =>
  Effect.gen(function* () {
    let baseKnockback = 0.5
    switch (attackType._tag) {
      case 'Melee':
        baseKnockback = pipe(
          Option.fromNullable(attackType.weapon),
          Option.match({
            onNone: () => 0.5,
            onSome: (w: Weapon) => w.knockback as number,
          })
        )
        break
      case 'Ranged':
        baseKnockback = 0.3
        break
      case 'Magic':
        baseKnockback = 0.2
        break
    }
    return createKnockbackForce(baseKnockback)
  })

// ================================
// Service Implementation
// ================================

const makeCombatService = Effect.gen(function* () {
  // Dependencies
  const eventBus = yield* EventBus
  const physicsService = yield* CannonPhysicsService

  // State management
  const attackCooldowns = yield* Ref.make(HashMap.empty<EntityId, number>())
  const entityHealthMap = yield* Ref.make(HashMap.empty<EntityId, EntityHealth>())
  const entityArmorMap = yield* Ref.make(HashMap.empty<EntityId, ReadonlyArray<Armor>>())

  // Helper: Check attack cooldown
  const checkAttackCooldown = (attackerId: EntityId) =>
    Effect.gen(function* () {
      const cooldowns = yield* Ref.get(attackCooldowns)
      const lastAttackTime = HashMap.get(cooldowns, attackerId)

      return pipe(
        lastAttackTime,
        Option.match({
          onNone: () => true,
          onSome: (time) => {
            const now = Date.now()
            return now - time >= COMBAT_CONSTANTS.DEFAULT_ATTACK_COOLDOWN_MS
          },
        })
      )
    })

  // Helper: Get or create health
  const getOrCreateHealth = (entityId: EntityId): Effect.Effect<EntityHealth> =>
    Effect.gen(function* () {
      const healthMap = yield* Ref.get(entityHealthMap)
      return pipe(
        HashMap.get(healthMap, entityId),
        Option.match({
          onNone: () => {
            const newHealth: EntityHealth = {
              current: COMBAT_CONSTANTS.DEFAULT_MAX_HEALTH,
              max: COMBAT_CONSTANTS.DEFAULT_MAX_HEALTH,
              entityId,
            }
            return Effect.gen(function* () {
              yield* Ref.update(entityHealthMap, (map) => HashMap.set(map, entityId, newHealth))
              return newHealth
            })
          },
          onSome: (health) => Effect.succeed(health),
        }),
        (effect) => (Effect.isEffect(effect) ? effect : Effect.succeed(effect))
      )
    }).pipe(Effect.flatten)

  // Main attack implementation
  const attack = (attackerId: EntityId, targetId: EntityId, attackType: AttackType) =>
    Effect.gen(function* () {
      // Check cooldown
      const canAttack = yield* checkAttackCooldown(attackerId)
      if (!canAttack) {
        const cooldowns = yield* Ref.get(attackCooldowns)
        const lastAttackTime = HashMap.get(cooldowns, attackerId)
        const remaining = pipe(
          lastAttackTime,
          Option.match({
            onNone: () => 0,
            onSome: (time) => Math.max(0, COMBAT_CONSTANTS.DEFAULT_ATTACK_COOLDOWN_MS - (Date.now() - time)),
          })
        )
        return yield* Effect.fail(new AttackOnCooldownError({ attackerId, remainingCooldown: remaining }))
      }

      // Publish attack initiated event
      const attackWeapon = attackType._tag === 'Melee' ? attackType.weapon : Option.none()
      yield* eventBus.publish({
        _tag: 'AttackInitiated',
        attackerId,
        targetId,
        weapon: attackWeapon,
        timestamp: Date.now(),
      } as CombatEvent)

      // Calculate base damage based on attack type
      let baseDamage: AttackDamage
      switch (attackType._tag) {
        case 'Melee':
          baseDamage = yield* calculateMeleeDamage(Option.fromNullable(attackType.weapon), attackType.chargeTime)
          break
        case 'Ranged':
          baseDamage = yield* calculateRangedDamage(attackType.projectileType, attackType.power)
          break
        case 'Magic':
          baseDamage = yield* calculateMagicDamage(attackType.spellType)
          break
      }

      // Get target armor
      const armorMap = yield* Ref.get(entityArmorMap)
      const targetArmor = pipe(
        HashMap.get(armorMap, targetId),
        Option.getOrElse(() => [] as ReadonlyArray<Armor>)
      )

      // Calculate defense
      const defenseValue = yield* calculateTotalDefense(targetArmor)

      // Calculate final damage with critical hit
      const finalDamage = yield* Effect.gen(function* () {
        // Critical hit check
        const criticalChance = yield* getCriticalChance(attackerId)
        const isCritical = Math.random() < criticalChance

        let damage = baseDamage as number
        if (isCritical) {
          damage = damage * COMBAT_CONSTANTS.CRITICAL_DAMAGE_MULTIPLIER
        }

        // Apply defense reduction
        const reduction = defenseValue * COMBAT_CONSTANTS.DEFENSE_REDUCTION_FACTOR
        damage = damage * (1 - reduction)

        // Apply enchantment effects
        const allEnchantments = targetArmor.flatMap((a) => a.enchantments)
        const finalDamageAmount = yield* applyEnchantmentEffects(damage, allEnchantments)

        return {
          damage: finalDamageAmount,
          isCritical,
        }
      })

      // Apply damage to target
      const targetHealth = yield* applyDamage(targetId, finalDamage.damage, {
        _tag: 'Mob',
        mobId: attackerId,
        weaponType: attackType,
      } as DamageSource)

      // Calculate and apply knockback
      const knockbackForce = yield* calculateKnockback(attackType)

      // We need position for knockback - for now, use a placeholder
      const sourcePosition = SpatialBrands.createVector3D(0, 64, 0)
      yield* applyKnockback(targetId, sourcePosition, knockbackForce)

      // Publish damage dealt event
      yield* eventBus.publish({
        _tag: 'DamageDealt',
        attackerId,
        targetId,
        rawDamage: baseDamage,
        finalDamage: finalDamage.damage,
        isCritical: finalDamage.isCritical,
      } as CombatEvent)

      // Check if target died
      if (targetHealth.current <= 0) {
        yield* eventBus.publish({
          _tag: 'EntityKilled',
          entityId: targetId,
          killerId: attackerId,
          timestamp: Date.now(),
        } as CombatEvent)
      }

      // Set attack cooldown
      yield* setAttackCooldown(attackerId, attackType)

      return {
        damage: finalDamage.damage,
        targetId,
        knockback: knockbackForce,
        isCritical: finalDamage.isCritical,
      } as CombatResult
    })

  // Calculate damage implementation
  const calculateDamage = (
    baseDamage: AttackDamage,
    armor: ReadonlyArray<Armor>,
    enchantments: ReadonlyArray<EnchantmentType>
  ) =>
    Effect.gen(function* () {
      const defenseValue = yield* calculateTotalDefense(armor)
      const reduction = defenseValue * COMBAT_CONSTANTS.DEFENSE_REDUCTION_FACTOR
      let damage = baseDamage * (1 - reduction)

      // Apply enchantment effects
      damage = yield* applyEnchantmentEffects(damage, enchantments)

      return createAttackDamage(Math.max(1, Math.floor(damage)))
    })

  // Apply knockback implementation
  const applyKnockback = (targetId: EntityId, sourcePosition: Vector3D, force: KnockbackForce) =>
    Effect.gen(function* () {
      // Get target position - for now use a placeholder
      const targetPos = SpatialBrands.createVector3D(0, 64, 0)

      // Calculate direction vector
      const direction = {
        x: targetPos.x - sourcePosition.x,
        y: COMBAT_CONSTANTS.KNOCKBACK_UPWARD_FORCE,
        z: targetPos.z - sourcePosition.z,
      }

      // Normalize
      const magnitude = Math.sqrt(direction.x * direction.x + direction.z * direction.z) || 1

      const normalizedForce: Vector3D = SpatialBrands.createVector3D(
        (direction.x / magnitude) * force,
        direction.y * force * 0.5,
        (direction.z / magnitude) * force
      )

      // Apply force through physics engine
      const bodyId = `entity_${targetId}` // Convert EntityId to body ID
      yield* physicsService.applyMovementForce(bodyId, normalizedForce).pipe(
        Effect.mapError(
          (physicsError) =>
            new KnockbackError({
              message: `Failed to apply knockback: ${physicsError.message}`,
              targetId,
            })
        )
      )

      // Publish knockback event
      yield* eventBus.publish({
        _tag: 'KnockbackApplied',
        targetId,
        force: normalizedForce,
        sourceId: targetId, // Using targetId as placeholder
      } as CombatEvent)
    })

  // Health management
  const applyDamage = (targetId: EntityId, damage: AttackDamage, source: DamageSource) =>
    Effect.gen(function* () {
      const health = yield* getOrCreateHealth(targetId)
      const newHealth = Math.max(0, health.current - damage)

      const updatedHealth: EntityHealth = {
        ...health,
        current: newHealth,
      }

      yield* Ref.update(entityHealthMap, (map) => HashMap.set(map, targetId, updatedHealth))

      return updatedHealth
    })

  const getHealth = (entityId: EntityId) =>
    Effect.gen(function* () {
      return yield* getOrCreateHealth(entityId)
    })

  const setHealth = (entityId: EntityId, health: number) =>
    Effect.gen(function* () {
      const currentHealth = yield* getOrCreateHealth(entityId)
      const updatedHealth: EntityHealth = {
        ...currentHealth,
        current: Math.max(0, Math.min(currentHealth.max, health)),
      }

      yield* Ref.update(entityHealthMap, (map) => HashMap.set(map, entityId, updatedHealth))

      return updatedHealth
    })

  const isAlive = (entityId: EntityId) =>
    Effect.gen(function* () {
      const health = yield* getOrCreateHealth(entityId)
      return health.current > 0
    })

  // Other helper methods
  const canAttack = (attackerId: EntityId) => checkAttackCooldown(attackerId)

  const getDefenseValue = (entityId: EntityId) =>
    Effect.gen(function* () {
      const armorMap = yield* Ref.get(entityArmorMap)
      const armor = pipe(
        HashMap.get(armorMap, entityId),
        Option.getOrElse(() => [] as ReadonlyArray<Armor>)
      )
      return yield* calculateTotalDefense(armor)
    })

  const getCriticalChance = (_attackerId: EntityId) => Effect.succeed(COMBAT_CONSTANTS.BASE_CRITICAL_CHANCE)

  const setAttackCooldown = (attackerId: EntityId, _attackType: AttackType) =>
    Effect.gen(function* () {
      const now = Date.now()
      yield* Ref.update(attackCooldowns, (map) => HashMap.set(map, attackerId, now))
    })

  const getRemainingCooldown = (attackerId: EntityId) =>
    Effect.gen(function* () {
      const cooldowns = yield* Ref.get(attackCooldowns)
      const lastAttackTime = HashMap.get(cooldowns, attackerId)

      return pipe(
        lastAttackTime,
        Option.match({
          onNone: () => 0,
          onSome: (time) => {
            const elapsed = Date.now() - time
            return Math.max(0, COMBAT_CONSTANTS.DEFAULT_ATTACK_COOLDOWN_MS - elapsed)
          },
        })
      )
    })

  return CombatService.of({
    attack,
    calculateDamage,
    applyKnockback,
    canAttack,
    getDefenseValue,
    applyDamage,
    getHealth,
    setHealth,
    isAlive,
    getCriticalChance,
    setAttackCooldown,
    getRemainingCooldown,
  })
})

// ================================
// Layer Export
// ================================

const EventBusDefault = Layer.succeed(
  EventBus,
  EventBus.of({
    publish: () => Effect.succeed(undefined),
    subscribe: () =>
      Effect.succeed({
        close: () => Effect.succeed(undefined),
      }),
  })
)

const CannonPhysicsServiceDefault = Layer.succeed(
  CannonPhysicsService,
  CannonPhysicsService.of({
    initializeWorld: () => Effect.succeed(undefined),
    createPlayerController: () => Effect.succeed('body_1'),
    step: () => Effect.succeed(undefined),
    getPlayerState: () =>
      Effect.succeed({
        position: SpatialBrands.createVector3D(0, 64, 0),
        velocity: SpatialBrands.createVector3D(0, 0, 0),
        angularVelocity: SpatialBrands.createVector3D(0, 0, 0),
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        isOnGround: true,
        isColliding: false,
      }),
    applyMovementForce: () => Effect.succeed(undefined),
    jumpPlayer: () => Effect.succeed(undefined),
    raycastGround: () => Effect.succeed(null),
    addStaticBlock: () => Effect.succeed('block_1'),
    removeBody: () => Effect.succeed(undefined),
    cleanup: () => Effect.succeed(undefined),
  })
)

export const CombatServiceLive = Layer.effect(CombatService, makeCombatService).pipe(
  Layer.provide(Layer.mergeAll(EventBusDefault, CannonPhysicsServiceDefault))
)
