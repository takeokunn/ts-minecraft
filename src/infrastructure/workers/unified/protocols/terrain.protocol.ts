import * as S from 'effect/Schema'
import { ChunkCoordinatesSchema } from '@/domain/value-objects/coordinates'

/**
 * Terrain Generation Protocol
 * Type-safe message schemas using Effect Schema for worker communication
 */

// ============================================
// Base Types
// ============================================

/**
 * 3D Position schema with validation
 */
export const Position3D = S.Struct({
  x: S.Number.pipe(S.finite),
  y: S.Number.pipe(S.finite),
  z: S.Number.pipe(S.finite),
}).pipe(S.identifier('Position3D'))
export type Position3D = S.Schema.Type<typeof Position3D>

/**
 * Block type enumeration
 */
export const BlockType = S.Union(
  S.Literal('air'),
  S.Literal('stone'),
  S.Literal('dirt'),
  S.Literal('grass'),
  S.Literal('sand'),
  S.Literal('gravel'),
  S.Literal('wood'),
  S.Literal('leaves'),
  S.Literal('water'),
  S.Literal('lava'),
  S.Literal('bedrock'),
  S.Literal('coal_ore'),
  S.Literal('iron_ore'),
  S.Literal('gold_ore'),
  S.Literal('diamond_ore'),
).pipe(S.identifier('BlockType'))
export type BlockType = S.Schema.Type<typeof BlockType>

/**
 * Block data with metadata
 */
export const Block = S.Struct({
  position: Position3D,
  blockType: BlockType,
  metadata: S.optional(
    S.Record({
      key: S.String,
      value: S.Union(S.String, S.Number, S.Boolean),
    }),
  ),
  lightLevel: S.optional(S.Number.pipe(S.between(0, 15))),
  customData: S.optional(S.Unknown),
}).pipe(S.identifier('Block'))
export type Block = S.Schema.Type<typeof Block>

/**
 * Biome configuration
 */
export const BiomeType = S.Union(
  S.Literal('plains'),
  S.Literal('desert'),
  S.Literal('forest'),
  S.Literal('mountains'),
  S.Literal('ocean'),
  S.Literal('swamp'),
  S.Literal('tundra'),
  S.Literal('jungle'),
).pipe(S.identifier('BiomeType'))
export type BiomeType = S.Schema.Type<typeof BiomeType>

export const BiomeSettings = S.Struct({
  type: BiomeType,
  temperature: S.Number.pipe(S.between(-1, 1)),
  humidity: S.Number.pipe(S.between(0, 1)),
  elevation: S.Number.pipe(S.between(0, 1)),
  rainfall: S.Number.pipe(S.between(0, 1)),
  vegetation: S.Number.pipe(S.between(0, 1)),
}).pipe(S.identifier('BiomeSettings'))
export type BiomeSettings = S.Schema.Type<typeof BiomeSettings>

/**
 * Noise generation settings
 */
export const NoiseSettings = S.Struct({
  seed: S.Number.pipe(S.int()),
  octaves: S.Number.pipe(S.int(), S.between(1, 8)),
  persistence: S.Number.pipe(S.between(0, 1)),
  lacunarity: S.Number.pipe(S.between(1, 4)),
  scale: S.Number.pipe(S.positive),
  heightMultiplier: S.Number.pipe(S.positive),
  baseHeight: S.Number.pipe(S.finite),
}).pipe(S.identifier('NoiseSettings'))
export type NoiseSettings = S.Schema.Type<typeof NoiseSettings>

/**
 * Terrain features configuration
 */
export const TerrainFeatures = S.Struct({
  generateCaves: S.Boolean,
  generateOres: S.Boolean,
  generateVegetation: S.Boolean,
  generateWaterBodies: S.Boolean,
  generateStructures: S.Boolean,
  caveFrequency: S.optional(S.Number.pipe(S.between(0, 1))),
  oreDistribution: S.optional(
    S.Record({
      key: BlockType,
      value: S.Struct({
        frequency: S.Number.pipe(S.between(0, 1)),
        minHeight: S.Number.pipe(S.int()),
        maxHeight: S.Number.pipe(S.int()),
        veinSize: S.Number.pipe(S.int(), S.positive),
      }),
    }),
  ),
}).pipe(S.identifier('TerrainFeatures'))
export type TerrainFeatures = S.Schema.Type<typeof TerrainFeatures>

// ============================================
// Request/Response Messages
// ============================================

/**
 * Terrain generation request
 */
