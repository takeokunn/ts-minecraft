import { Effect } from 'effect'
import { type BlockType } from '@ts-minecraft/core'
import { setBlockInChunk } from '../domain/chunk'
import type { Chunk } from '../domain/chunk'
import { type PlacedBlock } from '../domain/placed-block'
import type { FluidServiceForPlace } from './block-service-place-helpers'
import { BlockServiceError } from './block-service-error'

const forEachPlacedBlock = <E, R>(
  placedBlocks: ReadonlyArray<PlacedBlock>,
  effectForBlock: (block: PlacedBlock) => Effect.Effect<void, E, R>,
): Effect.Effect<void, E, R> =>
  Effect.forEach(placedBlocks, effectForBlock, {
    concurrency: 1,
    discard: true,
  })

const setPlacedBlocksInChunk = (
  chunk: Chunk,
  placedBlocks: ReadonlyArray<PlacedBlock>,
  blockType: BlockType,
  operation: string,
  errorReason: string,
): Effect.Effect<void, BlockServiceError> =>
  forEachPlacedBlock(placedBlocks, (block) =>
    setBlockInChunk(chunk, block.lx, block.y, block.lz, blockType).pipe(
      /* c8 ignore next 4 */
      Effect.mapError(
        (e) =>
          new BlockServiceError({
            operation,
            reason: `${errorReason}: (${e.x}, ${e.y}, ${e.z})`,
            cause: e,
          }),
      ),
    ),
  )

export const writePlacedBlocks = (
  chunk: Chunk,
  placedBlocks: ReadonlyArray<PlacedBlock>,
  blockType: BlockType,
  operation: string,
): Effect.Effect<void, BlockServiceError> =>
  setPlacedBlocksInChunk(
    chunk,
    placedBlocks,
    blockType,
    operation,
    'Block coordinates out of bounds',
  )

export const rollbackPlacedBlocks = (
  chunk: Chunk,
  placedBlocks: ReadonlyArray<PlacedBlock>,
  operation: string,
): Effect.Effect<void, BlockServiceError> =>
  setPlacedBlocksInChunk(
    chunk,
    placedBlocks,
    'AIR',
    operation,
    'Failed to restore block after inventory rollback',
  )

export const notifyPlacedBlocks = (
  fluidService: FluidServiceForPlace,
  placedBlocks: ReadonlyArray<PlacedBlock>,
): Effect.Effect<void, never> =>
  forEachPlacedBlock(placedBlocks, (block) =>
    fluidService.notifyBlockChanged(block.position),
  )
