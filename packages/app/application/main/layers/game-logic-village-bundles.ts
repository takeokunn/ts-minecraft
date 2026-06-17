import { Layer } from 'effect'

import { TradingLayer } from './game-logic-trading-bundles'
import { VillageLayer } from './game-logic-village-layer-bundles'

export const VillageServiceLayers = VillageLayer.pipe(
  Layer.provideMerge(TradingLayer),
)
