import { Effect, Layer } from 'effect'

import { AudioEngine, AudioEnginePortLayer, SoundCaptionPort } from '@ts-minecraft/game'
import { announceSoundCaption } from '@ts-minecraft/presentation'

export const AudioEngineLayer = AudioEngine.Default

export const AudioEnginePortServiceLayer = AudioEnginePortLayer.pipe(
  Layer.provide(AudioEngineLayer),
)

// Bridges the DOM caption HUD (presentation) into the DOM-free SoundManager.
export const SoundCaptionPortServiceLayer = Layer.succeed(SoundCaptionPort, {
  announce: (effect) => Effect.sync(() => announceSoundCaption(effect)),
})
