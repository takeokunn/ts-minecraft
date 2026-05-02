import { Context, Effect } from 'effect'
import type { ToneHandle, ToneRequest } from './audio-types'

export type AudioEnginePortShape = {
  readonly playTone: (request: ToneRequest) => Effect.Effect<ToneHandle, never>
  readonly stopTone: (handle: ToneHandle) => Effect.Effect<void, never>
  readonly setMasterGain: (gain: number) => Effect.Effect<void, never>
}

export class AudioEnginePort extends Context.Tag('@minecraft/audio/AudioEnginePort')<
  AudioEnginePort,
  AudioEnginePortShape
>() {}
