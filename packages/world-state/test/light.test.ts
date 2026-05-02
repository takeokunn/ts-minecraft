import { describe, it, expect } from 'vitest'
import { CHUNK_SIZE, CHUNK_HEIGHT, blockTypeToIndex, blockIndexUnsafe } from '@ts-minecraft/kernel'
import {
  LIGHT_LEVEL_MAX,
  LIGHT_BYTE_LENGTH,
  isTransparent,
  emissiveLightLevel,
  isTransparentIndex,
  emissiveLevelByIndex,
  createLightBuffer,
  getLightAt,
  setLightAt,
  computeBlockLight,
  computeSkyLight,
} from '../domain/light'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create an all-AIR blocks array (block index 0 = AIR everywhere). */
const makeAirBlocks = (): Uint8Array =>
  new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)

/** Place a block type at a local (x, y, z) position in a blocks array. */
const placeBlock = (blocks: Uint8Array, x: number, y: number, z: number, type: string): void => {
  blocks[blockIndexUnsafe(x, y, z)] = blockTypeToIndex(type as Parameters<typeof blockTypeToIndex>[0])
}

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

  it('out-of-bounds index 200 returns false (hits ?? 0 fallback)', () => {
    expect(isTransparentIndex(200)).toBe(false)
  })

  it('out-of-bounds index 64 returns false (exactly at table size boundary)', () => {
    expect(isTransparentIndex(64)).toBe(false)
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

  it('out-of-bounds index 200 returns 0 (hits ?? 0 fallback)', () => {
    expect(emissiveLevelByIndex(200)).toBe(0)
  })

  it('out-of-bounds index 64 returns 0 (exactly at table size boundary)', () => {
    expect(emissiveLevelByIndex(64)).toBe(0)
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

describe('computeBlockLight', () => {
  it('all-AIR chunk with no emissive blocks: all light stays 0', () => {
    const blocks = makeAirBlocks()
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    // Spot-check several positions
    expect(getLightAt(lightGrid, 0, 0, 0)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
    expect(getLightAt(lightGrid, 15, 255, 15)).toBe(0)
  })

  it('LAVA at (8,100,8) emits level 15 at its own position', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 8, 100, 8, 'LAVA')
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 8, 100, 8)).toBe(15)
  })

  it('LAVA light propagates: 1 step away gets level 14', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 8, 100, 8, 'LAVA')
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 9, 100, 8)).toBe(14)
    expect(getLightAt(lightGrid, 7, 100, 8)).toBe(14)
    expect(getLightAt(lightGrid, 8, 101, 8)).toBe(14)
    expect(getLightAt(lightGrid, 8, 99, 8)).toBe(14)
    expect(getLightAt(lightGrid, 8, 100, 9)).toBe(14)
    expect(getLightAt(lightGrid, 8, 100, 7)).toBe(14)
  })

  it('LAVA light attenuates with distance: level decreases by 1 per step', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 8, 100, 8, 'LAVA')
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 8, 100, 8)).toBe(15)
    expect(getLightAt(lightGrid, 9, 100, 8)).toBe(14)
    expect(getLightAt(lightGrid, 10, 100, 8)).toBe(13)
    expect(getLightAt(lightGrid, 11, 100, 8)).toBe(12)
    expect(getLightAt(lightGrid, 12, 100, 8)).toBe(11)
  })

  it('light does not enter an opaque block (STONE receives 0)', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 8, 100, 8, 'LAVA')
    placeBlock(blocks, 9, 100, 8, 'STONE')
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    // The STONE voxel itself is opaque — BFS skips transparent==0 neighbours,
    // so the stone's own cell is never written and stays 0.
    expect(getLightAt(lightGrid, 9, 100, 8)).toBe(0)
  })

  it('light propagates around a single STONE block to reach the far side', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 8, 100, 8, 'LAVA')
    placeBlock(blocks, 9, 100, 8, 'STONE')
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    // BFS routes around the stone via adjacent transparent neighbours, so (10,100,8)
    // receives light (level >= 1) even though a stone block is directly in between.
    expect(getLightAt(lightGrid, 10, 100, 8)).toBeGreaterThan(0)
  })

  it('STONE wall spanning the full x-range blocks all light to the other side', () => {
    const blocks = makeAirBlocks()
    // LAVA at x=2 side
    placeBlock(blocks, 2, 100, 8, 'LAVA')
    // Full stone wall at x=8 across all z and y — completely seals the chunk column
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        placeBlock(blocks, 8, y, z, 'STONE')
      }
    }
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    // The stone wall itself is opaque
    expect(getLightAt(lightGrid, 8, 100, 8)).toBe(0)
    // Positions on the far side of the wall cannot be reached by BFS
    expect(getLightAt(lightGrid, 9, 100, 8)).toBe(0)
    expect(getLightAt(lightGrid, 14, 100, 8)).toBe(0)
  })

  it('REDSTONE_ORE emits level 9 at its own position', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 4, 64, 4, 'REDSTONE_ORE')
    const lightGrid = createLightBuffer()
    computeBlockLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 4, 64, 4)).toBe(9)
  })

  it('computeBlockLight zeroes the grid before computing (stale buffer is reset)', () => {
    const blocks = makeAirBlocks()
    const lightGrid = createLightBuffer()
    // Pre-fill the grid with garbage
    lightGrid.fill(0xff)
    computeBlockLight(blocks, lightGrid)
    // All-AIR chunk → all light = 0
    expect(getLightAt(lightGrid, 0, 0, 0)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computeSkyLight
// ---------------------------------------------------------------------------

describe('computeSkyLight', () => {
  it('all-AIR chunk: every voxel in every column receives level 15', () => {
    const blocks = makeAirBlocks()
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    // Top of column
    expect(getLightAt(lightGrid, 0, CHUNK_HEIGHT - 1, 0)).toBe(LIGHT_LEVEL_MAX)
    // Middle of column
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(LIGHT_LEVEL_MAX)
    // Bottom of column
    expect(getLightAt(lightGrid, 0, 0, 0)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 15, 0, 15)).toBe(LIGHT_LEVEL_MAX)
  })

  it('single STONE at y=128 in column (8,z=8): above is lit, stone itself is 0', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 8, 128, 8, 'STONE')
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    // Blocks above the stone in the same column are still directly seeded from the top
    expect(getLightAt(lightGrid, 8, 255, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 8, 129, 8)).toBe(LIGHT_LEVEL_MAX)
    // The stone voxel is opaque and is never written by sky seeding or BFS propagation
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
    // (8,127,8) receives lateral light from adjacent fully-lit columns via BFS,
    // so it is > 0 but at most LIGHT_LEVEL_MAX - 1 = 14
    expect(getLightAt(lightGrid, 8, 127, 8)).toBeGreaterThan(0)
    expect(getLightAt(lightGrid, 8, 127, 8)).toBeLessThanOrEqual(LIGHT_LEVEL_MAX - 1)
  })

  it('full stone column spanning all y in (8,z=8): below-stone cells receive 0 sky light', () => {
    const blocks = makeAirBlocks()
    // Fill the entire column with STONE — no lateral leakage possible since
    // adjacent columns are fully lit but the BFS cannot enter the stone column.
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      placeBlock(blocks, 8, y, 8, 'STONE')
    }
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    // Every voxel in the stone column stays 0
    expect(getLightAt(lightGrid, 8, 255, 8)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
    expect(getLightAt(lightGrid, 8, 0, 8)).toBe(0)
    // Adjacent transparent columns are unaffected
    expect(getLightAt(lightGrid, 9, 255, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 9, 0, 8)).toBe(LIGHT_LEVEL_MAX)
  })

  it('adjacent column is unaffected by a stone block in a different column', () => {
    const blocks = makeAirBlocks()
    placeBlock(blocks, 8, 128, 8, 'STONE')
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    // Column (9, *, 8) has no stone — should be fully lit throughout
    expect(getLightAt(lightGrid, 9, 255, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 9, 128, 8)).toBe(LIGHT_LEVEL_MAX)
    expect(getLightAt(lightGrid, 9, 0, 8)).toBe(LIGHT_LEVEL_MAX)
  })

  it('all-STONE chunk: all sky light stays 0', () => {
    const blocks = makeAirBlocks()
    blocks.fill(blockTypeToIndex('STONE'))
    const lightGrid = createLightBuffer()
    computeSkyLight(blocks, lightGrid)
    expect(getLightAt(lightGrid, 0, 255, 0)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
    expect(getLightAt(lightGrid, 15, 0, 15)).toBe(0)
  })

  it('computeSkyLight zeroes the grid before computing (stale buffer is reset)', () => {
    const blocks = makeAirBlocks()
    blocks.fill(blockTypeToIndex('STONE'))
    const lightGrid = createLightBuffer()
    // Pre-fill the grid with garbage
    lightGrid.fill(0xff)
    computeSkyLight(blocks, lightGrid)
    // All-STONE chunk → all sky light = 0
    expect(getLightAt(lightGrid, 0, 0, 0)).toBe(0)
    expect(getLightAt(lightGrid, 8, 128, 8)).toBe(0)
  })
})
