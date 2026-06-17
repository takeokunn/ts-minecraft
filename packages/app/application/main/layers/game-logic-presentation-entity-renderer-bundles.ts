import { Layer } from 'effect'

import { EntityRendererService, SceneService } from '@ts-minecraft/rendering'

export const EntityRendererLayer = EntityRendererService.Default.pipe(
  Layer.provide(SceneService.Default),
)
