import { Effect } from 'effect'
import * as THREE from 'three'

const TONE_MAPPING_EXPOSURE = 0.9

export class RendererService extends Effect.Service<RendererService>()(
  '@minecraft/infrastructure/three/RendererService',
  {
    succeed: {
        create: (canvas: HTMLCanvasElement): Effect.Effect<THREE.WebGLRenderer, never> =>
        Effect.sync(() => {
          const renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: false,
            stencil: false,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false,
          })
          renderer.setSize(canvas.clientWidth, canvas.clientHeight)

          renderer.toneMapping = THREE.ACESFilmicToneMapping
          renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE
          renderer.outputColorSpace = THREE.SRGBColorSpace

          return renderer
        }),
      render: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): Effect.Effect<void, never> =>
        Effect.sync(() => {
          renderer.render(scene, camera)
        }),
      resize: (renderer: THREE.WebGLRenderer, width: number, height: number): Effect.Effect<void, never> =>
        Effect.sync(() => {
          renderer.setSize(width, height)
        }),
      renderOverlay: (renderer: THREE.WebGLRenderer, hudScene: THREE.Scene, hudCamera: THREE.Camera): Effect.Effect<void, never> =>
        Effect.sync(() => {
          // Reset depth buffer so HUD geometry always renders in front of world geometry,
          // regardless of the depth values written by the main scene pass.
          renderer.clearDepth()
          renderer.render(hudScene, hudCamera)
        }),
    },
  }
) {}
export const RendererServiceLive = RendererService.Default
