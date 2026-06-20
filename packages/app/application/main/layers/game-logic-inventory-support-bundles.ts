import { Layer } from 'effect'

import { BlockRegistry } from '@ts-minecraft/block/application/block-registry'
import { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'

export const InventoryLayer = InventoryService.Default.pipe(
  Layer.provide(BlockRegistry.Default),
)
