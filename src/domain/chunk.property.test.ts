import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Arbitrary, Effect, Either, Option, Schema } from 'effect'
import { blockIndex, setBlockInChunk, CHUNK_SIZE, CHUNK_HEIGHT, type Chunk } from './chunk'
import type { BlockType } from './block'

/**
 * Recovers (x, y, z) coordinates from a flat block index.
 * Inverse of: index = y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE
 */
function indexToCoords(index: number): { x: number; y: number; z: number } {
  const y = index % CHUNK_HEIGHT
  const z = Math.floor(index / CHUNK_HEIGHT) % CHUNK_SIZE
  const x = Math.floor(index / (CHUNK_HEIGHT * CHUNK_SIZE))
  return { x, y, z }
}

const validX = Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(0, CHUNK_SIZE - 1)))
const validY = Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(0, CHUNK_HEIGHT - 1)))
const validZ = Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(0, CHUNK_SIZE - 1)))

describe('blockIndex (property-based)', () => {
  it.prop(
    'returns Some for every in-bounds coordinate',
    { x: validX, y: validY, z: validZ },
    ({ x, y, z }) => {
      expect(Option.isSome(blockIndex(x, y, z))).toBe(true)
    }
  )

  it.prop(
    'returns None for out-of-bounds x',
    { x: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(CHUNK_SIZE, CHUNK_SIZE + 100))), y: validY, z: validZ },
    ({ x, y, z }) => {
      expect(blockIndex(x, y, z)).toEqual(Option.none())
    }
  )

  it.prop(
    'returns None for out-of-bounds y',
    { x: validX, y: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(CHUNK_HEIGHT, CHUNK_HEIGHT + 100))), z: validZ },
    ({ x, y, z }) => {
      expect(blockIndex(x, y, z)).toEqual(Option.none())
    }
  )

  it.prop(
    'returns None for out-of-bounds z',
    { x: validX, y: validY, z: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(CHUNK_SIZE, CHUNK_SIZE + 100))) },
    ({ x, y, z }) => {
      expect(blockIndex(x, y, z)).toEqual(Option.none())
    }
  )

  it.prop(
    'returns None for negative coordinates',
    {
      x: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, -1))),
      y: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, -1))),
      z: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, -1))),
    },
    ({ x, y, z }) => {
      expect(blockIndex(x, y, z)).toEqual(Option.none())
    }
  )

  it.prop(
    'distinct in-bounds coordinates produce distinct flat indices',
    { x1: validX, y1: validY, z1: validZ, x2: validX, y2: validY, z2: validZ },
    ({ x1, y1, z1, x2, y2, z2 }) => {
      if (x1 === x2 && y1 === y2 && z1 === z2) return
      const idx1 = blockIndex(x1, y1, z1)
      const idx2 = blockIndex(x2, y2, z2)
      expect(Option.isSome(idx1)).toBe(true)
      expect(Option.isSome(idx2)).toBe(true)
      expect(idx1).not.toEqual(idx2)
    },
    { fastCheck: { numRuns: 200 } }
  )

  it.prop(
    'round-trips: indexToCoords(blockIndex(x,y,z)) === (x,y,z) for all in-bounds inputs',
    { x: validX, y: validY, z: validZ },
    ({ x, y, z }) => {
      const idxOpt = blockIndex(x, y, z)
      expect(Option.isSome(idxOpt)).toBe(true)
      if (!Option.isSome(idxOpt)) return
      const recovered = indexToCoords(idxOpt.value)
      expect(recovered).toEqual({ x, y, z })
    }
  )

  it.prop(
    'index is always within the valid flat-array range [0, CHUNK_SIZE*CHUNK_SIZE*CHUNK_HEIGHT)',
    { x: validX, y: validY, z: validZ },
    ({ x, y, z }) => {
      const totalBlocks = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
      const idxOpt = blockIndex(x, y, z)
      expect(Option.isSome(idxOpt)).toBe(true)
      if (!Option.isSome(idxOpt)) return
      expect(idxOpt.value).toBeGreaterThanOrEqual(0)
      expect(idxOpt.value).toBeLessThan(totalBlocks)
    }
  )
})

// ---------------------------------------------------------------------------
// Helper: create a minimal Chunk for testing
// ---------------------------------------------------------------------------
const makeTestChunk = (): Chunk => ({
  coord: { x: 0, z: 0 },
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
})

