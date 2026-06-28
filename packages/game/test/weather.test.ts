import { describe, expect, it } from 'vitest'
import {
  CLEAR_DURATION_SECS,
  RAIN_DURATION_SECS,
  THUNDER_AFTER_RAIN_CHANCE,
  THUNDER_DURATION_SECS,
  resolveNextWeatherState,
} from '../domain/weather'

describe('resolveNextWeatherState', () => {
  it('transitions clear weather to rain', () => {
    expect(resolveNextWeatherState('clear')).toEqual({
      weather: 'rain',
      remainingSecs: RAIN_DURATION_SECS,
    })
  })

  it('transitions rain to thunder when the thunder roll succeeds', () => {
    expect(resolveNextWeatherState('rain', THUNDER_AFTER_RAIN_CHANCE - 0.01)).toEqual({
      weather: 'thunder',
      remainingSecs: THUNDER_DURATION_SECS,
    })
  })

  it('transitions rain back to clear when the thunder roll misses', () => {
    expect(resolveNextWeatherState('rain', THUNDER_AFTER_RAIN_CHANCE)).toEqual({
      weather: 'clear',
      remainingSecs: CLEAR_DURATION_SECS,
    })
  })

  it('transitions thunder back to clear', () => {
    expect(resolveNextWeatherState('thunder')).toEqual({
      weather: 'clear',
      remainingSecs: CLEAR_DURATION_SECS,
    })
  })
})
