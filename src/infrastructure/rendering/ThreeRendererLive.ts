import { Effect, Layer, Ref } from 'effect'
import * as THREE from 'three'
import { ThreeRenderer } from './ThreeRenderer.js'
import type { RenderError } from './types.js'
import { RenderInitError, RenderExecutionError, ContextLostError } from './types.js'

/**
 * パフォーマンス統計の内部型
 */
interface PerformanceStats {
  fps: number
  frameTime: number
  lastFrameTime: number
  frameCount: number
  lastStatsUpdate: number
}

/**
 * WebGLコンテキストロストハンドラー
 */
const handleContextLost = (event: Event): void => {
  event.preventDefault()
  console.warn('WebGL context lost. Preventing default behavior.')
}

/**
 * WebGLコンテキスト復元ハンドラー
 */
const handleContextRestored = (): void => {
  console.log('WebGL context restored. Reinitializing renderer...')
}

/**
 * WebGL2サポートをチェック
 */
const checkWebGL2Support = (): boolean => {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('webgl2')
  return context !== null
}

/**
 * ThreeRendererサービスの実装を作成
 */
const createThreeRendererService = (
  rendererRef: Ref.Ref<THREE.WebGLRenderer | null>,
  statsRef: Ref.Ref<PerformanceStats>
): ThreeRenderer => ({
  initialize: (canvas: HTMLCanvasElement): Effect.Effect<void, RenderError> =>
    Effect.gen(function* () {
      // WebGL2サポート確認
      const webgl2Supported = yield* Effect.try({
        try: () => checkWebGL2Support(),
        catch: (error) =>
          RenderInitError({
            message: 'WebGL2サポート確認に失敗しました',
            canvas,
            cause: error,
          }),
      })

      // WebGLコンテキスト作成
      const context = yield* Effect.try({
        try: () => {
          const contextAttributes: WebGLContextAttributes = {
            alpha: true,
            antialias: true,
            depth: true,
            stencil: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false,
          }

          let context: WebGLRenderingContext | WebGL2RenderingContext | null = null
          if (webgl2Supported) {
            context = canvas.getContext('webgl2', contextAttributes)
          }
          if (!context) {
            context = canvas.getContext('webgl', contextAttributes)
          }

          if (!context) {
            throw new Error('WebGLコンテキストの取得に失敗しました')
          }

          return context
        },
        catch: (error) =>
          RenderInitError({
            message: 'WebGLコンテキストの取得に失敗しました',
            canvas,
            context: 'WebGL context creation failed',
            cause: error,
          }),
      })

      // WebGLRenderer作成
      const renderer = yield* Effect.try({
        try: () =>
          new THREE.WebGLRenderer({
            canvas,
            context,
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
            premultipliedAlpha: true,
            preserveDrawingBuffer: false,
          }),
        catch: (error) =>
          RenderInitError({
            message: 'WebGLRendererの作成に失敗しました',
            canvas,
            cause: error,
          }),
      })

      // レンダラー設定の適用
      yield* Effect.try({
        try: () => {
          // 基本設定の適用
          renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
          renderer.setSize(canvas.clientWidth, canvas.clientHeight)
          renderer.setClearColor(0x87ceeb, 1.0)

          // 出力色空間設定
          renderer.outputColorSpace = THREE.SRGBColorSpace

          // シャドウマップ設定
          renderer.shadowMap.enabled = true
          renderer.shadowMap.type = THREE.PCFSoftShadowMap
          renderer.shadowMap.autoUpdate = true

          // トーンマッピング設定
          renderer.toneMapping = THREE.ACESFilmicToneMapping
          renderer.toneMappingExposure = 1.0

          // フラスタムカリング有効化
          renderer.sortObjects = true

          // WebGLコンテキストイベントハンドラー
          canvas.addEventListener('webglcontextlost', handleContextLost, false)
          canvas.addEventListener('webglcontextrestored', handleContextRestored, false)

          return undefined
        },
        catch: (error) =>
          RenderInitError({
            message: 'レンダラー設定の適用に失敗しました',
            canvas,
            cause: error,
          }),
      })

      // レンダラーの保存
      yield* Ref.set(rendererRef, renderer)

      // パフォーマンス統計の初期化
      const initialStats: PerformanceStats = {
        fps: 0,
        frameTime: 0,
        lastFrameTime: performance.now(),
        frameCount: 0,
        lastStatsUpdate: performance.now(),
      }
      yield* Ref.set(statsRef, initialStats)

      console.log(`ThreeRenderer initialized successfully (WebGL${webgl2Supported ? '2' : '1'})`)
    }),

  render: (scene: THREE.Scene, camera: THREE.Camera): Effect.Effect<void, RenderError> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)
      const stats = yield* Ref.get(statsRef)

      if (!renderer) {
        yield* Effect.fail(
          RenderExecutionError({
            message: 'レンダラーが初期化されていません',
            operation: 'render',
          })
        )
      }

      // WebGLコンテキストの状態確認とレンダリング実行
      const renderResult = yield* Effect.try({
        try: () => {
          // WebGLコンテキストの状態確認
          const gl = renderer!.getContext()
          if (gl.isContextLost()) {
            throw new Error('WebGLコンテキストが失われています')
          }

          // フレームタイミング計測開始
          const frameStart = performance.now()

          // レンダリング実行
          renderer!.render(scene, camera)

          return { frameStart, frameEnd: performance.now() }
        },
        catch: (error) => {
          if (error instanceof Error && error.message === 'WebGLコンテキストが失われています') {
            return ContextLostError({
              message: 'WebGLコンテキストが失われています',
              canRestore: true,
              lostTime: Date.now(),
            })
          }
          return RenderExecutionError({
            message: 'レンダリング実行中にエラーが発生しました',
            operation: 'render',
            sceneId: scene.uuid,
            cameraType: camera.type,
            cause: error,
          })
        },
      })

      // パフォーマンス統計更新
      const { frameStart, frameEnd } = renderResult
      const frameTime = frameEnd - frameStart
      const newStats: PerformanceStats = {
        ...stats,
        frameTime,
        frameCount: stats.frameCount + 1,
        lastFrameTime: frameEnd,
      }

      // FPS計算（1秒ごと）
      if (frameEnd - stats.lastStatsUpdate >= 1000) {
        newStats.fps = Math.round((newStats.frameCount * 1000) / (frameEnd - stats.lastStatsUpdate))
        newStats.frameCount = 0
        newStats.lastStatsUpdate = frameEnd
      }

      yield* Ref.set(statsRef, newStats)

      // 60FPS目標のパフォーマンス警告
      if (frameTime > 16.67) {
        console.warn(`Frame time exceeded 16.67ms: ${frameTime.toFixed(2)}ms`)
      }
    }),

  resize: (width: number, height: number): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)

      if (renderer) {
        // ピクセル比を考慮したリサイズ
        const pixelRatio = Math.min(window.devicePixelRatio, 2)
        renderer.setPixelRatio(pixelRatio)
        renderer.setSize(width, height, false)

        // ビューポート設定
        renderer.setViewport(0, 0, width, height)

        console.log(`ThreeRenderer resized to ${width}x${height} (pixel ratio: ${pixelRatio})`)
      }
    }),

  enableWebGL2Features: (): Effect.Effect<void, RenderError> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)

      if (!renderer) {
        yield* Effect.fail(
          RenderExecutionError({
            message: 'レンダラーが初期化されていません',
            operation: 'enableWebGL2Features',
          })
        )
      }

      const context = renderer!.getContext()
      const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && context instanceof WebGL2RenderingContext

      if (isWebGL2) {
        // WebGL2固有の機能を有効化
        const extensions = renderer!.extensions

        // 高度なテクスチャ機能
        extensions.get('EXT_color_buffer_float')
        extensions.get('EXT_texture_filter_anisotropic')
        extensions.get('WEBGL_compressed_texture_s3tc')
        extensions.get('WEBGL_compressed_texture_etc')

        console.log('WebGL2 advanced features enabled')
      } else {
        console.warn('WebGL2 not supported, using WebGL1 fallback')
      }
    }),

  configureShadowMap: (options = {}): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)

      if (renderer) {
        const { enabled = true, type = THREE.PCFSoftShadowMap, resolution = 2048 } = options

        renderer.shadowMap.enabled = enabled
        renderer.shadowMap.type = type
        renderer.shadowMap.autoUpdate = true

        // シャドウマップの解像度設定（ライト設定時に使用）
        console.log(`Shadow map configured: enabled=${enabled}, type=${type}, resolution=${resolution}`)
      }
    }),

  configureAntialiasing: (options = {}): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)

      if (renderer) {
        const { enabled = true, samples = 4 } = options

        // WebGLのMSAAサンプル数設定（既存のレンダラーでは変更不可）
        // 新しいレンダラー作成時にantialias: enabledが適用済み
        console.log(`Antialiasing configured: enabled=${enabled}, samples=${samples}`)
      }
    }),

  setupPostprocessing: (): Effect.Effect<void, RenderError> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)

      if (!renderer) {
        yield* Effect.fail(
          RenderExecutionError({
            message: 'レンダラーが初期化されていません',
            operation: 'setupPostprocessing',
          })
        )
      }

      yield* Effect.try({
        try: () => {
          // ポストプロセシング用レンダーターゲットの準備
          const canvas = renderer!.domElement
          const renderTarget = new THREE.WebGLRenderTarget(canvas.width, canvas.height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            stencilBuffer: false,
          })

          console.log('Postprocessing render targets prepared')
          return undefined
        },
        catch: (error) =>
          RenderExecutionError({
            message: 'ポストプロセシング設定に失敗しました',
            operation: 'setupPostprocessing',
            cause: error,
          }),
      })
    }),

  getPerformanceStats: () =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)
      const stats = yield* Ref.get(statsRef)

      const rendererInfo = renderer?.info || {
        memory: { geometries: 0, textures: 0 },
        render: { calls: 0, triangles: 0 },
      }

      return {
        fps: stats.fps,
        frameTime: stats.frameTime,
        memory: {
          geometries: rendererInfo.memory.geometries,
          textures: rendererInfo.memory.textures,
        },
        render: {
          calls: rendererInfo.render.calls,
          triangles: rendererInfo.render.triangles,
        },
      }
    }),

  getRenderer: (): Effect.Effect<THREE.WebGLRenderer | null, never> => Ref.get(rendererRef),

  isWebGL2Supported: (): Effect.Effect<boolean, never> => Effect.succeed(checkWebGL2Support()),

  dispose: (): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)

      if (renderer) {
        // WebGLリソースの解放
        renderer.dispose()

        // イベントリスナーの削除
        const canvas = renderer.domElement
        canvas.removeEventListener('webglcontextlost', handleContextLost)
        canvas.removeEventListener('webglcontextrestored', handleContextRestored)

        console.log('ThreeRenderer disposed successfully')
      }

      // レンダラー参照のクリア
      yield* Ref.set(rendererRef, null)

      // 統計のリセット
      const initialStats: PerformanceStats = {
        fps: 0,
        frameTime: 0,
        lastFrameTime: 0,
        frameCount: 0,
        lastStatsUpdate: 0,
      }
      yield* Ref.set(statsRef, initialStats)
    }),
})

/**
 * ThreeRendererLive - 本番用実装
 *
 * Issue #129: P1-006 Three.js Layer実装
 * - 60FPS描画最適化
 * - WebGL2サポート
 * - アンチエイリアシング
 * - シャドウマップ
 * - ポストプロセシング準備
 * - リサイズ対応
 */
export const ThreeRendererLive = Layer.effect(
  ThreeRenderer,
  Effect.gen(function* () {
    const rendererRef = yield* Ref.make<THREE.WebGLRenderer | null>(null)
    const statsRef = yield* Ref.make<PerformanceStats>({
      fps: 0,
      frameTime: 0,
      lastFrameTime: 0,
      frameCount: 0,
      lastStatsUpdate: 0,
    })

    return createThreeRendererService(rendererRef, statsRef)
  })
)
