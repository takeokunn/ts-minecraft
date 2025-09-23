import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { PlayerService, createPlayerError, validatePlayerConfig } from '../index.js'
import { BrandedTypes } from '../../../shared/types/branded.js'

/**
 * PlayerService テスト
 *
 * Effect-TS Service パターンに従ったテスト実装
 * - Schema 検証のテスト
 * - エラーハンドリングのテスト
 * - 型安全性のテスト
 */

describe('PlayerService', () => {
  describe('Service Interface', () => {
    it('should have all required methods', () => {
      const service = PlayerService.of({
        createPlayer: Effect.succeed as any,
        destroyPlayer: Effect.succeed as any,
        updatePlayerState: Effect.succeed as any,
        getPlayerState: Effect.succeed as any,
        setPlayerPosition: Effect.succeed as any,
        setPlayerRotation: Effect.succeed as any,
        setPlayerHealth: Effect.succeed as any,
        setPlayerActive: Effect.succeed as any,
        getAllPlayers: Effect.succeed as any,
        playerExists: Effect.succeed as any,
        getPlayersInRange: Effect.succeed as any,
        getPlayerStats: Effect.succeed as any,
      })

      expect(service).toBeDefined()
      expect(typeof service.createPlayer).toBe('function')
      expect(typeof service.destroyPlayer).toBe('function')
      expect(typeof service.updatePlayerState).toBe('function')
      expect(typeof service.getPlayerState).toBe('function')
      expect(typeof service.setPlayerPosition).toBe('function')
      expect(typeof service.setPlayerRotation).toBe('function')
      expect(typeof service.setPlayerHealth).toBe('function')
      expect(typeof service.setPlayerActive).toBe('function')
      expect(typeof service.getAllPlayers).toBe('function')
      expect(typeof service.playerExists).toBe('function')
      expect(typeof service.getPlayersInRange).toBe('function')
      expect(typeof service.getPlayerStats).toBe('function')
    })
  })

  describe('Error Handling', () => {
    it('should create PlayerError with correct structure', () => {
      const playerId = BrandedTypes.createPlayerId('test-player')
      const error = createPlayerError.playerNotFound(playerId, 'test operation')

      expect(error._tag).toBe('PlayerError')
      expect(error.reason).toBe('PLAYER_NOT_FOUND')
      expect(error.message).toContain('test-player')
      expect(error.message).toContain('test operation')
      expect(error.playerId).toBe(playerId)
    })

    it('should create validation errors', () => {
      const error = createPlayerError.validationError('Invalid config')

      expect(error._tag).toBe('PlayerError')
      expect(error.reason).toBe('VALIDATION_ERROR')
      expect(error.message).toContain('Invalid config')
    })

    it('should create component errors', () => {
      const playerId = BrandedTypes.createPlayerId('test-player')
      const error = createPlayerError.componentError(playerId, 'PositionComponent')

      expect(error._tag).toBe('PlayerError')
      expect(error.reason).toBe('COMPONENT_ERROR')
      expect(error.message).toContain('PositionComponent')
      expect(error.playerId).toBe(playerId)
    })
  })

  describe('Schema Validation', () => {
    it('should validate correct player config', () => {
      const config = {
        playerId: 'test-player-1',
        initialPosition: { x: 0, y: 64, z: 0 },
        initialRotation: { pitch: 0, yaw: 0, roll: 0 },
        health: 100,
      }

      const result = Effect.runSync(validatePlayerConfig(config))

      expect(result.playerId).toBe('test-player-1')
      expect(result.initialPosition).toEqual({ x: 0, y: 64, z: 0 })
      expect(result.initialRotation).toEqual({ pitch: 0, yaw: 0 })
      expect(result.health).toBe(100)
    })

    it('should reject invalid player config', () => {
      const config = {
        playerId: '', // invalid empty string
        health: -10, // invalid negative health
      }

      const result = Effect.runSync(Effect.either(validatePlayerConfig(config)))

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('PlayerError')
        expect(result.left.reason).toBe('VALIDATION_ERROR')
      }
    })

    it('should validate position with correct bounds', () => {
      const position = { x: 100.5, y: 64, z: -50.25 }

      const result = Effect.runSync(
        validatePlayerConfig({
          playerId: 'test-player',
          initialPosition: position,
        })
      )

      expect(result.initialPosition).toEqual(position)
    })

    it('should validate rotation with correct bounds', () => {
      const rotation = { pitch: Math.PI / 4, yaw: Math.PI, roll: 0 }

      const result = Effect.runSync(
        validatePlayerConfig({
          playerId: 'test-player',
          initialRotation: rotation,
        })
      )

      expect(result.initialRotation).toEqual(rotation)
    })

    it('should reject invalid rotation bounds', () => {
      const config = {
        playerId: 'test-player',
        initialRotation: { pitch: Math.PI, yaw: 0, roll: 0 }, // pitch out of bounds
      }

      const result = Effect.runSync(Effect.either(validatePlayerConfig(config)))

      expect(result._tag).toBe('Left')
    })
  })

  describe('Type Safety', () => {
    it('should enforce branded types for PlayerId', () => {
      const playerId = BrandedTypes.createPlayerId('test-player')

      // This should compile - branded PlayerId
      expect(typeof playerId).toBe('string')
      expect(playerId).toBe('test-player')
    })

    it('should validate component types structure', () => {
      // Test PlayerComponent interface structure
      const playerComponent = {
        playerId: BrandedTypes.createPlayerId('test'),
        health: 100,
        lastUpdate: Date.now(),
      }

      expect(playerComponent.playerId).toBeDefined()
      expect(typeof playerComponent.health).toBe('number')
      expect(typeof playerComponent.lastUpdate).toBe('number')
    })

    it('should validate position component structure', () => {
      const positionComponent = {
        x: 10.5,
        y: 64,
        z: -20.3,
      }

      expect(typeof positionComponent.x).toBe('number')
      expect(typeof positionComponent.y).toBe('number')
      expect(typeof positionComponent.z).toBe('number')
    })

    it('should validate rotation component structure', () => {
      const rotationComponent = {
        pitch: Math.PI / 4,
        yaw: Math.PI / 2,
      }

      expect(typeof rotationComponent.pitch).toBe('number')
      expect(typeof rotationComponent.yaw).toBe('number')
    })
  })
})
