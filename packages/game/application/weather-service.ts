import { Effect, Ref } from 'effect'

export type Weather = 'clear' | 'rain' | 'thunder'

// Average duration in game-seconds for each weather type before transitioning.
const CLEAR_DURATION_SECS = 600    // 10 minutes of clear weather
const RAIN_DURATION_SECS = 240     // 4 minutes of rain
const THUNDER_DURATION_SECS = 120  // 2 minutes of thunder

type WeatherState = {
  readonly weather: Weather
  readonly remainingSecs: number
}

const nextWeather = (current: Weather): { weather: Weather; remainingSecs: number } => {
  if (current === 'clear') return { weather: 'rain', remainingSecs: RAIN_DURATION_SECS }
  if (current === 'rain') {
    // 30% chance of thunder after rain, otherwise clear
    return { weather: 'thunder', remainingSecs: THUNDER_DURATION_SECS }
  }
  return { weather: 'clear', remainingSecs: CLEAR_DURATION_SECS }
}

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

        tick: (deltaTime: number): Effect.Effect<Weather, never> =>
          Ref.modify(stateRef, (s): [Weather, WeatherState] => {
            const newRemaining = s.remainingSecs - deltaTime
            if (newRemaining > 0) return [s.weather, { ...s, remainingSecs: newRemaining }]
            const next = nextWeather(s.weather)
            return [next.weather, next]
          }),
      }
    }),
  },
) {}

export const WeatherServiceLive = WeatherService.Default
