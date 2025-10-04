import { Context, Effect } from 'effect'
import type { GameApplicationInitError, GameApplicationRuntimeError, GameApplicationStateError } from './errors'
import type {
  ApplicationLifecycleState,
  GameApplicationConfig,
  GameApplicationConfigInput,
  GameApplicationState,
  Milliseconds,
} from './types'

/**
 * GameApplication - ゲームアプリケーション統合サービス
 *
 * Issue #176: Application Layer Integration - Game Systems Unity
 *
 * 責務:
 * - アプリケーションライフサイクル管理
 * - 全システムの統合（ECS, Renderer, Scene, Input, GameLoop）
 * - ゲーム状態管理
 * - システム間通信の調整
 * - エラー統合処理
 *
 * 成功基準:
 * - 黒画面でのThree.js描画確認
 * - 60FPS安定動作
 * - 全システム正常連携
 * - メモリリーク無し
 */
export interface GameApplication {
  /**
   * ゲームアプリケーションの初期化
   *
   * 全システムを統合し、アプリケーションの実行準備を行う
   * - GameLoop → Scene → Renderer連携の確立
   * - Input → ECS → GameLoop連携の確立
   * - Chunk → Mesh → Renderer連携の確立
   * - Camera → Input連携の確立
   */
  readonly initialize: (
    config?: Partial<GameApplicationConfigInput>
  ) => Effect.Effect<void, GameApplicationInitError, never>

  /**
   * ゲームアプリケーションの開始
   *
   * 初期化済みシステムを動作開始し、60FPS描画を開始
   * - GameLoopの開始
   * - レンダリングパイプラインの開始
   * - 入力システムの有効化
   */
  readonly start: () => Effect.Effect<void, GameApplicationRuntimeError, never>

  /**
   * ゲームアプリケーションの一時停止
   *
   * 描画とゲームロジックを一時停止し、状態を保持
   * - GameLoopの一時停止
   * - レンダリングの一時停止
   * - 入力の無効化
   */
  readonly pause: () => Effect.Effect<void, GameApplicationStateError, never>

  /**
   * ゲームアプリケーションの再開
   *
   * 一時停止状態から描画とゲームロジックを再開
   */
  readonly resume: () => Effect.Effect<void, GameApplicationStateError, never>

  /**
   * ゲームアプリケーションの停止
   *
   * 全システムを安全に停止し、リソースを解放
   * - GameLoopの停止
   * - レンダリングの停止
   * - リソースの解放
   */
  readonly stop: () => Effect.Effect<void, GameApplicationRuntimeError, never>

  /**
   * 現在のアプリケーション状態の取得
   *
   * 統合されたシステム状態の概要を提供
   */
  readonly getState: () => Effect.Effect<GameApplicationState, never, never>

  /**
   * ライフサイクル状態の取得
   *
   * アプリケーションの現在のライフサイクル段階を取得
   */
  readonly getLifecycleState: () => Effect.Effect<ApplicationLifecycleState, never, never>

  /**
   * フレーム更新の手動実行
   *
   * 単一フレームの更新を実行（デバッグ・テスト用）
   * - GameLoopの1フレーム実行
   * - Sceneの更新
   * - レンダリングの実行
   */
  readonly tick: (deltaTime?: Milliseconds) => Effect.Effect<void, GameApplicationRuntimeError, never>

  /**
   * 設定の更新
   *
   * 実行時のアプリケーション設定変更
   */
  readonly updateConfig: (
    config: Partial<GameApplicationConfigInput>
  ) => Effect.Effect<void, GameApplicationStateError, never>

  /**
   * システムヘルスチェック
   *
   * 全統合システムの健全性を確認
   * - 各サービスの状態確認
   * - パフォーマンス指標の確認
   * - メモリ使用量の確認
   */
  readonly healthCheck: () => Effect.Effect<
    {
      gameLoop: { status: 'healthy' | 'unhealthy'; fps?: number }
      renderer: { status: 'healthy' | 'unhealthy'; memory?: number }
      scene: { status: 'healthy' | 'unhealthy'; sceneCount?: number }
      input: { status: 'healthy' | 'unhealthy' }
      ecs: { status: 'healthy' | 'unhealthy'; entityCount?: number }
    },
    never,
    never
  >

  /**
   * アプリケーションのリセット
   *
   * 全システムを初期状態に戻す
   */
  readonly reset: () => Effect.Effect<void, GameApplicationRuntimeError, never>
}

/**
 * GameApplication サービスタグ
 */
export const GameApplication = Context.GenericTag<GameApplication>('@minecraft/application/GameApplication')
