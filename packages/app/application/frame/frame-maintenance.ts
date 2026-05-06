import { Array as Arr, Cause, Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/kernel'
import type { Chunk } from '@ts-minecraft/terrain'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/terrain'
import { DESPAWN_DISTANCE, MOB_HALF_HEIGHT } from '@ts-minecraft/entities'
import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/kernel'
import { FALLBACK_PLAYER_POS, MAX_DIRTY_CHUNK_UPDATES_PER_FRAME, DIRTY_CHUNK_FLUSH_CONCURRENCY } from '@ts-minecraft/app/frame-handler.config'
import type { FrameHandlerDeps, FrameHandlerServices } from '@ts-minecraft/app/frame-handler'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/kernel'

type MaintenanceState = {
  readonly lastLoadedChunksRef: Ref.Ref<Option.Option<ReadonlyArray<Chunk>>>
  readonly lastChunkStreamingRef: MutableRef.MutableRef<{ readonly cx: number; readonly cz: number; readonly renderDistance: number }>
  readonly chunkSyncPendingRef: MutableRef.MutableRef<boolean>
  readonly dirtyChunksRef: Ref.Ref<HashMap.HashMap<string, Chunk>>
}

type MaintenanceServices = Pick<
  FrameHandlerServices,
  'entityManager' | 'gameState' | 'chunkManagerService' | 'settingsService' | 'worldRendererService' | 'fluidService' | 'blockHighlight' | 'furnaceService' | 'mobSpawner' | 'villageService' | 'timeService' | 'debugFeatureFlags'
>

const resolveTerrainSpawnPosition = (
  chunk: Chunk,
  candidatePosition: Position,
): Option.Option<Position> => {
  const blockX = Math.floor(candidatePosition.x)
  const blockZ = Math.floor(candidatePosition.z)
  const lx = ((blockX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
  const lz = ((blockZ % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE

  for (let y = CHUNK_HEIGHT - 1; y >= 0; y -= 1) {
    const blockIndex = chunkBlockIndexUnchecked(lx, y, lz)
    if ((chunk.blocks[blockIndex] ?? 0) === 0) {
      continue
    }

    const bodyBlockY = y + 1
    const headBlockY = y + 2
    if (headBlockY >= CHUNK_HEIGHT) {
      return Option.none()
    }

    const bodyBlockIndex = chunkBlockIndexUnchecked(lx, bodyBlockY, lz)
    const headBlockIndex = chunkBlockIndexUnchecked(lx, headBlockY, lz)
    if ((chunk.blocks[bodyBlockIndex] ?? 0) !== 0 || (chunk.blocks[headBlockIndex] ?? 0) !== 0) {
      return Option.none()
    }

    return Option.some({
      x: candidatePosition.x,
      y: bodyBlockY + MOB_HALF_HEIGHT,
      z: candidatePosition.z,
    })
  }

  return Option.none()
}

export const createMaintenanceHandler = (
  deps: Pick<FrameHandlerDeps, 'scene' | 'sessionPausedRef'>,
  services: MaintenanceServices,
  state: MaintenanceState,
): (() => Effect.Effect<boolean, never>) =>
  () =>
    Effect.gen(function* () {
      // FR-1.4: gate ALL maintenance work behind session-pause. Auto-save
      // continues to run because it lives on its own forkDaemon (in main.ts /
      // bootProgram), not in this handler.
      if (MutableRef.get(deps.sessionPausedRef)) {
        return false
      }
      const {
        entityManager,
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
        debugFeatureFlags,
      } = services

      const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
        Effect.catchAllCause(() => Effect.succeed(FALLBACK_PLAYER_POS)),
      )
      const timeOfDay = yield* timeService.getTimeOfDay().pipe(
        Effect.catchAllCause(() => Effect.succeed(0.5)),
      )
      const currentSettings = yield* settingsService.getSettings()
      const debugFlags = yield* debugFeatureFlags.getFlags()
      const mobsEnabled = debugFlags['mobs.enabled']
      const mobsSpawnEnabled = mobsEnabled && debugFlags['mobs.spawn']
      const furnaceEnabled = debugFlags['simulation.furnace']
      const villageEnabled = debugFlags['simulation.village']
      const chunkStreamingEnabled = debugFlags['world.chunkStreaming']
      const chunkSceneSyncEnabled = debugFlags['world.chunkSceneSync']
      const dirtyChunkFlushEnabled = chunkSceneSyncEnabled && debugFlags['world.dirtyChunkFlush']
      const cx = Math.floor(playerPos.x / CHUNK_SIZE)
      const cz = Math.floor(playerPos.z / CHUNK_SIZE)
      const maintenanceDeltaTime = 0.05 as DeltaTimeSecs
      const despawnFarEntities = entityManager.despawnFarEntities
      const despawnAllEntities = entityManager.despawnAllEntities

      const despawnedCount = mobsEnabled
        ? typeof despawnFarEntities === 'function'
          ? yield* despawnFarEntities(playerPos, DESPAWN_DISTANCE)
          : 0
        : typeof despawnAllEntities === 'function'
          ? yield* despawnAllEntities()
          : 0

      if (furnaceEnabled) {
        yield* furnaceService.tick(maintenanceDeltaTime).pipe(Effect.catchAllCause(() => Effect.void))
      }
      const spawnResult = mobsSpawnEnabled
        ? yield* mobSpawner.trySpawn(
            playerPos,
            (candidatePosition: Position) => {
              const chunkCoord = {
                x: Math.floor(Math.floor(candidatePosition.x) / CHUNK_SIZE),
                z: Math.floor(Math.floor(candidatePosition.z) / CHUNK_SIZE),
              }

              return chunkManagerService.getChunk(chunkCoord).pipe(
                Effect.map((chunk) => resolveTerrainSpawnPosition(chunk, candidatePosition)),
                Effect.catchAllCause(() => Effect.succeed(Option.none<Position>())),
              )
            },
          ).pipe(
            Effect.catchAllCause((cause) =>
              Effect.logError(`Mob spawn error: ${Cause.pretty(cause)}`).pipe(
                Effect.as(Option.none()),
              ),
            ),
          )
        : Option.none()
      if (villageEnabled) {
        yield* villageService.update(playerPos, timeOfDay, maintenanceDeltaTime).pipe(
          Effect.catchAllCause((cause) => Effect.logError(`Village system error: ${Cause.pretty(cause)}`)),
        )
      }

      const chunkSyncPending = MutableRef.get(state.chunkSyncPendingRef)
      const { cx: lastCx, cz: lastCz, renderDistance: lastRenderDistance } = MutableRef.get(state.lastChunkStreamingRef)
      /* c8 ignore next */
      const shouldRefreshChunks = chunkStreamingEnabled && (chunkSyncPending || lastCx !== cx || lastCz !== cz || lastRenderDistance !== currentSettings.renderDistance)

      if (shouldRefreshChunks) {
        const didLoadChunks = chunkSyncPending
          ? false
          : yield* chunkManagerService.loadChunksAroundPlayer(playerPos, currentSettings.renderDistance)
        if (chunkSceneSyncEnabled) {
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
        }

        if (didLoadChunks) {
          MutableRef.set(state.lastChunkStreamingRef, { cx, cz, renderDistance: currentSettings.renderDistance })
        }
      }

      const renderDirtyChunks = dirtyChunkFlushEnabled
        ? yield* chunkManagerService.drainRenderDirtyChunks()
        : []
      if (renderDirtyChunks.length > 0) {
        yield* Ref.update(
          state.dirtyChunksRef,
          (current) => Arr.reduce(
            renderDirtyChunks,
            current,
            (acc, chunk) => HashMap.set(acc, `${chunk.coord.x},${chunk.coord.z}`, chunk),
          ),
        )
      }

      const flushedDirtyChunkCount = dirtyChunkFlushEnabled
        ? yield* Ref.getAndSet(state.dirtyChunksRef, HashMap.empty()).pipe(
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
        : 0

      /* c8 ignore next */
      return shouldRefreshChunks || chunkSyncPending || flushedDirtyChunkCount > 0 || despawnedCount > 0 || Option.isSome(spawnResult)
    }).pipe(
      Effect.catchAllCause((cause) => Effect.logError(`Chunk maintenance error: ${Cause.pretty(cause)}`).pipe(Effect.as(true))),
    )
