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
} from './lifecycle_stage'

// Lifecycle Stats
export * from './lifecycle_stage'
export {
  averageActivationDuration,
  averageDeactivationDuration,
  createLifecycleAccumulator,
  recordActivation,
  recordDeactivation,
  setMemoryPressure,
  toLifecycleStats,
} from './lifecycle_stage'
export * from './lifecycle_stats'
