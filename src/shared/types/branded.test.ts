import { describe, it, expect } from 'vitest'
import * as Schema from 'effect/Schema'
import {
  PlayerIdSchema,
  WorldCoordinateSchema,
  ChunkIdSchema,
  BlockTypeIdSchema,
  ChunkPosition,
  BlockPosition,
  EntityId,
  ItemId,
  SessionId,
  Timestamp,
  Version,
  UUID,
  BrandedTypes,
} from './branded'
import type { PlayerId } from './branded'

describe('Branded Types', () => {
  describe('PlayerId', () => {
    it('should create a valid PlayerId', () => {
      const id = Schema.decodeSync(PlayerIdSchema)('player-123')
      expect(id).toBe('player-123')

      // Type assertion to verify branding
      const _typeCheck: PlayerId = id
      expect(_typeCheck).toBeDefined()
    })

    it('should work with helper function', () => {
      const id = BrandedTypes.createPlayerId('player-456')
      expect(id).toBe('player-456')
    })

    it('should accept any string value', () => {
      const id = Schema.decodeSync(PlayerIdSchema)('')
      expect(id).toBe('')
    })
  })

  describe('WorldCoordinate', () => {
    it('should create a valid WorldCoordinate', () => {
      const coord = Schema.decodeSync(WorldCoordinateSchema)(123.456)
      expect(coord).toBe(123.456)
    })

    it('should work with helper function', () => {
      const coord = BrandedTypes.createWorldCoordinate(-999.99)
      expect(coord).toBe(-999.99)
    })

    it('should accept negative numbers', () => {
      const coord = Schema.decodeSync(WorldCoordinateSchema)(-100)
      expect(coord).toBe(-100)
    })
  })

  describe('ChunkId', () => {
    it('should create a valid ChunkId', () => {
      const id = Schema.decodeSync(ChunkIdSchema)('chunk_0_0')
      expect(id).toBe('chunk_0_0')
    })

    it('should work with helper function', () => {
      const id = BrandedTypes.createChunkId('chunk_10_-5')
      expect(id).toBe('chunk_10_-5')
    })
  })

  describe('BlockTypeId', () => {
    it('should create a valid BlockTypeId', () => {
      const id = Schema.decodeSync(BlockTypeIdSchema)(1)
      expect(id).toBe(1)
    })

    it('should work with helper function', () => {
      const id = BrandedTypes.createBlockTypeId(42)
      expect(id).toBe(42)
    })

    it('should reject negative numbers', () => {
      expect(() => Schema.decodeSync(BlockTypeIdSchema)(-1)).toThrow()
    })

    it('should reject zero', () => {
      expect(() => Schema.decodeSync(BlockTypeIdSchema)(0)).toThrow()
    })

    it('should reject non-integers', () => {
      expect(() => Schema.decodeSync(BlockTypeIdSchema)(1.5)).toThrow()
    })
  })

  describe('ChunkPosition', () => {
    it('should create a valid ChunkPosition', () => {
      const pos = Schema.decodeSync(ChunkPosition)({ x: 10, z: -5 })
      expect(pos.x).toBe(10)
      expect(pos.z).toBe(-5)
    })

    it('should reject non-integer coordinates', () => {
      expect(() => Schema.decodeSync(ChunkPosition)({ x: 1.5, z: 2 })).toThrow()
      expect(() => Schema.decodeSync(ChunkPosition)({ x: 1, z: 2.5 })).toThrow()
    })

    it('should accept negative coordinates', () => {
      const pos = Schema.decodeSync(ChunkPosition)({ x: -100, z: -200 })
      expect(pos.x).toBe(-100)
      expect(pos.z).toBe(-200)
    })

    it('should reject missing fields', () => {
      expect(() => Schema.decodeSync(ChunkPosition)({ x: 1 } as any)).toThrow()
      expect(() => Schema.decodeSync(ChunkPosition)({ z: 1 } as any)).toThrow()
      expect(() => Schema.decodeSync(ChunkPosition)({} as any)).toThrow()
    })
  })

  describe('BlockPosition', () => {
    it('should create a valid BlockPosition', () => {
      const pos = Schema.decodeSync(BlockPosition)({ x: 100, y: 64, z: -50 })
      expect(pos.x).toBe(100)
      expect(pos.y).toBe(64)
      expect(pos.z).toBe(-50)
    })

    it('should reject non-integer coordinates', () => {
      expect(() => Schema.decodeSync(BlockPosition)({ x: 1.5, y: 2, z: 3 })).toThrow()
    })

    it('should accept negative y coordinates (for below bedrock)', () => {
      const pos = Schema.decodeSync(BlockPosition)({ x: 0, y: -64, z: 0 })
      expect(pos.y).toBe(-64)
    })

    it('should reject missing fields', () => {
      expect(() => Schema.decodeSync(BlockPosition)({ x: 1, y: 2 } as any)).toThrow()
    })
  })

  describe('EntityId', () => {
    it('should create a valid EntityId', () => {
      const id = Schema.decodeSync(EntityId)('entity-abc-123')
      expect(id).toBe('entity-abc-123')
    })

    it('should accept any string format', () => {
      const id = Schema.decodeSync(EntityId)('zombie_001')
      expect(id).toBe('zombie_001')
    })
  })

  describe('ItemId', () => {
    it('should create a valid ItemId', () => {
      const id = Schema.decodeSync(ItemId)('minecraft:diamond')
      expect(id).toBe('minecraft:diamond')
    })

    it('should accept namespaced IDs', () => {
      const id = Schema.decodeSync(ItemId)('mod:custom_item')
      expect(id).toBe('mod:custom_item')
    })
  })

  describe('SessionId', () => {
    it('should create a valid SessionId', () => {
      const id = Schema.decodeSync(SessionId)('session_1234567890')
      expect(id).toBe('session_1234567890')
    })

    it('should accept UUID format', () => {
      const id = Schema.decodeSync(SessionId)('550e8400-e29b-41d4-a716-446655440000')
      expect(id).toBe('550e8400-e29b-41d4-a716-446655440000')
    })
  })

  describe('Timestamp', () => {
    it('should create a valid Timestamp', () => {
      const ts = Schema.decodeSync(Timestamp)(1609459200000)
      expect(ts).toBe(1609459200000)
    })

    it('should reject negative timestamps', () => {
      expect(() => Schema.decodeSync(Timestamp)(-1)).toThrow()
    })

    it('should reject non-integer timestamps', () => {
      expect(() => Schema.decodeSync(Timestamp)(1609459200000.5)).toThrow()
    })

    it('should reject zero', () => {
      expect(() => Schema.decodeSync(Timestamp)(0)).toThrow()
    })
  })

  describe('Version', () => {
    it('should create a valid Version', () => {
      const ver = Schema.decodeSync(Version)('1.0.0')
      expect(ver).toBe('1.0.0')
    })

    it('should accept semantic version format', () => {
      const ver = Schema.decodeSync(Version)('2.10.3')
      expect(ver).toBe('2.10.3')
    })

    it('should reject invalid version formats', () => {
      expect(() => Schema.decodeSync(Version)('1.0')).toThrow()
      expect(() => Schema.decodeSync(Version)('1.0.0.0')).toThrow()
      expect(() => Schema.decodeSync(Version)('v1.0.0')).toThrow()
      expect(() => Schema.decodeSync(Version)('1.0.0-alpha')).toThrow()
    })
  })

  describe('UUID', () => {
    it('should create a valid UUID', () => {
      const uuid = Schema.decodeSync(UUID)('550e8400-e29b-41d4-a716-446655440000')
      expect(uuid).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('should accept uppercase UUIDs', () => {
      const uuid = Schema.decodeSync(UUID)('550E8400-E29B-41D4-A716-446655440000')
      expect(uuid).toBe('550E8400-E29B-41D4-A716-446655440000')
    })

    it('should reject invalid UUID formats', () => {
      expect(() => Schema.decodeSync(UUID)('not-a-uuid')).toThrow()
      expect(() => Schema.decodeSync(UUID)('550e8400-e29b-41d4-a716')).toThrow()
      expect(() => Schema.decodeSync(UUID)('550e8400e29b41d4a716446655440000')).toThrow()
      expect(() => Schema.decodeSync(UUID)('550e8400-e29b-41d4-a716-44665544000g')).toThrow()
    })
  })

  describe('Type safety', () => {
    it('should prevent type mixing at compile time', () => {
      const playerId = Schema.decodeSync(PlayerIdSchema)('player-1')
      const entityId = Schema.decodeSync(EntityId)('entity-1')

      // These are separate branded types
      // TypeScript will prevent this at compile time:
      // const wrong: PlayerId = entityId  // This would be a compile error
      // const alsoWrong: EntityId = playerId  // This would also be a compile error

      expect(playerId).toBe('player-1')
      expect(entityId).toBe('entity-1')
    })

    it('should maintain type information through operations', () => {
      const pos1 = Schema.decodeSync(ChunkPosition)({ x: 1, z: 2 })
      const pos2 = Schema.decodeSync(ChunkPosition)({ x: 3, z: 4 })

      // Operations on branded types maintain their branding
      const positions: ChunkPosition[] = [pos1, pos2]

      expect(positions.length).toBe(2)
      expect(positions[0]!.x).toBe(1)
      expect(positions[1]!.x).toBe(3)
    })
  })
})
