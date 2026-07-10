import type { Effect } from 'effect'
import { Context } from 'effect'
import type { SoundEffect } from './sound-manager.types'

// Presentation sink for sound-cue captions (hearing accessibility). Keeps the
// app layer DOM-free: the DOM caption HUD lives in @ts-minecraft/presentation
// and is bridged in via this port, mirroring AudioEnginePort.
export type SoundCaptionPortShape = {
  readonly announce: (effect: SoundEffect) => Effect.Effect<void, never>
}

export class SoundCaptionPort extends Context.Tag('@minecraft/audio/SoundCaptionPort')<
  SoundCaptionPort,
  SoundCaptionPortShape
>() {}
