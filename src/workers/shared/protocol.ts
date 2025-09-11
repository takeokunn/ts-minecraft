import * as S from "@effect/schema/Schema"
import { ChunkCoordinatesSchema } from '@/core/values/coordinates'


/**
 * Shared protocol definitions for all Minecraft workers
 * Unified message types with SharedArrayBuffer and Transferable Objects support
 */

// ============================================
// Common Data Types
// ============================================

/**
 * 3D Position schema
 */
export const Position3D = S.Struct({
  x: S.Number,
  y: S.Number,
  z: S.Number,
})
export type Position3D = S.Schema.Type<typeof Position3D>

/**
 * Block data schema
 */
export const Block = S.Struct({
  position: Position3D,
  blockType: S.String,
  metadata: S.optional(S.Record({ key: S.String, value: S.Any })),
})
export type Block = S.Schema.Type<typeof Block>

/**
 * Chunk data schema
 */
export const ChunkData = S.Struct({
  coordinates: ChunkCoordinatesSchema,
  blocks: S.Array(Block),
  heightMap: S.Array(S.Number),
  biomeData: S.optional(S.Array(S.Number)),
  timestamp: S.Number,
})
export type ChunkData = S.Schema.Type<typeof ChunkData>

/**
 * Mesh data schema with transferable buffers
 */
export const MeshData = S.Struct({
  positions: S.Any, // Float32Array (transferable)
  normals: S.Any,   // Float32Array (transferable)
  uvs: S.Any,       // Float32Array (transferable)
  indices: S.Any,   // Uint32Array (transferable)
  vertexCount: S.Number,
  triangleCount: S.Number,
})
export type MeshData = S.Schema.Type<typeof MeshData>

/**
 * Physics body data
 */
export const PhysicsBody = S.Struct({
  id: S.String,
  position: Position3D,
  velocity: Position3D,
  acceleration: Position3D,
  mass: S.Number,
  boundingBox: S.Struct({
    min: Position3D,
    max: Position3D,
  }),
  isStatic: S.Boolean,
})
export type PhysicsBody = S.Schema.Type<typeof PhysicsBody>

// ============================================
// Terrain Generation Messages
// ============================================

/**
 * Terrain generation request
 */
export const TerrainGenerationRequest = S.Struct({
  coordinates: ChunkCoordinatesSchema,
  seed: S.Number,
  biomeSettings: S.Struct({
    temperature: S.Number,
    humidity: S.Number,
    elevation: S.Number,
  }),
  noiseSettings: S.Struct({
    octaves: S.Number,
    persistence: S.Number,
    lacunarity: S.Number,
    scale: S.Number,
  }),
  editedBlocks: S.optional(S.Struct({
    destroyed: S.Array(S.String), // Position keys
    placed: S.Array(Block),
  })),
})
export type TerrainGenerationRequest = S.Schema.Type<typeof TerrainGenerationRequest>

/**
 * Terrain generation response
 */
export const TerrainGenerationResponse = S.Struct({
  chunkData: ChunkData,
  meshData: MeshData,
  performanceMetrics: S.Struct({
    generationTime: S.Number,
    blockCount: S.Number,
    meshGenerationTime: S.Number,
  }),
})
export type TerrainGenerationResponse = S.Schema.Type<typeof TerrainGenerationResponse>

// ============================================
// Physics Simulation Messages
// ============================================

/**
 * Physics simulation request
 */
export const PhysicsSimulationRequest = S.Struct({
  bodies: S.Array(PhysicsBody),
  deltaTime: S.Number,
  gravity: Position3D,
  constraints: S.Array(S.Struct({
    bodyA: S.String,
    bodyB: S.String,
    type: S.Union(
      S.Literal('distance'),
      S.Literal('hinge'),
      S.Literal('spring')
    ),
    parameters: S.Record({ key: S.String, value: S.Number }),
  })),
  worldBounds: S.Struct({
    min: Position3D,
    max: Position3D,
  }),
})
export type PhysicsSimulationRequest = S.Schema.Type<typeof PhysicsSimulationRequest>

/**
 * Physics simulation response
 */
export const PhysicsSimulationResponse = S.Struct({
  updatedBodies: S.Array(PhysicsBody),
  collisions: S.Array(S.Struct({
    bodyA: S.String,
    bodyB: S.String,
    contactPoint: Position3D,
    contactNormal: Position3D,
    penetration: S.Number,
  })),
  performanceMetrics: S.Struct({
    simulationTime: S.Number,
    collisionDetectionTime: S.Number,
    integrationTime: S.Number,
  }),
})
export type PhysicsSimulationResponse = S.Schema.Type<typeof PhysicsSimulationResponse>

// ============================================
// Mesh Generation Messages
// ============================================

/**
 * Mesh generation request
 */
export const MeshGenerationRequest = S.Struct({
  chunkData: ChunkData,
  neighborChunks: S.optional(S.Record({
    key: S.String, // Direction key (north, south, east, west)
    value: ChunkData,
  })),
  lodLevel: S.Number,
  optimizations: S.Struct({
    enableFaceCulling: S.Boolean,
    enableOcclusion: S.Boolean,
    enableGreedyMeshing: S.Boolean,
  }),
})
export type MeshGenerationRequest = S.Schema.Type<typeof MeshGenerationRequest>

