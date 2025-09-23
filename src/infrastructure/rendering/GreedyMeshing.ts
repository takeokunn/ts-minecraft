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

export interface GreedyMeshingError {
  readonly _tag: 'GreedyMeshingError'
  readonly reason: string
  readonly context: string
  readonly timestamp: number
}

export const GreedyMeshingError = (reason: string, context: string, timestamp: number): GreedyMeshingError => ({
  _tag: 'GreedyMeshingError',
  reason,
  context,
  timestamp,
})

export const isGreedyMeshingError = (error: unknown): error is GreedyMeshingError =>
  typeof error === 'object' && error !== null && '_tag' in error && error._tag === 'GreedyMeshingError'

// ========================================
// Service Interface
// ========================================

export interface GreedyMeshingService {
  readonly generateGreedyMesh: (chunkData: ChunkData) => Effect.Effect<MeshData, GreedyMeshingError, never>
  readonly generateQuads: (chunkData: ChunkData) => Effect.Effect<readonly Quad[], GreedyMeshingError, never>
  readonly optimizeMesh: (meshData: MeshData) => Effect.Effect<MeshData, GreedyMeshingError, never>
}

export const GreedyMeshingService = Context.GenericTag<GreedyMeshingService>('@minecraft/GreedyMeshingService')

// ========================================
// Helper Functions (Pure Functions)
// ========================================

