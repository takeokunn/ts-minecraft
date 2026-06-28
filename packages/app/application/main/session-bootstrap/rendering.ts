import { Effect } from 'effect'
import { SceneService, PerspectiveCameraService, WorldRendererService, EntityRendererService, ChunkMeshService, DroppedItemRendererService, DroppedXpOrbRendererService } from '@ts-minecraft/rendering'
import { ParticleSystemService } from '@ts-minecraft/rendering'

export const buildRenderingBootstrapServices = Effect.gen(function* () {
  const [
    sceneService,
    cameraService,
    worldRendererService,
    droppedItemRenderer,
    droppedXpOrbRenderer,
    entityRenderer,
    chunkMeshService,
    particleSystem,
  ] = yield* Effect.all([
    SceneService,
    PerspectiveCameraService,
    WorldRendererService,
    DroppedItemRendererService,
    DroppedXpOrbRendererService,
    EntityRendererService,
    ChunkMeshService,
    ParticleSystemService,
  ], { concurrency: 'unbounded' })

  return {
    sceneService,
    cameraService,
    worldRendererService,
    droppedItemRenderer,
    droppedXpOrbRenderer,
    entityRenderer,
    chunkMeshService,
    particleSystem,
  }
})
