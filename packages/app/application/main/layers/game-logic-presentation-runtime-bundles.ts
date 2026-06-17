import { Layer } from 'effect'

import { PresentationAudioLayers } from './game-logic-presentation-audio-bundles'
import { PresentationRendererLayers } from './game-logic-presentation-renderer-bundles'

export const PresentationRuntimeLayers = Layer.mergeAll(
  PresentationRendererLayers,
  PresentationAudioLayers,
)
