import { Effect, Context, Layer, Schema, Option, Match, pipe, Array as A, Record as R, Predicate } from 'effect'
import type { ChunkData, BlockType } from './MeshGenerator'

// ========================================
// Type Definitions
// ========================================

export interface FaceVisibility {
  readonly top: boolean
  readonly bottom: boolean
  readonly front: boolean
  readonly back: boolean
  readonly left: boolean
  readonly right: boolean
}

export interface CullingConfig {
  readonly enableBackfaceCulling: boolean
  readonly enableOcclusionCulling: boolean
  readonly transparentBlocks: ReadonlySet<BlockType>
}

// ========================================
// Error Definitions
// ========================================

export class FaceCullingError extends Schema.TaggedError<FaceCullingError>()('FaceCullingError', {
  reason: Schema.String,
  context: Schema.String,
  timestamp: Schema.Number,
}) {}

// ========================================
// Service Interface
// ========================================

export interface FaceCullingService {
  readonly checkFaceVisibility: (
    blocks: number[][][],
    x: number,
    y: number,
    z: number,
    size: number
  ) => Effect.Effect<FaceVisibility, FaceCullingError>

  readonly shouldRenderFace: (
    currentBlock: BlockType,
    neighborBlock: BlockType,
    transparentBlocks?: ReadonlySet<BlockType>
  ) => Effect.Effect<boolean, FaceCullingError>

  readonly cullHiddenFaces: (
    chunkData: ChunkData
  ) => Effect.Effect<readonly [number, number, number, FaceVisibility][], FaceCullingError>
}

export const FaceCullingService = Context.GenericTag<FaceCullingService>('@minecraft/FaceCullingService')

// ========================================
// Helper Functions (Pure Functions)
// ========================================

const isTransparent = (blockType: BlockType, transparentBlocks: ReadonlySet<BlockType>): boolean =>
  pipe(
    blockType,
    Predicate.or(
      (b: BlockType) => b === 0,
      (b: BlockType) => transparentBlocks.has(b)
    )
  )

const getBlock = (blocks: number[][][], x: number, y: number, z: number, size: number): BlockType =>
  pipe(
    x >= 0 && x < size && y >= 0 && y < size && z >= 0 && z < size
      ? Option.some(true)
      : Option.none(),
    Option.flatMap(() => Option.fromNullable(blocks[x]?.[y]?.[z])),
    Option.getOrElse(() => 0)
  )

const checkFaceVisibilityPure = (
  blocks: number[][][],
  x: number,
  y: number,
  z: number,
  size: number,
  transparentBlocks: ReadonlySet<BlockType> = new Set()
): FaceVisibility => {
  const currentBlock = getBlock(blocks, x, y, z, size)

  return pipe(
    Match.value(currentBlock),
    Match.when(0, () => ({
      top: false,
      bottom: false,
      front: false,
      back: false,
      left: false,
      right: false,
    })),
    Match.orElse(() => {
      // Check each neighboring block
      const neighbors = {
        top: getBlock(blocks, x, y + 1, z, size),
        bottom: getBlock(blocks, x, y - 1, z, size),
        front: getBlock(blocks, x, y, z + 1, size),
        back: getBlock(blocks, x, y, z - 1, size),
        left: getBlock(blocks, x - 1, y, z, size),
        right: getBlock(blocks, x + 1, y, z, size),
      }

      // Face is visible if neighbor is transparent or air
      return pipe(
        neighbors,
        R.map(neighbor => isTransparent(neighbor, transparentBlocks))
      ) as FaceVisibility
    })
  )
}

const countVisibleFaces = (visibility: FaceVisibility): number =>
  pipe(
    ['top', 'bottom', 'front', 'back', 'left', 'right'] as const,
    A.filter(face => visibility[face]),
    A.length
  )

// ========================================
// Service Implementation
// ========================================

const makeService = (config: CullingConfig): FaceCullingService => ({
  checkFaceVisibility: (blocks, x, y, z, size) =>
    Effect.gen(function* () {
      try {
        const visibility = checkFaceVisibilityPure(
          blocks,
          x,
          y,
          z,
          size,
          config.transparentBlocks
        )
        return visibility
      } catch (error) {
        return yield* Effect.fail(
          new FaceCullingError({
            reason: `Failed to check face visibility: ${String(error)}`,
            context: `checkFaceVisibility(${x},${y},${z})`,
            timestamp: Date.now(),
          })
        )
      }
    }),

  shouldRenderFace: (currentBlock, neighborBlock, transparentBlocks = config.transparentBlocks) =>
    pipe(
      Effect.succeed({ currentBlock, neighborBlock, transparentBlocks }),
      Effect.map(({ currentBlock, neighborBlock, transparentBlocks }) =>
        pipe(
          Match.value(currentBlock),
          Match.when(0, () => false),
          Match.orElse(() => isTransparent(neighborBlock, transparentBlocks))
        )
      ),
      Effect.catchAll(error =>
        Effect.fail(
          new FaceCullingError({
            reason: `Failed to determine face rendering: ${String(error)}`,
            context: 'shouldRenderFace',
            timestamp: Date.now(),
          })
        )
      )
    ),

  cullHiddenFaces: (chunkData) =>
    Effect.gen(function* () {
      try {
        const visibleBlocks: [number, number, number, FaceVisibility][] = []

        for (let x = 0; x < chunkData.size; x++) {
          for (let y = 0; y < chunkData.size; y++) {
            for (let z = 0; z < chunkData.size; z++) {
              const blockType = chunkData.blocks[x]?.[y]?.[z] ?? 0

              // Skip air blocks
              if (blockType === 0) continue

              const visibility = checkFaceVisibilityPure(
                chunkData.blocks,
                x,
                y,
                z,
                chunkData.size,
                config.transparentBlocks
              )

              // Only include blocks with at least one visible face
              if (countVisibleFaces(visibility) > 0) {
                visibleBlocks.push([x, y, z, visibility])
              }
            }
          }
        }

        // Log culling statistics
        const totalBlocks = chunkData.size * chunkData.size * chunkData.size
        const solidBlocks = visibleBlocks.length
        const culledPercentage = ((totalBlocks - solidBlocks) / totalBlocks) * 100

        yield* Effect.log(
          `Face culling complete: ${solidBlocks} visible blocks out of ${totalBlocks} (${culledPercentage.toFixed(1)}% culled)`
        )

        return visibleBlocks
      } catch (error) {
        return yield* Effect.fail(
          new FaceCullingError({
            reason: `Failed to cull hidden faces: ${String(error)}`,
            context: 'cullHiddenFaces',
            timestamp: Date.now(),
          })
        )
      }
    }),
})

// ========================================
// Layer Construction
// ========================================

export const FaceCullingLive = Layer.succeed(
  FaceCullingService,
  makeService({
    enableBackfaceCulling: true,
    enableOcclusionCulling: true,
    transparentBlocks: new Set([0]), // Air is transparent by default
  })
)

// ========================================
// Utility Exports
// ========================================

export const calculateFaceCullingStats = (
  totalFaces: number,
  visibleFaces: number
): { culledFaces: number; cullingRatio: number } => {
  const culledFaces = totalFaces - visibleFaces
  const cullingRatio = totalFaces > 0 ? culledFaces / totalFaces : 0

  return {
    culledFaces,
    cullingRatio,
  }
}

export const optimizeFaceVisibility = (
  visibilities: readonly FaceVisibility[]
): number => {
  let totalVisible = 0

  for (const vis of visibilities) {
    totalVisible += countVisibleFaces(vis)
  }

  return totalVisible
}