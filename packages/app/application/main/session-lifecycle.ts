import { Deferred, Duration, Effect, Fiber, Schedule } from 'effect'
import { StartupError, GameLoopService } from '@ts-minecraft/game'
import type { TerrainWorkerPool } from '@ts-minecraft/worker'
import type { LoadingScreenService } from '@ts-minecraft/presentation'
import { installPerfHudCounters } from '@ts-minecraft/rendering'

import { installBrowserEventBridge } from '@ts-minecraft/app/main/browser-runtime'
import { performAutoSaveTick } from '@ts-minecraft/app/main/session-autosave'
import type { BootContext } from '@ts-minecraft/app/main/boot'
import type { SessionControl } from '@ts-minecraft/app/main/session-control'
import { buildSessionRuntime, type SessionRuntimeParams } from '@ts-minecraft/app/main/session-runtime'
import type { FrameHandlerServices } from '@ts-minecraft/app/frame/types'
import { waitForInitialFrameRate } from '@ts-minecraft/app/main/session-loading-gates'

const SAVE_FLUSH_TIMEOUT = Duration.seconds(5)
const QUIT_CLEANUP_TIMEOUT = Duration.seconds(2)

export type SessionLifecycleDeps = {
  readonly bootCtx: BootContext
  readonly gameLoopService: GameLoopService
  readonly loadingScreen: LoadingScreenService
  readonly terrainPool: TerrainWorkerPool
  readonly runtimeParams: SessionRuntimeParams
  readonly runtimeServices: FrameHandlerServices
  readonly control: SessionControl
}

const runBestEffortQuitStep = (
  effect: Effect.Effect<void, unknown, never>,
  timeout: Duration.Duration,
): Effect.Effect<void, never> =>
  Effect.raceFirst(
    effect.pipe(
      Effect.disconnect,
      Effect.catchAllCause(() => Effect.void),
    ),
    Effect.sleep(timeout),
  )

export const runSessionLifecycle = ({
  bootCtx,
  gameLoopService,
  loadingScreen,
  terrainPool,
  runtimeParams,
  runtimeServices,
  control,
}: SessionLifecycleDeps) =>
  Effect.gen(function* () {
    const { frameHandlerWithBrowserEvents, maintenanceHandler } = yield* buildSessionRuntime(runtimeParams, runtimeServices)

    yield* installBrowserEventBridge({
      canvas: bootCtx.canvas,
      inputPointerLock: runtimeServices.inputService.requestPointerLock(),
      gamePausedRef: runtimeParams.gamePausedRef,
      pendingResizeRef: runtimeParams.pendingResizeRef,
      pendingSaveDirtyChunksRef: runtimeParams.pendingSaveDirtyChunksRef,
      gameLoopService,
      frameHandler: frameHandlerWithBrowserEvents,
    })

    yield* Effect.log('Game initialized — inventory, day/night cycle, and settings ready')

    yield* installPerfHudCounters(bootCtx.perfHud, runtimeServices.chunkManagerService, () => terrainPool.queueDepth())

    // Auto-save daemon: spaced (not fixed) Schedule prevents burst on tab-resume.
    // Lives on its own forkDaemon so it continues regardless of pause-state.
    // The fiber is stored and interrupted via addFinalizer so it is cleaned up
    // when the session scope exits (quit-to-title / error unwind).
    const autoSaveFiber = yield* Effect.forkDaemon(
      Effect.repeat(
        performAutoSaveTick(runtimeServices.chunkManagerService.saveDirtyChunks(), runtimeParams.persistSessionState()),
        Schedule.spaced(Duration.seconds(5)),
      ),
    )
    yield* Effect.addFinalizer(() =>
      runBestEffortQuitStep(
        Fiber.interrupt(autoSaveFiber).pipe(Effect.asVoid),
        QUIT_CLEANUP_TIMEOUT,
      )
    )

    yield* Effect.acquireRelease(
      gameLoopService.start(frameHandlerWithBrowserEvents).pipe(
        Effect.flatMap(() => gameLoopService.startMaintenance(maintenanceHandler)),
      ),
      () => runBestEffortQuitStep(gameLoopService.stop(), QUIT_CLEANUP_TIMEOUT),
    ).pipe(
      Effect.mapError((cause) => new StartupError({ reason: 'Failed to start game loop', cause })),
    )

    yield* waitForInitialFrameRate(runtimeParams.fpsElement)
    yield* loadingScreen.hide()

    // Wait until the user requests quit-to-title (signaled by the pause menu via
    // `requestQuitToTitle(control)`). Once fulfilled, the Effect.gen exits and
    // Effect.scoped releases all session resources.
    yield* Deferred.await(control.quitToTitleSignal)

    // Best-effort save flush before tearing down — metadata save runs first so
    // player-position / health / inventory restoration is prioritized for
    // quit-to-title flows, while both stages are time-bounded so a stalled save
    // path cannot trap the user in-session indefinitely.
    yield* runBestEffortQuitStep(
      runtimeParams.persistSessionState().pipe(Effect.catchAllCause(() => Effect.void)),
      SAVE_FLUSH_TIMEOUT,
    )
    yield* runBestEffortQuitStep(
      runtimeServices.chunkManagerService.saveDirtyChunks().pipe(Effect.catchAllCause(() => Effect.void)),
      SAVE_FLUSH_TIMEOUT,
    )

    return { reason: 'quit-to-title' as const, control }
  })
