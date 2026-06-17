import { Layer } from 'effect'

import { ChunkMeshService, SceneService, WorldRendererService } from '@ts-minecraft/rendering'

export const WorldRendererLayer = WorldRendererService.Default.pipe(
  Layer.provide(ChunkMeshService.Default),
  Layer.provide(SceneService.Default),
)
