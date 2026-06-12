import { Array as Arr, Cause, Effect, HashMap, MutableRef, Option, Ref } from 'effect'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import type { Chunk, ChunkAABB } from '@ts-minecraft/world'
import { DESPAWN_DISTANCE, resolveMobSpawnPosition } from '@ts-minecraft/entity'
import type { Village } from '@ts-minecraft/entity'
import { CHUNK_SIZE } from '@ts-minecraft/core'
import { buildingBlocksForVillage } from '@ts-minecraft/entity'
import { FALLBACK_PLAYER_POS, MAX_DIRTY_CHUNK_UPDATES_PER_FRAME, DIRTY_CHUNK_FLUSH_CONCURRENCY } from '@ts-minecraft/app/frame-handler.config'
import { CROP_GROWTH_INTERVAL_SECS } from '@ts-minecraft/world'
import type { FrameHandlerDeps, FrameHandlerServices } from '@ts-minecraft/app/frame/types'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/core'

// FR-4.2: dirty chunks queued for re-mesh now carry their accumulated dirty
// AABB (Option.none() means "full chunk"). Producers (block-handler & the
// chunk-manager drain) supply both fields; the flush step forwards the AABB
// to `worldRendererService.updateChunkInScene`.
export type DirtyChunkEntry = { readonly chunk: Chunk; readonly dirtyAABB: Option.Option<ChunkAABB> }

// Unions two dirty AABBs. Either side being None means "full chunk" (no AABB),
// so None propagates through: union(Some, None) = None, union(None, _) = None.
const unionDirtyAABB = (
  a: Option.Option<ChunkAABB>,
  b: Option.Option<ChunkAABB>,
): Option.Option<ChunkAABB> =>
  Option.zipWith(a, b, (av, bv) => ({
    minX: Math.min(av.minX, bv.minX), maxX: Math.max(av.maxX, bv.maxX),
    minY: Math.min(av.minY, bv.minY), maxY: Math.max(av.maxY, bv.maxY),
    minZ: Math.min(av.minZ, bv.minZ), maxZ: Math.max(av.maxZ, bv.maxZ),
  }))

type MaintenanceState = {
  readonly lastLoadedChunksRef: Ref.Ref<Option.Option<ReadonlyArray<Chunk>>>
  readonly lastChunkStreamingRef: MutableRef.MutableRef<{ readonly cx: number; readonly cz: number; readonly renderDistance: number }>
  readonly chunkSyncPendingRef: MutableRef.MutableRef<boolean>
  readonly dirtyChunksRef: Ref.Ref<HashMap.HashMap<string, DirtyChunkEntry>>
  // Accumulated maintenance-tick time for crop growth; fires tickAll() every CROP_GROWTH_INTERVAL_SECS.
  readonly cropTickAccumulatorRef: MutableRef.MutableRef<number>
}

type MaintenanceServices = Pick<
  FrameHandlerServices,
  'entityManager' | 'gameState' | 'chunkManagerService' | 'settingsService' | 'worldRendererService' | 'fluidService' | 'blockHighlight' | 'furnaceService' | 'mobSpawner' | 'villageService' | 'timeService' | 'debugFeatureFlags' | 'blockService' | 'cropGrowthService'
