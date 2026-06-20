import { Effect, Fiber } from 'effect'
import { StartupError, GameLoopService } from '@ts-minecraft/game'
import type { TerrainWorkerPool } from '@ts-minecraft/worker'
import type { LoadingScreenService } from '@ts-minecraft/presentation'
import { installPerfHudCounters } from '@ts-minecraft/rendering'

import { installBrowserEventBridge } from '@ts-minecraft/app/main/browser-runtime'
import { startSessionAutoSaveDaemon } from '@ts-minecraft/app/main/session-autosave'
import type { BootContext } from '@ts-minecraft/app/main/boot'
import { buildSessionRuntime } from '@ts-minecraft/app/main/session-runtime'
import { flushPendingSaves } from '@ts-minecraft/app/main/browser-runtime-save-effects'
import type { SessionRuntimeParams } from '@ts-minecraft/app/main/session-runtime-types'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import { waitForInitialFrameRate } from '@ts-minecraft/app/main/session-loading-gates'
import { QUIT_CLEANUP_TIMEOUT, runBestEffortQuitStep } from '@ts-minecraft/app/main/session-lifecycle-quit'

export type SessionLifecycleStartupDeps = {
  readonly bootCtx: BootContext
  readonly gameLoopService: GameLoopService
  readonly loadingScreen: LoadingScreenService
  readonly terrainPool: TerrainWorkerPool
  readonly runtimeParams: SessionRuntimeParams
  readonly runtimeServices: FrameHandlerServices
}

const startSessionGameLoop = (
  gameLoopService: GameLoopService,
  frameHandlerWithBrowserEvents: Parameters<GameLoopService['start']>[0],
  maintenanceHandler: Parameters<GameLoopService['startMaintenance']>[0],
) =>
  Effect.acquireRelease(
    gameLoopService.start(frameHandlerWithBrowserEvents).pipe(
      Effect.flatMap(() => gameLoopService.startMaintenance(maintenanceHandler)),
    ),
    () => runBestEffortQuitStep(gameLoopService.stop(), QUIT_CLEANUP_TIMEOUT),
  ).pipe(Effect.mapError((cause) => new StartupError({ reason: 'Failed to start game loop', cause })))

const installSessionTelemetryAndAutoSave = ({
  bootCtx,
  runtimeParams,
  runtimeServices,
  terrainPool,
}: Pick<SessionLifecycleStartupDeps, 'bootCtx' | 'runtimeParams' | 'runtimeServices' | 'terrainPool'>) =>
  Effect.gen(function* () {
    yield* installPerfHudCounters(bootCtx.perfHud, runtimeServices.chunkManagerService, () => terrainPool.queueDepth())

    const autoSaveFiber = yield* startSessionAutoSaveDaemon(
      runtimeServices.chunkManagerService.saveDirtyChunks(),
      runtimeParams.state.persistSessionState(),
    )

    yield* Effect.addFinalizer(() =>
      runBestEffortQuitStep(Fiber.interrupt(autoSaveFiber).pipe(Effect.asVoid), QUIT_CLEANUP_TIMEOUT),
    )
  })

export const runSessionLifecycleStartup = ({
  bootCtx,
  gameLoopService,
  loadingScreen,
  terrainPool,
  runtimeParams,
  runtimeServices,
}: SessionLifecycleStartupDeps) =>
  Effect.gen(function* () {
    const { frameHandlerWithBrowserEvents, maintenanceHandler } = yield* buildSessionRuntime(runtimeParams, runtimeServices)

    yield* installBrowserEventBridge({
      canvas: bootCtx.canvas,
      inputPointerLock: runtimeServices.inputService.requestPointerLock(),
      gamePausedRef: runtimeParams.state.gamePausedRef,
      pendingResizeRef: runtimeParams.state.pendingResizeRef,
      pendingSaveDirtyChunksRef: runtimeParams.state.pendingSaveDirtyChunksRef,
      gameLoopService,
      frameHandler: frameHandlerWithBrowserEvents,
      bestEffortSave: flushPendingSaves({
        pendingSaveDirtyChunksRef: runtimeParams.state.pendingSaveDirtyChunksRef,
        chunkManagerService: runtimeServices.chunkManagerService,
        persistSessionState: runtimeParams.state.persistSessionState().pipe(Effect.catchAllCause(() => Effect.void)),
      }),
    })

    yield* Effect.log('Game initialized — inventory, day/night cycle, and settings ready')

    yield* installSessionTelemetryAndAutoSave({
      bootCtx,
      runtimeParams,
      runtimeServices,
      terrainPool,
    })

    yield* startSessionGameLoop(gameLoopService, frameHandlerWithBrowserEvents, maintenanceHandler)

    yield* waitForInitialFrameRate(runtimeParams.hud.fpsElement)
    yield* loadingScreen.hide()
  })
