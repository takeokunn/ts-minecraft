import { describe, it, expect } from 'vitest'
import { xpToNextLevel, levelFromXP, xpAtLevelStart, buildPlayerXP, addXPToPlayer } from '../domain/player-xp-calc'

describe('xpToNextLevel', () => {
  it('level 0 costs 7 XP', () => {
    expect(xpToNextLevel(0)).toBe(7)
  })
  it('level 15 costs 37 XP (boundary of first tier)', () => {
    expect(xpToNextLevel(15)).toBe(37)
  })
  it('level 16 costs 42 XP (start of second tier)', () => {
    expect(xpToNextLevel(16)).toBe(42)
  })
  it('level 30 costs 112 XP (boundary of second tier)', () => {
    expect(xpToNextLevel(30)).toBe(112)
  })
  it('level 31 costs 121 XP (start of third tier)', () => {
    expect(xpToNextLevel(31)).toBe(121)
  })
  it('uses linear formulas: tier 1 = 2*level+7', () => {
    for (let l = 0; l <= 15; l++) {
      expect(xpToNextLevel(l)).toBe(2 * l + 7)
    }
  })
  it('uses linear formulas: tier 2 = 5*level-38', () => {
    for (let l = 16; l <= 30; l++) {
      expect(xpToNextLevel(l)).toBe(5 * l - 38)
    }
  })
  it('uses linear formulas: tier 3 = 9*level-158', () => {
    expect(xpToNextLevel(31)).toBe(9 * 31 - 158)
    expect(xpToNextLevel(50)).toBe(9 * 50 - 158)
  })
})

describe('levelFromXP', () => {
  it('0 XP = level 0', () => {
    expect(levelFromXP(0)).toBe(0)
  })
  it('6 XP stays at level 0 (needs 7 to advance)', () => {
    expect(levelFromXP(6)).toBe(0)
  })
  it('exactly 7 XP = level 1', () => {
    expect(levelFromXP(7)).toBe(1)
  })
  it('level is monotonically non-decreasing', () => {
    let prev = 0
    for (let xp = 0; xp <= 500; xp++) {
      const cur = levelFromXP(xp)
      expect(cur).toBeGreaterThanOrEqual(prev)
      prev = cur
    }
  })
})

describe('xpAtLevelStart', () => {
  it('level 0 starts at 0 XP', () => {
    expect(xpAtLevelStart(0)).toBe(0)
  })
  it('level 1 starts at 7 XP (cost of level 0)', () => {
    expect(xpAtLevelStart(1)).toBe(7)
  })
  it('level 2 starts at cost(0)+cost(1) = 7+9 = 16', () => {
    expect(xpAtLevelStart(2)).toBe(16)
  })
  it('is consistent with levelFromXP: levelFromXP(xpAtLevelStart(n)) == n', () => {
    for (let n = 0; n <= 20; n++) {
      expect(levelFromXP(xpAtLevelStart(n))).toBe(n)
    }
  })
})

describe('buildPlayerXP', () => {
  it('builds correct XP state at 0 XP', () => {
    const state = buildPlayerXP(0)
    expect(state.totalXP).toBe(0)
    expect(state.level).toBe(0)
    expect(state.xpIntoLevel).toBe(0)
    expect(state.xpRequiredForNext).toBe(7)
  })

  it('builds correct XP state at exactly one level worth of XP', () => {
    const state = buildPlayerXP(7)
    expect(state.totalXP).toBe(7)
    expect(state.level).toBe(1)
    expect(state.xpIntoLevel).toBe(0)
    expect(state.xpRequiredForNext).toBe(xpToNextLevel(1))
  })

  it('xpIntoLevel + xpAtLevelStart(level) = totalXP', () => {
    for (const xp of [0, 5, 10, 50, 100, 500]) {
      const state = buildPlayerXP(xp)
      expect(state.xpIntoLevel + xpAtLevelStart(state.level)).toBe(xp)
    }
  })

  it('xpRequiredForNext equals xpToNextLevel(level)', () => {
    for (const xp of [0, 7, 50, 200]) {
      const state = buildPlayerXP(xp)
      expect(state.xpRequiredForNext).toBe(xpToNextLevel(state.level))
    }
  })
})

describe('addXPToPlayer', () => {
  it('increases totalXP by the given amount', () => {
    const initial = buildPlayerXP(0)
    const after = addXPToPlayer(initial, 10)
    expect(after.totalXP).toBe(10)
  })

  it('clamps totalXP to minimum 0', () => {
    const initial = buildPlayerXP(5)
    const after = addXPToPlayer(initial, -100)
    expect(after.totalXP).toBe(0)
    expect(after.level).toBe(0)
  })

  it('adding 0 XP leaves the state unchanged', () => {
    const initial = buildPlayerXP(50)
    const after = addXPToPlayer(initial, 0)
    expect(after).toEqual(initial)
  })
})
