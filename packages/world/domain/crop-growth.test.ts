import { describe, expect, it } from 'vitest'
import { advanceCropAge, CROP_MAX_AGE, isRipeCrop, CROP_GROWTH_INTERVAL_SECS } from './crop-growth'

describe('crop-growth domain', () => {
  it('CROP_MAX_AGE is 2', () => {
    expect(CROP_MAX_AGE).toBe(2)
  })

  it('CROP_GROWTH_INTERVAL_SECS is positive', () => {
    expect(CROP_GROWTH_INTERVAL_SECS).toBeGreaterThan(0)
  })

  describe('isRipeCrop', () => {
    it('age 0 is not ripe', () => {
      expect(isRipeCrop(0)).toBe(false)
    })

    it('age 1 is not ripe', () => {
      expect(isRipeCrop(1)).toBe(false)
    })

    it('age 2 (CROP_MAX_AGE) is ripe', () => {
      expect(isRipeCrop(2)).toBe(true)
    })

    it('age greater than max is also ripe', () => {
      expect(isRipeCrop(5)).toBe(true)
    })
  })

  describe('advanceCropAge', () => {
    it('advances age 0 → 1', () => {
      expect(advanceCropAge(0)).toBe(1)
    })

    it('advances age 1 → 2', () => {
      expect(advanceCropAge(1)).toBe(2)
    })

    it('clamps at CROP_MAX_AGE (age 2 stays 2)', () => {
      expect(advanceCropAge(2)).toBe(CROP_MAX_AGE)
    })

    it('clamps when already past max', () => {
      expect(advanceCropAge(10)).toBe(CROP_MAX_AGE)
    })
  })
})
