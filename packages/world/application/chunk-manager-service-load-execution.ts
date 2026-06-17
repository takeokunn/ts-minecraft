import { Effect } from 'effect'
import type { ChunkCoord } from '@ts-minecraft/core'
import type { ChunkManagerError } from './chunk-manager-constants'
import type { ChunkCacheEntry } from './chunk-manager-cache'
import { type ChunkOpsContext, getChunk, unloadChunk } from './chunk-manager-ops'

export const loadChunkBatch = (
  ctx: ChunkOpsContext,
  loadSemaphore: Effect.Semaphore,
  chunkLoadBatch: ReadonlyArray<ChunkCoord>,
  terrainLevels?: Parameters<typeof getChunk>[2],
): Effect.Effect<void, ChunkManagerError> =>
  Effect.forEach(
    chunkLoadBatch,
    (coord) => loadSemaphore.withPermits(1)(getChunk(ctx, coord, terrainLevels)),
    { concurrency: 4 },
  )

export const unloadChunkBatch = (
  ctx: ChunkOpsContext,
  chunksToUnload: ReadonlyArray<ChunkCacheEntry>,
): Effect.Effect<void, ChunkManagerError> =>
  Effect.forEach(chunksToUnload, (entry) => unloadChunk(ctx, entry.chunk.coord), { concurrency: 1 })
