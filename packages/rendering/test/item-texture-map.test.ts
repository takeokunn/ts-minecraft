import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { ITEM_TILE_MAP, getItemTileIndex, getItemTileUVs, ITEM_ATLAS_COLS, ITEM_ATLAS_SIZE, ITEM_HALF_TEXEL } from '@ts-minecraft/rendering'

describe('infrastructure/three/textures/item-texture-map', () => {
  describe('constants', () => {
    it('ITEM_ATLAS_COLS should be 16', () => {
      expect(ITEM_ATLAS_COLS).toBe(16)
    })

    it('ITEM_ATLAS_SIZE should be 512', () => {
      expect(ITEM_ATLAS_SIZE).toBe(512)
    })

    it('ITEM_HALF_TEXEL should be 0.5 / ITEM_ATLAS_SIZE', () => {
      expect(ITEM_HALF_TEXEL).toBeCloseTo(0.5 / ITEM_ATLAS_SIZE)
    })
  })

  describe('getItemTileIndex', () => {
    it('should return -1 for AIR to indicate no icon', () => {
      expect(getItemTileIndex('AIR')).toBe(-1)
      expect(ITEM_TILE_MAP.AIR).toBe(-1)
    })

    it('should map inventory-only items to dedicated tile range', () => {
      expect(getItemTileIndex('STICKS')).toBe(48)
      expect(getItemTileIndex('DIAMOND_PICKAXE')).toBe(62)
      expect(getItemTileIndex('GLOWSTONE_DUST')).toBe(113)
    })

    it('should keep block mappings stable', () => {
      expect(getItemTileIndex('DIRT')).toBe(0)
      expect(getItemTileIndex('STONE')).toBe(1)
      expect(getItemTileIndex('TORCH')).toBe(45)
      expect(getItemTileIndex('CHEST')).toBe(74)
      expect(getItemTileIndex('DOOR')).toBe(41)
      expect(getItemTileIndex('DOOR_OPEN')).toBe(41)
      expect(getItemTileIndex('GLOWSTONE')).toBe(113)
      expect(getItemTileIndex('LADDER')).toBe(41)
      expect(getItemTileIndex('COBWEB')).toBe(101)
      expect(getItemTileIndex('SAPLING')).toBe(102)
      expect(getItemTileIndex('DANDELION')).toBe(103)
      expect(getItemTileIndex('POPPY')).toBe(104)
      expect(getItemTileIndex('BROWN_MUSHROOM')).toBe(105)
      expect(getItemTileIndex('RED_MUSHROOM')).toBe(106)
      expect(getItemTileIndex('TALL_GRASS')).toBe(107)
      expect(getItemTileIndex('FERN')).toBe(108)
      expect(getItemTileIndex('SUGAR_CANE')).toBe(109)
      expect(getItemTileIndex('CACTUS')).toBe(110)
      expect(getItemTileIndex('LILY_PAD')).toBe(111)
      expect(getItemTileIndex('ICE')).toBe(112)
    })
  })

  describe('getItemTileUVs', () => {
    it('should return uv coordinates within [0,1]', () => {
      const { u0, v0, u1, v1 } = getItemTileUVs(48)
      expect(u0).toBeGreaterThanOrEqual(0)
      expect(u1).toBeLessThanOrEqual(1)
      expect(v0).toBeGreaterThanOrEqual(0)
      expect(v1).toBeLessThanOrEqual(1)
    })

    it('should produce increasing U and decreasing V edge pairs', () => {
      const { u0, v0, u1, v1 } = getItemTileUVs(58)
      expect(u1).toBeGreaterThan(u0)
      expect(v1).toBeGreaterThan(v0)
    })

    it('should include half-texel inset to reduce bleeding', () => {
      const { u0, u1 } = getItemTileUVs(0)
      expect(u0).toBeCloseTo(ITEM_HALF_TEXEL)
      expect(u1).toBeCloseTo(1 / ITEM_ATLAS_COLS - ITEM_HALF_TEXEL)
    })
  })
})
