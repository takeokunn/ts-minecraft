import { Context, Effect } from 'effect'
import type { FrameInfo, GameLoopConfig, GameLoopState, PerformanceMetrics } from '../types/types'
import type { GameLoopInitError, GameLoopPerformanceError, GameLoopRuntimeError, GameLoopStateError } from '../errors'
import type { DeltaTime } from '@domain/core/types/brands'

// ゲームループサービスのインターフェース
export interface GameLoopService {
  // ゲームループの初期化
  readonly initialize: (config?: Partial<GameLoopConfig>) => Effect.Effect<void, GameLoopInitError>

  // ゲームループの開始
  readonly start: () => Effect.Effect<void, GameLoopStateError>

  // ゲームループの一時停止
  readonly pause: () => Effect.Effect<void, GameLoopStateError>

  // ゲームループの再開
  readonly resume: () => Effect.Effect<void, GameLoopStateError>

  // ゲームループの停止
  readonly stop: () => Effect.Effect<void, GameLoopStateError>

  // フレーム更新コールバックの登録
  readonly onFrame: (callback: (frameInfo: FrameInfo) => Effect.Effect<void>) => Effect.Effect<() => void>

  // 現在の状態を取得
  readonly getState: () => Effect.Effect<GameLoopState>

  // パフォーマンスメトリクスの取得
  readonly getPerformanceMetrics: () => Effect.Effect<PerformanceMetrics, GameLoopPerformanceError>

  // 単一フレームの実行（テスト用）
  readonly tick: (deltaTime?: DeltaTime) => Effect.Effect<FrameInfo, GameLoopRuntimeError>

  // 設定の更新
  readonly updateConfig: (config: Partial<GameLoopConfig>) => Effect.Effect<void>

  // リセット
  readonly reset: () => Effect.Effect<void>
}

// Context.GenericTagを使用したサービスタグ
export const GameLoopService = Context.GenericTag<GameLoopService>('@minecraft/domain/GameLoopService')
