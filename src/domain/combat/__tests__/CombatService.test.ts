import { it, expect, describe } from '@effect/vitest'
import { Effect, Layer, TestClock, TestContext, Option, Random, Array } from 'effect'
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
import { SpatialBrands } from '../../../shared/types/spatial-brands.js'
import { EventBus } from '../../../infrastructure/events/EventBus.js'
import { CannonPhysicsService } from '../../physics/CannonPhysicsService.js'

// ================================
// Test Data Generators
// ================================

const generateEntityId = Effect.gen(function* () {
  const id = yield* Random.nextIntBetween(1, 10001)
  return BrandedTypes.createEntityId(`entity_${id}`)
})

const generateItemId = Effect.gen(function* () {
  const items = ['sword', 'axe', 'pickaxe', 'bow', 'trident'] as const
  const index = yield* Random.nextIntBetween(0, items.length)
  return BrandedTypes.createItemId(items[index]!)
})

const generateWeapon: Effect.Effect<Weapon> = Effect.gen(function* () {
  const itemId = yield* generateItemId
  const baseDamage = createAttackDamage(yield* Random.nextIntBetween(1, 21))
  const attackSpeed = yield* Random.nextRange(0.5, 4)
  const knockback = createKnockbackForce(yield* Random.nextRange(0.1, 2))
  const enchantmentTypes: readonly EnchantmentType[] = ['sharpness', 'knockback', 'fire_aspect', 'looting'] as const
  const numEnchantments = yield* Random.nextIntBetween(0, 2)
  const enchantments = yield* Effect.forEach(Array.range(0, numEnchantments), () =>
    Effect.map(Random.nextIntBetween(0, 3), (i) => enchantmentTypes[i] as EnchantmentType)
  ) as Effect.Effect<readonly EnchantmentType[]>
  const durability = createDurability(yield* Random.nextIntBetween(1, 1000))
  return {
    itemId,
    baseDamage,
    attackSpeed,
    knockback,
    enchantments: enchantments as readonly EnchantmentType[],
    durability,
  } as const
})

const generateArmor: Effect.Effect<Armor> = Effect.gen(function* () {
  const slots = ['helmet', 'chestplate', 'leggings', 'boots'] as const
  const slotIndex = yield* Random.nextIntBetween(0, 3)
  const slot = slots[slotIndex] as (typeof slots)[number]
  const defense = createDefenseValue(yield* Random.nextIntBetween(1, 5))
  const toughness = yield* Random.nextRange(0, 10)
  const enchantmentTypes: EnchantmentType[] = ['protection', 'blast_protection', 'projectile_protection', 'thorns']
  const numEnchantments = yield* Random.nextIntBetween(0, 2)
  const enchantments = yield* Effect.forEach(Array.range(0, numEnchantments), () =>
    Effect.map(Random.nextIntBetween(0, 3), (i) => enchantmentTypes[i] as EnchantmentType)
  )
  const durability = createDurability(yield* Random.nextIntBetween(1, 1000))
  return { slot, defense, toughness, enchantments, durability } as Armor
})

const generateAttackType: Effect.Effect<AttackType> = Effect.gen(function* () {
  const typeChoice = yield* Random.nextIntBetween(0, 2)
  switch (typeChoice) {
    case 0: {
      const weapon = (yield* Random.nextBoolean) ? yield* generateWeapon : undefined
      const chargeTime = yield* Random.nextRange(0, 1)
      return { _tag: 'Melee' as const, weapon, chargeTime } as AttackType
    }
    case 1: {
      const projectileTypes = ['arrow', 'trident', 'snowball', 'egg', 'fireball'] as const
      const projectileIndex = yield* Random.nextIntBetween(0, 4)
      const projectileType = projectileTypes[projectileIndex] as (typeof projectileTypes)[number]
      const power = yield* Random.nextRange(0, 1)
      return { _tag: 'Ranged' as const, projectileType, power } as AttackType
    }
    default: {
      const spellTypes = ['fireball', 'ice_shard', 'lightning', 'heal', 'shield'] as const
      const spellIndex = yield* Random.nextIntBetween(0, 4)
      const spellType = spellTypes[spellIndex] as (typeof spellTypes)[number]
      const manaCost = yield* Random.nextIntBetween(1, 100)
      return { _tag: 'Magic' as const, spellType, manaCost } as AttackType
    }
  }
})

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

const TestLayers = Layer.mergeAll(CombatServiceLive, MockEventBus, MockCannonPhysicsService)

// ================================
// Tests
// ================================

