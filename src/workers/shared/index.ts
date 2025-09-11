/**
 * Shared worker protocol exports
 * Common message types and utilities for all workers
 */

export * from './protocol'

// Re-export commonly used types
export type {
  Position3D,
  Block,
  ChunkData,
  MeshData,
  PhysicsBody,
  TerrainGenerationRequest,
  TerrainGenerationResponse,
  PhysicsSimulationRequest,
  PhysicsSimulationResponse,
  MeshGenerationRequest,
  MeshGenerationResponse,
  LightingCalculationRequest,
  LightingCalculationResponse,
  BatchRequest,
  BatchResponse,
  WorkerRequestPayload,
  WorkerResponsePayload,
} from './protocol'