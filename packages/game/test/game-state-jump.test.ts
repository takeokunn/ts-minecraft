import { describe, it, expect } from '@effect/vitest'
import { Array as Arr, Effect } from 'effect'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import {
  GameStateService,
} from '@ts-minecraft/game'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import { createTestInputService, createTestLayer } from './game-state-test-utils'

describe('application/game-state (core)', () => {
  describe('Jump mechanics', () => {
    it.effect('should apply jump velocity when jump is pressed and grounded', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        yield* Effect.forEach(Arr.makeBy(300, () => undefined), () => service.update(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        const groundLevelY = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).y

        inputService.simulateKeyPress('Space')

        yield* service.update(DeltaTimeSecs.make(1 / 60))

        const afterJumpY = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).y
        expect(afterJumpY).toBeGreaterThan(groundLevelY)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should clear grounded state when jumping', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        yield* Effect.forEach(Arr.makeBy(300, () => undefined), () => service.update(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        inputService.simulateKeyPress('Space')

        yield* service.update(DeltaTimeSecs.make(1 / 60))

        const isGroundedAfter = yield* service.isPlayerGrounded()
        expect(isGroundedAfter).toBe(false)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('air control: a held movement key steers the player horizontally while airborne (lets you clear 1-block obstacles)', () => {
      // Regression guard: previously horizontal velocity was frozen on leaving the
      // ground, so a player who walked into a block and jumped could not move
      // forward over it. Air control re-applies the input velocity mid-air.
      const inputService = createTestInputService({ forward: true })
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        // Spawn high so the player is airborne (falling), not grounded.
        yield* service.initialize({ x: 0, y: 80, z: 0 })

        const grounded = yield* service.isPlayerGrounded()
        const before = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)
        yield* service.update(DeltaTimeSecs.make(1 / 60))
        const after = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        expect(grounded).toBe(false)
        // With forward held + air control, the player moves horizontally even while
        // airborne (old buggy behavior: zero horizontal movement in the air).
        const horizontalMoved = Math.hypot(after.x - before.x, after.z - before.z)
        expect(horizontalMoved).toBeGreaterThan(0.01)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should not jump when not grounded (in air)', () => {
      const inputService = createTestInputService({ jump: true })
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const isGrounded = yield* service.isPlayerGrounded()
        expect(isGrounded).toBe(false)

        const initialY = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).y

        yield* service.update(DeltaTimeSecs.make(1 / 60))

        const afterUpdateY = (yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)).y

        expect(afterUpdateY).toBeLessThan(initialY)
      }).pipe(Effect.provide(testLayer))
    })
  })
})
