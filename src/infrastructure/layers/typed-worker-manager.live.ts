// Re-export from unified worker system - now fully implemented
export {
  createTypedWorker,
  createTypedWorkerClient,
  createWorkerFactory,
  createWorkerPool as createTypedWorkerPool,
  type WorkerHandlerContext,
  type WorkerHandler,
  type TypedWorkerConfig,
  type WorkerClientConfig,
} from '../workers/base/typed-worker'

// Export the worker pool functionality
export { createWorkerPool, createMultipleWorkerPools, type WorkerPoolConfig, type PoolMetrics, type WorkerPoolService } from '../workers/unified/worker-pool'
