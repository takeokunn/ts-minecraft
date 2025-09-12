/**
 * Enhanced Mesh Generation Service
 *
 * Pure domain service for mesh generation with advanced algorithms
 * and optimizations. Extracted from infrastructure layer with all
 * technology-agnostic geometry processing logic.
 */

import { Effect, Context, Layer, pipe } from 'effect'
import { BlockType, BlockPropertiesUtils } from '@domain/constants/block-properties'
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
 * Advanced mesh generation algorithms
 */
export type MeshAlgorithm = 'naive' | 'culled' | 'greedy' | 'surface_nets' | 'marching_cubes'

/**
 * Advanced face culling modes
 */
export type CullingMode = 'none' | 'basic' | 'aggressive' | 'ambient_occlusion'

/**
 * Level of detail settings
 */
export interface LODSettings {
  readonly enabled: boolean
  readonly maxDistance: number
  readonly levels: readonly {
    readonly distance: number
    readonly vertexReduction: number
    readonly faceReduction: number
  }[]
}

/**
 * Enhanced mesh optimization settings
 */
export interface EnhancedMeshOptimizations extends MeshOptimizations {
  readonly enableLOD?: LODSettings
  readonly enableAmbientOcclusion?: boolean
  readonly enableVertexColors?: boolean
  readonly enableTextureAtlas?: boolean
  readonly cullMode?: CullingMode
  readonly optimizeForGPU?: boolean
}

/**
 * Enhanced mesh generation request
 */
export interface EnhancedMeshGenerationRequest extends MeshGenerationRequest {
  readonly enhancedOptimizations?: EnhancedMeshOptimizations
  readonly meshAlgorithm?: MeshAlgorithm
  readonly cullingMode?: CullingMode
}

/**
 * Block face information with enhanced features
 */
interface EnhancedBlockFace {
  readonly positions: readonly number[]
  readonly normals: readonly number[]
  readonly uvs: readonly number[]
  readonly indices: readonly number[]
  readonly colors?: readonly number[]
  readonly ambientOcclusion?: readonly number[]
  readonly textureId?: number
  readonly materialId?: number
}

/**
 * Face direction constants for clarity and type safety
 */
const FaceDirection = {
  FRONT: 'front',
  BACK: 'back',
  RIGHT: 'right',
  LEFT: 'left',
  TOP: 'top',
  BOTTOM: 'bottom',
} as const

type FaceDirectionType = (typeof FaceDirection)[keyof typeof FaceDirection]

/**
 * Vertex attribute configuration
 */
interface VertexAttributes {
  readonly position: readonly number[]
  readonly normal?: readonly number[]
  readonly uv?: readonly number[]
  readonly color?: readonly number[]
  readonly ambientOcclusion?: readonly number[]
}

/**
 * Advanced mesh generation algorithms
 * Pure functional module for enhanced mesh processing
 */
