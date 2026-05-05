import { it } from '@effect/vitest'
import { BlockIndexError,CHUNK_HEIGHT,CHUNK_SIZE } from '@ts-minecraft/kernel'
import { Effect,Either,Option } from 'effect'
import { describe,expect } from 'vitest'
import { ChunkService,ChunkServiceLive } from '../application/chunk-service'
import { getBlocksBatch,setBlockInChunk } from './chunk'
import { ChunkError } from './errors'

// ---------------------------------------------------------------------------
// Helper: create a fresh empty chunk for (0, 0)
// ---------------------------------------------------------------------------
const makeEmptyChunk = () =>
  Effect.gen(function* () {
    const cs = yield* ChunkService
    return yield* cs.createChunk({ x: 0, z: 0 })
  }).pipe(Effect.provide(ChunkServiceLive))

// ---------------------------------------------------------------------------
// getBlocksBatch
// ---------------------------------------------------------------------------

describe('getBlocksBatch', () => {
  it.effect('returns the chunk blocks buffer as a Readonly<Uint8Array>', () =>
    Effect.gen(function* () {
      const chunk = yield* makeEmptyChunk()
      const blocks = yield* getBlocksBatch(chunk)
      expect(blocks).toBe(chunk.blocks)
      expect(blocks.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    })
  )
})

// ---------------------------------------------------------------------------
// setBlockInChunk
// ---------------------------------------------------------------------------

describe('setBlockInChunk', () => {
  it.effect('mutates chunk.blocks in-place at valid coordinates', () =>
    Effect.gen(function* () {
      const chunk = yield* makeEmptyChunk()
      const initialValue = chunk.blocks[0]
      // Block at (0, 0, 0) starts as AIR (index 0)
      expect(initialValue).toBe(0)

      yield* setBlockInChunk(chunk, 0, 0, 0, 'GRASS')

      // In-place mutation: chunk.blocks[0] must differ from 0 (GRASS index ≠ 0)
      expect(chunk.blocks[0]).not.toBe(0)
    })
  )

  it.effect('succeeds for coordinates at the valid boundary (CHUNK_SIZE-1, CHUNK_HEIGHT-1)', () =>
    Effect.gen(function* () {
      const chunk = yield* makeEmptyChunk()
      const result = yield* Effect.either(
        setBlockInChunk(chunk, CHUNK_SIZE - 1, CHUNK_HEIGHT - 1, CHUNK_SIZE - 1, 'STONE')
      )
      expect(Either.isRight(result)).toBe(true)
    })
  )

  it.effect('fails with BlockIndexError when x is out of range', () =>
    Effect.gen(function* () {
      const chunk = yield* makeEmptyChunk()
      const result = yield* Effect.either(setBlockInChunk(chunk, CHUNK_SIZE, 0, 0, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(BlockIndexError)
      expect(err.x).toBe(CHUNK_SIZE)
    })
  )

  it.effect('fails with BlockIndexError when y is out of range', () =>
    Effect.gen(function* () {
      const chunk = yield* makeEmptyChunk()
      const result = yield* Effect.either(setBlockInChunk(chunk, 0, CHUNK_HEIGHT, 0, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(BlockIndexError)
      expect(err.y).toBe(CHUNK_HEIGHT)
    })
  )

  it.effect('fails with BlockIndexError when z is out of range', () =>
    Effect.gen(function* () {
      const chunk = yield* makeEmptyChunk()
      const result = yield* Effect.either(setBlockInChunk(chunk, 0, 0, CHUNK_SIZE, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(BlockIndexError)
      expect(err.z).toBe(CHUNK_SIZE)
    })
  )

  it.effect('fails with BlockIndexError for negative coordinates', () =>
    Effect.gen(function* () {
      const chunk = yield* makeEmptyChunk()
      const result = yield* Effect.either(setBlockInChunk(chunk, -1, 0, 0, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(BlockIndexError)
    })
  )
})

// ---------------------------------------------------------------------------
// ChunkService.createChunk
// ---------------------------------------------------------------------------

describe('ChunkService.createChunk', () => {
  it.effect('creates a chunk with the given coord', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 3, z: -2 })
      expect(chunk.coord).toEqual({ x: 3, z: -2 })
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('creates a chunk with a zero-filled blocks buffer of the correct size', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      expect(chunk.blocks).toBeInstanceOf(Uint8Array)
      expect(chunk.blocks.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      expect(chunk.blocks.every(b => b === 0)).toBe(true)
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('creates a chunk with a fluid buffer wrapped in Option.some', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      expect(Option.isSome(chunk.fluid)).toBe(true)
      const fluid = Option.getOrThrow(chunk.fluid)
      expect(fluid).toBeInstanceOf(Uint8Array)
      expect(fluid.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    }).pipe(Effect.provide(ChunkServiceLive))
  )
})

// ---------------------------------------------------------------------------
// ChunkService.getBlock
// ---------------------------------------------------------------------------

describe('ChunkService.getBlock', () => {
  it.effect('returns AIR for a fresh chunk at (0, 0, 0)', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const blockType = yield* cs.getBlock(chunk, 0, 0, 0)
      expect(blockType).toBe('AIR')
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('returns the block type that was set via setBlockInChunk', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      yield* setBlockInChunk(chunk, 2, 10, 3, 'STONE')
      const blockType = yield* cs.getBlock(chunk, 2, 10, 3)
      expect(blockType).toBe('STONE')
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('succeeds at the maximum valid coordinate boundary', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(
        cs.getBlock(chunk, CHUNK_SIZE - 1, CHUNK_HEIGHT - 1, CHUNK_SIZE - 1)
      )
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('fails with ChunkError for out-of-range x', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(cs.getBlock(chunk, CHUNK_SIZE, 0, 0))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(ChunkError)
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('fails with ChunkError for out-of-range y', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(cs.getBlock(chunk, 0, CHUNK_HEIGHT, 0))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(ChunkError)
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('fails with ChunkError for out-of-range z', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(cs.getBlock(chunk, 0, 0, CHUNK_SIZE))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(ChunkError)
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('error message includes invalid coordinates', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 2, z: 5 })
      const result = yield* Effect.either(cs.getBlock(chunk, -1, 0, 0))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(ChunkError)
      expect(err.reason).toContain('-1')
    }).pipe(Effect.provide(ChunkServiceLive))
  )
})

// ---------------------------------------------------------------------------
// ChunkService.setBlock
// ---------------------------------------------------------------------------

describe('ChunkService.setBlock', () => {
  it.effect('returns a new chunk with the updated block type (immutable)', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const original = yield* cs.createChunk({ x: 0, z: 0 })
      const updated = yield* cs.setBlock(original, 1, 5, 2, 'GRASS')
      // original blocks buffer must be unchanged
      expect(original.blocks[0]).toBe(0)
      // updated chunk has the new block
      const blockType = yield* cs.getBlock(updated, 1, 5, 2)
      expect(blockType).toBe('GRASS')
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('does not mutate the original chunk blocks buffer', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const original = yield* cs.createChunk({ x: 0, z: 0 })
      const originalSnapshot = new Uint8Array(original.blocks)
      yield* cs.setBlock(original, 0, 0, 0, 'STONE')
      // original.blocks should still equal the snapshot
      expect(Array.from(original.blocks)).toEqual(Array.from(originalSnapshot))
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('preserves all other chunk properties (coord, fluid)', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const original = yield* cs.createChunk({ x: 7, z: -3 })
      const updated = yield* cs.setBlock(original, 0, 0, 0, 'STONE')
      expect(updated.coord).toEqual({ x: 7, z: -3 })
      expect(Option.isSome(updated.fluid)).toBe(true)
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('succeeds at the maximum valid coordinate boundary', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(
        cs.setBlock(chunk, CHUNK_SIZE - 1, CHUNK_HEIGHT - 1, CHUNK_SIZE - 1, 'STONE')
      )
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('fails with ChunkError for out-of-range x', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(cs.setBlock(chunk, CHUNK_SIZE, 0, 0, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(ChunkError)
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('fails with ChunkError for out-of-range y', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(cs.setBlock(chunk, 0, CHUNK_HEIGHT, 0, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(ChunkError)
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('fails with ChunkError for out-of-range z', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(cs.setBlock(chunk, 0, 0, CHUNK_SIZE, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(ChunkError)
    }).pipe(Effect.provide(ChunkServiceLive))
  )

  it.effect('error message includes invalid coordinates and valid range hint', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 1, z: 2 })
      const result = yield* Effect.either(cs.setBlock(chunk, -1, 0, 0, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(ChunkError)
      expect(err.reason).toContain('-1')
    }).pipe(Effect.provide(ChunkServiceLive))
  )
})

// ---------------------------------------------------------------------------
// ChunkService.worldToChunkCoord
// ---------------------------------------------------------------------------

