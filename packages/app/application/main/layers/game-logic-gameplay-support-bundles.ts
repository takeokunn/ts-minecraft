import { Layer } from 'effect'

import { FishingService, HealthService, XPService } from '@ts-minecraft/entity'
import { EquipmentService, RecipeService } from '@ts-minecraft/inventory'
import { GameModeService } from '@ts-minecraft/game'

import { GameLayer } from './game-logic-game-state-bundles'
import { InventoryLayer } from './game-logic-inventory-support-bundles'
import { InventoryServiceLayers } from './game-logic-inventory-bundles'

const InventorySupportLayers = InventoryLayer.pipe(
  Layer.provideMerge(InventoryServiceLayers),
)

export const GameplaySupportLayers = InventorySupportLayers.pipe(
  Layer.provideMerge(GameLayer),
  Layer.provideMerge(RecipeService.Default),
  Layer.provideMerge(EquipmentService.Default),
  Layer.provideMerge(HealthService.Default),
  Layer.provideMerge(XPService.Default),
  Layer.provideMerge(FishingService.Default),
  Layer.provideMerge(GameModeService.Default),
)
