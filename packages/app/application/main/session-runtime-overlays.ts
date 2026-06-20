import { Effect, type Scope } from 'effect'

import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'
import { installQaApi } from '@ts-minecraft/app/main/qa-api'
import type { SessionRuntimeParams } from '@ts-minecraft/app/main/session-runtime-types'

export const installSessionRuntimeOverlays = (
  params: SessionRuntimeParams,
  services: FrameHandlerServices,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.gen(function* () {
    const {
      rendering: { camera, scene },
      state: { control, respawnPositionRef },
      overlays: { deathScreen, debugOverlay, biomeService, recipeService },
    } = params

    const {
      gameState,
      playerCameraState,
      blockHighlight,
      inputService,
      blockService,
      hotbarService,
      furnaceService,
      inventoryService,
      inventoryRenderer,
      chunkManagerService,
      timeService,
      debugFeatureFlags,
      pauseMenu,
      worldRendererService,
      entityManager,
      fpsCounter,
    } = services

    yield* installQaApi({
      camera,
      scene,
      playerCameraState,
      blockHighlight,
      inputService,
      inventoryService,
      inventoryRenderer,
      gameState,
      timeService,
      chunkManagerService,
      blockService,
      hotbarService,
      recipeService,
      furnaceService,
      worldRendererService,
      entityManager,
      debugFeatureFlags,
    })

    yield* deathScreen.attach(control, respawnPositionRef)

    // FR-1.4: mount the in-session pause menu. Listens for ESC via the
    // frame-handler input stage (which calls `pauseMenu.openIfClosed(control)`)
    // and drives Resume / Settings / Save & Quit. Listeners + DOM are torn
    // down with the surrounding session scope on quit-to-title.
    yield* pauseMenu.attach(control)

    // FR-1.5: mount the F3 debug overlay. Hidden by default; F3 toggles it.
    // The 4 Hz refresh daemon is forked into the session scope so it tears
    // down with quit-to-title.
    yield* debugOverlay.attach({
      biomeService,
      chunkManager: chunkManagerService,
      gameState,
      timeService,
      cameraState: playerCameraState,
      fpsCounter,
      debugFeatureFlags,
    })
  })
