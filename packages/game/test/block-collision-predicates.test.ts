import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { isBlockSolid, isInWater, OFFSETS_3x3 } from '@ts-minecraft/game'
import {
  BLOCK_IDS,
  chunkBlockIndex,
  CHUNK_HEIGHT,
  makeAirChunkCache,
  makeNullChunkCache,
  makeSingleBlockCache,
  makeChunkCache,
} from './physics-builders'

// Player always at chunk (0, 0) for these tests unless noted.
const PLAYER_CX = 0
const PLAYER_CZ = 0

// ---------------------------------------------------------------------------
// isBlockSolid
// ---------------------------------------------------------------------------

describe('isBlockSolid', () => {
  describe('bedrock floor boundary', () => {
    it('returns true for y < 0 regardless of chunk data (bedrock underworld)', () => {
      const cache = makeAirChunkCache()
      expect(isBlockSolid(0, -1, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(true)
    })

    it('returns true for y = -0.5 (fractional negative rounds below 0)', () => {
      const cache = makeAirChunkCache()
      expect(isBlockSolid(0, -0.5, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(true)
    })

    it('returns false for y = 0 with AIR block present', () => {
      const cache = makeAirChunkCache()
      expect(isBlockSolid(0, 0, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })
  })

  describe('height ceiling boundary', () => {
    it('returns false for y = CHUNK_HEIGHT (above world)', () => {
      const cache = makeAirChunkCache()
      expect(isBlockSolid(0, CHUNK_HEIGHT, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })

    it('returns false for y = CHUNK_HEIGHT + 1 (well above world)', () => {
      const cache = makeAirChunkCache()
      expect(isBlockSolid(0, CHUNK_HEIGHT + 1, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })
  })

  describe('solid block detection', () => {
    it('returns true when a DIRT block is at the queried world position', () => {
      const LOCAL_X = 0; const LOCAL_Y = 64; const LOCAL_Z = 0
      const cache = makeSingleBlockCache(BLOCK_IDS.DIRT, LOCAL_X, LOCAL_Y, LOCAL_Z)
      // World coords = localX + playerCx*16, etc. (player at chunk 0,0)
      expect(isBlockSolid(LOCAL_X, LOCAL_Y, LOCAL_Z, cache, PLAYER_CX, PLAYER_CZ)).toBe(true)
    })

    it('returns true when a STONE block is at the queried world position', () => {
      const LOCAL_X = 5; const LOCAL_Y = 70; const LOCAL_Z = 3
      const cache = makeSingleBlockCache(BLOCK_IDS.STONE, LOCAL_X, LOCAL_Y, LOCAL_Z)
      expect(isBlockSolid(LOCAL_X, LOCAL_Y, LOCAL_Z, cache, PLAYER_CX, PLAYER_CZ)).toBe(true)
    })

    it('returns false when the block at the position is AIR', () => {
      const cache = makeAirChunkCache()
      expect(isBlockSolid(0, 64, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })
  })

  describe('passable blocks are not solid', () => {
    it('WATER block is NOT solid (player can swim through)', () => {
      const cache = makeSingleBlockCache(BLOCK_IDS.WATER, 0, 60, 0)
      expect(isBlockSolid(0, 60, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })

    it('LAVA block is NOT solid (player passes through)', () => {
      const cache = makeSingleBlockCache(BLOCK_IDS.LAVA, 0, 60, 0)
      expect(isBlockSolid(0, 60, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })

    it('LEAVES block is NOT solid (player can walk through leaves)', () => {
      const cache = makeSingleBlockCache(BLOCK_IDS.LEAVES, 0, 60, 0)
      expect(isBlockSolid(0, 60, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })

    it('TORCH block is NOT solid (player passes through torch)', () => {
      const cache = makeSingleBlockCache(BLOCK_IDS.TORCH, 0, 60, 0)
      expect(isBlockSolid(0, 60, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })
  })

  describe('chunk boundary and neighbouring chunks', () => {
    it('returns false when the chunk is null (unloaded)', () => {
      const cache = makeNullChunkCache()
      expect(isBlockSolid(0, 64, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })

    it('returns false when querying beyond the 3×3 neighbourhood (dx > 1)', () => {
      const cache = makeAirChunkCache()
      // Chunk 3 away in X — beyond the cached 3×3 window.
      const FAR_WORLD_X = 3 * 16 // chunk cx=3, dx=3 > 1
      expect(isBlockSolid(FAR_WORLD_X, 64, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })

    it('returns true for a solid block in a neighbouring chunk (dx=1, dz=0)', () => {
      // Place a DIRT block in the chunk to the +X neighbour.
      const NEIGHBOUR_CX = 1
      const LOCAL_X = 2; const LOCAL_Y = 64; const LOCAL_Z = 0
      const WORLD_X = NEIGHBOUR_CX * 16 + LOCAL_X
      const cache = makeChunkCache((blocks, relDx, relDz) => {
        if (relDx === 1 && relDz === 0) {
          blocks[chunkBlockIndex(LOCAL_X, LOCAL_Y, LOCAL_Z)] = BLOCK_IDS.DIRT
        }
      })
      expect(isBlockSolid(WORLD_X, LOCAL_Y, LOCAL_Z, cache, PLAYER_CX, PLAYER_CZ)).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// isInWater
// ---------------------------------------------------------------------------

describe('isInWater', () => {
  describe('boundary conditions', () => {
    it('returns false for y < 0 (below world)', () => {
      const cache = makeAirChunkCache()
      expect(isInWater(0, -1, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })

    it('returns false for y = CHUNK_HEIGHT (above world)', () => {
      const cache = makeAirChunkCache()
      expect(isInWater(0, CHUNK_HEIGHT, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })
  })

  describe('water detection', () => {
    it('returns true when a WATER block is at the queried position', () => {
      const LOCAL_X = 4; const LOCAL_Y = 62; const LOCAL_Z = 7
      const cache = makeSingleBlockCache(BLOCK_IDS.WATER, LOCAL_X, LOCAL_Y, LOCAL_Z)
      expect(isInWater(LOCAL_X, LOCAL_Y, LOCAL_Z, cache, PLAYER_CX, PLAYER_CZ)).toBe(true)
    })

    it('returns false when a DIRT block is at the queried position (not water)', () => {
      const cache = makeSingleBlockCache(BLOCK_IDS.DIRT, 0, 62, 0)
      expect(isInWater(0, 62, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })

    it('returns false when the block is AIR', () => {
      const cache = makeAirChunkCache()
      expect(isInWater(0, 64, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })

    it('returns false when LAVA is present (lava is not water)', () => {
      const cache = makeSingleBlockCache(BLOCK_IDS.LAVA, 0, 62, 0)
      expect(isInWater(0, 62, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })
  })

  describe('chunk boundary conditions', () => {
    it('returns false when chunk is null (unloaded)', () => {
      const cache = makeNullChunkCache()
      expect(isInWater(0, 62, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })

    it('returns false when querying beyond the 3×3 neighbourhood', () => {
      const cache = makeAirChunkCache()
      const FAR_WORLD_X = 3 * 16
      expect(isInWater(FAR_WORLD_X, 62, 0, cache, PLAYER_CX, PLAYER_CZ)).toBe(false)
    })

    it('returns true for water in a neighbouring chunk (dx=0, dz=1)', () => {
      const NEIGHBOUR_CZ = 1
      const LOCAL_X = 0; const LOCAL_Y = 62; const LOCAL_Z = 5
      const WORLD_Z = NEIGHBOUR_CZ * 16 + LOCAL_Z
      const cache = makeChunkCache((blocks, relDx, relDz) => {
        if (relDx === 0 && relDz === 1) {
          blocks[chunkBlockIndex(LOCAL_X, LOCAL_Y, LOCAL_Z)] = BLOCK_IDS.WATER
        }
      })
      expect(isInWater(LOCAL_X, LOCAL_Y, WORLD_Z, cache, PLAYER_CX, PLAYER_CZ)).toBe(true)
    })
  })
})

// ---------------------------------------------------------------------------
// OFFSETS_3x3
// ---------------------------------------------------------------------------

describe('OFFSETS_3x3', () => {
  const EXPECTED_OFFSETS_COUNT = 9

  it('contains exactly 9 entries covering the 3×3 neighbourhood', () => {
    expect(OFFSETS_3x3).toHaveLength(EXPECTED_OFFSETS_COUNT)
  })

  it('each entry is a 2-element tuple', () => {
    for (const offset of OFFSETS_3x3) {
      expect(offset).toHaveLength(2)
    }
  })

  it('contains the center offset [0, 0]', () => {
    const hasCenter = OFFSETS_3x3.some(([dx, dz]) => dx === 0 && dz === 0)
    expect(hasCenter).toBe(true)
  })

  it('contains all four cardinal neighbours', () => {
    const hasNorth = OFFSETS_3x3.some(([dx, dz]) => dx === -1 && dz === 0)
    const hasSouth = OFFSETS_3x3.some(([dx, dz]) => dx === 1 && dz === 0)
    const hasWest = OFFSETS_3x3.some(([dx, dz]) => dx === 0 && dz === -1)
    const hasEast = OFFSETS_3x3.some(([dx, dz]) => dx === 0 && dz === 1)
    expect(hasNorth).toBe(true)
    expect(hasSouth).toBe(true)
    expect(hasWest).toBe(true)
    expect(hasEast).toBe(true)
  })

  it('contains all four diagonal neighbours', () => {
    const hasDiagonals = [[-1, -1], [-1, 1], [1, -1], [1, 1]].every(
      ([edx, edz]) => OFFSETS_3x3.some(([dx, dz]) => dx === edx && dz === edz),
    )
    expect(hasDiagonals).toBe(true)
  })

  it('all offset values are -1, 0, or 1 (3×3 grid invariant)', () => {
    for (const [dx, dz] of OFFSETS_3x3) {
      expect([-1, 0, 1]).toContain(dx)
      expect([-1, 0, 1]).toContain(dz)
    }
  })

  it('has no duplicate entries', () => {
    const seen = new Set<string>()
    for (const [dx, dz] of OFFSETS_3x3) {
      const key = `${dx},${dz}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })
})
