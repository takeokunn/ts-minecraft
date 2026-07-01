import { describe, expect, it } from 'vitest'
import { CROP_DROP_RULES } from './interaction-break-handler.crop-drops.config'

describe('CROP_DROP_RULES', () => {
  it('contains WHEAT_CROP and POTATO_CROP entries', () => {
    expect(CROP_DROP_RULES.has('WHEAT_CROP')).toBe(true)
    expect(CROP_DROP_RULES.has('POTATO_CROP')).toBe(true)
  })

  describe('WHEAT_CROP', () => {
    const rule = CROP_DROP_RULES.get('WHEAT_CROP')!

    it('drops one wheat seed when unripe', () => {
      expect(rule.unripeDrops).toEqual([['WHEAT_SEEDS', 1]])
    })

    it('drops wheat and 1-4 wheat seeds when ripe (randomValue=0)', () => {
      const drops = rule.ripeDrops(0)
      expect(drops).toEqual([['WHEAT', 1], ['WHEAT_SEEDS', 1]])
    })

    it('drops wheat and up to 4 wheat seeds when ripe (randomValue=0.99)', () => {
      const drops = rule.ripeDrops(0.99)
      expect(drops).toEqual([['WHEAT', 1], ['WHEAT_SEEDS', 4]])
    })

    it('ripeDrops is a pure function of randomValue', () => {
      expect(rule.ripeDrops(0.5)).toEqual(rule.ripeDrops(0.5))
    })
  })

  describe('POTATO_CROP', () => {
    const rule = CROP_DROP_RULES.get('POTATO_CROP')!

    it('drops one potato when unripe', () => {
      expect(rule.unripeDrops).toEqual([['POTATO', 1]])
    })

    it('drops 2 potatoes when ripe (randomValue=0)', () => {
      const drops = rule.ripeDrops(0)
      expect(drops).toEqual([['POTATO', 2]])
    })

    it('drops up to 5 potatoes when ripe (randomValue=0.99)', () => {
      const drops = rule.ripeDrops(0.99)
      expect(drops).toEqual([['POTATO', 5]])
    })
  })
})
