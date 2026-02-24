import { Effect, Context, Layer } from 'effect'
import * as THREE from 'three'

export interface RendererService {
  readonly create: (canvas: HTMLCanvasElement) => Effect.Effect<THREE.WebGLRenderer, never>
  readonly render: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => Effect.Effect<void, never>
  readonly resize: (renderer: THREE.WebGLRenderer, width: number, height: number) => Effect.Effect<void, never>
}

export const RendererService = Context.GenericTag<RendererService>('@minecraft/infrastructure/three/RendererService')

export const RendererServiceLive = Layer.succeed(
  RendererService,
  RendererService.of({
    create: (canvas) =>
      Effect.sync(() => {
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
        renderer.setSize(canvas.clientWidth, canvas.clientHeight)
        return renderer
      }),
    render: (renderer, scene, camera) =>
      Effect.sync(() => {
        renderer.render(scene, camera)
      }),
    resize: (renderer, width, height) =>
      Effect.sync(() => {
        renderer.setSize(width, height)
      }),
  })
)
