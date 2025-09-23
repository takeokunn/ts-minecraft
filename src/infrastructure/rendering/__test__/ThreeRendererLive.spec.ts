import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Effect, Layer, TestContext } from 'effect'
import * as THREE from 'three'
import { ThreeRenderer } from '../ThreeRenderer.js'
import { ThreeRendererLive } from '../ThreeRendererLive.js'

// Canvas要素のモック
const createMockCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600
  Object.defineProperty(canvas, 'clientWidth', { value: 800, writable: false })
  Object.defineProperty(canvas, 'clientHeight', { value: 600, writable: false })

  const mockContext = {
    isContextLost: vi.fn().mockReturnValue(false),
    getExtension: vi.fn(),
  }

  vi.spyOn(canvas, 'getContext').mockImplementation((type: string) => {
    if (type === 'webgl2' || type === 'webgl') {
      return mockContext as unknown as WebGLRenderingContext
    }
    return null
  })

  return canvas
}

// Three.js WebGLRendererのモック
vi.mock('three', async () => {
  const actual = await vi.importActual('three')
  return {
    ...actual,
    WebGLRenderer: vi.fn().mockImplementation(() => {
      const mockCanvas = createMockCanvas()
      return {
        setPixelRatio: vi.fn(),
        setSize: vi.fn(),
        setClearColor: vi.fn(),
        setViewport: vi.fn(),
        render: vi.fn(),
        dispose: vi.fn(),
        getContext: vi.fn().mockReturnValue({
          isContextLost: vi.fn().mockReturnValue(false),
          getExtension: vi.fn(),
        }),
        domElement: mockCanvas,
        shadowMap: {
          enabled: false,
          type: actual['PCFShadowMap'],
          autoUpdate: true,
          needsUpdate: false,
          render: vi.fn(),
          cullFace: actual['CullFaceBack'],
        },
        info: {
          memory: { geometries: 0, textures: 0 },
          render: { calls: 0, triangles: 0, frame: 0, lines: 0, points: 0 },
          autoReset: true,
          programs: null,
          update: vi.fn(),
          reset: vi.fn(),
        },
        outputColorSpace: actual['SRGBColorSpace'],
        toneMapping: actual['NoToneMapping'],
        toneMappingExposure: 1.0,
        sortObjects: true,
        extensions: {
          get: vi.fn(),
          has: vi.fn(),
          init: vi.fn(),
        },
      }
    }),
    WebGLRenderTarget: vi.fn().mockImplementation((width = 800, height = 600, options = {}) => ({
      width,
      height,
      texture: {
        format: options.format || actual['RGBAFormat'],
        type: options.type || actual['FloatType'],
        minFilter: options.minFilter || actual['LinearFilter'],
        magFilter: options.magFilter || actual['LinearFilter'],
      },
      stencilBuffer: options.stencilBuffer || false,
      dispose: vi.fn(),
    })),
  }
})