describe('setBlockInChunk (property-based)', () => {
  it.effect.prop(
    'succeeds for every in-bounds coordinate',
    { x: validX, y: validY, z: validZ },
    ({ x, y, z }) =>
      Effect.gen(function* () {
        const chunk = makeTestChunk()
        const result = yield* Effect.either(setBlockInChunk(chunk, x, y, z, 'DIRT' as BlockType))
        expect(Either.isRight(result)).toBe(true)
      })
  )

  it.effect.prop(
    'fails with BlockIndexError for out-of-bounds x (x < 0)',
    { x: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, -1))), y: validY, z: validZ },
    ({ x, y, z }) =>
      Effect.gen(function* () {
        const chunk = makeTestChunk()
        const result = yield* Effect.either(setBlockInChunk(chunk, x, y, z, 'STONE' as BlockType))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('BlockIndexError')
        }
      })
  )

  it.effect.prop(
    'fails with BlockIndexError for out-of-bounds x (x >= CHUNK_SIZE)',
    { x: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(CHUNK_SIZE, CHUNK_SIZE + 100))), y: validY, z: validZ },
    ({ x, y, z }) =>
      Effect.gen(function* () {
        const chunk = makeTestChunk()
        const result = yield* Effect.either(setBlockInChunk(chunk, x, y, z, 'STONE' as BlockType))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('BlockIndexError')
        }
      })
  )

  it.effect.prop(
    'fails with BlockIndexError for out-of-bounds y (y < 0)',
    { x: validX, y: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, -1))), z: validZ },
    ({ x, y, z }) =>
      Effect.gen(function* () {
        const chunk = makeTestChunk()
        const result = yield* Effect.either(setBlockInChunk(chunk, x, y, z, 'GRASS' as BlockType))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('BlockIndexError')
        }
      })
  )

  it.effect.prop(
    'fails with BlockIndexError for out-of-bounds y (y >= CHUNK_HEIGHT)',
    { x: validX, y: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(CHUNK_HEIGHT, CHUNK_HEIGHT + 100))), z: validZ },
    ({ x, y, z }) =>
      Effect.gen(function* () {
        const chunk = makeTestChunk()
        const result = yield* Effect.either(setBlockInChunk(chunk, x, y, z, 'GRASS' as BlockType))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('BlockIndexError')
        }
      })
  )

  it.effect.prop(
    'fails with BlockIndexError for out-of-bounds z (z < 0)',
    { x: validX, y: validY, z: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(-100, -1))) },
    ({ x, y, z }) =>
      Effect.gen(function* () {
        const chunk = makeTestChunk()
        const result = yield* Effect.either(setBlockInChunk(chunk, x, y, z, 'SAND' as BlockType))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('BlockIndexError')
        }
      })
  )

  it.effect.prop(
    'fails with BlockIndexError for out-of-bounds z (z >= CHUNK_SIZE)',
    { x: validX, y: validY, z: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(CHUNK_SIZE, CHUNK_SIZE + 100))) },
    ({ x, y, z }) =>
      Effect.gen(function* () {
        const chunk = makeTestChunk()
        const result = yield* Effect.either(setBlockInChunk(chunk, x, y, z, 'SAND' as BlockType))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          expect(result.left._tag).toBe('BlockIndexError')
        }
      })
  )

  it.effect.prop(
    'mutates the block at the correct index after a successful write',
    { x: validX, y: validY, z: validZ },
    ({ x, y, z }) =>
      Effect.gen(function* () {
        const chunk = makeTestChunk()
        yield* setBlockInChunk(chunk, x, y, z, 'DIRT' as BlockType)
        // blockIndex is the inverse mapping — verify the written position
        const idxOpt = blockIndex(x, y, z)
        expect(Option.isSome(idxOpt)).toBe(true)
        if (!Option.isSome(idxOpt)) return
        // DIRT maps to index 1
        expect(chunk.blocks[idxOpt.value]).toBe(1)
      })
  )

  it.effect.prop(
    'BlockIndexError carries the out-of-bounds coordinates',
    { x: Arbitrary.make(Schema.Number.pipe(Schema.int(), Schema.between(CHUNK_SIZE, CHUNK_SIZE + 50))), y: validY, z: validZ },
    ({ x, y, z }) =>
      Effect.gen(function* () {
        const chunk = makeTestChunk()
        const result = yield* Effect.either(setBlockInChunk(chunk, x, y, z, 'AIR' as BlockType))
        expect(Either.isLeft(result)).toBe(true)
        if (Either.isLeft(result)) {
          const err = result.left
          expect(err.x).toBe(x)
          expect(err.y).toBe(y)
          expect(err.z).toBe(z)
        }
      })
  )
})
