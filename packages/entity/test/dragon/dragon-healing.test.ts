import { describe, expect, it } from 'vitest'
import {
  CRYSTAL_HEAL_RANGE,
  DRAGON_HEAL_RATE,
  MAX_DRAGON_HEALTH,
  computeCrystalHealing,
} from '../../domain/mob/ender-dragon/dragon-healing'

describe('dragon crystal healing', () => {
  it('heals one HP per nearby crystal per tick', () => {
    const result = computeCrystalHealing([
      { x: 16, y: 64, z: 0 },
      { x: 0, y: 80, z: 0 },
      { x: 17, y: 64, z: 0 },
    ], { x: 0, y: 64, z: 0 }, 100)
    expect(result.crystalsUsed).toBe(2)
    expect(result.newHealth).toBe(100 + 2 * DRAGON_HEAL_RATE)
  })

  it('exposes vanilla-inspired healing constants', () => {
    expect(DRAGON_HEAL_RATE).toBe(1)
    expect(CRYSTAL_HEAL_RANGE).toBe(16)
    expect(MAX_DRAGON_HEALTH).toBe(200)
  })

  it('does not exceed max dragon health', () => {
    const result = computeCrystalHealing([{ x: 0, y: 64, z: 0 }], { x: 0, y: 64, z: 0 }, 200)
    expect(result.newHealth).toBe(MAX_DRAGON_HEALTH)
  })
})
