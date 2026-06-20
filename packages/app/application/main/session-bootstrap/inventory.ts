import { Effect } from 'effect'
import { ChestService } from '@ts-minecraft/inventory/application/chest-service'
import { EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import { FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'
import { HotbarService } from '@ts-minecraft/inventory/application/hotbar-service'
import { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import { RecipeService } from '@ts-minecraft/inventory/application/recipe-service'
import { InventoryRendererService } from '@ts-minecraft/presentation'

export const buildInventoryBootstrapServices = Effect.gen(function* () {
  const hotbarService = yield* HotbarService
  const inventoryRenderer = yield* InventoryRendererService
  const inventoryService = yield* InventoryService
  const equipmentService = yield* EquipmentService
  const recipeService = yield* RecipeService
  const chestService = yield* ChestService
  const furnaceService = yield* FurnaceService

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
