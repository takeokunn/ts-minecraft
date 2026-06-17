import { Layer } from 'effect'

import { BlockService } from '@ts-minecraft/world'

import { EntityManagerLayer } from './game-logic-entity-manager-bundles'
import { InventoryServiceLayers } from './game-logic-inventory-bundles'
import { InventoryLayer } from './game-logic-inventory-support-bundles'
import { ChunkManagerLayer } from './game-logic-chunk-manager-bundles'
import { FluidLayer } from './game-logic-fluid-bundles'

const BlockDependencies = ChunkManagerLayer.pipe(
  Layer.provideMerge(FluidLayer),
).pipe(
  Layer.provideMerge(EntityManagerLayer),
).pipe(
  Layer.provideMerge(InventoryLayer),
).pipe(
  Layer.provideMerge(InventoryServiceLayers),
)

export const BlockLayer = BlockService.Default.pipe(
  Layer.provide(BlockDependencies),
)
