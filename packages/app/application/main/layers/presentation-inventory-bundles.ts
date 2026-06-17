import { Layer } from 'effect'

import { DomOperationsService } from '@ts-minecraft/presentation'
import { InventoryRendererService } from '@ts-minecraft/presentation'
import { RecipeService } from '@ts-minecraft/inventory'
import { XPService } from '@ts-minecraft/entity'

import {
  GameLayer,
} from './game-logic-game-state-bundles'
import { InventoryLayer } from './game-logic-inventory-support-bundles'
import { ChestLayer } from './game-logic-inventory-chest-bundles'
import { FurnaceLayer } from './game-logic-inventory-furnace-bundles'
import { HotbarLayer } from './game-logic-inventory-hotbar-bundles'
import { ChunkManagerLayer as WorldChunkManagerLayer } from './game-logic-chunk-manager-bundles'

export const InventoryRendererLayer = InventoryRendererService.Default.pipe(
  Layer.provide(InventoryLayer),
  Layer.provide(HotbarLayer),
  Layer.provide(RecipeService.Default),
  Layer.provide(FurnaceLayer),
  Layer.provide(ChestLayer),
  Layer.provide(GameLayer),
  Layer.provide(WorldChunkManagerLayer),
  Layer.provide(XPService.Default),
  Layer.provide(DomOperationsService.Default),
)
