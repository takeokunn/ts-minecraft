import { Layer } from 'effect'

import { ChestService } from '@ts-minecraft/inventory/application/chest-service'

import { InventoryLayer } from './game-logic-inventory-support-bundles'
import { PlayerServicePortLayer, WorldBlockQueryPortLayer } from './game-logic-ports'

export const ChestLayer = ChestService.Default.pipe(
  Layer.provide(InventoryLayer),
  Layer.provide(PlayerServicePortLayer),
  Layer.provide(WorldBlockQueryPortLayer),
)
