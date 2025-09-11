/**
 * Unified Worker Protocols - Detailed Protocol Exports
 *
 * This module contains all detailed export statements for worker communication protocols
 * with type safety and commonly used utilities.
 */

// Re-export commonly used types and utilities from terrain protocol
export { type Position3D, type Block, type ChunkData, createDefaultBiome, createDefaultNoiseSettings, createDefaultTerrainFeatures } from '@infrastructure/terrain.protocol'

// Re-export commonly used types and utilities from physics protocol
export { type Vector3, type PhysicsBody, type CollisionEvent, zeroVector3, identityQuaternion, createPhysicsMaterial, vectorOps } from '@infrastructure/physics.protocol'

// Re-export commonly used types and utilities from mesh protocol
export {
  type GeneratedMeshData,
  type OptimizationSettings,
  createDefaultOptimizations,
  createDefaultLighting as createDefaultMeshLighting,
  extractMeshTransferables,
} from '@infrastructure/mesh.protocol'

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
} from '@infrastructure/lighting.protocol'

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
} from '@infrastructure/computation.protocol'

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
} from '@infrastructure/error-handling.protocol'
