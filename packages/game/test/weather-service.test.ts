import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { Effect } from 'effect'
import {
  CLEAR_DURATION_RANGE_SECS,
  RAIN_DURATION_RANGE_SECS,
  THUNDER_DURATION_RANGE_SECS,
  WeatherService,
} from '@ts-minecraft/game'

describe('WeatherService', () => {
  it.effect('starts in clear weather', () =>
    Effect.gen(function* () {
      const svc = yield* WeatherService
      const weather = yield* svc.getWeather()
      expect(weather).toBe('clear')
    }).pipe(Effect.provide(WeatherService.Default))
  )

  it.effect('tick does not change weather before duration expires', () =>
    Effect.gen(function* () {
      const svc = yield* WeatherService
      const result = yield* svc.tick(10)
      expect(result).toBe('clear')
    }).pipe(Effect.provide(WeatherService.Default))
  )

  it.effect('tick transitions to rain after clear duration expires', () =>
    Effect.gen(function* () {
      const svc = yield* WeatherService
      yield* svc.restore({ weather: 'clear', remainingSecs: 1 })
      yield* Effect.acquireUseRelease(
        Effect.sync(() => vi.spyOn(Math, 'random').mockReturnValueOnce(0.5).mockReturnValueOnce(0)),
        () =>
          Effect.gen(function* () {
            const result = yield* svc.tick(1.1)
            expect(result).toBe('rain')
            expect(yield* svc.serialize()).toEqual({
              weather: 'rain',
              remainingSecs: RAIN_DURATION_RANGE_SECS.min,
            })
          }),
        (randomSpy) => Effect.sync(() => randomSpy.mockRestore()),
      )
    }).pipe(Effect.provide(WeatherService.Default))
  )

  it.effect('setWeather overrides current weather', () =>
    Effect.gen(function* () {
      const svc = yield* WeatherService
      yield* svc.setWeather('thunder')
      const weather = yield* svc.getWeather()
      expect(weather).toBe('thunder')
    }).pipe(Effect.provide(WeatherService.Default))
  )

  it.effect('serializes current weather and remaining duration', () =>
    Effect.gen(function* () {
      const svc = yield* WeatherService
      yield* svc.tick(10)
      const state = yield* svc.serialize()
      expect(state.weather).toBe('clear')
      expect(state.remainingSecs).toBeGreaterThanOrEqual(CLEAR_DURATION_RANGE_SECS.min - 10)
      expect(state.remainingSecs).toBeLessThanOrEqual(CLEAR_DURATION_RANGE_SECS.max - 10)
    }).pipe(Effect.provide(WeatherService.Default))
  )

  it.effect('restores weather state and continues the saved cycle', () =>
    Effect.gen(function* () {
      const svc = yield* WeatherService
      yield* svc.restore({ weather: 'rain', remainingSecs: 1 })
      expect(yield* svc.getWeather()).toBe('rain')
      expect(yield* svc.tick(0.5)).toBe('rain')
      yield* Effect.acquireUseRelease(
        Effect.sync(() => vi.spyOn(Math, 'random').mockReturnValueOnce(0.29).mockReturnValueOnce(0)),
        () =>
          Effect.gen(function* () {
            expect(yield* svc.tick(0.6)).toBe('thunder')
            expect(yield* svc.serialize()).toEqual({
              weather: 'thunder',
              remainingSecs: THUNDER_DURATION_RANGE_SECS.min,
            })
          }),
        (randomSpy) => Effect.sync(() => randomSpy.mockRestore()),
      )
    }).pipe(Effect.provide(WeatherService.Default))
  )

  it.effect('uses random branch rolls and randomized target durations', () =>
    Effect.gen(function* () {
      const svc = yield* WeatherService
      yield* svc.restore({ weather: 'clear', remainingSecs: 1 })
      yield* Effect.acquireUseRelease(
        Effect.sync(() =>
          vi
            .spyOn(Math, 'random')
            .mockReturnValueOnce(0.5)
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0.29)
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0.2)
            .mockReturnValueOnce(0),
        ),
        () =>
          Effect.gen(function* () {
            expect(yield* svc.tick(1.1)).toBe('rain')
            expect(yield* svc.tick(RAIN_DURATION_RANGE_SECS.min + 1)).toBe('thunder')
            expect(yield* svc.tick(THUNDER_DURATION_RANGE_SECS.min + 1)).toBe('rain')
          }),
        (randomSpy) => Effect.sync(() => randomSpy.mockRestore()),
      )
    }).pipe(Effect.provide(WeatherService.Default))
  )

  it.effect('returns to clear after rain when the thunder roll misses', () =>
    Effect.gen(function* () {
      const svc = yield* WeatherService
      yield* svc.restore({ weather: 'rain', remainingSecs: 1 })
      yield* Effect.acquireUseRelease(
        Effect.sync(() => vi.spyOn(Math, 'random').mockReturnValueOnce(0.3).mockReturnValueOnce(0)),
        () =>
          Effect.gen(function* () {
            expect(yield* svc.tick(1.1)).toBe('clear')
          }),
        (randomSpy) => Effect.sync(() => randomSpy.mockRestore()),
      )
    }).pipe(Effect.provide(WeatherService.Default))
  )
})
