import { it, expect, describe } from '@effect/vitest'
import { Effect, Layer, TestClock, TestContext, Option } from 'effect'
// @ts-ignore - fast-check is used for property-based testing
import * as fc from 'fast-check'
import { CombatService } from '../CombatService.js'
import { CombatServiceLive } from '../CombatServiceLive.js'
import {
  createAttackDamage,
  createDefenseValue,
  createKnockbackForce,
  createDurability,
  AttackOnCooldownError,
  type AttackType,
  type Weapon,
  type Armor,
  type EnchantmentType,
} from '../CombatTypes.js'
import { BrandedTypes } from '../../../shared/types/branded.js'
import { SpatialBrandedTypes } from '../../../shared/types/spatial-brands.js'
import { EventBus } from '../../../infrastructure/events/EventBus.js'
import { CannonPhysicsService } from '../../physics/CannonPhysicsService.js'

// ================================
// Test Data Generators
// ================================

const arbEntityId = fc
  .integer({ min: 1, max: 10000 })
  .map((id: number) => BrandedTypes.createEntityId(`entity_${id}`))

const arbItemId = fc
  .constantFrom('sword', 'axe', 'pickaxe', 'bow', 'trident')
  .map((item: string) => BrandedTypes.createItemId(`minecraft:${item}`))

const arbWeapon: fc.Arbitrary<Weapon> = fc.record({
  itemId: arbItemId,
  baseDamage: fc.integer({ min: 1, max: 20 }).map(createAttackDamage),
  attackSpeed: fc.float({ min: 0.5, max: 4 }),
  knockback: fc.float({ min: 0.1, max: 2 }).map(createKnockbackForce),
  enchantments: fc.array(
    fc.constantFrom('sharpness', 'knockback', 'fire_aspect', 'looting') as fc.Arbitrary<EnchantmentType>,
    { maxLength: 3 }
  ),
  durability: fc.integer({ min: 1, max: 1000 }).map(createDurability),
})

const arbArmor: fc.Arbitrary<Armor> = fc.record({
  slot: fc.constantFrom('helmet', 'chestplate', 'leggings', 'boots'),
  defense: fc.integer({ min: 1, max: 5 }).map(createDefenseValue),
  toughness: fc.float({ min: 0, max: 10 }),
  enchantments: fc.array(
    fc.constantFrom('protection', 'blast_protection', 'projectile_protection', 'thorns') as fc.Arbitrary<EnchantmentType>,
    { maxLength: 3 }
  ),
  durability: fc.integer({ min: 1, max: 1000 }).map(createDurability),
})

const arbAttackType: fc.Arbitrary<AttackType> = fc.oneof(
  fc.record({
    _tag: fc.constant('Melee'),
    weapon: fc.option(arbWeapon),
    chargeTime: fc.float({ min: 0, max: 1 }),
  }),
  fc.record({
    _tag: fc.constant('Ranged'),
    projectileType: fc.constantFrom('arrow', 'trident', 'snowball', 'egg', 'fireball'),
    power: fc.float({ min: 0, max: 1 }),
  }),
  fc.record({
    _tag: fc.constant('Magic'),
    spellType: fc.constantFrom('fireball', 'ice_shard', 'lightning', 'heal', 'shield'),
    manaCost: fc.integer({ min: 1, max: 100 }),
  })
) as fc.Arbitrary<AttackType>

// ================================
// Test Layers
// ================================

const MockEventBus = Layer.succeed(
  EventBus,
  EventBus.of({
    publish: () => Effect.succeed(undefined),
    subscribe: () => Effect.succeed({ close: () => Effect.succeed(undefined) }),
  })
)

const MockCannonPhysicsService = Layer.succeed(
  CannonPhysicsService,
  CannonPhysicsService.of({
    createCharacterController: () => Effect.succeed('body_1'),
    removeCharacterController: () => Effect.succeed(undefined),
    applyMovementForce: () => Effect.succeed(undefined),
    getBodyState: () =>
      Effect.succeed({
        position: SpatialBrandedTypes.createVector3D(0, 64, 0),
        velocity: SpatialBrandedTypes.createVector3D(0, 0, 0),
        angularVelocity: SpatialBrandedTypes.createVector3D(0, 0, 0),
        quaternion: { x: 0, y: 0, z: 0, w: 1 },
        isGrounded: true,
      }),
    raycastGround: () => Effect.succeed(null),
    addStaticBlock: () => Effect.succeed('block_1'),
    removeStaticBlock: () => Effect.succeed(undefined),
    step: () => Effect.succeed(undefined),
    reset: () => Effect.succeed(undefined),
  })
)

