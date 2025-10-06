/**
 * @fileoverview LifecycleStage値オブジェクトのバレルエクスポート
 * チャンクのライフサイクルステージと統計情報
 */

// Lifecycle Stage Operations
export {
  activateStage,
  createInitializedStage,
  deactivateStage,
  destroyStage,
  markPendingDestruction,
  updateIdleDuration,
} from './index'

// Lifecycle Stats
export {
  averageActivationDuration,
  averageDeactivationDuration,
  createLifecycleAccumulator,
  recordActivation,
  recordDeactivation,
  setMemoryPressure,
  toLifecycleStats,
} from './index'
export * from './lifecycle_stats';
export * from './lifecycle_stage';