export const EnhancedMeshAlgorithms = {
  /**
   * Generate cube faces for a block with enhanced occlusion culling
   */
  generateEnhancedBlockFaces: (
    block: GeneratedBlock,
    neighborLookup: { readonly [key: string]: GeneratedBlock | null },
    options: EnhancedMeshOptimizations,
  ): readonly EnhancedBlockFace[] => {
    const { x, y, z } = block.position
    const faces: EnhancedBlockFace[] = []

    // Define face data with geometric calculations
    const faceDefinitions = [
      // Front face (+Z)
      {
        name: FaceDirection.FRONT as FaceDirectionType,
        positions: [x, y, z + 1, x + 1, y, z + 1, x + 1, y + 1, z + 1, x, y + 1, z + 1],
        normals: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
        neighborKey: `${x},${y},${z + 1}`,
        uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      },
      // Back face (-Z)
      {
        name: FaceDirection.BACK as FaceDirectionType,
        positions: [x + 1, y, z, x, y, z, x, y + 1, z, x + 1, y + 1, z],
        normals: [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1],
        neighborKey: `${x},${y},${z - 1}`,
        uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      },
      // Right face (+X)
      {
        name: FaceDirection.RIGHT as FaceDirectionType,
        positions: [x + 1, y, z + 1, x + 1, y, z, x + 1, y + 1, z, x + 1, y + 1, z + 1],
        normals: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
        neighborKey: `${x + 1},${y},${z}`,
        uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      },
      // Left face (-X)
      {
        name: FaceDirection.LEFT as FaceDirectionType,
        positions: [x, y, z, x, y, z + 1, x, y + 1, z + 1, x, y + 1, z],
        normals: [-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0],
        neighborKey: `${x - 1},${y},${z}`,
        uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      },
      // Top face (+Y)
      {
        name: FaceDirection.TOP as FaceDirectionType,
        positions: [x, y + 1, z + 1, x + 1, y + 1, z + 1, x + 1, y + 1, z, x, y + 1, z],
        normals: [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
        neighborKey: `${x},${y + 1},${z}`,
        uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      },
      // Bottom face (-Y)
      {
        name: FaceDirection.BOTTOM as FaceDirectionType,
        positions: [x, y, z, x + 1, y, z, x + 1, y, z + 1, x, y, z + 1],
        normals: [0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0],
        neighborKey: `${x},${y - 1},${z}`,
        uvs: [0, 0, 1, 0, 1, 1, 0, 1],
      },
    ]

    faceDefinitions.forEach((faceDef, faceIndex) => {
      // Enhanced occlusion culling
      const neighbor = neighborLookup[faceDef.neighborKey]
      const shouldRender = EnhancedMeshAlgorithms.shouldRenderEnhancedFace(neighbor, block, faceDef.name, options.cullMode ?? 'basic')

      if (shouldRender) {
        const blockColor = BlockPropertiesUtils.getBlockColor(block.blockType)

        const face: EnhancedBlockFace = {
          positions: faceDef.positions,
          normals: faceDef.normals,
          uvs: faceDef.uvs,
          indices: [0, 1, 2, 0, 2, 3].map((i) => i + faceIndex * 4),
        }

        // Add vertex colors if enabled
        if (options.enableVertexColors) {
          const vertexColors = []
          for (let i = 0; i < 4; i++) {
            vertexColors.push(...blockColor)
          }
          face.colors = vertexColors
        }

        // Add ambient occlusion if enabled
        if (options.enableAmbientOcclusion) {
          const aoValues = EnhancedMeshAlgorithms.calculateAmbientOcclusion(block.position, faceDef.name, neighborLookup)
          face.ambientOcclusion = aoValues
        }

        // Set texture/material ID for texture atlas
        if (options.enableTextureAtlas) {
          const textureInfo = BlockPropertiesUtils.getBlockTextures(block.blockType)
          face.textureId = EnhancedMeshAlgorithms.getTextureId(textureInfo, faceDef.name)
          face.materialId = EnhancedMeshAlgorithms.getMaterialId(block.blockType)
        }

        faces.push(face)
      }
    })

    return faces
  },

  /**
   * Enhanced face culling with multiple modes
   */
  shouldRenderEnhancedFace: (neighbor: GeneratedBlock | null, currentBlock: GeneratedBlock, faceDirection: FaceDirectionType, cullMode: CullingMode): boolean => {
    switch (cullMode) {
      case 'none':
        return true

      case 'basic':
        // Render if no neighbor exists (chunk boundary)
        if (!neighbor) return true
        // Render if neighbor is air or transparent
        return neighbor.blockType === 'air' || BlockPropertiesUtils.isBlockTransparent(neighbor.blockType)

      case 'aggressive':
        // Aggressive culling - also cull faces between same block types
        if (!neighbor) return true
        if (neighbor.blockType === 'air') return true
        if (neighbor.blockType === currentBlock.blockType) return false
        return BlockPropertiesUtils.isBlockTransparent(neighbor.blockType)

      case 'ambient_occlusion':
        // Special culling for ambient occlusion
        if (!neighbor) return true
        const isNeighborTransparent = neighbor.blockType === 'air' || BlockPropertiesUtils.isBlockTransparent(neighbor.blockType)
        // Consider light transmission for AO
        return isNeighborTransparent || BlockPropertiesUtils.isBlockLightSource(neighbor.blockType)

      default:
        return true
    }
  },

  /**
   * Calculate ambient occlusion values for face vertices
   */
  calculateAmbientOcclusion: (blockPos: Position3D, faceDirection: FaceDirectionType, neighborLookup: { readonly [key: string]: GeneratedBlock | null }): readonly number[] => {
    const aoValues: number[] = []

    // Define the vertex positions for each face
    const vertexOffsets = EnhancedMeshAlgorithms.getVertexOffsetsForFace(faceDirection)

    vertexOffsets.forEach((offset) => {
      const vertexPos = {
        x: blockPos.x + offset.x,
        y: blockPos.y + offset.y,
        z: blockPos.z + offset.z,
      }

      // Sample surrounding blocks for AO calculation
      const aoSamples = EnhancedMeshAlgorithms.getAOSamples(vertexPos, faceDirection)
      let occludedCount = 0

      aoSamples.forEach((samplePos) => {
        const key = `${samplePos.x},${samplePos.y},${samplePos.z}`
        const neighbor = neighborLookup[key]
        if (neighbor && neighbor.blockType !== 'air' && !BlockPropertiesUtils.isBlockTransparent(neighbor.blockType)) {
          occludedCount++
        }
      })

      // Calculate AO value (1.0 = no occlusion, 0.0 = full occlusion)
      const maxSamples = aoSamples.length
      const aoValue = 1.0 - (occludedCount / maxSamples) * 0.8
      aoValues.push(Math.max(0.2, aoValue)) // Minimum AO to avoid complete darkness
    })

    return aoValues
  },

  /**
   * Get vertex offsets for a specific face direction
   */
  getVertexOffsetsForFace: (faceDirection: FaceDirectionType): readonly Position3D[] => {
    switch (faceDirection) {
      case FaceDirection.FRONT: // +Z
        return [
          { x: 0, y: 0, z: 1 },
          { x: 1, y: 0, z: 1 },
          { x: 1, y: 1, z: 1 },
          { x: 0, y: 1, z: 1 },
        ]
      case FaceDirection.BACK: // -Z
        return [
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 },
          { x: 1, y: 1, z: 0 },
        ]
      case FaceDirection.RIGHT: // +X
        return [
          { x: 1, y: 0, z: 1 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 1, z: 0 },
          { x: 1, y: 1, z: 1 },
        ]
      case FaceDirection.LEFT: // -X
        return [
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 0, z: 1 },
          { x: 0, y: 1, z: 1 },
          { x: 0, y: 1, z: 0 },
        ]
      case FaceDirection.TOP: // +Y
        return [
          { x: 0, y: 1, z: 1 },
          { x: 1, y: 1, z: 1 },
          { x: 1, y: 1, z: 0 },
          { x: 0, y: 1, z: 0 },
        ]
      case FaceDirection.BOTTOM: // -Y
        return [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 0, z: 0 },
          { x: 1, y: 0, z: 1 },
          { x: 0, y: 0, z: 1 },
        ]
      default:
        return []
    }
  },

  /**
   * Get AO sampling positions around a vertex
   */
  getAOSamples: (vertexPos: Position3D, faceDirection: FaceDirectionType): readonly Position3D[] => {
    // Simplified AO sampling - sample neighboring positions
    const samples: Position3D[] = []

    // Add samples in a 3x3 grid around the vertex based on face direction
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dy === 0 && dz === 0) continue // Skip center

          samples.push({
            x: vertexPos.x + dx,
            y: vertexPos.y + dy,
            z: vertexPos.z + dz,
          })
        }
      }
    }

    return samples
  },

  /**
   * Get texture ID for a block face
   */
  getTextureId: (textureInfo: unknown, faceDirection: FaceDirectionType): number => {
    // Simple texture ID mapping - in a real implementation this would use a texture atlas
    if (typeof textureInfo === 'object' && textureInfo !== null && 'all' in textureInfo) {
      return EnhancedMeshAlgorithms.hashStringToId((textureInfo as { all: string }).all)
    }

    if (typeof textureInfo === 'object' && textureInfo !== null) {
      const textureObj = textureInfo as Record<string, string>
      switch (faceDirection) {
        case FaceDirection.TOP:
          return EnhancedMeshAlgorithms.hashStringToId(textureObj.top ?? textureObj.all ?? 'default')
        case FaceDirection.BOTTOM:
          return EnhancedMeshAlgorithms.hashStringToId(textureObj.bottom ?? textureObj.all ?? 'default')
        default:
          return EnhancedMeshAlgorithms.hashStringToId(textureObj.sides ?? textureObj.all ?? 'default')
      }
    }
    
    // Fallback for non-object textureInfo
    return EnhancedMeshAlgorithms.hashStringToId('default')
  },

  /**
   * Get material ID for a block type
   */
  getMaterialId: (blockType: BlockType): number => {
    return EnhancedMeshAlgorithms.hashStringToId(blockType)
  },

  /**
   * Hash a string to a numeric ID
   */
  hashStringToId: (str: string): number => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  },

  /**
   * Greedy meshing algorithm with enhanced features
   */
  generateEnhancedGreedyMesh: (
    chunkData: ChunkData,
    neighbors?: { readonly [key: string]: ChunkData },
    options?: EnhancedMeshOptimizations,
  ): VertexAttributes & { readonly indices: readonly number[] } => {
    // For this implementation, we use enhanced naive meshing as a base
    // A full greedy meshing implementation would involve analyzing adjacent faces
    // and merging them into larger quads to reduce vertex count
    return EnhancedMeshAlgorithms.generateEnhancedNaiveMesh(chunkData, neighbors, options)
  },

  /**
   * Enhanced naive meshing algorithm
   */
  generateEnhancedNaiveMesh: (
    chunkData: ChunkData,
    neighbors?: { readonly [key: string]: ChunkData },
    options?: EnhancedMeshOptimizations,
  ): VertexAttributes & { readonly indices: readonly number[] } => {
    const positions: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []
    const colors: number[] = []
    const ambientOcclusion: number[] = []

    const neighborLookup = EnhancedMeshAlgorithms.createNeighborLookup(chunkData, neighbors)
    let vertexOffset = 0

    // Process each solid block
    chunkData.blocks
      .filter((block) => block.blockType !== 'air')
      .forEach((block) => {
        const blockFaces = EnhancedMeshAlgorithms.generateEnhancedBlockFaces(block, neighborLookup, options ?? {})

        blockFaces.forEach((face) => {
          // Add vertex data
          positions.push(...face.positions)
          normals.push(...face.normals)
          uvs.push(...face.uvs)

          // Add colors if available
          if (face.colors && options?.enableVertexColors) {
            colors.push(...face.colors)
          }

          // Add ambient occlusion if available
          if (face.ambientOcclusion && options?.enableAmbientOcclusion) {
            ambientOcclusion.push(...face.ambientOcclusion)
          }

          // Add indices with proper vertex offset
          const faceIndices = face.indices.map((i) => i + vertexOffset)
          indices.push(...faceIndices)

          vertexOffset += 4 // 4 vertices per face
        })
      })

    const result: VertexAttributes & { readonly indices: readonly number[] } = {
      position: positions,
      indices,
    }

    if (normals.length > 0) result.normal = normals
    if (uvs.length > 0) result.uv = uvs
    if (colors.length > 0) result.color = colors
    if (ambientOcclusion.length > 0) result.ambientOcclusion = ambientOcclusion

    return result
  },

  /**
   * Create neighbor lookup table from chunk data
   */
  createNeighborLookup: (chunkData: ChunkData, neighbors?: { readonly [key: string]: ChunkData }): { readonly [key: string]: GeneratedBlock | null } => {
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
  },
} as const

