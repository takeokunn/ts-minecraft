import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Effect } from 'effect'
import * as THREE from 'three'
import { ThreeRenderer } from '../ThreeRenderer'
import { ThreeRendererLive } from '../ThreeRendererLive'

// Canvas要素のモック
const createMockCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600
  Object.defineProperty(canvas, 'clientWidth', { value: 800, writable: false })
  Object.defineProperty(canvas, 'clientHeight', { value: 600, writable: false })
  return canvas
}

// WebGLコンテキストのモック
const createMockWebGLContext = (isWebGL2 = false) => ({
  isContextLost: vi.fn().mockReturnValue(false),
  getExtension: vi.fn().mockReturnValue({}),
  ...(isWebGL2 && { constructor: { name: 'WebGL2RenderingContext' } }),
})

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
      getContext: vi.fn().mockReturnValue(createMockWebGLContext()),
      domElement: createMockCanvas(),
      shadowMap: {
        enabled: false,
        type: actual['PCFShadowMap'],
        autoUpdate: true,
      },
      info: {
        memory: { geometries: 0, textures: 0 },
        render: { calls: 0, triangles: 0 },
      },
      outputColorSpace: actual['SRGBColorSpace'],
      toneMapping: actual['NoToneMapping'],
      toneMappingExposure: 1.0,
      sortObjects: true,
      extensions: {
        get: vi.fn().mockReturnValue({}),
      },
    })),
    WebGLRenderTarget: vi.fn().mockImplementation(() => ({
      width: 800,
      height: 600,
      dispose: vi.fn(),
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

    // Canvas WebGLコンテキストのモック
    vi.spyOn(canvas, 'getContext').mockImplementation((type: string) => {
      if (type === 'webgl2' || type === 'webgl') {
        return createMockWebGLContext(type === 'webgl2') as unknown as WebGLRenderingContext
      }
      return null
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('基本機能', () => {
    it('正常に初期化できる', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        const rendererInstance = yield* renderer.getRenderer()
        expect(rendererInstance).not.toBeNull()
      })

      Effect.runSync(Effect.provide(program, ThreeRendererLive))
    })

    it('WebGL2サポート状況を確認できる', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        const isSupported = yield* renderer.isWebGL2Supported()
        expect(typeof isSupported).toBe('boolean')
      })

      Effect.runSync(Effect.provide(program, ThreeRendererLive))
    })

    it('シーンを正常にレンダリングできる', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.render(scene, camera)
      })

      Effect.runSync(Effect.provide(program, ThreeRendererLive))
    })

    it('レンダラーのサイズを変更できる', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.resize(1024, 768)
      })

      Effect.runSync(Effect.provide(program, ThreeRendererLive))
    })
  })

  describe('設定機能', () => {
    it('シャドウマップを設定できる', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.configureShadowMap({
          enabled: true,
          type: THREE['PCFSoftShadowMap'],
          resolution: 2048,
        })
      })

      Effect.runSync(Effect.provide(program, ThreeRendererLive))
    })

    it('アンチエイリアシングを設定できる', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.configureAntialiasing({
          enabled: true,
          samples: 4,
        })
      })

      Effect.runSync(Effect.provide(program, ThreeRendererLive))
    })

    it('WebGL2機能を有効化できる', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.enableWebGL2Features()
      })

      Effect.runSync(Effect.provide(program, ThreeRendererLive))
    })

    it('ポストプロセシングを設定できる', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.setupPostprocessing()
      })

      Effect.runSync(Effect.provide(program, ThreeRendererLive))
    })

    it('WebGL2機能有効化時にWebGL2パスが実行される', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // WebGL2コンテキストのセットアップ
      const originalWebGL2 = global.WebGL2RenderingContext
      global.WebGL2RenderingContext = class MockWebGL2RenderingContext {
        isContextLost = vi.fn().mockReturnValue(false)
        getExtension = vi.fn()
      } as any

      const webgl2Instance = new global.WebGL2RenderingContext()

      // WebGLRendererモックをWebGL2対応に変更
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
            shadowMap: { enabled: false, type: THREE['PCFShadowMap'], autoUpdate: true },
            info: { memory: { geometries: 0, textures: 0 }, render: { calls: 0, triangles: 0 } },
            outputColorSpace: THREE['SRGBColorSpace'],
            toneMapping: THREE['NoToneMapping'],
            toneMappingExposure: 1.0,
            sortObjects: true,
            extensions: { get: vi.fn().mockReturnValue({}) },
          }) as unknown as THREE.WebGLRenderer
      )

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.enableWebGL2Features()
      })

      Effect.runSync(Effect.provide(program, ThreeRendererLive))

      expect(consoleSpy).toHaveBeenCalledWith('WebGL2 advanced features enabled')

      // クリーンアップ
      consoleSpy.mockRestore()
      global.WebGL2RenderingContext = originalWebGL2
    })

    it('初期化前の設定変更は安全に実行される', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.configureShadowMap({ enabled: true })
        yield* renderer.configureAntialiasing({ enabled: true })
        yield* renderer.resize(1920, 1080)
      })

      Effect.runSync(Effect.provide(program, ThreeRendererLive))
    })
  })

  describe('パフォーマンス監視', () => {
    it('パフォーマンス統計を取得できる', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)

        // レンダリング実行
        for (let i = 0; i < 3; i++) {
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

      Effect.runSync(Effect.provide(program, ThreeRendererLive))
    })

    it('パフォーマンス統計の初期値を確認できる', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer

        // 初期化前の統計
        const initialStats = yield* renderer.getPerformanceStats()
        expect(initialStats.fps).toBe(0)
        expect(initialStats.frameTime).toBe(0)
        expect(initialStats.memory).toEqual({ geometries: 0, textures: 0 })
        expect(initialStats.render).toEqual({ calls: 0, triangles: 0 })
      })

      Effect.runSync(Effect.provide(program, ThreeRendererLive))
    })

    it('フレームタイム警告機能が動作する', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // performance.nowをモックして長いフレーム時間をシミュレート
      let callCount = 0
      const mockNow = vi.spyOn(performance, 'now').mockImplementation(() => {
        callCount++
        // フレーム開始時と終了時で20msの差を作る（16.67ms以上なので警告発生）
        return callCount % 2 === 1 ? 0 : 20
      })

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.render(scene, camera)
      })

      Effect.runSync(Effect.provide(program, ThreeRendererLive))

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Frame time exceeded 16\.67ms/))

      consoleSpy.mockRestore()
      mockNow.mockRestore()
    })
  })

  describe('エラーハンドリング', () => {
    it('初期化前のレンダリングでエラーが発生する', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.render(scene, camera)
      })

      expect(Effect.runSync(Effect.provide(program, ThreeRendererLive))).rejects.toThrow()
    })

    it('初期化前のWebGL2機能有効化でエラーが発生する', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.enableWebGL2Features()
      })

      expect(Effect.runSync(Effect.provide(program, ThreeRendererLive))).rejects.toThrow()
    })

    it('初期化前のポストプロセシング設定でエラーが発生する', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.setupPostprocessing()
      })

      expect(Effect.runSync(Effect.provide(program, ThreeRendererLive))).rejects.toThrow()
    })

    it('WebGLコンテキスト作成失敗でエラーが発生する', () => {
      const canvas = createMockCanvas()
      vi.spyOn(canvas, 'getContext').mockReturnValue(null)

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
      })

      expect(Effect.runSync(Effect.provide(program, ThreeRendererLive))).rejects.toThrow()
    })

    it('WebGLコンテキストロスト時のエラーハンドリング', () => {
      // コンテキストロスト状態のモック
      vi.mocked(THREE.WebGLRenderer).mockImplementationOnce(
        () =>
          ({
            setPixelRatio: vi.fn(),
            setSize: vi.fn(),
            setClearColor: vi.fn(),
            setViewport: vi.fn(),
            render: vi.fn(),
            dispose: vi.fn(),
            getContext: vi.fn().mockReturnValue({
              isContextLost: vi.fn().mockReturnValue(true), // ロスト状態
            }),
            domElement: canvas,
            shadowMap: { enabled: false, type: THREE['PCFShadowMap'], autoUpdate: true },
            info: { memory: { geometries: 0, textures: 0 }, render: { calls: 0, triangles: 0 } },
            outputColorSpace: THREE['SRGBColorSpace'],
            toneMapping: THREE['NoToneMapping'],
            toneMappingExposure: 1.0,
            sortObjects: true,
            extensions: { get: vi.fn().mockReturnValue({}) },
          }) as unknown as THREE.WebGLRenderer
      )

      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.render(scene, camera)
      })

      expect(Effect.runSync(Effect.provide(program, ThreeRendererLive))).rejects.toThrow()
    })
  })

  describe('リソース管理', () => {
    it('リソースを正常に解放できる', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer
        yield* renderer.initialize(canvas)
        yield* renderer.dispose()

        const rendererInstance = yield* renderer.getRenderer()
        expect(rendererInstance).toBeNull()
      })

      Effect.runSync(Effect.provide(program, ThreeRendererLive))
    })

    it('初期化状態を正しく判定できる', () => {
      const program = Effect.gen(function* () {
        const renderer = yield* ThreeRenderer

        // 初期化前
        const beforeInit = yield* renderer.getRenderer()
        expect(beforeInit).toBeNull()

        // 初期化後
        yield* renderer.initialize(canvas)
        const afterInit = yield* renderer.getRenderer()
        expect(afterInit).not.toBeNull()
      })

      Effect.runSync(Effect.provide(program, ThreeRendererLive))
    })
  })
})
