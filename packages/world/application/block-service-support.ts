import { Effect } from 'effect'
import { BlockIndexError, CHUNK_HEIGHT } from '@ts-minecraft/core'
import type { LocalBlock } from '../domain/chunk-coord-utils'
import type { Chunk } from '../domain/chunk'
import { setBlockInChunk } from '../domain/chunk'
import type { ChunkService } from './chunk-service'
import { canBlockStaySupported, isSupportSensitiveBlock } from '../domain/block-support'
import { BlockServiceError } from './block-service-error'

const removeUnsupportedAbove = (
  chunkService: ChunkService,
  chunk: Chunk,
  block: LocalBlock,
  operation: string,
): Effect.Effect<Array<LocalBlock>, BlockServiceError> =>
  Effect.gen(function* () {
    const aboveY = block.y + 1
    if (aboveY >= CHUNK_HEIGHT) return []

    const aboveType = yield* chunkService.getBlock(chunk, block.lx, aboveY, block.lz).pipe(
      Effect.mapError((e) => new BlockServiceError({
        operation,
        reason: `Failed to read dependent block at local (${block.lx}, ${aboveY}, ${block.lz}): ${e.message}`,
        cause: e,
      })),
    )
    if (!isSupportSensitiveBlock(aboveType)) return []

    const supportType = yield* chunkService.getBlock(chunk, block.lx, block.y, block.lz).pipe(
      Effect.mapError((e) => new BlockServiceError({
        operation,
        reason: `Failed to read support block at local (${block.lx}, ${block.y}, ${block.lz}): ${e.message}`,
        cause: e,
      })),
    )
    if (canBlockStaySupported(aboveType, supportType)) return []

    yield* setBlockInChunk(chunk, block.lx, aboveY, block.lz, 'AIR').pipe(
      Effect.mapError((e: BlockIndexError) => new BlockServiceError({
        operation,
        reason: `Dependent block coordinates out of bounds: (${e.x}, ${e.y}, ${e.z})`,
        cause: e,
      })),
    )

    return [{ lx: block.lx, y: aboveY, lz: block.lz }]
  })

export const removeUnsupportedCascade = (
  chunkService: ChunkService,
  chunk: Chunk,
  removedBlocks: Array<LocalBlock>,
  operation: string,
): Effect.Effect<void, BlockServiceError> =>
  Effect.gen(function* () {
    for (let i = 0; i < removedBlocks.length; i++) {
      const extraRemoved = yield* removeUnsupportedAbove(chunkService, chunk, removedBlocks[i]!, operation)
      removedBlocks.push(...extraRemoved)
    }
  })
