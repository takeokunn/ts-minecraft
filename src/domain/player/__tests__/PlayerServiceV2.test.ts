import { Effect, TestClock, TestContext, Layer, Option, Either, pipe } from 'effect'
import { it, expect, describe } from 'vitest'
import * as fc from 'fast-check'
import { Schema } from 'effect'
import * as Types from '../PlayerTypes.js'
import * as Service from '../PlayerServiceV2.js'
import { EntityManager } from '../../../infrastructure/ecs/EntityManager.js'

// =========================================
// Test Fixtures & Arbitraries
// =========================================

const arbVector3D: fc.Arbitrary<Types.Vector3D> = fc.record({
  x: fc.float({ min: -1000, max: 1000, noNaN: true }),
  y: fc.float({ min: 0, max: 320, noNaN: true }),
  z: fc.float({ min: -1000, max: 1000, noNaN: true }),
})

const arbRotation: fc.Arbitrary<Types.Rotation> = fc.record({
  pitch: fc.float({ min: -90, max: 90, noNaN: true }),
  yaw: fc.float({ min: -180, max: 180, noNaN: true }),
  roll: fc.constant(0),
})

const arbGameMode: fc.Arbitrary<Types.GameMode> = fc.oneof(
  fc.constant('survival' as const),
  fc.constant('creative' as const),
  fc.constant('adventure' as const),
  fc.constant('spectator' as const)
)

const arbPlayerConfig = fc.record({
  playerId: fc.string({ minLength: 1, maxLength: 16 }).filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
  name: fc.string({ minLength: 1, maxLength: 16 }).filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
  position: fc.option(arbVector3D, { nil: undefined }),
  gameMode: fc.option(arbGameMode, { nil: undefined }),
})

// =========================================
// Test Layer Setup
// =========================================

// TestServices will be inferred by @effect/vitest from our test layers

const TestEntityManager: Layer.Layer<EntityManager> = Layer.succeed(
  EntityManager,
  {
    createEntity: (name?: string, tags?: ReadonlyArray<string>) =>
      Effect.succeed(Math.floor(Math.random() * 10000) as Types.EntityId),
    destroyEntity: () => Effect.succeed(undefined),
    isEntityAlive: () => Effect.succeed(true),
    getEntityMetadata: () => Effect.succeed(Option.none()),
    setEntityActive: () => Effect.succeed(undefined),
    addComponent: () => Effect.succeed(undefined),
    removeComponent: () => Effect.succeed(undefined),
    getComponent: () => Effect.succeed(Option.none()),
    hasComponent: () => Effect.succeed(false),
    getEntityComponents: () => Effect.succeed(new Map()),
    getEntitiesWithComponent: () => Effect.succeed([]),
    getEntitiesWithComponents: () => Effect.succeed([]),
    getEntitiesByTag: () => Effect.succeed([]),
    getAllEntities: () => Effect.succeed([]),
    batchGetComponents: () => Effect.succeed([]),
    iterateComponents: () => Effect.succeed(undefined),
    update: () => Effect.succeed(undefined),
    getStats: () => Effect.succeed({
      totalEntities: 0,
      activeEntities: 0,
      totalComponents: 0,
      componentTypes: 0,
      archetypeCount: 0,
    }),
    clear: () => Effect.succeed(undefined),
  } satisfies EntityManager
)

const TestLayers = Service.PlayerSystemLive.pipe(
  Layer.provide(TestEntityManager)
)

// =========================================
// Unit Tests
// =========================================

