import { Deferred, Effect } from 'effect'
import type { BootContext } from '@ts-minecraft/app/main/boot'
import type { SessionControl } from '@ts-minecraft/app/main/session-control'
import { SAVE_FLUSH_TIMEOUT, runBestEffortQuitStep } from '@ts-minecraft/app/main/session-lifecycle-quit'
import { runSessionLifecycleStartup, type SessionLifecycleStartupDeps } from '@ts-minecraft/app/main/session-lifecycle-startup'
import type { SessionRuntimeParams } from '@ts-minecraft/app/main/session-runtime-types'
import { GameLoopService } from '@ts-minecraft/game'
import type { TerrainWorkerPool } from '@ts-minecraft/worker'
import type { LoadingScreenService } from '@ts-minecraft/presentation'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

export type SessionLifecycleDeps = {
  readonly bootCtx: BootContext
  readonly gameLoopService: GameLoopService
  readonly loadingScreen: LoadingScreenService
  readonly terrainPool: TerrainWorkerPool
  readonly runtimeParams: SessionRuntimeParams
  readonly runtimeServices: FrameHandlerServices
  readonly control: SessionControl
}

const flushSessionLifecycleShutdownState = ({
  runtimeParams,
  runtimeServices,
}: Pick<SessionLifecycleDeps, 'runtimeParams' | 'runtimeServices'>) =>
  Effect.gen(function* () {
    // Best-effort save flush before tearing down - metadata save runs first so
    // player-position / health / inventory restoration is prioritized for
    // quit-to-title flows, while both stages are time-bounded so a stalled save
    // path cannot trap the user in-session indefinitely.
    yield* runBestEffortQuitStep(
      runtimeParams.state.persistSessionState().pipe(Effect.catchAllCause(() => Effect.void)),
      SAVE_FLUSH_TIMEOUT,
    )
    yield* runBestEffortQuitStep(
      runtimeServices.chunkManagerService.saveDirtyChunks().pipe(Effect.catchAllCause(() => Effect.void)),
      SAVE_FLUSH_TIMEOUT,
    )
  })

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
    yield* runSessionLifecycleStartup({
      bootCtx,
      gameLoopService,
      loadingScreen,
      terrainPool,
      runtimeParams,
      runtimeServices,
    } satisfies SessionLifecycleStartupDeps)

    // Wait until the user requests quit-to-title (signaled by the pause menu via
    // `requestQuitToTitle(control)`). Once fulfilled, the Effect.gen exits and
    // Effect.scoped releases all session resources.
    yield* Deferred.await(control.quitToTitleSignal)

    yield* flushSessionLifecycleShutdownState({ runtimeParams, runtimeServices })

    return { reason: 'quit-to-title' as const, control }
  })
