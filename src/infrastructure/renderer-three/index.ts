import { Effect, Layer, Option, match } from 'effect'
import * as World from '@/domain/world'
import { playerQuery } from '@/domain/queries'
import { ThreeCameraService } from '../camera-three'
import { MaterialManager, RaycastResultService, RendererService, RenderQueue, ThreeContextService } from '@/runtime/services'
import { BufferGeometry, InstancedMesh, Mesh, NormalBufferAttributes } from 'three'


const makeRenderer = Effect.gen(function* (_) {
  const context = yield* _(ThreeContextService)
  const cameraService = yield* _(ThreeCameraService)
  const renderQueue = yield* _(RenderQueue)
  const raycastResult = yield* _(RaycastResultService)
  const materialManager = yield* _(MaterialManager)

  const handleUpsertChunk = (geometry: BufferGeometry<NormalBufferAttributes>) =>
    Effect.gen(function* (_) {
      const material = yield* _(materialManager.get('chunk'))
      const mesh = new Mesh(geometry, material)
      context.scene.add(mesh)
      context.chunkMeshes.set(`${geometry.uuid}`, mesh)
    })

  const handleRemoveChunk = (chunkId: string) =>
    Effect.sync(() => {
      const mesh = context.chunkMeshes.get(chunkId)
      if (mesh) {
        mesh.geometry.dispose()
        context.scene.remove(mesh)
        context.chunkMeshes.delete(chunkId)
      }
    })

  const processRenderQueue = Effect.gen(function* (_) {
    const commands = renderQueue.splice(0, renderQueue.length)
    yield* _(
      Effect.forEach(
        commands,
        (command) =>
          match(command)
            .with({ type: 'UpsertChunk' }, ({ mesh }) => handleUpsertChunk(mesh as any))
            .with({ type: 'RemoveChunk' }, ({ chunkId }) => handleRemoveChunk(chunkId))
            .exhaustive(),
        { discard: true },
      ),
    )
  })

  const syncCameraToWorld = Effect.gen(function* (_) {
    const players = yield* _(World.query(playerQuery))
    const player = Option.fromNullable(players[0])
    if (Option.isSome(player)) {
      yield* _(cameraService.syncToComponent(player.value))
    }
  })

  const updateHighlight = Effect.gen(function* (_) {
    const result = yield* _(Ref.get(raycastResult))
    const position = yield* _(
      Option.match(result, {
        onSome: (result) => World.getComponentOption(result.entityId, 'position'),
        onNone: () => Effect.succeed(Option.none()),
      }),
    )

    if (Option.isSome(position)) {
      context.highlightMesh.position.set(position.value.x, position.value.y, position.value.z)
      context.highlightMesh.visible = true
    } else {
      context.highlightMesh.visible = false
    }
  })

  const updateInstancedMeshes = Effect.sync(() => {
    context.instancedMeshes.forEach(() => {
      // This part needs to be implemented based on how instanced meshes are used.
      // For now, it's a placeholder.
    })
  })

  const renderScene = Effect.sync(() => {
    context.renderer.render(context.scene, cameraService.camera)
  })

  return {
    processRenderQueue,
    syncCameraToWorld,
    updateHighlight,
    updateInstancedMeshes,
    renderScene,
  }
})

export const RendererLive = Layer.effect(RendererService, makeRenderer)
