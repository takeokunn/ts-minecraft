import type { HotbarService, InventoryService, RecipeService, EquipmentService, ChestService, FurnaceService } from '@ts-minecraft/inventory'
import type { InventoryRendererService } from '@ts-minecraft/presentation'

export type SessionInventoryBootstrapServices = {
  readonly hotbarService: HotbarService
  readonly inventoryRenderer: InventoryRendererService
  readonly inventoryService: InventoryService
  readonly equipmentService: EquipmentService
  readonly recipeService: RecipeService
  readonly chestService: ChestService
  readonly furnaceService: FurnaceService
}
