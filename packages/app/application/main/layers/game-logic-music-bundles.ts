import { Layer } from 'effect'

import { MusicManager } from '@ts-minecraft/game'

import { AudioEnginePortServiceLayer } from './game-logic-audio-ports'

export const MusicLayer = MusicManager.Default.pipe(
  Layer.provide(AudioEnginePortServiceLayer),
)
