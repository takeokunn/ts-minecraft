import { Effect } from 'effect'
import type { BlockType, ChunkCoord, Position } from '@ts-minecraft/core'
import type { Chunk } from '../domain/chunk'
import type { ChunkService } from './chunk-service'
import { worldToBlockLocal } from '../domain/block-utils'
import { BlockServiceError } from './block-service-error'

type ChunkManagerForGet = {
  readonly getChunk: (coord: ChunkCoord) => Effect.Effect<Chunk, { readonly message: string }>
}

export type GetBlockDeps = {
  readonly chunkManagerService: ChunkManagerForGet
  readonly chunkService: ChunkService
}

const operation = 'getBlock'

const mapChunkLoadError = (chunkCoord: ChunkCoord) => (e: { readonly message: string }) =>
  new BlockServiceError({
    operation,
    reason: `Failed to load chunk at (${chunkCoord.x}, ${chunkCoord.z}): ${e.message}`,
    cause: e,
  })

const mapBlockReadError = (lx: number, y: number, lz: number) => (e: { readonly message: string }) =>
  new BlockServiceError({
    operation,
    reason: `Failed to read block at local (${lx}, ${y}, ${lz}): ${e.message}`,
    cause: e,
  })

export const makeGetBlock =
  (deps: GetBlockDeps) =>
  (position: Position): Effect.Effect<BlockType, BlockServiceError> =>
    Effect.gen(function* () {
      const { chunkCoord, lx, y, lz } = worldToBlockLocal(position)
      const chunk = yield* deps.chunkManagerService.getChunk(chunkCoord).pipe(
        Effect.mapError(mapChunkLoadError(chunkCoord)),
      )
      return yield* deps.chunkService.getBlock(chunk, lx, y, lz).pipe(
        Effect.mapError(mapBlockReadError(lx, y, lz)),
      )
    })
