import { Effect, Ref } from 'effect'
import * as Option from 'effect/Option'
import type { Position } from '@ts-minecraft/core'
import { AudioEnginePort } from '../domain/audio-engine-port'
import { DEFAULT_LISTENER_POSITION } from './sound-manager.config'
import { resolveSoundEffectPlaybackRequest } from './sound-manager-playback'
import type { SoundEffect, SoundSettings } from './sound-manager.types'

export type { SoundEffect, SoundSettings }
export { SoundEffectSchema, SoundSettingsSchema } from './sound-manager.types'

export class SoundManager extends Effect.Service<SoundManager>()(
  '@minecraft/audio/SoundManager',
  {
    effect: Effect.gen(function* () {
      const audioEngine = yield* AudioEnginePort
      const enabledRef = yield* Ref.make(true)
      const masterVolumeRef = yield* Ref.make(0.8)
      const sfxVolumeRef = yield* Ref.make(1.0)
      const listenerPositionRef = yield* Ref.make<Position>(DEFAULT_LISTENER_POSITION)

      return {
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
            const listenerPosition = yield* Ref.get(listenerPositionRef)
            const sfxVolume = yield* Ref.get(sfxVolumeRef)
            const toneRequest = resolveSoundEffectPlaybackRequest({
              effect,
              enabled,
              listenerPosition,
              sfxVolume,
              ...(options?.position !== undefined ? { position: options.position } : {}),
              ...(options?.gainScale !== undefined ? { gainScale: options.gainScale } : {}),
            })
            const request = Option.getOrNull(toneRequest)
            if (request === null) {
              return
            }

            // NOTE: masterVolume is applied ONCE by the audio engine's master
            // gain node (set via setMasterGain in applySettings) — every tone is
            // routed through it. Multiplying by masterVolume here too would apply
            // it twice (masterVolume²), making sounds far too quiet at non-max
            // master. So finalGain carries only the per-effect/sfx factors.
            yield* audioEngine.playTone(request)
          }),

        getState: (): Effect.Effect<{
          enabled: boolean
          masterVolume: number
          sfxVolume: number
          listenerPosition: Position
        }, never> =>
          Effect.gen(function* () {
            const enabled = yield* Ref.get(enabledRef)
            const masterVolume = yield* Ref.get(masterVolumeRef)
            const sfxVolume = yield* Ref.get(sfxVolumeRef)
            const listenerPosition = yield* Ref.get(listenerPositionRef)

            return {
              enabled,
              masterVolume,
              sfxVolume,
              listenerPosition,
            }
          }),
      }
    }),
  },
) {}
