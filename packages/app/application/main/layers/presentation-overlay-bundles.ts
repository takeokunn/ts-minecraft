import { Layer } from 'effect'

import { InventoryRendererLayer } from './presentation-inventory-bundles'
import { PauseMenuLayer } from './presentation-pause-menu-bundles'
import { TradingPresentationLayer } from './presentation-trading-bundles'
import { ConnectionPanelLayer } from './presentation-connection-panel-bundles'

export const OverlayPresentationLayers = InventoryRendererLayer.pipe(
  Layer.provideMerge(PauseMenuLayer),
  Layer.provideMerge(TradingPresentationLayer),
  Layer.provideMerge(ConnectionPanelLayer),
)
