import { describe, it, expect } from '@effect/vitest'
import { Array as Arr, Effect, Either, Option } from 'effect'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import {
  GameStateService,
  GameStateError,
  PLAYER_BODY_ID,
} from '@ts-minecraft/game'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import { DroppedItemService } from '@ts-minecraft/entity/application/dropped-item-service'
import { createStack } from '@ts-minecraft/inventory/domain/item-stack'
import { EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import { createTestInputService, createTestLayer } from './game-state-test-utils'

describe('application/game-state (core)', () => {
  describe('Constants', () => {
    it('should have PLAYER_BODY_ID constant', () => {
      expect(PLAYER_BODY_ID).toBe('player')
    })

    it('should have DEFAULT_PLAYER_ID constant', () => {
      expect(DEFAULT_PLAYER_ID).toBe('player-1')
    })
  })

  describe('GameStateError', () => {
    it('should create GameStateError with operation and message', () => {
      const error = new GameStateError({ operation: 'initialize', reason: 'Test error' })
      expect(error._tag).toBe('GameStateError')
      expect(error.operation).toBe('initialize')
      expect(error.message).toContain('initialize')
      expect(error.message).toContain('Test error')
    })

    it('should create GameStateError with cause', () => {
      const cause = new Error('Underlying error')
      const error = new GameStateError({ operation: 'update', reason: 'Test error', cause })
      expect(error.cause).toBe(cause)
    })

    it('should include String(cause) in message when cause is a non-Error truthy value', () => {
      const error = new GameStateError({ operation: 'op', reason: 'r', cause: 'string-cause' })
      expect(error.message).toContain('string-cause')
    })

    it('should not append a colon-separated cause segment when cause is absent', () => {
      const error = new GameStateError({ operation: 'op', reason: 'r' })
      // message should be "GameState error during op: r" with no trailing ": "
      expect(error.message).toBe('GameState error during op: r')
    })
  })

  describe('GameStateService.Default', () => {
    it('should provide GameStateService as Layer', () => {
      const inputService = createTestInputService()
      const layer = createTestLayer(inputService)

      expect(layer).toBeDefined()
      expect(typeof layer).toBe('object')
    })

    it.effect('should have all required methods', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        expect(typeof service.initialize).toBe('function')
        expect(typeof service.update).toBe('function')
        expect(typeof service.respawn).toBe('function')
        expect(typeof service.getTiming).toBe('function')
        expect(typeof service.getPlayerPosition).toBe('function')
        expect(typeof service.getCameraRotation).toBe('function')
        expect(typeof service.isPlayerGrounded).toBe('function')
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('Initialization', () => {
    it.effect('should initialize physics world and player body', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // Check player position was set
        const position = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(position.x).toBe(0)
        expect(position.y).toBe(5) // Spawn position
        expect(position.z).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should create player at spawn position 5 units above ground', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const position = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(position.y).toBe(5)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('Update loop', () => {
    it.effect('should fail to update before initialization', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        const result = yield* Effect.either(service.update(DeltaTimeSecs.make(1 / 60)))

        expect(Either.isLeft(result)).toBe(true)
        const errUpdate = Option.getOrThrow(Either.getLeft(result))
        expect(errUpdate).toBeInstanceOf(GameStateError)
        expect((errUpdate as GameStateError).operation).toBe('update')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should succeed to update after initialization', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })
        yield* service.update(DeltaTimeSecs.make(1 / 60))
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should update timing state', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const timingBefore = yield* service.getTiming()
        expect(timingBefore.frameCount).toBe(0)

        yield* service.update(DeltaTimeSecs.make(1 / 60))

        const timingAfter = yield* service.getTiming()
        expect(timingAfter.frameCount).toBe(1)
        expect(timingAfter.deltaTime).toBe(1 / 60)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should apply movement velocity from input', () => {
      const inputService = createTestInputService({ forward: true })
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // Store initial position
        const initialPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        // Update multiple times to let physics move the player
        yield* Effect.forEach(Arr.makeBy(60, () => undefined), () => service.update(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        const finalPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        // Player should have moved in negative Z direction (forward)
        expect(finalPos.z).toBeLessThan(initialPos.z)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should step physics simulation', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const initialPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(initialPos.y).toBe(5)

        // Step simulation multiple times - player should fall due to gravity
        yield* Effect.forEach(Arr.makeBy(120, () => undefined), () => service.update(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        const finalPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        // Player should have fallen (gravity)
        expect(finalPos.y).toBeLessThan(initialPos.y)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should sync physics position back to player state', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // Run simulation
        yield* service.update(DeltaTimeSecs.make(1 / 60))

        // Position should be synced
        const position = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(typeof position.x).toBe('number')
        expect(typeof position.y).toBe('number')
        expect(typeof position.z).toBe('number')
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('Respawn', () => {
    it.effect('should reset the player position and velocity to the respawn point', () => {
      // No movement input: with air control (the player can now steer mid-air), a
      // held movement key would legitimately drift the player after respawn. Using
      // no input isolates the respawn-reset assertion (position + grounded reset).
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)
      const respawnPosition = { x: 10, y: 20, z: -5 }

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })
        yield* Effect.forEach(Arr.makeBy(10, () => undefined), () => service.update(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        yield* service.respawn(respawnPosition)

        const position = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        const grounded = yield* service.isPlayerGrounded()
        yield* service.update(DeltaTimeSecs.make(1 / 60))
        const afterUpdate = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        expect(position).toEqual(respawnPosition)
        expect(grounded).toBe(false)
        expect(afterUpdate.x).toBe(respawnPosition.x)
        expect(afterUpdate.z).toBe(respawnPosition.z)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should drop survival inventory at the death position before clearing it', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)
      const deathPosition = { x: 1, y: 6, z: -2 }
      const respawnPosition = { x: 10, y: 20, z: -5 }

      return Effect.gen(function* () {
        const service = yield* GameStateService
        const inventory = yield* InventoryService
        const equipment = yield* EquipmentService
        const droppedItems = yield* DroppedItemService

        yield* service.initialize(deathPosition)
        yield* inventory.addBlock('DIRT', 3)
        yield* inventory.addBlock('STONE', 2)
        yield* equipment.equip(createStack('IRON_HELMET'))
        yield* equipment.equip(createStack('DIAMOND_BOOTS'))

        yield* service.respawn(respawnPosition)

        const drops = yield* droppedItems.getAll()
        expect(drops).toHaveLength(4)
        expect(drops.map((drop) => [drop.itemType, drop.count])).toEqual(expect.arrayContaining([
          ['DIRT', 3],
          ['STONE', 2],
          ['IRON_HELMET', 1],
          ['DIAMOND_BOOTS', 1],
        ]))
        expect(drops.every((drop) =>
          drop.position.x === deathPosition.x &&
          drop.position.y === deathPosition.y + 0.5 &&
          drop.position.z === deathPosition.z &&
          drop.pickupDelayTicks === 40
        )).toBe(true)

        const slots = yield* inventory.getAllSlots()
        expect(slots.every((slot) => Option.isNone(slot))).toBe(true)
        const equipmentSlots = yield* equipment.getAll()
        expect(Object.values(equipmentSlots).every((slot) => Option.isNone(slot))).toBe(true)
      }).pipe(Effect.provide(testLayer))
    })
  })

})