/**
 * Enhanced Mesh Generation Service Implementation
 * Pure functional service factory for mesh generation with Effect-TS
 */
export const createEnhancedMeshGenerationService = (): IMeshGenerator => {
  // Helper functions for the service
  const generateMeshByEnhancedAlgorithm = (
    algorithm: MeshAlgorithm,
    chunkData: ChunkData,
    neighbors?: { readonly [key: string]: ChunkData },
    options?: EnhancedMeshOptimizations,
  ): VertexAttributes & { readonly indices: readonly number[] } => {
    switch (algorithm) {
      case 'greedy':
        return EnhancedMeshAlgorithms.generateEnhancedGreedyMesh(chunkData, neighbors, options)
      case 'surface_nets':
        // Would implement surface nets algorithm for smoother terrain
        return EnhancedMeshAlgorithms.generateEnhancedNaiveMesh(chunkData, neighbors, options)
      case 'marching_cubes':
        // Would implement marching cubes for organic shapes
        return EnhancedMeshAlgorithms.generateEnhancedNaiveMesh(chunkData, neighbors, options)
      case 'culled':
      case 'naive':
      default:
        return EnhancedMeshAlgorithms.generateEnhancedNaiveMesh(chunkData, neighbors, options)
    }
  }

  const applyVertexWelding = (meshData: VertexAttributes & { readonly indices: readonly number[] }): VertexAttributes & { readonly indices: readonly number[] } => {
    // Simplified vertex welding implementation
    // In a full implementation, this would find vertices within a threshold and merge them
    return meshData
  }

  const applyIndexOptimization = (meshData: VertexAttributes & { readonly indices: readonly number[] }): VertexAttributes & { readonly indices: readonly number[] } => {
    // Simplified index optimization
    // In a full implementation, this would use algorithms like Forsyth vertex cache optimization
    return meshData
  }

  const applyLODOptimization = (
    meshData: VertexAttributes & { readonly indices: readonly number[] },
    lodSettings: LODSettings,
  ): VertexAttributes & { readonly indices: readonly number[] } => {
    // Simplified LOD implementation
    // Would reduce vertices and faces based on LOD settings
    return meshData
  }

  const applyGPUOptimizations = (meshData: VertexAttributes & { readonly indices: readonly number[] }): VertexAttributes & { readonly indices: readonly number[] } => {
    // GPU optimizations like vertex attribute interleaving
    return meshData
  }

  const applyEnhancedOptimizations = (
    meshData: VertexAttributes & { readonly indices: readonly number[] },
    optimizations: EnhancedMeshOptimizations,
  ): VertexAttributes & { readonly indices: readonly number[] } => {
    let optimized = { ...meshData }

    // Vertex welding optimization
    if (optimizations.enableVertexWelding) {
      optimized = applyVertexWelding(optimized)
    }

    // Index optimization for GPU cache efficiency
    if (optimizations.enableIndexOptimization) {
      optimized = applyIndexOptimization(optimized)
    }

    // LOD optimization
    if (optimizations.enableLOD?.enabled) {
      optimized = applyLODOptimization(optimized, optimizations.enableLOD)
    }

    // GPU-specific optimizations
    if (optimizations.optimizeForGPU) {
      optimized = applyGPUOptimizations(optimized)
    }

    return optimized
  }

  const createDefaultEnhancedOptimizations = (baseOpts?: MeshOptimizations): EnhancedMeshOptimizations => ({
    enableFaceCulling: baseOpts?.enableFaceCulling ?? true,
    enableVertexWelding: baseOpts?.enableVertexWelding ?? false,
    enableIndexOptimization: baseOpts?.enableIndexOptimization ?? false,
    enableVertexColors: true,
    enableAmbientOcclusion: false,
    enableTextureAtlas: false,
    cullMode: 'basic',
    optimizeForGPU: false,
    enableLOD: {
      enabled: false,
      maxDistance: 100,
      levels: [
        { distance: 25, vertexReduction: 0.0, faceReduction: 0.0 },
        { distance: 50, vertexReduction: 0.25, faceReduction: 0.25 },
        { distance: 100, vertexReduction: 0.5, faceReduction: 0.5 },
      ],
    },
  })

  const calculateVertexStride = (meshData: VertexAttributes & { readonly indices: readonly number[] }): number => {
    let stride = 3 * 4 // position (3 floats)
    if (meshData.normal) stride += 3 * 4 // normal (3 floats)
    if (meshData.uv) stride += 2 * 4 // uv (2 floats)
    if (meshData.color) stride += 3 * 4 // color (3 floats)
    if (meshData.ambientOcclusion) stride += 1 * 4 // ao (1 float)
    return stride
  }

  const calculateCulledFaces = (inputBlocks: number, outputIndices: number): number => {
    const maxPossibleFaces = inputBlocks * 6 // 6 faces per block
    const outputFaces = outputIndices / 6 // 6 indices per face (2 triangles)
    return Math.max(0, maxPossibleFaces - outputFaces)
  }

  const calculateMemoryUsage = (meshData: VertexAttributes & { readonly indices: readonly number[] }): number => {
    let memoryUsage = 0

    memoryUsage += meshData.position.length * 4 // positions
    if (meshData.normal) memoryUsage += meshData.normal.length * 4 // normals
    if (meshData.uv) memoryUsage += meshData.uv.length * 4 // uvs
    if (meshData.color) memoryUsage += meshData.color.length * 4 // colors
    if (meshData.ambientOcclusion) memoryUsage += meshData.ambientOcclusion.length * 4 // ao
    memoryUsage += meshData.indices.length * 4 // indices

    return memoryUsage
  }

  const calculateMeshQuality = (meshData: VertexAttributes & { readonly indices: readonly number[] }): number => {
    // Simple quality metric based on triangle count and vertex reuse
    const vertexCount = meshData.position.length / 3
    const triangleCount = meshData.indices.length / 3

    if (triangleCount === 0) return 0

    // Higher vertex reuse indicates better quality/optimization
    const vertexReuseRatio = triangleCount / vertexCount
    return Math.min(1.0, vertexReuseRatio / 2.0) // Normalize to 0-1 range
  }

  const createGeneratedMeshData = (
    meshData: VertexAttributes & { readonly indices: readonly number[] },
    options?: MeshGenerationOptions,
  ): Effect.Effect<GeneratedMeshData, never, never> => {
    const opts = options || MeshGeneratorHelpers.createDefaultOptions()

    const vertexAttributes = MeshGeneratorHelpers.createTransferableVertexData(
      meshData.position,
      opts.generateNormals && meshData.normal ? meshData.normal : undefined,
      opts.generateUVs && meshData.uv ? meshData.uv : undefined,
    )

    const vertexBuffer: VertexBuffer = {
      attributes: {
        ...vertexAttributes,
        colors: meshData.color ? meshData.color : undefined,
        ambientOcclusion: meshData.ambientOcclusion ? meshData.ambientOcclusion : undefined,
      },
      vertexCount: meshData.position.length / 3,
      stride: calculateVertexStride(meshData),
      interleaved: false,
    }

    const indexBuffer: IndexBuffer = MeshGeneratorHelpers.createTransferableIndexBuffer(meshData.indices)

    const bounds: BoundingVolume = MeshGeneratorHelpers.calculateMeshBounds(meshData.position)

    return Effect.succeed({
      vertexBuffer,
      indexBuffer,
      bounds,
      materials: [],
    } satisfies GeneratedMeshData)
  }

  // Return the service implementation
  return {
    generateMesh: (request: EnhancedMeshGenerationRequest): Effect.Effect<MeshGenerationResult, never, never> =>
      Effect.gen(function* () {
        const startTime = performance.now()
        const { chunkData, neighbors, algorithm, optimizations, options, lodLevel } = request

        const opts = options || MeshGeneratorHelpers.createDefaultOptions()
        const enhancedOpts = request.enhancedOptimizations || createDefaultEnhancedOptimizations(optimizations)
        const meshAlg = request.meshAlgorithm || algorithm || 'naive'

        // Generate base mesh data using enhanced algorithms
        const meshingStart = performance.now()
        let meshData = generateMeshByEnhancedAlgorithm(meshAlg, chunkData, neighbors, enhancedOpts)
        const meshingTime = performance.now() - meshingStart

        // Apply enhanced optimizations
        const optimizationStart = performance.now()
        meshData = applyEnhancedOptimizations(meshData, enhancedOpts)
        const optimizationTime = performance.now() - optimizationStart

        // Create transferable vertex attributes
        const vertexAttributes = MeshGeneratorHelpers.createTransferableVertexData(
          meshData.position,
          opts.generateNormals && meshData.normal ? meshData.normal : undefined,
          opts.generateUVs && meshData.uv ? meshData.uv : undefined,
        )

        // Create vertex buffer with enhanced attributes
        const vertexBuffer: VertexBuffer = {
          attributes: {
            ...vertexAttributes,
            colors: meshData.color ? meshData.color : undefined,
            ambientOcclusion: meshData.ambientOcclusion ? meshData.ambientOcclusion : undefined,
          },
          vertexCount: meshData.position.length / 3,
          stride: calculateVertexStride(meshData),
          interleaved: false,
        }

        // Create index buffer
        const indexBuffer: IndexBuffer = MeshGeneratorHelpers.createTransferableIndexBuffer(meshData.indices)

        // Calculate bounds
        const bounds: BoundingVolume = MeshGeneratorHelpers.calculateMeshBounds(meshData.position)

        // Create final mesh data
        const generatedMeshData: GeneratedMeshData = {
          vertexBuffer,
          indexBuffer,
          bounds,
          materials: [], // Simplified - would include actual materials based on block types
        }

        // Enhanced performance metrics
        const totalTime = performance.now() - startTime
        const metrics: MeshGenerationMetrics = {
          totalTime,
          meshingTime,
          optimizationTime,
          inputBlocks: chunkData.blocks.length,
          outputVertices: vertexBuffer.vertexCount,
          outputTriangles: indexBuffer.count / 3,
          facesCulled: calculateCulledFaces(chunkData.blocks.length, indexBuffer.count),
          verticesWelded: 0, // Would be calculated during vertex welding
          outputMemoryUsage: calculateMemoryUsage(meshData),
          meshQuality: calculateMeshQuality(meshData),
        }

        return {
          meshData: generatedMeshData,
          chunkCoordinates: chunkData.coordinates,
          algorithm: meshAlg,
          lodLevel,
          generationTime: totalTime,
          metrics,
        } satisfies MeshGenerationResult
      }),

    generateNaiveMesh: (chunkData: ChunkData, options?: MeshGenerationOptions): Effect.Effect<GeneratedMeshData, never, never> =>
      Effect.gen(function* () {
        const meshData = EnhancedMeshAlgorithms.generateEnhancedNaiveMesh(chunkData, undefined, {})
        return yield* createGeneratedMeshData(meshData, options)
      }),

    generateGreedyMesh: (chunkData: ChunkData, options?: MeshGenerationOptions): Effect.Effect<GeneratedMeshData, never, never> =>
      Effect.gen(function* () {
        const meshData = EnhancedMeshAlgorithms.generateEnhancedGreedyMesh(chunkData, undefined, {})
        return yield* createGeneratedMeshData(meshData, options)
      }),

    calculateBounds: (positions: Float32Array): Effect.Effect<BoundingVolume, never, never> =>
      Effect.gen(function* () {
        return MeshGeneratorHelpers.calculateMeshBounds(positions)
      }),

    isAvailable: (): Effect.Effect<boolean, never, never> =>
      Effect.gen(function* () {
        return true // Always available as it's pure logic
      }),
  }
}

