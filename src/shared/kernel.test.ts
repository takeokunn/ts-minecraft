import { describe, it, expect } from 'vitest'
import { Effect, Either, Schema } from 'effect'
import {
  WorldIdSchema,
  PlayerIdSchema,
  BlockIdSchema,
  PhysicsBodyIdSchema,
  ChunkIdSchema,
  SlotIndexSchema,
  DeltaTimeSecsSchema,
  BlockIndexSchema,
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

  describe('PhysicsBodyId', () => {
    it('should create valid PhysicsBodyId', () => {
      const result = PhysicsBodyIdSchema.make('physics-body-0')
      expect(result).toBe('physics-body-0')
    })

    it('should decode unknown string to PhysicsBodyId', () => {
      const result = Schema.decodeUnknownSync(PhysicsBodyIdSchema)('physics-body-42')
      expect(result).toBe('physics-body-42')
    })

    it('should validate PhysicsBodyId type with Schema.is (positive)', () => {
      const bodyId = PhysicsBodyIdSchema.make('physics-body-1')
      expect(Schema.is(PhysicsBodyIdSchema)(bodyId)).toBe(true)
    })
  })

  describe('ChunkId', () => {
    it('should create valid ChunkId', () => {
      const result = ChunkIdSchema.make('0,0')
      expect(result).toBe('0,0')
    })

    it('should decode unknown string to ChunkId', () => {
      const result = Schema.decodeUnknownSync(ChunkIdSchema)('5,-3')
      expect(result).toBe('5,-3')
    })

    it('should validate ChunkId type with Schema.is (positive)', () => {
      const chunkId = ChunkIdSchema.make('10,20')
      expect(Schema.is(ChunkIdSchema)(chunkId)).toBe(true)
    })
  })

  describe('SlotIndex', () => {
    it('should decode valid SlotIndex of 0', () => {
      const result = Schema.decodeSync(SlotIndexSchema)(0)
      expect(result).toBe(0)
    })

    it('should decode valid SlotIndex of 5', () => {
      const result = Schema.decodeSync(SlotIndexSchema)(5)
      expect(result).toBe(5)
    })

    it('should validate SlotIndex type with Schema.is (positive)', () => {
      const slotIndex = SlotIndexSchema.make(3)
      expect(Schema.is(SlotIndexSchema)(slotIndex)).toBe(true)
    })

    it('should reject negative SlotIndex', () => {
      expect(() =>
        Schema.decodeUnknownSync(SlotIndexSchema)(-1)
      ).toThrow()
    })

    it('should reject float SlotIndex', () => {
      expect(() =>
        Schema.decodeUnknownSync(SlotIndexSchema)(1.5)
      ).toThrow()
    })

    it('should reject NaN as SlotIndex', () => {
      expect(() =>
        Schema.decodeUnknownSync(SlotIndexSchema)(NaN)
      ).toThrow()
    })

    it('should reject non-number as SlotIndex', () => {
      expect(() =>
        Schema.decodeUnknownSync(SlotIndexSchema)('slot')
      ).toThrow()
    })
  })

  describe('DeltaTimeSecs', () => {
    it('should decode valid DeltaTimeSecs of 0.016 (typical 60fps delta)', () => {
      const result = Schema.decodeSync(DeltaTimeSecsSchema)(0.016)
      expect(result).toBeCloseTo(0.016)
    })

    it('should decode valid DeltaTimeSecs of 1.0', () => {
      const result = Schema.decodeSync(DeltaTimeSecsSchema)(1.0)
      expect(result).toBe(1.0)
    })

    it('should validate DeltaTimeSecs type with Schema.is (positive)', () => {
      const dt = DeltaTimeSecsSchema.make(0.016)
      expect(Schema.is(DeltaTimeSecsSchema)(dt)).toBe(true)
    })

    it('should reject zero DeltaTimeSecs (Schema.positive requires > 0)', () => {
      expect(() =>
        Schema.decodeUnknownSync(DeltaTimeSecsSchema)(0)
      ).toThrow()
    })

    it('should reject negative DeltaTimeSecs', () => {
      expect(() =>
        Schema.decodeUnknownSync(DeltaTimeSecsSchema)(-0.001)
      ).toThrow()
    })

    it('should reject NaN as DeltaTimeSecs', () => {
      expect(() =>
        Schema.decodeUnknownSync(DeltaTimeSecsSchema)(NaN)
      ).toThrow()
    })

    it('should reject non-number as DeltaTimeSecs', () => {
      expect(() =>
        Schema.decodeUnknownSync(DeltaTimeSecsSchema)('16ms')
      ).toThrow()
    })
  })

  describe('BlockIndex', () => {
    it('should decode valid BlockIndex of 0', () => {
      const result = Schema.decodeSync(BlockIndexSchema)(0)
      expect(result).toBe(0)
    })

    it('should decode valid BlockIndex of 100', () => {
      const result = Schema.decodeSync(BlockIndexSchema)(100)
      expect(result).toBe(100)
    })

    it('should validate BlockIndex type with Schema.is (positive)', () => {
      const blockIndex = BlockIndexSchema.make(42)
      expect(Schema.is(BlockIndexSchema)(blockIndex)).toBe(true)
    })

    it('should reject negative BlockIndex', () => {
      expect(() =>
        Schema.decodeUnknownSync(BlockIndexSchema)(-1)
      ).toThrow()
    })

    it('should reject float BlockIndex', () => {
      expect(() =>
        Schema.decodeUnknownSync(BlockIndexSchema)(0.5)
      ).toThrow()
    })

    it('should reject non-number as BlockIndex', () => {
      expect(() =>
        Schema.decodeUnknownSync(BlockIndexSchema)('idx')
      ).toThrow()
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

    it('should reject NaN for x', () => {
      expect(() =>
        Schema.decodeUnknownSync(PositionSchema)({ x: NaN, y: 0, z: 0 })
      ).toThrow()
    })

    it('should reject Infinity for y', () => {
      expect(() =>
        Schema.decodeUnknownSync(PositionSchema)({ x: 0, y: Infinity, z: 0 })
      ).toThrow()
    })

    it('should reject -Infinity for z', () => {
      expect(() =>
        Schema.decodeUnknownSync(PositionSchema)({ x: 0, y: 0, z: -Infinity })
      ).toThrow()
    })
  })

  describe('SlotIndex / DeltaTimeSecs / BlockIndex (Either-based validation)', () => {
    describe('SlotIndex', () => {
      it('valid SlotIndex: 0 (minimum)', () => {
        const result = Schema.decodeUnknownEither(SlotIndexSchema)(0)
        expect(Either.isRight(result)).toBe(true)
      })

      it('valid SlotIndex: 35 (hotbar max)', () => {
        const result = Schema.decodeUnknownEither(SlotIndexSchema)(35)
        expect(Either.isRight(result)).toBe(true)
      })

      it('invalid SlotIndex: -1 (negative)', () => {
        const result = Schema.decodeUnknownEither(SlotIndexSchema)(-1)
        expect(Either.isLeft(result)).toBe(true)
      })

      it('invalid SlotIndex: 1.5 (non-integer)', () => {
        const result = Schema.decodeUnknownEither(SlotIndexSchema)(1.5)
        expect(Either.isLeft(result)).toBe(true)
      })

      it('invalid SlotIndex: NaN', () => {
        const result = Schema.decodeUnknownEither(SlotIndexSchema)(NaN)
        expect(Either.isLeft(result)).toBe(true)
      })
    })

    describe('DeltaTimeSecs', () => {
      it('valid DeltaTimeSecs: 0.016 (60fps)', () => {
        const result = Schema.decodeUnknownEither(DeltaTimeSecsSchema)(0.016)
        expect(Either.isRight(result)).toBe(true)
      })

      it('valid DeltaTimeSecs: 1/60', () => {
        const result = Schema.decodeUnknownEither(DeltaTimeSecsSchema)(1 / 60)
        expect(Either.isRight(result)).toBe(true)
      })

      it('invalid DeltaTimeSecs: 0 (not positive)', () => {
        const result = Schema.decodeUnknownEither(DeltaTimeSecsSchema)(0)
        expect(Either.isLeft(result)).toBe(true)
      })

      it('invalid DeltaTimeSecs: -0.016 (negative)', () => {
        const result = Schema.decodeUnknownEither(DeltaTimeSecsSchema)(-0.016)
        expect(Either.isLeft(result)).toBe(true)
      })
    })

    describe('BlockIndex', () => {
      it('valid BlockIndex: 0', () => {
        const result = Schema.decodeUnknownEither(BlockIndexSchema)(0)
        expect(Either.isRight(result)).toBe(true)
      })

      it('valid BlockIndex: 65535', () => {
        const result = Schema.decodeUnknownEither(BlockIndexSchema)(65535)
        expect(Either.isRight(result)).toBe(true)
      })

      it('invalid BlockIndex: -1', () => {
        const result = Schema.decodeUnknownEither(BlockIndexSchema)(-1)
        expect(Either.isLeft(result)).toBe(true)
      })

      it('invalid BlockIndex: 0.5 (non-integer)', () => {
        const result = Schema.decodeUnknownEither(BlockIndexSchema)(0.5)
        expect(Either.isLeft(result)).toBe(true)
      })
    })
  })
})
