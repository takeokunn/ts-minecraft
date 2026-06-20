import type {
  DroppedItemRendererService,
  EntityRendererService,
  ParticleSystemService,
} from '@ts-minecraft/rendering'

export type FrameRenderingServices = {
  readonly droppedItemRenderer: DroppedItemRendererService
  readonly entityRenderer: EntityRendererService
  readonly particleSystem: ParticleSystemService
}
