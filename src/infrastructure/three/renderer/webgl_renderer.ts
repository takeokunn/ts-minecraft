/**
 * @fileoverview Three.js WebGLRenderer - Effect-TSラッパー
 * THREE.WebGLRendererの完全関数型ラッパー実装
 */

import { Context, Effect, Layer, Pool, Schema, Scope } from 'effect'
import * as THREE from 'three'
import { RendererError } from '../errors'

/**
 * WebGLRenderer初期化パラメータ
 */
export const WebGLRendererParamsSchema = Schema.Struct({
  canvas: Schema.optional(Schema.Unknown),
  antialias: Schema.optional(Schema.Boolean),
  alpha: Schema.optional(Schema.Boolean),
  powerPreference: Schema.optional(Schema.Literal('default', 'high-performance', 'low-power')),
  stencil: Schema.optional(Schema.Boolean),
  preserveDrawingBuffer: Schema.optional(Schema.Boolean),
})

export type WebGLRendererParams = Schema.Schema.Type<typeof WebGLRendererParamsSchema>

/**
 * WebGLRendererを作成
 */
export const createRenderer = (params?: WebGLRendererParams): Effect.Effect<THREE.WebGLRenderer, RendererError> =>
  Effect.try({
    try: () => {
      const renderer = new THREE.WebGLRenderer({
        canvas: params?.canvas as HTMLCanvasElement | undefined,
        antialias: params?.antialias,
        alpha: params?.alpha,
        powerPreference: params?.powerPreference,
        stencil: params?.stencil,
        preserveDrawingBuffer: params?.preserveDrawingBuffer,
      })
      return renderer
    },
    catch: (error) => new RendererError({ operation: 'create', cause: error }),
  })

/**
 * Rendererのサイズを設定
 */
export const setSize = (
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
  updateStyle?: boolean
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    renderer.setSize(width, height, updateStyle)
  })

/**
 * Rendererのピクセル比を設定
 */
export const setPixelRatio = (renderer: THREE.WebGLRenderer, ratio: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    renderer.setPixelRatio(ratio)
  })

/**
 * クリアカラーを設定
 */
export const setClearColor = (
  renderer: THREE.WebGLRenderer,
  color: number | string | THREE.Color,
  alpha?: number
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    renderer.setClearColor(color, alpha)
  })

/**
 * シーンをレンダリング
 */
export const render = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
): Effect.Effect<void, RendererError> =>
  Effect.try({
    try: () => {
      renderer.render(scene, camera)
    },
    catch: (error) => new RendererError({ operation: 'render', cause: error }),
  })

/**
 * Rendererのリソースを解放
 */
export const dispose = (renderer: THREE.WebGLRenderer): Effect.Effect<void, never> =>
  Effect.sync(() => {
    renderer.dispose()
  })

/**
 * シャドウマップを有効化
 */
export const enableShadowMap = (renderer: THREE.WebGLRenderer): Effect.Effect<void, never> =>
  Effect.sync(() => {
    renderer.shadowMap.enabled = true
  })

/**
 * シャドウマップを無効化
 */
export const disableShadowMap = (renderer: THREE.WebGLRenderer): Effect.Effect<void, never> =>
  Effect.sync(() => {
    renderer.shadowMap.enabled = false
  })

/**
 * シャドウマップタイプを設定
 */
export const setShadowMapType = (
  renderer: THREE.WebGLRenderer,
  type: THREE.ShadowMapType
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    renderer.shadowMap.type = type
  })

/**
 * 出力エンコーディングを設定
 */
export const setOutputColorSpace = (
  renderer: THREE.WebGLRenderer,
  colorSpace: THREE.ColorSpace
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    renderer.outputColorSpace = colorSpace
  })

/**
 * トーンマッピングを設定
 */
export const setToneMapping = (
  renderer: THREE.WebGLRenderer,
  toneMapping: THREE.ToneMapping
): Effect.Effect<void, never> =>
  Effect.sync(() => {
    renderer.toneMapping = toneMapping
  })

