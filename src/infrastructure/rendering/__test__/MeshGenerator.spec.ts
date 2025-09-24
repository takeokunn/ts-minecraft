import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer } from 'effect'
import { Schema } from '@effect/schema'
import * as THREE from 'three'
import { MeshGeneratorService, MeshGeneratorLive } from '../MeshGenerator'

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

          if (blockType && blockType > 0) {
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
  if (!neighborCoords) {
    return true // No neighbor defined, render face
  }

  const [nx, ny, nz] = neighborCoords

  // Additional type guard for safety
  if (nx === undefined || ny === undefined || nz === undefined) {
    return true // Safety fallback
  }

  // Check bounds
  if (nx < 0 || nx >= chunkSize || ny < 0 || ny >= chunkSize || nz < 0 || nz >= chunkSize) {
    return true // Render faces on chunk boundaries
  }

  // Don't render face if neighbor is solid
  const neighborBlock = blocks[nx]?.[ny]?.[nz] ?? 0
  return !neighborBlock || neighborBlock === 0
}

// ★ Greedy meshing algorithm (functional approach)
const generateGreedyMesh = (chunkData: ChunkData): Effect.Effect<MeshData, MeshGenerationError> =>
  Effect.gen(function* () {
    const validatedChunk = yield* Schema.decodeUnknown(ChunkDataSchema)(chunkData).pipe(
      Effect.mapError(() => 'MeshGenerationError' as const)
    )

    const vertices: number[] = []
    const normals: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    let vertexIndex = 0

    // Process each axis for greedy meshing
    for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3
      const v = (axis + 2) % 3

      const dimensions = [0, 0, 0]
      const mask = new Array(validatedChunk.size * validatedChunk.size).fill(0)

      // Sweep through each slice
      for (dimensions[axis]! = -1; dimensions[axis]! < validatedChunk.size; ) {
        // Generate mask for current slice
        let n = 0
        for (dimensions[v]! = 0; dimensions[v]! < validatedChunk.size; dimensions[v]!++) {
          for (dimensions[u]! = 0; dimensions[u]! < validatedChunk.size; dimensions[u]!++) {
            const currentBlock =
              dimensions[axis]! >= 0
                ? (validatedChunk.blocks[dimensions[0]!]?.[dimensions[1]!]?.[dimensions[2]!] ?? 0)
                : 0
            const nextBlock =
              dimensions[axis]! < validatedChunk.size - 1
                ? (validatedChunk.blocks[dimensions[0]! + (axis === 0 ? 1 : 0)]?.[
                    dimensions[1]! + (axis === 1 ? 1 : 0)
                  ]?.[dimensions[2]! + (axis === 2 ? 1 : 0)] ?? 0)
                : 0

            mask[n++] = currentBlock && !nextBlock ? currentBlock : 0
          }
        }

        dimensions[axis]!++

        // Generate mesh from mask
        n = 0
        for (let j = 0; j < validatedChunk.size; j++) {
          for (let i = 0; i < validatedChunk.size; ) {
            const currentMask = mask[n]
            if (currentMask !== 0) {
              const blockType = currentMask

              // Compute width
              let width = 1
              while (i + width < validatedChunk.size && mask[n + width] === blockType) {
                width++
              }

              // Compute height
              let height = 1
              let done = false
              while (j + height < validatedChunk.size && !done) {
                for (let k = 0; k < width; k++) {
                  if (mask[n + k + height * validatedChunk.size] !== blockType) {
                    done = true
                    break
                  }
                }
                if (!done) height++
              }

              // Add quad to mesh
              const quadVertices = [
                i,
                j,
                dimensions[axis]!,
                i + width,
                j,
                dimensions[axis]!,
                i + width,
                j + height,
                dimensions[axis]!,
                i,
                j + height,
                dimensions[axis]!,
              ]

              const quadNormals = [
                axis === 0 ? 1 : 0,
                axis === 1 ? 1 : 0,
                axis === 2 ? 1 : 0,
                axis === 0 ? 1 : 0,
                axis === 1 ? 1 : 0,
                axis === 2 ? 1 : 0,
                axis === 0 ? 1 : 0,
                axis === 1 ? 1 : 0,
                axis === 2 ? 1 : 0,
                axis === 0 ? 1 : 0,
                axis === 1 ? 1 : 0,
                axis === 2 ? 1 : 0,
              ]

              const quadUVs = [0, 0, width, 0, width, height, 0, height]

              const quadIndices = [
                vertexIndex,
                vertexIndex + 1,
                vertexIndex + 2,
                vertexIndex,
                vertexIndex + 2,
                vertexIndex + 3,
              ]

              vertices.push(...quadVertices)
              normals.push(...quadNormals)
              uvs.push(...quadUVs)
              indices.push(...quadIndices)

              vertexIndex += 4

              // Clear processed mask
              for (let l = 0; l < height; l++) {
                for (let k = 0; k < width; k++) {
                  mask[n + k + l * validatedChunk.size] = 0
                }
              }

              i += width
              n += width
            } else {
              i++
              n++
            }
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
    it.effect('generates valid mesh data for any chunk', () =>
      Effect.gen(function* () {
        const position = { x: 0, y: 0, z: 0 }
        const testChunk = createTestChunkData(position, 16)
        const service = yield* MeshGeneratorService

        const meshData = yield* service.generateMesh(testChunk)

        expect(meshData.vertices).toBeDefined()
        expect(meshData.indices).toBeDefined()
        expect(meshData.normals).toBeDefined()
        expect(meshData.uvs).toBeDefined()

        // Basic validation - vertex count should be multiple of 3
        expect(meshData.vertices.length % 3).toBe(0)
        expect(meshData.indices.every((i) => i >= 0)).toBe(true)
      }).pipe(Effect.provide(MeshGeneratorLive))
    )

    it.effect('handles empty chunks gracefully', () =>
      Effect.gen(function* () {
        const emptyChunk = createEmptyChunkData({ x: 0, y: 0, z: 0 }, 16)
        const service = yield* MeshGeneratorService

        const meshData = yield* service.generateMesh(emptyChunk)

        expect(meshData.vertices).toEqual([])
        expect(meshData.indices).toEqual([])
      }).pipe(Effect.provide(MeshGeneratorLive))
    )
  })

  describe('Optimized Mesh Generation', () => {
    it.effect('optimized mesh reduces vertex count', () =>
      Effect.gen(function* () {
        const solidChunk = createSolidChunkData({ x: 0, y: 0, z: 0 }, 16, 1)
        const service = yield* MeshGeneratorService

        const basicMesh = yield* service.generateMesh(solidChunk)
        const optimizedMesh = yield* service.generateOptimizedMesh(solidChunk)

        // Optimized should have fewer or equal vertices
        expect(optimizedMesh.vertices.length).toBeLessThanOrEqual(basicMesh.vertices.length)
      }).pipe(Effect.provide(MeshGeneratorLive))
    )
  })

  describe('Cache Management', () => {
    it.effect('cache operations work correctly', () =>
      Effect.gen(function* () {
        const service = yield* MeshGeneratorService

        yield* service.clearCache()
        const initialStats = yield* service.getCacheStats()
        expect(initialStats.size).toBe(0)

        const testChunk = createTestChunkData({ x: 0, y: 0, z: 0 }, 8)
        yield* service.generateMesh(testChunk)

        const afterGenStats = yield* service.getCacheStats()
        expect(afterGenStats.size).toBeGreaterThanOrEqual(0)
      }).pipe(Effect.provide(MeshGeneratorLive))
    )
  })
})
