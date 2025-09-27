import { describe, it, expect } from 'vitest'
import { Effect, Either } from 'effect'
import type { PlayerId } from '@/shared/types/branded'
import type { Vector3D } from '@/shared/types/spatial-brands'
import { FurnitureService } from '../services/FurnitureService'
import { FurnitureServiceLive } from '../services/FurnitureServiceLive'

describe('FurnitureService Basic Tests', () => {
  describe('Type Safety and Structure', () => {
    it('should have correct service structure', async () => {
      const result = await Effect.gen(function* () {
        const service = yield* FurnitureService

        // Test that all methods exist and return appropriate types
        expect(typeof service.placeBed).toBe('function')
        expect(typeof service.sleepInBed).toBe('function')
        expect(typeof service.wakeUp).toBe('function')
        expect(typeof service.placeSign).toBe('function')
        expect(typeof service.editSign).toBe('function')
        expect(typeof service.writeBook).toBe('function')
      }).pipe(Effect.provide(FurnitureServiceLive), Effect.runPromise)
    })

    it('should fail with proper error types', async () => {
      await Effect.gen(function* () {
        const service = yield* FurnitureService

        const position: Vector3D = { x: 10, y: 64, z: 10 } as Vector3D
        const playerId = 'test-player' as PlayerId

        // Test bed placement failure
        const bedResult = yield* service.placeBed(position, 'red', 'north', playerId).pipe(Effect.either)

        expect(Either.isLeft(bedResult)).toBe(true)
        if (Either.isLeft(bedResult)) {
          expect(bedResult.left._tag).toBe('FurnitureError')
          expect(typeof bedResult.left.reason).toBe('string')
          expect(typeof bedResult.left.message).toBe('string')
        }
      }).pipe(Effect.provide(FurnitureServiceLive), Effect.runPromise)
    })

    it('should handle spawn point setting without errors', async () => {
      await Effect.gen(function* () {
        const service = yield* FurnitureService

        const position: Vector3D = { x: 100, y: 64, z: 100 } as Vector3D
        const playerId = 'respawner' as PlayerId

        // This should succeed (no-op in our stub)
        yield* service.setSpawnPoint(playerId, position)
      }).pipe(Effect.provide(FurnitureServiceLive), Effect.runPromise)
    })
  })
})
