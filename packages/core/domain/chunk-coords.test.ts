import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect, Either, Schema } from 'effect'
import { CHUNK_SIZE, CHUNK_HEIGHT, ChunkCoordSchema, BlockIndexError } from './chunk-coords'
import { blockIndex, blockIndexUnsafe, toBlockIndex } from './chunk-coords.fns'

// ── Constants ──────────────────────────────────────────────────────────────

const LAST_VALID_X = CHUNK_SIZE - 1   // 15
const LAST_VALID_Y = CHUNK_HEIGHT - 1 // 255
const LAST_VALID_Z = CHUNK_SIZE - 1   // 15

describe('CHUNK_SIZE', () => {
  it('equals 16 (blocks per axis in the x/z plane)', () => {
    expect(CHUNK_SIZE).toBe(16)
  })

  it('is a positive integer', () => {
    expect(CHUNK_SIZE).toBeGreaterThan(0)
    expect(Number.isInteger(CHUNK_SIZE)).toBe(true)
  })
})

describe('CHUNK_HEIGHT', () => {
  it('equals 256 (blocks tall)', () => {
    expect(CHUNK_HEIGHT).toBe(256)
  })

  it('is a positive integer', () => {
    expect(CHUNK_HEIGHT).toBeGreaterThan(0)
    expect(Number.isInteger(CHUNK_HEIGHT)).toBe(true)
  })
})

// ── ChunkCoordSchema ───────────────────────────────────────────────────────

describe('ChunkCoordSchema', () => {
  it('accepts { x: 0, z: 0 }', () => {
    const result = Schema.decodeUnknownEither(ChunkCoordSchema)({ x: 0, z: 0 })
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts negative chunk coordinates (chunks west/north of origin)', () => {
    const result = Schema.decodeUnknownEither(ChunkCoordSchema)({ x: -5, z: -3 })
    expect(Either.isRight(result)).toBe(true)
  })

  it('accepts large positive coordinates', () => {
    const result = Schema.decodeUnknownEither(ChunkCoordSchema)({ x: 1000, z: 2000 })
    expect(Either.isRight(result)).toBe(true)
  })

  it('rejects non-integer x (float)', () => {
    const result = Schema.decodeUnknownEither(ChunkCoordSchema)({ x: 1.5, z: 0 })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects non-integer z (float)', () => {
    const result = Schema.decodeUnknownEither(ChunkCoordSchema)({ x: 0, z: 0.7 })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects missing z field', () => {
    const result = Schema.decodeUnknownEither(ChunkCoordSchema)({ x: 0 })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects missing x field', () => {
    const result = Schema.decodeUnknownEither(ChunkCoordSchema)({ z: 0 })
    expect(Either.isLeft(result)).toBe(true)
  })

  it('rejects string x', () => {
    const result = Schema.decodeUnknownEither(ChunkCoordSchema)({ x: 'two', z: 0 })
    expect(Either.isLeft(result)).toBe(true)
  })
})

// ── blockIndex ─────────────────────────────────────────────────────────────

describe('blockIndex', () => {
  it('returns Some(0) for origin (0, 0, 0)', () => {
    const result = blockIndex(0, 0, 0)
    expect(result._tag).toBe('Some')
  })

  it('origin index value is 0', () => {
    const result = blockIndex(0, 0, 0)
    expect(result._tag).toBe('Some')
    if (result._tag === 'Some') {
      expect(result.value).toBe(0)
    }
  })

  it('returns Some for maximum valid corner', () => {
    const result = blockIndex(LAST_VALID_X, LAST_VALID_Y, LAST_VALID_Z)
    expect(result._tag).toBe('Some')
  })

  it('computes index using formula y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE', () => {
    const x = 1
    const y = 2
    const z = 3
    const expected = y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE
    const result = blockIndex(x, y, z)
    expect(result._tag).toBe('Some')
    if (result._tag === 'Some') {
      expect(result.value).toBe(expected)
    }
  })

  it('returns None for x < 0', () => {
    expect(blockIndex(-1, 0, 0)._tag).toBe('None')
  })

  it('returns None for x >= CHUNK_SIZE', () => {
    expect(blockIndex(CHUNK_SIZE, 0, 0)._tag).toBe('None')
  })

  it('returns None for y < 0', () => {
    expect(blockIndex(0, -1, 0)._tag).toBe('None')
  })

  it('returns None for y >= CHUNK_HEIGHT', () => {
    expect(blockIndex(0, CHUNK_HEIGHT, 0)._tag).toBe('None')
  })

  it('returns None for z < 0', () => {
    expect(blockIndex(0, 0, -1)._tag).toBe('None')
  })

  it('returns None for z >= CHUNK_SIZE', () => {
    expect(blockIndex(0, 0, CHUNK_SIZE)._tag).toBe('None')
  })

  it('returns None for all dimensions out-of-bounds simultaneously', () => {
    expect(blockIndex(-1, -1, -1)._tag).toBe('None')
  })
})

