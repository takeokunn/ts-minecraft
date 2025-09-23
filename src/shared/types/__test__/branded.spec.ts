import { describe, it, expect } from 'vitest'
import { ParseResult } from 'effect'
import { Schema } from '@effect/schema'
import * as fc from 'fast-check'
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
  Version,
  UUID,
  BrandedTypes,
  type PlayerId,
  type WorldCoordinate,
  type ChunkId,
  type BlockTypeId,
} from '../branded'

describe('Branded Types', () => {
  describe('PlayerIdSchema', () => {
    it('validates any string as PlayerId', () => {
      fc.assert(
        fc.property(fc.string(), (str: string) => {
          const result = Schema.decodeUnknownEither(PlayerIdSchema)(str)
          expect(result._tag).toBe('Right')
        }),
        { numRuns: 100 }
      )
    })

    it('rejects non-string values', () => {
      fc.assert(
        fc.property(fc.oneof(fc.integer(), fc.boolean(), fc.constant(null)), (value: any) => {
          const result = Schema.decodeUnknownEither(PlayerIdSchema)(value)
          expect(result._tag).toBe('Left')
        }),
        { numRuns: 50 }
      )
    })

    it('maintains brand safety', () => {
      const playerId = Schema.decodeSync(PlayerIdSchema)('player-123')
      const regularString: string = 'player-123'

      // Type level test - these should be different types
      expect(typeof playerId).toBe('string')
      expect(playerId).toBe(regularString) // Value equality
      // But TypeScript treats them as different types at compile time
    })
  })

  describe('WorldCoordinateSchema', () => {
    it('validates any number as WorldCoordinate', () => {
      fc.assert(
        fc.property(fc.float({ noNaN: true, noDefaultInfinity: true }), (num: number) => {
          const result = Schema.decodeUnknownEither(WorldCoordinateSchema)(num)
          expect(result._tag).toBe('Right')
        }),
        { numRuns: 100 }
      )
    })

    it('rejects NaN and infinity', () => {
      const nanResult = Schema.decodeUnknownEither(WorldCoordinateSchema)(NaN)
      const infResult = Schema.decodeUnknownEither(WorldCoordinateSchema)(Infinity)
      const negInfResult = Schema.decodeUnknownEither(WorldCoordinateSchema)(-Infinity)

      expect(nanResult._tag).toBe('Left')
      expect(infResult._tag).toBe('Left')
      expect(negInfResult._tag).toBe('Left')
    })
  })

  describe('ChunkIdSchema', () => {
    it('validates chunk ID format strings', () => {
      fc.assert(
        fc.property(fc.string(), (str: string) => {
          const result = Schema.decodeUnknownEither(ChunkIdSchema)(str)
          expect(result._tag).toBe('Right')
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('BlockTypeIdSchema', () => {
    it('validates positive integers only', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }), (int: number) => {
          const result = Schema.decodeUnknownEither(BlockTypeIdSchema)(int)
          expect(result._tag).toBe('Right')
        }),
        { numRuns: 100 }
      )
    })

    it('rejects non-positive integers', () => {
      fc.assert(
        fc.property(fc.integer({ max: 0 }), (int: number) => {
          const result = Schema.decodeUnknownEither(BlockTypeIdSchema)(int)
          expect(result._tag).toBe('Left')
        }),
        { numRuns: 50 }
      )
    })

    it('rejects non-integer numbers', () => {
      fc.assert(
        fc.property(fc.float({ min: Math.fround(0.1), max: Math.fround(1000), noInteger: true }), (float: number) => {
          const result = Schema.decodeUnknownEither(BlockTypeIdSchema)(float)
          expect(result._tag).toBe('Left')
        }),
        { numRuns: 50 }
      )
    })
  })

  describe('ChunkPosition', () => {
    const chunkPositionArbitrary = fc.record({
      x: fc.integer({ min: -1000000, max: 1000000 }),
      z: fc.integer({ min: -1000000, max: 1000000 }),
    })

    it('validates valid chunk positions', () => {
      fc.assert(
        fc.property(chunkPositionArbitrary, (pos: any) => {
          const result = Schema.decodeUnknownEither(ChunkPosition)(pos)
          expect(result._tag).toBe('Right')
        }),
        { numRuns: 100 }
      )
    })

    it('rejects non-integer coordinates', () => {
      const invalidPos = { x: 1.5, z: 2.7 }
      const result = Schema.decodeUnknownEither(ChunkPosition)(invalidPos)
      expect(result._tag).toBe('Left')
    })

    it('rejects missing coordinates', () => {
      const invalidPos1 = { x: 1 } // missing z
      const invalidPos2 = { z: 2 } // missing x

      const result1 = Schema.decodeUnknownEither(ChunkPosition)(invalidPos1)
      const result2 = Schema.decodeUnknownEither(ChunkPosition)(invalidPos2)

      expect(result1._tag).toBe('Left')
      expect(result2._tag).toBe('Left')
    })
  })

  describe('BlockPosition', () => {
    const blockPositionArbitrary = fc.record({
      x: fc.integer({ min: -30000000, max: 30000000 }),
      y: fc.integer({ min: -64, max: 320 }),
      z: fc.integer({ min: -30000000, max: 30000000 }),
    })

    it('validates valid block positions', () => {
      fc.assert(
        fc.property(blockPositionArbitrary, (pos: any) => {
          const result = Schema.decodeUnknownEither(BlockPosition)(pos)
          expect(result._tag).toBe('Right')
        }),
        { numRuns: 100 }
      )
    })

    it('maintains coordinate constraints', () => {
      fc.assert(
        fc.property(blockPositionArbitrary, (pos: any) => {
          const result = Schema.decodeUnknownSync(BlockPosition)(pos)
          expect(result.x).toBeGreaterThanOrEqual(-30000000)
          expect(result.x).toBeLessThanOrEqual(30000000)
          expect(result.y).toBeGreaterThanOrEqual(-64)
          expect(result.y).toBeLessThanOrEqual(320)
          expect(result.z).toBeGreaterThanOrEqual(-30000000)
          expect(result.z).toBeLessThanOrEqual(30000000)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Version', () => {
    const versionArbitrary = fc
      .tuple(fc.integer({ min: 0, max: 99 }), fc.integer({ min: 0, max: 99 }), fc.integer({ min: 0, max: 99 }))
      .map(([major, minor, patch]) => `${major}.${minor}.${patch}`)

    it('validates semantic version format', () => {
      fc.assert(
        fc.property(versionArbitrary, (version: string) => {
          const result = Schema.decodeUnknownEither(Version)(version)
          expect(result._tag).toBe('Right')
        }),
        { numRuns: 100 }
      )
    })

    it('rejects invalid version formats', () => {
      const invalidVersions = [
        '1.0', // missing patch
        '1.0.0.0', // too many parts
        'v1.0.0', // prefix
        '1.0.0-alpha', // suffix
        '1.a.0', // non-numeric
        '', // empty
      ]

      invalidVersions.forEach((invalid) => {
        const result = Schema.decodeUnknownEither(Version)(invalid)
        expect(result._tag).toBe('Left')
      })
    })
  })

  describe('UUID', () => {
    const uuidArbitrary = fc.constant('550e8400-e29b-41d4-a716-446655440000')

    it('validates UUID format', () => {
      fc.assert(
        fc.property(uuidArbitrary, (uuid: string) => {
          const result = Schema.decodeUnknownEither(UUID)(uuid)
          expect(result._tag).toBe('Right')
        }),
        { numRuns: 100 }
      )
    })

    it('validates case insensitive UUIDs', () => {
      const upperUuid = '550E8400-E29B-41D4-A716-446655440000'
      const lowerUuid = '550e8400-e29b-41d4-a716-446655440000'

      const upperResult = Schema.decodeUnknownEither(UUID)(upperUuid)
      const lowerResult = Schema.decodeUnknownEither(UUID)(lowerUuid)

      expect(upperResult._tag).toBe('Right')
      expect(lowerResult._tag).toBe('Right')
    })

    it('rejects invalid UUID formats', () => {
      const invalidUuids = [
        '550e8400-e29b-41d4-a716', // too short
        '550e8400-e29b-41d4-a716-446655440000-extra', // too long
        '550e8400-e29b-41d4-a716-44665544000g', // invalid character
        '550e8400e29b41d4a716446655440000', // missing hyphens
        '', // empty
      ]

      invalidUuids.forEach((invalid) => {
        const result = Schema.decodeUnknownEither(UUID)(invalid)
        expect(result._tag).toBe('Left')
      })
    })
  })

  describe('BrandedTypes helpers', () => {
    describe('createPlayerId', () => {
      it('creates valid PlayerId from string', () => {
        fc.assert(
          fc.property(fc.string(), (str: string) => {
            const playerId = BrandedTypes.createPlayerId(str)
            expect(typeof playerId).toBe('string')
            expect(playerId).toBe(str)
          }),
          { numRuns: 100 }
        )
      })
    })

    describe('createWorldCoordinate', () => {
      it('creates valid WorldCoordinate from number', () => {
        fc.assert(
          fc.property(fc.float({ noNaN: true, noDefaultInfinity: true }), (num: number) => {
            const coord = BrandedTypes.createWorldCoordinate(num)
            expect(typeof coord).toBe('number')
            expect(coord).toBe(num)
          }),
          { numRuns: 100 }
        )
      })

      it('throws on invalid input', () => {
        expect(() => BrandedTypes.createWorldCoordinate(NaN)).toThrow()
        expect(() => BrandedTypes.createWorldCoordinate(Infinity)).toThrow()
      })
    })

    describe('createChunkId', () => {
      it('creates valid ChunkId from coordinates', () => {
        fc.assert(
          fc.property(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }), (x: number, z: number) => {
            const chunkId = BrandedTypes.createChunkId(x, z)
            expect(typeof chunkId).toBe('string')
            expect(chunkId).toBe(`chunk_${x}_${z}`)
          }),
          { numRuns: 100 }
        )
      })
    })

    describe('createBlockTypeId', () => {
      it('creates valid BlockTypeId from positive integer', () => {
        fc.assert(
          fc.property(fc.integer({ min: 1, max: 1000 }), (int: number) => {
            const blockTypeId = BrandedTypes.createBlockTypeId(int)
            expect(typeof blockTypeId).toBe('number')
            expect(blockTypeId).toBe(int)
          }),
          { numRuns: 100 }
        )
      })

      it('throws on invalid input', () => {
        expect(() => BrandedTypes.createBlockTypeId(0)).toThrow()
        expect(() => BrandedTypes.createBlockTypeId(-1)).toThrow()
        expect(() => BrandedTypes.createBlockTypeId(1.5)).toThrow()
      })
    })
  })

  describe('Type safety at runtime', () => {
    it('enforces distinct types for same underlying values', () => {
      const playerId: PlayerId = Schema.decodeSync(PlayerIdSchema)('123')
      const chunkId: ChunkId = Schema.decodeSync(ChunkIdSchema)('chunk_1_2')

      // Values are different
      expect(playerId).not.toBe(chunkId as unknown as string)

      // But TypeScript treats them as different types
      // This would cause a type error: playerId = chunkId
    })

    it('prevents accidental usage across different branded types', () => {
      const coord1: WorldCoordinate = Schema.decodeSync(WorldCoordinateSchema)(100)
      const coord2: WorldCoordinate = Schema.decodeSync(WorldCoordinateSchema)(200)
      const blockTypeId: BlockTypeId = Schema.decodeSync(BlockTypeIdSchema)(1)

      // Mathematical operations work on the underlying values
      expect(coord1 + coord2).toBe(300)

      // But the type system prevents mixing different branded types
      // This would be a type error: coord1 + blockTypeId
    })
  })
})
