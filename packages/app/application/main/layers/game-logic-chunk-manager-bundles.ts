import { Layer } from 'effect'

import { ChunkManagerService, ChunkService } from '@ts-minecraft/world'

import {
  BiomeLayer,
  NoisePortLayer,
  StoragePortLayer,
  TerrainWorkerPoolPortLayer,
} from './infrastructure-bundles'
import { LightEngineLayer } from './game-logic-light-engine-bundles'

export const ChunkManagerLayer = ChunkManagerService.Default.pipe(
  Layer.provide(ChunkService.Default),
  Layer.provide(StoragePortLayer),
  Layer.provide(NoisePortLayer),
  Layer.provide(BiomeLayer),
  Layer.provide(LightEngineLayer),
  Layer.provide(TerrainWorkerPoolPortLayer),
)
