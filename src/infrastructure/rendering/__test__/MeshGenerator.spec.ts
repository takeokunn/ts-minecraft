import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { Schema } from '@effect/schema'
import * as THREE from 'three'

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
const createTestChunkData = (size: number = 4): ChunkData => {
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
    position: { x: 0, y: 0, z: 0 },
    blocks,
    size,
  }
}

const createSolidChunkData = (size: number = 4): ChunkData => {
  const blocks: number[][][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => 1))
  )

  return {
    position: { x: 0, y: 0, z: 0 },
    blocks,
    size,
  }
}

const createEmptyChunkData = (size: number = 4): ChunkData => {
  const blocks: number[][][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => 0))
  )

  return {
    position: { x: 0, y: 0, z: 0 },
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
    it('should generate empty mesh for empty chunk', () => {
      const program = Effect.gen(function* () {
        const emptyChunk = createEmptyChunkData(4)
        const meshData = yield* generateBasicMesh(emptyChunk)

        expect(meshData.vertices).toHaveLength(0)
        expect(meshData.normals).toHaveLength(0)
        expect(meshData.uvs).toHaveLength(0)
        expect(meshData.indices).toHaveLength(0)
      })

      Effect.runSync(program)
    })

    it('should generate mesh for solid chunk', () => {
      const program = Effect.gen(function* () {
        const solidChunk = createSolidChunkData(2) // 2x2x2 = 8 blocks
        const meshData = yield* generateBasicMesh(solidChunk)

        // Each block contributes 8 vertices (2 faces shown for simplicity)
        expect(meshData.vertices.length).toBeGreaterThan(0)
        expect(meshData.normals.length).toBe(meshData.vertices.length)
        expect(meshData.indices.length).toBeGreaterThan(0)

        // Verify mesh data structure
        expect(meshData.vertices.length % 3).toBe(0) // Vertices are vec3
        expect(meshData.normals.length % 3).toBe(0) // Normals are vec3
        expect(meshData.uvs.length % 2).toBe(0) // UVs are vec2
        expect(meshData.indices.length % 3).toBe(0) // Indices are triangles
      })

      Effect.runSync(program)
    })

    it('should handle pattern-based chunk data', () => {
      const program = Effect.gen(function* () {
        const patternChunk = createTestChunkData(4)
        const meshData = yield* generateBasicMesh(patternChunk)

        // Should generate some geometry
        expect(meshData.vertices.length).toBeGreaterThan(0)
        expect(meshData.indices.length).toBeGreaterThan(0)
      })

      Effect.runSync(program)
    })
  })

  describe('Greedy Meshing Algorithm', () => {
    it('should reduce vertex count compared to basic mesh', () => {
      const program = Effect.gen(function* () {
        const solidChunk = createSolidChunkData(4)

        const basicMesh = yield* generateBasicMesh(solidChunk)
        const greedyMesh = yield* generateGreedyMesh(solidChunk)

        // Greedy meshing should produce fewer vertices for solid chunks
        expect(greedyMesh.vertices.length).toBeLessThanOrEqual(basicMesh.vertices.length)

        // Both should have valid mesh data
        expect(greedyMesh.vertices.length % 3).toBe(0)
        expect(greedyMesh.normals.length % 3).toBe(0)
        expect(greedyMesh.uvs.length % 2).toBe(0)
        expect(greedyMesh.indices.length % 3).toBe(0)
      })

      Effect.runSync(program)
    })

    it('should handle empty chunk correctly', () => {
      const program = Effect.gen(function* () {
        const emptyChunk = createEmptyChunkData(4)
        const greedyMesh = yield* generateGreedyMesh(emptyChunk)

        expect(greedyMesh.vertices).toHaveLength(0)
        expect(greedyMesh.normals).toHaveLength(0)
        expect(greedyMesh.uvs).toHaveLength(0)
        expect(greedyMesh.indices).toHaveLength(0)
      })

      Effect.runSync(program)
    })
  })

  describe('Face Culling', () => {
    it.effect('should correctly identify faces to render', () =>
      Effect.gen(function* () {
        // Create a 2x2x2 blocks array where blocks[x][y][z]
        const blocks = [
          [
            // x=0
            [1, 0], // y=0: [z=0, z=1]
            [0, 0], // y=1: [z=0, z=1]
          ],
          [
            // x=1
            [0, 1], // y=0: [z=0, z=1]
            [1, 1], // y=1: [z=0, z=1]
          ],
        ]

        // Test block at (0,0,0) = 1 (solid)
        // Face should be rendered when neighbor is air (0)
        expect(shouldRenderFace(blocks, 0, 0, 0, 'top', 2)).toBe(true) // neighbor (0,1,0) = 0 (air)
        expect(shouldRenderFace(blocks, 0, 0, 0, 'east', 2)).toBe(true) // neighbor (1,0,0) = 0 (air)
        expect(shouldRenderFace(blocks, 0, 0, 0, 'south', 2)).toBe(true) // neighbor (0,0,1) = 0 (air)

        // Test block at (1,1,1) = 1 (solid)
        // blocks[1][1][0] = 1, so west neighbor blocks[0][1][0] = 0 (air) → render
        expect(shouldRenderFace(blocks, 1, 1, 0, 'west', 2)).toBe(true) // neighbor (0,1,0) = 0 (air)
        // blocks[1][1][1] = 1, so west neighbor blocks[0][1][1] = 0 (air) → render
        expect(shouldRenderFace(blocks, 1, 1, 1, 'west', 2)).toBe(true) // neighbor (0,1,1) = 0 (air)
      })
    )

    it.effect('should render faces on chunk boundaries', () =>
      Effect.gen(function* () {
        const blocks = [[[1]]]

        // All boundary faces should be rendered
        expect(shouldRenderFace(blocks, 0, 0, 0, 'west', 1)).toBe(true)
        expect(shouldRenderFace(blocks, 0, 0, 0, 'east', 1)).toBe(true)
        expect(shouldRenderFace(blocks, 0, 0, 0, 'bottom', 1)).toBe(true)
        expect(shouldRenderFace(blocks, 0, 0, 0, 'top', 1)).toBe(true)
        expect(shouldRenderFace(blocks, 0, 0, 0, 'north', 1)).toBe(true)
        expect(shouldRenderFace(blocks, 0, 0, 0, 'south', 1)).toBe(true)
      })
    )
  })

  describe('Performance Requirements', () => {
    it('should generate mesh within performance requirements', () => {
      const program = Effect.gen(function* () {
        const largeChunk = createTestChunkData(16) // 16x16x16 chunk

        const { duration } = yield* measurePerformance(
          generateBasicMesh(largeChunk),
          'Basic mesh generation for 16x16x16 chunk'
        )

        // Should complete within 300ms for 16x16x16 chunk (CI環境考慮)
        expect(duration).toBeLessThan(300)
      })

      Effect.runSync(program)
    })

    it('should demonstrate vertex reduction with greedy meshing', () => {
      const program = Effect.gen(function* () {
        const solidChunk = createSolidChunkData(8) // 8x8x8 chunk

        const { result: basicMesh, duration: basicDuration } = yield* measurePerformance(
          generateBasicMesh(solidChunk),
          'Basic mesh generation'
        )

        const { result: greedyMesh, duration: greedyDuration } = yield* measurePerformance(
          generateGreedyMesh(solidChunk),
          'Greedy mesh generation'
        )

        const basicVertexCount = basicMesh.vertices.length / 3
        const greedyVertexCount = greedyMesh.vertices.length / 3
        const reduction = ((basicVertexCount - greedyVertexCount) / basicVertexCount) * 100

        yield* Effect.log(`Vertex reduction: ${reduction.toFixed(1)}%`)
        yield* Effect.log(`Basic: ${basicVertexCount} vertices, Greedy: ${greedyVertexCount} vertices`)

        // Should achieve at least 50% reduction for solid chunks
        expect(reduction).toBeGreaterThanOrEqual(50)
      })

      Effect.runSync(program)
    })
  })

  describe('Schema Validation', () => {
    it('should validate chunk data schema', () => {
      const program = Effect.gen(function* () {
        const invalidChunk = {
          position: { x: 'invalid', y: 0, z: 0 },
          blocks: [],
          size: -1,
        }

        const result = yield* Effect.either(generateBasicMesh(invalidChunk as any))

        expect(result._tag).toBe('Left')
      })

      Effect.runSync(program)
    })

    it('should validate block type ranges', () => {
      const program = Effect.gen(function* () {
        const blocks = [[[300]]] // Invalid block type (> 255)
        const invalidChunk = {
          position: { x: 0, y: 0, z: 0 },
          blocks,
          size: 1,
        }

        const result = yield* Effect.either(generateBasicMesh(invalidChunk))

        expect(result._tag).toBe('Left')
      })

      Effect.runSync(program)
    })
  })

  describe('THREE.js Integration', () => {
    it('should produce data compatible with THREE.BufferGeometry', () => {
      const program = Effect.gen(function* () {
        const testChunk = createTestChunkData(4)
        const meshData = yield* generateBasicMesh(testChunk)

        // Create THREE.js BufferGeometry to verify compatibility
        const geometry = new THREE.BufferGeometry()

        if (meshData.vertices.length > 0) {
          // Convert readonly arrays to mutable arrays for THREE.js
          const vertices = [...meshData.vertices]
          const normals = [...meshData.normals]
          const uvs = [...meshData.uvs]
          const indices = [...meshData.indices]

          geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
          geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
          geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
          geometry.setIndex(indices)

          // Verify geometry is valid
          const positionAttribute = geometry.attributes['position']
          const normalAttribute = geometry.attributes['normal']
          const uvAttribute = geometry.attributes['uv']
          const indexAttribute = geometry.index

          if (positionAttribute) {
            expect(positionAttribute.count).toBeGreaterThan(0)
          }
          if (normalAttribute && positionAttribute) {
            expect(normalAttribute.count).toBe(positionAttribute.count)
          }
          if (uvAttribute && positionAttribute) {
            expect(uvAttribute.count).toBe(positionAttribute.count)
          }
          if (indexAttribute) {
            expect(indexAttribute.count).toBeGreaterThan(0)
          }
        }

        geometry.dispose()
      })

      Effect.runSync(program)
    })
  })
})
