/**
 * Mesh Generator Adapter
 * 
 * Infrastructure adapter that implements the IMeshGenerator port interface.
 * This adapter provides the concrete implementation of mesh generation
 * using specific 3D libraries and algorithms while maintaining the port contract.
 */

import { Effect, Layer, Context } from 'effect'
import {
  IMeshGenerator,
  MeshGeneratorPort,
  MeshGenerationRequest,
  MeshGenerationResult,
  ChunkData,
  GeneratedMeshData,
  MeshGenerationOptions,
  VertexBuffer,
  IndexBuffer,
  BoundingVolume,
  VertexAttributes,
  MeshGenerationMetrics,
  MeshGeneratorHelpers,
} from '../../domain/ports/mesh-generator.port'
import { GeneratedBlock, Position3D } from '../../domain/ports/terrain-generator.port'

/**
 * Block face information for mesh generation
 */
interface BlockFace {
  readonly positions: readonly number[]
  readonly normals: readonly number[]
  readonly uvs: readonly number[]
  readonly indices: readonly number[]
}

/**
 * Face direction enumeration
 */
const FaceDirection = {
  FRONT: 'front',
  BACK: 'back',
  RIGHT: 'right', 
  LEFT: 'left',
  TOP: 'top',
  BOTTOM: 'bottom',
} as const

/**
 * Concrete implementation of the mesh generator using infrastructure-specific algorithms
 */
export class MeshGeneratorAdapter implements IMeshGenerator {
  /**
   * Create neighbor lookup table for occlusion culling
   */
  private createNeighborLookup = (
    chunkData: ChunkData,
    neighbors?: { readonly [key: string]: ChunkData },
  ): { readonly [key: string]: GeneratedBlock | null } => {
    const lookup: { [key: string]: GeneratedBlock | null } = {}

    // Add current chunk blocks
    chunkData.blocks.forEach((block) => {
      const key = `${block.position.x},${block.position.y},${block.position.z}`
      lookup[key] = block
    })

    // Add neighbor chunk blocks for cross-chunk face culling
    if (neighbors) {
      Object.values(neighbors).forEach((neighborChunk) => {
        neighborChunk.blocks.forEach((block) => {
          const key = `${block.position.x},${block.position.y},${block.position.z}`
          lookup[key] = block
        })
      })
    }

    return lookup
  }

  /**
   * Check if a face should be rendered based on occlusion
   */
  private shouldRenderFace = (
    neighbor: GeneratedBlock | null,
    currentBlock: GeneratedBlock,
  ): boolean => {
    // Render if no neighbor exists (chunk boundary)
    if (!neighbor) return true
    
    // Render if neighbor is air or transparent
    if (neighbor.blockType === 'air' || neighbor.blockType === 'water') return true
    
    // Don't render if neighbor is solid opaque block
    return false
  }

