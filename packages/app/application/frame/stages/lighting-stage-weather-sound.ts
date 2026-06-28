import type { DeltaTimeSecs } from '@ts-minecraft/core'
import type { Weather } from '@ts-minecraft/game'

const RAIN_CUE_INTERVAL_SECS = 0.8
const THUNDER_INITIAL_DELAY_SECS = 1.6
const THUNDER_CUE_INTERVAL_SECS = 6.4

type WeatherSoundEffect = 'rainAmbient' | 'thunderAmbient'

export type WeatherSoundCue = {
  readonly effect: WeatherSoundEffect
  readonly gainScale: number
}

export type WeatherSoundState = {
  readonly previousWeather: Weather
  readonly rainCooldownSecs: number
  readonly thunderCooldownSecs: number
}

export const createWeatherSoundState = (): WeatherSoundState => ({
  previousWeather: 'clear',
  rainCooldownSecs: 0,
  thunderCooldownSecs: THUNDER_INITIAL_DELAY_SECS,
})

const isWetWeather = (weather: Weather): boolean => weather === 'rain' || weather === 'thunder'

const clampDelta = (deltaTime: DeltaTimeSecs): number =>
  Number.isFinite(deltaTime) ? Math.max(0, deltaTime) : 0

export const collectWeatherSoundCues = (
  state: WeatherSoundState,
  weather: Weather,
  deltaTime: DeltaTimeSecs,
): readonly [WeatherSoundState, readonly WeatherSoundCue[]] => {
  if (weather === 'clear') return [createWeatherSoundState(), []]

  const dt = clampDelta(deltaTime)
  const cues: WeatherSoundCue[] = []
  const enteringWetWeather = !isWetWeather(state.previousWeather)
  let rainCooldownSecs = enteringWetWeather ? 0 : state.rainCooldownSecs - dt

  if (rainCooldownSecs <= 0) {
    cues.push({
      effect: 'rainAmbient',
      gainScale: weather === 'thunder' ? 0.95 : 0.75,
    })
    rainCooldownSecs = RAIN_CUE_INTERVAL_SECS
  }

  let thunderCooldownSecs = THUNDER_INITIAL_DELAY_SECS
  if (weather === 'thunder') {
    const enteringThunder = state.previousWeather !== 'thunder'
    thunderCooldownSecs = (enteringThunder ? THUNDER_INITIAL_DELAY_SECS : state.thunderCooldownSecs) - dt

    if (thunderCooldownSecs <= 0) {
      cues.push({ effect: 'thunderAmbient', gainScale: 1 })
      thunderCooldownSecs = THUNDER_CUE_INTERVAL_SECS
    }
  }

  return [
    {
      previousWeather: weather,
      rainCooldownSecs,
      thunderCooldownSecs,
    },
    cues,
  ]
}
