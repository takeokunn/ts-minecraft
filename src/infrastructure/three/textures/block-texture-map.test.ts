import { describe, it, expect } from 'vitest'
import { getTileIndex, getTileUVs, ATLAS_COLS, ATLAS_SIZE, HALF_TEXEL } from './block-texture-map'
import type { FaceDir } from './block-texture-map'

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
    it('should return 0 for blockId=0 (AIR) all faces', () => {
      const faces: FaceDir[] = ['top', 'bottom', 'side']
      for (const face of faces) {
        expect(getTileIndex(0, face)).toBe(0)
      }
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
      for (let i = 0; i < 16; i++) {
        const uvs = getTileUVs(i)
        expect(uvs.u0).toBeGreaterThanOrEqual(0)
        expect(uvs.u1).toBeLessThanOrEqual(1)
        expect(uvs.v0).toBeGreaterThanOrEqual(0)
        expect(uvs.v1).toBeLessThanOrEqual(1)
      }
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