/**
 * Live layer for Enhanced Mesh Generation Service
 */
export const EnhancedMeshGenerationServiceLive = Layer.succeed(MeshGeneratorPort, createEnhancedMeshGenerationService())

/**
 * Mesh Generation Service interface for dependency injection
 */
export interface MeshGenerationService extends IMeshGenerator {}

export const MeshGenerationService = Context.GenericTag<MeshGenerationService>('MeshGenerationService')

/**
 * Create mesh generation service layer with Effect-TS patterns
 */
export const meshGenerationServiceLive = Layer.succeed(MeshGenerationService, createEnhancedMeshGenerationService())

// Re-export original service for backward compatibility
export * from '@domain/services/mesh-generation-domain.service'
export {
  MeshGenerationDomainService as MeshGenerationDomainServiceOriginal,
  MeshGenerationDomainServiceLive as MeshGenerationDomainServiceLiveOriginal,
} from '@domain/services/mesh-generation-domain.service'

/**
 * Utility functions for mesh generation
 */
export const MeshGenerationServiceUtils = {
  /**
   * Create default enhanced mesh generation request
   */
  createDefaultEnhancedRequest: (chunkData: ChunkData): EnhancedMeshGenerationRequest => ({
    chunkData,
    algorithm: 'naive',
    optimizations: MeshGeneratorHelpers.createDefaultOptimizations(),
    options: MeshGeneratorHelpers.createDefaultOptions(),
    meshAlgorithm: 'naive',
    cullingMode: 'basic',
    enhancedOptimizations: {
      enableFaceCulling: true,
      enableVertexWelding: false,
      enableIndexOptimization: false,
      enableVertexColors: true,
      enableAmbientOcclusion: false,
      enableTextureAtlas: false,
      cullMode: 'basic',
      optimizeForGPU: false,
    },
  }),

  /**
   * Validate enhanced mesh generation request
   */
  validateEnhancedRequest: (request: EnhancedMeshGenerationRequest): boolean => {
    return (
      request.chunkData !== undefined &&
      request.chunkData.blocks.length >= 0 &&
      (request.meshAlgorithm === undefined || ['naive', 'culled', 'greedy', 'surface_nets', 'marching_cubes'].includes(request.meshAlgorithm)) &&
      (request.cullingMode === undefined || ['none', 'basic', 'aggressive', 'ambient_occlusion'].includes(request.cullingMode))
    )
  },

  /**
   * Estimate enhanced mesh complexity
   */
  estimateEnhancedMeshComplexity: (request: EnhancedMeshGenerationRequest): number => {
    const solidBlocks = request.chunkData.blocks.filter((b) => b.blockType !== 'air').length
    let complexity = solidBlocks * 6 // Base complexity

    // Algorithm complexity multipliers
    switch (request.meshAlgorithm) {
      case 'greedy':
        complexity *= 2.5
        break
      case 'surface_nets':
        complexity *= 4.0
        break
      case 'marching_cubes':
        complexity *= 6.0
        break
    }

    // Optimization complexity additions
    if (request.enhancedOptimizations?.enableAmbientOcclusion) complexity += solidBlocks * 3
    if (request.enhancedOptimizations?.enableVertexWelding) complexity += solidBlocks
    if (request.enhancedOptimizations?.enableLOD?.enabled) complexity += solidBlocks * 0.5

    return Math.floor(complexity)
  },

  /**
   * Get recommended algorithm for chunk size
   */
  getRecommendedAlgorithm: (blockCount: number): MeshAlgorithm => {
    if (blockCount < 100) return 'naive'
    if (blockCount < 1000) return 'culled'
    if (blockCount < 5000) return 'greedy'
    return 'surface_nets'
  },

  /**
   * Get memory estimate for mesh generation
   */
  estimateMemoryUsage: (request: EnhancedMeshGenerationRequest): number => {
    const solidBlocks = request.chunkData.blocks.filter((b) => b.blockType !== 'air').length
    let memoryUsage = solidBlocks * 6 * 4 * 8 * 4 // positions + normals + uvs + indices

    if (request.enhancedOptimizations?.enableVertexColors) {
      memoryUsage += solidBlocks * 6 * 4 * 3 * 4 // colors
    }

    if (request.enhancedOptimizations?.enableAmbientOcclusion) {
      memoryUsage += solidBlocks * 6 * 4 * 1 * 4 // ambient occlusion values
    }

    return memoryUsage
  },
} as const
