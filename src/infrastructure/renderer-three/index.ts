import * as THREE from 'three'
import { Effect, Layer, Option, Ref, Array as A } from 'effect'
import { pipe } from 'effect/Function'
import { match } from 'ts-pattern'
import { playerQuery } from '@/domain/queries'
import { RenderCommand } from '@/domain/types'
import { MaterialManager, RaycastResultService, RendererService, RenderQueueService, ThreeContextService } from '@/runtime/services'
import * as World from '@/runtime/world-pure'
import { ThreeCameraService } from '../camera-three'

// --- Live Implementation ---

export const RendererLive = Layer.effect(
  RendererService,
  Effect.gen(function* (_) {
    const cameraService = yield* _(ThreeCameraService)
    const raycastResultRef = yield* _(RaycastResultService)
    const context = yield* _(ThreeContextService)
    const materialManager = yield* _(MaterialManager)
    const renderQueue = yield* _(RenderQueueService)

    const handleUpsertChunk = (command: Extract<RenderCommand, { type: 'UpsertChunk' }>) =>
      Effect.gen(function* (_) {
        const { scene, chunkMeshes } = context
        const { chunkX, chunkZ, mesh: meshData } = command
        const chunkId = `${chunkX},${chunkZ}`
        const material = yield* _(materialManager.get('atlas.png'))

        const mesh =
          chunkMeshes.get(chunkId) ??
          (() => {
            const newMesh = new THREE.Mesh(new THREE.BufferGeometry(), material)
            newMesh.name = `chunk-${chunkId}`
            newMesh.userData = { type: 'chunk' }
            scene.add(newMesh)
            chunkMeshes.set(chunkId, newMesh)
            return newMesh
          })()

        const geometry = mesh.geometry
        geometry.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3))
        geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3))
        geometry.setAttribute('uv', new THREE.BufferAttribute(meshData.uvs, 2))
        geometry.setIndex(new THREE.BufferAttribute(meshData.indices, 1))
        geometry.computeBoundingSphere()
      })

    const handleRemoveChunk = (command: Extract<RenderCommand, { type: 'RemoveChunk' }>) =>
      Effect.sync(() => {
        const { scene, chunkMeshes } = context
        const { chunkX, chunkZ } = command
        const chunkId = `${chunkX},${chunkZ}`
        const mesh = chunkMeshes.get(chunkId)
        if (mesh) {
          scene.remove(mesh)
          mesh.geometry.dispose()
          chunkMeshes.delete(chunkId)
        }
      })

    const processRenderQueue = Effect.gen(function* (_) {
      const commands = renderQueue.splice(0, renderQueue.length)
      yield* _(
        Effect.forEach(commands, (command) => match(command).with({ type: 'UpsertChunk' }, handleUpsertChunk).with({ type: 'RemoveChunk' }, handleRemoveChunk).exhaustive(), {
          discard: true,
        }),
      )
    }).pipe(Effect.catchAll((err) => Effect.logError('Failed to process render queue', err)))

    const syncCameraToWorld = Effect.gen(function* ($) {
      const players = yield* $(World.query(playerQuery))
      yield* $(
        A.get(players, 0),
        Option.match({
          onNone: () => Effect.void,
          onSome: (player) => {
            const { position, cameraState } = player
            return cameraService.syncToComponent(position.x, position.y, position.z, cameraState.pitch, cameraState.yaw)
          },
        }),
      )
    })

    const updateHighlight = Effect.gen(function* (_) {
      const raycastResult = yield* _(Ref.get(raycastResultRef))
      const positionOption = yield* _(
        pipe(
          raycastResult,
          Option.match({
            onNone: () => Effect.succeed(Option.none()),
            onSome: (result) => World.getComponentOption(result.entityId, 'position'),
          }),
        ),
      )

      context.highlightMesh.visible = Option.isSome(positionOption)
      if (Option.isSome(positionOption)) {
        const pos = positionOption.value
        context.highlightMesh.position.set(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5)
      }
    })

    const updateInstancedMeshes = Effect.sync(() => {
      // This logic can be migrated to be more Effect-ful if needed
    })

    const renderScene = Effect.sync(() => {
      context.stats.begin()
      context.renderer.render(context.scene, context.camera.camera)
      context.stats.end()
    })

    return {
      processRenderQueue,
      syncCameraToWorld,
      updateHighlight,
      updateInstancedMeshes,
      renderScene,
    }
  }),
)