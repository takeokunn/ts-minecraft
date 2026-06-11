import { describe, it, expect } from 'vitest'
import {
  ARMOR_DEFENSE_POINTS,
  ARMOR_SLOT_MAP,
  MAX_ARMOR_POINTS,
} from '../domain/armor.config'

describe('ARMOR_DEFENSE_POINTS', () => {
  it('leather set total is 7 defense points', () => {
    const total = (ARMOR_DEFENSE_POINTS['LEATHER_HELMET'] ?? 0)
      + (ARMOR_DEFENSE_POINTS['LEATHER_CHESTPLATE'] ?? 0)
      + (ARMOR_DEFENSE_POINTS['LEATHER_LEGGINGS'] ?? 0)
      + (ARMOR_DEFENSE_POINTS['LEATHER_BOOTS'] ?? 0)
    expect(total).toBe(7)
  })

  it('iron set total is 15 defense points', () => {
    const total = (ARMOR_DEFENSE_POINTS['IRON_HELMET'] ?? 0)
      + (ARMOR_DEFENSE_POINTS['IRON_CHESTPLATE'] ?? 0)
      + (ARMOR_DEFENSE_POINTS['IRON_LEGGINGS'] ?? 0)
      + (ARMOR_DEFENSE_POINTS['IRON_BOOTS'] ?? 0)
    expect(total).toBe(15)
  })

  it('diamond set total is 20 defense points (equals MAX_ARMOR_POINTS)', () => {
    const total = (ARMOR_DEFENSE_POINTS['DIAMOND_HELMET'] ?? 0)
      + (ARMOR_DEFENSE_POINTS['DIAMOND_CHESTPLATE'] ?? 0)
      + (ARMOR_DEFENSE_POINTS['DIAMOND_LEGGINGS'] ?? 0)
      + (ARMOR_DEFENSE_POINTS['DIAMOND_BOOTS'] ?? 0)
    expect(total).toBe(MAX_ARMOR_POINTS)
  })

  it('chestplate has highest defense points per slot', () => {
    const leatherSet = [
      ARMOR_DEFENSE_POINTS['LEATHER_HELMET']!,
      ARMOR_DEFENSE_POINTS['LEATHER_CHESTPLATE']!,
      ARMOR_DEFENSE_POINTS['LEATHER_LEGGINGS']!,
      ARMOR_DEFENSE_POINTS['LEATHER_BOOTS']!,
    ]
    expect(Math.max(...leatherSet)).toBe(ARMOR_DEFENSE_POINTS['LEATHER_CHESTPLATE'])
  })
})

describe('ARMOR_SLOT_MAP', () => {
  it('every item in ARMOR_DEFENSE_POINTS also appears in ARMOR_SLOT_MAP', () => {
    for (const item of Object.keys(ARMOR_DEFENSE_POINTS)) {
      expect(ARMOR_SLOT_MAP[item as keyof typeof ARMOR_SLOT_MAP]).toBeDefined()
    }
  })

  it('every item in ARMOR_SLOT_MAP also has defense points', () => {
    for (const item of Object.keys(ARMOR_SLOT_MAP)) {
      expect(ARMOR_DEFENSE_POINTS[item as keyof typeof ARMOR_DEFENSE_POINTS]).toBeDefined()
    }
  })

  it('helmet items map to HELMET slot', () => {
    expect(ARMOR_SLOT_MAP['LEATHER_HELMET']).toBe('HELMET')
    expect(ARMOR_SLOT_MAP['IRON_HELMET']).toBe('HELMET')
    expect(ARMOR_SLOT_MAP['DIAMOND_HELMET']).toBe('HELMET')
  })

  it('chestplate items map to CHESTPLATE slot', () => {
    expect(ARMOR_SLOT_MAP['LEATHER_CHESTPLATE']).toBe('CHESTPLATE')
    expect(ARMOR_SLOT_MAP['IRON_CHESTPLATE']).toBe('CHESTPLATE')
    expect(ARMOR_SLOT_MAP['DIAMOND_CHESTPLATE']).toBe('CHESTPLATE')
  })

  it('covers exactly 12 armor pieces (3 tiers × 4 slots)', () => {
    expect(Object.keys(ARMOR_SLOT_MAP)).toHaveLength(12)
    expect(Object.keys(ARMOR_DEFENSE_POINTS)).toHaveLength(12)
  })
})

describe('MAX_ARMOR_POINTS', () => {
  it('is 20', () => {
    expect(MAX_ARMOR_POINTS).toBe(20)
  })

  it('no single piece exceeds MAX_ARMOR_POINTS', () => {
    for (const points of Object.values(ARMOR_DEFENSE_POINTS)) {
      expect(points!).toBeLessThanOrEqual(MAX_ARMOR_POINTS)
    }
  })
})
