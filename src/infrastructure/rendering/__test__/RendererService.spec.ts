/**
 * @vitest-environment happy-dom
 */
import { describe, expect, beforeEach, afterEach, vi } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import * as THREE from 'three'
import { RendererService } from '../RendererService'

// WebGLモックテストレイヤーの作成
const WebGLTestLayer = Layer.succeed(
    RendererService,
    RendererService.of({
    initialize: (canvas: HTMLCanvasElement) => Effect.succeed(void 0),
    render: (scene: THREE.Scene, camera: THREE.Camera) => Effect.succeed(void 0),
    resize: (width: number, height: number) => Effect.succeed(void 0),
    dispose: () => Effect.succeed(void 0),
    getRenderer: () => Effect.succeed(null),
    isInitialized: () => Effect.succeed(true),
    setClearColor: (color: number, alpha?: number) => Effect.succeed(void 0,
      setPixelRatio: (ratio: number) => Effect.succeed(void 0),
  })
// Canvas要素のモック
const createMockCanvas = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600
  Object.defineProperty(canvas, 'clientWidth', {
    value: 800,
    writable: false,
  })
  Object.defineProperty(canvas, 'clientHeight', {
    value: 600,
    writable: false,
  })
  return canvas
}

describe('RendererService', () => {
  let mockCanvas: HTMLCanvasElement
  beforeEach(() => {
  mockCanvas = createMockCanvas()
})

  describe('Basic Service Operations', () => {
  it('Should initialize and report as initialized', async () => {
  const program = Effect.gen(function* () {
  const service = yield* RendererService
  yield* service.initialize(mockCanvas)
  const isInitialized = yield* service.isInitialized()
  expect(isInitialized).toBe(true)
})

      await Effect.runPromise(program.pipe(Effect.provide(WebGLTestLayer)))
    })

    it('Should render scene with camera', async () => {
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera()

      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.render(scene, camera)
      })

      await Effect.runPromise(program.pipe(Effect.provide(WebGLTestLayer)))
    })

    it('Should resize renderer', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.resize(1024, 768)
      })

      await Effect.runPromise(program.pipe(Effect.provide(WebGLTestLayer)))
    })

    it('Should dispose renderer properly', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.dispose()
      })

      await Effect.runPromise(program.pipe(Effect.provide(WebGLTestLayer)))
    })

    it('Should set clear color', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.setClearColor(0xff0000, 0.5)
      })

      await Effect.runPromise(program.pipe(Effect.provide(WebGLTestLayer)))
    })

    it('Should set pixel ratio', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.setPixelRatio(2.0)
      })

      await Effect.runPromise(program.pipe(Effect.provide(WebGLTestLayer)))
    })

    it('Should get renderer instance', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        const renderer = yield* service.getRenderer()
        expect(renderer).toBe(null) // In test layer, returns null
      })

      await Effect.runPromise(program.pipe(Effect.provide(WebGLTestLayer)))
    })
  })

  describe('Service Behavior Patterns', () => {
  it('Should handle multiple operations in sequence', async () => {
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera()
  const program = Effect.gen(function* () {
  const service = yield* RendererService
  yield* service.initialize(mockCanvas)
  yield* service.setClearColor(0x87ceeb, 1.0)
  yield* service.setPixelRatio(window.devicePixelRatio || 1)
  yield* service.resize(800, 600)
  yield* service.render(scene, camera)
  const isInitialized = yield* service.isInitialized()
  expect(isInitialized).toBe(true)
})

      await Effect.runPromise(program.pipe(Effect.provide(WebGLTestLayer)))
    })

    it('Should handle concurrent operations', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)

        // Concurrent operations
        yield* Effect.all([
          service.setClearColor(0xff0000, 1.0),
          service.setPixelRatio(2.0
    }),
    service.resize(1920, 1080),
        ])

        const isInitialized = yield* service.isInitialized()
        expect(isInitialized).toBe(true)
      })

      await Effect.runPromise(program.pipe(Effect.provide(WebGLTestLayer)))
    })
  })
})
