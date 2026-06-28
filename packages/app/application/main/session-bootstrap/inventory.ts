import { Effect } from 'effect'
import { ChestService } from '@ts-minecraft/inventory/application/chest-service'
import { EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import { FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'
import { HotbarService } from '@ts-minecraft/inventory/application/hotbar-service'
import { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import { RecipeService } from '@ts-minecraft/inventory/application/recipe-service'
import { InventoryRendererService } from '@ts-minecraft/presentation'

export const buildInventoryBootstrapServices = Effect.gen(function* () {
  const [
    hotbarService,
    inventoryRenderer,
    inventoryService,
    equipmentService,
    recipeService,
    chestService,
    furnaceService,
  ] = yield* Effect.all([
    HotbarService,
    InventoryRendererService,
    InventoryService,
    EquipmentService,
    RecipeService,
    ChestService,
    FurnaceService,
  ], { concurrency: 'unbounded' })

  return {
    hotbarService,
    inventoryRenderer,
    inventoryService,
    equipmentService,
    recipeService,
    chestService,
    furnaceService,
  }
})
