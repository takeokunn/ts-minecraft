import { describe, it, expect } from '@effect/vitest'
import { Effect } from 'effect'
import { TimeService } from '@ts-minecraft/game'
import { DeltaTimeSecs } from '@ts-minecraft/core'

describe('application/time/time-service', () => {
  describe('setDayLength → setTimeOfDay(0.5) ordering invariant', () => {
    it.effect('setDayLength(600) then setTimeOfDay(0.5) always results in getTimeOfDay() === 0.5', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(600)
        yield* service.setTimeOfDay(0.5)
        const result = yield* service.getTimeOfDay()
        expect(result).toBeCloseTo(0.5, 5)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('setDayLength(120) then setTimeOfDay(0.5) results in getTimeOfDay() === 0.5', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)
        yield* service.setTimeOfDay(0.5)
        const result = yield* service.getTimeOfDay()
        expect(result).toBeCloseTo(0.5, 5)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('setDayLength(1200) then setTimeOfDay(0.5) results in getTimeOfDay() === 0.5', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(1200)
        yield* service.setTimeOfDay(0.5)
        const result = yield* service.getTimeOfDay()
        expect(result).toBeCloseTo(0.5, 5)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('setDayLength(400) then setTimeOfDay(0.25) results in getTimeOfDay() === 0.25', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(400)
        yield* service.setTimeOfDay(0.25)
        const result = yield* service.getTimeOfDay()
        expect(result).toBeCloseTo(0.25, 5)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('multiple rapid setDayLength calls', () => {
    it.effect('should use the last setDayLength value', () =>
      Effect.gen(function* () {
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
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('zero deltaTime', () => {
    it.effect('should not advance time when deltaTime is 0', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(120)
        yield* service.setTimeOfDay(0.3)
        yield* service.advanceTick(DeltaTimeSecs.make(Number.MIN_VALUE))
        const timeOfDay = yield* service.getTimeOfDay()
        expect(timeOfDay).toBeCloseTo(0.3, 5)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })

  describe('getDayLength — round-trip with setDayLength', () => {
    it.effect('returns the value passed to setDayLength', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(600)
        const dayLength = yield* service.getDayLength()
        expect(dayLength).toBe(600)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('clamps below-minimum value to 120', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(50)
        const dayLength = yield* service.getDayLength()
        expect(dayLength).toBe(120)
      }).pipe(Effect.provide(TimeService.Default))
    )

    it.effect('clamps above-maximum value to 1200', () =>
      Effect.gen(function* () {
        const service = yield* TimeService
        yield* service.setDayLength(9999)
        const dayLength = yield* service.getDayLength()
        expect(dayLength).toBe(1200)
      }).pipe(Effect.provide(TimeService.Default))
    )
  })
})
