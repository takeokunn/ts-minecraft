import { it } from '@effect/vitest'
import { BlockIndexError,CHUNK_HEIGHT,CHUNK_SIZE } from '@ts-minecraft/core'
import { Effect,Either,Option } from 'effect'
import { describe,expect } from 'vitest'
import { ChunkService } from '@ts-minecraft/world/application/chunk-service'
import {
  chunkLocalToWorldCoord,
  createEmptyChunk,
  getBlockFromChunk,
  getBlocksBatch,
  setBlockInChunk,
  setBlockOnChunk,
  worldPositionToChunkCoord,
} from './chunk'
import { ChunkError } from './errors'

// ---------------------------------------------------------------------------
// Helper: create a fresh empty chunk for (0, 0)
// ---------------------------------------------------------------------------
const makeEmptyChunk = () =>
  Effect.succeed(createEmptyChunk({ x: 0, z: 0 }))

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
    }).pipe(Effect.provide(ChunkService.Default))
  )

  it.effect('creates a chunk with a zero-filled blocks buffer of the correct size', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      expect(chunk.blocks).toBeInstanceOf(Uint8Array)
      expect(chunk.blocks.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      expect(chunk.blocks.every(b => b === 0)).toBe(true)
    }).pipe(Effect.provide(ChunkService.Default))
  )

  it.effect('creates a chunk with a fluid buffer wrapped in Option.some', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      expect(Option.isSome(chunk.fluid)).toBe(true)
      const fluid = Option.getOrThrow(chunk.fluid)
      expect(fluid).toBeInstanceOf(Uint8Array)
      expect(fluid.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    }).pipe(Effect.provide(ChunkService.Default))
  )
})

describe('createEmptyChunk', () => {
  it.effect('creates a chunk with the given coord', () =>
    Effect.sync(() => {
      const chunk = createEmptyChunk({ x: 3, z: -2 })
      expect(chunk.coord).toEqual({ x: 3, z: -2 })
    })
  )

  it.effect('creates a chunk with a zero-filled blocks buffer of the correct size', () =>
    Effect.sync(() => {
      const chunk = createEmptyChunk({ x: 0, z: 0 })
      expect(chunk.blocks).toBeInstanceOf(Uint8Array)
      expect(chunk.blocks.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
      expect(chunk.blocks.every(b => b === 0)).toBe(true)
    })
  )

  it.effect('creates a chunk with a fluid buffer wrapped in Option.some', () =>
    Effect.sync(() => {
      const chunk = createEmptyChunk({ x: 0, z: 0 })
      expect(Option.isSome(chunk.fluid)).toBe(true)
      const fluid = Option.getOrThrow(chunk.fluid)
      expect(fluid).toBeInstanceOf(Uint8Array)
      expect(fluid.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    })
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
    }).pipe(Effect.provide(ChunkService.Default))
  )

  it.effect('returns the block type that was set via setBlockInChunk', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      yield* setBlockInChunk(chunk, 2, 10, 3, 'STONE')
      const blockType = yield* cs.getBlock(chunk, 2, 10, 3)
      expect(blockType).toBe('STONE')
    }).pipe(Effect.provide(ChunkService.Default))
  )

  it.effect('succeeds at the maximum valid coordinate boundary', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(
        cs.getBlock(chunk, CHUNK_SIZE - 1, CHUNK_HEIGHT - 1, CHUNK_SIZE - 1)
      )
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(ChunkService.Default))
  )

  it.effect('fails with ChunkError for out-of-range x', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(cs.getBlock(chunk, CHUNK_SIZE, 0, 0))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(ChunkError)
    }).pipe(Effect.provide(ChunkService.Default))
  )

  it.effect('fails with ChunkError for out-of-range y', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(cs.getBlock(chunk, 0, CHUNK_HEIGHT, 0))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(ChunkError)
    }).pipe(Effect.provide(ChunkService.Default))
  )

  it.effect('fails with ChunkError for out-of-range z', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(cs.getBlock(chunk, 0, 0, CHUNK_SIZE))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(ChunkError)
    }).pipe(Effect.provide(ChunkService.Default))
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
    }).pipe(Effect.provide(ChunkService.Default))
  )
})

