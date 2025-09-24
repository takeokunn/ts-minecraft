import { Effect, Layer, Ref, pipe, Match, Option, Predicate } from 'effect'
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
      // WebGLRendererの作成
      const renderer = yield* Effect.try({
        try: () =>
          new THREE.WebGLRenderer({
            canvas,
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

      // 基本設定の適用
      yield* Effect.try({
        try: () => {
          renderer.setPixelRatio(window.devicePixelRatio)
          renderer.setSize(canvas.clientWidth, canvas.clientHeight)
          renderer.setClearColor(0x87ceeb, 1.0) // スカイブルー
          renderer.shadowMap.enabled = true
          renderer.shadowMap.type = THREE.PCFSoftShadowMap
        },
        catch: (error) =>
          RenderInitError({
            message: 'レンダラー設定の適用に失敗しました',
            canvas,
            cause: error,
          }),
      })

      // WebGLコンテキストの検証
      const gl = yield* Effect.try({
        try: () => {
          const context = renderer.getContext()
          return pipe(
            Option.fromNullable(context),
            Option.getOrElse(() => {
              throw new Error('WebGLコンテキストの取得に失敗しました')
            })
          )
        },
        catch: (error) =>
          RenderInitError({
            message: 'WebGLコンテキストの取得に失敗しました',
            canvas,
            context: 'WebGL context creation failed',
            cause: error,
          }),
      })

      // WebGLコンテキストロストのハンドリング
      yield* Effect.try({
        try: () => {
          canvas.addEventListener('webglcontextlost', handleContextLost, false)
          canvas.addEventListener('webglcontextrestored', handleContextRestored, false)
        },
        catch: (error) =>
          RenderInitError({
            message: 'WebGLコンテキストイベントリスナーの設定に失敗しました',
            canvas,
            cause: error,
          }),
      })

      // レンダラーの保存
      yield* Ref.set(rendererRef, renderer)

      console.log('WebGLRenderer initialized successfully')
    }),

  render: (scene: THREE.Scene, camera: THREE.Camera): Effect.Effect<void, RenderError> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)

      yield* pipe(
        Option.fromNullable(renderer),
        Option.match({
          onNone: () =>
            Effect.fail(
              RenderExecutionError({
                message: 'レンダラーが初期化されていません',
                operation: 'render',
              })
            ),
          onSome: () => Effect.void,
        })
      )

      // WebGLコンテキストの状態確認とレンダリング実行
      yield* Effect.try({
        try: () => {
          // WebGLコンテキストの状態確認をMatchパターンで実装
          const gl = renderer!.getContext()
          const contextLost = gl.isContextLost()

          pipe(
            contextLost,
            Match.value,
            Match.when(true, () => {
              throw new Error('WebGLコンテキストが失われています')
            }),
            Match.when(false, () => {}),
            Match.exhaustive
          )

          // レンダリング実行
          renderer!.render(scene, camera)
        },
        catch: (error) =>
          pipe(
            error,
            Match.value,
            Match.when(
              (err: any): err is Error =>
                Predicate.isRecord(err) &&
                'message' in err &&
                'name' in err &&
                Predicate.isString(err.message) &&
                err.message === 'WebGLコンテキストが失われています',
              () =>
                ContextLostError({
                  message: 'WebGLコンテキストが失われています',
                  canRestore: true,
                  lostTime: Date.now(),
                })
            ),
            Match.orElse((err: any) =>
              RenderExecutionError({
                message: 'レンダリング実行中にエラーが発生しました',
                operation: 'render',
                sceneId: scene.uuid,
                cameraType: camera.type,
                cause: err,
              })
            )
          ),
      })
    }),

  resize: (width: number, height: number): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)

      yield* pipe(
        Option.fromNullable(renderer),
        Option.match({
          onNone: () => Effect.void,
          onSome: (renderer) =>
            Effect.sync(() => {
              renderer.setSize(width, height)
              console.log(`Renderer resized to ${width}x${height}`)
            }),
        })
      )
    }),

  dispose: (): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)

      yield* pipe(
        Option.fromNullable(renderer),
        Option.match({
          onNone: () => Effect.void,
          onSome: (renderer) =>
            Effect.sync(() => {
              // WebGLリソースの解放
              renderer.dispose()

              // イベントリスナーの削除
              const canvas = renderer.domElement
              canvas.removeEventListener('webglcontextlost', handleContextLost)
              canvas.removeEventListener('webglcontextrestored', handleContextRestored)

              console.log('WebGLRenderer disposed successfully')
            }),
        })
      )

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

      yield* pipe(
        Option.fromNullable(renderer),
        Option.match({
          onNone: () => Effect.void,
          onSome: (renderer) =>
            Effect.sync(() => {
              renderer.setClearColor(color, alpha)
            }),
        })
      )
    }),

  setPixelRatio: (ratio: number): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      const renderer = yield* Ref.get(rendererRef)

      yield* pipe(
        Option.fromNullable(renderer),
        Option.match({
          onNone: () => Effect.void,
          onSome: (renderer) =>
            Effect.sync(() => {
              renderer.setPixelRatio(ratio)
            }),
        })
      )
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
