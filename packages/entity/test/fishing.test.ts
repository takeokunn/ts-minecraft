import { describe, it, describe as effectDescribe, it as effectIt } from '@effect/vitest'
import { expect } from 'vitest'
import {
  resolveFishingCatch,
  resolveFishingWaitSecs,
  FISHING_MIN_WAIT_SECS,
  FISHING_MAX_WAIT_SECS,
} from '../domain/fishing'
import { Effect, Option } from 'effect'
import { FishingService, FishingServiceLive } from '../application/fishing-service'

describe('domain/fishing', () => {
  describe('resolveFishingWaitSecs', () => {
    it('always returns a wait within the valid range', () => {
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
  })
})

effectDescribe('application/fishing-service', () => {
  const testLayer = FishingServiceLive

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

  effectIt.effect('tick returns Some(item) when target time fully elapses', () =>
    Effect.gen(function* () {
      const svc = yield* FishingService
      yield* svc.cast(42)
      // Advance 40 seconds — always past the maximum wait
      const result = yield* svc.tick(40)
      expect(Option.isSome(result)).toBe(true)
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
