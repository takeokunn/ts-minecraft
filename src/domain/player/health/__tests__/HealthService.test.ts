import { describe, it, expect } from '@effect/vitest'
import { Effect, Layer, Either, Option, STM, pipe } from 'effect'
import { Schema } from '@effect/schema'
import { HealthService, HealthServiceLive, DamageCalculatorLive } from '../index.js'
import { PlayerService } from '../../PlayerService.js'
import { PlayerServiceLive } from '../../PlayerServiceLive.js'
import { PlayerEventBus } from '../../PlayerServiceV2.js'
import { EntityManager } from '../../../../infrastructure/ecs/EntityManager.js'
import { EntityManagerLive } from '../../../../infrastructure/ecs/index.js'
import * as Types from '../../PlayerTypes.js'
import * as HealthTypes from '../HealthTypes.js'

// =======================================
// Test Helpers
// =======================================

const makeTestEventBus = (): PlayerEventBus => ({
  publish: () => Effect.succeed(undefined),
  subscribe: () => Effect.never as any,
  subscribeFiltered: () => Effect.never as any,
})

const TestEventBusLayer = Layer.succeed(PlayerEventBus, makeTestEventBus())

const TestLayer = Layer.mergeAll(
  HealthServiceLive,
  DamageCalculatorLive,
  PlayerServiceLive,
  EntityManagerLive,
  TestEventBusLayer
)

// =======================================
// Health Service Tests
// =======================================

