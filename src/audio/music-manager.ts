import { Effect, Option, Ref, Schema } from 'effect'
import type { Position } from '@/shared/kernel'
import { AudioEngine, clamp01, type OscillatorWave, type ToneHandle } from '@/audio/audio-engine'

export const MusicEnvironmentSchema = Schema.Literal('day', 'night', 'cave')
export type MusicEnvironment = Schema.Schema.Type<typeof MusicEnvironmentSchema>

export const MusicSettingsSchema = Schema.Struct({
  enabled: Schema.Boolean,
  masterVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  musicVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
})
export type MusicSettings = Schema.Schema.Type<typeof MusicSettingsSchema>

type EnvironmentTrack = {
  readonly frequency: number
  readonly wave: OscillatorWave
  readonly baseGain: number
}

const TRACKS: Readonly<Record<MusicEnvironment, EnvironmentTrack>> = {
  day: { frequency: 174.61, wave: 'sine', baseGain: 0.28 },
  night: { frequency: 130.81, wave: 'triangle', baseGain: 0.24 },
  cave: { frequency: 98.0, wave: 'sawtooth', baseGain: 0.2 },
}

const DEFAULT_CAVE_THRESHOLD_Y = 40

const environmentFromContext = (
  isNight: boolean,
  playerPosition: Position,
  caveThresholdY: number,
): MusicEnvironment => {
  if (playerPosition.y < caveThresholdY) {
    return 'cave'
  }

  return isNight ? 'night' : 'day'
}

type ActiveTrack = {
  readonly environment: MusicEnvironment
  readonly handle: ToneHandle
}

export class MusicManager extends Effect.Service<MusicManager>()(
  '@minecraft/audio/MusicManager',
  {
    effect: Effect.gen(function* () {
      const audioEngine = yield* AudioEngine

      const enabledRef = yield* Ref.make(true)
      const masterVolumeRef = yield* Ref.make(0.8)
      const musicVolumeRef = yield* Ref.make(0.55)
      const activeTrackRef = yield* Ref.make<Option.Option<ActiveTrack>>(Option.none())

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
          const [masterVolume, musicVolume] = yield* Effect.all(
            [Ref.get(masterVolumeRef), Ref.get(musicVolumeRef)],
            { concurrency: 'unbounded' }
          )
          const gain = clamp01(track.baseGain * masterVolume * musicVolume)
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
    }),
  },
) {}

export const MusicManagerLive = MusicManager.Default
