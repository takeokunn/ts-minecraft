import { HashMap, Option } from 'effect'
import type { Chunk, ChunkAABB } from '@ts-minecraft/world'

export type DirtyChunkEntry = { readonly chunk: Chunk; readonly dirtyAABB: Option.Option<ChunkAABB> }

type DirtyChunkFlushBatch = {
  readonly chunksToUpdate: ReadonlyArray<readonly [string, DirtyChunkEntry]>
  readonly remainingEntries: HashMap.HashMap<string, DirtyChunkEntry>
  readonly totalCount: number
}

export const unionDirtyAABB = (
  a: Option.Option<ChunkAABB>,
  b: Option.Option<ChunkAABB>,
): Option.Option<ChunkAABB> =>
  Option.zipWith(a, b, (av, bv) => ({
    minX: Math.min(av.minX, bv.minX), maxX: Math.max(av.maxX, bv.maxX),
    minY: Math.min(av.minY, bv.minY), maxY: Math.max(av.maxY, bv.maxY),
    minZ: Math.min(av.minZ, bv.minZ), maxZ: Math.max(av.maxZ, bv.maxZ),
  }))

const dirtyChunkKey = (chunk: Chunk): string => `${chunk.coord.x},${chunk.coord.z}`

export const mergeDirtyChunkEntries = (
  dirtyChunks: HashMap.HashMap<string, DirtyChunkEntry>,
  incomingEntries: ReadonlyArray<DirtyChunkEntry>,
): HashMap.HashMap<string, DirtyChunkEntry> => {
  let nextDirtyChunks = dirtyChunks

  for (const entry of incomingEntries) {
    const key = dirtyChunkKey(entry.chunk)
    const existing = Option.getOrNull(HashMap.get(nextDirtyChunks, key))
    const dirtyAABB = existing === null
      ? entry.dirtyAABB
      : unionDirtyAABB(existing.dirtyAABB, entry.dirtyAABB)
    nextDirtyChunks = HashMap.set(nextDirtyChunks, key, { chunk: entry.chunk, dirtyAABB })
  }

  return nextDirtyChunks
}

export const splitDirtyChunksForFlush = (
  dirtyChunks: HashMap.HashMap<string, DirtyChunkEntry>,
  maxUpdates: number,
): DirtyChunkFlushBatch => {
  const chunksToUpdate: Array<readonly [string, DirtyChunkEntry]> = []
  let remainingEntries = HashMap.empty<string, DirtyChunkEntry>()
  let totalCount = 0

  for (const [key, entry] of dirtyChunks) {
    if (chunksToUpdate.length < maxUpdates) {
      chunksToUpdate.push([key, entry])
    } else {
      remainingEntries = HashMap.set(remainingEntries, key, entry)
    }
    totalCount += 1
  }

  return { chunksToUpdate, remainingEntries, totalCount }
}
