import { Effect, HashMap, Option, Ref } from 'effect'
import { ChunkCoord } from '@ts-minecraft/core'
import { chunkCoordToWorldKey } from '../domain/chunk-coord-utils'
import type { DirtyVoxel } from '../domain/light-engine-model'
import { type ChunkOpsContext } from './chunk-manager-ops'
import { markDirtyChunkOffsets } from './chunk-manager-service-cache'
import { resolveDirtyChunkSelection } from './chunk-manager-service-dirty-selection'
import { resolveDirtyChunkLighting } from './chunk-manager-service-dirty-update'

export const markChunkDirty = (
  ctx: ChunkOpsContext,
  coord: ChunkCoord,
  dirtyVoxels?: ReadonlyArray<DirtyVoxel>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const worldId = yield* Ref.get(ctx.worldIdRef)
    const key = chunkCoordToWorldKey(coord, worldId)
    const state = yield* Ref.get(ctx.cache)
    const entry = Option.getOrNull(HashMap.get(state.chunks, key))
    const bfsResult = yield* resolveDirtyChunkLighting(ctx, key, entry, dirtyVoxels)
    const { offsets, editedChunkAABB } = resolveDirtyChunkSelection(dirtyVoxels, bfsResult)

    yield* Ref.update(ctx.cache, (s) => markDirtyChunkOffsets(s, offsets, coord, worldId, key, editedChunkAABB))
  })
