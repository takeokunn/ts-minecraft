import { Layer } from 'effect'

import { BlockRegistry } from '@ts-minecraft/block'
import { InventoryService } from '@ts-minecraft/inventory'

export const InventoryLayer = InventoryService.Default.pipe(
  Layer.provide(BlockRegistry.Default),
)
