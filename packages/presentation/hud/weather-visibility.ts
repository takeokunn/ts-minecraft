import type { Weather } from '@ts-minecraft/game'

export const WEATHER_RAIN_CLASS = 'weather-rain'
export const WEATHER_THUNDER_CLASS = 'weather-thunder'

const getDocumentBody = (): HTMLElement | null => {
  if (typeof document === 'undefined') {
    return null
  }

  return document.body
}

export const setWeatherVisualState = (weather: Weather, enabled = true): void => {
  const body = getDocumentBody()
  if (body === null) {
    return
  }

  body.classList.toggle(WEATHER_RAIN_CLASS, enabled && weather === 'rain')
  body.classList.toggle(WEATHER_THUNDER_CLASS, enabled && weather === 'thunder')
}
