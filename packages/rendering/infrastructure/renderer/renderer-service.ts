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
          // updateStyle=false: the canvas display size is owned by the CSS
          // 100vw/100vh rule. Letting three.js write a fixed-px inline style
          // would freeze clientWidth and break window-resize detection.
          renderer.setSize(canvas.clientWidth, canvas.clientHeight, false)

          // Vanilla Minecraft renders raw sRGB — no filmic curve. ACES darkened
          // and desaturated the mid-tones (saturated dirt/grass read as muddy
          // brown-black). Light levels are tuned to peak at 1.0, so nothing clips.
          renderer.toneMapping = THREE.NoToneMapping
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
          renderer.setSize(width, height, false)
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
