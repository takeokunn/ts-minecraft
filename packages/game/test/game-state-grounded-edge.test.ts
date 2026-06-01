import { describe, it, expect } from '@effect/vitest'
import { Array as Arr, Effect } from 'effect'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { GameStateService } from '@ts-minecraft/game'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import { createTestInputService, createTestLayer } from './game-state-test-utils'

describe('application/game-state (camera & grounded)', () => {
  describe('Initialization edge cases', () => {
    it.effect('should initialize at negative spawn coordinates', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: -100, y: 50, z: -200 })
        const pos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        expect(pos.x).toBe(-100)
        expect(pos.y).toBe(50)
        expect(pos.z).toBe(-200)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('should accept zero spawn position', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 0, z: 0 })
        const pos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        expect(pos.x).toBe(0)
        expect(pos.y).toBe(0)
        expect(pos.z).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('getCameraRotation', () => {
    it.effect('returns { yaw: 0, pitch: 0 } before any updates', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService
        // getCameraRotation delegates to PlayerCameraStateService which starts at (0, 0)
        const rotation = yield* service.getCameraRotation()
        expect(rotation.yaw).toBe(0)
        expect(rotation.pitch).toBe(0)
      }).pipe(Effect.provide(testLayer))
    })

    it.effect('getCameraRotation always returns numeric yaw and pitch', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService
        yield* service.initialize({ x: 0, y: 5, z: 0 })
        yield* service.update(DeltaTimeSecs.make(1 / 60))
        const rotation = yield* service.getCameraRotation()
        expect(typeof rotation.yaw).toBe('number')
        expect(typeof rotation.pitch).toBe('number')
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('isPlayerGrounded before initialization', () => {
    it.effect('should return false when physics not initialized', () => {
      const inputService = createTestInputService()
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        // No initialization
        const grounded = yield* service.isPlayerGrounded()
        expect(grounded).toBe(false)
      }).pipe(Effect.provide(testLayer))
    })
  })

  describe('Strafing movement', () => {
    it.effect('should move player in X direction with left strafe', () => {
      const inputService = createTestInputService({ left: true })
      const testLayer = createTestLayer(inputService)

      return Effect.gen(function* () {
        const service = yield* GameStateService

        yield* service.initialize({ x: 0, y: 5, z: 0 })

        const initialPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        yield* Effect.forEach(Arr.makeBy(60, () => undefined), () => service.update(DeltaTimeSecs.make(1 / 60)), { concurrency: 1 })

        const finalPos = yield* service.getPlayerPosition(DEFAULT_PLAYER_ID)

        // Left strafe at yaw=0: x should decrease (negative X direction)
        expect(finalPos.x).toBeLessThan(initialPos.x)
      }).pipe(Effect.provide(testLayer))
    })
  })
})
