import { Layer } from 'effect'

import { SoundManager } from '@ts-minecraft/game'

import { AudioEnginePortServiceLayer } from './game-logic-audio-ports'

export const SoundLayer = SoundManager.Default.pipe(
  Layer.provide(AudioEnginePortServiceLayer),
)
