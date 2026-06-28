import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'
import { accrueHazardTicks } from '@ts-minecraft/entity/domain/environment-hazard-resolution'
import type { Weather } from '@ts-minecraft/game'
import { Effect, MutableRef } from 'effect'
import type { PhysicsStageRefs } from '../physics-stage-types/refs'
import type { PhysicsStageServices } from '../physics-stage-types/services'

export const RAIN_AMBIENT_INTERVAL_SECS = 2.5
export const THUNDER_CLAP_INTERVAL_SECS = 12

type WeatherSoundInput = {
  readonly active: boolean
  readonly accumulatorRef: MutableRef.MutableRef<number>
  readonly deltaTime: DeltaTimeSecs
  readonly intervalSecs: number
  readonly play: () => Effect.Effect<void, never>
}

const applyCadencedWeatherSound = (input: WeatherSoundInput): Effect.Effect<void, never> => {
  if (!input.active) {
    MutableRef.set(input.accumulatorRef, 0)
    return Effect.void
  }

  const { acc, ticks } = accrueHazardTicks(
    MutableRef.get(input.accumulatorRef),
    input.deltaTime,
    input.intervalSecs,
  )
  MutableRef.set(input.accumulatorRef, acc)

  return ticks > 0 ? input.play() : Effect.void
}

export const applySurvivalWeatherSoundEffects = (
  services: Pick<PhysicsStageServices, 'soundManager'>,
  refs: Pick<PhysicsStageRefs, 'rainSoundAccumulatorRef' | 'thunderSoundAccumulatorRef'>,
  deltaTime: DeltaTimeSecs,
  refreshedPos: Position,
  weather: Weather,
): Effect.Effect<void, never> => {
  const raining = weather === 'rain' || weather === 'thunder'

  return applyCadencedWeatherSound({
    active: raining,
    accumulatorRef: refs.rainSoundAccumulatorRef,
    deltaTime,
    intervalSecs: RAIN_AMBIENT_INTERVAL_SECS,
    play: () =>
      services.soundManager.playEffect('rainAmbient', {
        position: refreshedPos,
        gainScale: weather === 'thunder' ? 1.1 : 1,
      }),
  }).pipe(
    Effect.flatMap(() =>
      applyCadencedWeatherSound({
        active: weather === 'thunder',
        accumulatorRef: refs.thunderSoundAccumulatorRef,
        deltaTime,
        intervalSecs: THUNDER_CLAP_INTERVAL_SECS,
        play: () =>
          services.soundManager.playEffect('thunderClap', {
            position: refreshedPos,
            gainScale: 1.25,
          }),
      }),
    ),
  )
}
