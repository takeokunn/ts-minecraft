import type { ChunkAABB } from '../domain/chunk-aabb'
import type { DirtyVoxel } from '../domain/light-engine-model'
import type { DirtyBfsResult } from './chunk-manager-service-helpers'
import { dirtyOffsets, editedChunkAABBFromDirty } from './chunk-manager-service-helpers'

export type DirtyChunkSelection = {
  readonly offsets: ReadonlyArray<readonly [number, number]>
  readonly editedChunkAABB: ChunkAABB
}

export const resolveDirtyChunkSelection = (
  dirtyVoxels: ReadonlyArray<DirtyVoxel> | undefined,
  bfsResult: DirtyBfsResult,
): DirtyChunkSelection => {
  const offsets = dirtyOffsets(bfsResult)
  const editedChunkAABB = editedChunkAABBFromDirty(dirtyVoxels, bfsResult)
  return {
    offsets,
    editedChunkAABB,
  }
}
