import * as THREE from 'three'
import { Effect, Layer, Option, Ref, Array as A } from 'effect'
import { pipe } from 'effect/Function'
import { match } from 'ts-pattern'
import { playerQuery } from '@/domain/queries'
import { RenderCommand } from '@/domain/types'
import { MaterialManager, RaycastResultService, RendererService, RenderQueueService, ThreeContextService } from '@/runtime/services'
import * as World from '@/domain/world'
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

      import * as THREE from 'three'
import { Effect, Layer, Option, Ref, Array as A } from 'effect'
import { pipe } from 'effect/Function'
import { match } from 'ts-pattern'
import { playerQuery } from '@/domain/queries'
import { RenderCommand } from '@/domain/types'
import { MaterialManager, RaycastResultService, RendererService, RenderQueueService, ThreeContextService } from '@/runtime/services'
import * as World from '@/domain/world'
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

        const mesh = yield* _(
          pipe(
            Effect.sync(() => Option.fromNullable(chunkMeshes.get(chunkId))),
            Effect.flatMap(
              Option.match({
                onNone: () =>
                  Effect.sync(() => {
                    const newMesh = new THREE.Mesh(new THREE.BufferGeometry(), material)
                    newMesh.name = `chunk-${chunkId}`
                    newMesh.userData = { type: 'chunk' }
                    scene.add(newMesh)
                    chunkMeshes.set(chunkId, newMesh)
                    return newMesh
                  }),
                onSome: Effect.succeed,
              }),
            ),
          ),
        )

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
        pipe(
          Option.fromNullable(chunkMeshes.get(chunkId)),
          Option.map((mesh) => {
            scene.remove(mesh)
            mesh.geometry.dispose()
            chunkMeshes.delete(chunkId)
          }),
        )
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

    const renderScene = Effect.try({
      try: () => {
        context.stats.begin()
        context.renderer.render(context.scene, context.camera.camera)
        context.stats.end()
      },
      catch: (unknown) => new Error(`Failed to render scene: ${unknown}`),
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

      if (Option.isSome(positionOption)) {
        const pos = positionOption.value
        context.highlightMesh.position.set(pos.x + 0.5, pos.y + 0.5, pos.z + 0.5)
      }
    })

    const updateInstancedMeshes = Effect.sync(() => {
      // This logic can be migrated to be more Effect-ful if needed
    })

    import { Effect, Layer, Match } from 'effect'
import * as THREE from 'three'
import { BlockType } from '@/domain/block'
import { Chunk } from '@/domain/components'
import { ChunkGenerationResult } from '@/domain/types'
import { MaterialManager } from '../material-manager'
import { Renderer } from '../types'
import { ThreeContext } from './context'

const GEOMETRY_MAP = {
  box: new THREE.BoxGeometry(1, 1, 1),
}

const createInstancedMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, count: number) => {
  const mesh = new THREE.InstancedMesh(geometry, material, count)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  return mesh
}

const createChunkMesh = (chunk: Chunk, result: ChunkGenerationResult, material: THREE.Material) => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(result.mesh.positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(result.mesh.normals, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(result.mesh.uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(result.mesh.indices, 1))
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = `chunk_${chunk.chunkX}_${chunk.chunkZ}`
  return mesh
}

const createTargetBlockMesh = (material: THREE.Material) => {
  const geometry = new THREE.BoxGeometry(1.01, 1.01, 1.01)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = 'targetBlock'
  return mesh
}

export const RendererLive = Layer.effect(
  Renderer,
  Effect.gen(function* ($) {
    const { scene, camera, renderer } = yield* $(ThreeContext)
    const materialManager = yield* $(MaterialManager)

    const render = Effect.sync(() => {
      renderer.render(scene, camera)
    })

    const setCameraAspectRatio = (aspect: number) =>
      Effect.sync(() => {
        camera.aspect = aspect
        camera.updateProjectionMatrix()
      })

    const setSize = (width: number, height: number) =>
      Effect.sync(() => {
        renderer.setSize(width, height)
      })

    const getDomElement = Effect.sync(() => renderer.domElement)

    const updateBlock = (blockType: BlockType, matrix: THREE.Matrix4, count: number) =>
      Effect.sync(() => {
        const geometry = GEOMETRY_MAP.box
        const material = materialManager.get(blockType)
        const mesh = createInstancedMesh(geometry, material, count)
        mesh.setMatrixAt(0, matrix)
        mesh.instanceMatrix.needsUpdate = true
        scene.add(mesh)
      })

    const updateChunk = (chunk: Chunk, result: ChunkGenerationResult) =>
      Effect.sync(() => {
        const existingMesh = scene.getObjectByName(`chunk_${chunk.chunkX}_${chunk.chunkZ}`)
        if (existingMesh) {
          scene.remove(existingMesh)
        }
        const material = materialManager.get('terrain')
        const mesh = createChunkMesh(chunk, result, material)
        scene.add(mesh)
      })

    const updateTargetBlock = (matrix: THREE.Matrix4) =>
      Effect.sync(() => {
        const existingMesh = scene.getObjectByName('targetBlock')
        if (existingMesh) {
          scene.remove(existingMesh)
        }
        const material = materialManager.get('targetBlock')
        const mesh = createTargetBlockMesh(material)
        mesh.applyMatrix4(matrix)
        scene.add(mesh)
      })

    const removeObject = (name: string) =>
      Effect.sync(() => {
        const obj = scene.getObjectByName(name)
        if (obj) {
          scene.remove(obj)
        }
      })

    const updateCameraPosition = (position: THREE.Vector3, lookAt: THREE.Vector3) =>
      Effect.sync(() => {
        camera.position.copy(position)
        camera.lookAt(lookAt)
      })

    return {
      render,
      setCameraAspectRatio,
      setSize,
      getDomElement,
      updateBlock,
      updateChunk,
      updateTargetBlock,
      removeObject,
      updateCameraPosition,
      update: (type, ...args) =>
        Match.value(type).pipe(
          Match.when('block', () => updateBlock(...(args as [BlockType, THREE.Matrix4, number]))),
          Match.when('chunk', () => updateChunk(...(args as [Chunk, ChunkGenerationResult]))),
          Match.when('targetBlock', () => updateTargetBlock(...(args as [THREE.Matrix4]))),
          Match.when('camera', () => updateCameraPosition(...(args as [THREE.Vector3, THREE.Vector3]))),
          Match.exhaustive,
        ),
    }
  }),
)


    return {
      processRenderQueue,
      syncCameraToWorld,
      updateHighlight,
      updateInstancedMeshes,
      renderScene,
    }
  }),
)