/**
 * Application Layer - ユースケースとアプリケーションロジック
 *
 * Issue #176: Application Layer Integration - Game Systems Unity
 *
 * このレイヤーはビジネスユースケースを実装し、
 * ドメイン層とインフラストラクチャ層を調整します。
 * Effect-TSのワークフローパターンで実装されます。
 *
 * 主要コンポーネント:
 * - GameApplication: 全システム統合サービス
 * - GameApplicationLive: 本番環境実装
 * - 型定義とエラーハンドリング
 */

// ===== メインアプリケーションサービス =====
export { GameApplication } from './GameApplication'
export { GameApplicationLive } from './GameApplicationLive'

// ===== 型定義 =====
export type {
  GameApplicationConfig,
  GameApplicationState,
  ApplicationLifecycleState,
  SystemStatus,
  GameLoopState,
  RendererState,
  SceneState,
  InputState,
  ECSState,
  SystemHealthCheck,
} from './types'

export { DEFAULT_GAME_APPLICATION_CONFIG } from './types'

// ===== エラー定義 =====
export type {
  GameApplicationInitError,
  GameApplicationRuntimeError,
  GameApplicationStateError,
  GameLoopInitializationFailedError,
  RendererInitializationFailedError,
  SceneInitializationFailedError,
  InputInitializationFailedError,
  ECSInitializationFailedError,
  CanvasNotFoundError,
  SystemCommunicationError,
  FrameProcessingError,
  PerformanceDegradationError,
  MemoryLeakError,
  WebGLContextLostError,
  InvalidStateTransitionError,
  ConfigurationValidationError,
  SystemSynchronizationError,
} from './errors'

export { createErrorContext, getErrorSeverity, isRecoverable } from './errors'
