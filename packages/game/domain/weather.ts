export type Weather = 'clear' | 'rain' | 'thunder'

export type WeatherDurationRange = {
  readonly min: number
  readonly max: number
}

export const CLEAR_DURATION_RANGE_SECS = { min: 600, max: 9000 } as const
export const RAIN_DURATION_RANGE_SECS = { min: 600, max: 1200 } as const
export const THUNDER_DURATION_RANGE_SECS = { min: 180, max: 780 } as const

export const WEATHER_DURATION_RANGES: Record<Weather, WeatherDurationRange> = {
  clear: CLEAR_DURATION_RANGE_SECS,
  rain: RAIN_DURATION_RANGE_SECS,
  thunder: THUNDER_DURATION_RANGE_SECS,
}

export const CLEAR_DURATION_SECS = CLEAR_DURATION_RANGE_SECS.min
export const RAIN_DURATION_SECS = RAIN_DURATION_RANGE_SECS.min
export const THUNDER_DURATION_SECS = THUNDER_DURATION_RANGE_SECS.min
export const THUNDER_AFTER_CLEAR_CHANCE = 0.1
export const THUNDER_AFTER_RAIN_CHANCE = 0.3
export const RAIN_AFTER_THUNDER_CHANCE = 0.4

export type WeatherState = {
  readonly weather: Weather
  readonly remainingSecs: number
}

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value))

export const resolveWeatherDurationSecs = (
  weather: Weather,
  randomValue = Math.random(),
): number => {
  const range = WEATHER_DURATION_RANGES[weather]
  const offset = Math.floor(clampUnit(randomValue) * (range.max - range.min + 1))
  return Math.min(range.max, range.min + offset)
}

export const createWeatherState = (
  weather: Weather,
  durationRandomValue = Math.random(),
): WeatherState => ({
  weather,
  remainingSecs: resolveWeatherDurationSecs(weather, durationRandomValue),
})

export const resolveNextWeatherState = (
  current: Weather,
  transitionRandomValue = Math.random(),
  durationRandomValue = Math.random(),
): WeatherState => {
  if (current === 'clear') {
    const weather = transitionRandomValue < THUNDER_AFTER_CLEAR_CHANCE ? 'thunder' : 'rain'
    return createWeatherState(weather, durationRandomValue)
  }
  if (current === 'rain') {
    const weather = transitionRandomValue < THUNDER_AFTER_RAIN_CHANCE ? 'thunder' : 'clear'
    return createWeatherState(weather, durationRandomValue)
  }
  const weather = transitionRandomValue < RAIN_AFTER_THUNDER_CHANCE ? 'rain' : 'clear'
  return createWeatherState(weather, durationRandomValue)
}
