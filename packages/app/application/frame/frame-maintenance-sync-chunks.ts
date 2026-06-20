import { Cause, Effect, MutableRef, Option } from 'effect'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { Chunk } from '@ts-minecraft/world'
import {
  resolveMaintenanceChunkSceneSyncPlan,
  resolveMaintenanceChunkSyncPlan,
  type MaintenanceChunkSyncInput,
} from './frame-maintenance-sync-chunks.plan'

type MaintenanceChunkSyncState = {
  readonly lastLoadedChunksRef: MutableRef.MutableRef<Option.Option<ReadonlyArray<Chunk>>>
  readonly lastChunkStreamingRef: MutableRef.MutableRef<{ readonly cx: number; readonly cz: number; readonly renderDistance: number }>
  readonly chunkSyncPendingRef: MutableRef.MutableRef<boolean>
}

type MaintenanceChunkSyncServices = Pick<
  FrameHandlerServices,
  'chunkManagerService' | 'worldRendererService' | 'fluidService' | 'blockHighlight'
>

export const runMaintenanceChunkSceneSync = (
  deps: Pick<FrameHandlerDeps, 'scene'>,
  services: MaintenanceChunkSyncServices,
  state: MaintenanceChunkSyncState,
  input: MaintenanceChunkSyncInput,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const { chunkManagerService, worldRendererService, fluidService, blockHighlight } = services

    const chunkSyncPending = MutableRef.get(state.chunkSyncPendingRef)
    const lastChunkStreaming = MutableRef.get(state.lastChunkStreamingRef)
    const { shouldRefreshChunks } = resolveMaintenanceChunkSyncPlan(input, chunkSyncPending, lastChunkStreaming)

    let didLoadChunks = false
    if (!shouldRefreshChunks) {
      return didLoadChunks
    }

    const chunkLoadResult = chunkSyncPending
      ? false
      : yield* chunkManagerService.loadChunksAroundPlayer(input.playerPos, input.renderDistance).pipe(
          Effect.catchAllCause((cause) =>
            Effect.logError(`Chunk streaming error: ${Cause.pretty(cause)}`).pipe(
              Effect.as(false),
            ),
          ),
        )
    didLoadChunks = chunkLoadResult !== false

    if (input.chunkSceneSyncEnabled) {
      const loadedChunks = yield* chunkManagerService.getLoadedChunks()
      const lastLoadedChunks = MutableRef.get(state.lastLoadedChunksRef)
      const { chunksChanged, shouldSyncWorld } = resolveMaintenanceChunkSceneSyncPlan(
        chunkSyncPending,
        lastLoadedChunks,
        loadedChunks,
      )

      if (shouldSyncWorld) {
        const fullySynced = yield* worldRendererService.syncChunksToScene(loadedChunks, deps.scene)

        if (chunksChanged) {
          yield* fluidService.syncLoadedChunks(loadedChunks)
          yield* blockHighlight.invalidateCache()
        }

        if (fullySynced) {
          if (chunksChanged) {
            MutableRef.set(state.lastLoadedChunksRef, Option.some(loadedChunks))
          }
          MutableRef.set(state.chunkSyncPendingRef, false)
        } else {
          MutableRef.set(state.chunkSyncPendingRef, true)
        }
      }
    }

    if (didLoadChunks) {
      MutableRef.set(state.lastChunkStreamingRef, { cx: input.cx, cz: input.cz, renderDistance: input.renderDistance })
    }

    return didLoadChunks
  })
