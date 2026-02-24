import { describe, it, expect } from 'vitest'
import { Effect, Schema } from 'effect'
import {
  WorldIdSchema,
  PlayerIdSchema,
  BlockIdSchema,
  PositionSchema,
} from './kernel'

describe('shared/kernel', () => {
  describe('WorldId', () => {
    it('should create valid WorldId', () => {
      const result = WorldIdSchema.make('test-world-1')
      expect(result).toBe('test-world-1')
    })

    it('should decode and encode WorldId', () => {
      const worldId = WorldIdSchema.make('test-world-2')
      expect(worldId).toBe('test-world-2')
    })

    it('should decode unknown string to WorldId', () => {
      const result = Schema.decodeUnknownSync(WorldIdSchema)('test-world-4')
      expect(result).toBe('test-world-4')
    })

    it('should encode WorldId back to string', () => {
      const worldId = WorldIdSchema.make('test-world-5')
      const encoded = Schema.encodeSync(WorldIdSchema)(worldId)
      expect(encoded).toBe('test-world-5')
    })

    it('should validate WorldId type with Schema.is (positive)', () => {
      const worldId = WorldIdSchema.make('test-world-3')
      // Schema.is accepts branded types (which are strings at runtime)
      expect(Schema.is(WorldIdSchema)(worldId)).toBe(true)
    })
  })

  describe('PlayerId', () => {
    it('should create valid PlayerId', () => {
      const result = PlayerIdSchema.make('player-123')
      expect(result).toBe('player-123')
    })

    it('should decode unknown string to PlayerId', () => {
      const result = Schema.decodeUnknownSync(PlayerIdSchema)('player-789')
      expect(result).toBe('player-789')
    })

    it('should validate PlayerId type with Schema.is (positive)', () => {
      const playerId = PlayerIdSchema.make('player-456')
      expect(Schema.is(PlayerIdSchema)(playerId)).toBe(true)
    })
  })

  describe('BlockId', () => {
    it('should create valid BlockId', () => {
      const result = BlockIdSchema.make('block-456')
      expect(result).toBe('block-456')
    })

    it('should decode unknown string to BlockId', () => {
      const result = Schema.decodeUnknownSync(BlockIdSchema)('block-012')
      expect(result).toBe('block-012')
    })

    it('should validate BlockId type with Schema.is (positive)', () => {
      const blockId = BlockIdSchema.make('block-789')
      expect(Schema.is(BlockIdSchema)(blockId)).toBe(true)
    })
  })

  describe('Position', () => {
    it('should create valid Position', () => {
      const result = PositionSchema.make({ x: 1, y: 2, z: 3 })
      expect(result).toEqual({ x: 1, y: 2, z: 3 })
    })

    it('should encode Position', () => {
      const position = { x: 10, y: 20, z: 30 }
      const encoded = Schema.encodeSync(PositionSchema)(position)
      expect(encoded).toEqual({ x: 10, y: 20, z: 30 })
    })

    it('should decode Position with Effect', async () => {
      const result = Schema.decodeUnknown(PositionSchema)({ x: 1, y: 2, z: 3 })
      await expect(Effect.runPromise(result)).resolves.toEqual({ x: 1, y: 2, z: 3 })
    })

    it('should decode unknown object to Position', () => {
      const result = Schema.decodeUnknownSync(PositionSchema)({ x: 5, y: 10, z: 15 })
      expect(result).toEqual({ x: 5, y: 10, z: 15 })
    })

    it('should validate Position Schema with Schema.is (positive)', () => {
      const valid = PositionSchema.make({ x: 0, y: 0, z: 0 })
      expect(Schema.is(PositionSchema)(valid)).toBe(true)
    })
  })
})