// ── blockIndexUnsafe ───────────────────────────────────────────────────────

describe('blockIndexUnsafe', () => {
  it('returns 0 for origin (0, 0, 0)', () => {
    expect(blockIndexUnsafe(0, 0, 0)).toBe(0)
  })

  it('matches blockIndex for in-bounds coordinates', () => {
    const x = 5; const y = 10; const z = 3
    const safe = blockIndex(x, y, z)
    expect(safe._tag).toBe('Some')
    if (safe._tag === 'Some') {
      expect(blockIndexUnsafe(x, y, z)).toBe(safe.value)
    }
  })

  it('agrees with the formula y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE', () => {
    const x = 2; const y = 64; const z = 7
    const expected = y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE
    expect(blockIndexUnsafe(x, y, z)).toBe(expected)
  })

  it('returns the maximum valid index for corner (15, 255, 15)', () => {
    const maxIdx = blockIndexUnsafe(LAST_VALID_X, LAST_VALID_Y, LAST_VALID_Z)
    const expected =
      LAST_VALID_Y + LAST_VALID_Z * CHUNK_HEIGHT + LAST_VALID_X * CHUNK_HEIGHT * CHUNK_SIZE
    expect(maxIdx).toBe(expected)
  })

  it('all unique: indices at different (x,y,z) are distinct', () => {
    // Check a small 3×3×3 sub-space to confirm no collisions
    const indices = new Set<number>()
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        for (let z = 0; z < 3; z++) {
          indices.add(blockIndexUnsafe(x, y, z))
        }
      }
    }
    expect(indices.size).toBe(27)
  })
})

// ── toBlockIndex (Effect) ──────────────────────────────────────────────────

describe('toBlockIndex', () => {
  it('succeeds with the correct index for (0, 0, 0)', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const idx = yield* toBlockIndex(0, 0, 0)
        expect(idx).toBe(0)
      }),
    ))

  it('succeeds for maximum in-bounds coordinates', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const idx = yield* toBlockIndex(LAST_VALID_X, LAST_VALID_Y, LAST_VALID_Z)
        const expected =
          LAST_VALID_Y +
          LAST_VALID_Z * CHUNK_HEIGHT +
          LAST_VALID_X * CHUNK_HEIGHT * CHUNK_SIZE
        expect(idx).toBe(expected)
      }),
    ))

  it('fails with BlockIndexError for x = -1', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.either(toBlockIndex(-1, 0, 0))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(BlockIndexError)
          expect(result.left.x).toBe(-1)
          expect(result.left.y).toBe(0)
          expect(result.left.z).toBe(0)
        }
      }),
    ))

  it('fails with BlockIndexError for y = CHUNK_HEIGHT', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.either(toBlockIndex(0, CHUNK_HEIGHT, 0))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(BlockIndexError)
          expect(result.left.y).toBe(CHUNK_HEIGHT)
        }
      }),
    ))

  it('fails with BlockIndexError for z = CHUNK_SIZE', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.either(toBlockIndex(0, 0, CHUNK_SIZE))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left).toBeInstanceOf(BlockIndexError)
          expect(result.left.z).toBe(CHUNK_SIZE)
        }
      }),
    ))

  it('BlockIndexError tag is "BlockIndexError"', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const result = yield* Effect.either(toBlockIndex(-99, -1, -1))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('BlockIndexError')
        }
      }),
    ))

  it('matches blockIndexUnsafe for valid input', () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const x = 3; const y = 100; const z = 12
        const idx = yield* toBlockIndex(x, y, z)
        expect(idx).toBe(blockIndexUnsafe(x, y, z))
      }),
    ))
})
