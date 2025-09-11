/**
 * Unified Worker Protocols
 * Exports all worker communication protocols with type safety
 */

// Terrain Protocol
export * from './terrain.protocol'

// Physics Protocol
export * from './physics.protocol'

// Mesh Protocol
export * from './mesh.protocol'

// Lighting Protocol
export * from './lighting.protocol'

// Computation Protocol
export * from './computation.protocol'

// Error Handling Protocol
export * from './error-handling.protocol'

// Re-export commonly used types and utilities from terrain protocol
export { 
  type Position3D, 
  type Block, 
  type ChunkData, 
  createDefaultBiome, 
  createDefaultNoiseSettings, 
  createDefaultTerrainFeatures 
} from './terrain.protocol'

// Re-export commonly used types and utilities from physics protocol
export { 
  type Vector3, 
  type PhysicsBody, 
  type CollisionEvent, 
  zeroVector3, 
  identityQuaternion, 
  createPhysicsMaterial, 
  vectorOps 
} from './physics.protocol'

// Re-export commonly used types and utilities from mesh protocol
export { 
  type GeneratedMeshData, 
  type OptimizationSettings, 
  createDefaultOptimizations, 
  createDefaultLighting as createDefaultMeshLighting, 
  extractMeshTransferables 
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
  extractLightingTransferables
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
  extractComputationTransferables
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
  categorizeError
} from './error-handling.protocol'
