import { Layer } from 'effect'

import { TradingPresentationService } from '@ts-minecraft/presentation'
import { DomOperationsService } from '@ts-minecraft/presentation'

import { TradingLayer } from './game-logic-trading-bundles'
import { VillageLayer } from './game-logic-village-layer-bundles'

export const TradingPresentationLayer = TradingPresentationService.Default.pipe(
  Layer.provide(TradingLayer),
  Layer.provide(VillageLayer),
  Layer.provide(DomOperationsService.Default),
)
