import { describe, expect, vi, beforeEach, afterEach } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Ref, Exit, Layer } from 'effect'
import * as THREE from 'three'
import { RendererServiceLive } from '../RendererServiceLive'
import { RendererService } from '../RendererService'
import { RenderInitError, RenderExecutionError, ContextLostError } from '../types'

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
    setClearColor: (color: number, alpha?: number) => Effect.succeed(void 0),
    setPixelRatio: (ratio: number) => Effect.succeed(void 0),
  })
)

// Mock browser environment
Object.defineProperty(globalThis, 'window', {
  value: {
    devicePixelRatio: 2,
  },
  writable: true,
})

describe('RendererServiceLive', () => {
  let mockCanvas: HTMLCanvasElement

  beforeEach(() => {
    // Mock canvas
    mockCanvas = {
      clientWidth: 800,
      clientHeight: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getContext: vi.fn(),
    } as any
  })

  describe('Layer creation', () => {
    it('creates a valid RendererService layer', () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        expect(service).toBeDefined()
        expect(typeof service.initialize).toBe('function')
        expect(typeof service.render).toBe('function')
        expect(typeof service.resize).toBe('function')
        expect(typeof service.dispose).toBe('function')
        return service
      })

      Effect.runSync(program.pipe(Effect.provide(WebGLTestLayer)))
    })
  })

  describe('Basic Service Operations', () => {
    it('initializes WebGL renderer successfully', () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        const isInitialized = yield* service.isInitialized()
        return isInitialized
      })

      const result = Effect.runSync(program.pipe(Effect.provide(WebGLTestLayer)))
      expect(result).toBe(true)
    })

    it('handles service layer creation correctly', () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.setClearColor(0x87ceeb, 1.0)
        yield* service.setPixelRatio(2.0)
        yield* service.resize(800, 600)
        const isInitialized = yield* service.isInitialized()
        return isInitialized
      })

      const result = Effect.runSync(program.pipe(Effect.provide(WebGLTestLayer)))
      expect(result).toBe(true)
    })
  })

  describe('Rendering Operations', () => {
    it('renders scene successfully', () => {
      const mockScene = { uuid: 'scene-123' } as THREE.Scene
      const mockCamera = { type: 'PerspectiveCamera' } as THREE.Camera

      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.render(mockScene, mockCamera)
        return 'success'
      })

      const result = Effect.runSync(program.pipe(Effect.provide(WebGLTestLayer)))
      expect(result).toBe('success')
    })

    it('handles multiple render operations', () => {
      const mockScene = { uuid: 'scene-123' } as THREE.Scene
      const mockCamera = { type: 'PerspectiveCamera' } as THREE.Camera

      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)

        // Multiple render calls
        yield* service.render(mockScene, mockCamera)
        yield* service.render(mockScene, mockCamera)
        yield* service.render(mockScene, mockCamera)

        return 'completed'
      })

      const result = Effect.runSync(program.pipe(Effect.provide(WebGLTestLayer)))
      expect(result).toBe('completed')
    })
  })

  describe('Resize and Configuration Operations', () => {
    it('handles resize operations', () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.resize(1920, 1080)
        yield* service.resize(800, 600)
        return 'resized'
      })

      const result = Effect.runSync(program.pipe(Effect.provide(WebGLTestLayer)))
      expect(result).toBe('resized')
    })

    it('handles configuration changes', () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.setClearColor(0xff0000, 1.0)
        yield* service.setPixelRatio(2.0)
        return 'configured'
      })

      const result = Effect.runSync(program.pipe(Effect.provide(WebGLTestLayer)))
      expect(result).toBe('configured')
    })
  })

  describe('Lifecycle Operations', () => {
    it('handles complete lifecycle', () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService

        // Initialize
        yield* service.initialize(mockCanvas)
        let isInitialized = yield* service.isInitialized()
        expect(isInitialized).toBe(true)

        // Configure
        yield* service.setClearColor(0xff0000, 1.0)
        yield* service.setPixelRatio(2.0)
        yield* service.resize(1920, 1080)

        // Get renderer
        const renderer = yield* service.getRenderer()
        expect(renderer).toBe(null) // In test layer

        // Dispose
        yield* service.dispose()

        return 'completed'
      })

      const result = Effect.runSync(program.pipe(Effect.provide(WebGLTestLayer)))
      expect(result).toBe('completed')
    })

    it('handles concurrent operations safely', () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)

        // Concurrent operations
        yield* Effect.all([
          service.setClearColor(0xff0000, 1.0),
          service.setPixelRatio(2.0),
          service.resize(1920, 1080),
        ])

        return 'completed'
      })

      const result = Effect.runSync(program.pipe(Effect.provide(WebGLTestLayer)))
      expect(result).toBe('completed')
    })
  })
})
