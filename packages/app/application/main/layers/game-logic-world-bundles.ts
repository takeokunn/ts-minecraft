import { Layer } from 'effect'

import { BlockLayer } from './game-logic-block-bundles'
import { CropGrowthLayer } from './game-logic-crop-growth-bundles'
import { NetherLayer } from './game-logic-nether-bundles'
import { TradingLayer } from './game-logic-trading-bundles'
import { RedstoneLayer } from './game-logic-redstone-bundles'
import { VillageLayer } from './game-logic-village-layer-bundles'
import { WeatherLayer } from './game-logic-weather-bundles'

export const WorldServiceLayers = BlockLayer.pipe(
  Layer.provideMerge(VillageLayer),
  Layer.provideMerge(TradingLayer),
  Layer.provideMerge(RedstoneLayer),
  Layer.provideMerge(NetherLayer),
  Layer.provideMerge(WeatherLayer),
  Layer.provideMerge(CropGrowthLayer),
)
