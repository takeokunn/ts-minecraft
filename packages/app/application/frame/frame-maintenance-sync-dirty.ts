import { Effect, HashMap, MutableRef, Option } from 'effect'
import type { FrameHandlerDeps, FrameHandlerServices } from '@ts-minecraft/app/frame/types'
import { MAX_DIRTY_CHUNK_UPDATES_PER_FRAME } from '@ts-minecraft/app/frame-handler.config'
import { mergeDirtyChunkEntries, splitDirtyChunksForFlush, type DirtyChunkEntry } from './frame-maintenance-dirty'

type MaintenanceDirtyFlushState = {
  readonly dirtyChunksRef: MutableRef.MutableRef<HashMap.HashMap<string, DirtyChunkEntry>>
}

type MaintenanceDirtyFlushServices = Pick<
  FrameHandlerServices,
  'chunkManagerService' | 'worldRendererService' | 'blockHighlight'
>

export const queueDirtyChunkEntries = (
  dirtyChunks: HashMap.HashMap<string, DirtyChunkEntry>,
  renderDirtyEntries: ReadonlyArray<DirtyChunkEntry>,
): HashMap.HashMap<string, DirtyChunkEntry> =>
  renderDirtyEntries.length > 0
    ? mergeDirtyChunkEntries(dirtyChunks, renderDirtyEntries)
    : dirtyChunks

export const restoreRemainingDirtyChunkEntries = (
  dirtyChunks: HashMap.HashMap<string, DirtyChunkEntry>,
  remainingEntries: HashMap.HashMap<string, DirtyChunkEntry>,
): HashMap.HashMap<string, DirtyChunkEntry> => {
  if (HashMap.size(remainingEntries) === 0) {
    return dirtyChunks
  }

  let nextDirtyChunks = dirtyChunks
  for (const [key, entry] of remainingEntries) {
    nextDirtyChunks = HashMap.set(nextDirtyChunks, key, entry)
  }
  return nextDirtyChunks
}

export const runMaintenanceDirtyChunkFlush = (
  deps: Pick<FrameHandlerDeps, 'scene'>,
  services: MaintenanceDirtyFlushServices,
  state: MaintenanceDirtyFlushState,
  dirtyChunkFlushEnabled: boolean,
): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    const { chunkManagerService, worldRendererService, blockHighlight } = services

    const renderDirtyEntries = dirtyChunkFlushEnabled
      ? yield* chunkManagerService.drainRenderDirtyChunkEntries()
      : []
    MutableRef.set(
      state.dirtyChunksRef,
      queueDirtyChunkEntries(MutableRef.get(state.dirtyChunksRef), renderDirtyEntries),
    )

    if (!dirtyChunkFlushEnabled) {
      return 0
    }

    const dirtyChunks = MutableRef.get(state.dirtyChunksRef)
    MutableRef.set(state.dirtyChunksRef, HashMap.empty())
    const { chunksToUpdate, remainingEntries, totalCount } = splitDirtyChunksForFlush(
      dirtyChunks,
      MAX_DIRTY_CHUNK_UPDATES_PER_FRAME,
    )

    // Sequential: maintenance path with per-frame cap (MAX_DIRTY_CHUNK_UPDATES_PER_FRAME).
    // Individual yield* avoids fiber overhead on the bounded maintenance loop.
    for (const [, entry] of chunksToUpdate) {
      yield* worldRendererService.updateChunkInScene(
        entry.chunk,
        deps.scene,
        Option.getOrUndefined(entry.dirtyAABB),
      )
    }

    if (HashMap.size(remainingEntries) > 0) {
      MutableRef.set(
        state.dirtyChunksRef,
        restoreRemainingDirtyChunkEntries(MutableRef.get(state.dirtyChunksRef), remainingEntries),
      )
    }

    if (totalCount > 0) {
      yield* blockHighlight.invalidateCache()
    }

    return totalCount
  })