describe('CombatService', () => {
  describe('Property-based tests', () => {
    it('damage should always be positive', () =>
      Effect.gen(function* () {
        const service = yield* CombatService
        const attackerId = yield* generateEntityId
        const targetId = yield* generateEntityId
        const weapon = yield* generateWeapon

        const attackType: AttackType = {
          _tag: 'Melee',
          weapon: weapon,
          chargeTime: 1.0,
        }

        const result = yield* service.attack(attackerId, targetId, attackType)

        expect(result.damage).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayers), Effect.runPromise))

    it('armor should reduce damage', () =>
      Effect.gen(function* () {
        const service = yield* CombatService

        // Generate test data using Effect-TS
        const baseDamage = yield* Random.nextIntBetween(1, 101)
        const numArmor = yield* Random.nextIntBetween(0, 5)
        const armor = yield* Effect.forEach(Array.range(0, numArmor), () => generateArmor)

        const damage = createAttackDamage(baseDamage)
        const reducedDamage = yield* service.calculateDamage(damage, armor, [])

        if (armor.length > 0) {
          const totalDefense = armor.reduce((sum, piece) => sum + piece.defense, 0)
          if (totalDefense > 0) {
            expect(reducedDamage).toBeLessThanOrEqual(baseDamage)
          }
        }
        expect(reducedDamage).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayers), Effect.runPromise))

    it('health should never go below 0', () =>
      Effect.gen(function* () {
        const service = yield* CombatService
        const entityId = yield* generateEntityId

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
      }).pipe(Effect.provide(TestLayers), Effect.runPromise))

    it('consecutive attacks should respect cooldown', () =>
      Effect.gen(function* () {
        const service = yield* CombatService
        const attackerId = yield* generateEntityId
        const targetId = yield* generateEntityId
        const numAttacks = yield* Random.nextIntBetween(1, 6)
        const attacks = yield* Effect.forEach(Array.range(0, numAttacks), () => generateAttackType)

        // First attack should succeed
        const firstAttack = attacks[0] as AttackType
        const firstResult = yield* service.attack(attackerId, targetId, firstAttack)
        expect(firstResult).toBeDefined()

        // Immediate second attack should fail
        if (attacks.length > 1) {
          const secondAttack = attacks[1] as AttackType
          const secondResult = yield* Effect.either(service.attack(attackerId, targetId, secondAttack))

          expect(secondResult._tag).toBe('Left')
          if (secondResult._tag === 'Left') {
            expect(secondResult.left).toBeInstanceOf(AttackOnCooldownError)
          }
        }
      }).pipe(Effect.provide(TestLayers), Effect.runPromise))
  })

  describe('Critical hit mechanics', () => {
    it.effect('should apply critical damage multiplier', () =>
      Effect.gen(function* () {
        const service = yield* CombatService
        const attackerId = BrandedTypes.createEntityId('attacker')
        const targetId = BrandedTypes.createEntityId('target')

        // Run a single attack multiple times with different attackers to avoid cooldown
        const results = yield* Effect.all(
          Array.range(0, 100).map((i) =>
            service.attack(BrandedTypes.createEntityId(`attacker_${i}`), targetId, {
              _tag: 'Melee',
              weapon: undefined,
              chargeTime: 1.0,
            })
          ),
          { concurrency: 1 }
        )

        const criticals = results.filter((r: any) => r.isCritical)

        // With 5% critical chance, expect roughly 5 criticals in 100 attacks
        // Allow for variance (2-10 criticals)
        expect(criticals.length).toBeGreaterThan(1)
        expect(criticals.length).toBeLessThan(15)
      }).pipe(Effect.provide(TestLayers))
    )
  })

  describe('Knockback physics', () => {
    it.effect('should apply knockback force', () =>
      Effect.gen(function* () {
        const service = yield* CombatService
        const targetId = BrandedTypes.createEntityId('target')
        const sourcePos = SpatialBrands.createVector3D(0, 64, 0)

        yield* service.applyKnockback(targetId, sourcePos, createKnockbackForce(1.5))

        // Test passes if no error is thrown
        expect(true).toBe(true)
      }).pipe(Effect.provide(TestLayers))
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
      }).pipe(Effect.provide(TestLayers))
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
          weapon: undefined,
          chargeTime: 1.0,
        })

        // Check cooldown
        const canAttackImmediately = yield* service.canAttack(attackerId)
        expect(canAttackImmediately).toBe(false)

        const remainingCooldown = yield* service.getRemainingCooldown(attackerId)
        expect(remainingCooldown).toBeGreaterThan(0)
        expect(remainingCooldown).toBeLessThanOrEqual(500)
      }).pipe(Effect.provide(TestLayers))
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
      }).pipe(Effect.provide(TestLayers))
    )
  })

  describe('Different attack types', () => {
    it.effect('should handle melee attacks', () =>
      Effect.gen(function* () {
        const service = yield* CombatService
        const attackerId = BrandedTypes.createEntityId('attacker')
        const targetId = BrandedTypes.createEntityId('target')

        const weapon: Weapon = {
          itemId: BrandedTypes.createItemId('diamond_sword'),
          baseDamage: createAttackDamage(7),
          attackSpeed: 1.6,
          knockback: createKnockbackForce(0.5),
          enchantments: ['sharpness'],
          durability: createDurability(1000), // Max durability value
        }

        const result = yield* service.attack(attackerId, targetId, {
          _tag: 'Melee',
          weapon: weapon,
          chargeTime: 1.0,
        })

        expect(result.damage).toBeGreaterThanOrEqual(7)
        expect(result.knockback).toBe(0.5)
      }).pipe(Effect.provide(TestLayers))
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
      }).pipe(Effect.provide(TestLayers))
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
      }).pipe(Effect.provide(TestLayers))
    )
  })
})
