import { Context, Effect } from 'effect'
import * as THREE from 'three'
import type { RenderError } from './types.js'

/**
 * ThreeRenderer - 高度なThree.jsレンダリング機能
 *
 * Issue #129: P1-006 Three.js Layer実装の要件
 * - 60FPS描画最適化
 * - WebGL2サポート
 * - アンチエイリアシング
 * - シャドウマップ
 * - ポストプロセシング準備
 * - リサイズ対応
 */
export interface ThreeRenderer {
  /**
   * レンダラーの初期化
   *
   * WebGL2対応レンダラーを作成し、最適化された設定を適用
   * - アンチエイリアシング有効化
   * - シャドウマップ設定
   * - ポストプロセシング準備
   */
  readonly initialize: (canvas: HTMLCanvasElement) => Effect.Effect<void, RenderError>

  /**
   * 60FPS描画の実行
   *
   * パフォーマンス最適化されたレンダリング
   * - フレームタイミング監視
   * - 自動FPS調整
   * - GPU使用率最適化
   */
  readonly render: (scene: THREE.Scene, camera: THREE.Camera) => Effect.Effect<void, RenderError>

  /**
   * レンダラーのリサイズ
   *
   * ウィンドウサイズ変更への対応
   * - アスペクト比維持
   * - ピクセル比自動調整
   * - レンダーターゲット更新
   */
  readonly resize: (width: number, height: number) => Effect.Effect<void, never>

  /**
   * WebGL2機能の有効化
   *
   * WebGL2固有の機能を活用
   * - 高度なシェーダーサポート
   * - より多くのテクスチャユニット
   * - 改善されたパフォーマンス
   */
  readonly enableWebGL2Features: () => Effect.Effect<void, RenderError>

  /**
   * シャドウマップの設定
   *
   * 高品質な影の描画設定
   * - PCFSoftShadowMap使用
   * - カスケードシャドウマップ対応
   * - シャドウ解像度最適化
   */
  readonly configureShadowMap: (options?: {
    enabled?: boolean
    type?: THREE.ShadowMapType
    resolution?: number
  }) => Effect.Effect<void, never>

  /**
   * アンチエイリアシングの設定
   *
   * 画質向上のためのアンチエイリアシング
   * - MSAA対応
   * - FXAA/SMAA統合準備
   * - 動的品質調整
   */
  readonly configureAntialiasing: (options?: { enabled?: boolean; samples?: number }) => Effect.Effect<void, never>

  /**
   * ポストプロセシング設定
   *
   * レンダリング後の画像処理準備
   * - レンダーターゲット設定
   * - パス管理システム
   * - エフェクトチェーン
   */
  readonly setupPostprocessing: () => Effect.Effect<void, RenderError>

  /**
   * パフォーマンス統計の取得
   *
   * レンダリングパフォーマンスの監視
   * - FPS測定
   * - GPU使用率
   * - メモリ使用量
   */
  readonly getPerformanceStats: () => Effect.Effect<
    {
      fps: number
      frameTime: number
      memory: {
        geometries: number
        textures: number
      }
      render: {
        calls: number
        triangles: number
      }
    },
    never
  >

  /**
   * WebGLレンダラーインスタンスの取得
   *
   * 低レベルアクセス用
   */
  readonly getRenderer: () => Effect.Effect<THREE.WebGLRenderer | null, never>

  /**
   * WebGL2サポート状況の確認
   *
   * ブラウザのWebGL2対応状況をチェック
   */
  readonly isWebGL2Supported: () => Effect.Effect<boolean, never>

  /**
   * リソースの解放
   *
   * メモリリークを防ぐための適切なクリーンアップ
   */
  readonly dispose: () => Effect.Effect<void, never>
}

/**
 * ThreeRenderer サービスタグ
 */
export const ThreeRenderer = Context.GenericTag<ThreeRenderer>('@minecraft/infrastructure/ThreeRenderer')
