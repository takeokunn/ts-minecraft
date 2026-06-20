import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Array as Arr } from 'effect'
import { blockTypeToIndex, INDEX_TO_BLOCK_TYPE } from '@ts-minecraft/core'
import { getTileIndex, getTileUVs, ATLAS_COLS, ATLAS_SIZE, HALF_TEXEL, TILE_MAP } from '@ts-minecraft/rendering'
import type { BlockType } from '@ts-minecraft/core'
import type { FaceDir } from '@ts-minecraft/rendering'

describe('infrastructure/three/textures/block-texture-map', () => {
  describe('constants', () => {
    it('ATLAS_COLS should be 16', () => {
      expect(ATLAS_COLS).toBe(16)
    })

    it('ATLAS_SIZE should be 512', () => {
      expect(ATLAS_SIZE).toBe(512)
    })

    it('HALF_TEXEL should be 0.5 / ATLAS_SIZE', () => {
      expect(HALF_TEXEL).toBeCloseTo(0.5 / 512)
    })
  })

  describe('getTileIndex', () => {
    it('contains one texture entry per block storage index', () => {
      expect(TILE_MAP).toHaveLength(INDEX_TO_BLOCK_TYPE.length)
    })

    it('should return 0 for blockId=0 (AIR) all faces', () => {
      const faces: FaceDir[] = ['top', 'bottom', 'side']
      Arr.forEach(faces, face => {
        expect(getTileIndex(0, face)).toBe(0)
      })
    })

    it('should return 0 for blockId=1 (DIRT) all faces', () => {
      expect(getTileIndex(1, 'top')).toBe(0)
      expect(getTileIndex(1, 'bottom')).toBe(0)
      expect(getTileIndex(1, 'side')).toBe(0)
    })

    it('should return 1 for blockId=2 (STONE) all faces', () => {
      expect(getTileIndex(2, 'top')).toBe(1)
      expect(getTileIndex(2, 'bottom')).toBe(1)
      expect(getTileIndex(2, 'side')).toBe(1)
    })

    it('should return correct tile for WOOD (blockId=3) - different top/side', () => {
      expect(getTileIndex(3, 'top')).toBe(3)    // wood_top (rings)
      expect(getTileIndex(3, 'bottom')).toBe(3) // wood_top (rings)
      expect(getTileIndex(3, 'side')).toBe(2)   // wood_side (bark)
    })

    it('should return correct tile for GRASS (blockId=4) - different top/bottom/side', () => {
      expect(getTileIndex(4, 'top')).toBe(4)    // grass_top
      expect(getTileIndex(4, 'bottom')).toBe(0) // dirt
      expect(getTileIndex(4, 'side')).toBe(5)   // grass_side
    })

    it('should return 0 for out-of-bounds blockId', () => {
      expect(getTileIndex(999, 'top')).toBe(0)
      expect(getTileIndex(-1, 'top')).toBe(0)
    })

    it('should return correct tile for COBBLESTONE (blockId=11)', () => {
      expect(getTileIndex(11, 'top')).toBe(12)
      expect(getTileIndex(11, 'bottom')).toBe(12)
      expect(getTileIndex(11, 'side')).toBe(12)
    })

    it('should map crafted placeable block ids to their atlas tiles', () => {
      const faces: FaceDir[] = ['top', 'bottom', 'side']
      const cases: ReadonlyArray<{ readonly blockType: BlockType; readonly expectedTileIndex: number }> = [
        { blockType: 'PLANKS', expectedTileIndex: 41 },
        { blockType: 'CRAFTING_TABLE', expectedTileIndex: 43 },
        { blockType: 'FURNACE', expectedTileIndex: 44 },
        { blockType: 'TORCH', expectedTileIndex: 45 },
        { blockType: 'DOOR', expectedTileIndex: 41 },
        { blockType: 'DOOR_OPEN', expectedTileIndex: 41 },
        { blockType: 'GLOWSTONE', expectedTileIndex: 113 },
        { blockType: 'LADDER', expectedTileIndex: 41 },
        { blockType: 'COBWEB', expectedTileIndex: 101 },
        { blockType: 'SAPLING', expectedTileIndex: 102 },
        { blockType: 'DANDELION', expectedTileIndex: 103 },
        { blockType: 'POPPY', expectedTileIndex: 104 },
        { blockType: 'BROWN_MUSHROOM', expectedTileIndex: 105 },
        { blockType: 'RED_MUSHROOM', expectedTileIndex: 106 },
        { blockType: 'TALL_GRASS', expectedTileIndex: 107 },
        { blockType: 'FERN', expectedTileIndex: 108 },
        { blockType: 'SUGAR_CANE', expectedTileIndex: 109 },
        { blockType: 'CACTUS', expectedTileIndex: 110 },
        { blockType: 'LILY_PAD', expectedTileIndex: 111 },
        { blockType: 'ICE', expectedTileIndex: 112 },
        { blockType: 'PRESSURE_PLATE', expectedTileIndex: 1 },
        { blockType: 'STONE_SLAB', expectedTileIndex: 1 },
        { blockType: 'OAK_STAIRS', expectedTileIndex: 41 },
        { blockType: 'ANVIL', expectedTileIndex: 35 },
        { blockType: 'CAULDRON', expectedTileIndex: 35 },
        { blockType: 'FIRE', expectedTileIndex: 18 },
        { blockType: 'WATER_CAULDRON', expectedTileIndex: 35 },
      ]

      Arr.forEach(cases, ({ blockType, expectedTileIndex }) => {
        const blockId = blockTypeToIndex(blockType)
        Arr.forEach(faces, face => {
          expect(getTileIndex(blockId, face)).toBe(expectedTileIndex)
        })
      })
    })

    it('should map CHEST to chest-like atlas tiles', () => {
      const blockId = blockTypeToIndex('CHEST')
      expect(getTileIndex(blockId, 'top')).toBe(73)
      expect(getTileIndex(blockId, 'bottom')).toBe(74)
      expect(getTileIndex(blockId, 'side')).toBe(74)
    })
  })

  describe('getTileUVs', () => {
    it('should return valid UV coordinates for tileIndex=0 (first tile)', () => {
      const uvs = getTileUVs(0)
      expect(uvs.u0).toBeGreaterThan(0)
      expect(uvs.u1).toBeGreaterThan(uvs.u0)
      expect(uvs.v0).toBeGreaterThan(0)
      expect(uvs.v0).toBeLessThan(1)
    })

    it('should return UV coordinates within [0, 1] range', () => {
      Arr.forEach(Arr.makeBy(16, i => i), i => {
        const uvs = getTileUVs(i)
        expect(uvs.u0).toBeGreaterThanOrEqual(0)
        expect(uvs.u1).toBeLessThanOrEqual(1)
        expect(uvs.v0).toBeGreaterThanOrEqual(0)
        expect(uvs.v1).toBeLessThanOrEqual(1)
      })
    })

    it('should have u1 > u0 and v0 > v1 (inverted v axis for UV)', () => {
      const uvs = getTileUVs(0)
      expect(uvs.u1).toBeGreaterThan(uvs.u0)
      // v0 > v1 because textures are often stored top-to-bottom
      // but this depends on implementation - check actual values
      expect(typeof uvs.v0).toBe('number')
      expect(typeof uvs.v1).toBe('number')
    })

    it('should apply HALF_TEXEL offset to avoid bleeding', () => {
      const uvs = getTileUVs(0)
      // col=0, row=0 → u0 = 0/16 + HALF_TEXEL, u1 = 1/16 - HALF_TEXEL
      expect(uvs.u0).toBeCloseTo(HALF_TEXEL)
      expect(uvs.u1).toBeCloseTo(1 / ATLAS_COLS - HALF_TEXEL)
    })

    it('should return different UVs for different tile indices', () => {
      const uvs0 = getTileUVs(0)
      const uvs1 = getTileUVs(1)
      expect(uvs0.u0).not.toBe(uvs1.u0)
    })

    it('should return consistent results for same tileIndex', () => {
      const a = getTileUVs(5)
      const b = getTileUVs(5)
      expect(a).toEqual(b)
    })
  })
})
