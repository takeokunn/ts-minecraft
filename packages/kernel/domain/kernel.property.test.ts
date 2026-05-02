import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Either, Schema } from 'effect'
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
  it.prop('make() produces a value that round-trips through Schema.encode/decode', { n: Arbitrary.make(SlotIndexSchema) }, ({ n }) => {
    const idx = SlotIndex.make(n)
    expect(SlotIndex.toNumber(idx)).toBe(n)
  })

  it.prop('toNumber(make(n)) === n for all valid non-negative integers', { n: Arbitrary.make(SlotIndexSchema) }, ({ n }) => {
    expect(SlotIndex.toNumber(SlotIndex.make(n))).toBe(n)
  })

  it.prop('make() throws for negative integers', { n: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-1000, -1))) }, ({ n }) => {
    expect(() => SlotIndex.make(n)).toThrow()
  })

  it.prop('Schema decode accepts non-negative integers', { n: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(0, 10000))) }, ({ n }) => {
    const result = Schema.decodeUnknownEither(SlotIndexSchema)(n)
    expect(Either.isRight(result)).toBe(true)
  })

  it.prop('Schema decode rejects negative integers', { n: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-1000, -1))) }, ({ n }) => {
    const result = Schema.decodeUnknownEither(SlotIndexSchema)(n)
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe('DeltaTimeSecs (property-based)', () => {
  it.prop('make() accepts positive numbers', { n: Arbitrary.make(DeltaTimeSecsSchema) }, ({ n }) => {
    expect(() => DeltaTimeSecs.make(n)).not.toThrow()
  })

  it.prop('make() throws for zero or negative values', { n: Arbitrary.make(Schema.Number.pipe(Schema.between(-10000, 0))) }, ({ n }) => {
    expect(() => DeltaTimeSecs.make(n)).toThrow()
  })

  it.prop('Schema decode rejects non-positive numbers', { n: Arbitrary.make(Schema.Number.pipe(Schema.between(-10000, 0))) }, ({ n }) => {
    const result = Schema.decodeUnknownEither(DeltaTimeSecsSchema)(n)
    expect(Either.isLeft(result)).toBe(true)
  })
})

describe('BlockIndex (property-based)', () => {
  it.prop('make() accepts non-negative integers', { n: Arbitrary.make(BlockIndexSchema) }, ({ n }) => {
    expect(() => BlockIndex.make(n)).not.toThrow()
  })

  it.prop('make() throws for negative integers', { n: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-1000, -1))) }, ({ n }) => {
    expect(() => BlockIndex.make(n)).toThrow()
  })

  it.prop(
    'Schema decode rejects floats',
    { n: Arbitrary.make(Schema.Number.pipe(Schema.between(0.1, 999.9), Schema.filter((n) => n !== Math.floor(n)))) },
    ({ n }) => {
      const result = Schema.decodeUnknownEither(BlockIndexSchema)(n)
      expect(Either.isLeft(result)).toBe(true)
    }
  )
})

describe('String branded types (property-based)', () => {
  it.prop('WorldId.make() is a total function for any string', { s: Arbitrary.make(WorldIdSchema) }, ({ s }) => {
    expect(() => WorldId.make(s)).not.toThrow()
    const result = Schema.decodeUnknownEither(WorldIdSchema)(WorldId.make(s))
    expect(Either.isRight(result)).toBe(true)
  })

  it.prop('PlayerId.make() is a total function for any string', { s: Arbitrary.make(PlayerIdSchema) }, ({ s }) => {
    expect(() => PlayerId.make(s)).not.toThrow()
    const result = Schema.decodeUnknownEither(PlayerIdSchema)(PlayerId.make(s))
    expect(Either.isRight(result)).toBe(true)
  })

  it.prop('BlockId.make() is a total function for any string', { s: Arbitrary.make(BlockIdSchema) }, ({ s }) => {
    expect(() => BlockId.make(s)).not.toThrow()
    const result = Schema.decodeUnknownEither(BlockIdSchema)(BlockId.make(s))
    expect(Either.isRight(result)).toBe(true)
  })

  it.prop('PhysicsBodyId.make() is a total function for any string', { s: Arbitrary.make(PhysicsBodyIdSchema) }, ({ s }) => {
    expect(() => PhysicsBodyId.make(s)).not.toThrow()
    const result = Schema.decodeUnknownEither(PhysicsBodyIdSchema)(PhysicsBodyId.make(s))
    expect(Either.isRight(result)).toBe(true)
  })

  it.prop('ChunkId.make() is a total function for any string', { s: Arbitrary.make(ChunkIdSchema) }, ({ s }) => {
    expect(() => ChunkId.make(s)).not.toThrow()
    const result = Schema.decodeUnknownEither(ChunkIdSchema)(ChunkId.make(s))
    expect(Either.isRight(result)).toBe(true)
  })
})
