import { HashMap } from 'effect'
import { type ChunkCoord, type WorldId } from '@ts-minecraft/core'
import { CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE, MAX_CHUNK_LOADS_PER_CALL } from './chunk-manager-service-model'
import { chunkCoordToWorldKey, chunkDistanceSquared } from '../domain/chunk-coord-utils'
import type { ChunkCache, ChunkCacheEntry } from './chunk-manager-cache'

export const collectMissingChunkCoords = (
  state: ChunkCache,
  worldId: WorldId,
  chunkCoords: ReadonlyArray<ChunkCoord>,
): ReadonlyArray<ChunkCoord> => {
  const missingChunksToLoad: Array<ChunkCoord> = []
  for (let idx = 0; idx < chunkCoords.length; idx++) {
    const coord = chunkCoords[idx]!
    if (!HashMap.has(state.chunks, chunkCoordToWorldKey(coord, worldId))) {
      missingChunksToLoad.push(coord)
    }
  }
  return missingChunksToLoad
}

export const selectChunkLoadBatch = (
  missingChunksToLoad: ReadonlyArray<ChunkCoord>,
  renderDistance: number,
  eager: boolean = false,
): ReadonlyArray<ChunkCoord> =>
  !eager && renderDistance >= CHUNK_LOAD_BATCHING_MIN_RENDER_DISTANCE
    ? missingChunksToLoad.slice(0, MAX_CHUNK_LOADS_PER_CALL)
    : missingChunksToLoad

export const collectChunksToUnload = (
  state: ChunkCache,
  centerChunk: ChunkCoord,
  renderDistance: number,
): ReadonlyArray<ChunkCacheEntry> => {
  const chunksToUnload: Array<ChunkCacheEntry> = []
  const maxDistance = (renderDistance + 2) * (renderDistance + 2)
  for (const entry of HashMap.values(state.chunks)) {
    if (chunkDistanceSquared(entry.chunk.coord, centerChunk) > maxDistance) {
      chunksToUnload.push(entry)
    }
  }
  return chunksToUnload
}
