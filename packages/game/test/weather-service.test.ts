import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import { Effect } from 'effect'
import { WeatherService } from '@ts-minecraft/game'

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
      // Tick 10 seconds — much less than CLEAR_DURATION_SECS (600)
      const result = yield* svc.tick(10)
      expect(result).toBe('clear')
    }).pipe(Effect.provide(WeatherService.Default))
  )

  it.effect('tick transitions to rain after clear duration expires', () =>
    Effect.gen(function* () {
      const svc = yield* WeatherService
      // Tick exactly past the 600s clear duration
      const result = yield* svc.tick(601)
      expect(result).toBe('rain')
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
      expect(state).toEqual({ weather: 'clear', remainingSecs: 590 })
    }).pipe(Effect.provide(WeatherService.Default))
  )

  it.effect('restores weather state and continues the saved cycle', () =>
    Effect.gen(function* () {
      const svc = yield* WeatherService
      yield* svc.restore({ weather: 'rain', remainingSecs: 1 })
      expect(yield* svc.getWeather()).toBe('rain')
      expect(yield* svc.tick(0.5)).toBe('rain')
      expect(yield* svc.tick(0.6)).toBe('thunder')
    }).pipe(Effect.provide(WeatherService.Default))
  )

  it.effect('transitions: clear → rain → thunder → clear', () =>
    Effect.gen(function* () {
      const svc = yield* WeatherService
      expect(yield* svc.tick(601)).toBe('rain')    // past clear (600s)
      expect(yield* svc.tick(241)).toBe('thunder') // past rain (240s)
      expect(yield* svc.tick(121)).toBe('clear')   // past thunder (120s)
    }).pipe(Effect.provide(WeatherService.Default))
  )
})
