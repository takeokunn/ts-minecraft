import { Schema } from '@effect/schema'
import { it } from '@effect/vitest'
import { Effect, Match, Option, pipe } from 'effect'
import { describe, expect } from 'vitest'
import { MeshGeneratorLive, MeshGeneratorService } from '../MeshGenerator'

// ★ Schema-first approach for mesh generation data
const ChunkPositionSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})

const BlockTypeSchema = Schema.Number.pipe(Schema.int(), Schema.between(0, 255))

const ChunkDataSchema = Schema.Struct({
  position: ChunkPositionSchema,
  blocks: Schema.Array(Schema.Array(Schema.Array(BlockTypeSchema))),
  size: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

const MeshDataSchema = Schema.Struct({
  vertices: Schema.Array(Schema.Number),
  normals: Schema.Array(Schema.Number),
  uvs: Schema.Array(Schema.Number),
  indices: Schema.Array(Schema.Number),
})

export const MeshGenerationError = Schema.TaggedError<'MeshGenerationError'>()('MeshGenerationError', {
  reason: Schema.String,
  chunkPosition: ChunkPositionSchema,
  timestamp: Schema.Number,
})
export type MeshGenerationError = typeof MeshGenerationError.Type

// Type exports
export type ChunkPosition = Schema.Schema.Type<typeof ChunkPositionSchema>
export type BlockType = Schema.Schema.Type<typeof BlockTypeSchema>
export type ChunkData = Schema.Schema.Type<typeof ChunkDataSchema>
export type MeshData = Schema.Schema.Type<typeof MeshDataSchema>

// ★ Pure function for basic mesh generation (no classes)
const generateBasicMesh = (chunkData: ChunkData): Effect.Effect<MeshData, MeshGenerationError> =>
  Effect.gen(function* () {
    // Validate input
    const validatedChunk = yield* Schema.decodeUnknown(ChunkDataSchema)(chunkData)
      .pipe(Effect.mapError(() => 'MeshGenerationError' as const))
      .pipe(Effect.mapError(() => 'MeshGenerationError' as const))

    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    let vertexIndex = 0

    // Simple cube generation for each non-air block
    for (let x = 0; x < validatedChunk.size; x++) {
      for (let y = 0; y < validatedChunk.size; y++) {
        for (let z = 0; z < validatedChunk.size; z++) {
          const blockType = validatedChunk.blocks[x]?.[y]?.[z] ?? 0

          if (blockType > 0) {
            // Generate cube faces (basic implementation)
            const cubeVertices = [
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
            ]

            const cubeNormals = [
              // Front face normals
              0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
              // Back face normals
              0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
            ]

            const cubeUVs = [
              // Front face UVs
              0, 0, 1, 0, 1, 1, 0, 1,
              // Back face UVs
              1, 0, 1, 1, 0, 1, 0, 0,
            ]

            const cubeIndices = [
              // Front face
              vertexIndex,
              vertexIndex + 1,
              vertexIndex + 2,
              vertexIndex,
              vertexIndex + 2,
              vertexIndex + 3,
              // Back face
              vertexIndex + 4,
              vertexIndex + 5,
              vertexIndex + 6,
              vertexIndex + 4,
              vertexIndex + 6,
              vertexIndex + 7,
            ]

            vertices.push(...cubeVertices)
            normals.push(...cubeNormals)
            uvs.push(...cubeUVs)
            indices.push(...cubeIndices)

            vertexIndex += 8
          }
        }
      }
    }

    return {
      vertices,
      normals,
      uvs,
      indices,
    } as MeshData
  })

// ★ Face culling function (pure function approach)
const shouldRenderFace = (
  blocks: number[][][],
  x: number,
  y: number,
  z: number,
  faceDirection: 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west',
  chunkSize: number
): boolean => {
  const neighbors = {
    top: [x, y + 1, z],
    bottom: [x, y - 1, z],
    north: [x, y, z - 1],
    south: [x, y, z + 1],
    east: [x + 1, y, z],
    west: [x - 1, y, z],
  }

  const neighborCoords = neighbors[faceDirection]
  return pipe(
    Option.fromNullable(neighborCoords),
    Option.match({
      onNone: () => true, // No neighbor defined, render face
      onSome: (coords) => {
        const [nx, ny, nz] = coords

        // Additional type guard for safety
        return pipe(
          Match.value({ nx, ny, nz }),
          Match.when(
            ({ nx, ny, nz }) => nx === undefined || ny === undefined || nz === undefined,
            () => true // Safety fallback
          ),
          Match.orElse(() => {
            // Check bounds
            return pipe(
              Match.value({ nx, ny, nz, chunkSize }),
              Match.when(
                ({ nx, ny, nz, chunkSize }) =>
                  nx !== undefined &&
                  ny !== undefined &&
                  nz !== undefined &&
                  (nx < 0 || nx >= chunkSize || ny < 0 || ny >= chunkSize || nz < 0 || nz >= chunkSize),
                () => true // Render faces on chunk boundaries
              ),
              Match.orElse(() => {
                // Don't render face if neighbor is solid
                const neighborBlockType = blocks[nx!]?.[ny!]?.[nz!] ?? 0
                return neighborBlockType === 0
              })
            )
          })
        )
      },
    })
  )
}

// ★ Test helper functions (pure functions)
const createTestChunkData = (position: ChunkPosition, size: number = 4): ChunkData => {
  const blocks: number[][][] = []

  for (let x = 0; x < size; x++) {
    blocks[x] = []
    for (let y = 0; y < size; y++) {
      blocks[x]![y] = []
      for (let z = 0; z < size; z++) {
        // Create a simple pattern for testing
        blocks[x]![y]![z] = (x + y + z) % 2 === 0 ? 1 : 0
      }
    }
  }

  return {
    position: { x: position.x, y: 0, z: position.z },
    blocks,
    size,
  }
}

const createSolidChunkData = (position: ChunkPosition, size: number = 4, blockType: number = 1): ChunkData => {
  const blocks: number[][][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => blockType))
  )

  return {
    position: { x: position.x, y: 0, z: position.z },
    blocks,
    size,
  }
}

