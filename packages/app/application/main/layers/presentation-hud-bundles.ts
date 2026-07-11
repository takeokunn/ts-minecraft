import { Layer } from 'effect'

import { BlockHighlightPresentationLayer } from './presentation-hud-block-highlight-bundles'
import { ControlsHintPresentationLayer } from './presentation-hud-controls-hint-bundles'
import { CrosshairPresentationLayer } from './presentation-hud-crosshair-bundles'
import { AchievementToastPresentationLayer, DamageOverlayPresentationLayer, DimensionFadePresentationLayer, SleepOverlayPresentationLayer } from './presentation-hud-damage-overlay-bundles'
import { HotbarRendererLayer } from './presentation-hud-hotbar-bundles'
import { TouchControlsPresentationLayer } from './presentation-hud-touch-controls-bundles'

export const HudPresentationLayers = CrosshairPresentationLayer.pipe(
  Layer.provideMerge(BlockHighlightPresentationLayer),
  Layer.provideMerge(ControlsHintPresentationLayer),
  Layer.provideMerge(DamageOverlayPresentationLayer),
  Layer.provideMerge(AchievementToastPresentationLayer),
  Layer.provideMerge(DimensionFadePresentationLayer),
  Layer.provideMerge(SleepOverlayPresentationLayer),
  Layer.provideMerge(HotbarRendererLayer),
  Layer.provideMerge(TouchControlsPresentationLayer),
)
