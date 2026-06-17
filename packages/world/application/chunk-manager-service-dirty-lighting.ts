import type { DirtyVoxel } from '../domain/light-engine-model'
import type { ChunkCacheEntry } from './chunk-manager-cache'

export type DirtyLightingPlan =
  | {
      readonly _tag: 'incremental'
      readonly dirtyVoxels: ReadonlyArray<DirtyVoxel>
    }
  | {
      readonly _tag: 'full'
    }

export const resolveDirtyLightingPlan = (
  entry: ChunkCacheEntry,
  dirtyVoxels?: ReadonlyArray<DirtyVoxel>,
): DirtyLightingPlan => {
  const canUseIncrementalLighting =
    entry.chunk.skyLight !== undefined &&
    entry.chunk.blockLight !== undefined &&
    dirtyVoxels !== undefined &&
    dirtyVoxels.length > 0

  return canUseIncrementalLighting
    ? { _tag: 'incremental', dirtyVoxels }
    : { _tag: 'full' }
}