describe('PlayerService', () => {
  describe('PlayerRepository', () => {
    it('should save and load players', async () =>
      await Effect.gen(function* () {
        const repository = yield* Service.PlayerRepository

        const player = createTestPlayer('player1', 'TestPlayer')

        yield* repository.save(player)
        const loaded = yield* repository.load(player.id)

        expect(loaded).toEqual(player)
      }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    )

    it('should return error for non-existent player', async () =>
      await Effect.gen(function* () {
        const repository = yield* Service.PlayerRepository

        const playerId = Types.makePlayerId('nonexistent')
        const result = yield* Effect.either(repository.load(playerId))

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          const error = result.left
          expect(error.reason).toBe('PlayerNotFound')
        }
      }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    )

    it('should find player by name', async () =>
      await Effect.gen(function* () {
        const repository = yield* Service.PlayerRepository

        const player = createTestPlayer('player1', 'UniqueTestName')
        yield* repository.save(player)

        const found = yield* repository.findByName('UniqueTestName')

        expect(Option.isSome(found)).toBe(true)
        if (Option.isSome(found)) {
          expect(found.value.name).toBe('UniqueTestName')
        }
      }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    )
  })

  describe('PlayerStateManager', () => {
    it('should create new player', async () =>
      await Effect.gen(function* () {
        const stateManager = yield* Service.PlayerStateManager

        const config = {
          playerId: 'newplayer',
          name: 'NewPlayer',
          position: { x: 100, y: 64, z: 100 },
          gameMode: 'creative' as const,
        }

        const player = yield* stateManager.create(config)

        expect(player.name).toBe('NewPlayer')
        expect(player.position).toEqual(config.position)
        expect(player.gameMode).toBe('creative')
        expect(player.abilities.canFly).toBe(true)
      }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    )

    it('should prevent duplicate player creation', async () =>
      await Effect.gen(function* () {
        const stateManager = yield* Service.PlayerStateManager

        const config = {
          playerId: 'duplicate',
          name: 'DuplicatePlayer',
        }

        yield* stateManager.create(config)
        const result = yield* Effect.either(stateManager.create(config))

        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          const error = result.left
          expect(error.reason).toBe('PlayerAlreadyExists')
        }
      }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    )

    it('should update player state', async () =>
      await Effect.gen(function* () {
        const stateManager = yield* Service.PlayerStateManager

        const config = {
          playerId: 'updatetest',
          name: 'UpdateTest',
        }

        const player = yield* stateManager.create(config)
        const updated = yield* stateManager.update(player.id, (p) => ({
          ...p,
          position: { x: 200, y: 100, z: 300 },
          stats: {
            ...p.stats,
            health: Types.makeHealth(15),
          },
        }))

        expect(updated.position).toEqual({ x: 200, y: 100, z: 300 })
        expect(updated.stats.health).toBe(15)
      }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    )
  })

  describe('PlayerMovementSystem', () => {
    it('should apply movement correctly', async () =>
      await Effect.gen(function* () {
        const movement = yield* Service.PlayerMovementSystem

        const player = createTestPlayer('mover', 'Mover')
        const moveAction: Types.PlayerAction & { _tag: 'Move' } = {
          _tag: 'Move',
          direction: {
            forward: true,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sneak: false,
            sprint: false,
          },
        }

        const moved = yield* movement.move(player, moveAction)

        // Should have forward velocity
        expect(moved.velocity.z).toBeGreaterThan(0)
      }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    )

    it('should apply jump when on ground', async () =>
      await Effect.gen(function* () {
        const movement = yield* Service.PlayerMovementSystem

        const player = { ...createTestPlayer('jumper', 'Jumper'), isOnGround: true }
        const jumped = yield* movement.jump(player)

        expect(jumped.velocity.y).toBe(8) // JUMP_VELOCITY
        expect(jumped.isOnGround).toBe(false)
      }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    )

    it('should not jump when in air', async () =>
      await Effect.gen(function* () {
        const movement = yield* Service.PlayerMovementSystem

        const player = { ...createTestPlayer('airborne', 'Airborne'), isOnGround: false }
        const result = yield* movement.jump(player)

        expect(result.velocity.y).toBe(0) // No change
        expect(result.isOnGround).toBe(false)
      }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    )

    it('should apply physics correctly', async () =>
      await Effect.gen(function* () {
        const movement = yield* Service.PlayerMovementSystem

        const player = {
          ...createTestPlayer('physics', 'Physics'),
          position: { x: 0, y: 100, z: 0 },
          velocity: { x: 5, y: 0, z: 5 } as Types.Velocity,
          isOnGround: false,
        }

        const updated = yield* movement.updatePhysics(player, 0.05) // 50ms

        // Gravity should be applied
        expect(updated.velocity.y).toBeLessThan(0)
        // Air resistance should be applied
        expect(updated.velocity.x).toBeLessThan(5)
        expect(updated.velocity.z).toBeLessThan(5)
        // Position should be updated
        expect(updated.position.y).toBeLessThan(100)
      }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    )
  })

  describe('PlayerActionProcessor', () => {
    it('should process actions correctly', async () =>
      await Effect.gen(function* () {
        const processor = yield* Service.PlayerActionProcessor

        const player = createTestPlayer('actor', 'Actor')
        const jumpAction: Types.PlayerAction = { _tag: 'Jump' }

        const result = yield* processor.process({ ...player, isOnGround: true }, jumpAction)

        expect(result.velocity.y).toBe(8)
      }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    )

    it('should validate actions based on player state', async () =>
      await Effect.gen(function* () {
        const processor = yield* Service.PlayerActionProcessor

        const player = createTestPlayer('validator', 'Validator')

        // Jump validation
        const canJumpInAir = yield* processor.validate({ ...player, isOnGround: false }, { _tag: 'Jump' })
        expect(canJumpInAir).toBe(false)

        const canJumpOnGround = yield* processor.validate({ ...player, isOnGround: true }, { _tag: 'Jump' })
        expect(canJumpOnGround).toBe(true)

        // Block placement validation
        const canPlace = yield* processor.validate(player, {
          _tag: 'PlaceBlock',
          position: { x: 0, y: 64, z: 0 },
          face: 'top',
        })
        expect(canPlace).toBe(player.abilities.canPlaceBlocks)
      }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    )
  })
})

// =========================================
// Property-Based Tests
// =========================================

describe('PlayerService Properties', () => {
  it('player creation should be idempotent', async () =>
    await fc.assert(fc.asyncProperty(arbPlayerConfig, async (config: any) =>
      await Effect.gen(function* () {
        const stateManager = yield* Service.PlayerStateManager

        const player1 = yield* stateManager.create(config)
        const player2 = yield* stateManager.get(Types.makePlayerId(config.playerId))

        expect(player1).toEqual(player2)
      }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    ), { numRuns: 100 })
  )

  it('physics should conserve energy within bounds', async () =>
    await fc.assert(fc.asyncProperty(
      arbVector3D,
      fc.float({ min: 0.001, max: 0.1, noNaN: true }),
      async (initialPosition: Types.Vector3D, deltaTime: number) =>
        await Effect.gen(function* () {
          const movement = yield* Service.PlayerMovementSystem

          const player = {
            ...createTestPlayer('energy', 'Energy'),
            position: initialPosition,
            velocity: { x: 0, y: 0, z: 0 } as Types.Velocity,
            isOnGround: false,
          }

          const updated = yield* movement.updatePhysics(player, deltaTime)

          // Terminal velocity check
          expect(updated.velocity.y).toBeGreaterThanOrEqual(-60)

          // Position bounds check
          expect(Number.isFinite(updated.position.x)).toBe(true)
          expect(Number.isFinite(updated.position.y)).toBe(true)
          expect(Number.isFinite(updated.position.z)).toBe(true)
        }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    ), { numRuns: 100 })
  )

  it('game mode abilities should be consistent', async () =>
    await fc.assert(fc.asyncProperty(arbGameMode, async (gameMode: Types.GameMode) =>
      await Effect.gen(function* () {
        const stateManager = yield* Service.PlayerStateManager

        const player = yield* stateManager.create({
          playerId: `gm_${gameMode}`,
          name: `GM_${gameMode}`,
          gameMode,
        })

        switch (gameMode) {
          case 'creative':
            expect(player.abilities.canFly).toBe(true)
            expect(player.abilities.invulnerable).toBe(true)
            break
          case 'spectator':
            expect(player.abilities.canFly).toBe(true)
            expect(player.abilities.canBreakBlocks).toBe(false)
            expect(player.abilities.canPlaceBlocks).toBe(false)
            break
          case 'adventure':
            expect(player.abilities.canBreakBlocks).toBe(false)
            break
          case 'survival':
            expect(player.abilities.canFly).toBe(false)
            expect(player.abilities.invulnerable).toBe(false)
            break
        }
      }).pipe(Effect.provide(TestLayers), Effect.provide(TestContext.TestContext), Effect.scoped, Effect.runPromise)
    ), { numRuns: 20 })
  )
})

// =========================================
// Helper Functions
// =========================================

function createTestPlayer(id: string, name: string): Types.Player {
  return {
    id: Types.makePlayerId(id),
    entityId: Types.makeEntityId(1),
    name,
    position: { x: 0, y: 64, z: 0 },
    rotation: { pitch: 0, yaw: 0, roll: 0 },
    velocity: { x: 0, y: 0, z: 0 } as Types.Velocity,
    stats: Types.defaultPlayerStats,
    gameMode: 'survival',
    abilities: Types.defaultPlayerAbilities,
    inventory: Types.defaultInventory,
    equipment: Types.defaultEquipment,
    isOnGround: false,
    isSneaking: false,
    isSprinting: false,
    lastUpdate: Date.now(),
    createdAt: Date.now(),
  }
}