/**
 * トーンマッピング露出を設定
 */
export const setToneMappingExposure = (renderer: THREE.WebGLRenderer, exposure: number): Effect.Effect<void, never> =>
  Effect.sync(() => {
    renderer.toneMappingExposure = exposure
  })

/**
 * 物理的に正確なライティングを有効化
 */
export const enablePhysicallyCorrectLights = (renderer: THREE.WebGLRenderer): Effect.Effect<void, never> =>
  Effect.sync(() => {
    renderer.useLegacyLights = false
  })

/**
 * レガシーライトモードを有効化
 */
export const enableLegacyLights = (renderer: THREE.WebGLRenderer): Effect.Effect<void, never> =>
  Effect.sync(() => {
    renderer.useLegacyLights = true
  })

/**
 * Rendererの情報を取得
 */
export const getInfo = (renderer: THREE.WebGLRenderer): Effect.Effect<THREE.WebGLInfo, never> =>
  Effect.sync(() => renderer.info)

/**
 * DOMエレメントを取得
 */
export const getDomElement = (renderer: THREE.WebGLRenderer): Effect.Effect<HTMLCanvasElement, never> =>
  Effect.sync(() => renderer.domElement)

// Service/Layer実装

/**
 * WebGLRendererService定義
 */
export interface WebGLRendererService {
  readonly renderer: THREE.WebGLRenderer
  readonly render: (scene: THREE.Scene, camera: THREE.Camera) => Effect.Effect<void, RendererError>
  readonly setSize: (width: number, height: number, updateStyle?: boolean) => Effect.Effect<void, never>
  readonly setPixelRatio: (ratio: number) => Effect.Effect<void, never>
  readonly setClearColor: (color: number | string | THREE.Color, alpha?: number) => Effect.Effect<void, never>
  readonly getDomElement: Effect.Effect<HTMLCanvasElement, never>
}

export const WebGLRendererService = Context.GenericTag<WebGLRendererService>(
  '@minecraft/infrastructure/three/WebGLRendererService'
)

/**
 * WebGLRendererServiceLive - Effect.Scopeによる自動リソース管理
 */
export const WebGLRendererServiceLive = (params?: WebGLRendererParams) =>
  Layer.scoped(
    WebGLRendererService,
    Effect.gen(function* () {
      // Rendererを作成し、Scopeに登録（自動dispose）
      const renderer = yield* Effect.acquireRelease(createRenderer(params), (r) => dispose(r))

      return WebGLRendererService.of({
        renderer,
        render: (scene, camera) => render(renderer, scene, camera),
        setSize: (width, height, updateStyle) => setSize(renderer, width, height, updateStyle),
        setPixelRatio: (ratio) => setPixelRatio(renderer, ratio),
        setClearColor: (color, alpha) => setClearColor(renderer, color, alpha),
        getDomElement: getDomElement(renderer),
      })
    })
  )

/**
 * ✅ Pool-based WebGLRenderer管理
 * 複数のRendererインスタンスをプールで効率管理
 * オフスクリーンレンダリングやマルチビューポートで使用
 */
export const makeWebGLRendererPool = (
  poolSize: number = 3,
  params?: WebGLRendererParams
): Effect.Effect<Pool.Pool<THREE.WebGLRenderer, RendererError>, never, Scope.Scope> =>
  Pool.make({
    acquire: Effect.acquireRelease(createRenderer(params), (renderer) => dispose(renderer)),
    size: poolSize,
  })

/**
 * PoolからRendererを取得して処理実行
 */
export const withPooledRenderer = <A, E>(
  pool: Pool.Pool<THREE.WebGLRenderer, RendererError>,
  f: (renderer: THREE.WebGLRenderer) => Effect.Effect<A, E>
): Effect.Effect<A, E | RendererError> => Pool.use(pool, f)

/**
 * デフォルトパラメータでのWebGLRendererServiceLive
 */
export const WebGLRendererServiceLiveDefault = WebGLRendererServiceLive({
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
})
