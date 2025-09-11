/**
 * Three.js Adapter - Implements rendering operations using Three.js
 *
 * This adapter provides concrete implementation for 3D rendering
 * using Three.js library, isolating the domain layer from specific
 * rendering implementation details.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as Queue from 'effect/Queue'
import * as Ref from 'effect/Ref'
import * as Match from 'effect/Match'
import * as THREE from 'three'
import { IRenderPort, Camera, ChunkMeshData, RenderStats } from '@/domain/ports/render.port'

/**
 * Render command types for the rendering queue
 */
export type RenderCommand =
  | {
      readonly type: 'ADD_CHUNK'
      readonly chunkX: number
      readonly chunkZ: number
      readonly positions: Float32Array
      readonly normals: Float32Array
      readonly uvs: Float32Array
      readonly indices: Uint32Array
    }
  | {
      readonly type: 'REMOVE_CHUNK'
      readonly chunkX: number
      readonly chunkZ: number
    }
  | {
      readonly type: 'UPDATE_CAMERA'
      readonly position: THREE.Vector3
      readonly rotation: THREE.Euler
    }
  | {
      readonly type: 'RENDER_FRAME'
    }

/**
 * Three.js Context interface for dependency injection
 */
export interface IThreeJsContext {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly canvas: HTMLCanvasElement
}

export class ThreeJsContext extends Context.GenericTag('ThreeJsContext')<ThreeJsContext, IThreeJsContext>() {}

/**
 * Three.js Renderer Adapter interface - extends IRenderPort
 */
export interface IThreeJsAdapter extends IRenderPort {
  readonly renderQueue: Queue.Queue<RenderCommand>
  readonly processRenderQueue: () => Effect.Effect<void, never, never>
  readonly updateCamera: (camera: Camera) => Effect.Effect<void, never, never>
  readonly addChunk: (chunkX: number, chunkZ: number, positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: Uint32Array) => Effect.Effect<void, never, never>
}

export class ThreeJsAdapter extends Context.GenericTag('ThreeJsAdapter')<ThreeJsAdapter, IThreeJsAdapter>() {}

/**
 * Three.js Adapter implementation
 */
export const ThreeJsAdapterLive = Layer.scoped(
  ThreeJsAdapter,
  Effect.gen(function* (_) {
    const threeJsContext = yield* _(ThreeJsContext)

    const chunkMeshes = yield* _(Ref.make(new Map<string, THREE.Mesh>()))
    const renderQueue = yield* _(Queue.unbounded<RenderCommand>())

    // Create basic materials
    const chunkMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 })

    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    threeJsContext.scene.add(ambientLight)
    threeJsContext.scene.add(directionalLight)

    const processCommand = (command: RenderCommand) =>
      Match.value(command).pipe(
        Match.when({ type: 'ADD_CHUNK' }, ({ chunkX, chunkZ, positions, normals, uvs, indices }) =>
          Effect.gen(function* (_) {
            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
            geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
            geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
            geometry.setIndex(Array.from(indices))

            const mesh = new THREE.Mesh(geometry, chunkMaterial)
            mesh.position.set(chunkX * 16, 0, chunkZ * 16)

            threeJsContext.scene.add(mesh)
            yield* _(Ref.update(chunkMeshes, (map) => map.set(`${chunkX},${chunkZ}`, mesh)))
          }),
        ),
        Match.when({ type: 'REMOVE_CHUNK' }, ({ chunkX, chunkZ }) =>
          Effect.gen(function* (_) {
            const key = `${chunkX},${chunkZ}`
            const meshMap = yield* _(Ref.get(chunkMeshes))
            const mesh = meshMap.get(key)

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
        Match.when({ type: 'UPDATE_CAMERA' }, ({ position, rotation }) =>
          Effect.sync(() => {
            threeJsContext.camera.position.copy(position)
            threeJsContext.camera.rotation.copy(rotation)
          }),
        ),
        Match.when({ type: 'RENDER_FRAME' }, () =>
          Effect.sync(() => {
            threeJsContext.renderer.render(threeJsContext.scene, threeJsContext.camera)
          }),
        ),
        Match.exhaustive,
      )

    const processRenderQueue = () =>
      Queue.take(renderQueue).pipe(
        Effect.flatMap(processCommand),
        Effect.catchAll((error) => Effect.logError('Error processing render command', error)),
      )

    const updateCamera = (position: THREE.Vector3, rotation: THREE.Euler) =>
      Queue.offer(renderQueue, {
        type: 'UPDATE_CAMERA',
        position,
        rotation,
      }).pipe(Effect.asVoid)

    const render = () =>
      Queue.offer(renderQueue, {
        type: 'RENDER_FRAME',
      }).pipe(Effect.asVoid)

    const addChunk = (chunkX: number, chunkZ: number, positions: Float32Array, normals: Float32Array, uvs: Float32Array, indices: Uint32Array) =>
      Queue.offer(renderQueue, {
        type: 'ADD_CHUNK',
        chunkX,
        chunkZ,
        positions,
        normals,
        uvs,
        indices,
      }).pipe(Effect.asVoid)

    const removeChunk = (chunkX: number, chunkZ: number) =>
      Queue.offer(renderQueue, {
        type: 'REMOVE_CHUNK',
        chunkX,
        chunkZ,
      }).pipe(Effect.asVoid)

    const resize = (width: number, height: number) =>
      Effect.sync(() => {
        threeJsContext.camera.aspect = width / height
        threeJsContext.camera.updateProjectionMatrix()
        threeJsContext.renderer.setSize(width, height)
      })

    // Start processing render queue in background
    yield* _(processRenderQueue().pipe(Effect.forever, Effect.forkScoped))

    return ThreeJsAdapter.of({
      renderQueue,
      processRenderQueue,
      updateCamera,
      render,
      addChunk,
      removeChunk,
      resize,
    })
  }),
)

/**
 * Three.js Context Layer - provides Three.js context
 */
export const ThreeJsContextLive = Layer.sync(ThreeJsContext, () => {
  const canvas = document.createElement('canvas')
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  })

  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(0x87ceeb) // Sky blue
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

  // Add canvas to DOM
  document.body.appendChild(canvas)

  return {
    scene,
    camera,
    renderer,
    canvas,
  }
})
