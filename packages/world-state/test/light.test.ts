import { blockTypeToIndex } from '@ts-minecraft/kernel'
import { describe,expect,it } from 'vitest'
import {
LIGHT_BYTE_LENGTH,
createLightBuffer,
emissiveLevelByIndex,
emissiveLightLevel,
getLightAt,
isTransparent,
isTransparentIndex,
setLightAt
} from '../domain/light'

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
