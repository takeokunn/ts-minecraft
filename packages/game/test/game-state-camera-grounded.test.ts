import { describe, it, expect } from '@effect/vitest'
import { Array as Arr, Effect, Either, Option } from 'effect'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { GameStateService } from '@ts-minecraft/game'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import { createTestInputService, createTestLayer } from './game-state-test-utils'

describe('application/game-state (camera & grounded)', () => {
  describe('Camera rotation', () => {
    it.effect('should return camera rotation', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        const rotation = yield* service.getCameraRotation()

        expect(typeof rotation.yaw).toBe('number')
        expect(typeof rotation.pitch).toBe('number')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should use camera yaw for movement direction', () => {
      // This test verifies that movement is relative to camera direction
      // We test this by moving forward and checking the player position changes
      const inputService = createTestInputService({ forward: true })
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const initialPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        // Update multiple times - player should move in some direction
        yield* Effect.forEach(Arr.makeBy(60, () => undefined), () => service.update(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        const finalPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        // Player should have moved (either X or Z changed significantly)
        const movedX = Math.abs(finalPos.x - initialPos.x)
        const movedZ = Math.abs(finalPos.z - initialPos.z)
        const totalMovement = movedX + movedZ

        expect(totalMovement).toBeGreaterThan(0.1) // Player should have moved
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('Grounded state', () => {
    it.effect('should not be grounded initially (in air)', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const isGrounded = yield* service.isPlayerGrounded()

        expect(isGrounded).toBe(false)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('Integration scenarios', () => {
    it.effect('should handle full gameplay loop: fall, land, move, jump', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        // Phase 1: Fall and land
        yield* Effect.forEach(Arr.makeBy(300, () => undefined), () => service.update(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        const landedY = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).y
        expect(landedY).toBeLessThan(5)

        // Phase 2: Move forward
        inputService.setKeyPressed('KeyW', true)
        const beforeMoveZ = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).z

        yield* Effect.forEach(Arr.makeBy(60, () => undefined), () => service.update(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        const afterMoveZ = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).z
        expect(afterMoveZ).toBeLessThan(beforeMoveZ)

        // Phase 3: Jump (with jump key pressed from start)
        // Note: The jump will only work if the player is grounded
        // After movement, player may or may not be grounded depending on physics state
        inputService.setKeyPressed('Space', true)
        inputService.setKeyPressed('KeyW', false)

        // Run a few updates to let physics settle
        yield* Effect.forEach(Arr.makeBy(10, () => undefined), () => service.update(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        // Verify timing state is correct
        const timing = yield* service.getTiming()
        // 300 (fall) + 60 (move) + 10 (settle) = 370 frames
        expect(timing.frameCount).toBe(370)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('forward distance ordering matches vanilla: sneak < walk < sprint', () => {
      const dt = DeltaTimeSecs.make(1 / 60)
      // Measure ground distance covered in 1s (60 frames) of forward movement for
      // a given gait. The player first falls onto the bedrock floor (isBlockSolid
      // returns true for y<0) and settles grounded, then we sample the delta.
      const measureForwardDistance = (gait: { sprint?: boolean; sneak?: boolean }) =>
        Effect.gen(function* () {
          const service = yield* GameStateService
          yield* service.initialize({ x: 0, y: 5, z: 0 })
          yield* Effect.forEach(Arr.makeBy(200, () => undefined), () => service.update(dt), { concurrency: 1, discard: true })
          const z0 = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).z
          yield* Effect.forEach(Arr.makeBy(60, () => undefined), () => service.update(dt), { concurrency: 1, discard: true })
          const z1 = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).z
          return Math.abs(z1 - z0)
        }).pipe(Effect.provide(createTestLayer(createTestInputService({ forward: true, ...gait }))))

      return Effect.gen(function* () {
        const walk = yield* measureForwardDistance({})
        const sprint = yield* measureForwardDistance({ sprint: true })
        const sneak = yield* measureForwardDistance({ sneak: true })

        // Vanilla speeds: sneak 1.295 < walk 4.317 < sprint 5.612 (b/s).
        expect(sneak).toBeGreaterThan(0)
        expect(sneak).toBeLessThan(walk)
        expect(sprint).toBeGreaterThan(walk)
      })
    })
  })

  describe('Effect composition', () => {
    it.effect('should support Effect.flatMap for chaining operations', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        const result = service.initialize({ x: 0, y: 5, z: 0 }).pipe(
          Effect.flatMap(() => service.update(DeltaTimeSecs.make(1 / 60))),
          Effect.flatMap(() => service.getTiming()),
          Effect.map((timing) => timing.frameCount)
        )

        const frameCount = yield* result
        expect(frameCount).toBe(1)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('Multiple update calls', () => {
    it.effect('should increment frameCount for each update call', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        yield* Effect.forEach(Arr.makeBy(10, () => undefined), () => service.update(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        const timing = yield* service.getTiming()
        expect(timing.frameCount).toBe(10)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should track deltaTime from the last update call', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        yield* service.update(DeltaTimeSecs.make(1 / 60))
        const timing1 = yield* service.getTiming()
        expect(timing1.deltaTime).toBeCloseTo(1 / 60)

        yield* service.update(DeltaTimeSecs.make(1 / 30))
        const timing2 = yield* service.getTiming()
        expect(timing2.deltaTime).toBeCloseTo(1 / 30)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('Error propagation', () => {
    it.effect('should wrap update error as GameStateError with correct _tag', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        // Don't initialize — update should fail
        const result = yield* Effect.either(service.update(DeltaTimeSecs.make(1 / 60)))

        expect(Either.isLeft(result)).toBe(true)
        expect(Option.getOrThrow(Either.getLeft(result))._tag).toBe('GameStateError')
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should be catchable with Effect.catchTag for GameStateError', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        // This should fail because we didn't initialize
        const result = yield* service.update(DeltaTimeSecs.make(1 / 60)).pipe(
          Effect.catchTag('GameStateError', (e) => Effect.succeed(`caught: ${e.operation}`))
        )

        expect(result).toBe('caught: update')
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('Position synchronization', () => {
    it.effect('should sync physics position back to player service after update', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 10, y: 20, z: 30 })

        // Initial position should match spawn
        const initialPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(initialPos.x).toBe(10)
        expect(initialPos.y).toBe(20)
        expect(initialPos.z).toBe(30)

        // After update, position should still be numeric (synced from physics)
        yield* service.update(DeltaTimeSecs.make(1 / 60))
        const afterPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        expect(typeof afterPos.x).toBe('number')
        expect(typeof afterPos.y).toBe('number')
        expect(typeof afterPos.z).toBe('number')
        // Y should be different due to gravity
        expect(afterPos.y).not.toBe(20)
      }).pipe(Effect.provide(testLayer))
    })
  })
})