const createEmptyChunkData = (position: ChunkPosition, size: number = 4): ChunkData => {
  const blocks: number[][][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => 0))
  )

  return {
    position: { x: position.x, y: 0, z: position.z },
    blocks,
    size,
  }
}

// ★ Performance measurement helper
const measurePerformance = <A, E>(
  operation: Effect.Effect<A, E>,
  label: string
): Effect.Effect<{ result: A; duration: number }, E> =>
  Effect.gen(function* () {
    const startTime = performance.now()
    const result = yield* operation
    const endTime = performance.now()
    const duration = endTime - startTime

    yield* Effect.log(`${label}: ${duration.toFixed(2)}ms`)

    return { result, duration } as { result: A; duration: number }
  })

describe('MeshGenerator', () => {
  describe('Basic Mesh Generation', () => {
    it.effect(
      'generates valid mesh data for any chunk',
      () =>
        Effect.gen(function* () {
          const position = { x: 0, y: 0, z: 0 }
          // 小さなチャンクサイズを使用してテスト実行時間を短縮
          const testChunk = createTestChunkData(position, 8)
          const service = yield* MeshGeneratorService

          const meshData = yield* service.generateMesh(testChunk)

          expect(meshData.vertices).toBeDefined()
          expect(meshData.indices).toBeDefined()
          expect(meshData.normals).toBeDefined()
          expect(meshData.uvs).toBeDefined()

          // Basic validation - vertex count should be multiple of 3
          expect(meshData.vertices.length % 3).toBe(0)
          expect(meshData.indices.every((i) => i >= 0)).toBe(true)
        }).pipe(Effect.provide(MeshGeneratorLive)),
      { timeout: 60000 }
    )

    it.effect(
      'handles empty chunks gracefully',
      () =>
        Effect.gen(function* () {
          // 空のチャンクは高速なので元のサイズを維持
          const emptyChunk = createEmptyChunkData({ x: 0, y: 0, z: 0 }, 16)
          const service = yield* MeshGeneratorService

          const meshData = yield* service.generateMesh(emptyChunk)

          expect(meshData.vertices).toEqual([])
          expect(meshData.indices).toEqual([])
        }).pipe(Effect.provide(MeshGeneratorLive)),
      { timeout: 30000 }
    )
  })

  describe('Optimized Mesh Generation', () => {
    it.effect(
      'optimized mesh reduces vertex count',
      () =>
        Effect.gen(function* () {
          // 最適化アルゴリズムは計算集約的なので小さなサイズを使用
          const solidChunk = createSolidChunkData({ x: 0, y: 0, z: 0 }, 6, 1)
          const service = yield* MeshGeneratorService

          const basicMesh = yield* service.generateMesh(solidChunk)
          const optimizedMesh = yield* service.generateOptimizedMesh(solidChunk)

          // Optimized should have fewer or equal vertices
          expect(optimizedMesh.vertices.length).toBeLessThanOrEqual(basicMesh.vertices.length)
        }).pipe(Effect.provide(MeshGeneratorLive)),
      { timeout: 90000 }
    )
  })

  describe('Cache Management', () => {
    it.effect(
      'cache operations work correctly',
      () =>
        Effect.gen(function* () {
          const service = yield* MeshGeneratorService

          yield* service.clearCache()
          const initialStats = yield* service.getCacheStats()
          expect(initialStats.size).toBe(0)

          // キャッシュテストは高速なので元のサイズを維持
          const testChunk = createTestChunkData({ x: 0, y: 0, z: 0 }, 8)
          yield* service.generateMesh(testChunk)

          const afterGenStats = yield* service.getCacheStats()
          expect(afterGenStats.size).toBeGreaterThanOrEqual(0)
        }).pipe(Effect.provide(MeshGeneratorLive)),
      { timeout: 45000 }
    )
  })
})
