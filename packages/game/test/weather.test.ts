import { describe, expect, it } from 'vitest'
import {
  CLEAR_DURATION_RANGE_SECS,
  RAIN_AFTER_THUNDER_CHANCE,
  RAIN_DURATION_RANGE_SECS,
  THUNDER_AFTER_CLEAR_CHANCE,
  THUNDER_AFTER_RAIN_CHANCE,
  THUNDER_DURATION_RANGE_SECS,
  createWeatherState,
  resolveNextWeatherState,
  resolveWeatherDurationSecs,
} from '../domain/weather'

describe('resolveWeatherDurationSecs', () => {
  it('resolves inclusive vanilla-like duration ranges from random rolls', () => {
    expect(resolveWeatherDurationSecs('clear', 0)).toBe(CLEAR_DURATION_RANGE_SECS.min)
    expect(resolveWeatherDurationSecs('clear', 1)).toBe(CLEAR_DURATION_RANGE_SECS.max)
    expect(resolveWeatherDurationSecs('rain', -1)).toBe(RAIN_DURATION_RANGE_SECS.min)
    expect(resolveWeatherDurationSecs('thunder', 2)).toBe(THUNDER_DURATION_RANGE_SECS.max)
  })
})

describe('createWeatherState', () => {
  it('assigns a randomized duration for the selected weather', () => {
    expect(createWeatherState('rain', 0)).toEqual({
      weather: 'rain',
      remainingSecs: RAIN_DURATION_RANGE_SECS.min,
    })
  })
})

describe('resolveNextWeatherState', () => {
  it('can transition clear weather directly to thunder', () => {
    expect(resolveNextWeatherState('clear', THUNDER_AFTER_CLEAR_CHANCE - 0.01, 0)).toEqual({
      weather: 'thunder',
      remainingSecs: THUNDER_DURATION_RANGE_SECS.min,
    })
  })

  it('transitions clear weather to rain when the thunder roll misses', () => {
    expect(resolveNextWeatherState('clear', THUNDER_AFTER_CLEAR_CHANCE, 1)).toEqual({
      weather: 'rain',
      remainingSecs: RAIN_DURATION_RANGE_SECS.max,
    })
  })

  it('transitions rain to thunder when the thunder roll succeeds', () => {
    expect(resolveNextWeatherState('rain', THUNDER_AFTER_RAIN_CHANCE - 0.01, 0)).toEqual({
      weather: 'thunder',
      remainingSecs: THUNDER_DURATION_RANGE_SECS.min,
    })
  })

  it('transitions rain back to clear when the thunder roll misses', () => {
    expect(resolveNextWeatherState('rain', THUNDER_AFTER_RAIN_CHANCE, 1)).toEqual({
      weather: 'clear',
      remainingSecs: CLEAR_DURATION_RANGE_SECS.max,
    })
  })

  it('can transition thunder weather back to rain', () => {
    expect(resolveNextWeatherState('thunder', RAIN_AFTER_THUNDER_CHANCE - 0.01, 0)).toEqual({
      weather: 'rain',
      remainingSecs: RAIN_DURATION_RANGE_SECS.min,
    })
  })

  it('transitions thunder weather back to clear when the rain roll misses', () => {
    expect(resolveNextWeatherState('thunder', RAIN_AFTER_THUNDER_CHANCE, 0)).toEqual({
      weather: 'clear',
      remainingSecs: CLEAR_DURATION_RANGE_SECS.min,
    })
  })
})
