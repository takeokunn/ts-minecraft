import type {
  DroppedItemRendererService,
  DroppedXpOrbRendererService,
  EntityRendererService,
  ParticleSystemService,
} from '@ts-minecraft/rendering'

export type FrameRenderingServices = {
  readonly droppedItemRenderer: DroppedItemRendererService
  readonly droppedXpOrbRenderer: DroppedXpOrbRendererService
  readonly entityRenderer: EntityRendererService
  readonly particleSystem: ParticleSystemService
}
