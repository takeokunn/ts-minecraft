import { Layer } from 'effect'

import { DroppedXpOrbService } from '@ts-minecraft/entity/application/dropped-xp-orb-service'
import { FishingService } from '@ts-minecraft/entity/application/fishing-service'
import { HealthService } from '@ts-minecraft/entity/application/health-service'
import { XPService } from '@ts-minecraft/entity/application/xp-service'
import { EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import { RecipeService } from '@ts-minecraft/inventory/application/recipe-service'
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
  Layer.provideMerge(DroppedXpOrbService.Default),
  Layer.provideMerge(FishingService.Default),
  Layer.provideMerge(GameModeService.Default),
)
