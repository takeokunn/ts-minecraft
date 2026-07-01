import { describe, it, expect } from 'vitest'
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/core'
import {
  getLightAt,
  setLightAt,
  isTransparent,
  emissiveLightLevel,
  createLightBuffer,
  LIGHT_LEVEL_MAX,
  LIGHT_LEVEL_MIN,
  LIGHT_BYTE_LENGTH,
  NEIGHBOR_OFFSETS,
} from './light'

// ─── codec round-trip ─────────────────────────────────────────────────────────
describe('getLightAt / setLightAt — nibble codec', () => {
  it('reads back the same value that was written (even-indexed voxel)', () => {
    const grid = new Uint8Array(LIGHT_BYTE_LENGTH)
    setLightAt(grid, 0, 0, 0, 7)
    expect(getLightAt(grid, 0, 0, 0)).toBe(7)
  })

  it('reads back the same value for an odd-indexed voxel (high nibble)', () => {
    const grid = new Uint8Array(LIGHT_BYTE_LENGTH)
    setLightAt(grid, 1, 0, 0, 11)
    expect(getLightAt(grid, 1, 0, 0)).toBe(11)
  })

  it('writing two adjacent voxels in the same byte does not corrupt each other', () => {
    const grid = new Uint8Array(LIGHT_BYTE_LENGTH)
    setLightAt(grid, 0, 0, 0, 5)  // even voxel (low nibble)
    setLightAt(grid, 1, 0, 0, 9)  // odd voxel (high nibble)
    expect(getLightAt(grid, 0, 0, 0)).toBe(5)
    expect(getLightAt(grid, 1, 0, 0)).toBe(9)
  })

  it('clamps written values above 15 to 15', () => {
    const grid = new Uint8Array(LIGHT_BYTE_LENGTH)
    setLightAt(grid, 0, 0, 0, 20)
    expect(getLightAt(grid, 0, 0, 0)).toBe(15)
  })

  it('clamps written values below 0 to 0', () => {
    const grid = new Uint8Array(LIGHT_BYTE_LENGTH)
    setLightAt(grid, 0, 0, 0, -3)
    expect(getLightAt(grid, 0, 0, 0)).toBe(0)
  })

  it('round-trips LIGHT_LEVEL_MAX (15)', () => {
    const grid = new Uint8Array(LIGHT_BYTE_LENGTH)
    setLightAt(grid, 2, 64, 3, LIGHT_LEVEL_MAX)
    expect(getLightAt(grid, 2, 64, 3)).toBe(LIGHT_LEVEL_MAX)
  })

  it('round-trips LIGHT_LEVEL_MIN (0)', () => {
    const grid = new Uint8Array(LIGHT_BYTE_LENGTH)
    setLightAt(grid, 0, 0, 0, 7)
    setLightAt(grid, 0, 0, 0, LIGHT_LEVEL_MIN)
    expect(getLightAt(grid, 0, 0, 0)).toBe(LIGHT_LEVEL_MIN)
  })

  it('reads 0 from an uninitialised buffer', () => {
    const grid = new Uint8Array(LIGHT_BYTE_LENGTH)
    expect(getLightAt(grid, 5, 100, 7)).toBe(0)
  })

  it('stores and retrieves across several distinct voxel positions', () => {
    const grid = new Uint8Array(LIGHT_BYTE_LENGTH)
    const cases: [number, number, number, number][] = [
      [0, 0, 0, 15], [1, 0, 0, 14], [0, 1, 0, 13], [0, 0, 1, 12],
      [15, 255, 15, 1], [8, 128, 8, 8],
    ]
    for (const [lx, y, lz, val] of cases) setLightAt(grid, lx, y, lz, val)
    for (const [lx, y, lz, val] of cases) expect(getLightAt(grid, lx, y, lz)).toBe(val)
  })
})

// ─── createLightBuffer ────────────────────────────────────────────────────────
describe('createLightBuffer', () => {
  it('creates a Uint8Array of LIGHT_BYTE_LENGTH bytes initialised to zero', () => {
    const buf = createLightBuffer()
    expect(buf).toBeInstanceOf(Uint8Array)
    expect(buf.length).toBe(LIGHT_BYTE_LENGTH)
    expect(buf.every((b) => b === 0)).toBe(true)
  })

  it('LIGHT_BYTE_LENGTH holds one nibble per voxel in a CHUNK_SIZE×CHUNK_HEIGHT×CHUNK_SIZE grid', () => {
    const voxelCount = CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE
    expect(LIGHT_BYTE_LENGTH).toBe(voxelCount / 2)
  })
})

// ─── block-type light properties ──────────────────────────────────────────────
describe('isTransparent', () => {
  it('AIR is transparent', () => {
    expect(isTransparent('AIR')).toBe(true)
  })

  it('STONE is opaque', () => {
    expect(isTransparent('STONE')).toBe(false)
  })

  it('GLASS is transparent', () => {
    expect(isTransparent('GLASS')).toBe(true)
  })

  it('LEAVES is transparent', () => {
    expect(isTransparent('LEAVES')).toBe(true)
  })
})

describe('emissiveLightLevel', () => {
  it('AIR emits 0', () => {
    expect(emissiveLightLevel('AIR')).toBe(0)
  })

  it('STONE emits 0', () => {
    expect(emissiveLightLevel('STONE')).toBe(0)
  })

  it('TORCH emits 14 (vanilla-accurate override)', () => {
    expect(emissiveLightLevel('TORCH')).toBe(14)
  })

  it('LAVA emits 15', () => {
    expect(emissiveLightLevel('LAVA')).toBe(15)
  })

  it('REDSTONE_TORCH emits 7 (dim — does not flood a room)', () => {
    expect(emissiveLightLevel('REDSTONE_TORCH')).toBe(7)
  })

  it('NETHER_PORTAL emits 11', () => {
    expect(emissiveLightLevel('NETHER_PORTAL')).toBe(11)
  })
})

// ─── NEIGHBOR_OFFSETS ─────────────────────────────────────────────────────────
describe('NEIGHBOR_OFFSETS', () => {
  it('contains exactly 6 face-adjacent offsets (no diagonals)', () => {
    expect(NEIGHBOR_OFFSETS).toHaveLength(6)
  })

  it('each offset has exactly one non-zero component of magnitude 1', () => {
    for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
      const nonZero = [dx, dy, dz].filter((v) => v !== 0)
      expect(nonZero).toHaveLength(1)
      expect(Math.abs(nonZero[0]!)).toBe(1)
    }
  })

  it('covers all 6 face directions (+x, -x, +y, -y, +z, -z)', () => {
    const keys = new Set(NEIGHBOR_OFFSETS.map(([x, y, z]) => `${x},${y},${z}`))
    for (const expected of ['1,0,0', '-1,0,0', '0,1,0', '0,-1,0', '0,0,1', '0,0,-1']) {
      expect(keys.has(expected)).toBe(true)
    }
  })
})