export const TerrainGenerationRequest = S.Struct({
  // Chunk identification
  coordinates: ChunkCoordinatesSchema,

  // Generation settings
  seed: S.Number.pipe(S.int()),
  biome: BiomeSettings,
  noise: NoiseSettings,
  features: TerrainFeatures,

  // Neighboring chunk data for seamless generation
  neighborData: S.optional(
    S.Record({
      key: S.Union(
        S.Literal('north'),
        S.Literal('south'),
        S.Literal('east'),
        S.Literal('west'),
        S.Literal('northeast'),
        S.Literal('northwest'),
        S.Literal('southeast'),
        S.Literal('southwest'),
      ),
      value: S.Struct({
        heightMap: S.Array(S.Number.pipe(S.finite)),
        biomeData: S.Array(BiomeType),
        edgeBlocks: S.Array(Block),
      }),
    }),
  ),

  // Player modifications
  editedBlocks: S.optional(
    S.Struct({
      destroyed: S.Array(S.String), // Position keys as "x,y,z"
      placed: S.Array(Block),
      modified: S.Array(
        S.Struct({
          position: Position3D,
          originalType: BlockType,
          newType: BlockType,
          timestamp: S.Number.pipe(S.positive),
        }),
      ),
    }),
  ),

  // Generation options
  options: S.optional(
    S.Struct({
      generateMeshData: S.Boolean,
      lodLevel: S.Number.pipe(S.int(), S.between(0, 4)),
      enableOptimizations: S.Boolean,
      useMultithreading: S.Boolean,
      debugMode: S.Boolean,
    }),
  ),
}).pipe(S.identifier('TerrainGenerationRequest'))
export type TerrainGenerationRequest = S.Schema.Type<typeof TerrainGenerationRequest>

/**
 * Generated chunk data
 */
export const ChunkData = S.Struct({
  coordinates: ChunkCoordinatesSchema,
  blocks: S.Array(Block),

  // Height and biome maps
  heightMap: S.Array(S.Number.pipe(S.finite)),
  biomeMap: S.Array(BiomeType),

  // Lighting data
  lightMap: S.optional(S.Array(S.Number.pipe(S.between(0, 15)))),
  skyLightMap: S.optional(S.Array(S.Number.pipe(S.between(0, 15)))),

  // Generation metadata
  generationTime: S.Number.pipe(S.positive),
  blockCount: S.Number.pipe(S.int(), S.nonNegative),
  timestamp: S.Number.pipe(S.positive),

  // Feature data
  generatedFeatures: S.optional(
    S.Array(
      S.Struct({
        type: S.Union(S.Literal('cave'), S.Literal('ore_vein'), S.Literal('tree'), S.Literal('structure'), S.Literal('water_body')),
        position: Position3D,
        size: S.Number.pipe(S.positive),
        data: S.optional(S.Unknown),
      }),
    ),
  ),

  // Boundaries for seamless generation
  edgeBoundaries: S.Struct({
    north: S.Array(Block),
    south: S.Array(Block),
    east: S.Array(Block),
    west: S.Array(Block),
  }),
}).pipe(S.identifier('ChunkData'))
export type ChunkData = S.Schema.Type<typeof ChunkData>

/**
 * Mesh data for rendering (transferable arrays)
 */
export const MeshData = S.Struct({
  // Vertex data (Float32Arrays - transferable)
  positions: S.Unknown, // Float32Array
  normals: S.Unknown, // Float32Array
  uvs: S.Unknown, // Float32Array
  colors: S.optional(S.Unknown), // Float32Array

  // Index data (Uint32Array - transferable)
  indices: S.Unknown, // Uint32Array

  // Mesh statistics
  vertexCount: S.Number.pipe(S.int(), S.nonNegative),
  triangleCount: S.Number.pipe(S.int(), S.nonNegative),

  // Bounding information
  boundingBox: S.Struct({
    min: Position3D,
    max: Position3D,
  }),

  // LOD data
  lodLevel: S.Number.pipe(S.int(), S.between(0, 4)),

  // Optimization metadata
  optimizations: S.optional(
    S.Struct({
      facesCulled: S.Number.pipe(S.int(), S.nonNegative),
      verticesReduced: S.Number.pipe(S.int(), S.nonNegative),
      meshingTechnique: S.Union(S.Literal('naive'), S.Literal('greedy'), S.Literal('marching_cubes'), S.Literal('dual_contouring')),
    }),
  ),
}).pipe(S.identifier('MeshData'))
export type MeshData = S.Schema.Type<typeof MeshData>

/**
 * Performance metrics
 */
export const PerformanceMetrics = S.Struct({
  // Generation timing
  totalTime: S.Number.pipe(S.positive),
  terrainGenerationTime: S.Number.pipe(S.positive),
  meshGenerationTime: S.optional(S.Number.pipe(S.positive)),
  optimizationTime: S.optional(S.Number.pipe(S.positive)),

  // Processing stats
  blocksGenerated: S.Number.pipe(S.int(), S.nonNegative),
  featuresGenerated: S.Number.pipe(S.int(), S.nonNegative),

  // Memory usage
  memoryUsed: S.optional(S.Number.pipe(S.positive)),
  peakMemoryUsage: S.optional(S.Number.pipe(S.positive)),

  // Quality metrics
  lodReductionRatio: S.optional(S.Number.pipe(S.between(0, 1))),
  compressionRatio: S.optional(S.Number.pipe(S.positive)),
}).pipe(S.identifier('PerformanceMetrics'))
export type PerformanceMetrics = S.Schema.Type<typeof PerformanceMetrics>

