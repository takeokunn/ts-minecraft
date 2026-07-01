import { describe, expect, it } from 'vitest'
import {
  BABY_GROW_TICKS,
  BREED_COOLDOWN_TICKS,
  BREED_RANGE,
  BREED_XP_MAX_REWARD,
  BREED_XP_MIN_REWARD,
  LOVE_DURATION_TICKS,
  isAdult,
  isBaby,
  resolveBreedingExperience,
  acceleratedBabyAge,
  isInLove,
  canAcceptBreedingFood,
  isBreedingPair,
  tickBreedingTimers,
  newbornBreedingState,
  afterBreedingParentState,
  ADULT_BREEDING_STATE,
  findBreedingPairs,
} from '@ts-minecraft/entity/domain/mob/breeding'
import type { BreedingState, BreedCandidate } from '@ts-minecraft/entity/domain/mob/breeding'

// ─── helpers ─────────────────────────────────────────────────────────────────

const adultIdle: BreedingState = ADULT_BREEDING_STATE

const makeState = (overrides: Partial<BreedingState> = {}): BreedingState => ({
  ...adultIdle,
  ...overrides,
})

const pos = (x: number, y: number, z: number) => ({ x, y, z })

// ─── isAdult / isBaby ─────────────────────────────────────────────────────────
describe('isAdult', () => {
  it('returns false for a newborn', () => {
    expect(isAdult(0)).toBe(false)
  })

  it('returns false one tick before adulthood', () => {
    expect(isAdult(BABY_GROW_TICKS - 1)).toBe(false)
  })

  it('returns true exactly at BABY_GROW_TICKS', () => {
    expect(isAdult(BABY_GROW_TICKS)).toBe(true)
  })

  it('returns true beyond BABY_GROW_TICKS', () => {
    expect(isAdult(BABY_GROW_TICKS + 1000)).toBe(true)
  })
})

describe('isBaby', () => {
  it('returns true for a newborn', () => {
    expect(isBaby(0)).toBe(true)
  })

  it('returns true one tick before adulthood', () => {
    expect(isBaby(BABY_GROW_TICKS - 1)).toBe(true)
  })

  it('returns false at BABY_GROW_TICKS', () => {
    expect(isBaby(BABY_GROW_TICKS)).toBe(false)
  })
})

// ─── resolveBreedingExperience ────────────────────────────────────────────────
describe('resolveBreedingExperience', () => {
  it('returns BREED_XP_MIN_REWARD for roll=0', () => {
    expect(resolveBreedingExperience(0)).toBe(BREED_XP_MIN_REWARD)
  })

  it('returns BREED_XP_MAX_REWARD for roll just below 1', () => {
    expect(resolveBreedingExperience(0.9999)).toBe(BREED_XP_MAX_REWARD)
  })

  it('clamps roll=1 to produce a valid reward', () => {
    const result = resolveBreedingExperience(1)
    expect(result).toBeGreaterThanOrEqual(BREED_XP_MIN_REWARD)
    expect(result).toBeLessThanOrEqual(BREED_XP_MAX_REWARD)
  })

  it('clamps negative roll to MIN reward', () => {
    expect(resolveBreedingExperience(-0.5)).toBe(BREED_XP_MIN_REWARD)
  })

  it('returns MIN reward for non-finite input (NaN)', () => {
    expect(resolveBreedingExperience(NaN)).toBe(BREED_XP_MIN_REWARD)
  })

  it('returns a value within [MIN, MAX] for any roll in [0, 1]', () => {
    for (const roll of [0, 0.1, 0.5, 0.9, 0.999]) {
      const result = resolveBreedingExperience(roll)
      expect(result).toBeGreaterThanOrEqual(BREED_XP_MIN_REWARD)
      expect(result).toBeLessThanOrEqual(BREED_XP_MAX_REWARD)
    }
  })
})

