import { Effect } from 'effect'

import { CHUNK_HEIGHT, CHUNK_SIZE } from '@ts-minecraft/core'
import { resolvePreset } from '@ts-minecraft/game'

import type { SessionBootstrapDeps } from '@ts-minecraft/app/main/session-bootstrap-types'
import { createSessionControl } from '@ts-minecraft/app/main/session-control'
import { buildPostProcessing } from '@ts-minecraft/app/main/session-post-processing'
import { buildLighting } from '@ts-minecraft/app/main/session-lighting'
import { registerComposerDisposal } from '@ts-minecraft/app/main/session-disposal'
import { buildSessionRuntimeBundle } from '@ts-minecraft/app/main/session-bootstrap-runtime'
import { buildSessionBootstrapWorld } from '@ts-minecraft/app/main/session-bootstrap-world'

export const buildSessionBootstrap = ({
  bootCtx,
  worldId,
  initialGameMode,
  gameLoopService,
  loadingScreen,
  deathScreen,
  services,
}: SessionBootstrapDeps) =>
  Effect.gen(function* () {
    const {
      sceneService,
      cameraService,
      worldRendererService,
      entityRenderer,
      chunkMeshService,
      particleSystem,
      gameState,
      playerCameraState,
      firstPersonCamera,
      thirdPersonCamera,
      crosshair,
      blockHighlight,
      inputService,
      blockService,
      hotbarService,
      hotbarRenderer,
      fpsCounter,
      chunkManagerService,
      biomeService,
      timeService,
      settingsOverlay,
      pauseMenu,
      debugFeatureFlags,
      debugOverlay,
      inventoryRenderer,
      inventoryService,
      equipmentService,
      recipeService,
      healthService,
      hungerService,
      xpService,
      fishingService,
      entityManager,
      mobSpawner,
      villageService,
      tradingPresentation,
      redstoneService,
      cropGrowthService,
      fluidService,
      chestService,
      furnaceService,
      netherService,
      weatherService,
      gameModeService,
    } = services

    const { canvas, renderer, perfHud, settingsService, soundManager, musicManager, terrainPool } = bootCtx

    const control = yield* createSessionControl

    yield* gameModeService.set(initialGameMode)

    const initialSettings = yield* settingsService.getSettings()
    const initialGraphics = resolvePreset(initialSettings.graphicsQuality)

    const scene = yield* sceneService.create()

    const camera = yield* cameraService.create({
      fov: 75,
      aspect: canvas.clientWidth / canvas.clientHeight,
      near: 0.1,
      far: Math.max(initialSettings.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300),
    })

    const { composerRT, composer, gtaoPass, godRaysPass, bloomPass, bokehPass, smaaPass, compositePass } = yield* buildPostProcessing(
      renderer, scene, camera, canvas, initialGraphics,
      { useCompositePass: initialGraphics.useCompositePass },
    )

    yield* registerComposerDisposal(composerRT, composer, [gtaoPass, bloomPass, bokehPass, godRaysPass, smaaPass, compositePass])

    const { respawnPositionRef, persistSessionState } = yield* buildSessionBootstrapWorld({
      bootCtx: {
        storageService: bootCtx.storageService,
        noiseService: bootCtx.noiseService,
        terrainPool: bootCtx.terrainPool,
      },
      worldId,
      initialGameMode,
      initialSettings,
      loadingScreen,
      scene,
      canvas,
      chunkManagerService,
      worldRendererService,
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
      gameModeService,
    })

    const lighting = yield* buildLighting(scene, sceneService, initialSettings, initialGraphics)

    const { runtimeParams, runtimeServices } = yield* buildSessionRuntimeBundle({
      bootCtx: { renderer, perfHud, settingsService, soundManager, musicManager },
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
      control,
      respawnPositionRef,
      persistSessionState,
      deathScreen,
      debugOverlay,
      biomeService,
      recipeService,
      services: {
        sceneService,
        cameraService,
        worldRendererService,
        entityRenderer,
        chunkMeshService,
        particleSystem,
        gameState,
        playerCameraState,
        firstPersonCamera,
        thirdPersonCamera,
        crosshair,
        blockHighlight,
        inputService,
        blockService,
        hotbarService,
        hotbarRenderer,
        fpsCounter,
        chunkManagerService,
        biomeService,
        timeService,
        settingsOverlay,
        pauseMenu,
        debugFeatureFlags,
        debugOverlay,
        inventoryRenderer,
        inventoryService,
        equipmentService,
        recipeService,
        healthService,
        hungerService,
        xpService,
        fishingService,
        entityManager,
        mobSpawner,
        villageService,
        tradingPresentation,
        redstoneService,
        cropGrowthService,
        fluidService,
        chestService,
        furnaceService,
        netherService,
        weatherService,
        gameModeService,
      },
    })

    return { bootCtx, gameLoopService, loadingScreen, terrainPool, runtimeParams, runtimeServices, control }
  })
