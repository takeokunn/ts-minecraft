/**
 * Unified Worker System
 * Main entry point for the unified worker management system
 */

// Core worker management
export * from './worker-manager'
export * from './worker-pool'

// Protocol definitions
export * from './protocols'

// Re-export base worker functionality
export { 
  createTypedWorker, 
  createTypedWorkerClient, 
  createWorkerFactory,
  createWorkerPool as createBaseWorkerPool,
  type WorkerHandlerContext,
  type WorkerHandler,
  type TypedWorkerConfig,
  type WorkerClientConfig
} from '../base/typed-worker'

// Convenience exports
export {
  type WorkerType,
  type WorkerCapabilities,
  type WorkerMetrics,
  type WorkerInstance,
  type WorkerManagerConfig
} from './worker-manager'

export {
  type PoolStrategy,
  type LoadBalanceStrategy,
  type HealthStatus,
  type WorkerPoolConfig,
  type PoolMetrics,
  createMultipleWorkerPools
} from './worker-pool'