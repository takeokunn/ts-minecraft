import { describe, expect, it } from 'vitest'
import { villagerLevelFromExperience } from '@ts-minecraft/entity/domain/village/village-villager-level'

// ─── villagerLevelFromExperience ──────────────────────────────────────────────
describe('villagerLevelFromExperience', () => {
  it('returns 1 at 0 experience (novice)', () => {
    expect(villagerLevelFromExperience(0)).toBe(1)
  })

  it('returns 1 just below the level-2 threshold', () => {
    expect(villagerLevelFromExperience(5)).toBe(1)
  })

  it('returns 2 at exactly the level-2 threshold', () => {
    expect(villagerLevelFromExperience(6)).toBe(2)
  })

  it('returns 2 between level-2 and level-3 thresholds', () => {
    expect(villagerLevelFromExperience(10)).toBe(2)
  })

  it('returns 3 at exactly the level-3 threshold', () => {
    expect(villagerLevelFromExperience(14)).toBe(3)
  })

  it('returns 3 between level-3 and level-4 thresholds', () => {
    expect(villagerLevelFromExperience(20)).toBe(3)
  })

  it('returns 4 at exactly the level-4 threshold', () => {
    expect(villagerLevelFromExperience(28)).toBe(4)
  })

  it('returns 4 for very high experience values', () => {
    expect(villagerLevelFromExperience(1000)).toBe(4)
  })
})
