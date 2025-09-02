import * as THREE from 'three'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import { Effect, Layer } from 'effect'
import { ThreeCameraService } from '../camera-three'
import { ThreeContext, ThreeContextService } from '../types'

export { ThreeContextService } from '../types'

// --- Live Implementation ---

export const ThreeContextLive = (rootElement: HTMLElement) =>
  Layer.scoped(
    ThreeContextService,
    Effect.acquireRelease(
      Effect.gen(function* (_) {
        const cameraService = yield* _(ThreeCameraService)
        const scene = new THREE.Scene()
        const renderer = new THREE.WebGLRenderer()
        renderer.setSize(window.innerWidth, window.innerHeight)
        rootElement.appendChild(renderer.domElement)

        const stats = new Stats()
        rootElement.appendChild(stats.dom)

        const highlightMesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.01, 1.01, 1.01),
          new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.2,
          }),
        )
        scene.add(highlightMesh)

        const context: ThreeContext = {
          scene,
          camera: cameraService.camera,
          renderer,
          highlightMesh,
          stats,
          chunkMeshes: new Map(),
          instancedMeshes: new Map(),
        }

        const onResize = () => Effect.runFork(cameraService.handleResize(context.renderer))
        window.addEventListener('resize', onResize)

        return [context, onResize] as const
      }),
      ([context, onResize]) =>
        Effect.sync(() => {
          window.removeEventListener('resize', onResize)
          context.renderer.dispose()
          if (rootElement.contains(context.renderer.domElement)) {
            rootElement.removeChild(context.renderer.domElement)
          }
          if (rootElement.contains(context.stats.dom)) {
            rootElement.removeChild(context.stats.dom)
          }
        }),
    ).pipe(Effect.map(([context]) => context)),
  )
