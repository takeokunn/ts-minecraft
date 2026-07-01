import { describe, expect, it } from 'vitest'
import { villagerLevelFromExperience } from '@ts-minecraft/entity/domain/village/village-villager-level'

// ─── villagerLevelFromExperience ──────────────────────────────────────────────
// Thresholds: level 2 at 6 XP, level 3 at 14 XP, level 4 at 28 XP.
// Tests cover below/at/above each boundary and the absolute extremes.

describe('villagerLevelFromExperience — level 1', () => {
  it('returns 1 at 0 experience', () => {
    expect(villagerLevelFromExperience(0)).toBe(1)
  })

  it('returns 1 just below the level-2 threshold (5 XP)', () => {
    expect(villagerLevelFromExperience(5)).toBe(1)
  })
})

describe('villagerLevelFromExperience — level 2', () => {
  it('returns 2 at exactly the level-2 threshold (6 XP)', () => {
    expect(villagerLevelFromExperience(6)).toBe(2)
  })

  it('returns 2 just below the level-3 threshold (13 XP)', () => {
    expect(villagerLevelFromExperience(13)).toBe(2)
  })
})

describe('villagerLevelFromExperience — level 3', () => {
  it('returns 3 at exactly the level-3 threshold (14 XP)', () => {
    expect(villagerLevelFromExperience(14)).toBe(3)
  })

  it('returns 3 just below the level-4 threshold (27 XP)', () => {
    expect(villagerLevelFromExperience(27)).toBe(3)
  })
})

describe('villagerLevelFromExperience — level 4', () => {
  it('returns 4 at exactly the level-4 threshold (28 XP)', () => {
    expect(villagerLevelFromExperience(28)).toBe(4)
  })

  it('returns 4 for large experience values', () => {
    expect(villagerLevelFromExperience(1000)).toBe(4)
  })
})