/**
 * Terrain generation response
 */
export const TerrainGenerationResponse = S.Struct({
  // Generated data
  chunkData: ChunkData,
  meshData: S.optional(MeshData),

  // Performance information
  metrics: PerformanceMetrics,

  // Status and metadata
  success: S.Boolean,
  warnings: S.optional(S.Array(S.String)),
  errors: S.optional(S.Array(S.String)),

  // Worker information
  workerId: S.String,
  workerCapabilities: S.optional(
    S.Struct({
      supportsSharedArrayBuffer: S.Boolean,
      supportsTransferableObjects: S.Boolean,
      supportsWasm: S.Boolean,
      maxMemory: S.Number.pipe(S.positive),
      threadCount: S.Number.pipe(S.int(), S.positive),
    }),
  ),
}).pipe(S.identifier('TerrainGenerationResponse'))
export type TerrainGenerationResponse = S.Schema.Type<typeof TerrainGenerationResponse>

// ============================================
// Utility Functions
// ============================================

/**
 * Create transferable mesh data
 */
export const createTransferableMeshData = (meshData: { positions: number[]; normals: number[]; uvs: number[]; indices: number[]; colors?: number[] }): MeshData => ({
  positions: new Float32Array(meshData.positions),
  normals: new Float32Array(meshData.normals),
  uvs: new Float32Array(meshData.uvs),
  colors: meshData.colors ? new Float32Array(meshData.colors) : undefined,
  indices: new Uint32Array(meshData.indices),
  vertexCount: meshData.positions.length / 3,
  triangleCount: meshData.indices.length / 3,
  boundingBox: {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 16, y: 256, z: 16 },
  },
  lodLevel: 0,
})

/**
 * Extract transferable objects from mesh data
 */
export const extractMeshTransferables = (meshData: MeshData): ArrayBufferView[] => {
  const transferables: ArrayBufferView[] = []

  if (meshData.positions instanceof Float32Array) transferables.push(meshData.positions)
  if (meshData.normals instanceof Float32Array) transferables.push(meshData.normals)
  if (meshData.uvs instanceof Float32Array) transferables.push(meshData.uvs)
  if (meshData.colors instanceof Float32Array) transferables.push(meshData.colors)
  if (meshData.indices instanceof Uint32Array) transferables.push(meshData.indices)

  return transferables
}

/**
 * Validate terrain generation request
 */
export const validateTerrainRequest = (request: unknown) => S.decodeUnknown(TerrainGenerationRequest)(request)

/**
 * Validate terrain generation response
 */
export const validateTerrainResponse = (response: unknown) => S.decodeUnknown(TerrainGenerationResponse)(response)

/**
 * Create default biome settings
 */
export const createDefaultBiome = (type: BiomeType): BiomeSettings => {
  const defaults: Record<BiomeType, Omit<BiomeSettings, 'type'>> = {
    plains: { temperature: 0.5, humidity: 0.5, elevation: 0.3, rainfall: 0.6, vegetation: 0.7 },
    desert: { temperature: 0.9, humidity: 0.1, elevation: 0.2, rainfall: 0.1, vegetation: 0.1 },
    forest: { temperature: 0.4, humidity: 0.8, elevation: 0.4, rainfall: 0.8, vegetation: 0.9 },
    mountains: { temperature: 0.1, humidity: 0.3, elevation: 0.9, rainfall: 0.4, vegetation: 0.3 },
    ocean: { temperature: 0.6, humidity: 1.0, elevation: 0.1, rainfall: 0.9, vegetation: 0.2 },
    swamp: { temperature: 0.7, humidity: 0.9, elevation: 0.2, rainfall: 0.9, vegetation: 0.8 },
    tundra: { temperature: -0.5, humidity: 0.2, elevation: 0.3, rainfall: 0.2, vegetation: 0.2 },
    jungle: { temperature: 0.8, humidity: 0.9, elevation: 0.5, rainfall: 1.0, vegetation: 1.0 },
  }

  return { type, ...defaults[type] }
}

/**
 * Create default noise settings
 */
export const createDefaultNoiseSettings = (seed: number): NoiseSettings => ({
  seed,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2.0,
  scale: 0.01,
  heightMultiplier: 64,
  baseHeight: 64,
})

/**
 * Create default terrain features
 */
export const createDefaultTerrainFeatures = (): TerrainFeatures => ({
  generateCaves: true,
  generateOres: true,
  generateVegetation: true,
  generateWaterBodies: true,
  generateStructures: false,
  caveFrequency: 0.1,
  oreDistribution: {
    coal_ore: { frequency: 0.8, minHeight: 5, maxHeight: 128, veinSize: 8 },
    iron_ore: { frequency: 0.6, minHeight: 5, maxHeight: 64, veinSize: 6 },
    gold_ore: { frequency: 0.3, minHeight: 5, maxHeight: 32, veinSize: 4 },
    diamond_ore: { frequency: 0.1, minHeight: 5, maxHeight: 16, veinSize: 2 },
  },
})
