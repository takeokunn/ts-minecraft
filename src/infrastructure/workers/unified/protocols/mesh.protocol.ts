import * as S from 'effect/Schema'
import { ChunkCoordinatesSchema } from '/value-objects/coordinates'
import { Position3D, Block, ChunkData } from './terrain.protocol'

/**
 * Mesh Generation Protocol
 * Type-safe message schemas for mesh generation worker communication
 */

// ============================================
// Mesh Data Types
// ============================================

/**
 * Vertex attribute data
 */
export const VertexAttribute = S.Struct({
  name: S.String,
  size: S.Number.pipe(S.int(), S.positive), // Components per vertex (1, 2, 3, or 4)
  type: S.Union(S.Literal('float'), S.Literal('int'), S.Literal('uint'), S.Literal('byte'), S.Literal('ubyte')),
  normalized: S.optional(S.Boolean),
  data: S.Unknown, // TypedArray
}).pipe(S.identifier('VertexAttribute'))
export type VertexAttribute = S.Schema.Type<typeof VertexAttribute>

/**
 * Vertex buffer layout
 */
export const VertexBuffer = S.Struct({
  attributes: S.Array(VertexAttribute),
  vertexCount: S.Number.pipe(S.int(), S.nonNegative),
  stride: S.Number.pipe(S.int(), S.positive), // Bytes per vertex
  interleaved: S.Boolean,
}).pipe(S.identifier('VertexBuffer'))
export type VertexBuffer = S.Schema.Type<typeof VertexBuffer>

/**
 * Index buffer data
 */
export const IndexBuffer = S.Struct({
  data: S.Unknown, // Uint16Array or Uint32Array
  count: S.Number.pipe(S.int(), S.nonNegative),
  format: S.Union(S.Literal('uint16'), S.Literal('uint32')),
}).pipe(S.identifier('IndexBuffer'))
export type IndexBuffer = S.Schema.Type<typeof IndexBuffer>

/**
 * Material texture reference
 */
export const TextureReference = S.Struct({
  id: S.String,
  type: S.Union(S.Literal('diffuse'), S.Literal('normal'), S.Literal('specular'), S.Literal('emission'), S.Literal('height'), S.Literal('occlusion')),
  uvChannel: S.Number.pipe(S.int(), S.nonNegative),
  wrapS: S.optional(S.Union(S.Literal('repeat'), S.Literal('clamp'), S.Literal('mirror'))),
  wrapT: S.optional(S.Union(S.Literal('repeat'), S.Literal('clamp'), S.Literal('mirror'))),
}).pipe(S.identifier('TextureReference'))
export type TextureReference = S.Schema.Type<typeof TextureReference>

/**
 * Material definition
 */
export const MeshMaterial = S.Struct({
  id: S.String,
  name: S.String,

  // Basic material properties
  albedo: S.optional(
    S.Struct({
      r: S.Number.pipe(S.between(0, 1)),
      g: S.Number.pipe(S.between(0, 1)),
      b: S.Number.pipe(S.between(0, 1)),
      a: S.Number.pipe(S.between(0, 1)),
    }),
  ),

  // Physically-based properties
  metallic: S.optional(S.Number.pipe(S.between(0, 1))),
  roughness: S.optional(S.Number.pipe(S.between(0, 1))),
  emission: S.optional(
    S.Struct({
      r: S.Number.pipe(S.nonNegative),
      g: S.Number.pipe(S.nonNegative),
      b: S.Number.pipe(S.nonNegative),
    }),
  ),

  // Textures
  textures: S.optional(S.Array(TextureReference)),

  // Rendering properties
  transparent: S.optional(S.Boolean),
  doubleSided: S.optional(S.Boolean),
  alphaTest: S.optional(S.Number.pipe(S.between(0, 1))),
}).pipe(S.identifier('MeshMaterial'))
export type MeshMaterial = S.Schema.Type<typeof MeshMaterial>

/**
 * Level of Detail (LOD) information
 */
