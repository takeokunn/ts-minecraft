import { Clock, MaterialManager, Renderer, type RenderCommand } from '@infrastructure/layers/unified.layer'
import { Effect, Layer, Match, Queue, Ref } from 'effect'
import * as THREE from 'three'
import { ThreeJsContext } from '@infrastructure/adapters/three-js.adapter'
import { CHUNK_SIZE } from '@shared/constants/world'

/**
 * Three.js Renderer Implementation Logic
 */
export const RendererLive = Layer.scoped(
  Renderer,
  Effect.gen(function* (_) {
    const threeJsContext = yield* _(ThreeJsContext)
    const materialManager = yield* _(MaterialManager)
    const clock = yield* _(Clock)

    const chunkMeshes = yield* _(Ref.make(new Map<string, THREE.Mesh>()))
    const renderQueue = yield* _(Queue.unbounded<RenderCommand>())

    const processCommand = (command: RenderCommand) =>
      Match.value(command).pipe(
        Match.when({ type: 'ADD_CHUNK' }, ({ chunkX, chunkZ, positions, normals, uvs, indices }) =>
          Effect.gen(function* (_) {
            const material = yield* _(materialManager.getMaterial('chunk'))
            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
            geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
            geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
            geometry.setIndex(Array.from(indices))
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(chunkX * CHUNK_SIZE, 0, chunkZ * CHUNK_SIZE)
            threeJsContext.scene.add(mesh)
            yield* _(Ref.update(chunkMeshes, (map) => map.set(`${chunkX},${chunkZ}`, mesh)))
          }),
        ),
        Match.when({ type: 'REMOVE_CHUNK' }, ({ chunkX, chunkZ }) =>
          Effect.gen(function* (_) {
            const key = `${chunkX},${chunkZ}`
            const mesh = yield* _(Ref.get(chunkMeshes).pipe(Effect.map((map) => map.get(key))))
            if (mesh) {
              mesh.geometry.dispose()
              threeJsContext.scene.remove(mesh)
              yield* _(
                Ref.update(chunkMeshes, (map) => {
                  map.delete(key)
                  return map
                }),
              )
            }
          }),
        ),
        Match.exhaustive,
      )

    yield* _(
      Queue.take(renderQueue).pipe(
        Effect.flatMap((command) => processCommand(command).pipe(Effect.catchAll((error) => Effect.logError('Error processing render command', error)))),
        Effect.forever,
        Effect.forkScoped,
      ),
    )

    const render = Effect.sync(() => {
      threeJsContext.renderer.render(threeJsContext.scene, threeJsContext.camera)
    })

    yield* _(clock.onFrame(() => render))

    const updateCamera = (position: THREE.Vector3, rotation: THREE.Euler) =>
      Effect.sync(() => {
        threeJsContext.camera.position.copy(position)
        threeJsContext.camera.rotation.copy(rotation)
      })

    return Renderer.of({
      renderQueue,
      updateCamera,
    })
  }),
)
