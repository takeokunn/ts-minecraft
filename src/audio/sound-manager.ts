import { Effect, Option, Ref, Schema } from 'effect'
import type { Position } from '@/shared/kernel'
import { AudioEngine, clamp01, clampPan, type OscillatorWave } from '@/audio/audio-engine'

export const SoundEffectSchema = Schema.Literal('blockBreak', 'blockPlace', 'playerHurt', 'entityHit')
export type SoundEffect = Schema.Schema.Type<typeof SoundEffectSchema>

export const SoundSettingsSchema = Schema.Struct({
  enabled: Schema.Boolean,
  masterVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
  sfxVolume: Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
})
export type SoundSettings = Schema.Schema.Type<typeof SoundSettingsSchema>

type SoundDefinition = {
  readonly frequency: number
  readonly durationMs: number
  readonly wave: OscillatorWave
  readonly baseGain: number
}

const SOUND_LIBRARY: Readonly<Record<SoundEffect, SoundDefinition>> = {
  blockBreak: { frequency: 220, durationMs: 70, wave: 'square', baseGain: 0.4 },
  blockPlace: { frequency: 320, durationMs: 50, wave: 'triangle', baseGain: 0.32 },
  playerHurt: { frequency: 140, durationMs: 120, wave: 'sawtooth', baseGain: 0.5 },
  entityHit: { frequency: 280, durationMs: 90, wave: 'square', baseGain: 0.38 },
}

const DEFAULT_LISTENER_POSITION: Position = { x: 0, y: 64, z: 0 }

const computeSpatial = (listener: Position, source: Position): { gain: number; pan: number } => {
  const dx = source.x - listener.x
  const dy = source.y - listener.y
  const dz = source.z - listener.z
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)

  const attenuation = 1 / (1 + distance / 12)
  const pan = clampPan(dx / 12)

  return { gain: attenuation, pan }
}

export class SoundManager extends Effect.Service<SoundManager>()(
  '@minecraft/audio/SoundManager',
  {
    effect: Effect.all([
      AudioEngine,
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
            const [listenerPosition, masterVolume, sfxVolume] = yield* Effect.all(
              [Ref.get(listenerPositionRef), Ref.get(masterVolumeRef), Ref.get(sfxVolumeRef)],
              { concurrency: 'unbounded' }
            )

            const spatial = Option.match(Option.fromNullable(options?.position), {
              onNone: () => ({ gain: 1, pan: 0 }),
              onSome: (pos) => computeSpatial(listenerPosition, pos),
            })

            const finalGain = clamp01(
              definition.baseGain
              * masterVolume
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
