import { Effect, Context, Layer, Schema, Ref, Option, Match, pipe, Predicate } from 'effect'
import * as THREE from 'three'
import { GreedyMeshingService, GreedyMeshingLive } from './GreedyMeshing'
import { FaceCullingService, FaceCullingLive } from './FaceCulling'
import { AmbientOcclusionService, AmbientOcclusionLive } from './AmbientOcclusion'

// ========================================
// Schema Definitions
// ========================================

export const ChunkPositionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

export const BlockTypeSchema = Schema.Number.pipe(Schema.int(), Schema.between(0, 255))

export const ChunkDataSchema = Schema.Struct({
  position: ChunkPositionSchema,
  blocks: Schema.Array(Schema.Array(Schema.Array(BlockTypeSchema))),
  size: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

export const MeshDataSchema = Schema.Struct({
  vertices: Schema.Array(Schema.Number),
  normals: Schema.Array(Schema.Number),
  uvs: Schema.Array(Schema.Number),
  indices: Schema.Array(Schema.Number),
  colors: Schema.optional(Schema.Array(Schema.Number)),
}).pipe(
  Schema.transform(
    Schema.Struct({
      vertices: Schema.Array(Schema.Number),
      normals: Schema.Array(Schema.Number),
      uvs: Schema.Array(Schema.Number),
      indices: Schema.Array(Schema.Number),
      colors: Schema.optional(Schema.Array(Schema.Number)),
    }),
    {
      strict: true,
      decode: (input) => ({
        vertices: [...input.vertices],
        normals: [...input.normals],
        uvs: [...input.uvs],
        indices: [...input.indices],
        colors: input.colors ? [...input.colors] : undefined,
      }),
      encode: (input) => ({
        vertices: [...input.vertices],
        normals: [...input.normals],
        uvs: [...input.uvs],
        indices: [...input.indices],
        colors: input.colors ? [...input.colors] : undefined,
      }),
    }
  )
)

export const MeshConfigSchema = Schema.Struct({
  enableGreedyMeshing: Schema.Boolean,
  enableFaceCulling: Schema.Boolean,
  enableAO: Schema.Boolean,
  chunkSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  maxCacheSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

// Type exports
export type ChunkPosition = Schema.Schema.Type<typeof ChunkPositionSchema>
export type BlockType = Schema.Schema.Type<typeof BlockTypeSchema>
export type ChunkData = Schema.Schema.Type<typeof ChunkDataSchema>
export type MeshData = Schema.Schema.Type<typeof MeshDataSchema>
export type MeshConfig = Schema.Schema.Type<typeof MeshConfigSchema>

// ========================================
// Error Definitions (following project pattern)
// ========================================

export interface MeshGenerationError {
  readonly _tag: 'MeshGenerationError'
  readonly reason: string
  readonly chunkPosition: { x: number; z: number }
  readonly timestamp: number
  readonly context?: string
}

export const MeshGenerationError = (
  reason: string,
  chunkPosition: { x: number; z: number },
  timestamp: number,
  context?: string
): MeshGenerationError => ({
  _tag: 'MeshGenerationError',
  reason,
  chunkPosition,
  timestamp,
  ...(context !== undefined && { context }),
})

export const isMeshGenerationError = (error: unknown): error is MeshGenerationError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'MeshGenerationError'

export interface InvalidChunkError {
  readonly _tag: 'InvalidChunkError'
  readonly reason: string
  readonly chunkData: unknown
  readonly timestamp: number
}

export const InvalidChunkError = (reason: string, chunkData: unknown, timestamp: number): InvalidChunkError => ({
  _tag: 'InvalidChunkError',
  reason,
  chunkData,
  timestamp,
})

export const isInvalidChunkError = (error: unknown): error is InvalidChunkError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'InvalidChunkError'

// ========================================
// Service Interface
// ========================================

export interface MeshGeneratorService {
  readonly generateMesh: (chunkData: ChunkData) => Effect.Effect<MeshData, MeshGenerationError, never>
  readonly generateOptimizedMesh: (chunkData: ChunkData) => Effect.Effect<MeshData, MeshGenerationError, never>
  readonly clearCache: () => Effect.Effect<void, never, never>
  readonly getCacheStats: () => Effect.Effect<{ size: number; hits: number; misses: number }, never, never>
}

export const MeshGeneratorService = Context.GenericTag<MeshGeneratorService>('@minecraft/MeshGeneratorService')

// ========================================
// Cache State
// ========================================

interface CacheEntry {
  readonly meshData: MeshData
  readonly timestamp: number
}

interface MeshGeneratorState {
  readonly cache: Map<string, CacheEntry>
  readonly stats: { hits: number; misses: number }
  readonly config: MeshConfig
}

// ========================================
// Helper Functions (Pure Functions)
// ========================================

const createCacheKey = (position: ChunkPosition): string => `${position.x}_${position.y}_${position.z}`

const isValidBlock = (blockType: number): boolean =>
  pipe(
    blockType,
    Predicate.and(
      (b: number) => b > 0,
      (b: number) => b <= 255
    )
  )

const generateBasicCube = (
  x: number,
  y: number,
  z: number
): {
  vertices: number[]
  normals: number[]
  uvs: number[]
  indices: number[]
} => {
  const baseIndex = 0

  // 8 vertices of the cube
  const vertices = [
    // Front face
    x,
    y,
    z + 1,
    x + 1,
    y,
    z + 1,
    x + 1,
    y + 1,
    z + 1,
    x,
    y + 1,
    z + 1,
    // Back face
    x,
    y,
    z,
    x,
    y + 1,
    z,
    x + 1,
    y + 1,
    z,
    x + 1,
    y,
    z,
    // Top face
    x,
    y + 1,
    z + 1,
    x + 1,
    y + 1,
    z + 1,
    x + 1,
    y + 1,
    z,
    x,
    y + 1,
    z,
    // Bottom face
    x,
    y,
    z,
    x + 1,
    y,
    z,
    x + 1,
    y,
    z + 1,
    x,
    y,
    z + 1,
    // Right face
    x + 1,
    y,
    z + 1,
    x + 1,
    y,
    z,
    x + 1,
    y + 1,
    z,
    x + 1,
    y + 1,
    z + 1,
    // Left face
    x,
    y,
    z,
    x,
    y,
    z + 1,
    x,
    y + 1,
    z + 1,
    x,
    y + 1,
    z,
  ]

  // Normals for each face
  const normals = [
    // Front
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
    // Back
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    // Top
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    // Bottom
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    // Right
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    // Left
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]

  // UV coordinates for texture mapping
  const uvs = [
    // Front
    0, 0, 1, 0, 1, 1, 0, 1,
    // Back
    1, 0, 1, 1, 0, 1, 0, 0,
    // Top
    0, 1, 1, 1, 1, 0, 0, 0,
    // Bottom
    1, 1, 0, 1, 0, 0, 1, 0,
    // Right
    1, 0, 0, 0, 0, 1, 1, 1,
    // Left
    0, 0, 1, 0, 1, 1, 0, 1,
  ]

  // Indices for triangles
  const indices = []
  for (let i = 0; i < 6; i++) {
    const offset = i * 4
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3)
  }

  return { vertices, normals, uvs, indices }
}

// ========================================
// Basic Mesh Generation (No Optimization)
// ========================================

const generateBasicMesh = (chunkData: ChunkData): Effect.Effect<MeshData, MeshGenerationError> =>
  pipe(
    // Validate input
    Effect.try({
      try: () => Schema.decodeUnknownSync(ChunkDataSchema)(chunkData),
      catch: (error) =>
        MeshGenerationError(`Invalid chunk data: ${String(error)}`, chunkData.position || { x: 0, z: 0 }, Date.now()),
    }),
    Effect.map((validatedChunk) => {
      const meshData = {
        vertices: [] as number[],
        normals: [] as number[],
        uvs: [] as number[],
        indices: [] as number[],
      }

      let vertexOffset = 0

      // Generate mesh for each block
      for (let x = 0; x < validatedChunk.size; x++) {
        for (let y = 0; y < validatedChunk.size; y++) {
          for (let z = 0; z < validatedChunk.size; z++) {
            const blockType = pipe(
              Option.fromNullable(validatedChunk.blocks[x]?.[y]?.[z]),
              Option.getOrElse(() => 0)
            )

            if (blockType === 0) continue // Skip air blocks

            // Add 6 faces per block (basic cube)
            const cubeData = generateBasicCube(x, y, z)

            // Add vertices with offset
            cubeData.vertices.forEach((v) => meshData.vertices.push(v))
            cubeData.normals.forEach((n) => meshData.normals.push(n))
            cubeData.uvs.forEach((uv) => meshData.uvs.push(uv))
            cubeData.indices.forEach((i) => meshData.indices.push(i + vertexOffset))

            vertexOffset += cubeData.vertices.length / 3 // Number of vertices added
          }
        }
      }

      return {
        vertices: meshData.vertices as readonly number[],
        normals: meshData.normals as readonly number[],
        uvs: meshData.uvs as readonly number[],
        indices: meshData.indices as readonly number[],
      } satisfies MeshData
    })
  )

// ========================================
// Service Implementation
// ========================================

const makeService = (
  config: MeshConfig,
  greedyMeshing: GreedyMeshingService,
  faceCulling: FaceCullingService,
  ambientOcclusion: AmbientOcclusionService
): Effect.Effect<MeshGeneratorService, never, never> =>
  pipe(
    Ref.make<MeshGeneratorState>({
      cache: new Map(),
      stats: { hits: 0, misses: 0 },
      config,
    }),
    Effect.map((stateRef) => ({
      generateMesh: (chunkData: ChunkData) =>
        pipe(
          generateBasicMesh(chunkData),
          Effect.map((meshData) => ({
            vertices: [...meshData.vertices],
            normals: [...meshData.normals],
            uvs: [...meshData.uvs],
            indices: [...meshData.indices],
            colors: meshData.colors ? [...meshData.colors] : undefined,
          }))
        ),

      generateOptimizedMesh: (chunkData: ChunkData) =>
        config.enableGreedyMeshing
          ? pipe(
              greedyMeshing.generateGreedyMesh(chunkData),
              Effect.mapError((greedyError) =>
                MeshGenerationError(
                  `Greedy meshing failed: ${greedyError.reason}`,
                  chunkData.position,
                  Date.now(),
                  greedyError.context
                )
              )
            )
          : pipe(
              generateBasicMesh(chunkData),
              Effect.map((meshData) => ({
                vertices: [...meshData.vertices],
                normals: [...meshData.normals],
                uvs: [...meshData.uvs],
                indices: [...meshData.indices],
                colors: meshData.colors ? [...meshData.colors] : undefined,
              }))
            ),

      clearCache: () =>
        pipe(
          Ref.update(stateRef, (state) => ({
            ...state,
            cache: new Map(),
            stats: { hits: 0, misses: 0 },
          })),
          Effect.asVoid
        ),

      getCacheStats: () =>
        pipe(
          Ref.get(stateRef),
          Effect.map((state) => ({
            size: state.cache.size,
            hits: state.stats.hits,
            misses: state.stats.misses,
          }))
        ),
    }))
  )

// ========================================
// Layer Construction
// ========================================

export const MeshGeneratorLive = Layer.effect(
  MeshGeneratorService,
  pipe(
    Effect.all([GreedyMeshingService, FaceCullingService, AmbientOcclusionService]),
    Effect.flatMap(([greedyMeshing, faceCulling, ambientOcclusion]) => {
      const defaultConfig: MeshConfig = {
        enableGreedyMeshing: true,
        enableFaceCulling: true,
        enableAO: true,
        chunkSize: 16,
        maxCacheSize: 100,
      }
      return makeService(defaultConfig, greedyMeshing, faceCulling, ambientOcclusion)
    })
  )
).pipe(Layer.provide(Layer.mergeAll(GreedyMeshingLive, FaceCullingLive, AmbientOcclusionLive)))

// ========================================
// THREE.js Integration Helper
// ========================================

export const createBufferGeometry = (meshData: MeshData): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry()

  // Convert readonly arrays to mutable arrays for THREE.js compatibility
  const vertices = [...meshData.vertices]
  const normals = [...meshData.normals]
  const uvs = [...meshData.uvs]
  const indices = [...meshData.indices]

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))

  // Effect-TSパターン: Option.fromNullableとOption.matchを使用してnullableチェックを実行
  pipe(
    Option.fromNullable(meshData.colors),
    Option.match({
      onNone: () => {
        // colors が null/undefined の場合は何もしない
      },
      onSome: (colors) => {
        const colorArray = [...colors]
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colorArray, 3))
      },
    })
  )

  geometry.setIndex(indices)
  geometry.computeBoundingSphere()

  return geometry
}