export const LodLevel = S.Struct({
  level: S.Number.pipe(S.int(), S.between(0, 4)),
  distance: S.Number.pipe(S.positive),
  vertexReduction: S.Number.pipe(S.between(0, 1)),
  faceReduction: S.Number.pipe(S.between(0, 1)),
}).pipe(S.identifier('LodLevel'))
export type LodLevel = S.Schema.Type<typeof LodLevel>

/**
 * Bounding volume data
 */
export const BoundingVolume = S.Struct({
  // Axis-aligned bounding box
  aabb: S.Struct({
    min: Position3D,
    max: Position3D,
  }),

  // Bounding sphere
  sphere: S.optional(
    S.Struct({
      center: Position3D,
      radius: S.Number.pipe(S.positive),
    }),
  ),

  // Oriented bounding box
  obb: S.optional(
    S.Struct({
      center: Position3D,
      halfExtents: Position3D,
      orientation: S.Struct({
        x: S.Number,
        y: S.Number,
        z: S.Number,
        w: S.Number,
      }),
    }),
  ),
}).pipe(S.identifier('BoundingVolume'))
export type BoundingVolume = S.Schema.Type<typeof BoundingVolume>

// ============================================
// Mesh Generation Options
// ============================================

/**
 * Meshing algorithm type
 */
export const MeshingAlgorithm = S.Union(
  S.Literal('naive'),
  S.Literal('greedy'),
  S.Literal('marching_cubes'),
  S.Literal('dual_contouring'),
  S.Literal('surface_nets'),
  S.Literal('transvoxel'),
).pipe(S.identifier('MeshingAlgorithm'))
export type MeshingAlgorithm = S.Schema.Type<typeof MeshingAlgorithm>

/**
 * Optimization settings
 */
export const OptimizationSettings = S.Struct({
  enableFaceCulling: S.Boolean,
  enableBackfaceCulling: S.Boolean,
  enableOcclusionCulling: S.Boolean,
  enableGreedyMeshing: S.Boolean,
  enableVertexWelding: S.Boolean,

  // Thresholds
  weldingThreshold: S.optional(S.Number.pipe(S.positive)),
  normalSmoothingAngle: S.optional(S.Number.pipe(S.between(0, 180))),

  // LOD settings
  enableLod: S.Boolean,
  lodDistances: S.optional(S.Array(S.Number.pipe(S.positive))),

  // Texture atlas
  enableTextureAtlas: S.optional(S.Boolean),
  atlasSize: S.optional(S.Number.pipe(S.int(), S.positive)),
}).pipe(S.identifier('OptimizationSettings'))
export type OptimizationSettings = S.Schema.Type<typeof OptimizationSettings>

/**
 * Lighting calculation settings
 */
export const LightingSettings = S.Struct({
  enableLighting: S.Boolean,
  enableShadows: S.Boolean,
  enableAmbientOcclusion: S.Boolean,

  // Ambient occlusion settings
  aoSamples: S.optional(S.Number.pipe(S.int(), S.positive)),
  aoRadius: S.optional(S.Number.pipe(S.positive)),
  aoIntensity: S.optional(S.Number.pipe(S.between(0, 1))),

  // Shadow settings
  shadowResolution: S.optional(S.Number.pipe(S.int(), S.positive)),
  shadowDistance: S.optional(S.Number.pipe(S.positive)),
}).pipe(S.identifier('LightingSettings'))
export type LightingSettings = S.Schema.Type<typeof LightingSettings>

// ============================================
// Request/Response Messages
// ============================================

/**
 * Neighbor chunk data for seamless meshing
 */
export const NeighborChunkData = S.Struct({
  north: S.optional(ChunkData),
  south: S.optional(ChunkData),
  east: S.optional(ChunkData),
  west: S.optional(ChunkData),
  northeast: S.optional(ChunkData),
  northwest: S.optional(ChunkData),
  southeast: S.optional(ChunkData),
  southwest: S.optional(ChunkData),
  up: S.optional(ChunkData),
  down: S.optional(ChunkData),
}).pipe(S.identifier('NeighborChunkData'))
export type NeighborChunkData = S.Schema.Type<typeof NeighborChunkData>

