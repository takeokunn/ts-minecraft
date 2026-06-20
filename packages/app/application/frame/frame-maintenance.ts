import { Cause, Clock, Effect, HashMap, MutableRef, Option } from 'effect'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import type { Chunk } from '@ts-minecraft/world'
import { FALLBACK_PLAYER_POS } from '@ts-minecraft/app/frame-handler.config'
import type { FrameHandlerDeps } from '@ts-minecraft/app/application/frame/types/deps'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import type { DeltaTimeSecs } from '@ts-minecraft/core'
import { runMaintenanceSimulation } from './frame-maintenance-simulation'
import { runMaintenanceSync } from './frame-maintenance-sync'
import { shouldContinueMaintenanceCycle } from './frame-maintenance-cycle.plan'
import type { DirtyChunkEntry } from './frame-maintenance-dirty'
import { resolveMaintenanceContext } from './frame-maintenance-context'

type MaintenanceState = {
  readonly lastLoadedChunksRef: MutableRef.MutableRef<Option.Option<ReadonlyArray<Chunk>>>
  readonly lastChunkStreamingRef: MutableRef.MutableRef<{ readonly cx: number; readonly cz: number; readonly renderDistance: number }>
  readonly chunkSyncPendingRef: MutableRef.MutableRef<boolean>
  readonly dirtyChunksRef: MutableRef.MutableRef<HashMap.HashMap<string, DirtyChunkEntry>>
  // Accumulated maintenance-tick time for crop growth; fires tickAll() every CROP_GROWTH_INTERVAL_SECS.
  readonly cropTickAccumulatorRef: MutableRef.MutableRef<number>
  // Wall-clock ms of the previous maintenance iteration, so the real elapsed delta
  // (not a hardcoded constant) drives furnace/crop/village simulation. Sentinel < 0
  // means "first call". The maintenance loop sleeps 16ms (busy) or 48ms (idle) plus
  // its own execution time, so the true cadence is variable and must be measured.
  readonly lastMaintenanceTimeMsRef: MutableRef.MutableRef<number>
}

type MaintenanceServices = Pick<
  FrameHandlerServices,
  'entityManager' | 'gameState' | 'chunkManagerService' | 'settingsService' | 'worldRendererService' | 'fluidService' | 'blockHighlight' | 'furnaceService' | 'mobSpawner' | 'villageService' | 'timeService' | 'debugFeatureFlags' | 'blockService' | 'cropGrowthService' | 'weatherService' | 'biomeService'
>

export const computeMaintenanceDeltaTime = (
  lastMaintenanceTimeMs: number,
  nowMs: number,
): DeltaTimeSecs => {
  const rawMaintenanceDelta = lastMaintenanceTimeMs < 0 ? 0.05 : (nowMs - lastMaintenanceTimeMs) / 1000
  return Math.min(Math.max(rawMaintenanceDelta, 0.001), 0.25) as DeltaTimeSecs
}

const runMaintenanceCycle = (
  deps: Pick<FrameHandlerDeps, 'scene'>,
  services: MaintenanceServices,
  state: MaintenanceState,
): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    const {
      gameState,
      settingsService,
      debugFeatureFlags,
    } = services

    const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
      Effect.catchAllCause(() => Effect.succeed(FALLBACK_PLAYER_POS)),
    )
    const currentSettings = yield* settingsService.getSettings()
    const debugFlags = yield* debugFeatureFlags.getFlags()
    const {
      mobsEnabled,
      mobsSpawnEnabled,
      furnaceEnabled,
      villageEnabled,
      chunkStreamingEnabled,
      chunkSceneSyncEnabled,
      dirtyChunkFlushEnabled,
      cx,
      cz,
    } = resolveMaintenanceContext({
      playerPos,
      difficulty: currentSettings.difficulty,
      debugFlags,
    })
    // Real elapsed time since the previous maintenance iteration. The loop's sleep
    // is 16ms (busy) or 48ms (idle) + handler execution, so a fixed 0.05 made
    // furnace/crop/village run faster under load and frame-rate dependently. First
    // call falls back to ~0.05 (the idle cadence). Clamp: floor avoids a divide-by-
    // tiny spike; the 0.25 cap stops a background-tab pause from dumping a huge
    // backlog into the simulation on resume.
    const nowMs = yield* Clock.currentTimeMillis
    const lastMaintenanceMs = MutableRef.get(state.lastMaintenanceTimeMsRef)
    MutableRef.set(state.lastMaintenanceTimeMsRef, nowMs)
    const maintenanceDeltaTime = computeMaintenanceDeltaTime(lastMaintenanceMs, nowMs)
    const simulationResult = yield* runMaintenanceSimulation(
      services,
      state,
      {
        mobsEnabled,
        mobsSpawnEnabled,
        furnaceEnabled,
        villageEnabled,
        playerPos,
        maintenanceDeltaTime,
      },
    )
    const { didLoadChunks, flushedDirtyChunkCount } = yield* runMaintenanceSync(
      deps,
      services,
      state,
      {
        chunkStreamingEnabled,
        chunkSceneSyncEnabled,
        dirtyChunkFlushEnabled,
        cx,
        cz,
        playerPos,
        renderDistance: currentSettings.renderDistance,
      },
    )
    const chunkSyncPending = MutableRef.get(state.chunkSyncPendingRef)

    /* c8 ignore next */
    return shouldContinueMaintenanceCycle({
      didLoadChunks,
      chunkSyncPending,
      flushedDirtyChunkCount,
      simulationResult,
    })
  })

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
      return yield* runMaintenanceCycle(deps, services, state)
    }).pipe(
      Effect.catchAllCause((cause) =>
        Effect.gen(function* () {
          /* c8 ignore next */
          yield* Effect.logError(`Chunk maintenance error: ${Cause.pretty(cause)}`)
          return true
        })
      ),
    )
