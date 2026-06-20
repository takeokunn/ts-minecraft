import type { SceneService, PerspectiveCameraService, WorldRendererService, EntityRendererService, ChunkMeshService, DroppedItemRendererService, DroppedXpOrbRendererService } from '@ts-minecraft/rendering'
import type { ParticleSystemService } from '@ts-minecraft/rendering'

export type SessionRenderingBootstrapServices = {
  readonly sceneService: SceneService
  readonly cameraService: PerspectiveCameraService
  readonly worldRendererService: WorldRendererService
  readonly droppedItemRenderer: DroppedItemRendererService
  readonly droppedXpOrbRenderer: DroppedXpOrbRendererService
  readonly entityRenderer: EntityRendererService
  readonly chunkMeshService: ChunkMeshService
  readonly particleSystem: ParticleSystemService
}
