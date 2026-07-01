import { HashMap, Option } from 'effect'
import { blockTypeToIndex } from '@ts-minecraft/core'
import { describe, expect, it } from 'vitest'
import {
  blockAt,
  cacheFromChunks,
  canFluidReplaceAt,
} from '../application/fluid-service-helpers'
import { makeEmptyTestChunk, makeTestChunkWithBlocks } from './chunk-buffer-test-utils'

// ─── fixtures ─────────────────────────────────────────────────────────────────

// Chunk at origin coord {x:0, z:0}; world position (0, 64, 0) maps to local (0, 64, 0)
const ORIGIN_CHUNK = makeEmptyTestChunk({ x: 0, z: 0 })
const CHUNK_AT_1_0 = makeEmptyTestChunk({ x: 1, z: 0 })

const posAt = (x: number, y: number, z: number) => ({ x, y, z })

// World position (0,64,0) sits inside chunk {x:0, z:0} at local (0,64,0)
const POS_ORIGIN = posAt(0, 64, 0)
// World position (16,64,0) sits inside chunk {x:1, z:0}
const POS_CHUNK1 = posAt(16, 64, 0)
// Position inside an unloaded chunk
const POS_UNLOADED = posAt(100, 64, 100)

// ─── cacheFromChunks ──────────────────────────────────────────────────────────

describe('cacheFromChunks', () => {
  it('returns an empty HashMap for an empty array', () => {
    const cache = cacheFromChunks([])
    expect(HashMap.size(cache)).toBe(0)
  })

  it('stores a single chunk keyed by its coord', () => {
    const cache = cacheFromChunks([ORIGIN_CHUNK])
    expect(HashMap.size(cache)).toBe(1)
  })

  it('stores multiple chunks keyed by their coords', () => {
    const cache = cacheFromChunks([ORIGIN_CHUNK, CHUNK_AT_1_0])
    expect(HashMap.size(cache)).toBe(2)
  })

  it('deduplicates chunks with the same coord (last one wins)', () => {
    const chunk2 = makeEmptyTestChunk({ x: 0, z: 0 })
    const cache = cacheFromChunks([ORIGIN_CHUNK, chunk2])
    expect(HashMap.size(cache)).toBe(1)
  })
})

// ─── canFluidReplaceAt ────────────────────────────────────────────────────────

describe('canFluidReplaceAt — unloaded chunk', () => {
  it('returns false when the chunk is not in the cache', () => {
    const cache = cacheFromChunks([ORIGIN_CHUNK])
    expect(canFluidReplaceAt(cache, POS_UNLOADED, 'water')).toBe(false)
  })
})

describe('canFluidReplaceAt — AIR block', () => {
  it('returns true for water on an AIR block', () => {
    const cache = cacheFromChunks([ORIGIN_CHUNK]) // empty chunk = all AIR
    expect(canFluidReplaceAt(cache, POS_ORIGIN, 'water')).toBe(true)
  })

  it('returns true for lava on an AIR block', () => {
    const cache = cacheFromChunks([ORIGIN_CHUNK])
    expect(canFluidReplaceAt(cache, POS_ORIGIN, 'lava')).toBe(true)
  })
})

describe('canFluidReplaceAt — solid block (STONE)', () => {
  const stoneChunk = makeTestChunkWithBlocks([{ lx: 0, y: 64, lz: 0, blockType: 'STONE' }])
  const cache = cacheFromChunks([stoneChunk])

  it('returns false for water on a solid STONE block', () => {
    expect(canFluidReplaceAt(cache, POS_ORIGIN, 'water')).toBe(false)
  })

  it('returns false for lava on a solid STONE block', () => {
    expect(canFluidReplaceAt(cache, POS_ORIGIN, 'lava')).toBe(false)
  })
})

describe('canFluidReplaceAt — water-breakable block (TORCH)', () => {
  const torchChunk = makeTestChunkWithBlocks([{ lx: 0, y: 64, lz: 0, blockType: 'TORCH' }])
  const cache = cacheFromChunks([torchChunk])

  it('returns true for water on a TORCH (water-breakable)', () => {
    expect(canFluidReplaceAt(cache, POS_ORIGIN, 'water')).toBe(true)
  })

  it('returns false for lava on a TORCH (lava cannot break plants/torches)', () => {
    expect(canFluidReplaceAt(cache, POS_ORIGIN, 'lava')).toBe(false)
  })
})

// ─── blockAt ─────────────────────────────────────────────────────────────────

describe('blockAt', () => {
  it('returns Option.none when the chunk is not in the cache', () => {
    const cache = cacheFromChunks([ORIGIN_CHUNK])
    expect(Option.isNone(blockAt(cache, POS_UNLOADED))).toBe(true)
  })

  it('returns Option.some(0) for an AIR block', () => {
    const cache = cacheFromChunks([ORIGIN_CHUNK]) // all AIR = index 0
    const result = blockAt(cache, POS_ORIGIN)
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrNull(result)).toBe(blockTypeToIndex('AIR'))
  })

  it('returns Option.some(stoneIndex) for a STONE block placed at the position', () => {
    const stoneChunk = makeTestChunkWithBlocks([{ lx: 0, y: 64, lz: 0, blockType: 'STONE' }])
    const cache = cacheFromChunks([stoneChunk])
    const result = blockAt(cache, POS_ORIGIN)
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrNull(result)).toBe(blockTypeToIndex('STONE'))
  })

  it('looks up blocks in a non-origin chunk', () => {
    const stoneChunk = makeTestChunkWithBlocks(
      [{ lx: 0, y: 64, lz: 0, blockType: 'STONE' }],
      { x: 1, z: 0 },
    )
    const cache = cacheFromChunks([stoneChunk])
    const result = blockAt(cache, POS_CHUNK1)
    expect(Option.isSome(result)).toBe(true)
    expect(Option.getOrNull(result)).toBe(blockTypeToIndex('STONE'))
  })
})
