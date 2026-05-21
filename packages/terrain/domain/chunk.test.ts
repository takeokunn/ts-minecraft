import { it } from '@effect/vitest'
import { BlockIndexError,CHUNK_HEIGHT,CHUNK_SIZE } from '@ts-minecraft/kernel'
import { Effect,Either,Option } from 'effect'
import { describe,expect } from 'vitest'
import { ChunkService,ChunkServiceLive } from '../application/chunk-service'
import { computeMaxY,getBlocksBatch,setBlockInChunk } from './chunk'
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

// ---------------------------------------------------------------------------
// FR-3.3: computeMaxY — derives the chunk's tightest top-Y for frustum AABB.
// ---------------------------------------------------------------------------

// Mirrors the index layout in `chunk.ts` (idx = y + z*CHUNK_HEIGHT + x*CHUNK_HEIGHT*CHUNK_SIZE).
// Test-only direct write; production code uses `toBlockIndex` + `setBlockInChunk`.
const writeBlockUnsafe = (
  blocks: Uint8Array,
  localX: number,
  y: number,
  localZ: number,
  blockIdx: number,
): void => {
  blocks[y + localZ * CHUNK_HEIGHT + localX * CHUNK_HEIGHT * CHUNK_SIZE] = blockIdx
}

describe('FR-3.3 computeMaxY', () => {
  it('returns -1 for an entirely AIR chunk', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    expect(computeMaxY(blocks)).toBe(-1)
  })

  it('returns 0 when only y=0 has a non-AIR block', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    writeBlockUnsafe(blocks, 0, 0, 0, 1) // STONE at (0,0,0)
    expect(computeMaxY(blocks)).toBe(0)
  })

  it('returns the highest Y when multiple blocks exist at different heights', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    writeBlockUnsafe(blocks, 0, 5, 0, 1)
    writeBlockUnsafe(blocks, 5, 80, 5, 2)
    writeBlockUnsafe(blocks, 0, 30, 0, 1)
    expect(computeMaxY(blocks)).toBe(80)
  })

  it('returns CHUNK_HEIGHT - 1 when the topmost layer has any block', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    writeBlockUnsafe(blocks, 8, CHUNK_HEIGHT - 1, 8, 1)
    expect(computeMaxY(blocks)).toBe(CHUNK_HEIGHT - 1)
  })

  it('finds maxY in any (x, z) column — not just (0, 0)', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    // The only non-AIR block is in the far corner of the chunk at y=42.
    writeBlockUnsafe(blocks, CHUNK_SIZE - 1, 42, CHUNK_SIZE - 1, 1)
    expect(computeMaxY(blocks)).toBe(42)
  })

  it('handles a typical mountain-like profile (y up to ~110)', () => {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    // Fill a 16x16 column up to y=110 to simulate a tall terrain peak.
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        for (let y = 0; y <= 110; y++) {
          writeBlockUnsafe(blocks, x, y, z, 2)
        }
      }
    }
    expect(computeMaxY(blocks)).toBe(110)
  })
})

