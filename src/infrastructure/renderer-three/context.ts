import * as THREE from 'three'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import { Effect, Layer } from 'effect'
import { ThreeCameraService } from '../camera-three'
import { ThreeContext, ThreeContextService } from '../types'

export { ThreeContextService } from '../types'

// --- Helper ---

const makeWindowEventListener = <K extends keyof WindowEventMap>(
  type: K,
  listener: (ev: WindowEventMap[K]) => Effect.Effect<void>,
) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const handler = (ev: WindowEventMap[K]) => Effect.runFork(listener(ev))
      window.addEventListener(type, handler)
      return handler
    }),
    (handler) => Effect.sync(() => window.removeEventListener(type, handler)),
  )

// --- Live Implementation ---

export const ThreeContextLive = (rootElement: HTMLElement) =>
  Layer.scoped(
    ThreeContextService,
    Effect.gen(function* (_) {
      const cameraService = yield* _(ThreeCameraService)

      const context = yield* _(
        Effect.acquireRelease(
          Effect.sync(() => {
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

            return {
              scene,
              camera: cameraService.camera,
              renderer,
              highlightMesh,
              stats,
              chunkMeshes: new Map(),
              instancedMeshes: new Map(),
            } as ThreeContext
          }),
          (ctx) =>
            Effect.all(
              [
                Effect.try({
                  try: () => ctx.renderer.dispose(),
                  catch: (e) => new Error(`Failed to dispose renderer: ${e}`),
                }),
                Effect.try({
                  try: () => {
                    if (rootElement.contains(ctx.renderer.domElement)) {
                      rootElement.removeChild(ctx.renderer.domElement)
                    }
                    if (rootElement.contains(ctx.stats.dom)) {
                      rootElement.removeChild(ctx.stats.dom)
                    }
                  },
                  catch: (e) => new Error(`Failed to remove DOM elements: ${e}`),
                }),
              ],
              { discard: true, concurrency: 'inherit' },
            ),
        ),
      )

      yield* _(makeWindowEventListener('resize', () => cameraService.handleResize(context.renderer)))

      return context
    }),
  )
