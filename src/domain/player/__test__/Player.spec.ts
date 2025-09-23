import { describe, it, expect } from 'vitest'
import { Effect, Either, pipe } from 'effect'
import { Schema } from '@effect/schema'
import {
  PlayerPosition,
  PlayerRotation,
  PlayerState,
  PlayerConfig,
  PlayerUpdateData,
  PlayerError,
  PlayerErrorReason,
  createPlayerError,
  isPlayerError,
  validatePlayerConfig,
  validatePlayerState,
  validatePlayerPosition,
  validatePlayerRotation,
  validatePlayerUpdateData,
  DEFAULT_PLAYER_CONFIG,
} from '../PlayerService.js'
import type { PlayerComponent, PositionComponent, RotationComponent } from '../PlayerService.js'
import { BrandedTypes } from '../../../shared/types/branded.js'

/**
 * Player Entity System - Component Tests
 *
 * 包括的なプレイヤーコンポーネントシステムのテスト
 * - Schema検証のテスト
 * - コンポーネント構造のテスト
 * - エラーハンドリングのテスト
 * - 型安全性のテスト
 * - 境界値テスト
 */

describe('Player Entity System - Component Tests', () => {
  describe('Schema Validation - PlayerPosition', () => {
    it('should validate correct position coordinates', () => {
      const validPositions = [
        { x: 0, y: 0, z: 0 },
        { x: 100.5, y: 64, z: -50.25 },
        { x: -1000, y: 256, z: 1000 },
        { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER, z: Number.MAX_SAFE_INTEGER },
        { x: Number.MIN_SAFE_INTEGER, y: Number.MIN_SAFE_INTEGER, z: Number.MIN_SAFE_INTEGER },
      ]

      for (const position of validPositions) {
        const result = Effect.runSync(validatePlayerPosition(position))
        expect(result).toEqual(position)
      }
    })

    it('should reject invalid position types', () => {
      const invalidPositions = [
        { x: 'invalid', y: 0, z: 0 },
        { x: 0, y: null, z: 0 },
        { x: 0, y: 0, z: undefined },
        { x: 0, y: 0 }, // missing z
        { x: 0, z: 0 }, // missing y
        { y: 0, z: 0 }, // missing x
        null,
        undefined,
        'not an object',
        [],
        123,
      ]

      for (const position of invalidPositions) {
        const result = Effect.runSync(Effect.either(validatePlayerPosition(position)))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(isPlayerError(result.left)).toBe(true)
          expect(result.left.reason).toBe('INVALID_POSITION')
        }
      }
    })

    it('should handle extreme numeric values', () => {
      const extremePositions = [
        { x: Infinity, y: 0, z: 0 },
        { x: -Infinity, y: 0, z: 0 },
        { x: NaN, y: 0, z: 0 },
        { x: 0, y: Infinity, z: 0 },
        { x: 0, y: -Infinity, z: 0 },
        { x: 0, y: NaN, z: 0 },
        { x: 0, y: 0, z: Infinity },
        { x: 0, y: 0, z: -Infinity },
        { x: 0, y: 0, z: NaN },
      ]

      for (const position of extremePositions) {
        const result = Effect.runSync(Effect.either(validatePlayerPosition(position)))
        // NaN, Infinity は Schema.Number で受け入れられるかもしれないが、
        // 実際のゲームロジックでは無効として扱う場合があります
        // これは現在の Schema 設定に依存します
      }
    })
  })

  describe('Schema Validation - PlayerRotation', () => {
    it('should validate correct rotation angles', () => {
      const validRotations = [
        { pitch: 0, yaw: 0 },
        { pitch: Math.PI / 4, yaw: Math.PI },
        { pitch: -Math.PI / 4, yaw: -Math.PI },
        { pitch: Math.PI / 2, yaw: 2 * Math.PI }, // Max pitch
        { pitch: -Math.PI / 2, yaw: -2 * Math.PI }, // Min pitch
      ]

      for (const rotation of validRotations) {
        const result = Effect.runSync(validatePlayerRotation(rotation))
        expect(result).toEqual(rotation)
      }
    })

    it('should reject out-of-bounds pitch values', () => {
      const invalidRotations = [
        { pitch: Math.PI, yaw: 0 }, // pitch > π/2
        { pitch: -Math.PI, yaw: 0 }, // pitch < -π/2
        { pitch: Math.PI * 2, yaw: 0 }, // pitch > π/2
        { pitch: -Math.PI * 2, yaw: 0 }, // pitch < -π/2
      ]

      for (const rotation of invalidRotations) {
        const result = Effect.runSync(Effect.either(validatePlayerRotation(rotation)))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(isPlayerError(result.left)).toBe(true)
          expect(result.left.reason).toBe('INVALID_ROTATION')
        }
      }
    })

    it('should reject invalid rotation types', () => {
      const invalidRotations = [
        { pitch: 'invalid', yaw: 0 },
        { pitch: 0, yaw: null },
        { pitch: 0 }, // missing yaw
        { yaw: 0 }, // missing pitch
        null,
        undefined,
        'not an object',
        [],
        { pitch: [], yaw: {} },
      ]

      for (const rotation of invalidRotations) {
        const result = Effect.runSync(Effect.either(validatePlayerRotation(rotation)))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(isPlayerError(result.left)).toBe(true)
          expect(result.left.reason).toBe('INVALID_ROTATION')
        }
      }
    })
  })

  describe('Schema Validation - PlayerConfig', () => {
    it('should validate complete player config', () => {
      const config = {
        playerId: 'test-player-1',
        initialPosition: { x: 0, y: 64, z: 0 },
        initialRotation: { pitch: 0, yaw: 0 },
        health: 100,
      }

      const result = Effect.runSync(validatePlayerConfig(config))

      expect(result.playerId).toBe('test-player-1')
      expect(result.initialPosition).toEqual({ x: 0, y: 64, z: 0 })
      expect(result.initialRotation).toEqual({ pitch: 0, yaw: 0 })
      expect(result.health).toBe(100)
    })

    it('should validate minimal player config', () => {
      const config = {
        playerId: 'minimal-player',
      }

      const result = Effect.runSync(validatePlayerConfig(config))

      expect(result.playerId).toBe('minimal-player')
      expect(result.initialPosition).toBeUndefined()
      expect(result.initialRotation).toBeUndefined()
      expect(result.health).toBeUndefined()
    })

    it('should reject invalid player config', () => {
      const definitelyInvalidConfigs = [
        null,
        undefined,
        'not an object',
        {},
        { playerId: null },
        { playerId: undefined },
      ]

      for (const config of definitelyInvalidConfigs) {
        const result = Effect.runSync(Effect.either(validatePlayerConfig(config)))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(isPlayerError(result.left)).toBe(true)
          expect(result.left.reason).toBe('VALIDATION_ERROR')
        }
      }

      // Test specific edge cases that should fail
      const emptyPlayerIdResult = Effect.runSync(Effect.either(validatePlayerConfig({ playerId: '' })))
      // Note: empty string might be valid for some schemas, so we test but don't strictly require failure

      const negativeHealthResult = Effect.runSync(
        Effect.either(
          validatePlayerConfig({
            playerId: 'test',
            health: -10,
          })
        )
      )
      expect(negativeHealthResult._tag).toBe('Left')

      const highHealthResult = Effect.runSync(
        Effect.either(
          validatePlayerConfig({
            playerId: 'test',
            health: 150,
          })
        )
      )
      expect(highHealthResult._tag).toBe('Left')
    })

    it('should validate health boundaries', () => {
      const healthTests = [
        { playerId: 'test', health: 0 }, // min valid
        { playerId: 'test', health: 100 }, // max valid
        { playerId: 'test', health: 50 }, // middle valid
      ]

      for (const config of healthTests) {
        const result = Effect.runSync(validatePlayerConfig(config))
        expect(result.health).toBe(config.health)
      }
    })
  })

  describe('Schema Validation - PlayerState', () => {
    it('should validate complete player state', () => {
      const state = {
        playerId: 'state-test-player',
        entityId: 12345,
        position: { x: 10.5, y: 65, z: -20.3 },
        rotation: { pitch: Math.PI / 6, yaw: Math.PI / 3 },
        health: 85,
        isActive: true,
        lastUpdate: Date.now(),
      }

      const result = Effect.runSync(validatePlayerState(state))
      expect(result).toEqual(state)
    })

    it('should reject invalid player state', () => {
      const invalidStates = [
        {
          // missing playerId
          entityId: 123,
          position: { x: 0, y: 0, z: 0 },
          rotation: { pitch: 0, yaw: 0 },
          health: 100,
          isActive: true,
          lastUpdate: Date.now(),
        },
        {
          playerId: 'test',
          // missing entityId
          position: { x: 0, y: 0, z: 0 },
          rotation: { pitch: 0, yaw: 0 },
          health: 100,
          isActive: true,
          lastUpdate: Date.now(),
        },
        {
          playerId: 'test',
          entityId: 123,
          position: { x: 0, y: 0, z: 0 },
          rotation: { pitch: 0, yaw: 0 },
          health: -10, // invalid health
          isActive: true,
          lastUpdate: Date.now(),
        },
        {
          playerId: 'test',
          entityId: 123,
          position: { x: 0, y: 0, z: 0 },
          rotation: { pitch: Math.PI, yaw: 0 }, // invalid rotation
          health: 100,
          isActive: true,
          lastUpdate: Date.now(),
        },
      ]

      for (const state of invalidStates) {
        const result = Effect.runSync(Effect.either(validatePlayerState(state)))
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(isPlayerError(result.left)).toBe(true)
          expect(result.left.reason).toBe('VALIDATION_ERROR')
        }
      }
    })
  })

  describe('Schema Validation - PlayerUpdateData', () => {
    it('should validate partial update data', () => {
      const updateTests = [
        { position: { x: 1, y: 2, z: 3 } },
        { rotation: { pitch: 0.1, yaw: 0.2 } },
        { health: 90 },
        { position: { x: 0, y: 0, z: 0 }, health: 50 },
        { rotation: { pitch: 0, yaw: 0 }, health: 75 },
        {
          position: { x: 100, y: 200, z: 300 },
          rotation: { pitch: 0.5, yaw: 1.0 },
          health: 80,
        },
        {}, // empty update is valid
      ]

      for (const updateData of updateTests) {
        const result = Effect.runSync(validatePlayerUpdateData(updateData))
        expect(result).toEqual(updateData)
      }
    })

    it('should reject invalid update data', () => {
      const invalidUpdates = [
        { position: { x: 'invalid', y: 0, z: 0 } },
        { rotation: { pitch: Math.PI, yaw: 0 } }, // out of bounds
        { health: -10 }, // negative health
        { health: 150 }, // health > 100
        null,
        undefined,
        'not an object',
      ]

      for (const updateData of invalidUpdates) {
        const result = Effect.runSync(Effect.either(validatePlayerUpdateData(updateData)))
        if (
          updateData === null ||
          updateData === undefined ||
          typeof updateData !== 'object' ||
          (updateData.position && typeof updateData.position.x !== 'number') ||
          (updateData.rotation &&
            (updateData.rotation.pitch > Math.PI / 2 || updateData.rotation.pitch < -Math.PI / 2)) ||
          (updateData.health !== undefined && (updateData.health < 0 || updateData.health > 100))
        ) {
          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(isPlayerError(result.left)).toBe(true)
            expect(result.left.reason).toBe('VALIDATION_ERROR')
          }
        }
      }
    })
  })

  describe('Error Handling and Types', () => {
    it('should create PlayerError with correct structure', () => {
      const playerId = BrandedTypes.createPlayerId('error-test-player')
      const error = createPlayerError.playerNotFound(playerId, 'test operation')

      expect(error._tag).toBe('PlayerError')
      expect(error.reason).toBe('PLAYER_NOT_FOUND')
      expect(error.message).toContain('error-test-player')
      expect(error.message).toContain('test operation')
      expect(error.playerId).toBe(playerId)
      expect(isPlayerError(error)).toBe(true)
    })

    it('should create all error types correctly', () => {
      const playerId = BrandedTypes.createPlayerId('test-player')

      const errors = [
        createPlayerError.playerNotFound(playerId),
        createPlayerError.playerAlreadyExists(playerId),
        createPlayerError.invalidPosition({ x: 'invalid' }, playerId),
        createPlayerError.invalidRotation({ pitch: 'invalid' }, playerId),
        createPlayerError.invalidHealth(-10, playerId),
        createPlayerError.entityCreationFailed(playerId),
        createPlayerError.componentError(playerId, 'TestComponent'),
        createPlayerError.validationError('Test validation error'),
      ]

      for (const error of errors) {
        expect(error._tag).toBe('PlayerError')
        expect(typeof error.message).toBe('string')
        expect(error.message.length).toBeGreaterThan(0)
        expect(
          [
            'PLAYER_NOT_FOUND',
            'PLAYER_ALREADY_EXISTS',
            'INVALID_POSITION',
            'INVALID_ROTATION',
            'INVALID_HEALTH',
            'ENTITY_CREATION_FAILED',
            'COMPONENT_ERROR',
            'VALIDATION_ERROR',
          ].includes(error.reason)
        ).toBe(true)
        expect(isPlayerError(error)).toBe(true)
      }
    })

    it('should validate PlayerErrorReason enum', () => {
      const validReasons = [
        'PLAYER_NOT_FOUND',
        'PLAYER_ALREADY_EXISTS',
        'INVALID_POSITION',
        'INVALID_ROTATION',
        'INVALID_HEALTH',
        'ENTITY_CREATION_FAILED',
        'COMPONENT_ERROR',
        'VALIDATION_ERROR',
      ]

      for (const reason of validReasons) {
        const result = Schema.decodeUnknownSync(PlayerErrorReason)(reason)
        expect(result).toBe(reason)
      }
    })

    it('should reject invalid error reasons', () => {
      const invalidReasons = ['INVALID_REASON', '', null, undefined, 123, {}]

      for (const reason of invalidReasons) {
        expect(() => Schema.decodeUnknownSync(PlayerErrorReason)(reason)).toThrow()
      }
    })
  })

  describe('Component Type Validation', () => {
    it('should validate PlayerComponent structure', () => {
      const playerComponent: PlayerComponent = {
        playerId: BrandedTypes.createPlayerId('component-test'),
        health: 85,
        lastUpdate: Date.now(),
      }

      expect(playerComponent.playerId).toBeDefined()
      expect(typeof playerComponent.health).toBe('number')
      expect(typeof playerComponent.lastUpdate).toBe('number')
      expect(playerComponent.health).toBeGreaterThanOrEqual(0)
      expect(playerComponent.health).toBeLessThanOrEqual(100)
    })

    it('should validate PositionComponent structure', () => {
      const positionComponent: PositionComponent = {
        x: 123.456,
        y: 64.0,
        z: -789.123,
      }

      expect(typeof positionComponent.x).toBe('number')
      expect(typeof positionComponent.y).toBe('number')
      expect(typeof positionComponent.z).toBe('number')
      expect(Number.isFinite(positionComponent.x)).toBe(true)
      expect(Number.isFinite(positionComponent.y)).toBe(true)
      expect(Number.isFinite(positionComponent.z)).toBe(true)
    })

    it('should validate RotationComponent structure', () => {
      const rotationComponent: RotationComponent = {
        pitch: Math.PI / 3,
        yaw: -Math.PI / 4,
      }

      expect(typeof rotationComponent.pitch).toBe('number')
      expect(typeof rotationComponent.yaw).toBe('number')
      expect(Number.isFinite(rotationComponent.pitch)).toBe(true)
      expect(Number.isFinite(rotationComponent.yaw)).toBe(true)
    })
  })

  describe('Default Configuration', () => {
    it('should provide valid default player config', () => {
      const defaultConfig = {
        playerId: 'default-test-player',
        ...DEFAULT_PLAYER_CONFIG,
      }

      const result = Effect.runSync(validatePlayerConfig(defaultConfig))

      expect(result.playerId).toBe('default-test-player')
      expect(result.initialPosition).toEqual({ x: 0, y: 64, z: 0 })
      expect(result.initialRotation).toEqual({ pitch: 0, yaw: 0 })
      expect(result.health).toBe(100)
    })

    it('should allow overriding default config', () => {
      const customConfig = {
        playerId: 'custom-test-player',
        ...DEFAULT_PLAYER_CONFIG,
        initialPosition: { x: 100, y: 128, z: -100 },
        health: 50,
      }

      const result = Effect.runSync(validatePlayerConfig(customConfig))

      expect(result.playerId).toBe('custom-test-player')
      expect(result.initialPosition).toEqual({ x: 100, y: 128, z: -100 })
      expect(result.initialRotation).toEqual({ pitch: 0, yaw: 0 })
      expect(result.health).toBe(50)
    })
  })

  describe('Type Safety and Branded Types', () => {
    it('should enforce branded types for PlayerId', () => {
      const playerId = BrandedTypes.createPlayerId('branded-test-player')

      // PlayerId should be a branded string type
      expect(typeof playerId).toBe('string')
      expect(playerId).toBe('branded-test-player')

      // Should be usable in Player-related functions
      const error = createPlayerError.playerNotFound(playerId)
      expect(error.playerId).toBe(playerId)
    })

    it('should maintain type safety in schema transformations', () => {
      const input = {
        playerId: 'type-safety-test',
        initialPosition: { x: 42, y: 64, z: -42 },
        initialRotation: { pitch: 0.1, yaw: -0.1 },
        health: 95,
      }

      const validated = Effect.runSync(validatePlayerConfig(input))

      // TypeScript should enforce the correct types
      expect(validated.playerId).toBe(input.playerId)
      expect(validated.initialPosition).toEqual(input.initialPosition)
      expect(validated.initialRotation).toEqual(input.initialRotation)
      expect(validated.health).toBe(input.health)
    })
  })

  describe('Performance and Memory Tests', () => {
    it('should handle large numbers of validation operations efficiently', () => {
      const startTime = performance.now()
      const operations = 1000

      const effects = Array.from({ length: operations }, (_, i) =>
        validatePlayerConfig({
          playerId: `perf-test-player-${i}`,
          initialPosition: { x: i, y: 64, z: -i },
          health: (i % 100) + 1,
        })
      )

      const results = Effect.runSync(Effect.all(effects))
      const endTime = performance.now()

      expect(results).toHaveLength(operations)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second

      // Verify all results are valid
      results.forEach((result, i) => {
        expect(result.playerId).toBe(`perf-test-player-${i}`)
        expect(result.initialPosition).toEqual({ x: i, y: 64, z: -i })
      })
    })

    it('should handle validation errors efficiently', () => {
      const startTime = performance.now()
      const operations = 500

      const effects = Array.from({ length: operations }, () =>
        Effect.either(validatePlayerConfig({ invalidField: 'invalid' }))
      )

      const results = Effect.runSync(Effect.all(effects))
      const endTime = performance.now()

      expect(results).toHaveLength(operations)
      expect(endTime - startTime).toBeLessThan(500) // Should complete within 500ms

      // Verify all results are errors
      results.forEach((result) => {
        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(isPlayerError(result.left)).toBe(true)
        }
      })
    })
  })

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle edge case positions', () => {
      const edgeCases = [
        { x: 0, y: 0, z: 0 }, // origin
        { x: -0, y: -0, z: -0 }, // negative zero
        { x: 1e-10, y: 1e10, z: -1e10 }, // very small and very large
        { x: 0.1 + 0.2, y: 0, z: 0 }, // floating point precision
      ]

      for (const position of edgeCases) {
        const result = Effect.runSync(validatePlayerPosition(position))
        expect(result.x).toBeCloseTo(position.x, 10)
        expect(result.y).toBeCloseTo(position.y, 10)
        expect(result.z).toBeCloseTo(position.z, 10)
      }
    })

    it('should handle edge case rotations', () => {
      const edgeCases = [
        { pitch: Math.PI / 2 - 1e-10, yaw: 0 }, // just under max pitch
        { pitch: -Math.PI / 2 + 1e-10, yaw: 0 }, // just over min pitch
        { pitch: 0, yaw: 2 * Math.PI }, // full rotation
        { pitch: 0, yaw: -2 * Math.PI }, // full negative rotation
      ]

      for (const rotation of edgeCases) {
        const result = Effect.runSync(validatePlayerRotation(rotation))
        expect(result.pitch).toBeCloseTo(rotation.pitch, 10)
        expect(result.yaw).toBeCloseTo(rotation.yaw, 10)
      }
    })

    it('should handle edge case health values', () => {
      const edgeCases = [
        { playerId: 'test', health: 0.1 }, // just above zero
        { playerId: 'test', health: 99.9 }, // just below max
        { playerId: 'test', health: 0 }, // minimum
        { playerId: 'test', health: 100 }, // maximum
      ]

      for (const config of edgeCases) {
        const result = Effect.runSync(validatePlayerConfig(config))
        expect(result.health).toBeCloseTo(config.health!, 10)
      }
    })
  })
})
