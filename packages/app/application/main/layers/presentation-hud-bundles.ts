import { Layer } from 'effect'

import { BlockHighlightPresentationLayer } from './presentation-hud-block-highlight-bundles'
import { CrosshairPresentationLayer } from './presentation-hud-crosshair-bundles'
import { HotbarRendererLayer } from './presentation-hud-hotbar-bundles'

export const HudPresentationLayers = CrosshairPresentationLayer.pipe(
  Layer.provideMerge(BlockHighlightPresentationLayer),
  Layer.provideMerge(HotbarRendererLayer),
)
