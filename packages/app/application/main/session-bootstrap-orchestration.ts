import { Cause, Effect, MutableRef, Option } from 'effect'

import type { SessionBootstrapDeps } from '@ts-minecraft/app/main/session-bootstrap-types/deps'
import { buildLighting } from '@ts-minecraft/app/main/session-lighting'
import { buildSessionRuntimeBundle } from '@ts-minecraft/app/main/session-bootstrap-runtime'
import { buildSessionBootstrapWorldOrchestration } from '@ts-minecraft/app/main/session-bootstrap-world-orchestration'
import { buildSessionBootstrapScene } from '@ts-minecraft/app/main/session-bootstrap-scene'
import { buildSpawnSelection } from '@ts-minecraft/app/main/session-world-loader'
import { WorldId } from '@ts-minecraft/core'
import { buildSessionBootstrapStartupState } from '@ts-minecraft/app/main/session-bootstrap/startup'

export const buildSessionBootstrapOrchestration = (deps: SessionBootstrapDeps) =>
  Effect.gen(function* () {
    const {
      bootCtx,
      worldId,
      initialGameMode,
      initialSeed,
      gameLoopService,
      loadingScreen,
      deathScreen,
      services,
    } = deps

    const { rendering, world, gameplay, presentation, inventory, entity, multiplayer } = services
    const { sceneService, cameraService, worldRendererService, particleSystem } = rendering
    const { chunkManagerService, biomeService, cropGrowthService } = world
    const { gameState, timeService, weatherService, gameModeService } = gameplay
    const {
      debugOverlay,
      blockHighlight,
      crosshair,
      controlsHint,
      hotbarRenderer,
      chatPanel,
      connectionPanel,
      playerListPanel,
    } = presentation
    const { recipeService, inventoryService, equipmentService, chestService, furnaceService } = inventory
    const {
      playerCameraState,
      healthService,
      hungerService,
      xpService,
      entityManager,
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

    const { respawnPositionRef, persistSessionState, worldSeed } = yield* buildSessionBootstrapWorldOrchestration({
      state: {
        bootCtx: {
          storageService: bootCtx.storageService,
          noiseService: bootCtx.noiseService,
        },
        worldId,
        initialGameMode,
        ...(initialSeed === undefined ? {} : { initialSeed }),
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
        controlsHint,
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
        entityManager,
      },
    })

    // Record the local terrain seed before any multiplayer connect so the
    // join handshake can carry it (host-seed mismatch warning).
    yield* Option.match(multiplayer.multiplayerService, {
      onNone: () => Effect.void,
      onSome: (multiplayerService) => multiplayerService.setLocalWorldSeed(worldSeed),
    })

    // Multiplayer seed adoption: rebuild the session's terrain from the host's
    // seed under a separate world namespace (the local single-player save is
    // never overwritten), then respawn on the regenerated terrain.
    const adoptHostWorld = (hostSeed: number): Effect.Effect<void, never> =>
      Effect.gen(function* () {
        yield* bootCtx.noiseService.setSeed(hostSeed)
        yield* chunkManagerService.setActiveWorldId(WorldId.make(`${worldId}-mp-${hostSeed}`))
        const spawnSelection = yield* buildSpawnSelection({ x: 0, y: 80, z: 0 }, chunkManagerService)
        MutableRef.set(respawnPositionRef, spawnSelection.position)
        yield* gameState.respawn(spawnSelection.position)
      }).pipe(
        Effect.catchAllCause((cause) =>
          Effect.logError(`Host world adoption failed: ${Cause.pretty(cause)}`),
        ),
      )

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
        chatPanel,
        connectionPanel,
        playerListPanel,
        biomeService,
        recipeService,
        adoptHostWorld,
      },
      services: {
        ...rendering,
        ...world,
        ...gameplay,
        ...presentation,
        ...inventory,
        ...entity,
        ...multiplayer,
      },
    })

    return { bootCtx, gameLoopService, loadingScreen, terrainPool, runtimeParams, runtimeServices, control }
  })
