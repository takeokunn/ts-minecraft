import { Layer } from 'effect'

import { TradingService } from '@ts-minecraft/entity/application/trading/trading-service'

import { InventoryLayer } from './game-logic-inventory-support-bundles'
import { VillageLayer } from './game-logic-village-layer-bundles'

export const TradingLayer = TradingService.Default.pipe(
  Layer.provide(VillageLayer),
  Layer.provide(InventoryLayer),
)
