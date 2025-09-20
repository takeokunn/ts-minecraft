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
  // clientWidthとclientHeightはreadonlyのため、definePropertyを使用
  Object.defineProperty(canvas, 'clientWidth', { value: 800, writable: false })
  Object.defineProperty(canvas, 'clientHeight', { value: 600, writable: false })

  // WebGLコンテキストのモック
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
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      setClearColor: vi.fn(),
      setViewport: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      getContext: vi.fn().mockReturnValue({
        isContextLost: vi.fn().mockReturnValue(false),
      }),
      domElement: createMockCanvas(),
      shadowMap: {
        enabled: false,
        type: THREE.PCFShadowMap,
        autoUpdate: true,
      },
      info: {
        memory: { geometries: 0, textures: 0 },
        render: { calls: 0, triangles: 0 },
      },
      outputColorSpace: THREE.SRGBColorSpace,
      toneMapping: THREE.NoToneMapping,
      toneMappingExposure: 1.0,
      sortObjects: true,
      extensions: {
        get: vi.fn(),
      },
    })),
  }
})

describe('ThreeRenderer', () => {
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

  describe('初期化', () => {
    it('正常に初期化できる', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        const isInitialized = yield* renderer.getRenderer()
        expect(isInitialized).not.toBeNull()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('WebGL2サポート状況を確認できる', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        const isSupported = yield* renderer.isWebGL2Supported()
        expect(typeof isSupported).toBe('boolean')
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })
  })

  describe('レンダリング', () => {
    it('シーンを正常にレンダリングできる', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.render(scene, camera)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('初期化前のレンダリングでエラーが発生する', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.render(scene, camera)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)

      await expect(Effect.runPromise(runnable)).rejects.toThrow()
    })
  })

  describe('リサイズ', () => {
    it('レンダラーのサイズを変更できる', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.resize(1024, 768)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })
  })

  describe('設定', () => {
    it('シャドウマップを設定できる', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.configureShadowMap({
          enabled: true,
          type: THREE.PCFSoftShadowMap,
          resolution: 2048,
        })
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('アンチエイリアシングを設定できる', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.configureAntialiasing({
          enabled: true,
          samples: 4,
        })
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('WebGL2機能を有効化できる', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.enableWebGL2Features()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('ポストプロセシングを設定できる', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.setupPostprocessing()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })
  })

  describe('パフォーマンス', () => {
    it('パフォーマンス統計を取得できる', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)

        // 数フレームレンダリング
        for (let i = 0; i < 5; i++) {
          yield* renderer.render(scene, camera)
        }

        const stats = yield* renderer.getPerformanceStats()
        expect(stats).toHaveProperty('fps')
        expect(stats).toHaveProperty('frameTime')
        expect(stats).toHaveProperty('memory')
        expect(stats).toHaveProperty('render')
        expect(typeof stats.fps).toBe('number')
        expect(typeof stats.frameTime).toBe('number')
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })
  })

  describe('リソース管理', () => {
    it('リソースを正常に解放できる', async () => {
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
    it('不正なCanvas要素でエラーが発生する', async () => {
      const invalidCanvas = null as unknown as HTMLCanvasElement

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(invalidCanvas)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await expect(Effect.runPromise(runnable)).rejects.toThrow()
    })
  })
})

describe('ThreeRenderer統合テスト', () => {
  it('完全なレンダリングパイプラインが動作する', async () => {
    const canvas = createMockCanvas()
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 1000)

    const program = Effect.gen(function* () {
      const renderer = yield* ThreeRenderer

      // 初期化
      yield* renderer.initialize(canvas)

      // WebGL2機能有効化
      yield* renderer.enableWebGL2Features()

      // シャドウマップ設定
      yield* renderer.configureShadowMap({
        enabled: true,
        type: THREE.PCFSoftShadowMap,
        resolution: 1024,
      })

      // アンチエイリアシング設定
      yield* renderer.configureAntialiasing({
        enabled: true,
        samples: 4,
      })

      // ポストプロセシング設定
      yield* renderer.setupPostprocessing()

      // リサイズ
      yield* renderer.resize(1024, 768)

      // レンダリング実行
      yield* renderer.render(scene, camera)

      // パフォーマンス統計確認
      const stats = yield* renderer.getPerformanceStats()
      expect(stats.fps).toBeGreaterThanOrEqual(0)

      // リソース解放
      yield* renderer.dispose()
    })

    const runnable = Effect.provide(program, ThreeRendererLive)
    await Effect.runPromise(runnable)
  })
})
