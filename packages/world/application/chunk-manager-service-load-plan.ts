import { type ChunkCoord, type WorldId } from '@ts-minecraft/core'
import { countChunksInRadius, getChunksInRenderDistance } from '../domain/chunk-coord-utils'
import type { ChunkCache, ChunkCacheEntry } from './chunk-manager-cache'
import { MAX_CACHED_CHUNKS } from './chunk-manager-constants'
import { collectChunksToUnload, collectMissingChunkCoords, selectChunkLoadBatch } from './chunk-manager-service-selection'

export type ChunkLoadPlan = {
  readonly chunksToLoad: ReadonlyArray<ChunkCoord>
  readonly missingChunksToLoad: ReadonlyArray<ChunkCoord>
  readonly chunkLoadBatch: ReadonlyArray<ChunkCoord>
  readonly chunksToUnload: ReadonlyArray<ChunkCacheEntry>
  readonly chunkCacheCapacity: number
}

export const resolveChunkCacheCapacity = (renderDistance: number): number =>
  Math.max(MAX_CACHED_CHUNKS, countChunksInRadius(renderDistance + 2))

export const resolveChunkLoadPlan = (
  state: ChunkCache,
  currentWorldId: WorldId,
  centerChunk: ChunkCoord,
  renderDistance: number,
  eager: boolean = false,
): ChunkLoadPlan => {
  const chunksToLoad = getChunksInRenderDistance(centerChunk, renderDistance)
  const missingChunksToLoad = collectMissingChunkCoords(state, currentWorldId, chunksToLoad)
  const chunkLoadBatch = selectChunkLoadBatch(missingChunksToLoad, renderDistance, eager)
  const chunksToUnload = collectChunksToUnload(state, centerChunk, renderDistance)

  return {
    chunksToLoad,
    missingChunksToLoad,
    chunkLoadBatch,
    chunksToUnload,
    chunkCacheCapacity: resolveChunkCacheCapacity(renderDistance),
  }
}
