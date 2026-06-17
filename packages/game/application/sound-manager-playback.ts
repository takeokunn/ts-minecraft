import type { Position } from '@ts-minecraft/core'
import * as Option from 'effect/Option'
import type { ToneRequest } from '../domain/audio-types'
import { clamp01 } from '../domain/audio-utils'
import { computeSpatial } from '../domain/sound-spatial'
import { SOUND_LIBRARY } from './sound-manager.config'
import type { SoundEffect } from './sound-manager.types'

type SoundDefinition = (typeof SOUND_LIBRARY)[keyof typeof SOUND_LIBRARY]

export const resolveSoundEffectPlaybackRequest = (args: {
  readonly effect: SoundEffect
  readonly enabled: boolean
  readonly listenerPosition: Position
  readonly sfxVolume: number
  readonly position?: Position
  readonly gainScale?: number
}): Option.Option<ToneRequest> => {
  if (!args.enabled) {
    return Option.none()
  }

  const definition = SOUND_LIBRARY[args.effect] as SoundDefinition
  const spatial = args.position !== undefined
    ? computeSpatial(args.listenerPosition, args.position)
    : { gain: 1, pan: 0, position: undefined as undefined }

  return Option.some({
    frequency: definition.frequency,
    durationMs: definition.durationMs,
    gain: clamp01(
      definition.baseGain
      * args.sfxVolume
      * spatial.gain
      * Math.max(0, args.gainScale ?? 1),
    ),
    pan: spatial.pan,
    wave: definition.wave,
    loop: false,
    ...(spatial.position ? { position: spatial.position } : {}),
  })
}
