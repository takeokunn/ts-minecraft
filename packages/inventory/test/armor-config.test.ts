import { describe, it, expect } from 'vitest'
import {
  ARMOR_ITEMS,
  ARMOR_DEFENSE_POINTS,
  ARMOR_SLOT_MAP,
  MAX_ARMOR_POINTS,
  type ArmorItem,
} from '../domain/armor.config'

const totalDefense = (items: ReadonlyArray<ArmorItem>): number =>
  items.reduce((total, item) => total + ARMOR_DEFENSE_POINTS[item], 0)

describe('ARMOR_DEFENSE_POINTS', () => {
  it('leather set total is 7 defense points', () => {
    const total = totalDefense(['LEATHER_HELMET', 'LEATHER_CHESTPLATE', 'LEATHER_LEGGINGS', 'LEATHER_BOOTS'])
    expect(total).toBe(7)
  })

  it('iron set total is 15 defense points', () => {
    const total = totalDefense(['IRON_HELMET', 'IRON_CHESTPLATE', 'IRON_LEGGINGS', 'IRON_BOOTS'])
    expect(total).toBe(15)
  })

  it('gold set total is 11 defense points', () => {
    const total = totalDefense(['GOLD_HELMET', 'GOLD_CHESTPLATE', 'GOLD_LEGGINGS', 'GOLD_BOOTS'])
    expect(total).toBe(11)
  })

  it('diamond set total is 20 defense points (equals MAX_ARMOR_POINTS)', () => {
    const total = totalDefense(['DIAMOND_HELMET', 'DIAMOND_CHESTPLATE', 'DIAMOND_LEGGINGS', 'DIAMOND_BOOTS'])
    expect(total).toBe(MAX_ARMOR_POINTS)
  })

  it('chestplate has highest defense points per slot', () => {
    const leatherSet = [
      ARMOR_DEFENSE_POINTS['LEATHER_HELMET'],
      ARMOR_DEFENSE_POINTS['LEATHER_CHESTPLATE'],
      ARMOR_DEFENSE_POINTS['LEATHER_LEGGINGS'],
      ARMOR_DEFENSE_POINTS['LEATHER_BOOTS'],
    ]
    expect(Math.max(...leatherSet)).toBe(ARMOR_DEFENSE_POINTS['LEATHER_CHESTPLATE'])
  })
})

describe('ARMOR_SLOT_MAP', () => {
  it('every item in ARMOR_DEFENSE_POINTS also appears in ARMOR_SLOT_MAP', () => {
    for (const item of ARMOR_ITEMS) {
      expect(ARMOR_SLOT_MAP[item]).toBeDefined()
    }
  })

  it('every item in ARMOR_SLOT_MAP also has defense points', () => {
    for (const item of ARMOR_ITEMS) {
      expect(ARMOR_DEFENSE_POINTS[item]).toBeDefined()
    }
  })

  it('helmet items map to HELMET slot', () => {
    expect(ARMOR_SLOT_MAP['LEATHER_HELMET']).toBe('HELMET')
    expect(ARMOR_SLOT_MAP['IRON_HELMET']).toBe('HELMET')
    expect(ARMOR_SLOT_MAP['GOLD_HELMET']).toBe('HELMET')
    expect(ARMOR_SLOT_MAP['DIAMOND_HELMET']).toBe('HELMET')
  })

  it('chestplate items map to CHESTPLATE slot', () => {
    expect(ARMOR_SLOT_MAP['LEATHER_CHESTPLATE']).toBe('CHESTPLATE')
    expect(ARMOR_SLOT_MAP['IRON_CHESTPLATE']).toBe('CHESTPLATE')
    expect(ARMOR_SLOT_MAP['GOLD_CHESTPLATE']).toBe('CHESTPLATE')
    expect(ARMOR_SLOT_MAP['DIAMOND_CHESTPLATE']).toBe('CHESTPLATE')
  })

  it('covers exactly 16 armor pieces (4 tiers × 4 slots)', () => {
    expect(ARMOR_ITEMS).toHaveLength(16)
    expect(Object.keys(ARMOR_SLOT_MAP)).toHaveLength(16)
    expect(Object.keys(ARMOR_DEFENSE_POINTS)).toHaveLength(16)
  })
})

describe('MAX_ARMOR_POINTS', () => {
  it('is 20', () => {
    expect(MAX_ARMOR_POINTS).toBe(20)
  })

  it('no single piece exceeds MAX_ARMOR_POINTS', () => {
    for (const points of Object.values(ARMOR_DEFENSE_POINTS)) {
      expect(points).toBeLessThanOrEqual(MAX_ARMOR_POINTS)
    }
  })
})
