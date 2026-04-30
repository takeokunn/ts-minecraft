import { Array as Arr, Cause, Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import { DEFAULT_PLAYER_ID } from '@/application/constants'
import type { Chunk } from '@/domain/chunk'
import { CHUNK_SIZE } from '@/domain/chunk'
import { FALLBACK_PLAYER_POS, MAX_DIRTY_CHUNK_UPDATES_PER_FRAME, DIRTY_CHUNK_FLUSH_CONCURRENCY } from '@/frame-handler.config'
import type { FrameHandlerDeps, FrameHandlerServices } from '@/frame-handler'
import type { DeltaTimeSecs } from '@/shared/kernel'

type MaintenanceState = {
  readonly lastLoadedChunksRef: Ref.Ref<Option.Option<ReadonlyArray<Chunk>>>
  readonly lastChunkStreamingRef: MutableRef.MutableRef<{ readonly cx: number; readonly cz: number; readonly renderDistance: number }>
  readonly chunkSyncPendingRef: MutableRef.MutableRef<boolean>
  readonly dirtyChunksRef: Ref.Ref<HashMap.HashMap<string, Chunk>>
}

type MaintenanceServices = Pick<
  FrameHandlerServices,
  'gameState' | 'chunkManagerService' | 'settingsService' | 'worldRendererService' | 'fluidService' | 'blockHighlight' | 'furnaceService' | 'mobSpawner' | 'villageService' | 'timeService'
>

export const createMaintenanceHandler = (
  deps: Pick<FrameHandlerDeps, 'scene'>,
  services: MaintenanceServices,
  state: MaintenanceState,
): (() => Effect.Effect<boolean, never>) =>
  () =>
    Effect.gen(function* () {
      const {
        gameState,
        chunkManagerService,
        settingsService,
        worldRendererService,
        fluidService,
        blockHighlight,
        furnaceService,
        mobSpawner,
        villageService,
        timeService,
      } = services

      const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
        Effect.catchAllCause(() => Effect.succeed(FALLBACK_PLAYER_POS)),
      )
      const timeOfDay = yield* timeService.getTimeOfDay().pipe(
        Effect.catchAllCause(() => Effect.succeed(0.5)),
      )
      const currentSettings = yield* settingsService.getSettings()
      const cx = Math.floor(playerPos.x / CHUNK_SIZE)
      const cz = Math.floor(playerPos.z / CHUNK_SIZE)
      const maintenanceDeltaTime = 0.05 as DeltaTimeSecs

      yield* furnaceService.tick(maintenanceDeltaTime).pipe(Effect.catchAllCause(() => Effect.void))
      yield* mobSpawner.trySpawn(playerPos).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Mob spawn error: ${Cause.pretty(cause)}`)),
      )
      yield* villageService.update(playerPos, timeOfDay, maintenanceDeltaTime).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Village system error: ${Cause.pretty(cause)}`)),
      )

      let didWork = false
      const chunkSyncPending = MutableRef.get(state.chunkSyncPendingRef)
      const { cx: lastCx, cz: lastCz, renderDistance: lastRenderDistance } = MutableRef.get(state.lastChunkStreamingRef)
      const shouldRefreshChunks = chunkSyncPending || lastCx !== cx || lastCz !== cz || lastRenderDistance !== currentSettings.renderDistance

      if (shouldRefreshChunks) {
        didWork = true
        const didLoadChunks = yield* chunkManagerService.loadChunksAroundPlayer(playerPos, currentSettings.renderDistance)
        const loadedChunks = yield* chunkManagerService.getLoadedChunks()
        const lastLoadedChunks = yield* Ref.get(state.lastLoadedChunksRef)
        const chunksChanged = Option.match(lastLoadedChunks, {
          onNone: () => true,
          onSome: (previousLoadedChunks) => previousLoadedChunks !== loadedChunks,
        })
        const shouldSyncWorld = chunkSyncPending || chunksChanged

        if (shouldSyncWorld) {
          const fullySynced = yield* worldRendererService.syncChunksToScene(loadedChunks, deps.scene)

          if (chunksChanged) {
            yield* fluidService.syncLoadedChunks(loadedChunks)
            yield* blockHighlight.invalidateCache()
          }

          if (fullySynced) {
            if (chunksChanged) {
              yield* Ref.set(state.lastLoadedChunksRef, Option.some(loadedChunks))
            }
            MutableRef.set(state.chunkSyncPendingRef, false)
          } else {
            MutableRef.set(state.chunkSyncPendingRef, true)
          }
        }

        if (didLoadChunks) {
          MutableRef.set(state.lastChunkStreamingRef, { cx, cz, renderDistance: currentSettings.renderDistance })
        }
      }

      const flushedDirtyChunkCount = yield* Ref.getAndSet(state.dirtyChunksRef, HashMap.empty()).pipe(
        Effect.flatMap((dirtyChunks) => {
          const dirtyEntries = Arr.fromIterable(dirtyChunks)
          const chunksToUpdate = Arr.take(dirtyEntries, MAX_DIRTY_CHUNK_UPDATES_PER_FRAME)
          const remainingEntries = Arr.drop(dirtyEntries, MAX_DIRTY_CHUNK_UPDATES_PER_FRAME)

          const flushUpdates = Effect.forEach(
            chunksToUpdate,
            ([, chunk]) => worldRendererService.updateChunkInScene(chunk, deps.scene),
            { concurrency: DIRTY_CHUNK_FLUSH_CONCURRENCY, discard: true },
          )

          const requeueRemaining = remainingEntries.length > 0
            ? Ref.update(
                state.dirtyChunksRef,
                (current) => Arr.reduce(remainingEntries, current, (acc, [key, chunk]) => HashMap.set(acc, key, chunk)),
              )
            : Effect.void

          return flushUpdates.pipe(
            Effect.andThen(requeueRemaining),
            Effect.andThen(dirtyEntries.length > 0 ? blockHighlight.invalidateCache() : Effect.void),
            Effect.as(dirtyEntries.length),
          )
        }),
      )

      return didWork || chunkSyncPending || flushedDirtyChunkCount > 0
    }).pipe(
      Effect.catchAllCause((cause) => Effect.logError(`Chunk maintenance error: ${Cause.pretty(cause)}`).pipe(Effect.as(true))),
    )
