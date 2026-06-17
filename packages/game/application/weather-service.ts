import { Effect, Ref } from 'effect'
import {
  CLEAR_DURATION_SECS,
  resolveNextWeatherState,
  type Weather,
  type WeatherState,
} from '../domain/weather'

export class WeatherService extends Effect.Service<WeatherService>()(
  '@minecraft/application/WeatherService',
  {
    effect: Effect.gen(function* () {
      const stateRef = yield* Ref.make<WeatherState>({
        weather: 'clear',
        remainingSecs: CLEAR_DURATION_SECS,
      })

      return {
        getWeather: (): Effect.Effect<Weather, never> =>
          Effect.gen(function* () {
            const s = yield* Ref.get(stateRef)
            return s.weather
          }),

        setWeather: (weather: Weather): Effect.Effect<void, never> =>
          Ref.update(stateRef, (s) => ({
            weather,
            remainingSecs: s.remainingSecs,
          })),

        serialize: (): Effect.Effect<WeatherState, never> =>
          Ref.get(stateRef),

        restore: (state: WeatherState): Effect.Effect<void, never> =>
          Ref.set(stateRef, state),

        tick: (deltaTime: number): Effect.Effect<Weather, never> =>
          Ref.modify(stateRef, (s): [Weather, WeatherState] => {
            const newRemaining = s.remainingSecs - deltaTime
            if (newRemaining > 0) return [s.weather, { ...s, remainingSecs: newRemaining }]
            const next = resolveNextWeatherState(s.weather)
            return [next.weather, next]
          }),
      }
    }),
  },
) {}
