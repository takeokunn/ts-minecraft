import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import {
  xpToNextLevel,
  levelFromXP,
  buildPlayerXP,
  addXPToPlayer,
  xpAtLevelStart,
  INITIAL_PLAYER_XP,
} from '../domain/player-xp'

describe('domain/player-xp', () => {
  describe('xpToNextLevel', () => {
    it('costs 7 XP to go from level 0 to 1 (vanilla Java)', () => {
      expect(xpToNextLevel(0)).toBe(7)
    })

    it('costs 9 XP to go from level 1 to 2', () => {
      expect(xpToNextLevel(1)).toBe(9)
    })

    it('uses the mid-tier formula for level 16', () => {
      // 5*16 - 38 = 80 - 38 = 42
      expect(xpToNextLevel(16)).toBe(42)
    })

    it('uses the high-tier formula for level 31', () => {
      // 9*31 - 158 = 279 - 158 = 121
      expect(xpToNextLevel(31)).toBe(121)
    })

    it('cost grows monotonically', () => {
      for (let l = 0; l < 50; l++) {
        expect(xpToNextLevel(l + 1)).toBeGreaterThan(xpToNextLevel(l))
      }
    })
  })

  describe('levelFromXP', () => {
    it('level 0 at 0 XP', () => {
      expect(levelFromXP(0)).toBe(0)
    })

    it('still level 0 at 6 XP (one short of 7)', () => {
      expect(levelFromXP(6)).toBe(0)
    })

    it('level 1 at exactly 7 XP', () => {
      expect(levelFromXP(7)).toBe(1)
    })

    it('level 2 at 7+9=16 XP', () => {
      expect(levelFromXP(16)).toBe(2)
    })

    it('level is monotonically non-decreasing with XP', () => {
      let prev = 0
      for (let xp = 0; xp <= 200; xp++) {
        const level = levelFromXP(xp)
        expect(level).toBeGreaterThanOrEqual(prev)
        prev = level
      }
    })
  })

  describe('buildPlayerXP', () => {
    it('INITIAL_PLAYER_XP is level 0 with 0 total XP', () => {
      expect(INITIAL_PLAYER_XP.totalXP).toBe(0)
      expect(INITIAL_PLAYER_XP.level).toBe(0)
      expect(INITIAL_PLAYER_XP.xpIntoLevel).toBe(0)
      expect(INITIAL_PLAYER_XP.xpRequiredForNext).toBe(7)
    })

    it('xpIntoLevel tracks partial progress within a level', () => {
      const state = buildPlayerXP(10) // 7 for L0→L1, 3 into L1
      expect(state.level).toBe(1)
      expect(state.xpIntoLevel).toBe(3)
      expect(state.xpRequiredForNext).toBe(9)
    })

    it('xpAtLevelStart + xpIntoLevel = totalXP', () => {
      for (const xp of [0, 5, 7, 16, 100, 500]) {
        const state = buildPlayerXP(xp)
        expect(xpAtLevelStart(state.level) + state.xpIntoLevel).toBe(xp)
      }
    })

    // XP-bar fraction invariant: the bar shows xpIntoLevel / xpRequiredForNext,
    // which must stay in [0, 1) for every total — otherwise the bar renders full
    // or overflows at a level boundary. Swept across all three formula tiers.
    it('keeps 0 <= xpIntoLevel < xpRequiredForNext for every total XP', () => {
      for (let xp = 0; xp <= 2000; xp++) {
        const state = buildPlayerXP(xp)
        expect(state.xpIntoLevel).toBeGreaterThanOrEqual(0)
        expect(state.xpIntoLevel).toBeLessThan(state.xpRequiredForNext)
      }
    })
  })

  // The cost formula changes tier at level 15→16 and 30→31. levelFromXP must
  // flip to level L exactly at xpAtLevelStart(L), and remain L-1 one XP short —
  // a tier-boundary off-by-one would mis-level the player right where the curve
  // bends.
  describe('tier-transition boundaries', () => {
    for (const L of [1, 15, 16, 30, 31]) {
      it(`reaches level ${L} exactly at xpAtLevelStart(${L}), and is ${L - 1} one XP earlier`, () => {
        const start = xpAtLevelStart(L)
        expect(levelFromXP(start)).toBe(L)
        expect(levelFromXP(start - 1)).toBe(L - 1)
      })
    }
  })

  describe('addXPToPlayer', () => {
    it('accumulates XP from initial state', () => {
      const after = addXPToPlayer(INITIAL_PLAYER_XP, 7)
      expect(after.level).toBe(1)
      expect(after.totalXP).toBe(7)
    })

    it('multiple additions are cumulative', () => {
      let state = INITIAL_PLAYER_XP
      state = addXPToPlayer(state, 5)
      state = addXPToPlayer(state, 5)  // total 10 XP → level 1
      expect(state.level).toBe(1)
      expect(state.totalXP).toBe(10)
    })

    it('never goes below 0 total XP', () => {
      const after = addXPToPlayer(INITIAL_PLAYER_XP, -100)
      expect(after.totalXP).toBe(0)
    })
  })

  describe('mob XP rewards', () => {
    it('killing 5 mobs worth 5 XP each reaches level 2 from 0 (25 XP total)', () => {
      let state = INITIAL_PLAYER_XP
      for (let i = 0; i < 5; i++) {
        state = addXPToPlayer(state, 5)
      }
      expect(state.totalXP).toBe(25)
      expect(state.level).toBeGreaterThanOrEqual(2)
    })
  })
})
