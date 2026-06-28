import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'
import { Effect, MutableRef } from 'effect'
import { describe, expect, it } from 'vitest'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'
import {
  applySurvivalWeatherSoundEffects,
  RAIN_AMBIENT_INTERVAL_SECS,
  THUNDER_CLAP_INTERVAL_SECS,
} from './weather-sound'

const makeSoundHarness = () => {
  const playEffectCalls: Array<readonly [string, unknown]> = []
  const services = {
    soundManager: {
      playEffect: (effectName: string, options: unknown) => {
        playEffectCalls.push([effectName, options])
        return Effect.void
      },
    },
  } as unknown as PhysicsStageServices
  const refs = {
    rainSoundAccumulatorRef: MutableRef.make(0),
    thunderSoundAccumulatorRef: MutableRef.make(0),
  } as unknown as PhysicsStageRefs

  return { services, refs, playEffectCalls }
}

describe('physics-stage-survival/weather-sound', () => {
  it('plays cadenced rain ambience during rain and keeps thunder inactive', async () => {
    const { services, refs, playEffectCalls } = makeSoundHarness()
    const position: Position = { x: 0, y: 64, z: 0 }

    await Effect.runPromise(
      applySurvivalWeatherSoundEffects(
        services,
        refs,
        (RAIN_AMBIENT_INTERVAL_SECS - 0.1) as DeltaTimeSecs,
        position,
        'rain',
      ),
    )
    expect(playEffectCalls).toEqual([])

    await Effect.runPromise(applySurvivalWeatherSoundEffects(services, refs, 0.1 as DeltaTimeSecs, position, 'rain'))

    expect(playEffectCalls).toEqual([['rainAmbient', { position, gainScale: 1 }]])
    expect(MutableRef.get(refs.thunderSoundAccumulatorRef)).toBe(0)
  })

  it('plays rain ambience and thunder clap during thunder on independent cadences', async () => {
    const { services, refs, playEffectCalls } = makeSoundHarness()
    const position: Position = { x: 4, y: 70, z: -2 }

    await Effect.runPromise(
      applySurvivalWeatherSoundEffects(services, refs, THUNDER_CLAP_INTERVAL_SECS as DeltaTimeSecs, position, 'thunder'),
    )

    expect(playEffectCalls).toEqual([
      ['rainAmbient', { position, gainScale: 1.1 }],
      ['thunderClap', { position, gainScale: 1.25 }],
    ])
  })

  it('resets accumulators when weather clears', async () => {
    const { services, refs, playEffectCalls } = makeSoundHarness()
    MutableRef.set(refs.rainSoundAccumulatorRef, 1.5)
    MutableRef.set(refs.thunderSoundAccumulatorRef, 6)

    await Effect.runPromise(
      applySurvivalWeatherSoundEffects(services, refs, 1 as DeltaTimeSecs, { x: 0, y: 64, z: 0 }, 'clear'),
    )

    expect(playEffectCalls).toEqual([])
    expect(MutableRef.get(refs.rainSoundAccumulatorRef)).toBe(0)
    expect(MutableRef.get(refs.thunderSoundAccumulatorRef)).toBe(0)
  })
})