// ─── acceleratedBabyAge ───────────────────────────────────────────────────────
describe('acceleratedBabyAge', () => {
  it('does not change an already-adult age', () => {
    expect(acceleratedBabyAge(BABY_GROW_TICKS)).toBe(BABY_GROW_TICKS)
    expect(acceleratedBabyAge(BABY_GROW_TICKS + 100)).toBe(BABY_GROW_TICKS + 100)
  })

  it('accelerates a newborn by 10% of remaining growth', () => {
    // remaining = 24000, gain = ceil(2400) = 2400
    expect(acceleratedBabyAge(0)).toBe(2400)
  })

  it('acceleration decreases as the baby ages (diminishing returns)', () => {
    const gain1 = acceleratedBabyAge(0) - 0
    const gain2 = acceleratedBabyAge(12000) - 12000
    expect(gain1).toBeGreaterThan(gain2)
  })

  it('clamps to BABY_GROW_TICKS when the gain would reach adulthood', () => {
    // ageTicks = BABY_GROW_TICKS - 1, remaining = 1, gain = ceil(0.1) = 1 → hits the cap
    expect(acceleratedBabyAge(BABY_GROW_TICKS - 1)).toBe(BABY_GROW_TICKS)
  })
})

// ─── isInLove ─────────────────────────────────────────────────────────────────
describe('isInLove', () => {
  it('returns false when no love ticks remain', () => {
    expect(isInLove(0)).toBe(false)
  })

  it('returns true for any positive love tick count', () => {
    expect(isInLove(1)).toBe(true)
    expect(isInLove(LOVE_DURATION_TICKS)).toBe(true)
  })
})

// ─── canAcceptBreedingFood ────────────────────────────────────────────────────
describe('canAcceptBreedingFood', () => {
  it('returns true for an idle adult', () => {
    expect(canAcceptBreedingFood(adultIdle)).toBe(true)
  })

  it('returns false for a baby', () => {
    expect(canAcceptBreedingFood(makeState({ ageTicks: 0 }))).toBe(false)
  })

  it('returns false when already in love', () => {
    expect(canAcceptBreedingFood(makeState({ loveTicksRemaining: 100 }))).toBe(false)
  })

  it('returns false when on breed cooldown', () => {
    expect(canAcceptBreedingFood(makeState({ breedCooldownRemaining: 100 }))).toBe(false)
  })
})

// ─── isBreedingPair ───────────────────────────────────────────────────────────
describe('isBreedingPair', () => {
  const near = pos(0, 0, 0)
  const within = pos(BREED_RANGE - 0.5, 0, 0)
  const atEdge = pos(BREED_RANGE, 0, 0)
  const far = pos(BREED_RANGE + 1, 0, 0)

  it('returns true for two same-type in-love animals within range', () => {
    expect(isBreedingPair('COW', 'COW', near, within, 100, 100)).toBe(true)
  })

  it('returns false for different mob types', () => {
    expect(isBreedingPair('COW', 'PIG', near, within, 100, 100)).toBe(false)
  })

  it('returns false when first animal is not in love', () => {
    expect(isBreedingPair('COW', 'COW', near, within, 0, 100)).toBe(false)
  })

  it('returns false when second animal is not in love', () => {
    expect(isBreedingPair('COW', 'COW', near, within, 100, 0)).toBe(false)
  })

  it('returns true at exact BREED_RANGE distance (boundary inclusive)', () => {
    // squared distance = BREED_RANGE^2, condition is <=
    expect(isBreedingPair('COW', 'COW', near, atEdge, 100, 100)).toBe(true)
  })

  it('returns false beyond BREED_RANGE', () => {
    expect(isBreedingPair('COW', 'COW', near, far, 100, 100)).toBe(false)
  })
})

// ─── tickBreedingTimers ───────────────────────────────────────────────────────
describe('tickBreedingTimers', () => {
  it('decrements love ticks by the elapsed count', () => {
    const result = tickBreedingTimers(makeState({ loveTicksRemaining: 10 }), 3)
    expect(result.loveTicksRemaining).toBe(7)
  })

  it('clamps love ticks at 0 (no negative values)', () => {
    const result = tickBreedingTimers(makeState({ loveTicksRemaining: 2 }), 10)
    expect(result.loveTicksRemaining).toBe(0)
  })

  it('decrements breed cooldown by the elapsed count', () => {
    const result = tickBreedingTimers(makeState({ breedCooldownRemaining: 100 }), 20)
    expect(result.breedCooldownRemaining).toBe(80)
  })

  it('clamps breed cooldown at 0', () => {
    const result = tickBreedingTimers(makeState({ breedCooldownRemaining: 5 }), 100)
    expect(result.breedCooldownRemaining).toBe(0)
  })

  it('increases age ticks by the elapsed count for a baby', () => {
    const result = tickBreedingTimers(makeState({ ageTicks: 100 }), 50)
    expect(result.ageTicks).toBe(150)
  })

  it('clamps age at BABY_GROW_TICKS for a baby', () => {
    const result = tickBreedingTimers(makeState({ ageTicks: BABY_GROW_TICKS - 5 }), 100)
    expect(result.ageTicks).toBe(BABY_GROW_TICKS)
  })

  it('does not increment age of an adult past BABY_GROW_TICKS', () => {
    const result = tickBreedingTimers(adultIdle, 1)
    expect(result.ageTicks).toBe(BABY_GROW_TICKS)
  })

  it('returns unchanged state for an idle adult (fast-path check)', () => {
    const result = tickBreedingTimers(adultIdle, 1)
    expect(result).toEqual(adultIdle)
  })
})

