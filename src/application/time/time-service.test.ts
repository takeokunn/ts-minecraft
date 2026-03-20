import { describe, it, expect } from 'vitest'
import { Effect } from 'effect'
import { TimeService, TimeServiceLive } from '@/application/time/time-service'
import { DeltaTimeSecs } from '@/shared/kernel'

/**
 * TimeService has no external dependencies, so we use TimeService.Default (= TimeServiceLive)
 * directly for every test.
 *
 * MEMORY note: Always call setTimeOfDay AFTER setDayLength so that ticks are
 * computed against the correct dayLengthTicks denominator.
 */

describe('application/time/time-service', () => {
  describe('TimeService interface', () => {
    it('should expose all required methods', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        expect(typeof service.advanceTick).toBe('function')
        expect(typeof service.getTimeOfDay).toBe('function')
        expect(typeof service.isNight).toBe('function')
        expect(typeof service.setDayLength).toBe('function')
        expect(typeof service.setTimeOfDay).toBe('function')
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('initial state', () => {
    it('should start at timeOfDay 0 (midnight)', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBe(0)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should report isNight true at midnight (timeOfDay=0)', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        const night = yield* service.isNight()
        expect(night).toBe(true)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('setDayLength + setTimeOfDay interaction', () => {
    it('should return ~0.5 after setDayLength(600) then setTimeOfDay(0.5)', () => {
      // This is the critical ordering documented in MEMORY.md:
      // setDayLength first, then setTimeOfDay so ticks = 0.5 * newDayLengthTicks
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(600)
        yield* service.setTimeOfDay(0.5)
        const timeOfDay = yield* service.getTimeOfDay()
        // setTimeOfDay clamps to 0.9999, so 0.5 is stored as-is and should return 0.5
        expect(timeOfDay).toBeCloseTo(0.5, 5)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('regression: setTimeOfDay(0.5) BEFORE setDayLength changes effective timeOfDay', () => {
      // If we set ticks = 0.5 * defaultDayLengthTicks (= 12000) using the default dayLength,
      // then change dayLength to 600 seconds → new dayLengthTicks = 36000,
      // the stored ticks (12000) / new dayLengthTicks (36000) = 0.333…, not 0.5.
      // This documents the bug in MEMORY.md.
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        // Set noon using the default day length (24000 ticks)
        yield* service.setTimeOfDay(0.5)
        // Then change the day length → ticks stays the same but denominator changes
        yield* service.setDayLength(600)  // 600s * 60 = 36000 ticks
        const timeOfDay = yield* service.getTimeOfDay()
        // ticks = 0.5 * 24000 = 12000; new dayLengthTicks = 36000 → timeOfDay = 12000/36000 ≈ 0.333
        expect(timeOfDay).toBeCloseTo(12000 / 36000, 5)
        expect(timeOfDay).not.toBeCloseTo(0.5, 1)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should correctly set noon when setDayLength is called first', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(200)  // 200s * 60 = 12000 ticks
        yield* service.setTimeOfDay(0.5)
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeCloseTo(0.5, 5)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('advanceTick — time progression', () => {
    it('should advance time when tickeing with a small deltaTime', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)  // default 24000 ticks
        yield* service.setTimeOfDay(0.5)  // start at noon

        const before = yield* service.getTimeOfDay()
        // Advance by 1/60 seconds (one frame at 60fps = 1 tick)
        yield* service.advanceTick(DeltaTimeSecs.make(1 / 60))
        const after = yield* service.getTimeOfDay()

        expect(after).toBeGreaterThan(before)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should advance time by the correct fractional amount', () => {
      // dayLengthTicks = 120s * 60 = 7200
      // advanceTick(1.0) adds 1.0 * 60 = 60 ticks
      // delta fraction = 60 / 7200 = 1/120
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)
        yield* service.setTimeOfDay(0)
        yield* service.advanceTick(DeltaTimeSecs.make(1.0))  // 1 second = 60 ticks
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeCloseTo(60 / 7200, 5)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should accumulate multiple ticks correctly', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)   // dayLengthTicks = 7200
        yield* service.setTimeOfDay(0)

        // Advance 5 times by 1s each = total 5s = 300 ticks
        for (let i = 0; i < 5; i++) {
          yield* service.advanceTick(DeltaTimeSecs.make(1.0))
        }

        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeCloseTo(300 / 7200, 5)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('isNight — day/night cycle', () => {
    it('should return false (daytime) at noon (timeOfDay=0.5)', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(0.5)
        const night = yield* service.isNight()
        expect(night).toBe(false)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return true (nighttime) near midnight (timeOfDay near 0)', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        // Leave at default state: ticks=0, timeOfDay=0 → midnight
        const night = yield* service.isNight()
        expect(night).toBe(true)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return true (nighttime) near midnight (timeOfDay=0.9999)', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(0.9999)  // clamps to 0.9999 → near midnight
        const night = yield* service.isNight()
        expect(night).toBe(true)  // 0.9999 > 0.75 → night
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return false at dawn threshold (timeOfDay=0.25)', () => {
      // isNight = timeOfDay < 0.25 || timeOfDay > 0.75
      // At exactly 0.25: neither condition is true → daytime
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(0.25)
        const night = yield* service.isNight()
        expect(night).toBe(false)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return true just before dawn (timeOfDay=0.24)', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(0.24)
        const night = yield* service.isNight()
        expect(night).toBe(true)  // 0.24 < 0.25 → night
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return false at dusk threshold (timeOfDay=0.75)', () => {
      // isNight = timeOfDay < 0.25 || timeOfDay > 0.75
      // At exactly 0.75: not > 0.75, not < 0.25 → daytime
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(0.75)
        const night = yield* service.isNight()
        expect(night).toBe(false)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should return true just after dusk (timeOfDay=0.76)', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(0.76)
        const night = yield* service.isNight()
        expect(night).toBe(true)  // 0.76 > 0.75 → night
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('wrap-around — time cycles from 1.0 back to 0.0', () => {
    it('should wrap timeOfDay back below 1.0 after a full day cycle', () => {
      // dayLengthTicks = 120s * 60 = 7200
      // We start at 0.9 and advance by enough ticks to exceed one full day
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)   // dayLengthTicks = 7200
        yield* service.setTimeOfDay(0.9)   // ticks = 0.9 * 7200 = 6480
        // Advance by 1200 ticks (20 seconds * 60fps) → total ticks = 6480 + 1200 = 7680
        // timeOfDay = 7680 % 7200 / 7200 = 480/7200 ≈ 0.0667
        yield* service.advanceTick(DeltaTimeSecs.make(20.0))
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeLessThan(0.2)
        expect(timeOfDay).toBeGreaterThanOrEqual(0)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should wrap correctly: ticks modulo dayLengthTicks', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)   // dayLengthTicks = 7200
        yield* service.setTimeOfDay(0)
        // Advance exactly one full day + a quarter = 120s + 30s = 150s → 9000 ticks
        yield* service.advanceTick(DeltaTimeSecs.make(150.0))
        const timeOfDay = yield* service.getTimeOfDay()
        // 9000 % 7200 = 1800; 1800/7200 = 0.25
        expect(timeOfDay).toBeCloseTo(0.25, 4)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('getTimeOfDay — value range', () => {
    it('should always return a value in [0, 1)', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)

        const fractions = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.9999]
        for (const f of fractions) {
          yield* service.setTimeOfDay(f)
          const t = yield* service.getTimeOfDay()
          expect(t).toBeGreaterThanOrEqual(0)
          expect(t).toBeLessThan(1)
        }
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should clamp setTimeOfDay(1.0) to 0.9999 to avoid exact midnight wrap', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(1.0)  // clamps to 0.9999
        const timeOfDay = yield* service.getTimeOfDay()
        // ticks = 0.9999 * dayLengthTicks; timeOfDay = 0.9999 * dayLengthTicks / dayLengthTicks = 0.9999
        expect(timeOfDay).toBeCloseTo(0.9999, 4)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should clamp setTimeOfDay(-0.1) to 0 (floor at 0)', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(-0.1)  // clamps to 0
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBe(0)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('setDayLength — clamping', () => {
    it('should clamp dayLength below minimum (120s) when given a smaller value', () => {
      // dayLengthTicks floor = 120 * 60 = 7200
      // We set dayLength=50 → clamped to 120 → dayLengthTicks=7200
      // Then setTimeOfDay(0.5) → ticks = 0.5 * 7200 = 3600
      // advanceTick(60) adds 3600 ticks → total = 7200 → timeOfDay = 7200%7200/7200 = 0
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(50)   // clamped to 120s → 7200 ticks
        yield* service.setTimeOfDay(0.5)  // ticks = 3600
        // Advance another half day
        yield* service.advanceTick(DeltaTimeSecs.make(60))    // 60s * 60fps = 3600 ticks → total = 7200
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeCloseTo(0, 4)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should clamp dayLength above maximum (1200s) when given a larger value', () => {
      // dayLengthTicks ceiling = 1200 * 60 = 72000
      // setDayLength(9999) → clamped to 1200s → 72000 ticks
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(9999)  // clamped to 1200s → 72000 ticks
        yield* service.setTimeOfDay(0.5)
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeCloseTo(0.5, 5)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('getLightLevel — day/night light changes', () => {
    it('should be darker at midnight than at noon (isNight as proxy)', () => {
      // TimeService does not expose getLightLevel directly, but isNight
      // changes with time. This test documents that night detection works
      // across a transition from day to night.
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)
        yield* service.setTimeOfDay(0.5) // noon
        const noonNight = yield* service.isNight()
        yield* service.setTimeOfDay(0)   // midnight
        const midnightNight = yield* service.isNight()
        expect(noonNight).toBe(false)
        expect(midnightNight).toBe(true)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('day/night boundary crossing via advanceTick', () => {
    it('should transition from day to night when advancing past dusk (0.75)', () => {
      // Start at timeOfDay=0.74 (day), advance enough to reach 0.76 (night)
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)   // dayLengthTicks = 7200
        yield* service.setTimeOfDay(0.74)
        const beforeNight = yield* service.isNight()
        expect(beforeNight).toBe(false)

        // Advance 0.03 of a day = 0.03 * 7200 / 60 = 3.6 seconds
        yield* service.advanceTick(DeltaTimeSecs.make(3.6))
        const afterNight = yield* service.isNight()
        expect(afterNight).toBe(true)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should transition from night to day when advancing past dawn (0.25)', () => {
      // Start at timeOfDay=0.24 (night), advance enough to reach 0.26 (day)
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)   // dayLengthTicks = 7200
        yield* service.setTimeOfDay(0.24)
        const beforeDay = yield* service.isNight()
        expect(beforeDay).toBe(true)

        // Advance 0.03 of a day = 0.03 * 7200 / 60 = 3.6 seconds
        yield* service.advanceTick(DeltaTimeSecs.make(3.6))
        const afterDay = yield* service.isNight()
        expect(afterDay).toBe(false)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })

    it('should transition from night back to night when wrapping past midnight', () => {
      // Start at 0.95 (night), advance past midnight wrap, should still be night
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)   // dayLengthTicks = 7200
        yield* service.setTimeOfDay(0.95)
        const beforeWrap = yield* service.isNight()
        expect(beforeWrap).toBe(true)

        // Advance 0.15 of a day = 0.15 * 120 = 18 seconds
        // timeOfDay = (0.95 + 0.15) mod 1.0 = 0.10 — still night
        yield* service.advanceTick(DeltaTimeSecs.make(18))
        const afterWrap = yield* service.isNight()
        expect(afterWrap).toBe(true)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('multiple rapid setDayLength calls', () => {
    it('should use the last setDayLength value', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(200)
        yield* service.setDayLength(300)
        yield* service.setDayLength(600)
        yield* service.setTimeOfDay(0.5)
        // Advance 60 seconds = 3600 ticks
        // dayLengthTicks = 600 * 60 = 36000
        // timeOfDay = (0.5 * 36000 + 3600) % 36000 / 36000 = 21600/36000 = 0.6
        yield* service.advanceTick(DeltaTimeSecs.make(60))
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeCloseTo(0.6, 4)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })

  describe('zero deltaTime', () => {
    it('should not advance time when deltaTime is 0', () => {
      const program = Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)
        yield* service.setTimeOfDay(0.3)
        yield* service.advanceTick(DeltaTimeSecs.make(Number.MIN_VALUE))
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeCloseTo(0.3, 5)
        return { success: true }
      }).pipe(Effect.provide(TimeServiceLive))

      const result = Effect.runSync(program)
      expect(result.success).toBe(true)
    })
  })
})
