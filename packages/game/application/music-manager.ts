import { Effect, Option, Ref } from 'effect'
import type { Position } from '@ts-minecraft/core'
import { AudioEnginePort } from '../domain/audio-engine-port'
import { clamp01 } from '../domain/audio-utils'
import type { ToneHandle } from '../domain/audio-types'
import { TRACKS, DEFAULT_CAVE_THRESHOLD_Y } from './music-manager.config'
import type { MusicEnvironment, MusicSettings } from './music-manager.types'

export type { MusicEnvironment, MusicSettings }
export { MusicEnvironmentSchema, MusicSettingsSchema } from './music-manager.types'

const environmentFromContext = (
  isNight: boolean,
  playerPosition: Position,
  caveThresholdY: number,
): MusicEnvironment => {
  if (playerPosition.y < caveThresholdY) return 'cave'
  return isNight ? 'night' : 'day'
}


type ActiveTrack = {
  readonly environment: MusicEnvironment
  readonly handle: ToneHandle
}

export class MusicManager extends Effect.Service<MusicManager>()(
  '@minecraft/audio/MusicManager',
  {
    effect: Effect.all([
      AudioEnginePort,
      Ref.make(true),
      Ref.make(0.8),
      Ref.make(0.55),
      Ref.make<Option.Option<ActiveTrack>>(Option.none()),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([audioEngine, enabledRef, masterVolumeRef, musicVolumeRef, activeTrackRef]) => {
      const stopActiveTrack = (): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const activeTrackOpt = yield* Ref.getAndSet(activeTrackRef, Option.none())
          yield* Option.match(activeTrackOpt, {
            onNone: () => Effect.void,
            onSome: (activeTrack) => audioEngine.stopTone(activeTrack.handle),
          })
        })

      const playEnvironmentTrack = (environment: MusicEnvironment): Effect.Effect<void, never> =>
        Effect.gen(function* () {
          const enabled = yield* Ref.get(enabledRef)
          if (!enabled) {
            yield* stopActiveTrack()
            return
          }

          const currentTrackOpt = yield* Ref.get(activeTrackRef)
          if (Option.exists(currentTrackOpt, (track) => track.environment === environment)) {
            return
          }

          yield* stopActiveTrack()

          const track = TRACKS[environment]
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
            environmentFromContext(
              context.isNight,
              context.playerPosition,
              Option.getOrElse(Option.fromNullable(context.caveThresholdY), () => DEFAULT_CAVE_THRESHOLD_Y),
            )
          ),

        stop: (): Effect.Effect<void, never> =>
          stopActiveTrack(),

        getCurrentEnvironment: (): Effect.Effect<Option.Option<MusicEnvironment>, never> =>
          Ref.get(activeTrackRef).pipe(
            Effect.map((trackOpt) => Option.map(trackOpt, (track) => track.environment))
          ),

        getState: (): Effect.Effect<{
          enabled: boolean
          masterVolume: number
          musicVolume: number
        }, never> =>
          Effect.gen(function* () {
            const [enabled, masterVolume, musicVolume] = yield* Effect.all([
              Ref.get(enabledRef),
              Ref.get(masterVolumeRef),
              Ref.get(musicVolumeRef),
            ], { concurrency: 'unbounded' })

            return {
              enabled,
              masterVolume,
              musicVolume,
            }
          }),
      }
    }))
  },
) {}

export const MusicManagerLive = MusicManager.Default
