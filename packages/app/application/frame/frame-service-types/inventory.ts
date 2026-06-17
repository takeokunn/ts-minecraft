import type { ChestService, EquipmentService, FurnaceService, HotbarService, InventoryService } from '@ts-minecraft/inventory'

export type FrameInventoryServices = {
  readonly hotbarService: HotbarService
  readonly inventoryService: InventoryService
  readonly equipmentService: EquipmentService
  readonly chestService: ChestService
  readonly furnaceService: FurnaceService
}
