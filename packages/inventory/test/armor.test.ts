import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Option } from 'effect'
import {
  isArmorItem,
  getArmorDefensePoints,
  getArmorSlot,
  computeTotalArmorPoints,
} from '../domain/armor'
import {
  MAX_ARMOR_POINTS,
  ARMOR_ITEMS,
  ARMOR_DEFENSE_POINTS,
  ARMOR_SLOT_MAP,
} from '../domain/armor.config'

describe('domain/armor', () => {
  describe('isArmorItem', () => {
    it('returns true for all leather armor pieces', () => {
      expect(isArmorItem('LEATHER_HELMET')).toBe(true)
      expect(isArmorItem('LEATHER_CHESTPLATE')).toBe(true)
      expect(isArmorItem('LEATHER_LEGGINGS')).toBe(true)
      expect(isArmorItem('LEATHER_BOOTS')).toBe(true)
    })

    it('returns true for all iron armor pieces', () => {
      expect(isArmorItem('IRON_HELMET')).toBe(true)
      expect(isArmorItem('IRON_CHESTPLATE')).toBe(true)
      expect(isArmorItem('IRON_LEGGINGS')).toBe(true)
      expect(isArmorItem('IRON_BOOTS')).toBe(true)
    })

    it('returns true for all gold armor pieces', () => {
      expect(isArmorItem('GOLD_HELMET')).toBe(true)
      expect(isArmorItem('GOLD_CHESTPLATE')).toBe(true)
      expect(isArmorItem('GOLD_LEGGINGS')).toBe(true)
      expect(isArmorItem('GOLD_BOOTS')).toBe(true)
    })

    it('returns true for all diamond armor pieces', () => {
      expect(isArmorItem('DIAMOND_HELMET')).toBe(true)
      expect(isArmorItem('DIAMOND_CHESTPLATE')).toBe(true)
      expect(isArmorItem('DIAMOND_LEGGINGS')).toBe(true)
      expect(isArmorItem('DIAMOND_BOOTS')).toBe(true)
    })

    it('returns false for non-armor items', () => {
      expect(isArmorItem('DIRT')).toBe(false)
      expect(isArmorItem('IRON_SWORD')).toBe(false)
      expect(isArmorItem('DIAMOND_PICKAXE')).toBe(false)
      expect(isArmorItem('APPLE')).toBe(false)
    })
  })

  describe('getArmorDefensePoints', () => {
    it('returns correct defense for leather tier (total 7)', () => {
      expect(Option.getOrThrow(getArmorDefensePoints('LEATHER_HELMET'))).toBe(1)
      expect(Option.getOrThrow(getArmorDefensePoints('LEATHER_CHESTPLATE'))).toBe(3)
      expect(Option.getOrThrow(getArmorDefensePoints('LEATHER_LEGGINGS'))).toBe(2)
      expect(Option.getOrThrow(getArmorDefensePoints('LEATHER_BOOTS'))).toBe(1)
    })

    it('returns correct defense for iron tier (total 15)', () => {
      expect(Option.getOrThrow(getArmorDefensePoints('IRON_HELMET'))).toBe(2)
      expect(Option.getOrThrow(getArmorDefensePoints('IRON_CHESTPLATE'))).toBe(6)
      expect(Option.getOrThrow(getArmorDefensePoints('IRON_LEGGINGS'))).toBe(5)
      expect(Option.getOrThrow(getArmorDefensePoints('IRON_BOOTS'))).toBe(2)
    })

    it('returns correct defense for gold tier (total 11)', () => {
      expect(Option.getOrThrow(getArmorDefensePoints('GOLD_HELMET'))).toBe(2)
      expect(Option.getOrThrow(getArmorDefensePoints('GOLD_CHESTPLATE'))).toBe(5)
      expect(Option.getOrThrow(getArmorDefensePoints('GOLD_LEGGINGS'))).toBe(3)
      expect(Option.getOrThrow(getArmorDefensePoints('GOLD_BOOTS'))).toBe(1)
    })

    it('returns correct defense for diamond tier (total 20)', () => {
      expect(Option.getOrThrow(getArmorDefensePoints('DIAMOND_HELMET'))).toBe(3)
      expect(Option.getOrThrow(getArmorDefensePoints('DIAMOND_CHESTPLATE'))).toBe(8)
      expect(Option.getOrThrow(getArmorDefensePoints('DIAMOND_LEGGINGS'))).toBe(6)
      expect(Option.getOrThrow(getArmorDefensePoints('DIAMOND_BOOTS'))).toBe(3)
    })

    it('returns none for non-armor items', () => {
      expect(Option.isNone(getArmorDefensePoints('DIRT'))).toBe(true)
      expect(Option.isNone(getArmorDefensePoints('IRON_SWORD'))).toBe(true)
    })
  })

  describe('getArmorSlot', () => {
    it('assigns helmets to HELMET slot', () => {
      expect(Option.getOrThrow(getArmorSlot('LEATHER_HELMET'))).toBe('HELMET')
      expect(Option.getOrThrow(getArmorSlot('IRON_HELMET'))).toBe('HELMET')
      expect(Option.getOrThrow(getArmorSlot('GOLD_HELMET'))).toBe('HELMET')
      expect(Option.getOrThrow(getArmorSlot('DIAMOND_HELMET'))).toBe('HELMET')
    })

    it('assigns chestplates to CHESTPLATE slot', () => {
      expect(Option.getOrThrow(getArmorSlot('LEATHER_CHESTPLATE'))).toBe('CHESTPLATE')
      expect(Option.getOrThrow(getArmorSlot('IRON_CHESTPLATE'))).toBe('CHESTPLATE')
      expect(Option.getOrThrow(getArmorSlot('GOLD_CHESTPLATE'))).toBe('CHESTPLATE')
      expect(Option.getOrThrow(getArmorSlot('DIAMOND_CHESTPLATE'))).toBe('CHESTPLATE')
    })

    it('assigns leggings to LEGGINGS slot', () => {
      expect(Option.getOrThrow(getArmorSlot('LEATHER_LEGGINGS'))).toBe('LEGGINGS')
    })

    it('assigns boots to BOOTS slot', () => {
      expect(Option.getOrThrow(getArmorSlot('LEATHER_BOOTS'))).toBe('BOOTS')
    })

    it('returns none for non-armor items', () => {
      expect(Option.isNone(getArmorSlot('DIRT'))).toBe(true)
      expect(Option.isNone(getArmorSlot('IRON_SWORD'))).toBe(true)
    })
  })

  describe('computeTotalArmorPoints', () => {
    it('returns 0 for empty equipment', () => {
      expect(computeTotalArmorPoints([])).toBe(0)
    })

    it('sums defense points for partial armor', () => {
      expect(computeTotalArmorPoints(['IRON_HELMET', 'IRON_CHESTPLATE'])).toBe(8)
    })

    it('computes full leather armor total (7)', () => {
      const fullLeather = ['LEATHER_HELMET', 'LEATHER_CHESTPLATE', 'LEATHER_LEGGINGS', 'LEATHER_BOOTS'] as const
      expect(computeTotalArmorPoints([...fullLeather])).toBe(7)
    })

    it('computes full iron armor total (15)', () => {
      const fullIron = ['IRON_HELMET', 'IRON_CHESTPLATE', 'IRON_LEGGINGS', 'IRON_BOOTS'] as const
      expect(computeTotalArmorPoints([...fullIron])).toBe(15)
    })

    it('computes full gold armor total (11)', () => {
      const fullGold = ['GOLD_HELMET', 'GOLD_CHESTPLATE', 'GOLD_LEGGINGS', 'GOLD_BOOTS'] as const
      expect(computeTotalArmorPoints([...fullGold])).toBe(11)
    })

    it('computes full diamond armor total (20)', () => {
      const fullDiamond = ['DIAMOND_HELMET', 'DIAMOND_CHESTPLATE', 'DIAMOND_LEGGINGS', 'DIAMOND_BOOTS'] as const
      expect(computeTotalArmorPoints([...fullDiamond])).toBe(20)
    })

    it('caps at MAX_ARMOR_POINTS (20) even with duplicates', () => {
      const overpowered = ['DIAMOND_CHESTPLATE', 'DIAMOND_CHESTPLATE', 'DIAMOND_CHESTPLATE'] as const
      expect(computeTotalArmorPoints([...overpowered])).toBe(MAX_ARMOR_POINTS)
    })

    it('ignores non-armor items', () => {
      expect(computeTotalArmorPoints(['DIRT', 'IRON_SWORD'] as const)).toBe(0)
    })
  })

  describe('armor consistency', () => {
    it('every armor item in ARMOR_DEFENSE_POINTS also has a slot in ARMOR_SLOT_MAP', () => {
      for (const item of ARMOR_ITEMS) {
        expect(ARMOR_SLOT_MAP[item]).toBeDefined()
      }
    })

    it('every armor item in ARMOR_SLOT_MAP also has defense points in ARMOR_DEFENSE_POINTS', () => {
      for (const item of ARMOR_ITEMS) {
        expect(ARMOR_DEFENSE_POINTS[item]).toBeDefined()
      }
    })
  })
})