  /**
   * Generate cube faces for a block with occlusion culling
   */
  private generateBlockFaces = (
    block: GeneratedBlock,
    neighborLookup: { readonly [key: string]: GeneratedBlock | null },
  ): readonly BlockFace[] => {
    const { x, y, z } = block.position
    const faces: BlockFace[] = []

    // Define face data with geometric calculations
    const faceDefinitions = [
      // Front face (+Z)
      {
        name: FaceDirection.FRONT,
        positions: [x, y, z + 1, x + 1, y, z + 1, x + 1, y + 1, z + 1, x, y + 1, z + 1],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
        neighborKey: `${x},${y},${z + 1}`,
      },
      // Back face (-Z)
      {
        name: FaceDirection.BACK,
        positions: [x + 1, y, z, x, y, z, x, y + 1, z, x + 1, y + 1, z],
        normals: [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
        neighborKey: `${x},${y},${z - 1}`,
      },
      // Right face (+X)
      {
        name: FaceDirection.RIGHT,
        positions: [x + 1, y, z + 1, x + 1, y, z, x + 1, y + 1, z, x + 1, y + 1, z + 1],
        normals: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
        neighborKey: `${x + 1},${y},${z}`,
      },
      // Left face (-X)
      {
        name: FaceDirection.LEFT,
        positions: [x, y, z, x, y, z + 1, x, y + 1, z + 1, x, y + 1, z],
        normals: [-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0],
        neighborKey: `${x - 1},${y},${z}`,
      },
      // Top face (+Y)
      {
        name: FaceDirection.TOP,
        positions: [x, y + 1, z + 1, x + 1, y + 1, z + 1, x + 1, y + 1, z, x, y + 1, z],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
        neighborKey: `${x},${y + 1},${z}`,
      },
      // Bottom face (-Y)
      {
        name: FaceDirection.BOTTOM,
        positions: [x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1],
        normals: [0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0],
        neighborKey: `${x},${y - 1},${z}`,
      },
    ]

    faceDefinitions.forEach((faceDef, faceIndex) => {
      // Occlusion culling: check if this face should be rendered
      const neighbor = neighborLookup[faceDef.neighborKey]
      const shouldRender = this.shouldRenderFace(neighbor, block)

      if (shouldRender) {
        faces.push({
          positions: faceDef.positions,
          normals: faceDef.normals,
          uvs: [0, 0, 1, 0, 1, 1, 0, 1], // Standard UV mapping
          indices: [0, 1, 2, 0, 2, 3].map((i) => i + faceIndex * 4),
        })
      }
    })

    return faces
  }

  /**
   * Naive meshing algorithm - generates one face per block face
   */
  private naiveMeshingAlgorithm = (
    chunkData: ChunkData,
    neighbors?: { readonly [key: string]: ChunkData },
  ): {
    readonly positions: readonly number[]
    readonly normals: readonly number[]
    readonly uvs: readonly number[]
    readonly indices: readonly number[]
  } => {
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    const neighborLookup = this.createNeighborLookup(chunkData, neighbors)
    let vertexOffset = 0

    // Process each solid block
    chunkData.blocks
      .filter((block) => block.blockType !== 'air')
      .forEach((block) => {
        const blockFaces = this.generateBlockFaces(block, neighborLookup)

        blockFaces.forEach((face) => {
          // Add vertex data
          positions.push(...face.positions)
          normals.push(...face.normals)
          uvs.push(...face.uvs)

          // Add indices with proper vertex offset
          const faceIndices = face.indices.map((i) => i + vertexOffset)
          indices.push(...faceIndices)

          vertexOffset += 4 // 4 vertices per face
        })
      })

    return { positions, normals, uvs, indices }
  }

  /**
   * Calculate bounding volume from vertex positions
   */
  private calculateBounds = (positions: Float32Array): BoundingVolume => {
    if (positions.length === 0) {
      const origin: Position3D = { x: 0, y: 0, z: 0 }
      return {
        min: origin,
        max: origin,
        center: origin,
        radius: 0,
      }
    }

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

    const center: Position3D = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2,
    }

    const radius = Math.sqrt(
      Math.pow(maxX - center.x, 2) +
      Math.pow(maxY - center.y, 2) +
      Math.pow(maxZ - center.z, 2)
    )

    return {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
      center,
      radius,
    }
  }

  generateMesh = (request: MeshGenerationRequest): Effect.Effect<MeshGenerationResult, never, never> =>
    Effect.gen(function* () {
      const startTime = performance.now()
      const { chunkData, neighbors, algorithm, optimizations, options, lodLevel } = request
      
      const opts = options || MeshGeneratorHelpers.createDefaultOptions()

      // Generate base mesh data using infrastructure-specific meshing
      const meshingStart = performance.now()
      const meshData = this.naiveMeshingAlgorithm(chunkData, neighbors)
      const meshingTime = performance.now() - meshingStart

      // Create transferable vertex attributes
      const vertexAttributes: VertexAttributes = {
        positions: new Float32Array(meshData.positions),
        normals: opts.generateNormals ? new Float32Array(meshData.normals) : undefined,
        uvs: opts.generateUVs ? new Float32Array(meshData.uvs) : undefined,
      }

      // Create vertex buffer
      const vertexBuffer: VertexBuffer = {
        attributes: vertexAttributes,
        vertexCount: meshData.positions.length / 3,
        stride: 8 * 4, // position(3) + normal(3) + uv(2) * 4 bytes
        interleaved: false,
      }

      // Create index buffer
      const useShort = meshData.indices.length < 65536
      const indexBuffer: IndexBuffer = {
        indices: useShort ? new Uint16Array(meshData.indices) : new Uint32Array(meshData.indices),
        count: meshData.indices.length,
        format: useShort ? 'uint16' : 'uint32',
      }

      // Calculate bounds
      const bounds: BoundingVolume = this.calculateBounds(vertexAttributes.positions)

      // Create final mesh data
      const generatedMeshData: GeneratedMeshData = {
        vertexBuffer,
        indexBuffer,
        bounds,
        materials: [], // Would be populated with actual material data
      }

      // Performance metrics
      const totalTime = performance.now() - startTime
      const optimizationTime = 0 // No optimizations applied in this basic implementation
      
      const metrics: MeshGenerationMetrics = {
        totalTime,
        meshingTime,
        optimizationTime,
        inputBlocks: chunkData.blocks.length,
        outputVertices: vertexBuffer.vertexCount,
        outputTriangles: indexBuffer.count / 3,
        facesCulled: 0, // Would be calculated during face culling
        verticesWelded: 0, // Would be calculated during vertex welding
        outputMemoryUsage: meshData.positions.length * 4 + meshData.indices.length * 4,
        meshQuality: 1.0, // Simplified quality metric
      }

      return {
        meshData: generatedMeshData,
        chunkCoordinates: chunkData.coordinates,
        algorithm,
        lodLevel,
        generationTime: totalTime,
        metrics,
      } satisfies MeshGenerationResult
    })

