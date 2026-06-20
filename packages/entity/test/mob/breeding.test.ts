import { describe, it, expect } from 'vitest'
import {
  acceleratedBabyAge,
  ADULT_BREEDING_STATE,
  afterBreedingParentState,
  BABY_GROW_TICKS,
  BREED_COOLDOWN_TICKS,
  BREED_XP_MAX_REWARD,
  BREED_XP_MIN_REWARD,
  canAcceptBreedingFood,
  findBreedingPairs,
  isAdult,
  isBaby,
  isBreedingPair,
  isInLove,
  LOVE_DURATION_TICKS,
  newbornBreedingState,
  resolveBreedingExperience,
  tickBreedingTimers,
} from '@ts-minecraft/entity/domain/mob/breeding'

describe('breeding domain (R6b)', () => {
  describe('canAcceptBreedingFood', () => {
    it('accepts an idle adult off cooldown', () => {
      expect(canAcceptBreedingFood(ADULT_BREEDING_STATE)).toBe(true)
    })
    it('rejects a baby', () => {
      expect(canAcceptBreedingFood(newbornBreedingState())).toBe(false)
    })
    it('rejects an adult already in love', () => {
      expect(canAcceptBreedingFood({ ...ADULT_BREEDING_STATE, loveTicksRemaining: LOVE_DURATION_TICKS })).toBe(false)
    })
    it('rejects an adult on breed cooldown', () => {
      expect(canAcceptBreedingFood({ ...ADULT_BREEDING_STATE, breedCooldownRemaining: BREED_COOLDOWN_TICKS })).toBe(false)
    })
  })

  describe('isBreedingPair', () => {
    const here = { x: 0, y: 64, z: 0 }
    const near = { x: 2, y: 64, z: 0 }
    const far = { x: 10, y: 64, z: 0 }
    it('pairs two same-type in-love adults within range', () => {
      expect(isBreedingPair('Cow', 'Cow', here, near, 100, 100)).toBe(true)
    })
    it('rejects different types', () => {
      expect(isBreedingPair('Cow', 'Pig', here, near, 100, 100)).toBe(false)
    })
    it('rejects out-of-range pairs', () => {
      expect(isBreedingPair('Cow', 'Cow', here, far, 100, 100)).toBe(false)
    })
    it('rejects when either is not in love', () => {
      expect(isBreedingPair('Cow', 'Cow', here, near, 100, 0)).toBe(false)
    })
  })

  describe('tickBreedingTimers', () => {
    it('counts love & cooldown down (clamped at 0) and age up by the elapsed game-ticks', () => {
      const next = tickBreedingTimers({ loveTicksRemaining: 1, breedCooldownRemaining: 0, ageTicks: 5 }, 1)
      expect(next).toEqual({ loveTicksRemaining: 0, breedCooldownRemaining: 0, ageTicks: 6 })
    })
    it('is frame-rate independent: a fractional game-tick advances proportionally', () => {
      const next = tickBreedingTimers({ loveTicksRemaining: 10, breedCooldownRemaining: 4, ageTicks: 5 }, 0.5)
      expect(next).toEqual({ loveTicksRemaining: 9.5, breedCooldownRemaining: 3.5, ageTicks: 5.5 })
    })
    it('clamps age at BABY_GROW_TICKS even with a large elapsed (no overshoot)', () => {
      const next = tickBreedingTimers({ loveTicksRemaining: 0, breedCooldownRemaining: 0, ageTicks: BABY_GROW_TICKS - 1 }, 100)
      expect(next.ageTicks).toBe(BABY_GROW_TICKS)
    })
  })

  describe('age helpers', () => {
    it('isAdult / isInLove thresholds', () => {
      expect(isAdult(BABY_GROW_TICKS)).toBe(true)
      expect(isAdult(BABY_GROW_TICKS - 1)).toBe(false)
      expect(isInLove(1)).toBe(true)
      expect(isInLove(0)).toBe(false)
    })
    it('a newborn matures to adult after BABY_GROW_TICKS ticks', () => {
      let s = newbornBreedingState()
      for (let i = 0; i < BABY_GROW_TICKS; i++) s = tickBreedingTimers(s, 1)
      expect(isAdult(s.ageTicks)).toBe(true)
    })
  })

  describe('resolveBreedingExperience', () => {
    it('maps breeding XP rolls to the vanilla 1-7 inclusive range', () => {
      expect(resolveBreedingExperience(0)).toBe(BREED_XP_MIN_REWARD)
      expect(resolveBreedingExperience(0.999_999)).toBe(BREED_XP_MAX_REWARD)
      expect(resolveBreedingExperience(1)).toBe(BREED_XP_MAX_REWARD)
    })

    it('clamps invalid rolls to the minimum reward', () => {
      expect(resolveBreedingExperience(Number.NaN)).toBe(BREED_XP_MIN_REWARD)
      expect(resolveBreedingExperience(-1)).toBe(BREED_XP_MIN_REWARD)
    })
  })

  describe('afterBreedingParentState', () => {
    it('clears love and applies the full breed cooldown', () => {
      expect(afterBreedingParentState()).toEqual({ loveTicksRemaining: 0, breedCooldownRemaining: BREED_COOLDOWN_TICKS })
    })
  })

  describe('baby growth on feeding (R8)', () => {
    it('isBaby is true below BABY_GROW_TICKS, false at/above', () => {
      expect(isBaby(0)).toBe(true)
      expect(isBaby(BABY_GROW_TICKS - 1)).toBe(true)
      expect(isBaby(BABY_GROW_TICKS)).toBe(false)
    })

    it('acceleratedBabyAge advances a newborn by 10% of remaining', () => {
      expect(acceleratedBabyAge(0)).toBe(Math.ceil(BABY_GROW_TICKS * 0.1))
    })

    it('acceleratedBabyAge never exceeds BABY_GROW_TICKS', () => {
      expect(acceleratedBabyAge(BABY_GROW_TICKS - 1)).toBe(BABY_GROW_TICKS)
      expect(acceleratedBabyAge(BABY_GROW_TICKS)).toBe(BABY_GROW_TICKS) // already adult: unchanged
    })

    it('repeated feeding eventually matures the baby', () => {
      let age = 0
      for (let i = 0; i < 100 && age < BABY_GROW_TICKS; i++) age = acceleratedBabyAge(age)
      expect(age).toBe(BABY_GROW_TICKS)
    })
  })

  describe('findBreedingPairs', () => {
    const at = (id: string, type: string, x: number) => ({ id, type, position: { x, y: 64, z: 0 } })

    it('pairs two same-type candidates within range; baby at the midpoint', () => {
      const pairs = findBreedingPairs([at('a', 'Cow', 0), at('b', 'Cow', 2)])
      expect(pairs).toHaveLength(1)
      expect(pairs[0]).toMatchObject({ parentA: 'a', parentB: 'b', type: 'Cow' })
      expect(pairs[0]!.babyPosition).toEqual({ x: 1, y: 64, z: 0 })
    })

    it('does not pair different species', () => {
      expect(findBreedingPairs([at('a', 'Cow', 0), at('b', 'Pig', 1)])).toHaveLength(0)
    })

    it('does not pair beyond BREED_RANGE', () => {
      expect(findBreedingPairs([at('a', 'Cow', 0), at('b', 'Cow', 10)])).toHaveLength(0)
    })

    it('greedy: a third nearby same-type animal stays unpaired', () => {
      const pairs = findBreedingPairs([at('a', 'Cow', 0), at('b', 'Cow', 1), at('c', 'Cow', 2)])
      expect(pairs).toHaveLength(1)
      // a pairs with b; c left over
      expect([pairs[0]!.parentA, pairs[0]!.parentB].sort()).toEqual(['a', 'b'])
    })

    it('forms two pairs from four in-range same-type animals', () => {
      const pairs = findBreedingPairs([at('a', 'Cow', 0), at('b', 'Cow', 1), at('c', 'Cow', 2), at('d', 'Cow', 3)])
      expect(pairs).toHaveLength(2)
    })
  })
})
