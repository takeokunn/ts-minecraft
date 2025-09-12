/**
 * Unified Worker Protocols - Detailed Protocol Exports
 *
 * This module contains all detailed export statements for worker communication protocols
 * with type safety and commonly used utilities.
 */

// Export all protocols
export * from './computation.protocol'
export * from './error-handling.protocol'
export * from './lighting.protocol'
export * from './mesh.protocol'
export * from './physics.protocol'
export * from './terrain.protocol'

// Re-export commonly used types and utilities from terrain protocol
export { type Position3D, type Block, type ChunkData, createDefaultBiome, createDefaultNoiseSettings, createDefaultTerrainFeatures } from './terrain.protocol'

// Re-export commonly used types and utilities from physics protocol
export { type Vector3, type PhysicsBody, type CollisionEvent, zeroVector3, identityQuaternion, createPhysicsMaterial, vectorOps } from './physics.protocol'

// Re-export commonly used types and utilities from mesh protocol
export {
  type GeneratedMeshData,
  type OptimizationSettings,
  createDefaultOptimizations,
  createDefaultLighting as createDefaultMeshLighting,
  extractMeshTransferables,
} from './mesh.protocol'

// Re-export commonly used types and utilities from lighting protocol
export {
  type LightSource,
  type AmbientLighting,
  type ChunkLightingData,
  createDefaultAmbientLighting,
  createDefaultShadowSettings,
  createDefaultAOSettings,
  worldTimeToSkyLight,
  extractLightingTransferables,
} from './lighting.protocol'

// Re-export commonly used types and utilities from computation protocol
export {
  type ComputationType,
  type PathfindingParams,
  type NoiseParams,
  type CompressionParams,
  createDefaultPathfindingParams,
  createDefaultNoiseParams,
  createDefaultCompressionParams,
  distance3D,
  extractComputationTransferables,
} from './computation.protocol'

// Re-export commonly used types and utilities from error handling protocol
export {
  type WorkerError,
  type ErrorCategory,
  type ErrorSeverity,
  type RecoveryStrategy,
  type ErrorHandlingConfig,
  type WorkerErrorResponse,
  createWorkerError,
  createValidationError,
  createTimeoutError,
  createMemoryError,
  createDefaultErrorHandlingConfig,
  isRetryableError,
  categorizeError,
} from './error-handling.protocol'
