import { describe, it, describe as effectDescribe, it as effectIt } from '@effect/vitest'
import { expect } from 'vitest'
import {
  resolveFishingCatch,
  resolveFishingCatchResult,
  resolveFishingExperience,
  resolveFishingWaitSecs,
} from '../domain/fishing-resolution'
import { FISHING_MIN_WAIT_SECS, FISHING_MAX_WAIT_SECS } from '../domain/fishing.config'
import { Effect, Option } from 'effect'
import { FishingService } from '../application/fishing-service'
import { expectSome } from './test-utils'

describe('domain/fishing', () => {
  describe('resolveFishingWaitSecs', () => {
    it('always returns a wait within the valid range (no enchant)', () => {
      for (let seed = 0; seed < 100; seed++) {
        const wait = resolveFishingWaitSecs(seed)
        expect(wait).toBeGreaterThanOrEqual(FISHING_MIN_WAIT_SECS)
        expect(wait).toBeLessThan(FISHING_MAX_WAIT_SECS)
      }
    })

    it('is deterministic — same seed → same result', () => {
      expect(resolveFishingWaitSecs(42)).toBe(resolveFishingWaitSecs(42))
      expect(resolveFishingWaitSecs(999)).toBe(resolveFishingWaitSecs(999))
    })

    it('LURE I reduces wait by 5 seconds (minimum 1s)', () => {
      const base = resolveFishingWaitSecs(20, 0)
      const lure1 = resolveFishingWaitSecs(20, 1)
      expect(lure1).toBe(Math.max(1, base - 5))
    })

    it('LURE III clamps to at least 1 second', () => {
      for (let seed = 0; seed < 50; seed++) {
        expect(resolveFishingWaitSecs(seed, 3)).toBeGreaterThanOrEqual(1)
      }
    })
  })

  describe('resolveFishingCatch', () => {
    it('always returns a valid ItemType string', () => {
      for (let seed = 0; seed < 200; seed++) {
        const item = resolveFishingCatch(seed)
        expect(typeof item).toBe('string')
        expect(item.length).toBeGreaterThan(0)
      }
    })

    it('fish items appear most frequently (over 50% of catches)', () => {
      const FISH_ITEMS = new Set(['RAW_COD', 'RAW_SALMON', 'TROPICAL_FISH', 'PUFFERFISH'])
      let fishCount = 0
      const TRIALS = 300
      for (let i = 0; i < TRIALS; i++) {
        if (FISH_ITEMS.has(resolveFishingCatch(i))) fishCount++
      }
      expect(fishCount / TRIALS).toBeGreaterThan(0.5)
    })

    it('is deterministic — same seed → same result', () => {
      expect(resolveFishingCatch(7)).toBe(resolveFishingCatch(7))
    })

    it('resolves the final weighted bucket in each catch category', () => {
      expect(resolveFishingCatch(9500)).toBe('PUFFERFISH')
      expect(resolveFishingCatch(8060)).toBe('IRON_INGOT')
      expect(resolveFishingCatch(9065)).toBe('COAL')
    })

    it('LUCK_OF_THE_SEA III increases treasure frequency over many trials', () => {
      const TREASURE_ITEMS = new Set(['BOW', 'FISHING_ROD', 'EMERALD', 'DIAMOND', 'GOLD_INGOT', 'IRON_INGOT'])
      const TRIALS = 500
      let noLuck = 0
      let withLuck = 0
      for (let i = 0; i < TRIALS; i++) {
        if (TREASURE_ITEMS.has(resolveFishingCatch(i, 0))) noLuck++
        if (TREASURE_ITEMS.has(resolveFishingCatch(i, 3))) withLuck++
      }
      expect(withLuck).toBeGreaterThan(noLuck)
    })
  })

  describe('resolveFishingExperience', () => {
    it('always returns the vanilla catch XP range', () => {
      for (let seed = -50; seed < 200; seed++) {
        const experience = resolveFishingExperience(seed)
        expect(experience).toBeGreaterThanOrEqual(1)
        expect(experience).toBeLessThanOrEqual(6)
      }
    })

    it('is deterministic — same seed → same result', () => {
      expect(resolveFishingExperience(42)).toBe(resolveFishingExperience(42))
      expect(resolveFishingExperience(-7)).toBe(resolveFishingExperience(-7))
    })
  })

  describe('resolveFishingCatchResult', () => {
    it('combines caught item and XP reward for a successful catch', () => {
      const result = resolveFishingCatchResult(42)

      expect(result.item).toBe(resolveFishingCatch(42))
      expect(result.experience).toBe(resolveFishingExperience(42))
    })
  })
})

