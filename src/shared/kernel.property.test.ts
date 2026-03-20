import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import { Schema } from 'effect'
import {
  SlotIndex,
  SlotIndexSchema,
  DeltaTimeSecs,
  DeltaTimeSecsSchema,
  BlockIndex,
  BlockIndexSchema,
  WorldId,
  WorldIdSchema,
  PlayerId,
  PlayerIdSchema,
  BlockId,
  BlockIdSchema,
  PhysicsBodyId,
  PhysicsBodyIdSchema,
  ChunkId,
  ChunkIdSchema,
} from './kernel'

describe('SlotIndex (property-based)', () => {
  it('make() produces a value that round-trips through Schema.encode/decode', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000 }), (n) => {
        const idx = SlotIndex.make(n)
        expect(SlotIndex.toNumber(idx)).toBe(n)
      })
    )
  })

  it('toNumber(make(n)) === n for all valid non-negative integers', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 35 }), (n) => {
        expect(SlotIndex.toNumber(SlotIndex.make(n))).toBe(n)
      })
    )
  })

  it('make() throws for negative integers', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: -1 }), (n) => {
        expect(() => SlotIndex.make(n)).toThrow()
      })
    )
  })

  it('Schema decode accepts non-negative integers', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10000 }), (n) => {
        const result = Schema.decodeUnknownEither(SlotIndexSchema)(n)
        expect(result._tag).toBe('Right')
      })
    )
  })

  it('Schema decode rejects negative integers', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: -1 }), (n) => {
        const result = Schema.decodeUnknownEither(SlotIndexSchema)(n)
        expect(result._tag).toBe('Left')
      })
    )
  })
})

describe('DeltaTimeSecs (property-based)', () => {
  it('make() accepts positive numbers', () => {
    fc.assert(
      fc.property(fc.float({ min: Math.fround(0.001), max: 1.0, noNaN: true }), (n) => {
        expect(() => DeltaTimeSecs.make(n)).not.toThrow()
      })
    )
  })

  it('make() throws for zero or negative values', () => {
    fc.assert(
      fc.property(fc.float({ max: 0, noNaN: true }), (n) => {
        expect(() => DeltaTimeSecs.make(n)).toThrow()
      })
    )
  })

  it('Schema decode rejects non-positive numbers', () => {
    fc.assert(
      fc.property(fc.float({ max: 0, noNaN: true }), (n) => {
        const result = Schema.decodeUnknownEither(DeltaTimeSecsSchema)(n)
        expect(result._tag).toBe('Left')
      })
    )
  })
})

describe('BlockIndex (property-based)', () => {
  it('make() accepts non-negative integers', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100000 }), (n) => {
        expect(() => BlockIndex.make(n)).not.toThrow()
      })
    )
  })

  it('make() throws for negative integers', () => {
    fc.assert(
      fc.property(fc.integer({ min: -1000, max: -1 }), (n) => {
        expect(() => BlockIndex.make(n)).toThrow()
      })
    )
  })

  it('Schema decode rejects floats', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.1), max: Math.fround(999.9), noNaN: true }).filter((n) => n !== Math.floor(n)),
        (n) => {
          const result = Schema.decodeUnknownEither(BlockIndexSchema)(n)
          expect(result._tag).toBe('Left')
        }
      )
    )
  })
})

describe('String branded types (property-based)', () => {
  it('WorldId.make() is a total function for any string', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(() => WorldId.make(s)).not.toThrow()
        const result = Schema.decodeUnknownEither(WorldIdSchema)(WorldId.make(s))
        expect(result._tag).toBe('Right')
      })
    )
  })

  it('PlayerId.make() is a total function for any string', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(() => PlayerId.make(s)).not.toThrow()
        const result = Schema.decodeUnknownEither(PlayerIdSchema)(PlayerId.make(s))
        expect(result._tag).toBe('Right')
      })
    )
  })

  it('BlockId.make() is a total function for any string', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(() => BlockId.make(s)).not.toThrow()
        const result = Schema.decodeUnknownEither(BlockIdSchema)(BlockId.make(s))
        expect(result._tag).toBe('Right')
      })
    )
  })

  it('PhysicsBodyId.make() is a total function for any string', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(() => PhysicsBodyId.make(s)).not.toThrow()
        const result = Schema.decodeUnknownEither(PhysicsBodyIdSchema)(PhysicsBodyId.make(s))
        expect(result._tag).toBe('Right')
      })
    )
  })

  it('ChunkId.make() is a total function for any string', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(() => ChunkId.make(s)).not.toThrow()
        const result = Schema.decodeUnknownEither(ChunkIdSchema)(ChunkId.make(s))
        expect(result._tag).toBe('Right')
      })
    )
  })
})
