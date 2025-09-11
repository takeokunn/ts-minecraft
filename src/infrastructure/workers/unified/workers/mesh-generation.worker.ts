/**
 * Mesh Generation Worker
 * Dedicated worker for generating 3D meshes from voxel data
 */

import { Effect } from 'effect'
import {
  MeshGenerationRequest,
  MeshGenerationResponse,
  GeneratedMeshData,
  VertexBuffer,
  IndexBuffer,
  MeshPerformanceMetrics,
  BoundingVolume,
  createTransferableVertexData,
  createTransferableIndexBuffer,
  calculateMeshBounds,
  createDefaultOptimizations,
} from '../protocols/mesh.protocol'
import { Block, Position3D, ChunkData } from '../protocols/terrain.protocol'

// Initialize worker capabilities
const workerCapabilities = {
  supportsSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
  supportsTransferableObjects: typeof ArrayBuffer !== 'undefined',
  supportsWasm: typeof WebAssembly !== 'undefined',
  maxMemory: 150 * 1024 * 1024, // 150MB for mesh generation
  threadCount: 1,
}

/**
 * Block face data structure
 */
interface BlockFace {
  positions: number[]
  normals: number[]
  uvs: number[]
  indices: number[]
}

/**
 * Generate cube faces for a block
 */
function generateBlockFaces(block: Block, neighbors: { [key: string]: Block | null }): BlockFace[] {
  const { x, y, z } = block.position
  const faces: BlockFace[] = []

  // Define face data (positions, normals, uvs, indices)
  const faceDefinitions = [
    // Front face (+Z)
    {
      name: 'front',
      positions: [x, y, z + 1, x + 1, y, z + 1, x + 1, y + 1, z + 1, x, y + 1, z + 1],
      normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
      neighborKey: `${x},${y},${z + 1}`,
    },
    // Back face (-Z)
    {
      name: 'back',
      positions: [x + 1, y, z, x, y, z, x, y + 1, z, x + 1, y + 1, z],
      normals: [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
      neighborKey: `${x},${y},${z - 1}`,
    },
    // Right face (+X)
    {
      name: 'right',
      positions: [x + 1, y, z + 1, x + 1, y, z, x + 1, y + 1, z, x + 1, y + 1, z + 1],
      normals: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
      neighborKey: `${x + 1},${y},${z}`,
    },
    // Left face (-X)
    {
      name: 'left',
      positions: [x, y, z, x, y, z + 1, x, y + 1, z + 1, x, y + 1, z],
      normals: [-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0],
      neighborKey: `${x - 1},${y},${z}`,
    },
    // Top face (+Y)
    {
      name: 'top',
      positions: [x, y + 1, z + 1, x + 1, y + 1, z + 1, x + 1, y + 1, z, x, y + 1, z],
      normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
      neighborKey: `${x},${y + 1},${z}`,
    },
    // Bottom face (-Y)
    {
      name: 'bottom',
      positions: [x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1],
      normals: [0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0],
      neighborKey: `${x},${y - 1},${z}`,
    },
  ]

  faceDefinitions.forEach((faceDef, faceIndex) => {
    // Check if this face should be rendered (not occluded by neighbor)
    const neighbor = neighbors[faceDef.neighborKey]
    const shouldRender = !neighbor || neighbor.blockType === 'air' || neighbor.blockType === 'water'

    if (shouldRender) {
      faces.push({
        positions: faceDef.positions,
        normals: faceDef.normals,
        uvs: [0, 0, 1, 0, 1, 1, 0, 1], // Standard UV mapping
        indices: [0, 1, 2, 0, 2, 3].map((i) => i + faceIndex * 4), // Adjust indices for vertex offset
      })
    }
  })

  return faces
}

/**
 * Create neighbor lookup from chunk data
 */
function createNeighborLookup(chunkData: ChunkData, neighbors?: any): { [key: string]: Block | null } {
  const lookup: { [key: string]: Block | null } = {}

  // Add current chunk blocks
  chunkData.blocks.forEach((block) => {
    const key = `${block.position.x},${block.position.y},${block.position.z}`
    lookup[key] = block
  })

  // Add neighbor chunk blocks (simplified)
  if (neighbors) {
    Object.values(neighbors).forEach((neighborChunk: any) => {
      if (neighborChunk?.blocks) {
        neighborChunk.blocks.forEach((block: Block) => {
          const key = `${block.position.x},${block.position.y},${block.position.z}`
          lookup[key] = block
        })
      }
    })
  }

  return lookup
}

/**
 * Naive meshing algorithm
 */
function naiveMeshing(
  chunkData: ChunkData,
  neighbors?: any,
): {
  positions: number[]
  normals: number[]
  uvs: number[]
  indices: number[]
} {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  const neighborLookup = createNeighborLookup(chunkData, neighbors)
  let vertexOffset = 0

  // Process each block
  chunkData.blocks.forEach((block) => {
    if (block.blockType === 'air') return

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
 * Greedy meshing algorithm (simplified version)
 */
function greedyMeshing(
  chunkData: ChunkData,
  neighbors?: any,
): {
  positions: number[]
  normals: number[]
  uvs: number[]
  indices: number[]
} {
  // For this example, we'll use naive meshing
  // A real greedy meshing implementation would merge adjacent faces
  return naiveMeshing(chunkData, neighbors)
}

/**
 * Generate mesh based on algorithm
 */
function generateMeshData(
  algorithm: string,
  chunkData: ChunkData,
  neighbors?: any,
  optimizations?: any,
): { positions: number[]; normals: number[]; uvs: number[]; indices: number[] } {
  switch (algorithm) {
    case 'greedy':
      return greedyMeshing(chunkData, neighbors)
    case 'naive':
    default:
      return naiveMeshing(chunkData, neighbors)
  }
}

/**
 * Apply mesh optimizations
 */
function applyOptimizations(
  meshData: { positions: number[]; normals: number[]; uvs: number[]; indices: number[] },
  optimizations: any,
): { positions: number[]; normals: number[]; uvs: number[]; indices: number[] } {
  let optimized = { ...meshData }

  // Face culling (already handled in face generation)

  // Vertex welding (simplified)
  if (optimizations.enableVertexWelding) {
    // In a real implementation, this would merge duplicate vertices
    // For now, we just return the original data
  }

  return optimized
}

/**
 * Main mesh generation handler
 */
const meshGenerationHandler = (request: MeshGenerationRequest): Effect.Effect<MeshGenerationResponse, never, never> =>
  Effect.gen(function* () {
    const startTime = performance.now()

    const { chunkData, neighbors, algorithm, optimizations, options } = request
    const opts = options || {
      generateNormals: true,
      generateTangents: false,
      generateUVs: true,
      generateColors: false,
      generateLightmap: false,
    }

    // Generate base mesh data
    const meshingStart = performance.now()
    let meshData = generateMeshData(algorithm, chunkData, neighbors, optimizations)
    const meshingTime = performance.now() - meshingStart

    // Apply optimizations
    const optimizationStart = performance.now()
    if (optimizations) {
      meshData = applyOptimizations(meshData, optimizations)
    }
    const optimizationTime = performance.now() - optimizationStart

    // Create transferable vertex attributes
    const vertexAttributes = createTransferableVertexData(meshData.positions, opts.generateNormals ? meshData.normals : undefined, opts.generateUVs ? meshData.uvs : undefined)

    // Create vertex buffer
    const vertexBuffer: VertexBuffer = {
      attributes: vertexAttributes,
      vertexCount: meshData.positions.length / 3,
      stride: 8 * 4, // position(3) + normal(3) + uv(2) * 4 bytes
      interleaved: false,
    }

    // Create index buffer
    const indexBuffer: IndexBuffer = createTransferableIndexBuffer(meshData.indices)

    // Calculate bounds
    const bounds: BoundingVolume = calculateMeshBounds(new Float32Array(meshData.positions))

    // Create final mesh data
    const generatedMeshData: GeneratedMeshData = {
      vertexBuffer,
      indexBuffer,
      materials: [], // Simplified - would include actual materials
      bounds,
    }

    // Performance metrics
    const totalTime = performance.now() - startTime
    const metrics: MeshPerformanceMetrics = {
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
      metrics,
      chunkCoordinates: chunkData.coordinates,
      algorithm,
      lodLevel: request.lodLevel,
      success: true,
      workerId: `mesh-worker-${Date.now()}`,
      generationTime: totalTime,
    } as MeshGenerationResponse
  })

// Worker message handling
self.onmessage = async (event) => {
  const { id, type, payload, timestamp } = event.data

  if (type === 'capabilities') {
    self.postMessage({
      type: 'ready',
      timestamp: Date.now(),
      capabilities: workerCapabilities,
    })
    return
  }

  if (type === 'request') {
    try {
      const response = await Effect.runPromise(meshGenerationHandler(payload))

      self.postMessage({
        id,
        type: 'response',
        data: response,
        timestamp: Date.now(),
      })
    } catch (error) {
      self.postMessage({
        id,
        type: 'error',
        error: {
          name: error instanceof Error ? error.name : 'Error',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        timestamp: Date.now(),
      })
    }
  }
}

// Send ready signal
self.postMessage({
  type: 'ready',
  timestamp: Date.now(),
  capabilities: workerCapabilities,
})
