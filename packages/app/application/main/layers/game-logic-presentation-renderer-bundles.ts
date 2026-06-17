import { Layer } from 'effect'

import { EntityRendererLayer } from './game-logic-presentation-entity-renderer-bundles'
import { ParticleSystemLayer } from './game-logic-presentation-particle-system-bundles'
import { WorldRendererLayer } from './game-logic-presentation-world-renderer-bundles'

export const PresentationRendererLayers = WorldRendererLayer.pipe(
  Layer.provideMerge(EntityRendererLayer),
  Layer.provideMerge(ParticleSystemLayer),
)