describe('ThreeRendererLive', () => {
  let canvas: HTMLCanvasElement
  let scene: THREE.Scene
  let camera: THREE.Camera

  beforeEach(() => {
    canvas = createMockCanvas()
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Layer作成', () => {
    it('ThreeRendererLiveレイヤーが正常に作成される', async () => {
      const layer = ThreeRendererLive
      expect(layer).toBeDefined()
    })

    it('ThreeRendererサービスが正常に提供される', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        expect(renderer).toBeDefined()
        expect(typeof renderer.initialize).toBe('function')
        expect(typeof renderer.render).toBe('function')
        expect(typeof renderer.dispose).toBe('function')
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })
  })

  describe('実装詳細テスト', () => {
    it('初期化時にWebGL2サポートがチェックされる', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)

        // 初期化が成功することを確認
        const rendererInstance = yield* renderer.getRenderer()
        expect(rendererInstance).not.toBeNull()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('パフォーマンス統計が正しく初期化される', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer

        // 初期化前の統計
        const initialStats = yield* renderer.getPerformanceStats()
        expect(initialStats.fps).toBe(0)
        expect(initialStats.frameTime).toBe(0)

        yield* renderer.initialize(canvas)

        // 初期化後も統計は維持される
        const afterInitStats = yield* renderer.getPerformanceStats()
        expect(afterInitStats.fps).toBe(0)
        expect(afterInitStats.frameTime).toBe(0)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('初期化後にレンダラーインスタンスが取得できる', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)

        const rendererInstance = yield* renderer.getRenderer()
        expect(rendererInstance).not.toBeNull()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('リサイズが正常に実行される', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.resize(1920, 1080)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('レンダリング時にフレームタイミングが記録される', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.render(scene, camera)

        const stats = yield* renderer.getPerformanceStats()
        expect(stats.frameTime).toBeGreaterThanOrEqual(0)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('dispose時にレンダラーインスタンスがクリアされる', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.dispose()

        const rendererInstance = yield* renderer.getRenderer()
        expect(rendererInstance).toBeNull()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })
  })

  describe('エラーハンドリング', () => {
    it('WebGLコンテキスト作成失敗時に適切なエラーが発生する', async () => {
      const failingCanvas = createMockCanvas()
      vi.spyOn(failingCanvas, 'getContext').mockReturnValue(null)

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(failingCanvas)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      const result = await Effect.runPromiseExit(runnable)
      
      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        // Extract the actual error from the Effect failure cause
        const actualError = result.cause._tag === 'Fail' ? result.cause.error : result.cause
        expect(actualError).toBeDefined()
        expect(actualError._tag).toBe('RenderInitError')
      }
    })

    it('不正なキャンバス要素でエラーが発生する', async () => {
      const invalidCanvas = null as unknown as HTMLCanvasElement

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(invalidCanvas)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      const result = await Effect.runPromiseExit(runnable)
      
      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        // Extract the actual error from the Effect failure cause
        const actualError = result.cause._tag === 'Fail' ? result.cause.error : result.cause
        expect(actualError).toBeDefined()
        expect(actualError._tag).toBe('RenderInitError')
      }
    })
  })

  describe('設定機能', () => {
    it('初期化前でもシャドウマップ設定が安全に実行される', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.configureShadowMap({ enabled: true })
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('初期化前でもアンチエイリアシング設定が安全に実行される', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.configureAntialiasing({ enabled: true })
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('初期化前でもリサイズが安全に実行される', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.resize(1024, 768)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })
  })

  describe('高度な機能とエラーケース', () => {
    it('初期化されていない状態でrenderを呼ぶとエラーが発生する', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.render(scene, camera)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      const result = await Effect.runPromiseExit(runnable)
      
      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        // Extract the actual error from the Effect failure cause
        const actualError = result.cause._tag === 'Fail' ? result.cause.error : result.cause
        expect(actualError).toBeDefined()
        expect(actualError._tag).toBe('RenderExecutionError')
      }
    })

    it('WebGL2機能を有効化する', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.enableWebGL2Features()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('初期化されていない状態でWebGL2機能を有効化するとエラーが発生する', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.enableWebGL2Features()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      const result = await Effect.runPromiseExit(runnable)
      
      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        // Extract the actual error from the Effect failure cause
        const actualError = result.cause._tag === 'Fail' ? result.cause.error : result.cause
        expect(actualError).toBeDefined()
        expect(actualError._tag).toBe('RenderExecutionError')
      }
    })

    it('ポストプロセシングの設定', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.setupPostprocessing()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('初期化されていない状態でポストプロセシングを設定するとエラーが発生する', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.setupPostprocessing()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      const result = await Effect.runPromiseExit(runnable)
      
      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        // Extract the actual error from the Effect failure cause
        const actualError = result.cause._tag === 'Fail' ? result.cause.error : result.cause
        expect(actualError).toBeDefined()
        expect(actualError._tag).toBe('RenderExecutionError')
      }
    })

    // このテストを最後に実行して他のテストに影響しないようにする
    it('初期化でエラーが発生した場合の適切なエラーハンドリング', async () => {
      // WebGLRendererの作成でエラーが発生するケース
      const WebGLRendererMock = vi.mocked(THREE.WebGLRenderer)
      
      // 現在のテストのみでエラーを投げる実装に変更
      WebGLRendererMock.mockImplementationOnce(() => {
        throw new Error('Renderer creation failed')
      })

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      const result = await Effect.runPromiseExit(runnable)
      
      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        // Extract the actual error from the Effect failure cause
        const actualError = result.cause._tag === 'Fail' ? result.cause.error : result.cause
        expect(actualError).toBeDefined()
        expect(actualError._tag).toBe('RenderInitError')
      }
    })
  })
})
