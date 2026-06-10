import { describe, it, expect } from 'vitest'
import {
  canAcceptBreedingFood,
  isBreedingPair,
  tickBreedingTimers,
  isAdult,
  isInLove,
  ADULT_BREEDING_STATE,
  newbornBreedingState,
  afterBreedingParentState,
  BABY_GROW_TICKS,
  LOVE_DURATION_TICKS,
  BREED_COOLDOWN_TICKS,
} from '@ts-minecraft/entity'

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
    it('counts love & cooldown down (clamped at 0) and age up', () => {
      const next = tickBreedingTimers({ loveTicksRemaining: 1, breedCooldownRemaining: 0, ageTicks: 5 })
      expect(next).toEqual({ loveTicksRemaining: 0, breedCooldownRemaining: 0, ageTicks: 6 })
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
      for (let i = 0; i < BABY_GROW_TICKS; i++) s = tickBreedingTimers(s)
      expect(isAdult(s.ageTicks)).toBe(true)
    })
  })

  describe('afterBreedingParentState', () => {
    it('clears love and applies the full breed cooldown', () => {
      expect(afterBreedingParentState()).toEqual({ loveTicksRemaining: 0, breedCooldownRemaining: BREED_COOLDOWN_TICKS })
    })
  })
})