/**
 * Mesh generation request
 */
export const MeshGenerationRequest = S.Struct({
  // Primary chunk data
  chunkData: ChunkData,

  // Neighboring chunks for seamless generation
  neighbors: S.optional(NeighborChunkData),

  // Generation settings
  algorithm: MeshingAlgorithm,
  lodLevel: S.Number.pipe(S.int(), S.between(0, 4)),

  // Optimization settings
  optimizations: OptimizationSettings,

  // Lighting settings
  lighting: S.optional(LightingSettings),

  // Material settings
  materialMapping: S.optional(
    S.Record({
      key: S.String, // Block type
      value: S.String, // Material ID
    }),
  ),

  // Generation options
  options: S.optional(
    S.Struct({
      generateNormals: S.Boolean,
      generateTangents: S.Boolean,
      generateUVs: S.Boolean,
      generateColors: S.Boolean,
      generateLightmap: S.Boolean,

      // Vertex attributes to include
      vertexAttributes: S.optional(S.Array(S.String)),

      // Output format preferences
      preferInterleavedVertices: S.optional(S.Boolean),
      indexFormat: S.optional(S.Union(S.Literal('uint16'), S.Literal('uint32'))),

      // Debug options
      generateWireframe: S.optional(S.Boolean),
      includeDebugInfo: S.optional(S.Boolean),
    }),
  ),
}).pipe(S.identifier('MeshGenerationRequest'))
export type MeshGenerationRequest = S.Schema.Type<typeof MeshGenerationRequest>

/**
 * Generated mesh data with all information
 */
export const GeneratedMeshData = S.Struct({
  // Core mesh data
  vertexBuffer: VertexBuffer,
  indexBuffer: S.optional(IndexBuffer),

  // Materials used
  materials: S.Array(MeshMaterial),

  // Submeshes (for multi-material meshes)
  submeshes: S.optional(
    S.Array(
      S.Struct({
        materialId: S.String,
        indexStart: S.Number.pipe(S.int(), S.nonNegative),
        indexCount: S.Number.pipe(S.int(), S.nonNegative),
        primitiveType: S.optional(S.Union(S.Literal('triangles'), S.Literal('lines'), S.Literal('points'))),
      }),
    ),
  ),

  // Bounding information
  bounds: BoundingVolume,

  // LOD data
  lodLevels: S.optional(
    S.Array(
      S.Struct({
        level: LodLevel,
        vertexBuffer: VertexBuffer,
        indexBuffer: S.optional(IndexBuffer),
        bounds: BoundingVolume,
      }),
    ),
  ),

  // Lighting data
  lightmap: S.optional(S.Unknown), // Texture data
  lightmapUVs: S.optional(S.Unknown), // Float32Array

  // Wireframe (for debugging)
  wireframe: S.optional(
    S.Struct({
      indexBuffer: IndexBuffer,
    }),
  ),
}).pipe(S.identifier('GeneratedMeshData'))
export type GeneratedMeshData = S.Schema.Type<typeof GeneratedMeshData>

/**
 * Mesh generation performance metrics
 */
export const MeshPerformanceMetrics = S.Struct({
  // Timing
  totalTime: S.Number.pipe(S.positive),
  meshingTime: S.Number.pipe(S.positive),
  optimizationTime: S.Number.pipe(S.positive),
  lightingTime: S.optional(S.Number.pipe(S.positive)),

  // Processing statistics
  inputBlocks: S.Number.pipe(S.int(), S.nonNegative),
  outputVertices: S.Number.pipe(S.int(), S.nonNegative),
  outputTriangles: S.Number.pipe(S.int(), S.nonNegative),

  // Optimization results
  facesCulled: S.Number.pipe(S.int(), S.nonNegative),
  verticesWelded: S.Number.pipe(S.int(), S.nonNegative),

  // Memory usage
  peakMemoryUsage: S.optional(S.Number.pipe(S.positive)),
  outputMemoryUsage: S.Number.pipe(S.positive),

  // Compression ratios
  vertexCompressionRatio: S.optional(S.Number.pipe(S.positive)),
  indexCompressionRatio: S.optional(S.Number.pipe(S.positive)),

  // Quality metrics
  meshQuality: S.optional(S.Number.pipe(S.between(0, 1))),
  lodReductionRatio: S.optional(S.Array(S.Number.pipe(S.between(0, 1)))),
}).pipe(S.identifier('MeshPerformanceMetrics'))
export type MeshPerformanceMetrics = S.Schema.Type<typeof MeshPerformanceMetrics>

