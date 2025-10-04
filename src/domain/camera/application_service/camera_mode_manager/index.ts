/**
 * Camera Mode Manager Application Service Module
 *
 * カメラモード切り替えのユースケースを実現するApplication Service層です。
 * 複雑なモード遷移ロジック、スケジューリング、最適化機能を提供します。
 */

// ========================================
// Service Interface & Context
// ========================================

export { CameraModeManagerApplicationService } from './service.js'
export type { CameraModeManagerApplicationService } from './service.js'

// ========================================
// Live Implementation
// ========================================

export { CameraModeManagerApplicationServiceLive } from './live.js'

// ========================================
// Types & Schemas
// ========================================

export type {
  AnimationType,
  // Error Types
  CameraModeManagerApplicationError,
  CameraModeSwitchOperation,
  // Configuration Types
  EasingFunction,
  GameContext,
  OperationPriority,
  PlayerPreferences,
  RollbackConfig,
  ScheduleId,
  SlideDirection,
  TransitionId,
  // Context Types
  ViewModeContext,
  ViewModeRecommendation,
  // Core Types
  ViewModeTransitionConfig,
  ViewModeTransitionFailureReason,
  ViewModeTransitionResult,
} from './types.js'

export {
  CameraModeManagerApplicationErrorSchema,
  // Schema Exports
  ViewModeTransitionConfigSchema,
  ViewModeTransitionResultSchema,
  // Factory Functions
  createCameraModeManagerApplicationError,
  createViewModeTransitionResult,
} from './types.js'

// Additional service-specific types
export type {
  ErrorSeverity,
  ModeTransitionStatistics,
  PerformanceOptimizationResult,
  PerformanceTargets,
  ScheduleStatus,
  TimeRange,
  TransitionValidationResult,
  ValidationError,
} from './service.js'

// ========================================
// Module Information
// ========================================

export const CameraModeManagerApplicationServiceModule = {
  name: 'CameraModeManagerApplicationService',
  version: '1.0.0',
  description: 'カメラモード切り替え・最適化のApplication Service',

  responsibilities: [
    'ビューモードの切り替え管理',
    '複数カメラの一括モード切り替え',
    'スケジュール化されたモード遷移',
    'コンテキスト依存のモード推奨',
    'パフォーマンス最適化に基づくモード選択',
    '緊急時のモード切り替え',
    '遷移統計情報の管理',
    '設定検証とエラーハンドリング',
  ] as const,

  features: [
    'Effect-TSパターン完全適用',
    'スケジュール化された遷移制御',
    'コンテキスト依存最適化',
    'パフォーマンスベース推奨',
    'バッチ処理対応',
    '緊急時対応',
    '統計情報収集',
    '設定検証機能',
  ] as const,
} as const