effectDescribe('application/fishing-service', () => {
  const testLayer = FishingService.Default

  effectIt.effect('starts idle — isFishing returns false', () =>
    Effect.gen(function* () {
      const svc = yield* FishingService
      const fishing = yield* svc.isFishing()
      expect(fishing).toBe(false)
    }).pipe(Effect.provide(testLayer))
  )

  effectIt.effect('tick returns None when idle', () =>
    Effect.gen(function* () {
      const svc = yield* FishingService
      const result = yield* svc.tick(1)
      expect(Option.isNone(result)).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )

  effectIt.effect('isFishing is true after cast', () =>
    Effect.gen(function* () {
      const svc = yield* FishingService
      yield* svc.cast(42)
      const fishing = yield* svc.isFishing()
      expect(fishing).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )

  effectIt.effect('tick returns None before target time elapses', () =>
    Effect.gen(function* () {
      const svc = yield* FishingService
      yield* svc.cast(42)
      // Advance only 1 second — wait is at least 5s
      const result = yield* svc.tick(1)
      expect(Option.isNone(result)).toBe(true)
      expect(yield* svc.isFishing()).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )

  effectIt.effect('tick returns Some(catch result) when target time fully elapses', () =>
    Effect.gen(function* () {
      const svc = yield* FishingService
      yield* svc.cast(42)
      // Advance 40 seconds — always past the maximum wait
      const result = yield* svc.tick(40)
      const catchResult = expectSome(result)
      expect(typeof catchResult.item).toBe('string')
      expect(catchResult.experience).toBeGreaterThanOrEqual(1)
      expect(catchResult.experience).toBeLessThanOrEqual(6)
      // After catching, fishing resets to idle
      expect(yield* svc.isFishing()).toBe(false)
    }).pipe(Effect.provide(testLayer))
  )

  effectIt.effect('cancel stops an active cast without a catch', () =>
    Effect.gen(function* () {
      const svc = yield* FishingService
      yield* svc.cast(100)
      yield* svc.cancel()
      expect(yield* svc.isFishing()).toBe(false)
      const result = yield* svc.tick(1)
      expect(Option.isNone(result)).toBe(true)
    }).pipe(Effect.provide(testLayer))
  )

  effectIt.effect('getProgress starts at 0 and advances toward 1', () =>
    Effect.gen(function* () {
      const svc = yield* FishingService
      yield* svc.cast(42)
      const before = yield* svc.getProgress()
      expect(before).toBe(0)
      yield* svc.tick(3)
      const after = yield* svc.getProgress()
      expect(after).toBeGreaterThan(0)
      expect(after).toBeLessThan(1)
    }).pipe(Effect.provide(testLayer))
  )

  effectIt.effect('reset returns to idle from active cast state', () =>
    Effect.gen(function* () {
      const svc = yield* FishingService
      yield* svc.cast(100)
      expect(yield* svc.isFishing()).toBe(true)
      yield* svc.reset()
      expect(yield* svc.isFishing()).toBe(false)
    }).pipe(Effect.provide(testLayer))
  )

  effectIt.effect('getProgress returns 0 when not currently fishing (idle state)', () =>
    Effect.gen(function* () {
      const svc = yield* FishingService
      // Don't call cast() — service is idle, progress should be 0
      const progress = yield* svc.getProgress()
      expect(progress).toBe(0)
    }).pipe(Effect.provide(testLayer))
  )
})
