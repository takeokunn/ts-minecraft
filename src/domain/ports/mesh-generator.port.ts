/**
 * Mesh Generator Port
 * 
 * This port defines the contract for mesh generation operations,
 * allowing the domain layer to generate 3D meshes from voxel data
 * without depending on specific mesh generation algorithms.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import { ChunkCoordinates, Position3D, GeneratedBlock } from './terrain-generator.port'

/**
 * Vertex attribute data
 */
export interface VertexAttributes {
  readonly positions: Float32Array
  readonly normals?: Float32Array
  readonly uvs?: Float32Array
  readonly colors?: Float32Array
  readonly tangents?: Float32Array
}

/**
 * Vertex buffer configuration
 */
export interface VertexBuffer {
  readonly attributes: VertexAttributes
  readonly vertexCount: number
  readonly stride: number
  readonly interleaved: boolean
}

/**
 * Index buffer configuration
 */
export interface IndexBuffer {
  readonly indices: Uint16Array | Uint32Array
  readonly count: number
  readonly format: 'uint16' | 'uint32'
}

/**
 * Bounding volume for mesh
 */
export interface BoundingVolume {
  readonly min: Position3D
  readonly max: Position3D
  readonly center: Position3D
  readonly radius: number
}

/**
 * Generated mesh data
 */
export interface GeneratedMeshData {
  readonly vertexBuffer: VertexBuffer
  readonly indexBuffer: IndexBuffer
  readonly bounds: BoundingVolume
  readonly materials: readonly string[]
}

/**
 * Mesh generation options
 */
export interface MeshGenerationOptions {
  readonly generateNormals: boolean
  readonly generateTangents: boolean
  readonly generateUVs: boolean
  readonly generateColors: boolean
  readonly generateLightmap: boolean
}

/**
 * Mesh optimization settings
 */
export interface MeshOptimizations {
  readonly enableFaceCulling: boolean
  readonly enableVertexWelding: boolean
  readonly enableIndexOptimization: boolean
  readonly weldingThreshold: number
}

/**
 * Chunk data for mesh generation
 */
export interface ChunkData {
  readonly coordinates: ChunkCoordinates
  readonly blocks: readonly GeneratedBlock[]
  readonly heightMap: readonly number[]
  readonly biomeMap: readonly string[]
}

/**
 * Mesh generation request
 */
export interface MeshGenerationRequest {
  readonly chunkData: ChunkData
  readonly neighbors?: { readonly [key: string]: ChunkData }
  readonly algorithm: 'naive' | 'greedy' | 'culled'
  readonly optimizations?: MeshOptimizations
  readonly options?: MeshGenerationOptions
  readonly lodLevel?: number
}

/**
 * Mesh generation result
 */
export interface MeshGenerationResult {
  readonly meshData: GeneratedMeshData
  readonly chunkCoordinates: ChunkCoordinates
  readonly algorithm: string
  readonly lodLevel?: number
  readonly generationTime: number
  readonly metrics: MeshGenerationMetrics
}

/**
 * Mesh generation performance metrics
 */
export interface MeshGenerationMetrics {
  readonly totalTime: number
  readonly meshingTime: number
  readonly optimizationTime: number
  readonly inputBlocks: number
  readonly outputVertices: number
  readonly outputTriangles: number
  readonly facesCulled: number
  readonly verticesWelded: number
  readonly outputMemoryUsage: number
  readonly meshQuality: number
}

/**
 * Mesh Generator Port Interface
 */
export interface IMeshGenerator {
  /**
   * Generate mesh from chunk data
   */
  readonly generateMesh: (request: MeshGenerationRequest) => Effect.Effect<MeshGenerationResult, never, never>
  
  /**
   * Generate mesh with naive algorithm
   */
  readonly generateNaiveMesh: (chunkData: ChunkData, options?: MeshGenerationOptions) => Effect.Effect<GeneratedMeshData, never, never>
  
  /**
   * Generate mesh with greedy meshing algorithm
   */
  readonly generateGreedyMesh: (chunkData: ChunkData, options?: MeshGenerationOptions) => Effect.Effect<GeneratedMeshData, never, never>
  
  /**
   * Calculate bounding volume for positions
   */
  readonly calculateBounds: (positions: Float32Array) => Effect.Effect<BoundingVolume, never, never>
  
  /**
   * Check if mesh generation is available
   */
  readonly isAvailable: () => Effect.Effect<boolean, never, never>
}

/**
 * Mesh Generator Port tag for dependency injection
 */
export const MeshGeneratorPort = Context.GenericTag<IMeshGenerator>('MeshGeneratorPort')

/**
 * Helper functions for mesh generation
 */
export const MeshGeneratorHelpers = {
  /**
   * Create default mesh generation options
   */
  createDefaultOptions: (): MeshGenerationOptions => ({
    generateNormals: true,
    generateTangents: false,
    generateUVs: true,
    generateColors: false,
    generateLightmap: false,
  }),

  /**
   * Create default mesh optimizations
   */
  createDefaultOptimizations: (): MeshOptimizations => ({
    enableFaceCulling: true,
    enableVertexWelding: true,
    enableIndexOptimization: true,
    weldingThreshold: 0.001,
  }),

  /**
   * Create transferable vertex data
   */
  createTransferableVertexData: (
    positions: number[],
    normals?: number[],
    uvs?: number[],
  ): VertexAttributes => ({
    positions: new Float32Array(positions),
    normals: normals ? new Float32Array(normals) : undefined,
    uvs: uvs ? new Float32Array(uvs) : undefined,
  }),

  /**
   * Create transferable index buffer
   */
  createTransferableIndexBuffer: (indices: number[]): IndexBuffer => {
    const maxIndex = Math.max(...indices)
    if (maxIndex < 65536) {
      return {
        indices: new Uint16Array(indices),
        count: indices.length,
        format: 'uint16',
      }
    } else {
      return {
        indices: new Uint32Array(indices),
        count: indices.length,
        format: 'uint32',
      }
    }
  },

  /**
   * Calculate mesh bounds from positions
   */
  calculateMeshBounds: (positions: Float32Array): BoundingVolume => {
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      const y = positions[i + 1]
      const z = positions[i + 2]

      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      minZ = Math.min(minZ, z)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
      maxZ = Math.max(maxZ, z)
    }

    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const centerZ = (minZ + maxZ) / 2

    const radius = Math.sqrt(
      Math.pow(maxX - centerX, 2) +
      Math.pow(maxY - centerY, 2) +
      Math.pow(maxZ - centerZ, 2)
    )

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      center: { x: centerX, y: centerY, z: centerZ },
      radius,
    }
  },
}