import { describe, expect, it } from 'vitest'
import {
  setWeatherVisualState,
  WEATHER_RAIN_CLASS,
  WEATHER_THUNDER_CLASS,
} from '../hud/weather-visibility'

// Tests run in node environment (document === undefined).
// Functions must degrade gracefully without throwing.

describe('WEATHER_RAIN_CLASS and WEATHER_THUNDER_CLASS', () => {
  it('are distinct non-empty strings', () => {
    expect(WEATHER_RAIN_CLASS.length).toBeGreaterThan(0)
    expect(WEATHER_THUNDER_CLASS.length).toBeGreaterThan(0)
    expect(WEATHER_RAIN_CLASS).not.toBe(WEATHER_THUNDER_CLASS)
  })
})

describe('setWeatherVisualState — no DOM', () => {
  it('does not throw for rain weather', () => {
    expect(() => setWeatherVisualState('rain')).not.toThrow()
  })

  it('does not throw for thunder weather', () => {
    expect(() => setWeatherVisualState('thunder')).not.toThrow()
  })

  it('does not throw when disabled', () => {
    expect(() => setWeatherVisualState('rain', false)).not.toThrow()
  })

  it('does not throw for clear weather', () => {
    expect(() => setWeatherVisualState('clear')).not.toThrow()
  })
})