describe('getBlockFromChunk', () => {
  it.effect('returns AIR for a fresh chunk at (0, 0, 0)', () =>
    Effect.gen(function* () {
      const chunk = createEmptyChunk({ x: 0, z: 0 })
      const blockType = yield* getBlockFromChunk(chunk, 0, 0, 0)
      expect(blockType).toBe('AIR')
    })
  )

  it.effect('returns the block type that was set via setBlockInChunk', () =>
    Effect.gen(function* () {
      const chunk = createEmptyChunk({ x: 0, z: 0 })
      yield* setBlockInChunk(chunk, 2, 10, 3, 'STONE')
      const blockType = yield* getBlockFromChunk(chunk, 2, 10, 3)
      expect(blockType).toBe('STONE')
    })
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
    }).pipe(Effect.provide(ChunkService.Default))
  )

  it.effect('does not mutate the original chunk blocks buffer', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const original = yield* cs.createChunk({ x: 0, z: 0 })
      const originalSnapshot = new Uint8Array(original.blocks)
      yield* cs.setBlock(original, 0, 0, 0, 'STONE')
      // original.blocks should still equal the snapshot
      expect(Array.from(original.blocks)).toEqual(Array.from(originalSnapshot))
    }).pipe(Effect.provide(ChunkService.Default))
  )

  it.effect('preserves all other chunk properties (coord, fluid)', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const original = yield* cs.createChunk({ x: 7, z: -3 })
      const updated = yield* cs.setBlock(original, 0, 0, 0, 'STONE')
      expect(updated.coord).toEqual({ x: 7, z: -3 })
      expect(Option.isSome(updated.fluid)).toBe(true)
    }).pipe(Effect.provide(ChunkService.Default))
  )

  it.effect('succeeds at the maximum valid coordinate boundary', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(
        cs.setBlock(chunk, CHUNK_SIZE - 1, CHUNK_HEIGHT - 1, CHUNK_SIZE - 1, 'STONE')
      )
      expect(Either.isRight(result)).toBe(true)
    }).pipe(Effect.provide(ChunkService.Default))
  )

  it.effect('fails with ChunkError for out-of-range x', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(cs.setBlock(chunk, CHUNK_SIZE, 0, 0, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(ChunkError)
    }).pipe(Effect.provide(ChunkService.Default))
  )

  it.effect('fails with ChunkError for out-of-range y', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(cs.setBlock(chunk, 0, CHUNK_HEIGHT, 0, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(ChunkError)
    }).pipe(Effect.provide(ChunkService.Default))
  )

  it.effect('fails with ChunkError for out-of-range z', () =>
    Effect.gen(function* () {
      const cs = yield* ChunkService
      const chunk = yield* cs.createChunk({ x: 0, z: 0 })
      const result = yield* Effect.either(cs.setBlock(chunk, 0, 0, CHUNK_SIZE, 'STONE'))
      expect(Either.isLeft(result)).toBe(true)
      const err = Option.getOrThrow(Either.getLeft(result))
      expect(err).toBeInstanceOf(ChunkError)
    }).pipe(Effect.provide(ChunkService.Default))
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
    }).pipe(Effect.provide(ChunkService.Default))
  )
})

describe('setBlockOnChunk', () => {
  it.effect('returns a new chunk with the updated block type (immutable)', () =>
    Effect.gen(function* () {
      const original = createEmptyChunk({ x: 0, z: 0 })
      const updated = yield* setBlockOnChunk(original, 1, 5, 2, 'GRASS')
      expect(original.blocks[0]).toBe(0)
      const blockType = yield* getBlockFromChunk(updated, 1, 5, 2)
      expect(blockType).toBe('GRASS')
    })
  )
})

describe('chunk coordinate transforms', () => {
  it.effect('maps world coordinates to chunk coordinates', () =>
    Effect.sync(() => {
      expect(worldPositionToChunkCoord(32, 48)).toEqual({ x: 2, z: 3 })
      expect(worldPositionToChunkCoord(-1, 0)).toEqual({ x: -1, z: 0 })
    })
  )

  it.effect('maps chunk coordinates back to world coordinates', () =>
    Effect.sync(() => {
      expect(chunkLocalToWorldCoord({ x: 2, z: 3 }, 5, 7)).toEqual({ x: 37, z: 55 })
      expect(chunkLocalToWorldCoord({ x: -1, z: -1 }, 0, 0)).toEqual({ x: -CHUNK_SIZE, z: -CHUNK_SIZE })
    })
  )
})
