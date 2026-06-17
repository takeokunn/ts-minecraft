import { Layer } from 'effect'

import { FurnaceService, RecipeService } from '@ts-minecraft/inventory'

import { InventoryLayer } from './game-logic-inventory-support-bundles'
import { PlayerServicePortLayer, WorldBlockQueryPortLayer } from './game-logic-ports'

export const FurnaceLayer = FurnaceService.Default.pipe(
  Layer.provide(RecipeService.Default),
  Layer.provide(InventoryLayer),
  Layer.provide(PlayerServicePortLayer),
  Layer.provide(WorldBlockQueryPortLayer),
)
