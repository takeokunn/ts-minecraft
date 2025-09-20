import { Context, Effect } from 'effect'
import * as THREE from 'three'
import type { RenderError } from './types'

/**
 * Three.js WebGLRendererのEffect-TSラッパーインターフェース
 *
 * レンダリングエンジンの抽象化を提供し、
 * WebGLコンテキストの管理とレンダリング処理を統一的に扱う
 */
export interface RendererService {
  /**
   * レンダラーの初期化
   *
   * Canvas要素を受け取り、WebGLコンテキストを作成する
   * レンダラーの基本設定（アンチエイリアス、ピクセル比など）を適用
   */
  readonly initialize: (canvas: HTMLCanvasElement) => Effect.Effect<void, RenderError>

  /**
   * シーンのレンダリング
   *
   * Three.jsのシーンとカメラを受け取り、フレームを描画する
   * エラーハンドリングを含む安全なレンダリング処理
   */
  readonly render: (scene: THREE.Scene, camera: THREE.Camera) => Effect.Effect<void, RenderError>

  /**
   * レンダラーのリサイズ
   *
   * ウィンドウサイズの変更に対応し、
   * アスペクト比を維持してレンダーターゲットを更新
   */
  readonly resize: (width: number, height: number) => Effect.Effect<void, never>

  /**
   * リソースの解放
   *
   * WebGLコンテキスト、テクスチャメモリ、
   * イベントリスナーなどのリソースを適切に解放
   */
  readonly dispose: () => Effect.Effect<void, never>

  /**
   * レンダラーインスタンスの取得
   *
   * 直接的なThree.js WebGLRendererへのアクセスが必要な場合用
   * 低レベル操作のためのエスケープハッチ
   */
  readonly getRenderer: () => Effect.Effect<THREE.WebGLRenderer | null, never>

  /**
   * レンダラーの状態確認
   *
   * 初期化状態とWebGLコンテキストの有効性を確認
   */
  readonly isInitialized: () => Effect.Effect<boolean, never>

  /**
   * クリア色の設定
   *
   * レンダリング前のバッファクリア色を設定
   */
  readonly setClearColor: (color: number, alpha?: number) => Effect.Effect<void, never>

  /**
   * ピクセル比の設定
   *
   * HiDPIデバイスでのブラー防止のためのピクセル比設定
   */
  readonly setPixelRatio: (ratio: number) => Effect.Effect<void, never>
}

export const RendererService = Context.GenericTag<RendererService>('@minecraft/infrastructure/RendererService')
