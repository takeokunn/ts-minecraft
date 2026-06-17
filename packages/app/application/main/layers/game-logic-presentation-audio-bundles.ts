import { Layer } from 'effect'

import { MusicLayer } from './game-logic-music-bundles'
import { SoundLayer } from './game-logic-sound-bundles'

export const PresentationAudioLayers = SoundLayer.pipe(
  Layer.provideMerge(MusicLayer),
)
