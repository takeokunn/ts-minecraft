import { describe, it, expect } from 'vitest'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel'
import { isBlockSolid } from '../application/game-state-physics'

// Index formula: y + z * CHUNK_HEIGHT + x * CHUNK_HEIGHT * CHUNK_SIZE  (column-major)
const blockIndex = (lx: number, ly: number, lz: number): number =>
  ly + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE

const makeEmptyCache = (): Array<{ blocks: Uint8Array } | null> =>
  new Array(9).fill(null)

const allAirChunk = () => ({
  blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT),
})

const chunkWithBlock = (lx: number, ly: number, lz: number) => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  blocks[blockIndex(lx, ly, lz)] = 1
  return { blocks }
}

// Cache slot: (dx + 1) * 3 + (dz + 1) for dx, dz ∈ [-1, 1]
const slot = (dx: number, dz: number): number => (dx + 1) * 3 + (dz + 1)

describe('application/game-state-physics — isBlockSolid', () => {
  describe('bedrock floor (wy < 0)', () => {
    it('returns true for wy = -0.001', () => {
      expect(isBlockSolid(0, -0.001, 0, makeEmptyCache(), 0, 0)).toBe(true)
    })

    it('returns true for wy = -10', () => {
      expect(isBlockSolid(0, -10, 0, makeEmptyCache(), 0, 0)).toBe(true)
    })
  })

  describe('above world ceiling (wy >= CHUNK_HEIGHT)', () => {
    it('returns false for wy = CHUNK_HEIGHT', () => {
      expect(isBlockSolid(0, CHUNK_HEIGHT, 0, makeEmptyCache(), 0, 0)).toBe(false)
    })

    it('returns false for wy = CHUNK_HEIGHT + 100', () => {
      expect(isBlockSolid(0, CHUNK_HEIGHT + 100, 0, makeEmptyCache(), 0, 0)).toBe(false)
    })
  })

  describe('out-of-range chunk offset', () => {
    it('returns false when dx = 2', () => {
      // playerCx=0, wx = 2*CHUNK_SIZE → cx=2, dx=2
      expect(isBlockSolid(2 * CHUNK_SIZE, 5, 0, makeEmptyCache(), 0, 0)).toBe(false)
    })

    it('returns false when dx = -2', () => {
      // playerCx=0, wx = -2*CHUNK_SIZE → cx=-2, dx=-2
      expect(isBlockSolid(-2 * CHUNK_SIZE, 5, 0, makeEmptyCache(), 0, 0)).toBe(false)
    })

    it('returns false when dz = 2', () => {
      expect(isBlockSolid(0, 5, 2 * CHUNK_SIZE, makeEmptyCache(), 0, 0)).toBe(false)
    })

    it('returns false when dz = -2', () => {
      expect(isBlockSolid(0, 5, -2 * CHUNK_SIZE, makeEmptyCache(), 0, 0)).toBe(false)
    })
  })

  describe('null cache slot', () => {
    it('returns false when center cache slot is null', () => {
      const cache = makeEmptyCache()
      // cache[4] is null (center slot dx=0, dz=0)
      expect(isBlockSolid(0, 5, 0, cache, 0, 0)).toBe(false)
    })

    it('returns false when off-center cache slot is null', () => {
      const cache = makeEmptyCache()
      // playerCx=0, wx=CHUNK_SIZE → dx=1, dz=0 → slot 7
      expect(isBlockSolid(CHUNK_SIZE, 5, 0, cache, 0, 0)).toBe(false)
    })
  })

  describe('block lookup in populated center chunk', () => {
    it('returns false for air block (blockType = 0)', () => {
      const cache = makeEmptyCache()
      cache[slot(0, 0)] = allAirChunk()
      expect(isBlockSolid(0, 5, 0, cache, 0, 0)).toBe(false)
    })

    it('returns true for solid block at (lx=0, ly=5, lz=0)', () => {
      const cache = makeEmptyCache()
      cache[slot(0, 0)] = chunkWithBlock(0, 5, 0)
      expect(isBlockSolid(0, 5, 0, cache, 0, 0)).toBe(true)
    })

    it('returns false when adjacent cell has block but query cell is air', () => {
      const cache = makeEmptyCache()
      cache[slot(0, 0)] = chunkWithBlock(1, 5, 0)  // block at lx=1
      expect(isBlockSolid(0, 5, 0, cache, 0, 0)).toBe(false)
    })
  })

  describe('negative coordinate modulo path', () => {
    it('resolves lx correctly for wx = -1 (lx should be CHUNK_SIZE - 1)', () => {
      // wx=-1 → bx=-1 → cx = floor(-1/CHUNK_SIZE) = -1, dx = -1 - (-1) = 0
      // lx = ((-1 % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE = CHUNK_SIZE - 1
      const cache = makeEmptyCache()
      cache[slot(0, 0)] = chunkWithBlock(CHUNK_SIZE - 1, 5, 0)
      expect(isBlockSolid(-1, 5, 0, cache, -1, 0)).toBe(true)
    })

    it('resolves lz correctly for wz = -1 (lz should be CHUNK_SIZE - 1)', () => {
      // wz=-1 → bz=-1 → cz = floor(-1/CHUNK_SIZE) = -1, dz = -1 - (-1) = 0
      // lz = ((-1 % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE = CHUNK_SIZE - 1
      const cache = makeEmptyCache()
      cache[slot(0, 0)] = chunkWithBlock(0, 5, CHUNK_SIZE - 1)
      expect(isBlockSolid(0, 5, -1, cache, 0, -1)).toBe(true)
    })

    it('does NOT match when block is at lx=0 but query resolves to lx = CHUNK_SIZE - 1', () => {
      // Negative-modulo fix: without the double-modulo, JS % returns -1 not CHUNK_SIZE-1
      const cache = makeEmptyCache()
      cache[slot(0, 0)] = chunkWithBlock(0, 5, 0)
      expect(isBlockSolid(-1, 5, 0, cache, -1, 0)).toBe(false)
    })
  })

  describe('neighbor chunk slot routing', () => {
    it('reads from dx=1, dz=0 slot (index 7) for wx = CHUNK_SIZE', () => {
      const cache = makeEmptyCache()
      cache[slot(1, 0)] = chunkWithBlock(0, 5, 0)  // lx=0 because CHUNK_SIZE % CHUNK_SIZE = 0
      expect(isBlockSolid(CHUNK_SIZE, 5, 0, cache, 0, 0)).toBe(true)
    })

    it('reads from dx=-1, dz=0 slot (index 1) for wx = -CHUNK_SIZE', () => {
      // playerCx=0, wx=-CHUNK_SIZE → bx=-16 → cx=floor(-16/16)=-1, dx=-1
      // lx = ((-16 % 16) + 16) % 16 = (0 + 16) % 16 = 0
      const cache = makeEmptyCache()
      cache[slot(-1, 0)] = chunkWithBlock(0, 5, 0)
      expect(isBlockSolid(-CHUNK_SIZE, 5, 0, cache, 0, 0)).toBe(true)
    })

    it('reads from dx=0, dz=1 slot (index 5) for wz = CHUNK_SIZE', () => {
      const cache = makeEmptyCache()
      cache[slot(0, 1)] = chunkWithBlock(0, 5, 0)
      expect(isBlockSolid(0, 5, CHUNK_SIZE, cache, 0, 0)).toBe(true)
    })
  })
})
