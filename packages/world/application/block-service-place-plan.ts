import { Effect } from 'effect'
import { CHUNK_HEIGHT, type BlockType, type Position } from '@ts-minecraft/core'
import { canBlockStaySupported, isSupportSensitiveBlock } from '../domain/block-support'
import type { Chunk } from '../domain/chunk'
import { toPlacedBlock, type PlacedBlock } from '../domain/placed-block'
import { BlockServiceError } from './block-service-error'
import { type ChunkServiceForPlace, type PlacementContext } from './block-service-place-helpers'

type PlacementRule = (
  context: PlacementContext,
  placedBlocks: Array<PlacedBlock>,
) => Effect.Effect<Array<PlacedBlock>, BlockServiceError>

const buildDoorPlacedBlocks = (
  context: PlacementContext,
  baseBlock: PlacedBlock,
): Effect.Effect<Array<PlacedBlock>, BlockServiceError> =>
  Effect.gen(function* () {
    const { chunkService, chunk, position, lx, y, lz, operation } = context

    if (y + 1 >= CHUNK_HEIGHT) {
      return yield* Effect.fail(
        new BlockServiceError({
          operation,
          reason: 'Door requires an empty block above the placement position',
        }),
      )
    }

    const upperExisting = yield* chunkService.getBlock(chunk, lx, y + 1, lz).pipe(
      Effect.mapError(
        (e) =>
          new BlockServiceError({
            operation,
            reason: `Failed to read upper door block at local (${lx}, ${y + 1}, ${lz}): ${e.message}`,
            cause: e,
          }),
      ),
    )
    if (upperExisting !== 'AIR') {
      return yield* Effect.fail(
        new BlockServiceError({
          operation,
          reason: 'Door requires an empty block above the placement position',
        }),
      )
    }

    return [baseBlock, toPlacedBlock(lx, y + 1, lz, { ...position, y: y + 1 })]
  })

const ensureSupportBelow = (
  context: PlacementContext,
): Effect.Effect<void, BlockServiceError> => {
  const { chunkService, chunk, lx, y, lz, blockType, operation } = context

  if (y <= 0) {
    return Effect.fail(
      new BlockServiceError({
        operation,
        reason: `${blockType} requires a supporting block below`,
      }),
    )
  }

  return chunkService.getBlock(chunk, lx, y - 1, lz).pipe(
    Effect.mapError(
      (e) =>
        new BlockServiceError({
          operation,
          reason: `Failed to read support block at local (${lx}, ${y - 1}, ${lz}): ${e.message}`,
          cause: e,
        }),
    ),
    Effect.flatMap((belowType) =>
      canBlockStaySupported(blockType, belowType)
        ? Effect.void
        : Effect.fail(
            new BlockServiceError({
              operation,
              reason: `${blockType} requires a supporting block below`,
            }),
          ),
    ),
  )
}

const applySupportPlacementRule: PlacementRule = (context, placedBlocks) => {
  if (!isSupportSensitiveBlock(context.blockType)) return Effect.succeed(placedBlocks)
  return ensureSupportBelow(context).pipe(Effect.as(placedBlocks))
}

const applyDoorPlacementRule: PlacementRule = (context, placedBlocks) => {
  if (context.blockType !== 'DOOR') return Effect.succeed(placedBlocks)
  return buildDoorPlacedBlocks(context, placedBlocks[0]!)
}

const PLACEMENT_RULES: ReadonlyArray<PlacementRule> = [
  applySupportPlacementRule,
  applyDoorPlacementRule,
]

export const buildPlacedBlocks = (
  chunkService: ChunkServiceForPlace,
  chunk: Chunk,
  blockType: BlockType,
  position: Position,
  lx: number,
  y: number,
  lz: number,
  operation: string,
): Effect.Effect<Array<PlacedBlock>, BlockServiceError> =>
  Effect.gen(function* () {
    const baseBlock = toPlacedBlock(lx, y, lz, position)
    const context: PlacementContext = {
      chunkService,
      chunk,
      position,
      lx,
      y,
      lz,
      blockType,
      operation,
    }

    let placedBlocks: Array<PlacedBlock> = [baseBlock]
    for (const applyPlacementRule of PLACEMENT_RULES) {
      placedBlocks = yield* applyPlacementRule(context, placedBlocks)
    }

    return placedBlocks
  })
