import type {
  DroppedItemRendererService,
  DroppedXpOrbRendererService,
  EntityRendererService,
  ParticleSystemService,
  RemotePlayerRenderer,
  VehicleVisual,
} from '@ts-minecraft/rendering'

export type FrameRenderingServices = {
  readonly droppedItemRenderer: DroppedItemRendererService
  readonly droppedXpOrbRenderer: DroppedXpOrbRendererService
  readonly entityRenderer: EntityRendererService
  readonly particleSystem: ParticleSystemService
  readonly remotePlayerRenderer: RemotePlayerRenderer
  readonly vehicleVisual: VehicleVisual
}
