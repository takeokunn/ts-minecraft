import { Layer } from 'effect'

import { HotbarService } from '@ts-minecraft/inventory/application/hotbar-service'

import { InventoryLayer } from './game-logic-inventory-support-bundles'
import { PlayerInputLayer } from './game-logic-player-input-bundles'

export const HotbarLayer = HotbarService.Default.pipe(
  Layer.provide(PlayerInputLayer),
  Layer.provide(InventoryLayer),
)
