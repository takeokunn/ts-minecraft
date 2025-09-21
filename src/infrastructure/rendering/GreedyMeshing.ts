import { Effect, Context, Layer, Schema, Option, Match, pipe, Array as A, Record as R } from 'effect'
import type { ChunkData, MeshData, BlockType } from './MeshGenerator'

// ========================================
// Type Definitions
// ========================================

export interface Quad {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly width: number
  readonly height: number
  readonly axis: number
  readonly blockType: BlockType
  readonly normal: readonly [number, number, number]
}

export interface GreedyMeshingConfig {
  readonly chunkSize: number
  readonly mergeThreshold: number
  readonly optimizationLevel: 'basic' | 'balanced' | 'aggressive'
}

// ========================================
// Error Definitions
// ========================================

export class GreedyMeshingError extends Schema.TaggedError<GreedyMeshingError>()('GreedyMeshingError', {
  reason: Schema.String,
  context: Schema.String,
  timestamp: Schema.Number,
}) {}

// ========================================
// Service Interface
// ========================================

export interface GreedyMeshingService {
  readonly generateGreedyMesh: (chunkData: ChunkData) => Effect.Effect<MeshData, GreedyMeshingError>
  readonly generateQuads: (chunkData: ChunkData) => Effect.Effect<readonly Quad[], GreedyMeshingError>
  readonly optimizeMesh: (meshData: MeshData) => Effect.Effect<MeshData, GreedyMeshingError>
}

export const GreedyMeshingService = Context.GenericTag<GreedyMeshingService>('@minecraft/GreedyMeshingService')

// ========================================
// Helper Functions (Pure Functions)
// ========================================

const getBlock = (blocks: number[][][], x: number, y: number, z: number, size: number): BlockType =>
  pipe(
    Match.value({ x, y, z, size }),
    Match.when(
      ({ x, y, z, size }) => x < 0 || x >= size || y < 0 || y >= size || z < 0 || z >= size,
      () => 0
    ),
    Match.orElse(() => Option.fromNullable(blocks[x]?.[y]?.[z]).pipe(
      Option.getOrElse(() => 0)
    ))
  )

const compareBlocks = (a: BlockType, b: BlockType): boolean =>
  pipe(
    Match.value({ a, b }),
    Match.when(
      ({ a, b }) => a === 0 || b === 0,
      ({ a, b }) => a === b
    ),
    Match.orElse(({ a, b }) => a === b)
  )

const createQuad = (
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  axis: number,
  blockType: BlockType,
  forward: boolean
): Quad => {
  const getNormal = (axis: number, forward: boolean): readonly [number, number, number] =>
    pipe(
      Match.value(axis),
      Match.when(0, () => forward ? [1, 0, 0] as const : [-1, 0, 0] as const),
      Match.when(1, () => forward ? [0, 1, 0] as const : [0, -1, 0] as const),
      Match.when(2, () => forward ? [0, 0, 1] as const : [0, 0, -1] as const),
      Match.exhaustive
    )

  return {
    x,
    y,
    z,
    width,
    height,
    axis,
    blockType,
    normal: getNormal(axis, forward),
  }
}

// ========================================
// Greedy Meshing Algorithm
// ========================================

