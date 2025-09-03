import { Context, Effect, Layer } from 'effect'
import * as THREE from 'three'

export class ThreeJsContext extends Context.Tag('ThreeJsContext')<
  ThreeJsContext,
  {
    readonly renderer: THREE.WebGLRenderer
    readonly scene: THREE.Scene
    readonly camera: THREE.PerspectiveCamera
  }
>() {}

export const ThreeJsContextLive = Layer.scoped(
  ThreeJsContext,
  Effect.gen(function* (_) {
    const renderer = yield* _(
      Effect.acquireRelease(
        Effect.sync(() => {
          const renderer = new THREE.WebGLRenderer()
          renderer.setSize(window.innerWidth, window.innerHeight)
          renderer.setClearColor(0x87ceeb)
          document.body.appendChild(renderer.domElement)
          return renderer
        }),
        (renderer) => Effect.sync(() => document.body.removeChild(renderer.domElement)),
      ),
    )

    const scene = yield* _(Effect.sync(() => new THREE.Scene()))
    const camera = yield* _(
      Effect.sync(
        () => new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000),
      ),
    )

    yield* _(
      Effect.sync(() => {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
        scene.add(ambientLight)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
        directionalLight.position.set(1, 1, 1)
        scene.add(directionalLight)
      }),
    )

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight)
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
    }

    yield* _(
      Effect.acquireRelease(
        Effect.sync(() => window.addEventListener('resize', handleResize)),
        () => Effect.sync(() => window.removeEventListener('resize', handleResize)),
      ),
    )

    return ThreeJsContext.of({ renderer, scene, camera })
  }),
)