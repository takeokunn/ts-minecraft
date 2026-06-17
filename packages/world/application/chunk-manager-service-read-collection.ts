import { HashMap, Option } from 'effect'
import type { Chunk } from '../domain/chunk'
import type { ChunkAABB } from '../domain/chunk-aabb'
import type { ChunkCache, ChunkCacheKey } from './chunk-manager-cache'

export const collectChunks = (state: ChunkCache): ReadonlyArray<Chunk> => {
  const chunks: Array<Chunk> = []
  for (const entry of HashMap.values(state.chunks)) {
    chunks.push(entry.chunk)
  }
  return chunks
}

export const collectDirtyChunks = (
  state: ChunkCache,
  keys: Iterable<ChunkCacheKey>,
): ReadonlyArray<Chunk> => {
  const chunks: Array<Chunk> = []
  for (const key of keys) {
    const entry = Option.getOrNull(HashMap.get(state.chunks, key))
    if (entry !== null) chunks.push(entry.chunk)
  }
  return chunks
}

export const collectDirtyChunkEntries = (
  state: ChunkCache,
  keys: Iterable<ChunkCacheKey>,
  aabbs: HashMap.HashMap<ChunkCacheKey, ChunkAABB>,
): ReadonlyArray<{ readonly chunk: Chunk; readonly dirtyAABB: Option.Option<ChunkAABB> }> => {
  const entries: Array<{ readonly chunk: Chunk; readonly dirtyAABB: Option.Option<ChunkAABB> }> = []
  for (const key of keys) {
    const entry = Option.getOrNull(HashMap.get(state.chunks, key))
    if (entry !== null) {
      entries.push({ chunk: entry.chunk, dirtyAABB: HashMap.get(aabbs, key) })
    }
  }
  return entries
}
