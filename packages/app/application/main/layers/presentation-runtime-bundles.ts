import { Layer } from 'effect'

import { CameraPresentationLayers } from './presentation-camera-bundles'
import { HudPresentationLayers } from './presentation-hud-bundles'
import { DebugOverlayLayer } from './presentation-debug-overlay-bundles'
import { FPSCounterLayer } from './presentation-fps-counter-bundles'

export const RuntimePresentationLayers = HudPresentationLayers.pipe(
  Layer.provideMerge(CameraPresentationLayers),
  Layer.provideMerge(DebugOverlayLayer),
  Layer.provideMerge(FPSCounterLayer),
)
