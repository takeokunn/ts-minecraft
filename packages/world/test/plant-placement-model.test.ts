import { describe, expect, it } from 'vitest'
import {
  AIR_BLOCK_INDEX,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  isLocalColumnInChunk,
  columnStateIndex,
  blockAt,
  setBlock,
} from '@ts-minecraft/world/domain/terrain/plant-placement-model'

// ─── helpers ─────────────────────────────────────────────────────────────────

const chunkBlockIndexUnchecked = (lx: number, y: number, lz: number): number =>
  y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

const makeBlocks = (): Uint8Array => new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)

// ─── isLocalColumnInChunk ─────────────────────────────────────────────────────
describe('isLocalColumnInChunk', () => {
  it('returns true for the origin (0, 0)', () => {
    expect(isLocalColumnInChunk(0, 0)).toBe(true)
  })

  it('returns true for the far corner (CHUNK_SIZE-1, CHUNK_SIZE-1)', () => {
    expect(isLocalColumnInChunk(CHUNK_SIZE - 1, CHUNK_SIZE - 1)).toBe(true)
  })

  it('returns false for negative lx', () => {
    expect(isLocalColumnInChunk(-1, 0)).toBe(false)
  })

  it('returns false for negative lz', () => {
    expect(isLocalColumnInChunk(0, -1)).toBe(false)
  })

  it('returns false when lx equals CHUNK_SIZE (out of bounds)', () => {
    expect(isLocalColumnInChunk(CHUNK_SIZE, 0)).toBe(false)
  })

  it('returns false when lz equals CHUNK_SIZE (out of bounds)', () => {
    expect(isLocalColumnInChunk(0, CHUNK_SIZE)).toBe(false)
  })

  it('returns true for all valid in-chunk coordinates', () => {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        expect(isLocalColumnInChunk(lx, lz)).toBe(true)
      }
    }
  })
})

// ─── columnStateIndex ─────────────────────────────────────────────────────────
describe('columnStateIndex', () => {
  it('returns 0 for the origin (0, 0)', () => {
    expect(columnStateIndex(0, 0)).toBe(0)
  })

  it('returns CHUNK_SIZE for (1, 0)', () => {
    // lx * CHUNK_SIZE + lz = 1 * 16 + 0 = 16
    expect(columnStateIndex(1, 0)).toBe(CHUNK_SIZE)
  })

  it('returns 1 for (0, 1)', () => {
    expect(columnStateIndex(0, 1)).toBe(1)
  })

  it('produces distinct indices for all chunk columns', () => {
    const indices = new Set<number>()
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        indices.add(columnStateIndex(lx, lz))
      }
    }
    expect(indices.size).toBe(CHUNK_SIZE * CHUNK_SIZE)
  })

  it('maps to a range of [0, CHUNK_SIZE*CHUNK_SIZE)', () => {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const idx = columnStateIndex(lx, lz)
        expect(idx).toBeGreaterThanOrEqual(0)
        expect(idx).toBeLessThan(CHUNK_SIZE * CHUNK_SIZE)
      }
    }
  })
})

// ─── blockAt ─────────────────────────────────────────────────────────────────
describe('blockAt', () => {
  it('returns AIR_BLOCK_INDEX for an all-zero buffer', () => {
    const blocks = makeBlocks()
    expect(blockAt(blocks, 0, 0, 0)).toBe(0)
  })

  it('reads the correct byte at a given position', () => {
    const blocks = makeBlocks()
    const idx = chunkBlockIndexUnchecked(3, 64, 5)
    blocks[idx] = 42
    expect(blockAt(blocks, 3, 64, 5)).toBe(42)
  })

  it('returns AIR_BLOCK_INDEX for out-of-range index (undefined → fallback)', () => {
    const blocks = makeBlocks()
    // Negative lx would produce a negative index → undefined → fallback
    expect(blockAt(blocks, -1, 0, 0)).toBe(AIR_BLOCK_INDEX)
  })
})

// ─── setBlock ─────────────────────────────────────────────────────────────────
describe('setBlock', () => {
  it('writes the block index into the buffer at the correct position', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 3, 64, 5, 99)
    const idx = chunkBlockIndexUnchecked(3, 64, 5)
    expect(blocks[idx]).toBe(99)
  })

  it('does not affect other positions in the buffer', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 0, 64, 0, 7)
    const idx = chunkBlockIndexUnchecked(1, 64, 0)
    expect(blocks[idx]).toBe(0)
  })

  it('overwrites a previously written value', () => {
    const blocks = makeBlocks()
    setBlock(blocks, 2, 32, 2, 10)
    setBlock(blocks, 2, 32, 2, 55)
    expect(blockAt(blocks, 2, 32, 2)).toBe(55)
  })
})
