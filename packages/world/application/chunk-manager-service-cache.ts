import { HashMap, HashSet, Option } from 'effect'
import { type ChunkCacheKey, type ChunkCoord, type WorldId } from '@ts-minecraft/core'
import { computeMaxY } from '../domain/chunk'
import { fullChunkAABB, unionAABB, type ChunkAABB } from '../domain/chunk-aabb'
import { chunkCoordToWorldKey } from '../domain/chunk-coord-utils'
import type { ChunkCache } from './chunk-manager-cache'

export const updateLitChunk = (s: ChunkCache, key: ChunkCacheKey, skyLight: Uint8Array, blockLight: Uint8Array): ChunkCache =>
  (() => {
    const e = Option.getOrNull(HashMap.get(s.chunks, key))
    if (e === null) return s
    return { ...s, chunks: HashMap.set(s.chunks, key, { ...e, chunk: { ...e.chunk, skyLight, blockLight, maxY: computeMaxY(e.chunk.blocks) } }) }
  })()

export const markDirtyChunkOffsets = (
  s: ChunkCache,
  offsets: ReadonlyArray<readonly [number, number]>,
  coord: ChunkCoord,
  worldId: WorldId,
  editedKey: ChunkCacheKey,
  editedChunkAABB: ChunkAABB,
): ChunkCache => {
  let dirtyChunks = s.dirtyChunks
  let renderDirtyChunks = s.renderDirtyChunks
  let renderDirtyAABBs = s.renderDirtyAABBs

  for (const [dx, dz] of offsets) {
    const dirtyKey = chunkCoordToWorldKey({ x: coord.x + dx, z: coord.z + dz }, worldId)
    dirtyChunks = HashSet.add(dirtyChunks, dirtyKey)
    renderDirtyChunks = HashSet.add(renderDirtyChunks, dirtyKey)

    const incoming = dirtyKey === editedKey ? editedChunkAABB : fullChunkAABB
    const existing = Option.getOrNull(HashMap.get(renderDirtyAABBs, dirtyKey))
    renderDirtyAABBs = existing === null
      ? HashMap.set(renderDirtyAABBs, dirtyKey, incoming)
      : HashMap.set(renderDirtyAABBs, dirtyKey, unionAABB(existing, incoming))
  }

  return {
    ...s,
    dirtyChunks,
    renderDirtyChunks,
    renderDirtyAABBs,
  }
}