/**
 * Mesh generation response
 */
export const MeshGenerationResponse = S.Struct({
  // Generated mesh data
  meshData: GeneratedMeshData,

  // Performance metrics
  metrics: MeshPerformanceMetrics,

  // Generation metadata
  chunkCoordinates: ChunkCoordinatesSchema,
  algorithm: MeshingAlgorithm,
  lodLevel: S.Number.pipe(S.int(), S.between(0, 4)),

  // Status information
  success: S.Boolean,
  warnings: S.optional(S.Array(S.String)),
  errors: S.optional(S.Array(S.String)),

  // Worker information
  workerId: S.String,
  generationTime: S.Number.pipe(S.positive),

  // Debug information
  debugData: S.optional(
    S.Struct({
      processingSteps: S.optional(S.Array(S.String)),
      intermediateResults: S.optional(S.Unknown),
      performanceBreakdown: S.optional(
        S.Record({
          key: S.String,
          value: S.Number.pipe(S.positive),
        }),
      ),
    }),
  ),
}).pipe(S.identifier('MeshGenerationResponse'))
export type MeshGenerationResponse = S.Schema.Type<typeof MeshGenerationResponse>

// ============================================
// Batch Processing
// ============================================

/**
 * Batch mesh generation request
 */
export const BatchMeshGenerationRequest = S.Struct({
  requests: S.Array(MeshGenerationRequest),

  // Batch options
  options: S.optional(
    S.Struct({
      maxConcurrent: S.Number.pipe(S.int(), S.positive),
      priority: S.Number.pipe(S.int(), S.between(0, 10)),
      timeout: S.Number.pipe(S.positive),
    }),
  ),

  // Shared settings that apply to all requests
  sharedOptimizations: S.optional(OptimizationSettings),
  sharedLighting: S.optional(LightingSettings),
}).pipe(S.identifier('BatchMeshGenerationRequest'))
export type BatchMeshGenerationRequest = S.Schema.Type<typeof BatchMeshGenerationRequest>

/**
 * Batch mesh generation response
 */
export const BatchMeshGenerationResponse = S.Struct({
  responses: S.Array(MeshGenerationResponse),

  // Batch metrics
  batchMetrics: S.Struct({
    totalTime: S.Number.pipe(S.positive),
    successCount: S.Number.pipe(S.int(), S.nonNegative),
    failureCount: S.Number.pipe(S.int(), S.nonNegative),
    averageProcessingTime: S.Number.pipe(S.positive),
  }),

  // Failed requests
  failures: S.optional(
    S.Array(
      S.Struct({
        requestIndex: S.Number.pipe(S.int(), S.nonNegative),
        error: S.String,
        coordinates: ChunkCoordinatesSchema,
      }),
    ),
  ),
}).pipe(S.identifier('BatchMeshGenerationResponse'))
export type BatchMeshGenerationResponse = S.Schema.Type<typeof BatchMeshGenerationResponse>

// ============================================
// Utility Functions
// ============================================

/**
 * Create default optimization settings
 */
export const createDefaultOptimizations = (): OptimizationSettings => ({
  enableFaceCulling: true,
  enableBackfaceCulling: true,
  enableOcclusionCulling: false,
  enableGreedyMeshing: true,
  enableVertexWelding: true,
  weldingThreshold: 0.001,
  normalSmoothingAngle: 30,
  enableLod: false,
})

/**
 * Create default lighting settings
 */