// ─── newbornBreedingState ─────────────────────────────────────────────────────
describe('newbornBreedingState', () => {
  it('has ageTicks = 0', () => {
    expect(newbornBreedingState().ageTicks).toBe(0)
  })

  it('has no love ticks', () => {
    expect(newbornBreedingState().loveTicksRemaining).toBe(0)
  })

  it('has no breed cooldown', () => {
    expect(newbornBreedingState().breedCooldownRemaining).toBe(0)
  })

  it('returns a fresh object on each call', () => {
    expect(newbornBreedingState()).not.toBe(newbornBreedingState())
  })
})

// ─── afterBreedingParentState ────────────────────────────────────────────────
describe('afterBreedingParentState', () => {
  it('resets love ticks to 0', () => {
    expect(afterBreedingParentState().loveTicksRemaining).toBe(0)
  })

  it('applies a full breed cooldown', () => {
    expect(afterBreedingParentState().breedCooldownRemaining).toBe(BREED_COOLDOWN_TICKS)
  })
})

// ─── findBreedingPairs ────────────────────────────────────────────────────────
describe('findBreedingPairs', () => {
  type Candidate = BreedCandidate<string, string>

  const makeCow = (id: string, x = 0): Candidate => ({
    id,
    type: 'COW',
    position: pos(x, 64, 0),
  })

  it('returns an empty array when no candidates are provided', () => {
    expect(findBreedingPairs([])).toHaveLength(0)
  })

  it('pairs two same-type candidates within range', () => {
    const pairs = findBreedingPairs([makeCow('a', 0), makeCow('b', 1)])
    expect(pairs).toHaveLength(1)
    expect(pairs[0]!.parentA).toBe('a')
    expect(pairs[0]!.parentB).toBe('b')
    expect(pairs[0]!.type).toBe('COW')
  })

  it('spawns the baby at the midpoint of the parents', () => {
    const pairs = findBreedingPairs([makeCow('a', 0), makeCow('b', 2)])
    expect(pairs[0]!.babyPosition.x).toBe(1)
  })

  it('does not pair animals that are too far apart', () => {
    const pairs = findBreedingPairs([makeCow('a', 0), makeCow('b', BREED_RANGE + 5)])
    expect(pairs).toHaveLength(0)
  })

  it('does not pair animals of different types', () => {
    const pig: Candidate = { id: 'pig1', type: 'PIG', position: pos(0, 64, 0) }
    const cow: Candidate = { id: 'cow1', type: 'COW', position: pos(1, 64, 0) }
    expect(findBreedingPairs([pig, cow])).toHaveLength(0)
  })

  it('uses each candidate at most once (greedy, no double-pairing)', () => {
    // Three cows in a row — should pair (a, b) and leave c unpaired
    const pairs = findBreedingPairs([makeCow('a', 0), makeCow('b', 1), makeCow('c', 2)])
    expect(pairs).toHaveLength(1)
    const ids = new Set([pairs[0]!.parentA, pairs[0]!.parentB])
    expect(ids.has('c')).toBe(false)
  })

  it('can find multiple non-overlapping pairs', () => {
    // Two separate pairs, each within range
    const pairs = findBreedingPairs([
      makeCow('a', 0),
      makeCow('b', 1),
      makeCow('c', 20),
      makeCow('d', 21),
    ])
    expect(pairs).toHaveLength(2)
  })
})
