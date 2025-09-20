import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Effect, Ref, Exit } from 'effect'
import * as THREE from 'three'
import * as fc from 'fast-check'
import { RendererServiceLive } from '../RendererServiceLive'
import { RendererService } from '../RendererService'
import { RenderInitError, RenderExecutionError, ContextLostError } from '../types'

// Mock browser environment
Object.defineProperty(globalThis, 'window', {
  value: {
    devicePixelRatio: 2,
  },
  writable: true,
})

// Mock Three.js for testing
vi.mock('three', () => ({
  WebGLRenderer: vi.fn(),
  Scene: vi.fn(),
  PerspectiveCamera: vi.fn(),
  PCFSoftShadowMap: 1,
}))

describe('RendererServiceLive', () => {
  let mockCanvas: HTMLCanvasElement
  let mockRenderer: any
  let mockContext: any

  beforeEach(() => {
    // Mock canvas
    mockCanvas = {
      clientWidth: 800,
      clientHeight: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getContext: vi.fn(),
    } as any

    // Mock WebGL context
    mockContext = {
      isContextLost: vi.fn(() => false),
    }

    // Mock THREE.WebGLRenderer
    mockRenderer = {
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      setClearColor: vi.fn(),
      shadowMap: { enabled: false, type: 0 },
      getContext: vi.fn(() => mockContext),
      render: vi.fn(),
      dispose: vi.fn(),
      domElement: mockCanvas,
    }

    vi.mocked(THREE.WebGLRenderer).mockImplementation(() => mockRenderer)

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Layer creation', () => {
    it('creates a valid RendererService layer', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        expect(service).toBeDefined()
        expect(typeof service.initialize).toBe('function')
        expect(typeof service.render).toBe('function')
        expect(typeof service.resize).toBe('function')
        expect(typeof service.dispose).toBe('function')
        return service
      })

      await Effect.runPromise(program.pipe(Effect.provide(RendererServiceLive)))
    })
  })

  describe('Initialization', () => {
    it('initializes WebGL renderer successfully', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)

        const isInitialized = yield* service.isInitialized()
        return isInitialized
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(RendererServiceLive)))

      expect(result).toBe(true)
      expect(THREE.WebGLRenderer).toHaveBeenCalledWith({
        canvas: mockCanvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
        premultipliedAlpha: true,
        preserveDrawingBuffer: false,
      })
      expect(mockRenderer.setPixelRatio).toHaveBeenCalledWith(2)
      expect(mockRenderer.setSize).toHaveBeenCalledWith(800, 600)
      expect(mockRenderer.setClearColor).toHaveBeenCalledWith(0x87ceeb, 1.0)
      expect(mockCanvas.addEventListener).toHaveBeenCalledTimes(2)
    })

    it('fails when WebGL context cannot be created', async () => {
      mockRenderer.getContext.mockReturnValue(null)

      const program = Effect.gen(function* () {
        const service = yield* RendererService
        return yield* service.initialize(mockCanvas)
      })

      const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(RendererServiceLive)))

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const cause = exit.cause
        if (cause._tag === 'Fail') {
          expect(cause.error._tag).toBe('RenderInitError')
        } else {
          expect.fail('Expected Fail cause but got: ' + cause._tag)
        }
      }
    })

    it('handles renderer creation errors', async () => {
      vi.mocked(THREE.WebGLRenderer).mockImplementation(() => {
        throw new Error('WebGL not supported')
      })

      const program = Effect.gen(function* () {
        const service = yield* RendererService
        return yield* service.initialize(mockCanvas)
      })

      const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(RendererServiceLive)))

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const cause = exit.cause
        if (cause._tag === 'Fail') {
          expect(cause.error._tag).toBe('RenderInitError')
        } else {
          expect.fail('Expected Fail cause but got: ' + cause._tag)
        }
      }
    })
  })

  describe('Rendering', () => {
    let mockScene: THREE.Scene
    let mockCamera: THREE.Camera

    beforeEach(() => {
      mockScene = { uuid: 'scene-123' } as THREE.Scene
      mockCamera = { type: 'PerspectiveCamera' } as THREE.Camera
    })

    it('renders scene successfully', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.render(mockScene, mockCamera)
        return 'success'
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(RendererServiceLive)))

      expect(result).toBe('success')
      expect(mockRenderer.render).toHaveBeenCalledWith(mockScene, mockCamera)
    })

    it('fails when renderer is not initialized', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        return yield* service.render(mockScene, mockCamera)
      })

      const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(RendererServiceLive)))

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const cause = exit.cause
        if (cause._tag === 'Fail') {
          expect(cause.error._tag).toBe('RenderExecutionError')
        } else {
          expect.fail('Expected Fail cause but got: ' + cause._tag)
        }
      }
    })

    it('handles context lost error', async () => {
      mockContext.isContextLost.mockReturnValue(true)

      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        return yield* service.render(mockScene, mockCamera)
      })

      const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(RendererServiceLive)))

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const cause = exit.cause
        if (cause._tag === 'Fail') {
          expect(cause.error._tag).toBe('ContextLostError')
        } else {
          expect.fail('Expected Fail cause but got: ' + cause._tag)
        }
      }
    })

    it('handles rendering errors', async () => {
      mockRenderer.render.mockImplementation(() => {
        throw new Error('Rendering failed')
      })

      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        return yield* service.render(mockScene, mockCamera)
      })

      const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(RendererServiceLive)))

      expect(Exit.isFailure(exit)).toBe(true)
      if (Exit.isFailure(exit)) {
        const cause = exit.cause
        if (cause._tag === 'Fail') {
          expect(cause.error._tag).toBe('RenderExecutionError')
        } else {
          expect.fail('Expected Fail cause but got: ' + cause._tag)
        }
      }
    })
  })

  describe('Resize operations', () => {
    it('resizes renderer successfully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 4000 }),
          fc.integer({ min: 100, max: 4000 }),
          async (width, height) => {
            const program = Effect.gen(function* () {
              const service = yield* RendererService
              yield* service.initialize(mockCanvas)
              yield* service.resize(width, height)
              return 'resized'
            })

            const result = await Effect.runPromise(program.pipe(Effect.provide(RendererServiceLive)))

            expect(result).toBe('resized')
            expect(mockRenderer.setSize).toHaveBeenCalledWith(width, height)
          }
        ),
        { numRuns: 20 }
      )
    })

    it('handles resize before initialization gracefully', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.resize(1920, 1080)
        return 'completed'
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(RendererServiceLive)))
      expect(result).toBe('completed')
      expect(mockRenderer.setSize).not.toHaveBeenCalled()
    })
  })

  describe('Color and pixel ratio operations', () => {
    it('sets clear color successfully', async () => {
      const colorArbitrary = fc.integer({ min: 0x000000, max: 0xffffff })
      const alphaArbitrary = fc.float({ min: 0, max: 1 })

      await fc.assert(
        fc.asyncProperty(colorArbitrary, alphaArbitrary, async (color, alpha) => {
          const program = Effect.gen(function* () {
            const service = yield* RendererService
            yield* service.initialize(mockCanvas)
            yield* service.setClearColor(color, alpha)
            return 'success'
          })

          const result = await Effect.runPromise(program.pipe(Effect.provide(RendererServiceLive)))

          expect(result).toBe('success')
          expect(mockRenderer.setClearColor).toHaveBeenCalledWith(color, alpha)
        }),
        { numRuns: 20 }
      )
    })

    it('sets pixel ratio successfully', async () => {
      const pixelRatioArbitrary = fc.float({ min: 0.5, max: 4 })

      await fc.assert(
        fc.asyncProperty(pixelRatioArbitrary, async (ratio) => {
          const program = Effect.gen(function* () {
            const service = yield* RendererService
            yield* service.initialize(mockCanvas)
            yield* service.setPixelRatio(ratio)
            return 'success'
          })

          const result = await Effect.runPromise(program.pipe(Effect.provide(RendererServiceLive)))

          expect(result).toBe('success')
          expect(mockRenderer.setPixelRatio).toHaveBeenCalledWith(ratio)
        }),
        { numRuns: 20 }
      )
    })
  })

  describe('Disposal', () => {
    it('disposes renderer successfully', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)

        let isInitialized = yield* service.isInitialized()
        expect(isInitialized).toBe(true)

        yield* service.dispose()

        isInitialized = yield* service.isInitialized()
        return isInitialized
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(RendererServiceLive)))

      expect(result).toBe(false)
      expect(mockRenderer.dispose).toHaveBeenCalled()
      expect(mockCanvas.removeEventListener).toHaveBeenCalledTimes(2)
    })

    it('handles disposal before initialization gracefully', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.dispose()
        return 'completed'
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(RendererServiceLive)))
      expect(result).toBe('completed')
      expect(mockRenderer.dispose).not.toHaveBeenCalled()
    })
  })

  describe('Renderer state management', () => {
    it('reports correct initialization state', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService

        // Before initialization
        let isInitialized = yield* service.isInitialized()
        expect(isInitialized).toBe(false)

        // After initialization
        yield* service.initialize(mockCanvas)
        isInitialized = yield* service.isInitialized()
        expect(isInitialized).toBe(true)

        // After disposal
        yield* service.dispose()
        isInitialized = yield* service.isInitialized()

        return isInitialized
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(RendererServiceLive)))
      expect(result).toBe(false)
    })

    it('returns renderer instance when available', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService

        // Before initialization
        let renderer = yield* service.getRenderer()
        expect(renderer).toBeNull()

        // After initialization
        yield* service.initialize(mockCanvas)
        renderer = yield* service.getRenderer()
        expect(renderer).toBe(mockRenderer)

        return renderer
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(RendererServiceLive)))
      expect(result).toBe(mockRenderer)
    })
  })

  describe('Concurrent operations', () => {
    it('handles multiple resize operations concurrently', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)

        const resizeOperations = [service.resize(800, 600), service.resize(1024, 768), service.resize(1920, 1080)]

        yield* Effect.all(resizeOperations, { concurrency: 'unbounded' })

        return 'completed'
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(RendererServiceLive)))
      expect(result).toBe('completed')
      expect(mockRenderer.setSize).toHaveBeenCalledTimes(4) // Initial + 3 resizes
    })

    it('handles concurrent color and pixel ratio changes', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)

        const operations = [
          service.setClearColor(0xff0000, 1.0),
          service.setPixelRatio(1.5),
          service.setClearColor(0x00ff00, 0.8),
        ]

        yield* Effect.all(operations, { concurrency: 'unbounded' })

        return 'completed'
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(RendererServiceLive)))
      expect(result).toBe('completed')
    })
  })

  describe('Error recovery scenarios', () => {
    it('maintains service integrity after errors', async () => {
      // First, cause an initialization error
      vi.mocked(THREE.WebGLRenderer).mockImplementationOnce(() => {
        throw new Error('First attempt failed')
      })

      const program1 = Effect.gen(function* () {
        const service = yield* RendererService
        return yield* service.initialize(mockCanvas)
      })

      const exit1 = await Effect.runPromiseExit(program1.pipe(Effect.provide(RendererServiceLive)))
      expect(Exit.isFailure(exit1)).toBe(true)

      // Reset mock to succeed
      vi.mocked(THREE.WebGLRenderer).mockImplementation(() => mockRenderer)

      // Second attempt should succeed
      const program2 = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        return yield* service.isInitialized()
      })

      const result2 = await Effect.runPromise(program2.pipe(Effect.provide(RendererServiceLive)))
      expect(result2).toBe(true)
    })
  })
})
