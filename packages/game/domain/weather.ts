export type Weather = 'clear' | 'rain' | 'thunder'

// Average duration in game-seconds for each weather type before transitioning.
export const CLEAR_DURATION_SECS = 600 // 10 minutes of clear weather
export const RAIN_DURATION_SECS = 240 // 4 minutes of rain
export const THUNDER_DURATION_SECS = 120 // 2 minutes of thunder

export type WeatherState = {
  readonly weather: Weather
  readonly remainingSecs: number
}

export const resolveNextWeatherState = (current: Weather): WeatherState => {
  if (current === 'clear') return { weather: 'rain', remainingSecs: RAIN_DURATION_SECS }
  if (current === 'rain') {
    // 30% chance of thunder after rain, otherwise clear
    return { weather: 'thunder', remainingSecs: THUNDER_DURATION_SECS }
  }
  return { weather: 'clear', remainingSecs: CLEAR_DURATION_SECS }
}
