import { Effect } from 'effect'
import type { BlockIndexError, BlockType, ChunkCoord } from '@ts-minecraft/core'
import type { Chunk } from '../domain/chunk'
import { setBlockInChunk } from '../domain/chunk'
import type { LocalBlock } from '../domain/chunk-coord-utils'
import { BlockServiceError } from './block-service-error'
import { removeUnsupportedCascade } from './block-service-support'
import type { ChunkService } from './chunk-service'

export type ChunkManagerForForceSet = {
  readonly getChunk: (
    coord: ChunkCoord,
  ) => Effect.Effect<Chunk, { readonly message: string }>
  readonly markChunkDirty: (
    coord: ChunkCoord,
    dirtyBlocks: Array<LocalBlock>,
  ) => Effect.Effect<void, never>
}

export type ForceSetDeps = {
  readonly chunkManagerService: ChunkManagerForForceSet
  readonly chunkService: ChunkService
}

export const mapChunkLoadError =
  (chunkCoord: ChunkCoord) => (e: { readonly message: string }) =>
    new BlockServiceError({
      operation: 'forceSetBlock',
      reason: `Failed to load chunk at (${chunkCoord.x}, ${chunkCoord.z}): ${e.message}`,
      cause: e,
    })

const mapBlockIndexError = (e: BlockIndexError) =>
  new BlockServiceError({
    operation: 'forceSetBlock',
    reason: `Block coordinates out of bounds: (${e.x}, ${e.y}, ${e.z})`,
    cause: e,
  })

export const applyForceSetBlock = (
  chunkManagerService: ChunkManagerForForceSet,
  chunkService: ChunkService,
  chunk: Chunk,
  chunkCoord: ChunkCoord,
  lx: number,
  y: number,
  lz: number,
  blockType: BlockType,
): Effect.Effect<void, BlockServiceError> =>
  Effect.gen(function* () {
    yield* setBlockInChunk(chunk, lx, y, lz, blockType).pipe(
      Effect.mapError(mapBlockIndexError),
    )

    const changedBlocks: Array<LocalBlock> = [{ lx, y, lz }]
    yield* removeUnsupportedCascade(
      chunkService,
      chunk,
      changedBlocks,
      'forceSetBlock',
    )
    yield* chunkManagerService.markChunkDirty(chunkCoord, changedBlocks)
  })
