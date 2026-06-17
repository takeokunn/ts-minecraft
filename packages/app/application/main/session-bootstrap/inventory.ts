import { Effect } from 'effect'
import { ChestService, EquipmentService, FurnaceService, HotbarService, InventoryService, RecipeService } from '@ts-minecraft/inventory'
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
