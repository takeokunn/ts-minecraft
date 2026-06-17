import type {
  EntityRendererService,
  ParticleSystemService,
} from '@ts-minecraft/rendering'

export type FrameRenderingServices = {
  readonly entityRenderer: EntityRendererService
  readonly particleSystem: ParticleSystemService
}