const getBlock = (blocks: number[][][], x: number, y: number, z: number, size: number): BlockType =>
  pipe(
    Match.value({ x, y, z }),
    Match.when(
      ({ x, y, z }) => x < 0 || x >= size || y < 0 || y >= size || z < 0 || z >= size,
      () => 0
    ),
    Match.orElse(() => Option.fromNullable(blocks[x]?.[y]?.[z]).pipe(Option.getOrElse(() => 0)))
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
  const getNormal = (axis: number, forward: boolean): readonly [number, number, number] => {
    switch (axis) {
      case 0:
        return forward ? ([1, 0, 0] as const) : ([-1, 0, 0] as const)
      case 1:
        return forward ? ([0, 1, 0] as const) : ([0, -1, 0] as const)
      case 2:
        return forward ? ([0, 0, 1] as const) : ([0, 0, -1] as const)
      default:
        throw new Error(`Invalid axis: ${axis}`)
    }
  }

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

const generateGreedyMeshForAxis = (blocks: number[][][], size: number, axis: number): readonly Quad[] => {
  const quads: Quad[] = []

  // 各スライス位置で面を生成（境界も含む）
  for (let d = 0; d <= size; d++) {
    const mask: BlockType[] = []

    // マスクを作成（面が必要なブロックを特定）
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const [x1, y1, z1] = axis === 0 ? [d - 1, i, j] : axis === 1 ? [i, d - 1, j] : [i, j, d - 1]
        const [x2, y2, z2] = axis === 0 ? [d, i, j] : axis === 1 ? [i, d, j] : [i, j, d]

        const block1 = getBlock(blocks, x1, y1, z1, size)
        const block2 = getBlock(blocks, x2, y2, z2, size)

        // 面が表示される条件
        let faceBlock: BlockType = 0
        if (block1 !== 0 && block2 === 0) {
          faceBlock = block1 // 正方向の面
        } else if (block1 === 0 && block2 !== 0) {
          faceBlock = -block2 // 負方向の面（負の値で区別）
        }

        mask.push(faceBlock)
      }
    }

    // マスクをもとにGreedy Meshingを実行
    const processedMask = [...mask]

    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const index = j * size + i
        const blockType = processedMask[index]

        if (blockType === 0) continue

        // 幅方向（i軸）への拡張
        let width = 1
        while (i + width < size && processedMask[j * size + (i + width)] === blockType) {
          width++
        }

        // 高さ方向（j軸）への拡張
        let height = 1
        let canExpandHeight = true
        while (j + height < size && canExpandHeight) {
          for (let w = 0; w < width; w++) {
            if (processedMask[(j + height) * size + (i + w)] !== blockType) {
              canExpandHeight = false
              break
            }
          }
          if (canExpandHeight) {
            height++
          }
        }

        // クアッドを作成
        const isPositive = (blockType ?? 0) > 0
        const actualBlockType = Math.abs(blockType ?? 0)

        // 位置計算を修正（常に非負の値を保証）
        let quadX: number, quadY: number, quadZ: number

        if (axis === 0) {
          quadX = isPositive ? d : Math.max(0, d - 1)
          quadY = i
          quadZ = j
        } else if (axis === 1) {
          quadX = i
          quadY = isPositive ? d : Math.max(0, d - 1)
          quadZ = j
        } else {
          quadX = i
          quadY = j
          quadZ = isPositive ? d : Math.max(0, d - 1)
        }

        quads.push(createQuad(quadX, quadY, quadZ, width, height, axis, actualBlockType, isPositive))

        // 使用したマスクエリアをクリア
        for (let h = 0; h < height; h++) {
          for (let w = 0; w < width; w++) {
            processedMask[(j + h) * size + (i + w)] = 0
          }
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
    const [quadVertices, quadUvs]: [number[], number[]] = (() => {
      switch (axis) {
        case 0:
          // X-axis facing quad (YZ plane)
          return [
            [x, y, z, x, y + height, z, x, y + height, z + width, x, y, z + width],
            [0, 0, 0, height, width, height, width, 0],
          ]
        case 1:
          // Y-axis facing quad (XZ plane)
          return [
            [x, y, z, x + width, y, z, x + width, y, z + height, x, y, z + height],
            [0, 0, width, 0, width, height, 0, height],
          ]
        case 2:
          // Z-axis facing quad (XY plane)
          return [
            [x, y, z, x + width, y, z, x + width, y + height, z, x, y + height, z],
            [0, 0, width, 0, width, height, 0, height],
          ]
        default:
          throw new Error(`Invalid axis: ${axis}`)
      }
    })()

    // Add vertices
    vertices.push(...quadVertices)

    // Add normals (same for all 4 vertices of the quad)
    for (let i = 0; i < 4; i++) {
      normals.push(...normal)
    }

    // Add UVs
    uvs.push(...quadUvs)

    // Add indices for two triangles
    indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2, vertexOffset, vertexOffset + 2, vertexOffset + 3)

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

const generateGreedyMesh = (chunkData: ChunkData): Effect.Effect<MeshData, GreedyMeshingError, never> =>
  pipe(
    Effect.try({
      try: () => {
        const mutableBlocks = chunkData.blocks.map((layer) => layer.map((row) => [...row]))
        const allQuads = pipe(
          A.range(0, 2), // 0, 1, 2の3つの軸
          A.flatMap((axis) => generateGreedyMeshForAxis(mutableBlocks, chunkData.size, axis))
        )
        return quadsToMeshData(allQuads)
      },
      catch: (error) =>
        GreedyMeshingError(`Failed to generate greedy mesh: ${String(error)}`, 'generateGreedyMesh', Date.now()),
    })
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
          // 入力検証
          if (!chunkData || !chunkData.blocks || chunkData.size <= 0) {
            throw new Error('Invalid chunk data: missing blocks or invalid size')
          }

          const allQuads: Quad[] = []
          const mutableBlocks = chunkData.blocks.map((layer) => layer.map((row) => [...row]))

          for (let axis = 0; axis < 3; axis++) {
            const quads = generateGreedyMeshForAxis(mutableBlocks, chunkData.size, axis)
            allQuads.push(...quads)
          }

          return allQuads
        },
        catch: (error) => GreedyMeshingError(`Failed to generate quads: ${String(error)}`, 'generateQuads', Date.now()),
      })
    ),

  optimizeMesh: (meshData: MeshData) => Effect.succeed(meshData),
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

export const calculateVertexReduction = (originalVertexCount: number, optimizedVertexCount: number): number => {
  if (originalVertexCount === 0) {
    return 0
  }
  return ((originalVertexCount - optimizedVertexCount) / originalVertexCount) * 100
}
