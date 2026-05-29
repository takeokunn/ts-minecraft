import { Effect, Option, Ref, Schema } from 'effect'
import type { Position } from '@ts-minecraft/kernel'
import { AudioEnginePort } from '../domain/audio-engine-port'
import { clamp01, clampPan } from '../domain/audio-types'
import { SOUND_LIBRARY, DEFAULT_LISTENER_POSITION } from './sound-manager.config'

const computeSpatial = (listener: { x: number; y: number; z: number }, source: { x: number; y: number; z: number }): { gain: number; pan: number } => {
  const dx = source.x - listener.x
  const dy = source.y - listener.y
  const dz = source.z - listener.z
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
  const attenuation = 1 / (1 + distance / 12)
  const pan = clampPan(dx / 12)
  return { gain: attenuation, pan }
}

export const SoundEffectSchema = Schema.Literal('blockBreak', 'blockPlace', 'playerHurt', 'entityHit', 'mobHurt', 'mobDeath')
export type SoundEffect = Schema.Schema.Type<typeof SoundEffectSchema>

// Bidirectional lockstep between the schema union and the synth table. The
// schema→table direction is already enforced by `SOUND_LIBRARY[effect]` indexing
// in playEffect (a union member with no table key would be ill-typed). This
// `satisfies` clause adds the table→schema direction: a SOUND_LIBRARY key with
// no matching literal would make the table not assignable to the keyed record,
// so adding either side without the other is a tsc error.
SOUND_LIBRARY satisfies Record<SoundEffect, unknown>

export const SoundSettingsSchema = Schema.Struct({
  enabled: Schema.Boolean,
  masterVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  sfxVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
})
export type SoundSettings = Schema.Schema.Type<typeof SoundSettingsSchema>


export class SoundManager extends Effect.Service<SoundManager>()(
  '@minecraft/audio/SoundManager',
  {
    effect: Effect.all([
      AudioEnginePort,
      Ref.make(true),
      Ref.make(0.8),
      Ref.make(1.0),
      Ref.make<Position>(DEFAULT_LISTENER_POSITION),
    ], { concurrency: 'unbounded' }).pipe(Effect.map(([audioEngine, enabledRef, masterVolumeRef, sfxVolumeRef, listenerPositionRef]) => ({
        applySettings: (settings: SoundSettings): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            yield* Ref.set(enabledRef, settings.enabled)
            yield* Ref.set(masterVolumeRef, settings.masterVolume)
            yield* Ref.set(sfxVolumeRef, settings.sfxVolume)
            yield* audioEngine.setMasterGain(settings.masterVolume)
          }),

        setListenerPosition: (position: Position): Effect.Effect<void, never> =>
          Ref.set(listenerPositionRef, position),

        playEffect: (
          effect: SoundEffect,
          options?: {
            readonly position?: Position
            readonly gainScale?: number
          },
        ): Effect.Effect<void, never> =>
          Effect.gen(function* () {
            const enabled = yield* Ref.get(enabledRef)
            if (!enabled) {
              return
            }

            const definition = SOUND_LIBRARY[effect]
            const [listenerPosition, sfxVolume] = yield* Effect.all(
              [Ref.get(listenerPositionRef), Ref.get(sfxVolumeRef)],
              { concurrency: 'unbounded' }
            )

            const spatial = Option.match(Option.fromNullable(options?.position), {
              onNone: () => ({ gain: 1, pan: 0 }),
              onSome: (pos) => computeSpatial(listenerPosition, pos),
            })

            // NOTE: masterVolume is applied ONCE by the audio engine's master
            // gain node (set via setMasterGain in applySettings) — every tone is
            // routed through it. Multiplying by masterVolume here too would apply
            // it twice (masterVolume²), making sounds far too quiet at non-max
            // master. So finalGain carries only the per-effect/sfx factors.
            const finalGain = clamp01(
              definition.baseGain
              * sfxVolume
              * spatial.gain
              * clamp01(Option.getOrElse(Option.fromNullable(options?.gainScale), () => 1)),
            )

            yield* audioEngine.playTone({
              frequency: definition.frequency,
              durationMs: definition.durationMs,
              gain: finalGain,
              pan: spatial.pan,
              wave: definition.wave,
              loop: false,
            })
          }),

        getState: (): Effect.Effect<{
          enabled: boolean
          masterVolume: number
          sfxVolume: number
          listenerPosition: Position
        }, never> =>
          Effect.gen(function* () {
            const [enabled, masterVolume, sfxVolume, listenerPosition] = yield* Effect.all([
              Ref.get(enabledRef),
              Ref.get(masterVolumeRef),
              Ref.get(sfxVolumeRef),
              Ref.get(listenerPositionRef),
            ], { concurrency: 'unbounded' })

            return {
              enabled,
              masterVolume,
              sfxVolume,
              listenerPosition,
            }
          }),
    })))
  },
) {}

export const SoundManagerLive = SoundManager.Default
