/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Effect, TestContext } from 'effect'
import * as THREE from 'three'
import { RendererService, RendererServiceLive } from '../index'
import { RenderInitError, RenderExecutionError, ContextLostError } from '../types'

// Canvas要素のモック
const createMockCanvas = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600
  // clientWidthとclientHeightをモック
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

// Three.jsのモック設定
vi.mock('three', async () => {
  const actual = await vi.importActual('three')
  return {
    ...actual,
    WebGLRenderer: vi.fn(),
  }
})

describe('RendererService', () => {
  let mockRenderer: any
  let mockCanvas: HTMLCanvasElement
  let mockContext: any

  beforeEach(() => {
    mockCanvas = createMockCanvas()
    mockContext = {
      isContextLost: vi.fn(() => false),
    }

    mockRenderer = {
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
      setClearColor: vi.fn(),
      render: vi.fn(),
      dispose: vi.fn(),
      getContext: vi.fn(() => mockContext),
      domElement: mockCanvas,
      shadowMap: {
        enabled: false,
        type: THREE.PCFSoftShadowMap,
      },
    }

    // WebGLRendererのモック
    ;(THREE.WebGLRenderer as any).mockImplementation(() => mockRenderer)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initialize', () => {
    it('Canvas要素を受け取ってレンダラーを正常に初期化する', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        const isInitialized = yield* service.isInitialized()
        expect(isInitialized).toBe(true)
      })

      const runnable = program.pipe(Effect.provide(RendererServiceLive))

      await Effect.runPromise(runnable)

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
      expect(mockRenderer.setPixelRatio).toHaveBeenCalled()
      expect(mockRenderer.setSize).toHaveBeenCalledWith(800, 600)
      expect(mockRenderer.setClearColor).toHaveBeenCalledWith(0x87ceeb, 1.0)
    })

    it('WebGLコンテキストの取得に失敗した場合はRenderInitErrorを投げる', async () => {
      mockRenderer.getContext = vi.fn(() => null)

      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
      })

      const runnable = program.pipe(Effect.provide(RendererServiceLive))

      await expect(Effect.runPromise(runnable)).rejects.toThrow(
        /RenderInitError.*WebGLコンテキストの取得に失敗しました/
      )
    })

    it('レンダラー作成時の例外をキャッチしてRenderInitErrorを投げる', async () => {
      ;(THREE.WebGLRenderer as any).mockImplementation(() => {
        throw new Error('WebGL not supported')
      })

      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
      })

      const runnable = program.pipe(Effect.provide(RendererServiceLive))

      await expect(Effect.runPromise(runnable)).rejects.toThrow(/RenderInitError.*レンダラーの初期化に失敗しました/)
    })
  })

  describe('render', () => {
    it('シーンとカメラを受け取って正常にレンダリングする', async () => {
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera()

      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.render(scene, camera)
      })

      const runnable = program.pipe(Effect.provide(RendererServiceLive))

      await Effect.runPromise(runnable)

      expect(mockRenderer.render).toHaveBeenCalledWith(scene, camera)
    })

    it('レンダラーが未初期化の場合はRenderExecutionErrorを投げる', async () => {
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera()

      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.render(scene, camera)
      })

      const runnable = program.pipe(Effect.provide(RendererServiceLive))

      await expect(Effect.runPromise(runnable)).rejects.toThrow(
        /RenderExecutionError.*レンダラーが初期化されていません/
      )
    })

    it('WebGLコンテキストが失われている場合はContextLostErrorを投げる', async () => {
      mockContext.isContextLost = vi.fn(() => true)
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera()

      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.render(scene, camera)
      })

      const runnable = program.pipe(Effect.provide(RendererServiceLive))

      await expect(Effect.runPromise(runnable)).rejects.toThrow(/ContextLostError.*WebGLコンテキストが失われています/)
    })

    it('レンダリング中の例外をキャッチしてRenderExecutionErrorを投げる', async () => {
      mockRenderer.render = vi.fn(() => {
        throw new Error('Rendering failed')
      })
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera()

      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.render(scene, camera)
      })

      const runnable = program.pipe(Effect.provide(RendererServiceLive))

      await expect(Effect.runPromise(runnable)).rejects.toThrow(
        /RenderExecutionError.*レンダリング実行中にエラーが発生しました/
      )
    })
  })

  describe('resize', () => {
    it('幅と高さを受け取ってレンダラーをリサイズする', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.resize(1024, 768)
      })

      const runnable = program.pipe(Effect.provide(RendererServiceLive))

      await Effect.runPromise(runnable)

      expect(mockRenderer.setSize).toHaveBeenCalledWith(1024, 768)
    })
  })

  describe('dispose', () => {
    it('レンダラーとリソースを適切に解放する', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.dispose()
        const isInitialized = yield* service.isInitialized()
        expect(isInitialized).toBe(false)
      })

      const runnable = program.pipe(Effect.provide(RendererServiceLive))

      await Effect.runPromise(runnable)

      expect(mockRenderer.dispose).toHaveBeenCalled()
    })
  })

  describe('getRenderer', () => {
    it('レンダラーインスタンスを取得する', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        const renderer = yield* service.getRenderer()
        expect(renderer).toBe(mockRenderer)
      })

      const runnable = program.pipe(Effect.provide(RendererServiceLive))

      await Effect.runPromise(runnable)
    })
  })

  describe('setClearColor', () => {
    it('クリア色を設定する', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.setClearColor(0xff0000, 0.5)
      })

      const runnable = program.pipe(Effect.provide(RendererServiceLive))

      await Effect.runPromise(runnable)

      expect(mockRenderer.setClearColor).toHaveBeenCalledWith(0xff0000, 0.5)
    })
  })

  describe('setPixelRatio', () => {
    it('ピクセル比を設定する', async () => {
      const program = Effect.gen(function* () {
        const service = yield* RendererService
        yield* service.initialize(mockCanvas)
        yield* service.setPixelRatio(2.0)
      })

      const runnable = program.pipe(Effect.provide(RendererServiceLive))

      await Effect.runPromise(runnable)

      expect(mockRenderer.setPixelRatio).toHaveBeenCalledWith(2.0)
    })
  })
})
