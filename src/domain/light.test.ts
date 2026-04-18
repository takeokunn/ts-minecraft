import { describe, expect, it } from 'vitest'
import { Array as Arr } from 'effect'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndexUnsafe, blockTypeToIndex } from './chunk'
import {
  computeBlockLight,
  computeSkyLight,
  createLightBuffer,
  emissiveLightLevel,
  getLightAt,
  isTransparent,
  LIGHT_BYTE_LENGTH,
  LIGHT_LEVEL_MAX,
  setLightAt,
} from './light'

const AIR = blockTypeToIndex('AIR')
const STONE = blockTypeToIndex('STONE')
const LAVA = blockTypeToIndex('LAVA')
const REDSTONE_ORE = blockTypeToIndex('REDSTONE_ORE')

const fillChunk = (idx: number): Uint8Array => {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
  blocks.fill(idx)
  return blocks
}

const setBlock = (blocks: Uint8Array, x: number, y: number, z: number, idx: number): void => {
  blocks[blockIndexUnsafe(x, y, z)] = idx
}

describe('domain/light', () => {
  describe('getLightAt / setLightAt round-trip', () => {
    it('round-trips all 16 values at low-nibble voxel (0,0,0)', () => {
      const grid = createLightBuffer()
      Arr.forEach(Arr.makeBy(16, (i) => i), (v) => {
        setLightAt(grid, 0, 0, 0, v)
        expect(getLightAt(grid, 0, 0, 0)).toBe(v)
      })
    })

    it('round-trips all 16 values at high-nibble voxel (0,1,0)', () => {
      const grid = createLightBuffer()
      Arr.forEach(Arr.makeBy(16, (i) => i), (v) => {
        setLightAt(grid, 0, 1, 0, v)
        expect(getLightAt(grid, 0, 1, 0)).toBe(v)
      })
    })

    it('setting one voxel does not affect its nibble-pair neighbor', () => {
      const grid = createLightBuffer()
      setLightAt(grid, 0, 0, 0, 7)
      setLightAt(grid, 0, 1, 0, 12)
      expect(getLightAt(grid, 0, 0, 0)).toBe(7)
      expect(getLightAt(grid, 0, 1, 0)).toBe(12)
    })

    it('round-trips values at arbitrary coordinates', () => {
      const grid = createLightBuffer()
      const cases = [
        { x: 5, y: 100, z: 11, v: 3 },
        { x: 15, y: 255, z: 0, v: 15 },
        { x: 0, y: 0, z: 15, v: 0 },
        { x: 8, y: 64, z: 4, v: 11 },
      ] as const
      Arr.forEach(cases, ({ x, y, z, v }) => {
        setLightAt(grid, x, y, z, v)
      })
      Arr.forEach(cases, ({ x, y, z, v }) => {
        expect(getLightAt(grid, x, y, z)).toBe(v)
      })
    })

    it('createLightBuffer yields zero-filled buffer of correct size', () => {
      const grid = createLightBuffer()
      expect(grid.byteLength).toBe(LIGHT_BYTE_LENGTH)
      expect(grid.every((b) => b === 0)).toBe(true)
    })

    it('setLightAt clamps out-of-range values to [0, 15]', () => {
      const grid = createLightBuffer()
      setLightAt(grid, 2, 3, 4, 99)
      expect(getLightAt(grid, 2, 3, 4)).toBe(15)
      setLightAt(grid, 2, 3, 4, -5)
      expect(getLightAt(grid, 2, 3, 4)).toBe(0)
    })
  })

  describe('transparency / emissive lookups', () => {
    it('AIR, WATER, GLASS, LEAVES are transparent; STONE, DIRT are not', () => {
      expect(isTransparent('AIR')).toBe(true)
      expect(isTransparent('WATER')).toBe(true)
      expect(isTransparent('GLASS')).toBe(true)
      expect(isTransparent('LEAVES')).toBe(true)
      expect(isTransparent('STONE')).toBe(false)
      expect(isTransparent('DIRT')).toBe(false)
    })

    it('emissive levels match spec', () => {
      expect(emissiveLightLevel('LAVA')).toBe(15)
      expect(emissiveLightLevel('REDSTONE_BLOCK')).toBe(15)
      expect(emissiveLightLevel('REDSTONE_ORE')).toBe(9)
      expect(emissiveLightLevel('DEEPSLATE_REDSTONE_ORE')).toBe(9)
      expect(emissiveLightLevel('AIR')).toBe(0)
      expect(emissiveLightLevel('STONE')).toBe(0)
    })
  })

  describe('computeSkyLight', () => {
    it('all-AIR chunk: sky light is 15 everywhere', () => {
      const blocks = fillChunk(AIR)
      const grid = createLightBuffer()
      computeSkyLight(blocks, grid)
      // Spot-check: bottom corner, middle, top
      expect(getLightAt(grid, 0, 0, 0)).toBe(LIGHT_LEVEL_MAX)
      expect(getLightAt(grid, 7, 128, 7)).toBe(LIGHT_LEVEL_MAX)
      expect(getLightAt(grid, 15, 255, 15)).toBe(LIGHT_LEVEL_MAX)
    })

    it('all-STONE chunk: sky light is 0 everywhere (no propagation)', () => {
      const blocks = fillChunk(STONE)
      const grid = createLightBuffer()
      computeSkyLight(blocks, grid)
      expect(getLightAt(grid, 0, 0, 0)).toBe(0)
      expect(getLightAt(grid, 7, 128, 7)).toBe(0)
      expect(getLightAt(grid, 15, 255, 15)).toBe(0)
    })

    it('single STONE column blocks sky light below it; neighbor columns receive it', () => {
      const blocks = fillChunk(AIR)
      // Solid column at (8, y<=100, 8)
      Arr.forEach(Arr.makeBy(101, (i) => i), (y) => {
        setBlock(blocks, 8, y, 8, STONE)
      })
      const grid = createLightBuffer()
      computeSkyLight(blocks, grid)
      // Directly under the column top, at the same (x,z), light should be 0
      // The column at y=100 is STONE; below it (y=99,98,…) should be unlit initially.
      // But lateral BFS from neighboring columns may bleed some light in, so we check y=0 where
      // lateral propagation has attenuated to a low value but the neighbor at (9, 99, 8) is 15.
      expect(getLightAt(grid, 9, 99, 8)).toBe(LIGHT_LEVEL_MAX)
      // At (8, 99, 8) — directly blocked — light must be <15 (BFS attenuation from sides)
      expect(getLightAt(grid, 8, 99, 8)).toBeLessThan(LIGHT_LEVEL_MAX)
      // Far below blocked column, fully dark (no lateral path reaches here without attenuation to 0)
      expect(getLightAt(grid, 8, 0, 8)).toBe(0)
    })
  })

  describe('computeBlockLight', () => {
    it('all-STONE chunk with no emitters: block light is 0 everywhere', () => {
      const blocks = fillChunk(STONE)
      const grid = createLightBuffer()
      computeBlockLight(blocks, grid)
      expect(getLightAt(grid, 0, 0, 0)).toBe(0)
      expect(getLightAt(grid, 7, 100, 7)).toBe(0)
    })

    it('single LAVA block in AIR chunk emits 15 at source and attenuates by 1 per step', () => {
      const blocks = fillChunk(AIR)
      setBlock(blocks, 8, 100, 8, LAVA)
      const grid = createLightBuffer()
      computeBlockLight(blocks, grid)
      expect(getLightAt(grid, 8, 100, 8)).toBe(15)
      // 1 step away in each cardinal direction
      expect(getLightAt(grid, 9, 100, 8)).toBe(14)
      expect(getLightAt(grid, 8, 101, 8)).toBe(14)
      expect(getLightAt(grid, 7, 100, 8)).toBe(14)
      // 3 steps via Manhattan path: 12
      expect(getLightAt(grid, 8, 103, 8)).toBe(12)
    })

    it('REDSTONE_ORE emits level 9', () => {
      const blocks = fillChunk(AIR)
      setBlock(blocks, 8, 100, 8, REDSTONE_ORE)
      const grid = createLightBuffer()
      computeBlockLight(blocks, grid)
      expect(getLightAt(grid, 8, 100, 8)).toBe(9)
      // REDSTONE_ORE is emissive but not transparent — light at the source is 9,
      // but neighbors only receive propagation from transparent sources via BFS.
      // Since REDSTONE_ORE blocks propagation (not transparent), neighbors see 8 only if
      // BFS still enqueues the source. Current implementation enqueues any emissive voxel
      // regardless of its own transparency, so neighbors receive 8.
      expect(getLightAt(grid, 9, 100, 8)).toBe(8)
    })

    it('two LAVA emitters compose via max: the closer one wins per voxel', () => {
      const blocks = fillChunk(AIR)
      setBlock(blocks, 2, 100, 8, LAVA)
      setBlock(blocks, 14, 100, 8, LAVA)
      const grid = createLightBuffer()
      computeBlockLight(blocks, grid)
      // Voxel (3,100,8): 1 step from first LAVA, 11 from second → 14 wins.
      expect(getLightAt(grid, 3, 100, 8)).toBe(14)
      // Voxel (13,100,8): 1 step from second → 14.
      expect(getLightAt(grid, 13, 100, 8)).toBe(14)
      // Midpoint (8,100,8): 6 steps from each → 9 (15-6) from either → max = 9.
      expect(getLightAt(grid, 8, 100, 8)).toBe(9)
    })

    it('LAVA surrounded by STONE does not leak into opaque cells', () => {
      const blocks = fillChunk(STONE)
      setBlock(blocks, 8, 100, 8, LAVA)
      // Hollow air cell next to lava so there's a transparent neighbor
      setBlock(blocks, 9, 100, 8, AIR)
      setBlock(blocks, 10, 100, 8, AIR)
      const grid = createLightBuffer()
      computeBlockLight(blocks, grid)
      expect(getLightAt(grid, 8, 100, 8)).toBe(15)
      expect(getLightAt(grid, 9, 100, 8)).toBe(14)
      expect(getLightAt(grid, 10, 100, 8)).toBe(13)
      // Opaque stone neighbor stays 0
      expect(getLightAt(grid, 8, 100, 9)).toBe(0)
      expect(getLightAt(grid, 7, 100, 8)).toBe(0)
    })
  })
})
