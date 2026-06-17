import { Layer } from 'effect'

import { HotbarRendererService } from '@ts-minecraft/presentation'
import { RendererService, TextureService } from '@ts-minecraft/rendering'

export const HotbarRendererLayer = HotbarRendererService.Default.pipe(
  Layer.provide(RendererService.Default),
  Layer.provide(TextureService.Default),
)
