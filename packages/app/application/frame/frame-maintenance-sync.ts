import { Effect, HashMap, MutableRef, Option } from 'effect'
import type { FrameHandlerDeps, FrameHandlerServices } from '@ts-minecraft/app/frame/types'
import type { Position } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world'
import type { MaintenanceContext } from './frame-maintenance-context'
import type { DirtyChunkEntry } from './frame-maintenance-dirty'
import { runMaintenanceChunkSceneSync } from './frame-maintenance-sync-chunks'
import { runMaintenanceDirtyChunkFlush } from './frame-maintenance-sync-dirty'

type MaintenanceSyncState = {
  readonly lastLoadedChunksRef: MutableRef.MutableRef<Option.Option<ReadonlyArray<Chunk>>>
  readonly lastChunkStreamingRef: MutableRef.MutableRef<{ readonly cx: number; readonly cz: number; readonly renderDistance: number }>
  readonly chunkSyncPendingRef: MutableRef.MutableRef<boolean>
  readonly dirtyChunksRef: MutableRef.MutableRef<HashMap.HashMap<string, DirtyChunkEntry>>
}

type MaintenanceSyncServices = Pick<
  FrameHandlerServices,
  'chunkManagerService' | 'worldRendererService' | 'fluidService' | 'blockHighlight'
>

type MaintenanceSyncInput = Pick<MaintenanceContext, 'chunkStreamingEnabled' | 'chunkSceneSyncEnabled' | 'dirtyChunkFlushEnabled' | 'cx' | 'cz'> & {
  readonly playerPos: Position
  readonly renderDistance: number
}

export type MaintenanceSyncResult = {
  readonly didLoadChunks: boolean
  readonly flushedDirtyChunkCount: number
}

export const runMaintenanceSync = (
  deps: Pick<FrameHandlerDeps, 'scene'>,
  services: MaintenanceSyncServices,
  state: MaintenanceSyncState,
  input: MaintenanceSyncInput,
): Effect.Effect<MaintenanceSyncResult, never> =>
  Effect.gen(function* () {
    const { dirtyChunkFlushEnabled } = input
    const { chunkManagerService, worldRendererService, blockHighlight } = services

    const didLoadChunks = yield* runMaintenanceChunkSceneSync(
      deps,
      { chunkManagerService, worldRendererService, blockHighlight, fluidService: services.fluidService },
      state,
      input,
    )

    const flushedDirtyChunkCount = yield* runMaintenanceDirtyChunkFlush(
      deps,
      { chunkManagerService, worldRendererService, blockHighlight },
      state,
      dirtyChunkFlushEnabled,
    )

    return { didLoadChunks, flushedDirtyChunkCount }
  })
