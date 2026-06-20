import type { ChestService } from '@ts-minecraft/inventory/application/chest-service'
import type { EquipmentService } from '@ts-minecraft/inventory/application/equipment-service'
import type { FurnaceService } from '@ts-minecraft/inventory/application/furnace-service'
import type { HotbarService } from '@ts-minecraft/inventory/application/hotbar-service'
import type { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'

export type FrameInventoryServices = {
  readonly hotbarService: HotbarService
  readonly inventoryService: InventoryService
  readonly equipmentService: EquipmentService
  readonly chestService: ChestService
  readonly furnaceService: FurnaceService
}
