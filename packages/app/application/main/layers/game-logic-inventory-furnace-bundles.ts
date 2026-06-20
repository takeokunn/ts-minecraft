import { Layer } from 'effect'

import { FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'
import { RecipeService } from '@ts-minecraft/inventory/application/recipe-service'

import { InventoryLayer } from './game-logic-inventory-support-bundles'
import { PlayerServicePortLayer, WorldBlockQueryPortLayer } from './game-logic-ports'

export const FurnaceLayer = FurnaceService.Default.pipe(
  Layer.provide(RecipeService.Default),
  Layer.provide(InventoryLayer),
  Layer.provide(PlayerServicePortLayer),
  Layer.provide(WorldBlockQueryPortLayer),
)
