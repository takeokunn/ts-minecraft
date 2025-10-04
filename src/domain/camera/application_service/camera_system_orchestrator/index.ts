/**
 * Camera System Orchestrator Application Service Module
 *
 * カメラシステム全体のオーケストレーションを担当するApplication Service層です。
 * 複数のカメラApplication Serviceを統合してシステムレベルの機能を提供します。
 */

// ========================================
// Service Interface & Context
// ========================================

export { CameraSystemOrchestratorService } from './service.js'
export type { CameraSystemOrchestratorService } from './service.js'

// ========================================
// Live Implementation
// ========================================

export { CameraSystemOrchestratorServiceLive } from './live.js'

// ========================================
// Types
// ========================================

export type {
  CameraSystemConfig,
  CameraSystemError,
  CameraSystemStatistics,
  CameraSystemTickResult,
  GlobalCameraEvent,
  PerformanceOptimizationResult,
  PerformanceTargets,
  WorldState,
} from './service.js'

// ========================================
// Module Information
// ========================================

export const CameraSystemOrchestratorServiceModule = {
  name: 'CameraSystemOrchestratorService',
  version: '1.0.0',
  description: 'カメラシステム全体のオーケストレーション',

  responsibilities: [
    'カメラシステムの初期化・シャットダウン',
    'システム全体の更新処理',
    'グローバルイベント処理',
    'システム統計情報管理',
    'パフォーマンス最適化',
  ] as const,
} as const
