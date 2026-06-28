import type { DeltaTimeSecs } from '@ts-minecraft/core'
import {
  collectWeatherSoundCues,
  createWeatherSoundState,
} from '@ts-minecraft/app/frame/stages/lighting-stage-weather-sound'
import { describe, expect, it } from 'vitest'

describe('lighting weather sound cues', () => {
  it('emits rain immediately when wet weather starts, then waits for cooldown', () => {
    const [raining, firstCues] = collectWeatherSoundCues(
      createWeatherSoundState(),
      'rain',
      0.016 as DeltaTimeSecs,
    )
    expect(firstCues).toEqual([{ effect: 'rainAmbient', gainScale: 0.75 }])

    const [, quietCues] = collectWeatherSoundCues(raining, 'rain', 0.2 as DeltaTimeSecs)
    expect(quietCues).toEqual([])
  })

  it('adds thunder after its initial delay and then repeats on the thunder interval', () => {
    const [thundering, firstCues] = collectWeatherSoundCues(
      createWeatherSoundState(),
      'thunder',
      0.016 as DeltaTimeSecs,
    )
    expect(firstCues).toEqual([{ effect: 'rainAmbient', gainScale: 0.95 }])

      const [settling, noCues] = collectWeatherSoundCues(
        thundering,
        'thunder',
        0.4 as DeltaTimeSecs,
      )
    expect(noCues).toEqual([])

      const [afterDelay, delayedCues] = collectWeatherSoundCues(
        settling,
        'thunder',
        1.2 as DeltaTimeSecs,
      )
    expect(delayedCues).toEqual([
      { effect: 'rainAmbient', gainScale: 0.95 },
      { effect: 'thunderAmbient', gainScale: 1 },
    ])

      const [, repeatCues] = collectWeatherSoundCues(
        afterDelay,
        'thunder',
        6.4 as DeltaTimeSecs,
      )
    expect(repeatCues).toEqual([
      { effect: 'rainAmbient', gainScale: 0.95 },
      { effect: 'thunderAmbient', gainScale: 1 },
    ])
  })

  it('resets cue cooldowns when weather clears', () => {
      const [raining] = collectWeatherSoundCues(
        createWeatherSoundState(),
        'rain',
        0.016 as DeltaTimeSecs,
      )
      const [cleared, clearCues] = collectWeatherSoundCues(
        raining,
        'clear',
        0.016 as DeltaTimeSecs,
      )
    expect(clearCues).toEqual([])

    const [, restartedCues] = collectWeatherSoundCues(cleared, 'rain', 0.016 as DeltaTimeSecs)
    expect(restartedCues).toEqual([{ effect: 'rainAmbient', gainScale: 0.75 }])
  })
})
