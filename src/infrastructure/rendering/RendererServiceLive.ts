import { Effect, Layer, Ref } from 'effect'
import * as THREE from 'three'
import type { RendererService } from './RendererService'
import { RendererService as RendererServiceTag } from './RendererService'
import { RenderInitError, RenderExecutionError, ContextLostError, type RenderError } from './types'

/**
 * WebGLコンテキストロストのハンドリング
 */
const handleContextLost = (event: Event): void => {
  event.preventDefault()
  console.warn('WebGLコンテキストが失われました')
}

const handleContextRestored = (): void => {
  console.log('WebGLコンテキストが復元されました')
}

/**
 * RendererServiceの関数型実装
 *
 * Three.js WebGLRendererをEffect-TSパターンでラップし、
 * 安全なレンダリング処理とリソース管理を提供
 */
const createRendererService = (rendererRef: Ref.Ref<THREE.WebGLRenderer | null>): RendererService => ({
  initialize: (canvas: HTMLCanvasElement): Effect.Effect<void, RenderError> =>
    Effect.gen(function* () {
      try {
        // WebGLRendererの作成
        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
        })

        // 基本設定の適用
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(canvas.clientWidth, canvas.clientHeight)
        renderer.setClearColor(0x87ceeb, 1.0) // スカイブルー
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFSoftShadowMap

        // WebGLコンテキストの検証
        const gl = renderer.getContext()
        if (!gl) {
          yield* Effect.fail(
            RenderInitError({
              message: 'WebGLコンテキストの取得に失敗しました',
              canvas,
              context: 'WebGL context creation failed',
            })
          )
        }

        // WebGLコンテキストロストのハンドリング
        canvas.addEventListener('webglcontextlost', handleContextLost, false)
        canvas.addEventListener('webglcontextrestored', handleContextRestored, false)

        // レンダラーの保存
        yield* Ref.set(rendererRef, renderer)

        console.log('WebGLRenderer initialized successfully')
      } catch (error) {
        yield* Effect.fail(
          RenderInitError({
            message: 'レンダラーの初期化に失敗しました',
            canvas,
            cause: error,
          })
        )
      }
    }),

  render: (scene: THREE.Scene, camera: THREE.Camera): Effect.Effect<void, RenderError> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)

      if (!renderer) {
        yield* Effect.fail(
          RenderExecutionError({
            message: 'レンダラーが初期化されていません',
            operation: 'render',
          })
        )
      }

      try {
        // WebGLコンテキストの状態確認
        const gl = renderer!.getContext()
        if (gl.isContextLost()) {
          yield* Effect.fail(
            ContextLostError({
              message: 'WebGLコンテキストが失われています',
              canRestore: true,
              lostTime: Date.now(),
            })
          )
        }

        // レンダリング実行
        renderer!.render(scene, camera)
      } catch (error) {
        yield* Effect.fail(
          RenderExecutionError({
            message: 'レンダリング実行中にエラーが発生しました',
            operation: 'render',
            sceneId: scene.uuid,
            cameraType: camera.type,
            cause: error,
          })
        )
      }
    }),

  resize: (width: number, height: number): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)

      if (renderer) {
        renderer.setSize(width, height)
        console.log(`Renderer resized to ${width}x${height}`)
      }
    }),

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

        console.log('WebGLRenderer disposed successfully')
      }

      // レンダラー参照のクリア
      yield* Ref.set(rendererRef, null)
    }),

  getRenderer: (): Effect.Effect<THREE.WebGLRenderer | null, never> => Ref.get(rendererRef),

  isInitialized: (): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)
      return renderer !== null
    }),

  setClearColor: (color: number, alpha = 1.0): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)

      if (renderer) {
        renderer.setClearColor(color, alpha)
      }
    }),

  setPixelRatio: (ratio: number): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)

      if (renderer) {
        renderer.setPixelRatio(ratio)
      }
    }),
})

/**
 * RendererServiceのLiveレイヤー
 *
 * Effect-TSのレイヤーパターンに従い、
 * RendererServiceの実装を提供する
 */
export const RendererServiceLive = Layer.effect(
  RendererServiceTag,
  Effect.gen(function* () {
    const rendererRef = yield* Ref.make<THREE.WebGLRenderer | null>(null)
    return createRendererService(rendererRef)
  })
)
