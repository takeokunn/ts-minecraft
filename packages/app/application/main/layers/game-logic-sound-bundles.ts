import { Layer } from 'effect'

import { SoundManager } from '@ts-minecraft/game'

import { AudioEnginePortServiceLayer, SoundCaptionPortServiceLayer } from './game-logic-audio-ports'

export const SoundLayer = SoundManager.Default.pipe(
  Layer.provide(AudioEnginePortServiceLayer),
  Layer.provide(SoundCaptionPortServiceLayer),
)
