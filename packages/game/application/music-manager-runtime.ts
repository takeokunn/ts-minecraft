import { Effect, Option, Ref } from 'effect'
import type { Position } from '@ts-minecraft/core'

import { clamp01 } from '../domain/audio-utils'
import type { AudioEnginePortShape } from '../domain/audio-engine-port'

import { DEFAULT_CAVE_THRESHOLD_Y, TRACKS } from './music-manager.config'
import { resolveMusicEnvironment } from './music-manager-environment'
import { resolveMusicPlaybackPlan, type ActiveTrack } from './music-manager-state'
import type { MusicEnvironment, MusicSettings } from './music-manager.types'

export interface MusicManagerRuntime {
  readonly applySettings: (settings: MusicSettings) => Effect.Effect<void, never>
  readonly setEnvironment: (environment: MusicEnvironment) => Effect.Effect<void, never>
  readonly updateFromContext: (context: {
    readonly isNight: boolean
    readonly playerPosition: Position
    readonly caveThresholdY?: number
  }) => Effect.Effect<void, never>
  readonly stop: () => Effect.Effect<void, never>
  readonly getCurrentEnvironment: () => Effect.Effect<Option.Option<MusicEnvironment>, never>
  readonly getState: () => Effect.Effect<
    {
      enabled: boolean
      masterVolume: number
      musicVolume: number
    },
    never
  >
}

export const createMusicManagerRuntime = (
  audioEngine: AudioEnginePortShape,
): Effect.Effect<MusicManagerRuntime, never> =>
  Effect.gen(function* () {
    const enabledRef = yield* Ref.make(true)
    const masterVolumeRef = yield* Ref.make(0.8)
    const musicVolumeRef = yield* Ref.make(0.55)
    const activeTrackRef = yield* Ref.make<Option.Option<ActiveTrack>>(Option.none())

    const stopActiveTrack = (): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const activeTrackOpt = yield* Ref.getAndSet(activeTrackRef, Option.none())
        const activeTrack = Option.getOrNull(activeTrackOpt)
        if (activeTrack !== null) yield* audioEngine.stopTone(activeTrack.handle)
      })

    const playEnvironmentTrack = (environment: MusicEnvironment): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        const enabled = yield* Ref.get(enabledRef)
        const activeTrack = yield* Ref.get(activeTrackRef)
        const playbackPlan = resolveMusicPlaybackPlan({
          enabled,
          activeTrack,
          environment,
        })

        if (playbackPlan.shouldStopActiveTrack) {
          yield* stopActiveTrack()
        }

        const nextEnvironment = Option.getOrNull(playbackPlan.environmentToPlay)
        if (nextEnvironment === null) {
          return
        }

        const track = TRACKS[nextEnvironment]
        // masterVolume is applied ONCE by the engine's master gain node (see
        // setMasterGain in applySettings); multiplying here too would square it.
        const musicVolume = yield* Ref.get(musicVolumeRef)
        const gain = clamp01(track.baseGain * musicVolume)
        const handle = yield* audioEngine.playTone({
          frequency: track.frequency,
          durationMs: 2000,
          gain,
          pan: 0,
          wave: track.wave,
          loop: true,
        })

        yield* Ref.set(activeTrackRef, Option.some({ environment, handle }))
      })

    return {
      applySettings: (settings: MusicSettings): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          yield* Ref.set(enabledRef, settings.enabled)
          yield* Ref.set(masterVolumeRef, settings.masterVolume)
          yield* Ref.set(musicVolumeRef, settings.musicVolume)
          yield* audioEngine.setMasterGain(settings.masterVolume)

          if (!settings.enabled) {
            yield* stopActiveTrack()
          }
        }),

      setEnvironment: (environment: MusicEnvironment): Effect.Effect<void, never> =>
        playEnvironmentTrack(environment),

      updateFromContext: (context: {
        readonly isNight: boolean
        readonly playerPosition: Position
        readonly caveThresholdY?: number
      }): Effect.Effect<void, never> =>
        playEnvironmentTrack(
          resolveMusicEnvironment({
            isNight: context.isNight,
            playerPosition: context.playerPosition,
            caveThresholdY: context.caveThresholdY ?? DEFAULT_CAVE_THRESHOLD_Y,
          }),
        ),

      stop: (): Effect.Effect<void, never> =>
        stopActiveTrack(),

      getCurrentEnvironment: (): Effect.Effect<Option.Option<MusicEnvironment>, never> =>
        Effect.gen(function* () {
          const trackOpt = yield* Ref.get(activeTrackRef)
          return Option.map(trackOpt, (track) => track.environment)
        }),

      getState: (): Effect.Effect<
        {
          enabled: boolean
          masterVolume: number
          musicVolume: number
        },
        never
      > =>
        Effect.gen(function* () {
          const enabled = yield* Ref.get(enabledRef)
          const masterVolume = yield* Ref.get(masterVolumeRef)
          const musicVolume = yield* Ref.get(musicVolumeRef)

          return {
            enabled,
            masterVolume,
            musicVolume,
          }
        }),
    }
  })
