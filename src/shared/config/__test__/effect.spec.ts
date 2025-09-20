import { Effect, Schema } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  BlockTypeIdSchema,
  BrandedTypes,
  ChunkIdSchema,
  PlayerIdSchema,
  WorldCoordinateSchema,
} from '../../types/branded'
import { createGameError, EffectConfig, GameErrorSchema } from '../effect'

describe('Effect-TS Configuration', () => {
  describe('GameError', () => {
    it('should create a GameError with required fields', () => {
      const error = createGameError('Test error', 'TEST_ERROR')

      expect(error.message).toBe('Test error')
      expect(error.code).toBe('TEST_ERROR')
      expect(error.timestamp).toBeInstanceOf(Date)
      expect(error._tag).toBe('GameError')
    })

    it('should validate GameError schema', () => {
      const error = createGameError('Test error', 'TEST_ERROR')

      expect(Schema.is(GameErrorSchema)(error)).toBe(true)
    })

    it('should create GameError with default code', () => {
      const error = createGameError('Test message')

      expect(error.message).toBe('Test message')
      expect(error.code).toBe('UNKNOWN_ERROR')
      expect(error._tag).toBe('GameError')
    })
  })

  describe('EffectConfig', () => {
    it('should create successful Effect', async () => {
      const effect = EffectConfig.succeed('test value')
      const result = await Effect.runPromise(effect)

      expect(result).toBe('test value')
    })

    it('should create failed Effect', async () => {
      const effect = EffectConfig.fail('Test error', 'TEST_CODE')

      const result = await Effect.runPromise(Effect.either(effect))

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(EffectConfig.isGameError(result.left)).toBe(true)
        if (EffectConfig.isGameError(result.left)) {
          expect(result.left.message).toBe('Test error')
          expect(result.left.code).toBe('TEST_CODE')
        }
      }
    })

    it('should identify GameError correctly', () => {
      const gameError = createGameError('Test error')
      const regularObject = { message: 'Not a game error' }

      expect(EffectConfig.isGameError(gameError)).toBe(true)
      expect(EffectConfig.isGameError(regularObject)).toBe(false)
    })

    it('should validate using schema', async () => {
      const stringSchema = Schema.String
      const validator = EffectConfig.validate(stringSchema)

      const validEffect = validator('valid string')
      const result = await Effect.runPromise(validEffect)
      expect(result).toBe('valid string')

      const invalidEffect = validator(123 as unknown as string) // 数値を渡して型エラーを発生させる
      const invalidResult = await Effect.runPromise(Effect.either(invalidEffect))

      expect(invalidResult._tag).toBe('Left')
      if (invalidResult._tag === 'Left') {
        expect(EffectConfig.isGameError(invalidResult.left)).toBe(true)
        if (EffectConfig.isGameError(invalidResult.left)) {
          expect(invalidResult.left.code).toBe('VALIDATION_ERROR')
        }
      }
    })
  })

  describe('Branded Types', () => {
    it('should create PlayerId safely', () => {
      const playerId = BrandedTypes.createPlayerId('player_123')
      expect(playerId).toBe('player_123')

      // Schema validation
      expect(Schema.is(PlayerIdSchema)(playerId)).toBe(true)
    })

    it('should create WorldCoordinate safely', () => {
      const coordinate = BrandedTypes.createWorldCoordinate(100.5)
      expect(coordinate).toBe(100.5)

      // Schema validation
      expect(Schema.is(WorldCoordinateSchema)(coordinate)).toBe(true)
    })

    it('should create ChunkId safely', () => {
      const chunkId = BrandedTypes.createChunkId('chunk_1_2')
      expect(chunkId).toBe('chunk_1_2')

      // Schema validation
      expect(Schema.is(ChunkIdSchema)(chunkId)).toBe(true)
    })

    it('should create BlockTypeId safely', () => {
      const blockTypeId = BrandedTypes.createBlockTypeId(1)
      expect(blockTypeId).toBe(1)

      // Schema validation
      expect(Schema.is(BlockTypeIdSchema)(blockTypeId)).toBe(true)
    })

    it('should reject invalid BlockTypeId', () => {
      expect(() => BrandedTypes.createBlockTypeId(-1)).toThrow()
      expect(() => BrandedTypes.createBlockTypeId(0)).toThrow()
      expect(() => BrandedTypes.createBlockTypeId(1.5)).toThrow()
    })
  })

  describe('Schema Integration', () => {
    it('should decode branded types using Schema', () => {
      const playerIdResult = Schema.decodeUnknownSync(PlayerIdSchema)('test_player')
      const coordinateResult = Schema.decodeUnknownSync(WorldCoordinateSchema)(42.0)
      const chunkIdResult = Schema.decodeUnknownSync(ChunkIdSchema)('chunk_0_0')
      const blockTypeResult = Schema.decodeUnknownSync(BlockTypeIdSchema)(5)

      expect(playerIdResult).toBe('test_player')
      expect(coordinateResult).toBe(42.0)
      expect(chunkIdResult).toBe('chunk_0_0')
      expect(blockTypeResult).toBe(5)
    })

    it('should validate GameError schema', () => {
      const error = createGameError('Validation test', 'VALIDATION_ERROR')

      expect(error.message).toBe('Validation test')
      expect(error.code).toBe('VALIDATION_ERROR')
      expect(error._tag).toBe('GameError')
      expect(Schema.is(GameErrorSchema)(error)).toBe(true)
    })
  })
})
