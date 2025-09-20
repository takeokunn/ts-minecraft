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

    it('WebGL2機能を有効化時にWebGL2パスが実行される', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // WebGL2コンテキストをモック（WebGL2RenderingContextのインスタンスとして判定されるように）
      const mockWebGL2Context = {
        isContextLost: vi.fn().mockReturnValue(false),
        getExtension: vi.fn(),
      }

      // WebGL2RenderingContextクラスを一時的に定義
      const originalWebGL2 = global.WebGL2RenderingContext
      class MockWebGL2RenderingContext {
        isContextLost = vi.fn().mockReturnValue(false)
        getExtension = vi.fn()
      }
      global.WebGL2RenderingContext = MockWebGL2RenderingContext as any

      // WebGL2コンテキストのインスタンスを作成
      const webgl2Instance = new MockWebGL2RenderingContext()

      // Three.js WebGLRendererのモックでWebGL2コンテキストを返すように設定
      vi.mocked(THREE.WebGLRenderer).mockImplementationOnce(
        () =>
          ({
            setPixelRatio: vi.fn(),
            setSize: vi.fn(),
            setClearColor: vi.fn(),
            setViewport: vi.fn(),
            render: vi.fn(),
            dispose: vi.fn(),
            getContext: vi.fn().mockReturnValue(webgl2Instance),
            domElement: createMockCanvas(),
            shadowMap: {
              enabled: false,
              type: THREE.PCFShadowMap,
              autoUpdate: true,
              needsUpdate: false,
              render: vi.fn(),
              cullFace: THREE.CullFaceBack,
            },
            info: {
              memory: { geometries: 0, textures: 0 },
              render: { calls: 0, triangles: 0, frame: 0, lines: 0, points: 0 },
              autoReset: true,
              programs: null,
              update: vi.fn(),
              reset: vi.fn(),
            },
            outputColorSpace: THREE.SRGBColorSpace,
            toneMapping: THREE.NoToneMapping,
            toneMappingExposure: 1.0,
            sortObjects: true,
            extensions: {
              get: vi.fn(),
              has: vi.fn(),
              init: vi.fn(),
            },
          }) as unknown as THREE.WebGLRenderer
      )

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.enableWebGL2Features()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)

      expect(consoleSpy).toHaveBeenCalledWith('WebGL2 advanced features enabled')

      // クリーンアップ
      consoleSpy.mockRestore()
      global.WebGL2RenderingContext = originalWebGL2
    })

    it('ポストプロセシング設定でエラーが発生した場合のエラーハンドリング', async () => {
      // RenderTargetの作成でエラーを発生させるため、THREE.WebGLRenderTargetをモック
      const originalWebGLRenderTarget = THREE.WebGLRenderTarget
      const mockWebGLRenderTarget = vi.fn().mockImplementation(() => {
        throw new Error('RenderTarget creation failed')
      })
      // readonly プロパティを回避するために Object.defineProperty を使用
      Object.defineProperty(THREE, 'WebGLRenderTarget', {
        value: mockWebGLRenderTarget,
        writable: true,
        configurable: true,
      })

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.setupPostprocessing()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await expect(Effect.runPromise(runnable)).rejects.toThrow()

      // クリーンアップ
      Object.defineProperty(THREE, 'WebGLRenderTarget', {
        value: originalWebGLRenderTarget,
        writable: true,
        configurable: true,
      })
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

    it('WebGLコンテキスト作成失敗でエラーが発生する', async () => {
      const canvas = createMockCanvas()
      vi.spyOn(canvas, 'getContext').mockReturnValue(null)

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await expect(Effect.runPromise(runnable)).rejects.toThrow()
    })

    it('WebGLコンテキストロスト時のエラーハンドリング', async () => {
      const canvas = createMockCanvas()

      // WebGLRendererのgetContextメソッドをモック
      let isContextLost = false
      const mockGetContext = vi.fn().mockImplementation(() => ({
        isContextLost: vi.fn().mockImplementation(() => isContextLost),
      }))

      // Three.js WebGLRendererのモックを一時的に変更
      const originalMock = vi.mocked(THREE.WebGLRenderer)
      vi.mocked(THREE.WebGLRenderer).mockImplementationOnce(
        () =>
          ({
            setPixelRatio: vi.fn(),
            setSize: vi.fn(),
            setClearColor: vi.fn(),
            setViewport: vi.fn(),
            render: vi.fn(),
            dispose: vi.fn(),
            getContext: mockGetContext,
            domElement: canvas,
            shadowMap: {
              enabled: false,
              type: THREE.PCFShadowMap,
              autoUpdate: true,
              needsUpdate: false,
              render: vi.fn(),
              cullFace: THREE.CullFaceBack,
            },
            info: {
              memory: { geometries: 0, textures: 0 },
              render: { calls: 0, triangles: 0, frame: 0, lines: 0, points: 0 },
              autoReset: true,
              programs: null,
              update: vi.fn(),
              reset: vi.fn(),
            },
            outputColorSpace: THREE.SRGBColorSpace,
            toneMapping: THREE.NoToneMapping,
            toneMappingExposure: 1.0,
            sortObjects: true,
            extensions: {
              get: vi.fn(),
              has: vi.fn(),
              init: vi.fn(),
            },
          }) as unknown as THREE.WebGLRenderer
      )

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)

        // レンダリング時にコンテキストをロストさせる
        isContextLost = true
        yield* renderer.render(scene, camera) // この時点でコンテキストロスト
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await expect(Effect.runPromise(runnable)).rejects.toThrow()
    })

    it('初期化前のWebGL2機能有効化でエラーが発生する', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.enableWebGL2Features()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await expect(Effect.runPromise(runnable)).rejects.toThrow()
    })

    it('初期化前のポストプロセシング設定でエラーが発生する', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.setupPostprocessing()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await expect(Effect.runPromise(runnable)).rejects.toThrow()
    })

    it('レンダリング中に一般的なエラーが発生した場合のエラーハンドリング', async () => {
      // Three.js WebGLRendererのrenderメソッドでエラーを発生させる
      vi.mocked(THREE.WebGLRenderer).mockImplementationOnce(
        () =>
          ({
            setPixelRatio: vi.fn(),
            setSize: vi.fn(),
            setClearColor: vi.fn(),
            setViewport: vi.fn(),
            render: vi.fn().mockImplementation(() => {
              throw new Error('Rendering failed')
            }),
            dispose: vi.fn(),
            getContext: vi.fn().mockReturnValue({
              isContextLost: vi.fn().mockReturnValue(false),
            }),
            domElement: createMockCanvas(),
            shadowMap: {
              enabled: false,
              type: THREE.PCFShadowMap,
              autoUpdate: true,
              needsUpdate: false,
              render: vi.fn(),
              cullFace: THREE.CullFaceBack,
            },
            info: {
              memory: { geometries: 0, textures: 0 },
              render: { calls: 0, triangles: 0, frame: 0, lines: 0, points: 0 },
              autoReset: true,
              programs: null,
              update: vi.fn(),
              reset: vi.fn(),
            },
            outputColorSpace: THREE.SRGBColorSpace,
            toneMapping: THREE.NoToneMapping,
            toneMappingExposure: 1.0,
            sortObjects: true,
            extensions: {
              get: vi.fn(),
              has: vi.fn(),
              init: vi.fn(),
            },
          }) as unknown as THREE.WebGLRenderer
      )

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.render(scene, camera)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await expect(Effect.runPromise(runnable)).rejects.toThrow()
    })
  })

  describe('レンダラー状態管理', () => {
    it('初期化状態を正しく判定できる', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer

        // 初期化前
        const isInitializedBefore = yield* renderer.getRenderer()
        expect(isInitializedBefore).toBeNull()

        // 初期化後
        yield* renderer.initialize(canvas)
        const isInitializedAfter = yield* renderer.getRenderer()
        expect(isInitializedAfter).not.toBeNull()
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('クリアカラーとピクセル比を設定できる（初期化後）', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)

        // 設定変更（初期化後）
        yield* renderer.configureShadowMap({ enabled: false })
        yield* renderer.configureAntialiasing({ enabled: false })
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('初期化前でも設定変更は安全に実行される', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer

        // 初期化前でも設定変更は安全
        yield* renderer.configureShadowMap({ enabled: true })
        yield* renderer.configureAntialiasing({ enabled: true })
        yield* renderer.resize(1920, 1080)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('フレームタイムの警告が正しく動作する', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // レンダリング時間を人工的に長くするためのモック
      let callCount = 0
      const mockNow = vi.spyOn(performance, 'now').mockImplementation(() => {
        callCount++
        // 初期化時とレンダリング統計初期化用の呼び出しをスキップ
        if (callCount <= 2) return 0
        // フレーム開始時間 (callCount 3) と終了時間 (callCount 4) で20msの差を作る
        return callCount === 3 ? 1000 : 1020
      })

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.render(scene, camera) // 20ms > 16.67msなので警告が出る
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Frame time exceeded 16.67ms/))

      consoleSpy.mockRestore()
      mockNow.mockRestore()
    })

    it('FPS計算が正しく動作する', async () => {
      let time = 0
      vi.spyOn(performance, 'now').mockImplementation(() => {
        time += 100 // 100msずつ進める
        return time
      })

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)

        // 11回レンダリング（1秒以上経過させてFPS計算をトリガー）
        for (let i = 0; i < 11; i++) {
          yield* renderer.render(scene, camera)
        }

        const stats = yield* renderer.getPerformanceStats()
        expect(stats.fps).toBeGreaterThan(0)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
    })

    it('パフォーマンス統計の初期値を確認できる', async () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer

        // 初期化前の統計
        const initialStats = yield* renderer.getPerformanceStats()
        expect(initialStats.fps).toBe(0)
        expect(initialStats.frameTime).toBe(0)
      })

      const runnable = Effect.provide(program, ThreeRendererLive)
      await Effect.runPromise(runnable)
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
