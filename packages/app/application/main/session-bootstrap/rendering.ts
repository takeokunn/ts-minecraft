import { Effect } from 'effect'
import { SceneService, PerspectiveCameraService, WorldRendererService, EntityRendererService, ChunkMeshService } from '@ts-minecraft/rendering'
import { ParticleSystemService } from '@ts-minecraft/rendering'

export const buildRenderingBootstrapServices = Effect.gen(function* () {
  const sceneService = yield* SceneService
  const cameraService = yield* PerspectiveCameraService
  const worldRendererService = yield* WorldRendererService
  const entityRenderer = yield* EntityRendererService
  const chunkMeshService = yield* ChunkMeshService
  const particleSystem = yield* ParticleSystemService

  return {
    sceneService,
    cameraService,
    worldRendererService,
    entityRenderer,
    chunkMeshService,
    particleSystem,
  }
})
