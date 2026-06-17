import { describe, it, expect } from '@effect/vitest'
import { Array as Arr, Effect } from 'effect'
import { TimeService } from '@ts-minecraft/game'
import { DeltaTimeSecs } from '@ts-minecraft/core'

// TimeService has no external dependencies, so we use TimeService.Default.
// directly for every test.
//
// MEMORY note: Always call setTimeOfDay AFTER setDayLength so that ticks are
// computed against the correct dayLengthTicks denominator.

describe('application/time/time-service', () => {
  describe('TimeService interface', () => {
    it.effect('should expose all required methods', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        expect(typeof service.advanceTick).toBe('function')
        expect(typeof service.getTimeOfDay).toBe('function')
        expect(typeof service.getMoonPhase).toBe('function')
        expect(typeof service.isNight).toBe('function')
        expect(typeof service.setDayLength).toBe('function')
        expect(typeof service.setTimeOfDay).toBe('function')
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('initial state', () => {
    it.effect('should start at timeOfDay 0 (midnight)', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBe(0)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should report isNight true at midnight (timeOfDay=0)', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        const night = yield* service.isNight()
        expect(night).toBe(true)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should start at moon phase 0', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        const phase = yield* service.getMoonPhase()
        expect(phase).toBe(0)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('setDayLength + setTimeOfDay interaction', () => {
    it.effect('should return ~0.5 after setDayLength(600) then setTimeOfDay(0.5)', () =>
      // This is the critical ordering documented in MEMORY.md:
      // setDayLength first, then setTimeOfDay so ticks = 0.5 * newDayLengthTicks
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(600)
        yield* service.setTimeOfDay(0.5)
        const timeOfDay = yield* service.getTimeOfDay()
        // setTimeOfDay clamps to 0.9999, so 0.5 is stored as-is and should return 0.5
        expect(timeOfDay).toBeCloseTo(0.5, 5)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('regression: setTimeOfDay(0.5) BEFORE setDayLength changes effective timeOfDay', () =>
      // If we set ticks = 0.5 * defaultDayLengthTicks (= 12000) using the default dayLength,
      // then change dayLength to 600 seconds → new dayLengthTicks = 36000,
      // the stored ticks (12000) / new dayLengthTicks (36000) = 0.333…, not 0.5.
      // This documents the bug in MEMORY.md.
      Effect.gen(function* () {
        const service = yield* TimeService
        // Set noon using the default day length (24000 ticks)
        yield* service.setTimeOfDay(0.5)
        // Then change the day length → ticks stays the same but denominator changes
        yield* service.setDayLength(600)  // 600s * 60 = 36000 ticks
        const timeOfDay = yield* service.getTimeOfDay()
        // ticks = 0.5 * 24000 = 12000; new dayLengthTicks = 36000 → timeOfDay = 12000/36000 ≈ 0.333
        expect(timeOfDay).toBeCloseTo(12000 / 36000, 5)
        expect(timeOfDay).not.toBeCloseTo(0.5, 1)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should correctly set noon when setDayLength is called first', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(200)  // 200s * 60 = 12000 ticks
        yield* service.setTimeOfDay(0.5)
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeCloseTo(0.5, 5)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('advanceTick — time progression', () => {
    it.effect('should advance time when tickeing with a small deltaTime', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)  // default 24000 ticks
        yield* service.setTimeOfDay(0.5)  // start at noon

        const before = yield* service.getTimeOfDay()
        // Advance by 1/60 seconds (one frame at 60fps = 1 tick)
        yield* service.advanceTick(DeltaTimeSecs.make(1 / 60))
        const after = yield* service.getTimeOfDay()

        expect(after).toBeGreaterThan(before)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should advance time by the correct fractional amount', () =>
      // dayLengthTicks = 120s * 60 = 7200
      // advanceTick(1.0) adds 1.0 * 60 = 60 ticks
      // delta fraction = 60 / 7200 = 1/120
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)
        yield* service.setTimeOfDay(0)
        yield* service.advanceTick(DeltaTimeSecs.make(1.0))  // 1 second = 60 ticks
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeCloseTo(60 / 7200, 5)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should accumulate multiple ticks correctly', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)   // dayLengthTicks = 7200
        yield* service.setTimeOfDay(0)

        // Advance 5 times by 1s each = total 5s = 300 ticks
        yield* Effect.forEach(Arr.makeBy(5, () => undefined), () => service.advanceTick(DeltaTimeSecs.make(1.0)), { concurrency: 1 })

        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeCloseTo(300 / 7200, 5)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('moon phase', () => {
    it.effect('advances by full days and wraps modulo 8', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)
        yield* service.setTimeOfDay(0)

        expect(yield* service.getMoonPhase()).toBe(0)

        yield* service.advanceTick(DeltaTimeSecs.make(120 * 3))
        expect(yield* service.getMoonPhase()).toBe(3)

        yield* service.advanceTick(DeltaTimeSecs.make(120 * 5))
        expect(yield* service.getMoonPhase()).toBe(0)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('isNight — day/night cycle', () => {
    it.effect('should return false (daytime) at noon (timeOfDay=0.5)', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(0.5)
        const night = yield* service.isNight()
        expect(night).toBe(false)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should return true (nighttime) near midnight (timeOfDay near 0)', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        // Leave at default state: ticks=0, timeOfDay=0 → midnight
        const night = yield* service.isNight()
        expect(night).toBe(true)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should return true (nighttime) near midnight (timeOfDay=0.9999)', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(0.9999)  // clamps to 0.9999 → near midnight
        const night = yield* service.isNight()
        expect(night).toBe(true)  // 0.9999 > 0.75 → night
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should return false at dawn threshold (timeOfDay=0.25)', () =>
      // isNight = timeOfDay < 0.25 || timeOfDay > 0.75
      // At exactly 0.25: neither condition is true → daytime
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(0.25)
        const night = yield* service.isNight()
        expect(night).toBe(false)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should return true just before dawn (timeOfDay=0.24)', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(0.24)
        const night = yield* service.isNight()
        expect(night).toBe(true)  // 0.24 < 0.25 → night
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should return false at dusk threshold (timeOfDay=0.75)', () =>
      // isNight = timeOfDay < 0.25 || timeOfDay > 0.75
      // At exactly 0.75: not > 0.75, not < 0.25 → daytime
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(0.75)
        const night = yield* service.isNight()
        expect(night).toBe(false)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should return true just after dusk (timeOfDay=0.76)', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(0.76)
        const night = yield* service.isNight()
        expect(night).toBe(true)  // 0.76 > 0.75 → night
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('wrap-around — time cycles from 1.0 back to 0.0', () => {
    it.effect('should wrap timeOfDay back below 1.0 after a full day cycle', () =>
      // dayLengthTicks = 120s * 60 = 7200
      // We start at 0.9 and advance by enough ticks to exceed one full day
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)   // dayLengthTicks = 7200
        yield* service.setTimeOfDay(0.9)   // ticks = 0.9 * 7200 = 6480
        // Advance by 1200 ticks (20 seconds * 60fps) → total ticks = 6480 + 1200 = 7680
        // timeOfDay = 7680 % 7200 / 7200 = 480/7200 ≈ 0.0667
        yield* service.advanceTick(DeltaTimeSecs.make(20.0))
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeLessThan(0.2)
        expect(timeOfDay).toBeGreaterThanOrEqual(0)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('should wrap correctly: ticks modulo dayLengthTicks', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)   // dayLengthTicks = 7200
        yield* service.setTimeOfDay(0)
        // Advance exactly one full day + a quarter = 120s + 30s = 150s → 9000 ticks
        yield* service.advanceTick(DeltaTimeSecs.make(150.0))
        const timeOfDay = yield* service.getTimeOfDay()
        // 9000 % 7200 = 1800; 1800/7200 = 0.25
        expect(timeOfDay).toBeCloseTo(0.25, 4)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })
})
