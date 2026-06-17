import { Layer } from 'effect'

import { ChestLayer } from './game-logic-inventory-chest-bundles'
import { FurnaceLayer } from './game-logic-inventory-furnace-bundles'
import { HotbarLayer } from './game-logic-inventory-hotbar-bundles'

export const InventoryServiceLayers = HotbarLayer.pipe(
  Layer.provideMerge(FurnaceLayer),
  Layer.provideMerge(ChestLayer),
)
