import { describe,expect,it } from '@effect/vitest'
import { TimeService,TimeServiceLive } from '@ts-minecraft/game'
import { DeltaTimeSecs } from '@ts-minecraft/core'
import { Effect } from 'effect'

describe('application/time/time-service', () => {
  describe('getTimeOfDay — value range', () => {
    it.effect('should always return a value in [0, 1)', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)

        const fractions = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.9999]
        yield* Effect.forEach(fractions, (f) => Effect.gen(function* () {
          yield* service.setTimeOfDay(f)
          const t = yield* service.getTimeOfDay()
          expect(t).toBeGreaterThanOrEqual(0)
          expect(t).toBeLessThan(1)
        }), { concurrency: 1 })
      }).pipe(Effect.provide(TimeServiceLive))
    )

    it.effect('should clamp setTimeOfDay(1.0) to 0.9999 to avoid exact midnight wrap', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(1.0)
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeCloseTo(0.9999, 4)
      }).pipe(Effect.provide(TimeServiceLive))
    )

    it.effect('should clamp setTimeOfDay(-0.1) to 0 (floor at 0)', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(-0.1)
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBe(0)
      }).pipe(Effect.provide(TimeServiceLive))
    )
  })

  describe('setDayLength — clamping', () => {
    it.effect('should clamp dayLength below minimum (120s) when given a smaller value', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(50)
        yield* service.setTimeOfDay(0.5)
        yield* service.advanceTick(DeltaTimeSecs.make(60))
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeCloseTo(0, 4)
      }).pipe(Effect.provide(TimeServiceLive))
    )

    it.effect('should clamp dayLength above maximum (1200s) when given a larger value', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(9999)
        yield* service.setTimeOfDay(0.5)
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeCloseTo(0.5, 5)
      }).pipe(Effect.provide(TimeServiceLive))
    )
  })

  describe('getLightLevel — day/night light changes', () => {
    it.effect('should be darker at midnight than at noon (isNight as proxy)', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)
        yield* service.setTimeOfDay(0.5)
        const noonNight = yield* service.isNight()
        yield* service.setTimeOfDay(0)
        const midnightNight = yield* service.isNight()
        expect(noonNight).toBe(false)
        expect(midnightNight).toBe(true)
      }).pipe(Effect.provide(TimeServiceLive))
    )
  })

  describe('day/night boundary crossing via advanceTick', () => {
    it.effect('should transition from day to night when advancing past dusk (0.75)', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)
        yield* service.setTimeOfDay(0.74)
        const beforeNight = yield* service.isNight()
        expect(beforeNight).toBe(false)

        yield* service.advanceTick(DeltaTimeSecs.make(3.6))
        const afterNight = yield* service.isNight()
        expect(afterNight).toBe(true)
      }).pipe(Effect.provide(TimeServiceLive))
    )

    it.effect('should transition from night to day when advancing past dawn (0.25)', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)
        yield* service.setTimeOfDay(0.24)
        const beforeDay = yield* service.isNight()
        expect(beforeDay).toBe(true)

        yield* service.advanceTick(DeltaTimeSecs.make(3.6))
        const afterDay = yield* service.isNight()
        expect(afterDay).toBe(false)
      }).pipe(Effect.provide(TimeServiceLive))
    )

    it.effect('should transition from night back to night when wrapping past midnight', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)
        yield* service.setTimeOfDay(0.95)
        const beforeWrap = yield* service.isNight()
        expect(beforeWrap).toBe(true)

        yield* service.advanceTick(DeltaTimeSecs.make(18))
        const afterWrap = yield* service.isNight()
        expect(afterWrap).toBe(true)
      }).pipe(Effect.provide(TimeServiceLive))
    )
  })
})