export const createDefaultLighting = (): LightingSettings => ({
  enableLighting: true,
  enableShadows: false,
  enableAmbientOcclusion: false,
  aoSamples: 16,
  aoRadius: 1.0,
  aoIntensity: 0.5,
})

/**
 * Create transferable vertex buffer data
 */
export const createTransferableVertexData = (positions: number[], normals?: number[], uvs?: number[], colors?: number[]): VertexAttribute[] => {
  const attributes: VertexAttribute[] = []

  attributes.push({
    name: 'position',
    size: 3,
    type: 'float',
    data: new Float32Array(positions),
  })

  if (normals) {
    attributes.push({
      name: 'normal',
      size: 3,
      type: 'float',
      data: new Float32Array(normals),
    })
  }

  if (uvs) {
    attributes.push({
      name: 'uv',
      size: 2,
      type: 'float',
      data: new Float32Array(uvs),
    })
  }

  if (colors) {
    attributes.push({
      name: 'color',
      size: 4,
      type: 'float',
      data: new Float32Array(colors),
    })
  }

  return attributes
}

/**
 * Create transferable index buffer
 */
export const createTransferableIndexBuffer = (indices: number[]): IndexBuffer => {
  const maxIndex = Math.max(...indices)
  const useUint32 = maxIndex > 65535

  return {
    data: useUint32 ? new Uint32Array(indices) : new Uint16Array(indices),
    count: indices.length,
    format: useUint32 ? 'uint32' : 'uint16',
  }
}

/**
 * Extract transferable objects from mesh data
 */
export const extractMeshTransferables = (meshData: GeneratedMeshData): ArrayBufferView[] => {
  const transferables: ArrayBufferView[] = []

  // Extract vertex attribute data
  for (const attr of meshData.vertexBuffer.attributes) {
    if (attr.data instanceof ArrayBufferView) {
      transferables.push(attr.data)
    }
  }

  // Extract index buffer data
  if (meshData.indexBuffer && meshData.indexBuffer.data instanceof ArrayBufferView) {
    transferables.push(meshData.indexBuffer.data)
  }

  // Extract LOD data
  if (meshData.lodLevels) {
    for (const lod of meshData.lodLevels) {
      for (const attr of lod.vertexBuffer.attributes) {
        if (attr.data instanceof ArrayBufferView) {
          transferables.push(attr.data)
        }
      }
      if (lod.indexBuffer && lod.indexBuffer.data instanceof ArrayBufferView) {
        transferables.push(lod.indexBuffer.data)
      }
    }
  }

  // Extract lightmap UVs
  if (meshData.lightmapUVs instanceof ArrayBufferView) {
    transferables.push(meshData.lightmapUVs)
  }

  // Extract wireframe indices
  if (meshData.wireframe && meshData.wireframe.indexBuffer.data instanceof ArrayBufferView) {
    transferables.push(meshData.wireframe.indexBuffer.data)
  }

  return transferables
}

/**
 * Validate mesh generation request
 */
export const validateMeshRequest = (request: unknown) => S.decodeUnknown(MeshGenerationRequest)(request)

/**
 * Validate mesh generation response
 */
export const validateMeshResponse = (response: unknown) => S.decodeUnknown(MeshGenerationResponse)(response)

/**
 * Calculate mesh bounds from vertex data
 */
export const calculateMeshBounds = (positions: Float32Array): BoundingVolume => {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity
  let maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity

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

  const centerX = (minX + maxX) * 0.5
  const centerY = (minY + maxY) * 0.5
  const centerZ = (minZ + maxZ) * 0.5

  const extentX = (maxX - minX) * 0.5
  const extentY = (maxY - minY) * 0.5
  const extentZ = (maxZ - minZ) * 0.5

  const radius = Math.sqrt(extentX * extentX + extentY * extentY + extentZ * extentZ)

  return {
    aabb: {
      min: { x: minX, y: minY, z: minZ },
      max: { x: maxX, y: maxY, z: maxZ },
    },
    sphere: {
      center: { x: centerX, y: centerY, z: centerZ },
      radius,
    },
  }
}