describe('HealthService', () => {
  describe('Basic Functionality', () => {
    it.effect('should initialize a player with default health', () =>
      Effect.gen(function* () {
        const healthService = yield* HealthService
        const playerService = yield* PlayerService

        const playerId = Types.makePlayerId('test-player')
        yield* playerService.createPlayer({ playerId: 'test-player' })

        yield* healthService.initializePlayer(playerId)

        const health = yield* healthService.getCurrentHealth(playerId)
        expect(health).toBe(20)

        const state = yield* healthService.getHealthState(playerId)
        expect(state.currentHealth).toBe(20)
        expect(state.maxHealth).toBe(20)
        expect(state.isDead).toBe(false)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle taking damage', () =>
      Effect.gen(function* () {
        const healthService = yield* HealthService
        const playerService = yield* PlayerService

        const playerId = Types.makePlayerId('damage-test')
        yield* playerService.createPlayer({ playerId: 'damage-test' })
        yield* healthService.initializePlayer(playerId)

        const source: HealthTypes.DamageSource = {
          _tag: 'Fall',
          height: 10,
        }

        const newHealth = yield* healthService.takeDamage(playerId, source)
        expect(newHealth).toBeLessThan(20)
        expect(newHealth).toBeGreaterThanOrEqual(0)

        const state = yield* healthService.getHealthState(playerId)
        expect(state.lastDamageSource).toEqual(source)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle healing', () =>
      Effect.gen(function* () {
        const healthService = yield* HealthService
        const playerService = yield* PlayerService

        const playerId = Types.makePlayerId('heal-test')
        yield* playerService.createPlayer({ playerId: 'heal-test' })
        yield* healthService.initializePlayer(playerId)

        // Damage the player first
        yield* healthService.setHealth(playerId, 10 as HealthTypes.CurrentHealth)

        const source: HealthTypes.HealingSource = {
          _tag: 'Food',
          itemId: 'apple',
          healAmount: 5 as HealthTypes.HealAmount,
        }

        const newHealth = yield* healthService.heal(playerId, source)
        expect(newHealth).toBe(15)
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should handle death and respawn', () =>
      Effect.gen(function* () {
        const healthService = yield* HealthService
        const playerService = yield* PlayerService

        const playerId = Types.makePlayerId('death-test')
        yield* playerService.createPlayer({ playerId: 'death-test' })
        yield* healthService.initializePlayer(playerId)

        // Kill the player
        const killSource: HealthTypes.DamageSource = { _tag: 'Void' }
        yield* healthService.kill(playerId, killSource)

        const isDead = yield* healthService.isDead(playerId)
        expect(isDead).toBe(true)

        // Respawn
        const spawnLocation = { x: 0, y: 64, z: 0 }
        yield* healthService.respawn(playerId, spawnLocation)

        const isDeadAfterRespawn = yield* healthService.isDead(playerId)
        expect(isDeadAfterRespawn).toBe(false)

        const healthAfterRespawn = yield* healthService.getCurrentHealth(playerId)
        expect(healthAfterRespawn).toBe(20)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Property-Based Tests', () => {
    it.prop(
      [Schema.String.pipe(Schema.minLength(1), Schema.maxLength(16))],
      { numRuns: 30 }
    )('damage should never result in negative health', (playerIdStr) =>
      Effect.gen(function* () {
        const healthService = yield* HealthService
        const playerService = yield* PlayerService

        const playerId = Types.makePlayerId(playerIdStr)

        yield* playerService.createPlayer({ playerId: playerIdStr })
        yield* healthService.initializePlayer(playerId)

        // Test various damage sources
        const sources: HealthTypes.DamageSource[] = [
          { _tag: 'Fall', height: Math.random() * 100 },
          { _tag: 'Lava', duration: Math.random() * 10 },
          { _tag: 'Hunger' },
          { _tag: 'Void' }
        ]

        for (const source of sources) {
          const result = yield* Effect.either(healthService.takeDamage(playerId, source))

          if (Either.isRight(result)) {
            expect(result.right).toBeGreaterThanOrEqual(0)
            expect(result.right).toBeLessThanOrEqual(20)
          }
        }
      }).pipe(
        Effect.provide(TestLayer),
        Effect.runPromise
      )
    )

    it.prop(
      [
        Schema.String.pipe(Schema.minLength(1), Schema.maxLength(16)),
        Schema.Number.pipe(Schema.between(0, 20))
      ],
      { numRuns: 30 }
    )('healing should never exceed max health', (playerIdStr, initialHealthNum) =>
      Effect.gen(function* () {
        const healthService = yield* HealthService
        const playerService = yield* PlayerService

        const playerId = Types.makePlayerId(playerIdStr)
        const initialHealth = initialHealthNum as HealthTypes.CurrentHealth

        yield* playerService.createPlayer({ playerId: playerIdStr })
        yield* healthService.initializePlayer(playerId)
        yield* healthService.setHealth(playerId, initialHealth)

        // Test various healing sources
        const sources: HealthTypes.HealingSource[] = [
          { _tag: 'NaturalRegeneration' },
          { _tag: 'Food', itemId: 'apple', healAmount: 5 as HealthTypes.HealAmount },
          { _tag: 'Potion', potionType: 'healing', instant: true }
        ]

        for (const source of sources) {
          const result = yield* Effect.either(healthService.heal(playerId, source))

          if (Either.isRight(result)) {
            expect(result.right).toBeLessThanOrEqual(20)
            expect(result.right).toBeGreaterThanOrEqual(initialHealth)
          }
        }
      }).pipe(
        Effect.provide(TestLayer),
        Effect.runPromise
      )
    )

    it.prop(
      [
        Schema.String.pipe(Schema.minLength(1), Schema.maxLength(16)),
        Schema.Number.pipe(Schema.between(1, 20))
      ],
      { numRuns: 20 }
    )('setting max health should cap current health', (playerIdStr, maxHealthNum) =>
      Effect.gen(function* () {
        const healthService = yield* HealthService
        const playerService = yield* PlayerService

        const playerId = Types.makePlayerId(playerIdStr)
        const maxHealth = maxHealthNum as HealthTypes.MaxHealth

        yield* playerService.createPlayer({ playerId: playerIdStr })
        yield* healthService.initializePlayer(playerId)

        yield* healthService.setMaxHealth(playerId, maxHealth)

        const currentHealth = yield* healthService.getCurrentHealth(playerId)
        expect(currentHealth).toBeLessThanOrEqual(maxHealth)
      }).pipe(
        Effect.provide(TestLayer),
        Effect.runPromise
      )
    )
  })

  describe('Error Cases', () => {
    it.effect('should fail when damaging non-existent player', () =>
      Effect.gen(function* () {
        const healthService = yield* HealthService

        const playerId = Types.makePlayerId('non-existent')
        const source: HealthTypes.DamageSource = { _tag: 'Hunger' }

        const result = yield* Effect.either(healthService.takeDamage(playerId, source))

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left.reason).toBe('PLAYER_NOT_FOUND')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail when healing dead player', () =>
      Effect.gen(function* () {
        const healthService = yield* HealthService
        const playerService = yield* PlayerService

        const playerId = Types.makePlayerId('dead-heal-test')
        yield* playerService.createPlayer({ playerId: 'dead-heal-test' })
        yield* healthService.initializePlayer(playerId)

        // Kill the player
        yield* healthService.kill(playerId, { _tag: 'Void' })

        const source: HealthTypes.HealingSource = { _tag: 'NaturalRegeneration' }
        const result = yield* Effect.either(healthService.heal(playerId, source))

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left.reason).toBe('ALREADY_DEAD')
        }
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should fail when respawning living player', () =>
      Effect.gen(function* () {
        const healthService = yield* HealthService
        const playerService = yield* PlayerService

        const playerId = Types.makePlayerId('alive-respawn-test')
        yield* playerService.createPlayer({ playerId: 'alive-respawn-test' })
        yield* healthService.initializePlayer(playerId)

        const spawnLocation = { x: 0, y: 64, z: 0 }
        const result = yield* Effect.either(healthService.respawn(playerId, spawnLocation))

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left.reason).toBe('NOT_DEAD')
        }
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Invulnerability', () => {
    it.effect('should provide invulnerability after damage', () =>
      Effect.gen(function* () {
        const healthService = yield* HealthService
        const playerService = yield* PlayerService

        const playerId = Types.makePlayerId('invuln-test')
        yield* playerService.createPlayer({ playerId: 'invuln-test' })
        yield* healthService.initializePlayer(playerId)

        // Take damage
        const source: HealthTypes.DamageSource = { _tag: 'Fall', height: 5 }
        yield* healthService.takeDamage(playerId, source)

        // Check invulnerability
        const isInvuln = yield* healthService.isInvulnerable(playerId)
        expect(isInvuln).toBe(true)

        // Try to take damage while invulnerable
        const result = yield* Effect.either(healthService.takeDamage(playerId, source))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left.reason).toBe('INVULNERABLE')
        }
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Concurrent Operations', () => {
    it.effect('should handle concurrent damage correctly', () =>
      Effect.gen(function* () {
        const healthService = yield* HealthService
        const playerService = yield* PlayerService

        const playerId = Types.makePlayerId('concurrent-test')
        yield* playerService.createPlayer({ playerId: 'concurrent-test' })
        yield* healthService.initializePlayer(playerId)

        // Multiple concurrent damage sources
        const damages = Array.from({ length: 5 }, (_, i) => ({
          _tag: 'Fall' as const,
          height: 4 + i,
        }))

        // Apply all damages concurrently
        const results = yield* Effect.all(
          damages.map((source) =>
            Effect.either(healthService.takeDamage(playerId, source))
          ),
          { concurrency: 'unbounded' }
        )

        // At least some should succeed
        const successCount = results.filter(Either.isRight).length
        expect(successCount).toBeGreaterThan(0)

        // Final health should be valid
        const finalHealth = yield* healthService.getCurrentHealth(playerId)
        expect(finalHealth).toBeGreaterThanOrEqual(0)
        expect(finalHealth).toBeLessThanOrEqual(20)
      }).pipe(Effect.provide(TestLayer))
    )
  })

  describe('Damage Calculation', () => {
    it.effect('should calculate fall damage correctly', () =>
      Effect.gen(function* () {
        const healthService = yield* HealthService
        const playerService = yield* PlayerService

        const playerId = Types.makePlayerId('fall-damage-test')
        yield* playerService.createPlayer({ playerId: 'fall-damage-test' })
        yield* healthService.initializePlayer(playerId)

        // Test fall damage threshold (no damage below 3 blocks)
        const smallFall: HealthTypes.DamageSource = { _tag: 'Fall', height: 2 }
        yield* healthService.takeDamage(playerId, smallFall)
        let health = yield* healthService.getCurrentHealth(playerId)
        expect(health).toBe(20) // No damage

        // Reset health
        yield* healthService.setHealth(playerId, 20 as HealthTypes.CurrentHealth)

        // Test fall damage (damage above 3 blocks)
        const bigFall: HealthTypes.DamageSource = { _tag: 'Fall', height: 10 }
        yield* healthService.takeDamage(playerId, bigFall)
        health = yield* healthService.getCurrentHealth(playerId)
        expect(health).toBeLessThan(20) // Should take damage
        expect(health).toBeGreaterThan(0) // But not die
      }).pipe(Effect.provide(TestLayer))
    )

    it.effect('should calculate explosion damage based on distance', () =>
      Effect.gen(function* () {
        const healthService = yield* HealthService
        const playerService = yield* PlayerService

        const playerId = Types.makePlayerId('explosion-test')
        yield* playerService.createPlayer({ playerId: 'explosion-test' })
        yield* healthService.initializePlayer(playerId)

        // Close explosion - high damage
        const closeExplosion: HealthTypes.DamageSource = {
          _tag: 'Explosion',
          power: 4,
          distance: 2
        }
        yield* healthService.takeDamage(playerId, closeExplosion)
        const healthClose = yield* healthService.getCurrentHealth(playerId)

        // Reset for next test
        yield* healthService.setHealth(playerId, 20 as HealthTypes.CurrentHealth)
        yield* Effect.sleep(600) // Wait for invulnerability to expire

        // Far explosion - less damage
        const farExplosion: HealthTypes.DamageSource = {
          _tag: 'Explosion',
          power: 4,
          distance: 7
        }
        yield* healthService.takeDamage(playerId, farExplosion)
        const healthFar = yield* healthService.getCurrentHealth(playerId)

        // Far explosion should do less damage
        expect(20 - healthFar).toBeLessThan(20 - healthClose)
      }).pipe(Effect.provide(TestLayer))
    )
  })
})