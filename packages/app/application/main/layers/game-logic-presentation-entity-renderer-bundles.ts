import { Layer } from 'effect'

import { DroppedItemRendererService, EntityRendererService, SceneService } from '@ts-minecraft/rendering'

const DroppedItemRendererLayer = DroppedItemRendererService.Default.pipe(
  Layer.provide(SceneService.Default),
)

export const EntityRendererLayer = EntityRendererService.Default.pipe(
  Layer.provide(SceneService.Default),
  Layer.provideMerge(DroppedItemRendererLayer),
)
