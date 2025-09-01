import * as THREE from 'three'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Ref from 'effect/Ref'
import { pipe } from 'effect/Function'
import { match } from 'ts-pattern'
import { RenderCommand, RenderQueue } from '@/domain/types'
import { World } from '@/runtime/world'
import { ThreeCameraService } from './camera-three'
import { RaycastResultService, RendererService, ThreeContextService } from '@/runtime/loop'
import { playerQuery } from '@/domain/queries'

// --- Live Implementation ---

export const RendererLive = Layer.effect(
  RendererService,
  Effect.gen(function* () {
    const world = yield* World
    const cameraService = yield* ThreeCameraService
    const raycastResultRef = yield* RaycastResultService
    const context = yield* ThreeContextService

    const handleUpsertChunk = (command: Extract<RenderCommand, { type: 'UpsertChunk' }>, material: THREE.Material) =>
      Effect.sync(() => {
        const { scene, chunkMeshes } = context
        const { chunkX, chunkZ, mesh: meshData } = command
        const chunkId = `${chunkX},${chunkZ}`

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

    const processRenderQueue = (queue: RenderQueue, material: THREE.Material) =>
      Effect.gen(function* () {
        const commands = queue.splice(0, queue.length)
        yield* Effect.forEach(
          commands,
          (command) =>
            match(command)
              .with({ type: 'UpsertChunk' }, (cmd) => handleUpsertChunk(cmd, material))
              .with({ type: 'RemoveChunk' }, (cmd) => handleRemoveChunk(cmd))
              .exhaustive(),
          { discard: true },
        )
      })

    const syncCameraToWorld = Effect.gen(function* () {
      const players = yield* world.query(playerQuery)
      const player = players[0]
      if (player) {
        yield* cameraService.syncToComponent(player.position, player.cameraState)
      }
    })

    const updateHighlight = Effect.gen(function* () {
      const raycastResult = yield* Ref.get(raycastResultRef)
      const positionOption = yield* pipe(
        raycastResult,
        Option.map((result) => world.getComponent(result.entityId, 'position')),
        Effect.all,
        Effect.map(Option.flatten),
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

    return RendererService.of({
      processRenderQueue: (queue, material) => processRenderQueue(queue, material),
      syncCameraToWorld,
      updateHighlight,
      updateInstancedMeshes,
      renderScene,
    })
  }),
)
