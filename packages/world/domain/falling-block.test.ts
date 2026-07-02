import { describe, it } from '@effect/vitest'
import { Effect } from 'effect'
import { expect } from 'vitest'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockTypeToIndex } from '@ts-minecraft/core'
import {
  FALLING_BLOCK_MAX_PER_TICK,
  FallingBlockChunkError,
  collectFallingBlockMoves,
} from './falling-block'

const BLOCK_COUNT = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
const SAND = blockTypeToIndex('SAND')
const GRAVEL = blockTypeToIndex('GRAVEL')
const STONE = blockTypeToIndex('STONE')

const blockIdx = (lx: number, y: number, lz: number): number =>
  y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

const makeChunk = (cx: number, cz: number): { coord: { x: number; z: number }; blocks: Uint8Array } => ({
  coord: { x: cx, z: cz },
  blocks: new Uint8Array(BLOCK_COUNT),
})

// ─── collectFallingBlockMoves ─────────────────────────────────────────────────
describe('collectFallingBlockMoves', () => {
  it.effect('returns an empty list for an empty chunks array', () =>
    Effect.gen(function* () {
      const result = yield* collectFallingBlockMoves([])
      expect(result).toHaveLength(0)
    }),
  )

  it.effect('returns an empty list for a chunk with no SAND or GRAVEL', () =>
    Effect.gen(function* () {
      const chunk = makeChunk(0, 0)
      chunk.blocks[blockIdx(4, 64, 4)] = STONE
      const result = yield* collectFallingBlockMoves([chunk])
      expect(result).toHaveLength(0)
    }),
  )

  it.effect('fails with FallingBlockChunkError for a chunk with wrong block count', () =>
    Effect.gen(function* () {
      const badChunk = { coord: { x: 0, z: 0 }, blocks: new Uint8Array(100) }
      const result = yield* Effect.either(collectFallingBlockMoves([badChunk]))
      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(FallingBlockChunkError)
      }
    }),
  )

  it.effect('generates a move for SAND sitting on AIR', () =>
    Effect.gen(function* () {
      const chunk = makeChunk(0, 0)
      chunk.blocks[blockIdx(0, 10, 0)] = SAND // y=10 → AIR below at y=9
      const result = yield* collectFallingBlockMoves([chunk])
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ from: { y: 10 }, to: { y: 9 }, blockType: 'SAND' })
    }),
  )

  it.effect('generates a move for GRAVEL sitting on AIR', () =>
    Effect.gen(function* () {
      const chunk = makeChunk(0, 0)
      chunk.blocks[blockIdx(2, 20, 3)] = GRAVEL
      const result = yield* collectFallingBlockMoves([chunk])
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ from: { y: 20 }, to: { y: 19 }, blockType: 'GRAVEL' })
    }),
  )

  it.effect('does not generate a move for SAND resting on a solid block', () =>
    Effect.gen(function* () {
      const chunk = makeChunk(0, 0)
      chunk.blocks[blockIdx(4, 64, 4)] = STONE
      chunk.blocks[blockIdx(4, 65, 4)] = SAND // supported by STONE at y=64
      const result = yield* collectFallingBlockMoves([chunk])
      expect(result).toHaveLength(0)
    }),
  )

  it.effect('does not scan SAND at y=0 (cannot fall below world floor)', () =>
    Effect.gen(function* () {
      const chunk = makeChunk(0, 0)
      chunk.blocks[blockIdx(0, 0, 0)] = SAND // at y=0, loop starts at y=1 so this is skipped
      const result = yield* collectFallingBlockMoves([chunk])
      expect(result).toHaveLength(0)
    }),
  )

  it.effect('maps world position correctly from chunk coord + local offset', () =>
    Effect.gen(function* () {
      // Chunk at (2, 3) → world base x=32, z=48. Local (1, 4) → world (33, 52).
      const chunk = makeChunk(2, 3)
      chunk.blocks[blockIdx(1, 15, 4)] = SAND
      const result = yield* collectFallingBlockMoves([chunk])
      expect(result).toHaveLength(1)
      expect(result[0]!.from).toEqual({ x: 33, y: 15, z: 52 })
      expect(result[0]!.to).toEqual({ x: 33, y: 14, z: 52 })
    }),
  )

  it.effect(`caps results at FALLING_BLOCK_MAX_PER_TICK (${FALLING_BLOCK_MAX_PER_TICK}) even when more blocks are falling`, () =>
    Effect.gen(function* () {
      const chunk = makeChunk(0, 0)
      // Fill many cells at y=1 with SAND (all on AIR at y=0)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          chunk.blocks[blockIdx(lx, 1, lz)] = SAND
        }
      }
      const result = yield* collectFallingBlockMoves([chunk])
      expect(result.length).toBeLessThanOrEqual(FALLING_BLOCK_MAX_PER_TICK)
      expect(result).toHaveLength(FALLING_BLOCK_MAX_PER_TICK)
    }),
  )

  it.effect('collects moves from multiple chunks in order', () =>
    Effect.gen(function* () {
      const chunk1 = makeChunk(0, 0)
      chunk1.blocks[blockIdx(0, 5, 0)] = SAND
      const chunk2 = makeChunk(1, 0)
      chunk2.blocks[blockIdx(0, 5, 0)] = GRAVEL
      const result = yield* collectFallingBlockMoves([chunk1, chunk2])
      expect(result).toHaveLength(2)
      expect(result[0]!.from.x).toBe(0)  // chunk1 world x=0
      expect(result[1]!.from.x).toBe(16) // chunk2 world x=16
    }),
  )
})