>


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
        blockService,
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
          /* c8 ignore next -- defensive: despawnAllEntities is always available when mobs disabled */
          : 0

      if (furnaceEnabled) {
        yield* furnaceService.tick(maintenanceDeltaTime).pipe(Effect.catchAllCause(() => Effect.void))
      }

      // Crop growth tick — advance all player-planted crops every CROP_GROWTH_INTERVAL_SECS.
      // Village / world-generated crops are not tracked and default to ripe on break.
      const newCropAcc = MutableRef.get(state.cropTickAccumulatorRef) + Number(maintenanceDeltaTime)
      if (newCropAcc >= CROP_GROWTH_INTERVAL_SECS) {
        MutableRef.set(state.cropTickAccumulatorRef, newCropAcc - CROP_GROWTH_INTERVAL_SECS)
        yield* services.cropGrowthService.tickAll().pipe(Effect.catchAllCause(() => Effect.void))
      } else {
        MutableRef.set(state.cropTickAccumulatorRef, newCropAcc)
      }

      // R25: hostile mobs spawn only at night (per selectMobType); gate their
      // spawn surfaces on darkness. Derived from the already-fetched timeOfDay to
      // match TimeService.isNight (timeOfDay < 0.25 || > 0.75) without an extra call.
      const isNightSpawn = timeOfDay < 0.25 || timeOfDay > 0.75
      const spawnResult = mobsSpawnEnabled
        ? yield* mobSpawner.trySpawn(
            playerPos,
            (candidatePosition: Position) => {
              const chunkCoord = {
                x: Math.floor(Math.floor(candidatePosition.x) / CHUNK_SIZE),
                z: Math.floor(Math.floor(candidatePosition.z) / CHUNK_SIZE),
              }

              return Effect.gen(function* () {
                const chunk = yield* chunkManagerService.getChunk(chunkCoord)
                return resolveMobSpawnPosition(chunk, candidatePosition, isNightSpawn)
              }).pipe(Effect.catchAllCause(() => Effect.succeed(Option.none<Position>())))
            },
          ).pipe(
            /* c8 ignore start */
            Effect.catchAllCause((cause) =>
              Effect.gen(function* () {
                yield* Effect.logError(`Mob spawn error: ${Cause.pretty(cause)}`)
                return Option.none()
              }),
            ),
            /* c8 ignore end */
          )
        : Option.none()
      if (villageEnabled) {
        const villagesBefore = yield* villageService.getVillages()
        const countBefore = villagesBefore.length
        yield* villageService.update(playerPos, timeOfDay, maintenanceDeltaTime).pipe(
          Effect.catchAllCause((cause) => Effect.logError(`Village system error: ${Cause.pretty(cause)}`)),
        )
        const villagesAfter = yield* villageService.getVillages()
        // Build the before-ID set only when the count grew to avoid allocating a
        // Set + temporary array on the common case where no new village was added.
        const newVillages: Village[] = villagesAfter.length > countBefore
          ? (() => {
              const beforeIds = new Set<string>()
              for (const v of villagesBefore) beforeIds.add(v.villageId)
              return villagesAfter.filter((v: Village) => !beforeIds.has(v.villageId))
            })()
          : []
        if (newVillages.length > 0) {
          yield* Effect.forEach(
            newVillages,
            (village: Village) => {
              const placements = buildingBlocksForVillage(village.structures)
              return Effect.forEach(
                placements,
                ({ position, blockType }) => blockService.forceSetBlock(position, blockType).pipe(
                  Effect.catchAll(() => Effect.void),
                ),
                { concurrency: 'unbounded', discard: true },
              )
            },
            { concurrency: 'unbounded', discard: true },
          ).pipe(Effect.catchAllCause(() => Effect.void))
        }
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
          const lastLoadedChunksVal = Option.getOrNull(lastLoadedChunks)
          const chunksChanged = lastLoadedChunksVal === null || lastLoadedChunksVal !== loadedChunks
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

      // FR-4.2: drain render-dirty entries with their accumulated AABBs. If a
      // chunk is already queued (from interaction-block-handler), union the
      // AABBs so the flush sees the widest dirty region for that chunk.
      const renderDirtyEntries = dirtyChunkFlushEnabled
        ? yield* chunkManagerService.drainRenderDirtyChunkEntries()
        : []
      if (renderDirtyEntries.length > 0) {
        yield* Ref.update(
          state.dirtyChunksRef,
          (current) => Arr.reduce(
            renderDirtyEntries,
            current,
            (acc, entry) => {
              const k = `${entry.chunk.coord.x},${entry.chunk.coord.z}`
              const existing = Option.getOrNull(HashMap.get(acc, k))
              // Union new AABB with whatever was already queued. Either side
              // being Option.none() ⇒ full-chunk fallback (Option.none()).
              const dirtyAABB = existing === null
                ? entry.dirtyAABB
                : unionDirtyAABB(existing.dirtyAABB, entry.dirtyAABB)
              return HashMap.set(acc, k, { chunk: entry.chunk, dirtyAABB })
            },
          ),
        )
      }

      let flushedDirtyChunkCount = 0
      if (dirtyChunkFlushEnabled) {
        const dirtyChunks = yield* Ref.getAndSet(state.dirtyChunksRef, HashMap.empty())
        const dirtyEntries = Arr.fromIterable(dirtyChunks)
        const chunksToUpdate = Arr.take(dirtyEntries, MAX_DIRTY_CHUNK_UPDATES_PER_FRAME)
        const remainingEntries = Arr.drop(dirtyEntries, MAX_DIRTY_CHUNK_UPDATES_PER_FRAME)
        yield* Effect.forEach(
          chunksToUpdate,
          ([, entry]) => worldRendererService.updateChunkInScene(
            entry.chunk, deps.scene, Option.getOrUndefined(entry.dirtyAABB),
          ),
          { concurrency: DIRTY_CHUNK_FLUSH_CONCURRENCY, discard: true },
        )
        /* c8 ignore next 4 -- only fires when dirtyChunks > MAX_DIRTY_CHUNK_UPDATES_PER_FRAME; not tested in unit tests */
        if (remainingEntries.length > 0) {
          yield* Ref.update(state.dirtyChunksRef, (current) =>
            Arr.reduce(remainingEntries, current, (acc, [key, entry]) => HashMap.set(acc, key, entry))
          )
        }
        if (dirtyEntries.length > 0) yield* blockHighlight.invalidateCache()
        flushedDirtyChunkCount = dirtyEntries.length
      }

      /* c8 ignore next */
      return shouldRefreshChunks || chunkSyncPending || flushedDirtyChunkCount > 0 || despawnedCount > 0 || Option.isSome(spawnResult)
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.gen(function* () {
          /* c8 ignore next */
          yield* Effect.logError(`Chunk maintenance error: ${Cause.pretty(cause)}`)
          return true
        })
      ),
    )
