import { Schema } from '@effect/schema'
import { Array as A, Context, Effect, Layer, Match, Option, pipe, Predicate, Record as R } from 'effect'
import type { BlockType, ChunkData } from './MeshGenerator'

// ========================================
// Type Definitions
// ========================================

export interface FaceVisibility {
  readonly top: Schema.Schema.Type<typeof Schema.Boolean>
  readonly bottom: Schema.Schema.Type<typeof Schema.Boolean>
  readonly front: Schema.Schema.Type<typeof Schema.Boolean>
  readonly back: Schema.Schema.Type<typeof Schema.Boolean>
  readonly left: Schema.Schema.Type<typeof Schema.Boolean>
  readonly right: Schema.Schema.Type<typeof Schema.Boolean>
}

export interface CullingConfig {
  readonly enableBackfaceCulling: Schema.Schema.Type<typeof Schema.Boolean>
  readonly enableOcclusionCulling: Schema.Schema.Type<typeof Schema.Boolean>
  readonly transparentBlocks: ReadonlySet<BlockType>
}

// ========================================
// Error Definitions
// ========================================

export interface FaceCullingError {
  readonly _tag: 'FaceCullingError'
  readonly reason: string
  readonly context: string
  readonly timestamp: number
}

export const FaceCullingError = (reason: string, context: string, timestamp: number): FaceCullingError => ({
  _tag: 'FaceCullingError',
  reason,
  context,
  timestamp,
})

export const isFaceCullingError: Predicate.Refinement<unknown, FaceCullingError> = (error): error is FaceCullingError =>
  Predicate.isRecord(error) && '_tag' in error && error['_tag'] === 'FaceCullingError'

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
  ) => Effect.Effect<FaceVisibility, FaceCullingError, never>

  readonly shouldRenderFace: (
    currentBlock: BlockType,
    neighborBlock: BlockType,
    transparentBlocks?: ReadonlySet<BlockType>
  ) => Effect.Effect<Schema.Schema.Type<typeof Schema.Boolean>, FaceCullingError, never>

  readonly cullHiddenFaces: (
    chunkData: ChunkData
  ) => Effect.Effect<readonly [number, number, number, FaceVisibility][], FaceCullingError, never>
}

export const FaceCullingService = Context.GenericTag<FaceCullingService>('@minecraft/infrastructure/FaceCullingService')

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
    x >= 0 && x < size && y >= 0 && y < size && z >= 0 && z < size ? Option.some(true) : Option.none(),
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
        R.map((neighbor) => isTransparent(neighbor, transparentBlocks))
      ) as FaceVisibility
    })
  )
}

const countVisibleFaces = (visibility: FaceVisibility): number =>
  pipe(
    ['top', 'bottom', 'front', 'back', 'left', 'right'] as const,
    A.filter((face) => visibility[face]),
    A.length
  )

// ========================================
// Service Implementation
// ========================================

const makeService = (config: CullingConfig): FaceCullingService => ({
  checkFaceVisibility: (blocks, x, y, z, size) =>
    Effect.try({
      try: () => checkFaceVisibilityPure(blocks, x, y, z, size, config.transparentBlocks),
      catch: (error) =>
        FaceCullingError(
          `Failed to check face visibility: ${String(error)}`,
          `checkFaceVisibility(${x},${y},${z})`,
          Date.now()
        ),
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
      Effect.catchAll((error) =>
        Effect.fail(
          FaceCullingError(`Failed to determine face rendering: ${String(error)}`, 'shouldRenderFace', Date.now())
        )
      )
    ),

  cullHiddenFaces: (chunkData) =>
    Effect.try({
      try: () => {
        // Create indices for 3D iteration using functional approach
        const indices = pipe(
          A.range(0, chunkData.size - 1),
          A.flatMap((x) =>
            pipe(
              A.range(0, chunkData.size - 1),
              A.flatMap((y) =>
                pipe(
                  A.range(0, chunkData.size - 1),
                  A.map((z) => [x, y, z] as const)
                )
              )
            )
          )
        )

        // Convert readonly blocks to mutable for checkFaceVisibilityPure
        const mutableBlocks = chunkData.blocks.map((layer) => layer.map((row) => [...row]))

        // Use filterMap to process blocks functionally
        const visibleBlocks = pipe(
          indices,
          A.filterMap(([x, y, z]) => {
            const blockType = mutableBlocks[x]?.[y]?.[z] ?? 0

            return pipe(
              Match.value(blockType),
              Match.when(0, () => Option.none()), // Skip air blocks
              Match.orElse(() => {
                const visibility = checkFaceVisibilityPure(
                  mutableBlocks,
                  x,
                  y,
                  z,
                  chunkData.size,
                  config.transparentBlocks
                )

                return pipe(
                  Option.some(countVisibleFaces(visibility)),
                  Option.filter((visibleCount: number) => visibleCount > 0),
                  Option.map(() => [x, y, z, visibility] as [number, number, number, FaceVisibility])
                )
              })
            )
          })
        )

        return visibleBlocks as readonly [number, number, number, FaceVisibility][]
      },
      catch: (error) =>
        FaceCullingError(`Failed to cull hidden faces: ${String(error)}`, 'cullHiddenFaces', Date.now()),
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

export const optimizeFaceVisibility = (visibilities: readonly FaceVisibility[]): number =>
  pipe(
    visibilities,
    A.map(countVisibleFaces),
    A.reduce(0, (acc, count) => acc + count)
  )
