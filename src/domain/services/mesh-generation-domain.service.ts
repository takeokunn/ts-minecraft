/**
 * Mesh Generation Domain Service
 * 
 * Contains the pure business logic for mesh generation from voxel data,
 * extracted from infrastructure layer and made technology-agnostic.
 * This service implements core mesh generation algorithms without dependencies
 * on specific 3D libraries or WebGL implementations.
 */

import { Effect, Context, Layer } from 'effect'
import {
  MeshGeneratorPort,
  type IMeshGenerator,
  type ChunkData,
  type GeneratedMeshData,
  type MeshGenerationRequest,
  type MeshGenerationResult,
  type MeshGenerationOptions,
  type MeshOptimizations,
  type VertexBuffer,
  type IndexBuffer,
  type BoundingVolume,
  type MeshGenerationMetrics,
  MeshGeneratorHelpers,
} from '@domain/ports/mesh-generator.port'
import { type GeneratedBlock, type Position3D } from '@domain/ports/terrain-generator.port'

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
 * Face direction enum for clarity
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
 * Generate cube faces for a block with occlusion culling
 * Pure geometric calculation without external dependencies
 */
const generateBlockFaces = (
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
    const shouldRender = shouldRenderFace(neighbor, block)

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
 * Determine if a face should be rendered based on occlusion rules
 * Pure business logic for face culling
 */
const shouldRenderFace = (
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
 * Create neighbor lookup table from chunk data
 * Optimized lookup for face culling calculations
 */
const createNeighborLookup = (
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
 * Naive meshing algorithm - generates one face per block face
 * Simple but not optimized algorithm for mesh generation
 */
const naiveMeshingAlgorithm = (
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

  const neighborLookup = createNeighborLookup(chunkData, neighbors)
  let vertexOffset = 0

  // Process each solid block
  chunkData.blocks
    .filter((block) => block.blockType !== 'air')
    .forEach((block) => {
      const blockFaces = generateBlockFaces(block, neighborLookup)

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
 * Greedy meshing algorithm - merges adjacent faces
 * More complex algorithm that reduces vertex count by merging faces
 */
const greedyMeshingAlgorithm = (
  chunkData: ChunkData,
  neighbors?: { readonly [key: string]: ChunkData },
): {
  readonly positions: readonly number[]
  readonly normals: readonly number[]
  readonly uvs: readonly number[]
  readonly indices: readonly number[]
} => {
  // For this implementation, we use naive meshing as base
  // A full greedy meshing implementation would be significantly more complex
  // and would involve analyzing adjacent faces and merging them
  return naiveMeshingAlgorithm(chunkData, neighbors)
}

/**
 * Apply mesh optimizations to generated mesh data
 * Pure algorithms for mesh optimization
 */
const applyMeshOptimizations = (
  meshData: {
    readonly positions: readonly number[]
    readonly normals: readonly number[]
    readonly uvs: readonly number[]
    readonly indices: readonly number[]
  },
  optimizations: MeshOptimizations,
): {
  readonly positions: readonly number[]
  readonly normals: readonly number[]
  readonly uvs: readonly number[]
  readonly indices: readonly number[]
} => {
  let optimized = { ...meshData }

  // Face culling is already handled in face generation

  // Vertex welding (simplified implementation)
  if (optimizations.enableVertexWelding) {
    // In a full implementation, this would merge vertices within threshold
    // For now, we return the original data
    optimized = { ...optimized }
  }

  // Index optimization
  if (optimizations.enableIndexOptimization) {
    // Would reorder indices for better GPU cache performance
    optimized = { ...optimized }
  }

  return optimized
}

/**
 * Generate mesh data using specified algorithm
 */
const generateMeshByAlgorithm = (
  algorithm: string,
  chunkData: ChunkData,
  neighbors?: { readonly [key: string]: ChunkData },
): {
  readonly positions: readonly number[]
  readonly normals: readonly number[]
  readonly uvs: readonly number[]
  readonly indices: readonly number[]
} => {
  switch (algorithm) {
    case 'greedy':
      return greedyMeshingAlgorithm(chunkData, neighbors)
    case 'culled':
    case 'naive':
    default:
      return naiveMeshingAlgorithm(chunkData, neighbors)
  }
}

/**
 * Mesh Generation Domain Service Implementation
 */
export class MeshGenerationDomainService implements IMeshGenerator {
  generateMesh = (request: MeshGenerationRequest): Effect.Effect<MeshGenerationResult, never, never> =>
    Effect.gen(function* () {
      const startTime = performance.now()
      const { chunkData, neighbors, algorithm, optimizations, options, lodLevel } = request
      
      const opts = options || MeshGeneratorHelpers.createDefaultOptions()
      const optims = optimizations || MeshGeneratorHelpers.createDefaultOptimizations()

      // Generate base mesh data
      const meshingStart = performance.now()
      let meshData = generateMeshByAlgorithm(algorithm, chunkData, neighbors)
      const meshingTime = performance.now() - meshingStart

      // Apply optimizations
      const optimizationStart = performance.now()
      meshData = applyMeshOptimizations(meshData, optims)
      const optimizationTime = performance.now() - optimizationStart

      // Create transferable vertex attributes
      const vertexAttributes = MeshGeneratorHelpers.createTransferableVertexData(
        Array.from(meshData.positions),
        opts.generateNormals ? Array.from(meshData.normals) : undefined,
        opts.generateUVs ? Array.from(meshData.uvs) : undefined,
      )

      // Create vertex buffer
      const vertexBuffer: VertexBuffer = {
        attributes: vertexAttributes,
        vertexCount: meshData.positions.length / 3,
        stride: 8 * 4, // position(3) + normal(3) + uv(2) * 4 bytes
        interleaved: false,
      }

      // Create index buffer
      const indexBuffer: IndexBuffer = MeshGeneratorHelpers.createTransferableIndexBuffer(
        Array.from(meshData.indices)
      )

      // Calculate bounds
      const bounds: BoundingVolume = MeshGeneratorHelpers.calculateMeshBounds(
        vertexAttributes.positions
      )

      // Create final mesh data
      const generatedMeshData: GeneratedMeshData = {
        vertexBuffer,
        indexBuffer,
        bounds,
        materials: [], // Simplified - would include actual materials
      }

      // Performance metrics
      const totalTime = performance.now() - startTime
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
      const meshData = naiveMeshingAlgorithm(chunkData)
      const opts = options || MeshGeneratorHelpers.createDefaultOptions()

      const vertexAttributes = MeshGeneratorHelpers.createTransferableVertexData(
        Array.from(meshData.positions),
        opts.generateNormals ? Array.from(meshData.normals) : undefined,
        opts.generateUVs ? Array.from(meshData.uvs) : undefined,
      )

      const vertexBuffer: VertexBuffer = {
        attributes: vertexAttributes,
        vertexCount: meshData.positions.length / 3,
        stride: 8 * 4,
        interleaved: false,
      }

      const indexBuffer: IndexBuffer = MeshGeneratorHelpers.createTransferableIndexBuffer(
        Array.from(meshData.indices)
      )

      const bounds: BoundingVolume = MeshGeneratorHelpers.calculateMeshBounds(
        vertexAttributes.positions
      )

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
      const meshData = greedyMeshingAlgorithm(chunkData)
      const opts = options || MeshGeneratorHelpers.createDefaultOptions()

      const vertexAttributes = MeshGeneratorHelpers.createTransferableVertexData(
        Array.from(meshData.positions),
        opts.generateNormals ? Array.from(meshData.normals) : undefined,
        opts.generateUVs ? Array.from(meshData.uvs) : undefined,
      )

      const vertexBuffer: VertexBuffer = {
        attributes: vertexAttributes,
        vertexCount: meshData.positions.length / 3,
        stride: 8 * 4,
        interleaved: false,
      }

      const indexBuffer: IndexBuffer = MeshGeneratorHelpers.createTransferableIndexBuffer(
        Array.from(meshData.indices)
      )

      const bounds: BoundingVolume = MeshGeneratorHelpers.calculateMeshBounds(
        vertexAttributes.positions
      )

      return {
        vertexBuffer,
        indexBuffer,
        bounds,
        materials: [],
      } satisfies GeneratedMeshData
    })

  calculateBounds = (positions: Float32Array): Effect.Effect<BoundingVolume, never, never> =>
    Effect.gen(function* () {
      return MeshGeneratorHelpers.calculateMeshBounds(positions)
    })

  isAvailable = (): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      return true // Always available as it's pure logic
    })
}

/**
 * Live layer for Mesh Generation Domain Service
 */
export const MeshGenerationDomainServiceLive = Layer.succeed(
  MeshGeneratorPort,
  new MeshGenerationDomainService(),
)

/**
 * Utility functions for mesh generation
 */
// Re-export types and utilities for use in other modules
export { MeshGeneratorPort, MeshGeneratorHelpers } from '@domain/ports/mesh-generator.port'

export const MeshGenerationUtils = {
  /**
   * Create default mesh generation request
   */
  createDefaultRequest: (chunkData: ChunkData): MeshGenerationRequest => ({
    chunkData,
    algorithm: 'naive',
    optimizations: MeshGeneratorHelpers.createDefaultOptimizations(),
    options: MeshGeneratorHelpers.createDefaultOptions(),
  }),

  /**
   * Validate mesh generation request
   */
  validateRequest: (request: MeshGenerationRequest): boolean => {
    return (
      request.chunkData !== undefined &&
      request.chunkData.blocks.length >= 0 &&
      ['naive', 'greedy', 'culled'].includes(request.algorithm)
    )
  },

  /**
   * Estimate mesh complexity
   */
  estimateMeshComplexity: (chunkData: ChunkData): number => {
    const solidBlocks = chunkData.blocks.filter(b => b.blockType !== 'air').length
    return solidBlocks * 6 // Maximum 6 faces per block
  },
}