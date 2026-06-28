import { Effect } from 'effect'

import { createFrameHandlers } from '@ts-minecraft/app/frame-handler'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import { wrapFrameHandlerWithBrowserEffects } from '@ts-minecraft/app/main/browser-runtime-effects'
import { createDomAutoSaveStatusReporter } from '@ts-minecraft/app/main/session-autosave-status'
import { assembleFrameHandlerDeps } from '@ts-minecraft/app/main/session-runtime-deps/frame-handler'
import { installSessionRuntimeOverlays } from '@ts-minecraft/app/main/session-runtime-overlays'
import type { SessionRuntimeParams } from '@ts-minecraft/app/main/session-runtime-types'

// Builds frame handlers, then wraps the frame handler with browser-event side
// effects. Per-session overlays are mounted by session-runtime-overlays.ts.
//
// Returns the wrapped frame handler (ready for GameLoopService.start) and the
// maintenance handler (ready for GameLoopService.startMaintenance).
export const buildSessionRuntime = (
  params: SessionRuntimeParams,
  services: FrameHandlerServices,
) =>
  Effect.gen(function* () {
    const {
      rendering: {
        renderer,
        camera,
        composerRT,
        composer,
        gtaoPass,
        bloomPass,
        bokehPass,
        godRaysPass,
        smaaPass,
      },
      hud: { autoSaveStatusElement },
      state: { pendingResizeRef, pendingSaveDirtyChunksRef, persistSessionState },
    } = params

    const {
      chunkManagerService,
      settingsService,
      worldRendererService,
    } = services

    const frameHandlerDeps = assembleFrameHandlerDeps(params)
    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(frameHandlerDeps, services)

    yield* installSessionRuntimeOverlays(params, services)

    const frameHandlerWithBrowserEvents = wrapFrameHandlerWithBrowserEffects({
      pendingResizeRef,
      pendingSaveDirtyChunksRef,
      chunkManagerService,
      persistSessionState: persistSessionState().pipe(Effect.catchAllCause(() => Effect.void)),
      reportAutoSaveStatus: createDomAutoSaveStatusReporter(autoSaveStatusElement),
      settingsService,
      renderer,
      camera,
      composer,
      composerRT,
      worldRendererService,
      gtaoPass,
      bloomPass,
      bokehPass,
      smaaPass,
      godRaysPass,
      frameHandler,
    })

    return { frameHandlerWithBrowserEvents, maintenanceHandler }
  })
