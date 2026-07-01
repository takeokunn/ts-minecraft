import { describe, expect, it } from 'vitest'
import {
  CRYSTAL_HEAL_RANGE,
  DRAGON_HEAL_RATE,
  MAX_DRAGON_HEALTH,
  computeCrystalHealing,
} from '@ts-minecraft/entity/domain/mob/ender-dragon/dragon-healing'

const dragon = { x: 0, y: 80, z: 0 }

// ─── computeCrystalHealing ────────────────────────────────────────────────────
describe('computeCrystalHealing', () => {
  it('returns unchanged health and 0 crystals used when no crystals present', () => {
    const result = computeCrystalHealing([], dragon, 100)
    expect(result.newHealth).toBe(100)
    expect(result.crystalsUsed).toBe(0)
  })

  it('does not heal when crystal is beyond CRYSTAL_HEAL_RANGE', () => {
    const farCrystal = { x: CRYSTAL_HEAL_RANGE + 1, y: 80, z: 0 }
    const result = computeCrystalHealing([farCrystal], dragon, 100)
    expect(result.crystalsUsed).toBe(0)
    expect(result.newHealth).toBe(100)
  })

  it('heals from a crystal exactly at the range boundary', () => {
    const borderCrystal = { x: CRYSTAL_HEAL_RANGE, y: 80, z: 0 }
    const result = computeCrystalHealing([borderCrystal], dragon, 100)
    expect(result.crystalsUsed).toBe(1)
    expect(result.newHealth).toBe(100 + DRAGON_HEAL_RATE)
  })

  it('heals from multiple crystals in range', () => {
    const nearby = [
      { x: 5, y: 80, z: 0 },
      { x: -5, y: 80, z: 0 },
      { x: 0, y: 80, z: 5 },
    ]
    const result = computeCrystalHealing(nearby, dragon, 100)
    expect(result.crystalsUsed).toBe(3)
    expect(result.newHealth).toBe(100 + 3 * DRAGON_HEAL_RATE)
  })

  it('caps newHealth at MAX_DRAGON_HEALTH', () => {
    const crystal = { x: 1, y: 80, z: 0 }
    const result = computeCrystalHealing([crystal], dragon, MAX_DRAGON_HEALTH)
    expect(result.newHealth).toBe(MAX_DRAGON_HEALTH)
    expect(result.crystalsUsed).toBe(1)
  })

  it('ignores crystals outside range even when some are inside', () => {
    const mixed = [
      { x: 5, y: 80, z: 0 },                  // inside
      { x: CRYSTAL_HEAL_RANGE + 5, y: 80, z: 0 }, // outside
    ]
    const result = computeCrystalHealing(mixed, dragon, 50)
    expect(result.crystalsUsed).toBe(1)
  })
})
