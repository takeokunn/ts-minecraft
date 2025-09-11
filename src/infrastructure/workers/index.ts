/**
 * Workers module main exports
 * Provides complete worker system with type safety and advanced features
 */

// Base worker system
export * from './base'

// Shared protocol
export * from './shared'

// Legacy compatibility (for gradual migration)
export { createWorker, createWorkerClient } from './shared/worker-base'
export type { WorkerHandler as LegacyWorkerHandler, WorkerConfig } from './shared/worker-base'

// Message types (legacy - for backward compatibility)
export * from './messages'

// Main worker exports - use these for new implementations
export {
  createTypedWorker,
  createTypedWorkerClient,
  createWorkerFactory,
  createWorkerPool,
} from './base/typed-worker'

export type {
  TypedWorkerConfig,
  WorkerClientConfig,
  WorkerHandler,
  WorkerHandlerContext,
} from './base/typed-worker'

// Protocol types
export type {
  TerrainGenerationRequest,
  TerrainGenerationResponse,
  PhysicsSimulationRequest,
  PhysicsSimulationResponse,
  MeshGenerationRequest,
  MeshGenerationResponse,
  LightingCalculationRequest,
  LightingCalculationResponse,
} from './shared/protocol'