const TestLayers = Layer.mergeAll(CombatServiceLive, MockEventBus, MockCannonPhysicsService)

// ================================
// Tests
// ================================

describe('CombatService', () => {
  describe('Property-based tests', () => {
    it.prop([arbEntityId, arbEntityId, arbWeapon], { numRuns: 100 })(
      'damage should always be positive',
      (attackerId, targetId, weapon) =>
        Effect.gen(function* () {
          const service = yield* CombatService

          const attackType: AttackType = {
            _tag: 'Melee',
            weapon: Option.some(weapon),
            chargeTime: 1.0,
          }

          const result = yield* service.attack(attackerId, targetId, attackType)

          expect(result.damage).toBeGreaterThan(0)
        }).pipe(Effect.provide(TestLayers), Effect.runPromise)
    )

    it.prop([fc.integer({ min: 1, max: 100 }), fc.array(arbArmor, { minLength: 0, maxLength: 4 })], {
      numRuns: 100,
    })('armor should reduce damage', (baseDamage, armor) =>
      Effect.gen(function* () {
        const service = yield* CombatService
        const damage = createAttackDamage(baseDamage)
        const reducedDamage = yield* service.calculateDamage(damage, armor, [])

        if (armor.length > 0) {
          const totalDefense = armor.reduce((sum, piece) => sum + piece.defense, 0)
          if (totalDefense > 0) {
            expect(reducedDamage).toBeLessThanOrEqual(baseDamage)
          }
        }
        expect(reducedDamage).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayers), Effect.runPromise)
    )

    it.prop([arbEntityId], { numRuns: 50 })('health should never go below 0', (entityId) =>
      Effect.gen(function* () {
        const service = yield* CombatService

        // Set initial health
        yield* service.setHealth(entityId, 10)

        // Apply large damage
        const damage = createAttackDamage(100)
        const health = yield* service.applyDamage(entityId, damage, {
          _tag: 'Environment',
          cause: 'fall',
        })

        expect(health.current).toBe(0)
        expect(health.current).toBeGreaterThanOrEqual(0)
      }).pipe(Effect.provide(TestLayers), Effect.runPromise)
    )

    it.prop([arbEntityId, arbEntityId, fc.array(arbAttackType, { minLength: 1, maxLength: 5 })], {
      numRuns: 50,
    })('consecutive attacks should respect cooldown', (attackerId, targetId, attacks) =>
      Effect.gen(function* () {
        const service = yield* CombatService

        // First attack should succeed
        const firstAttack = attacks[0]
        const firstResult = yield* service.attack(attackerId, targetId, firstAttack)
        expect(firstResult).toBeDefined()

        // Immediate second attack should fail
        if (attacks.length > 1) {
          const secondAttack = attacks[1]
          const secondResult = yield* Effect.either(service.attack(attackerId, targetId, secondAttack))

          expect(secondResult._tag).toBe('Left')
          if (secondResult._tag === 'Left') {
            expect(secondResult.left).toBeInstanceOf(AttackOnCooldownError)
          }
        }
      }).pipe(Effect.provide(TestLayers), Effect.runPromise)
    )
  })

  describe('Critical hit mechanics', () => {
    it.effect('should apply critical damage multiplier', () =>
      Effect.gen(function* () {
        const service = yield* CombatService
        const attackerId = BrandedTypes.createEntityId('attacker')
        const targetId = BrandedTypes.createEntityId('target')

        // Run multiple attacks to test critical chance
        const results = yield* Effect.all(
          Array.from({ length: 100 }, () =>
            service.attack(attackerId, targetId, {
              _tag: 'Melee',
              weapon: Option.none(),
              chargeTime: 1.0,
            })
          ),
          { concurrency: 1 }
        )

        const criticals = results.filter((r) => r.isCritical)

        // With 5% critical chance, expect roughly 5 criticals in 100 attacks
        // Allow for variance (2-10 criticals)
        expect(criticals.length).toBeGreaterThan(1)
        expect(criticals.length).toBeLessThan(15)
      })
    )
  })

  describe('Knockback physics', () => {
    it.effect('should apply knockback force', () =>
      Effect.gen(function* () {
        const service = yield* CombatService
        const targetId = BrandedTypes.createEntityId('target')
        const sourcePos = SpatialBrandedTypes.createVector3D(0, 64, 0)

        yield* service.applyKnockback(targetId, sourcePos, createKnockbackForce(1.5))

        // Test passes if no error is thrown
        expect(true).toBe(true)
      })
    )
  })

  describe('Health management', () => {
    it.effect('should track entity health correctly', () =>
      Effect.gen(function* () {
        const service = yield* CombatService
        const entityId = BrandedTypes.createEntityId('test_entity')

        // Initial health
        const initialHealth = yield* service.getHealth(entityId)
        expect(initialHealth.current).toBe(20)
        expect(initialHealth.max).toBe(20)

        // Set health
        const updatedHealth = yield* service.setHealth(entityId, 15)
        expect(updatedHealth.current).toBe(15)

        // Apply damage
        const damagedHealth = yield* service.applyDamage(entityId, createAttackDamage(5), {
          _tag: 'Environment',
          cause: 'fall',
        })
        expect(damagedHealth.current).toBe(10)

        // Check if alive
        const isAlive = yield* service.isAlive(entityId)
        expect(isAlive).toBe(true)

        // Kill entity
        yield* service.applyDamage(entityId, createAttackDamage(20), {
          _tag: 'Environment',
          cause: 'void',
        })

        const isDead = yield* service.isAlive(entityId)
        expect(isDead).toBe(false)
      })
    )
  })

  describe('Attack cooldown', () => {
    it.effect('should enforce attack cooldown', () =>
      Effect.gen(function* () {
        const service = yield* CombatService
        const attackerId = BrandedTypes.createEntityId('attacker')
        const targetId = BrandedTypes.createEntityId('target')

        // First attack succeeds
        yield* service.attack(attackerId, targetId, {
          _tag: 'Melee',
          weapon: Option.none(),
          chargeTime: 1.0,
        })

        // Check cooldown
        const canAttackImmediately = yield* service.canAttack(attackerId)
        expect(canAttackImmediately).toBe(false)

        const remainingCooldown = yield* service.getRemainingCooldown(attackerId)
        expect(remainingCooldown).toBeGreaterThan(0)

        // Wait for cooldown
        yield* TestClock.adjust(600)

        const canAttackAfterWait = yield* service.canAttack(attackerId)
        expect(canAttackAfterWait).toBe(true)
      })
    )
  })

  describe('Damage calculation', () => {
    it.effect('should calculate damage with enchantments', () =>
      Effect.gen(function* () {
        const service = yield* CombatService

        const baseDamage = createAttackDamage(10)
        const armor: Armor[] = [
          {
            slot: 'chestplate',
            defense: createDefenseValue(8),
            toughness: 2,
            enchantments: ['protection'],
            durability: createDurability(500),
          },
        ]

        const damage = yield* service.calculateDamage(baseDamage, armor, ['sharpness'])

        // With protection and defense, damage should be reduced
        expect(damage).toBeLessThan(10)
        expect(damage).toBeGreaterThan(0)
      })
    )
  })

  describe('Different attack types', () => {
    it.effect('should handle melee attacks', () =>
      Effect.gen(function* () {
        const service = yield* CombatService
        const attackerId = BrandedTypes.createEntityId('attacker')
        const targetId = BrandedTypes.createEntityId('target')

        const weapon: Weapon = {
          itemId: BrandedTypes.createItemId('minecraft:diamond_sword'),
          baseDamage: createAttackDamage(7),
          attackSpeed: 1.6,
          knockback: createKnockbackForce(0.5),
          enchantments: ['sharpness'],
          durability: createDurability(1561),
        }

        const result = yield* service.attack(attackerId, targetId, {
          _tag: 'Melee',
          weapon: Option.some(weapon),
          chargeTime: 1.0,
        })

        expect(result.damage).toBeGreaterThanOrEqual(7)
        expect(result.knockback).toBe(0.5)
      })
    )

    it.effect('should handle ranged attacks', () =>
      Effect.gen(function* () {
        const service = yield* CombatService
        const attackerId = BrandedTypes.createEntityId('attacker')
        const targetId = BrandedTypes.createEntityId('target')

        const result = yield* service.attack(attackerId, targetId, {
          _tag: 'Ranged',
          projectileType: 'arrow',
          power: 1.0,
        })

        expect(result.damage).toBeGreaterThan(0)
        expect(result.knockback).toBeGreaterThan(0)
      })
    )

    it.effect('should handle magic attacks', () =>
      Effect.gen(function* () {
        const service = yield* CombatService
        const attackerId = BrandedTypes.createEntityId('attacker')
        const targetId = BrandedTypes.createEntityId('target')

        const result = yield* service.attack(attackerId, targetId, {
          _tag: 'Magic',
          spellType: 'fireball',
          manaCost: 10,
        })

        expect(result.damage).toBeGreaterThan(0)
      })
    )
  })
})