const generateGreedyMeshForAxis = (
  blocks: number[][][],
  size: number,
  axis: number
): readonly Quad[] => {
  const quads: Quad[] = []
  const u = (axis + 1) % 3
  const v = (axis + 2) % 3

  const dims = [0, 0, 0]
  const mask = new Int32Array(size * size)

  // Process each slice perpendicular to the axis
  for (dims[axis] = -1; dims[axis] < size; ) {
    // Generate mask for current slice
    let n = 0
    for (dims[v] = 0; dims[v] < size; dims[v]++) {
      for (dims[u] = 0; dims[u] < size; dims[u]++) {
        const current = dims[axis] >= 0 ? getBlock(blocks, dims[0], dims[1], dims[2], size) : 0
        const next = dims[axis] < size - 1
          ? getBlock(
              blocks,
              dims[0] + (axis === 0 ? 1 : 0),
              dims[1] + (axis === 1 ? 1 : 0),
              dims[2] + (axis === 2 ? 1 : 0),
              size
            )
          : 0

        // Create mask entry based on face visibility
        mask[n] = pipe(
          Match.value({ current, next }),
          Match.when(
            ({ current, next }) => current !== 0 && next === 0,
            ({ current }) => current
          ),
          Match.when(
            ({ current, next }) => current === 0 && next !== 0,
            ({ next }) => -next
          ),
          Match.orElse(() => 0)
        )
        n++
      }
    }

    dims[axis]++

    // Generate quads from mask using greedy algorithm
    n = 0
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; ) {
        const maskValue = mask[n]
        const processQuad = maskValue !== 0

        if (processQuad) {
          const blockType = Math.abs(maskValue)
          const forward = maskValue > 0

          // Compute quad width
          let width = 1
          while (
            i + width < size &&
            mask[n + width] === maskValue
          ) {
            width++
          }

          // Compute quad height
          let height = 1
          let done = false

          while (j + height < size && !done) {
            for (let k = 0; k < width; k++) {
              if (mask[n + k + height * size] !== maskValue) {
                done = true
                break
              }
            }
            if (!done) height++
          }

          // Create position based on axis
          const position = [0, 0, 0]
          position[axis] = dims[axis]
          position[u] = i
          position[v] = j

          // Add quad
          quads.push(
            createQuad(
              position[0],
              position[1],
              position[2],
              width,
              height,
              axis,
              blockType,
              forward
            )
          )

          // Clear mask for processed area
          for (let l = 0; l < height; l++) {
            for (let k = 0; k < width; k++) {
              mask[n + k + l * size] = 0
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

  return quads
}

// ========================================
// Quad to Mesh Conversion
// ========================================

const quadsToMeshData = (quads: readonly Quad[]): MeshData => {
  const vertices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []

  let vertexOffset = 0

  for (const quad of quads) {
    const { x, y, z, width, height, axis, normal } = quad

    // Calculate quad vertices based on axis and dimensions
    const [quadVertices, quadUvs] = pipe(
      Match.value(axis),
      Match.when(0, () => [
        // X-axis facing quad (YZ plane)
        [x, y, z, x, y + height, z, x, y + height, z + width, x, y, z + width],
        [0, 0, 0, height, width, height, width, 0]
      ]),
      Match.when(1, () => [
        // Y-axis facing quad (XZ plane)
        [x, y, z, x + width, y, z, x + width, y, z + height, x, y, z + height],
        [0, 0, width, 0, width, height, 0, height]
      ]),
      Match.when(2, () => [
        // Z-axis facing quad (XY plane)
        [x, y, z, x + width, y, z, x + width, y + height, z, x, y + height, z],
        [0, 0, width, 0, width, height, 0, height]
      ]),
      Match.exhaustive
    )

    // Add vertices
    vertices.push(...quadVertices)

    // Add normals (same for all 4 vertices of the quad)
    for (let i = 0; i < 4; i++) {
      normals.push(...normal)
    }

    // Add UVs
    uvs.push(...quadUvs)

    // Add indices for two triangles
    indices.push(
      vertexOffset, vertexOffset + 1, vertexOffset + 2,
      vertexOffset, vertexOffset + 2, vertexOffset + 3
    )

    vertexOffset += 4
  }

  return {
    vertices,
    normals,
    uvs,
    indices,
  }
}

// ========================================
// Main Greedy Meshing Function
// ========================================

const generateGreedyMesh = (chunkData: ChunkData): Effect.Effect<MeshData, GreedyMeshingError> =>
  pipe(
    Effect.try({
      try: () => {
        const allQuads = pipe(
          A.range(0, 2),
          A.flatMap(axis =>
            generateGreedyMeshForAxis(
              chunkData.blocks,
              chunkData.size,
              axis
            )
          )
        )
        return quadsToMeshData(allQuads)
      },
      catch: (error) => new GreedyMeshingError({
        reason: `Failed to generate greedy mesh: ${String(error)}`,
        context: 'generateGreedyMesh',
        timestamp: Date.now(),
      })
    }),
    Effect.tap(meshData =>
      Effect.log(
        `Greedy meshing complete: ${meshData.indices.length / 6} quads, ${meshData.vertices.length / 3} vertices`
      )
    )
  )

// ========================================
// Service Implementation
// ========================================

const makeService = (config: GreedyMeshingConfig): GreedyMeshingService => ({
  generateGreedyMesh: (chunkData: ChunkData) => generateGreedyMesh(chunkData),

  generateQuads: (chunkData: ChunkData) =>
    pipe(
      Effect.try({
        try: () => {
          const allQuads: Quad[] = []

          for (let axis = 0; axis < 3; axis++) {
            const quads = generateGreedyMeshForAxis(
              chunkData.blocks,
              chunkData.size,
              axis
            )
            allQuads.push(...quads)
          }

          return allQuads
        },
        catch: (error) => new GreedyMeshingError({
          reason: `Failed to generate quads: ${String(error)}`,
          context: 'generateQuads',
          timestamp: Date.now(),
        })
      })
    ),

  optimizeMesh: (meshData: MeshData) =>
    Effect.gen(function* () {
      // Additional mesh optimization could be implemented here
      // For now, just return the input
      return meshData
    }),
})

// ========================================
// Layer Construction
// ========================================

export const GreedyMeshingLive = Layer.succeed(
  GreedyMeshingService,
  makeService({
    chunkSize: 16,
    mergeThreshold: 0.95,
    optimizationLevel: 'balanced',
  })
)

// ========================================
// Utility Exports
// ========================================

export const calculateVertexReduction = (
  originalVertexCount: number,
  optimizedVertexCount: number
): number =>
  pipe(
    originalVertexCount === 0,
    Match.value,
    Match.when(true, () => 0),
    Match.when(false, () => ((originalVertexCount - optimizedVertexCount) / originalVertexCount) * 100),
    Match.exhaustive
  )