  generateNaiveMesh = (
    chunkData: ChunkData,
    options?: MeshGenerationOptions,
  ): Effect.Effect<GeneratedMeshData, never, never> =>
    Effect.gen(function* () {
      const meshData = this.naiveMeshingAlgorithm(chunkData)
      const opts = options || MeshGeneratorHelpers.createDefaultOptions()

      const vertexAttributes: VertexAttributes = {
        positions: new Float32Array(meshData.positions),
        normals: opts.generateNormals ? new Float32Array(meshData.normals) : undefined,
        uvs: opts.generateUVs ? new Float32Array(meshData.uvs) : undefined,
      }

      const vertexBuffer: VertexBuffer = {
        attributes: vertexAttributes,
        vertexCount: meshData.positions.length / 3,
        stride: 8 * 4,
        interleaved: false,
      }

      const useShort = meshData.indices.length < 65536
      const indexBuffer: IndexBuffer = {
        indices: useShort ? new Uint16Array(meshData.indices) : new Uint32Array(meshData.indices),
        count: meshData.indices.length,
        format: useShort ? 'uint16' : 'uint32',
      }

      const bounds: BoundingVolume = this.calculateBounds(vertexAttributes.positions)

      return {
        vertexBuffer,
        indexBuffer,
        bounds,
        materials: [],
      } satisfies GeneratedMeshData
    })

  generateGreedyMesh = (
    chunkData: ChunkData,
    options?: MeshGenerationOptions,
  ): Effect.Effect<GeneratedMeshData, never, never> =>
    Effect.gen(function* () {
      // For this implementation, use naive meshing as base
      // A full greedy meshing implementation would be significantly more complex
      return yield* this.generateNaiveMesh(chunkData, options)
    })

  calculateBounds = (positions: Float32Array): Effect.Effect<BoundingVolume, never, never> =>
    Effect.gen(function* () {
      return this.calculateBounds(positions)
    })

  isAvailable = (): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      // Check if infrastructure dependencies are available
      return (
        typeof performance !== 'undefined' &&
        typeof Float32Array !== 'undefined' &&
        typeof Uint16Array !== 'undefined' &&
        typeof Uint32Array !== 'undefined'
      )
    })
}

/**
 * Live layer for Mesh Generator Adapter
 */
export const MeshGeneratorAdapterLive = Layer.succeed(
  MeshGeneratorPort,
  new MeshGeneratorAdapter(),
)

/**
 * Mesh Generator Adapter with custom configuration
 */
export const createMeshGeneratorAdapter = (config?: {
  meshingAlgorithm?: 'naive' | 'greedy' | 'culled'
  enableOcclusion?: boolean
  vertexWeldingThreshold?: number
}) => {
  const adapter = new MeshGeneratorAdapter()
  return Layer.succeed(MeshGeneratorPort, adapter)
}

/**
 * Infrastructure-specific mesh generation utilities
 */
export const MeshGeneratorAdapterUtils = {
  /**
   * Validate mesh generation capabilities
   */
  validateCapabilities: (): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      // Check for required browser APIs and WebGL capabilities
      return (
        typeof performance !== 'undefined' &&
        typeof Float32Array !== 'undefined' &&
        typeof Uint16Array !== 'undefined' &&
        typeof Uint32Array !== 'undefined' &&
        typeof WebGLRenderingContext !== 'undefined'
      )
    }),

  /**
   * Estimate memory usage for mesh generation
   */
  estimateMemoryUsage: (blockCount: number): number => {
    // Rough estimate: each block can generate up to 6 faces, 4 vertices per face
    const maxVertices = blockCount * 6 * 4
    const maxIndices = blockCount * 6 * 6
    
    // Float32Array for positions (3 * 4 bytes) + normals (3 * 4 bytes) + uvs (2 * 4 bytes)
    const vertexMemory = maxVertices * (3 + 3 + 2) * 4
    
    // Index buffer (2 or 4 bytes per index)
    const indexMemory = maxIndices * 2
    
    return vertexMemory + indexMemory
  },

  /**
   * Get supported meshing algorithms
   */
  getSupportedAlgorithms: (): string[] => {
    return ['naive', 'culled']
  },

  /**
   * Calculate optimal LOD level based on distance
   */
  calculateLODLevel: (distance: number): number => {
    if (distance < 50) return 0   // Full detail
    if (distance < 100) return 1  // Half detail
    if (distance < 200) return 2  // Quarter detail
    return 3                      // Minimum detail
  },
}