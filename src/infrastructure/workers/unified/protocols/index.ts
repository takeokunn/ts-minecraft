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

// Re-export commonly used types and utilities
export {
  type Position3D,
  type Block,
  type ChunkData,
  createDefaultBiome,
  createDefaultNoiseSettings,
  createDefaultTerrainFeatures
} from './terrain.protocol'

export {
  type Vector3,
  type PhysicsBody,
  type CollisionEvent,
  zeroVector3,
  identityQuaternion,
  createPhysicsMaterial,
  vectorOps
} from './physics.protocol'

export {
  type GeneratedMeshData,
  type OptimizationSettings,
  createDefaultOptimizations,
  createDefaultLighting,
  extractMeshTransferables
} from './mesh.protocol'