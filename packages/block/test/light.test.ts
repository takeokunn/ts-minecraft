import {
  BLOCK_COUNT,
  blockIndexUnsafe,
  blockTypeToIndex,
} from '@ts-minecraft/core'
import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import {
  LIGHT_BYTE_LENGTH,
  LIGHT_LEVEL_MAX,
  LIGHT_LEVEL_MIN,
  NEIGHBOR_OFFSETS,
  computeBlockLight,
  computeSkyLight,
  createLightBuffer,
  emissiveLevelByIndex,
  emissiveLightLevel,
  getLightAt,
  isTransparent,
  isTransparentIndex,
  setLightAt,
} from '../domain/light'
import { makeChunkBlocks, setChunkBlock } from './chunk-block-test-utils'

// ---------------------------------------------------------------------------
// isTransparent / emissiveLightLevel
// ---------------------------------------------------------------------------

describe('isTransparent', () => {
  it('AIR is transparent', () => {
    expect(isTransparent('AIR')).toBe(true)
  })

  it('STONE is not transparent', () => {
    expect(isTransparent('STONE')).toBe(false)
  })
})

describe('emissiveLightLevel', () => {
  it('LAVA has emissive level 15', () => {
    expect(emissiveLightLevel('LAVA')).toBe(15)
  })

  it('AIR has emissive level 0', () => {
    expect(emissiveLightLevel('AIR')).toBe(0)
  })

  it('STONE has emissive level 0', () => {
    expect(emissiveLightLevel('STONE')).toBe(0)
  })

  it('TORCH has emissive level 14, not the default 15 (vanilla correctness)', () => {
    expect(emissiveLightLevel('TORCH')).toBe(14)
  })

  it('GLOWSTONE has emissive level 15', () => {
    expect(emissiveLightLevel('GLOWSTONE')).toBe(15)
  })

  // R67: dimmer light sources — each has a distinct vanilla level below 15.
  it('REDSTONE_TORCH has emissive level 7 (vanilla), not the default 15', () => {
    expect(emissiveLightLevel('REDSTONE_TORCH')).toBe(7)
  })

  it('NETHER_PORTAL has emissive level 11 (vanilla), not the default 15', () => {
    expect(emissiveLightLevel('NETHER_PORTAL')).toBe(11)
  })

  it('END_PORTAL_FRAME has emissive level 1 (vanilla), not the default 15', () => {
    expect(emissiveLightLevel('END_PORTAL_FRAME')).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// isTransparentIndex / emissiveLevelByIndex
// ---------------------------------------------------------------------------

describe('isTransparentIndex', () => {
  it('index 0 (AIR) returns true, matching isTransparent("AIR")', () => {
    expect(isTransparentIndex(0)).toBe(isTransparent('AIR'))
    expect(isTransparentIndex(0)).toBe(true)
  })

  it('index 2 (STONE) returns false, matching isTransparent("STONE")', () => {
    expect(isTransparentIndex(2)).toBe(isTransparent('STONE'))
    expect(isTransparentIndex(2)).toBe(false)
  })

  it('out-of-bounds index 200 returns false', () => {
    expect(isTransparentIndex(200)).toBe(false)
  })

  it('out-of-bounds index BLOCK_COUNT returns false (exactly at table size boundary)', () => {
    expect(isTransparentIndex(BLOCK_COUNT)).toBe(false)
  })

  it('negative and fractional indexes return false', () => {
    expect(isTransparentIndex(-1)).toBe(false)
    expect(isTransparentIndex(1.5)).toBe(false)
  })
})

describe('emissiveLevelByIndex', () => {
  it('index 0 (AIR) returns 0', () => {
    expect(emissiveLevelByIndex(0)).toBe(0)
  })

  it('index 17 (LAVA) returns 15', () => {
    // LAVA is the 18th entry (index 17) in the block codec array
    const lavaIdx = blockTypeToIndex('LAVA')
    expect(emissiveLevelByIndex(lavaIdx)).toBe(15)
  })

  it('GLOWSTONE index returns 15', () => {
    expect(emissiveLevelByIndex(blockTypeToIndex('GLOWSTONE'))).toBe(15)
  })

  it('out-of-bounds index 200 returns 0', () => {
    expect(emissiveLevelByIndex(200)).toBe(0)
  })

  it('out-of-bounds index BLOCK_COUNT returns 0 (exactly at table size boundary)', () => {
    expect(emissiveLevelByIndex(BLOCK_COUNT)).toBe(0)
  })

  it('negative and fractional indexes return 0', () => {
    expect(emissiveLevelByIndex(-1)).toBe(0)
    expect(emissiveLevelByIndex(1.5)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// createLightBuffer
// ---------------------------------------------------------------------------

describe('createLightBuffer', () => {
  it('returns a Uint8Array of length LIGHT_BYTE_LENGTH (32768)', () => {
    const buf = createLightBuffer()
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(buf.byteLength).toBe(LIGHT_BYTE_LENGTH)
    expect(LIGHT_BYTE_LENGTH).toBe(32768)
  })

  it('all bytes are zero initially', () => {
    const buf = createLightBuffer()
    const allZero = buf.every(b => b === 0)
    expect(allZero).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// getLightAt / setLightAt
// ---------------------------------------------------------------------------

describe('getLightAt on a fresh buffer', () => {
  it('returns 0 at origin', () => {
    const grid = createLightBuffer()
    expect(getLightAt(grid, 0, 0, 0)).toBe(0)
  })

  it('returns 0 at arbitrary coordinates', () => {
    const grid = createLightBuffer()
    expect(getLightAt(grid, 7, 128, 7)).toBe(0)
    expect(getLightAt(grid, 15, 255, 15)).toBe(0)
  })
})

describe('setLightAt / getLightAt roundtrip', () => {
  it('set level 7 at (0,0,0) then get returns 7', () => {
    const grid = createLightBuffer()
    setLightAt(grid, 0, 0, 0, 7)
    expect(getLightAt(grid, 0, 0, 0)).toBe(7)
  })

  it('set level 5 at (1,0,0) then get returns 5', () => {
    const grid = createLightBuffer()
    setLightAt(grid, 1, 0, 0, 5)
    expect(getLightAt(grid, 1, 0, 0)).toBe(5)
  })

  it('set level 15 at (0,1,0) then get returns 15', () => {
    const grid = createLightBuffer()
    setLightAt(grid, 0, 1, 0, 15)
    expect(getLightAt(grid, 0, 1, 0)).toBe(15)
  })

  it('set level 1 at (0,0,1) then get returns 1', () => {
    const grid = createLightBuffer()
    setLightAt(grid, 0, 0, 1, 1)
    expect(getLightAt(grid, 0, 0, 1)).toBe(1)
  })

  it('setting one voxel does not affect an adjacent voxel (nibble isolation)', () => {
    const grid = createLightBuffer()
    // voxelIndex(0,0,0) = 0 (even → low nibble), voxelIndex(0,1,0) = 1 (odd → high nibble)
    // Both share byte 0 of the grid.
    setLightAt(grid, 0, 0, 0, 12)
    setLightAt(grid, 0, 1, 0, 3)
    expect(getLightAt(grid, 0, 0, 0)).toBe(12)
    expect(getLightAt(grid, 0, 1, 0)).toBe(3)
  })

  it('two coordinates sharing the same byte remain independent', () => {
    const grid = createLightBuffer()
    // byte 0 holds voxel indices 0 (low nibble) and 1 (high nibble)
    // voxelIndex(x, y, z) = y + z*256 + x*256*16; (0,0,0)=0, (0,1,0)=1
    setLightAt(grid, 0, 0, 0, 9)
    expect(getLightAt(grid, 0, 1, 0)).toBe(0) // high nibble still zero

    setLightAt(grid, 0, 1, 0, 6)
    expect(getLightAt(grid, 0, 0, 0)).toBe(9) // low nibble unchanged
    expect(getLightAt(grid, 0, 1, 0)).toBe(6)
  })
})

describe('setLightAt clamping', () => {
  it('value -1 is clamped to 0', () => {
    const grid = createLightBuffer()
    setLightAt(grid, 0, 0, 0, -1)
    expect(getLightAt(grid, 0, 0, 0)).toBe(0)
  })

  it('value 16 is clamped to 15', () => {
    const grid = createLightBuffer()
    setLightAt(grid, 0, 0, 0, 16)
    expect(getLightAt(grid, 0, 0, 0)).toBe(15)
  })

  it('value 100 is clamped to 15', () => {
    const grid = createLightBuffer()
    setLightAt(grid, 0, 0, 0, 100)
    expect(getLightAt(grid, 0, 0, 0)).toBe(15)
  })

  it('value 0 is stored as 0 (not clamped away)', () => {
    const grid = createLightBuffer()
    setLightAt(grid, 0, 0, 0, 7)
    setLightAt(grid, 0, 0, 0, 0)
    expect(getLightAt(grid, 0, 0, 0)).toBe(0)
  })

  it('value 15 is the maximum and stored correctly', () => {
    const grid = createLightBuffer()
    setLightAt(grid, 5, 100, 5, 15)
    expect(getLightAt(grid, 5, 100, 5)).toBe(15)
  })
})

// ---------------------------------------------------------------------------
// computeBlockLight
// ---------------------------------------------------------------------------

describe('light constants', () => {
  it('exports the 4-bit light range and six cardinal neighbor offsets', () => {
    expect(LIGHT_LEVEL_MIN).toBe(0)
    expect(LIGHT_LEVEL_MAX).toBe(15)
    expect(NEIGHBOR_OFFSETS).toEqual([
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1],
    ])
  })
})

describe('computeBlockLight', () => {
  it('clears stale light when the chunk has no emitters', () => {
    const blocks = createChunkBlocks()
    const grid = createLightBuffer()
    setLightAt(grid, 8, 64, 8, LIGHT_LEVEL_MAX)

    computeBlockLight(blocks, grid)

    expect(getLightAt(grid, 8, 64, 8)).toBe(0)
  })

  it('seeds emissive blocks and propagates through transparent neighbors', () => {
    const blocks = createChunkBlocks()
    const grid = createLightBuffer()
    setChunkBlock(blocks, 8, 64, 8, 'TORCH')

    computeBlockLight(blocks, grid)

    expect(getLightAt(grid, 8, 64, 8)).toBe(14)
    expect(getLightAt(grid, 7, 64, 8)).toBe(13)
    expect(getLightAt(grid, 8, 65, 8)).toBe(13)
    expect(getLightAt(grid, 8, 64, 7)).toBe(13)
  })

  it('does not write propagated light into opaque blocks', () => {
    const blocks = createChunkBlocks()
    const grid = createLightBuffer()
    setChunkBlock(blocks, 8, 64, 8, 'TORCH')
    setChunkBlock(blocks, 9, 64, 8, 'STONE')

    computeBlockLight(blocks, grid)

    expect(getLightAt(grid, 8, 64, 8)).toBe(14)
    expect(getLightAt(grid, 9, 64, 8)).toBe(0)
    expect(getLightAt(grid, 8, 64, 9)).toBe(13)
  })

  it('stops propagation at chunk boundaries while lighting inward neighbors', () => {
    const blocks = createChunkBlocks()
    const grid = createLightBuffer()
    setChunkBlock(blocks, 15, 0, 15, 'TORCH')

    computeBlockLight(blocks, grid)

    expect(getLightAt(grid, 15, 0, 15)).toBe(14)
    expect(getLightAt(grid, 14, 0, 15)).toBe(13)
    expect(getLightAt(grid, 15, 1, 15)).toBe(13)
    expect(getLightAt(grid, 15, 0, 14)).toBe(13)
  })
})

// ---------------------------------------------------------------------------
// computeSkyLight
// ---------------------------------------------------------------------------

describe('computeSkyLight', () => {
  it('fills an all-air chunk with full sky light', () => {
    const blocks = createChunkBlocks()
    const grid = createLightBuffer()

    computeSkyLight(blocks, grid)

    expect(getLightAt(grid, 0, 0, 0)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(grid, 8, 128, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(grid, 15, 255, 15)).toBe(LIGHT_LEVEL_MAX)
  })

  it('leaves an all-opaque chunk dark', () => {
    const blocks = createChunkBlocks('STONE')
    const grid = createLightBuffer()
    setLightAt(grid, 8, 64, 8, LIGHT_LEVEL_MAX)

    computeSkyLight(blocks, grid)

    expect(getLightAt(grid, 8, 64, 8)).toBe(0)
    expect(getLightAt(grid, 8, 255, 8)).toBe(0)
  })

  it('does not treat transparent non-air blocks as the highest opaque surface', () => {
    const blocks = createChunkBlocks()
    const grid = createLightBuffer()
    setChunkBlock(blocks, 8, 200, 8, 'WATER')

    computeSkyLight(blocks, grid)

    expect(getLightAt(grid, 8, 200, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(grid, 8, 0, 8)).toBe(LIGHT_LEVEL_MAX)
  })

  it('treats an unknown block index as opaque when finding the sky surface', () => {
    const blocks = createChunkBlocks()
    const grid = createLightBuffer()
    blocks[blockIndexUnsafe(8, 200, 8)] = BLOCK_COUNT

    computeSkyLight(blocks, grid)

    expect(getLightAt(grid, 8, 201, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(grid, 8, 200, 8)).toBe(0)
  })

  it('seeds open columns below the highest opaque y and keeps opaque cells dark', () => {
    const blocks = createChunkBlocks()
    const grid = createLightBuffer()
    setChunkBlock(blocks, 8, 200, 8, 'STONE')

    computeSkyLight(blocks, grid)

    expect(getLightAt(grid, 8, 201, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(grid, 8, 200, 8)).toBe(0)
    expect(getLightAt(grid, 7, 200, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(grid, 8, 199, 8)).toBe(14)
  })
})
