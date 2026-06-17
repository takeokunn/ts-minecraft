import { Layer } from 'effect'

import { FluidService } from '@ts-minecraft/world'

import { ChunkManagerLayer } from './game-logic-chunk-manager-bundles'

export const FluidLayer = FluidService.Default.pipe(
  Layer.provide(ChunkManagerLayer),
)
