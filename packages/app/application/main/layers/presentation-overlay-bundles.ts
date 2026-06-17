import { Layer } from 'effect'

import { InventoryRendererLayer } from './presentation-inventory-bundles'
import {
  SettingsPresentationLayers,
} from './presentation-overlay-settings-bundles'
import { PauseMenuLayer } from './presentation-pause-menu-bundles'
import { TradingPresentationLayer } from './presentation-trading-bundles'

export const OverlayPresentationLayers = SettingsPresentationLayers.pipe(
  Layer.provideMerge(InventoryRendererLayer),
  Layer.provideMerge(PauseMenuLayer),
  Layer.provideMerge(TradingPresentationLayer),
)
