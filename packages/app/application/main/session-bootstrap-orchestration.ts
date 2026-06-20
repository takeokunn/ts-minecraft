import { Effect } from 'effect'

import type { SessionBootstrapDeps } from '@ts-minecraft/app/main/session-bootstrap-types/deps'
import { buildLighting } from '@ts-minecraft/app/main/session-lighting'
import { buildSessionRuntimeBundle } from '@ts-minecraft/app/main/session-bootstrap-runtime'
import { buildSessionBootstrapWorldOrchestration } from '@ts-minecraft/app/main/session-bootstrap-world-orchestration'
import { buildSessionBootstrapScene } from '@ts-minecraft/app/main/session-bootstrap-scene'
import { buildSessionBootstrapStartupState } from '@ts-minecraft/app/main/session-bootstrap/startup'

export const buildSessionBootstrapOrchestration = (deps: SessionBootstrapDeps) =>
  Effect.gen(function* () {
    const {
      bootCtx,
      worldId,
      initialGameMode,
      gameLoopService,
      loadingScreen,
      deathScreen,
      services,
    } = deps

    const { rendering, world, gameplay, presentation, inventory, entity } = services
    const { sceneService, cameraService, worldRendererService, particleSystem } = rendering
    const { chunkManagerService, biomeService, cropGrowthService } = world
    const { gameState, timeService, weatherService, gameModeService } = gameplay
    const { debugOverlay, blockHighlight, crosshair, hotbarRenderer } = presentation
    const { recipeService, inventoryService, equipmentService, chestService, furnaceService } = inventory
    const {
      playerCameraState,
      healthService,
      hungerService,
      xpService,
    } = entity

    const { canvas, renderer, perfHud, settingsService, soundManager, musicManager, terrainPool } = bootCtx

    const { control, initialSettings, initialGraphics } = yield* buildSessionBootstrapStartupState({ settingsService })

    const { scene, camera, composerRT, composer, gtaoPass, godRaysPass, bloomPass, bokehPass, smaaPass } = yield* buildSessionBootstrapScene({
      renderer,
      canvas,
      sceneService,
      cameraService,
      initialSettings,
      initialGraphics,
    })

    const { respawnPositionRef, persistSessionState } = yield* buildSessionBootstrapWorldOrchestration({
      state: {
        bootCtx: {
          storageService: bootCtx.storageService,
          noiseService: bootCtx.noiseService,
        },
        worldId,
        initialGameMode,
        chunkManagerService,
        gameModeService,
      },
      terrain: {
        bootCtx: {
          terrainPool,
        },
        loadingScreen,
        scene,
        canvas,
        initialSettings,
        worldRendererService,
      },
      presentation: {
        gameState,
        playerCameraState,
        particleSystem,
        blockHighlight,
        hotbarRenderer,
        crosshair,
        timeService,
        inventoryService,
        equipmentService,
        healthService,
        hungerService,
        xpService,
        chestService,
        furnaceService,
        weatherService,
        cropGrowthService,
      },
    })

    const lighting = yield* buildLighting(scene, sceneService, initialSettings, initialGraphics)

    const { runtimeParams, runtimeServices } = yield* buildSessionRuntimeBundle({
      bootCtx: { renderer, perfHud, settingsService, soundManager, musicManager },
      rendering: {
        scene,
        camera,
        composerRT,
        composer,
        gtaoPass,
        bloomPass,
        bokehPass,
        godRaysPass,
        smaaPass,
        lighting,
      },
      state: {
        control,
        respawnPositionRef,
        persistSessionState,
      },
      overlays: {
        deathScreen,
        debugOverlay,
        biomeService,
        recipeService,
      },
      services: {
        ...rendering,
        ...world,
        ...gameplay,
        ...presentation,
        ...inventory,
        ...entity,
      },
    })

    return { bootCtx, gameLoopService, loadingScreen, terrainPool, runtimeParams, runtimeServices, control }
  })