/**
 * Mesh generation response
 */
export const MeshGenerationResponse = S.Struct({
  meshData: MeshData,
  boundingBox: S.Struct({
    min: Position3D,
    max: Position3D,
  }),
  performanceMetrics: S.Struct({
    meshingTime: S.Number,
    optimizationTime: S.Number,
    facesCulled: S.Number,
  }),
})
export type MeshGenerationResponse = S.Schema.Type<typeof MeshGenerationResponse>

// ============================================
// Lighting Calculation Messages
// ============================================

/**
 * Lighting calculation request
 */
export const LightingCalculationRequest = S.Struct({
  chunkData: ChunkData,
  lightSources: S.Array(S.Struct({
    position: Position3D,
    intensity: S.Number,
    color: S.Struct({
      r: S.Number,
      g: S.Number,
      b: S.Number,
    }),
    type: S.Union(
      S.Literal('point'),
      S.Literal('directional'),
      S.Literal('ambient')
    ),
  })),
  skyLightLevel: S.Number,
})
export type LightingCalculationRequest = S.Schema.Type<typeof LightingCalculationRequest>

/**
 * Lighting calculation response
 */
export const LightingCalculationResponse = S.Struct({
  lightMap: S.Any, // Uint8Array (transferable) - light values per block
  shadowMap: S.Any, // Uint8Array (transferable) - shadow values
  performanceMetrics: S.Struct({
    calculationTime: S.Number,
    blocksProcessed: S.Number,
  }),
})
export type LightingCalculationResponse = S.Schema.Type<typeof LightingCalculationResponse>

// ============================================
// Batch Processing Messages
// ============================================

/**
 * Batch request for multiple operations
 */
export const BatchRequest = S.Struct({
  operations: S.Array(S.Union(
    S.Struct({
      type: S.Literal('terrain'),
      request: TerrainGenerationRequest,
    }),
    S.Struct({
      type: S.Literal('physics'),
      request: PhysicsSimulationRequest,
    }),
    S.Struct({
      type: S.Literal('mesh'),
      request: MeshGenerationRequest,
    }),
    S.Struct({
      type: S.Literal('lighting'),
      request: LightingCalculationRequest,
    })
  )),
  priority: S.optional(S.Number),
  timeout: S.optional(S.Number),
})
export type BatchRequest = S.Schema.Type<typeof BatchRequest>

/**
 * Batch response
 */
export const BatchResponse = S.Struct({
  results: S.Array(S.Union(
    S.Struct({
      type: S.Literal('terrain'),
      response: TerrainGenerationResponse,
    }),
    S.Struct({
      type: S.Literal('physics'),
      response: PhysicsSimulationResponse,
    }),
    S.Struct({
      type: S.Literal('mesh'),
      response: MeshGenerationResponse,
    }),
    S.Struct({
      type: S.Literal('lighting'),
      response: LightingCalculationResponse,
    })
  )),
  totalProcessingTime: S.Number,
  failedOperations: S.Array(S.Struct({
    index: S.Number,
    error: S.String,
  })),
})
export type BatchResponse = S.Schema.Type<typeof BatchResponse>

// ============================================
// Worker Type Definitions
// ============================================

/**
 * Union of all possible worker requests
 */
export const WorkerRequestPayload = S.Union(
  TerrainGenerationRequest,
  PhysicsSimulationRequest,  
  MeshGenerationRequest,
  LightingCalculationRequest,
  BatchRequest
)
export type WorkerRequestPayload = S.Schema.Type<typeof WorkerRequestPayload>

/**
 * Union of all possible worker responses
 */
export const WorkerResponsePayload = S.Union(
  TerrainGenerationResponse,
  PhysicsSimulationResponse,
  MeshGenerationResponse,
  LightingCalculationResponse,
  BatchResponse
)
export type WorkerResponsePayload = S.Schema.Type<typeof WorkerResponsePayload>

// ============================================
// Utility Functions
// ============================================

/**
 * Create typed array from regular array for transfer
 */
export const createTransferableArray = (data: number[], type: 'Float32' | 'Uint32' | 'Uint16' | 'Uint8'): ArrayBufferView => {
  switch (type) {
    case 'Float32':
      return new Float32Array(data)
    case 'Uint32':
      return new Uint32Array(data)
    case 'Uint16':
      return new Uint16Array(data)
    case 'Uint8':
      return new Uint8Array(data)
  }
}

/**
 * Extract mesh transferables for zero-copy transfer
 */
export const prepareMeshForTransfer = (mesh: {
  positions: number[]
  normals: number[]
  uvs: number[]
  indices: number[]
}): MeshData => {
  return {
    positions: createTransferableArray(mesh.positions, 'Float32'),
    normals: createTransferableArray(mesh.normals, 'Float32'),
    uvs: createTransferableArray(mesh.uvs, 'Float32'),
    indices: createTransferableArray(mesh.indices, 'Uint32'),
    vertexCount: mesh.positions.length / 3,
    triangleCount: mesh.indices.length / 3,
  }
}