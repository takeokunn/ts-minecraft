import { Layer } from 'effect'

import { AudioEngine, AudioEnginePortLayer } from '@ts-minecraft/game'

export const AudioEngineLayer = AudioEngine.Default

export const AudioEnginePortServiceLayer = AudioEnginePortLayer.pipe(
  Layer.provide(AudioEngineLayer),
)
