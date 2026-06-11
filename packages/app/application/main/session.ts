import { Deferred, Duration, Effect, MutableRef, Option, Ref, Schedule } from 'effect'
import { SceneService, PerspectiveCameraService, WorldRendererService, EntityRendererService, ChunkMeshService } from '@ts-minecraft/rendering'

import { StartupError } from '@ts-minecraft/game'

import { ParticleSystemService } from '@ts-minecraft/rendering/particles/particle-system'
import { installPerfHudCounters } from '@ts-minecraft/rendering'

import { BiomeService, ChunkManagerService, BlockService, CropGrowthService, FluidService, NetherService } from '@ts-minecraft/world'
import { GameStateService, TimeService, WeatherService, resolvePreset, GameLoopService, GameModeService, type GameMode } from '@ts-minecraft/game'
import { HotbarService, InventoryService, RecipeService, EquipmentService } from '@ts-minecraft/inventory'
import { FurnaceService, HOTBAR_START, createStack } from '@ts-minecraft/inventory'
import { PlayerCameraStateService, FirstPersonCameraService, ThirdPersonCameraService, HealthService, HungerService, XPService, FishingService } from '@ts-minecraft/entity'
import { EntityManager, MobSpawner, VillageService, RedstoneService } from '@ts-minecraft/entity'
import { CrosshairService } from '@ts-minecraft/presentation/hud/crosshair'
import { DebugFeatureFlagsService } from '@ts-minecraft/app/debug-feature-flags'
import { DebugOverlayService } from '@ts-minecraft/presentation/hud/debug-overlay'
import { LoadingScreenService } from '@ts-minecraft/presentation/loading/loading-screen'
import { BlockHighlightService } from '@ts-minecraft/presentation/highlight/block-highlight'
import { InputService } from '@ts-minecraft/presentation/input/input-service'
import { HotbarRendererService } from '@ts-minecraft/presentation/hud/hotbar-three'
import { FPSCounterService } from '@ts-minecraft/presentation/fps-counter'
import { SettingsOverlayService } from '@ts-minecraft/presentation/settings/settings-overlay'
import { PauseMenuService } from '@ts-minecraft/presentation/menu/pause-menu'
import { DeathScreenService } from '@ts-minecraft/presentation/menu/death-screen'
import { InventoryRendererService } from '@ts-minecraft/presentation/inventory/inventory-renderer'
import { TradingPresentationService } from '@ts-minecraft/presentation/trading'
import { CHUNK_SIZE, CHUNK_HEIGHT, WorldId, SlotIndex, type Position } from '@ts-minecraft/core'

import { installBrowserEventBridge, type PendingResize } from '@ts-minecraft/app/main/browser-runtime'
import {
  type SessionControl,
  createSessionControl,
} from '@ts-minecraft/app/main/session-control'
import { buildPostProcessing } from '@ts-minecraft/app/main/session-post-processing'
import { loadOrCreateWorld, buildSpawnSelection } from '@ts-minecraft/app/main/session-world-loader'
import { buildLighting } from '@ts-minecraft/app/main/session-lighting'
import { buildSessionRuntime } from '@ts-minecraft/app/main/session-runtime'
import { buildPersistSessionState, restoreSavedState } from '@ts-minecraft/app/main/session-save'
import { performAutoSaveTick } from '@ts-minecraft/app/main/session-autosave'
import { prepareInitialTerrain, waitForInitialFrameRate } from '@ts-minecraft/app/main/session-loading-gates'
import { registerComposerDisposal } from '@ts-minecraft/app/main/session-disposal'

import type { BootContext } from '@ts-minecraft/app/main/boot'

// 0.5 = noon in TimeService's day fraction (0.0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk).
const BOOT_TIME_OF_DAY = 0.5

export type SessionResult = {
  readonly reason: 'quit-to-title' | 'never-returned'
  readonly control: SessionControl
}

export const sessionProgram = (
  bootCtx: BootContext,
  worldId: WorldId,
  initialGameMode: GameMode,
) =>
  Effect.gen(function* () {
    const sceneService = yield* SceneService
    const cameraService = yield* PerspectiveCameraService
    const worldRendererService = yield* WorldRendererService
    const entityRenderer = yield* EntityRendererService
    const chunkMeshService = yield* ChunkMeshService
    const particleSystem = yield* ParticleSystemService

    const gameState = yield* GameStateService
    const playerCameraState = yield* PlayerCameraStateService
    const firstPersonCamera = yield* FirstPersonCameraService
    const thirdPersonCamera = yield* ThirdPersonCameraService
    const crosshair = yield* CrosshairService
    const blockHighlight = yield* BlockHighlightService
    const inputService = yield* InputService
    const blockService = yield* BlockService
    const hotbarService = yield* HotbarService

    const hotbarRenderer = yield* HotbarRendererService
    const fpsCounter = yield* FPSCounterService

    const chunkManagerService = yield* ChunkManagerService
    const biomeService = yield* BiomeService
    const timeService = yield* TimeService
    const settingsOverlay = yield* SettingsOverlayService
    const pauseMenu = yield* PauseMenuService
    const debugFeatureFlags = yield* DebugFeatureFlagsService
    // FR-1.3 — death screen overlay; mounted below via `deathScreen.attach`.
    const deathScreen = yield* DeathScreenService
    // FR-1.5/FR-1.7 — debug overlay (F3) and loading screen are session-scoped:
    // both rely on session DOM that tears down on quit-to-title.
    const debugOverlay = yield* DebugOverlayService
    const loadingScreen = yield* LoadingScreenService
    const inventoryRenderer = yield* InventoryRendererService
    const inventoryService = yield* InventoryService
    const equipmentService = yield* EquipmentService
    const recipeService = yield* RecipeService
    const healthService = yield* HealthService
    const hungerService = yield* HungerService
    const xpService = yield* XPService
    const fishingService = yield* FishingService
    const entityManager = yield* EntityManager
    const mobSpawner = yield* MobSpawner
    const villageService = yield* VillageService
    const tradingPresentation = yield* TradingPresentationService
    const redstoneService = yield* RedstoneService
    const cropGrowthService = yield* CropGrowthService
    const fluidService = yield* FluidService
    const furnaceService = yield* FurnaceService
    const netherService = yield* NetherService
    const weatherService = yield* WeatherService
    const gameLoopService = yield* GameLoopService
    const gameModeService = yield* GameModeService

    const {
      canvas,
      renderer,
      perfHud,
      settingsService,
      storageService,
      noiseService,
      terrainPool,
      soundManager,
      musicManager,
    } = bootCtx

    // Allocate session-control primitives (pause flag + quit-to-title signal).
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

    const worldBootstrap = yield* loadOrCreateWorld(worldId, initialGameMode, storageService, noiseService, gameModeService)

    const initialChunkLoadAnchor = Option.getOrElse(
      Option.map(worldBootstrap.savedPlayerState, (saved) => saved.position),
      () => worldBootstrap.baseSpawnPosition,
    )

    yield* chunkManagerService.setActiveWorldId(worldId)
    yield* prepareInitialTerrain({
      chunkManagerService,
      worldRendererService,
      terrainPool,
      loadingScreen,
      scene,
      anchor: initialChunkLoadAnchor,
      renderDistance: initialSettings.renderDistance,
    })

    const initialSpawnSelection = yield* buildSpawnSelection(worldBootstrap.baseSpawnPosition, chunkManagerService)
    const defaultRespawnPosition = initialSpawnSelection.position

    // Bed-aware respawn point (FR-4), shared live across bed handler, physics-stage,
    // death-screen, and autosave. Seeded from the saved bed spawn if present, else
    // the world spawn (back-compat: pre-bed-persistence saves have no respawnPosition).
    const respawnPositionRef = MutableRef.make<Position>(
      Option.getOrElse(
        Option.flatMap(worldBootstrap.savedPlayerState, (s) => Option.fromNullable(s.respawnPosition)),
        () => defaultRespawnPosition,
      ),
    )

    const persistSessionState = buildPersistSessionState({
      gameState,
      inventoryService,
      equipmentService,
      healthService,
      hungerService,
      xpService,
      timeService,
      furnaceService,
      gameModeService,
      storageService,
      cropGrowthService,
      worldBootstrap,
      worldId,
      respawnPositionRef,
    })

    const spawnPosition = Option.getOrElse(
      Option.map(worldBootstrap.savedPlayerState, (saved) => saved.position),
      () => defaultRespawnPosition,
    )

    // Lighting setup: directional sun + ambient + Sky shader.
    const lighting = yield* buildLighting(scene, sceneService, initialSettings, initialGraphics)

    yield* gameState.initialize(spawnPosition)
    if (Option.isNone(worldBootstrap.savedPlayerState)) {
      yield* playerCameraState.setYaw(initialSpawnSelection.yaw)
      yield* playerCameraState.setPitch(0)
    }

    yield* restoreSavedState(worldBootstrap, { inventoryService, equipmentService, healthService, hungerService, xpService, furnaceService, cropGrowthService })

    // Give starter hotbar items on new survival worlds so players have a basic
    // tool and building blocks right away. Creative worlds and resumed sessions
    // (with existing saved player state) skip this entirely.
    if (Option.isNone(worldBootstrap.savedPlayerState) && initialGameMode === 'survival') {
      // WOODEN_PICKAXE in slot 1 of the hotbar (index 27).
      yield* inventoryService.setSlot(
        SlotIndex.make(HOTBAR_START),
        Option.some(createStack('WOODEN_PICKAXE', 1)),
      )
      // PLANKS ×16 in slot 2 of the hotbar (index 28).
      yield* inventoryService.setSlot(
        SlotIndex.make(HOTBAR_START + 1),
        Option.some(createStack('PLANKS', 16)),
      )
    }

    // Auto-save daemon: spaced (not fixed) Schedule prevents burst on tab-resume.
    // Lives on its own forkDaemon so it continues regardless of pause-state.
    yield* Effect.forkDaemon(
      Effect.repeat(
        performAutoSaveTick(chunkManagerService.saveDirtyChunks(), persistSessionState()),
        Schedule.spaced(Duration.seconds(5)),
      ),
    )

    yield* blockHighlight.initialize(scene)
    yield* hotbarRenderer.initialize(canvas.clientWidth, canvas.clientHeight)
    yield* particleSystem.attach(scene)

    // Time-of-day: apply persisted dayLength, then force noon at boot.
    yield* timeService.setDayLength(initialSettings.dayLengthSeconds)
    yield* timeService.setTimeOfDay(BOOT_TIME_OF_DAY)

    yield* crosshair.show()

    // Browser event bridge refs: resize + visibility-save + pointer-lock.
    const pendingResizeRef = MutableRef.make<Option.Option<PendingResize>>(Option.none())
    const pendingSaveDirtyChunksRef = MutableRef.make(false)

    // FPS + health + hunger + XP + armor DOM elements (resolved once at session start; pre-cached for HUD).
    const { fpsElement, healthValueElement, healthMaxElement, hungerValueElement, hungerMaxElement, xpLevelElement, xpBarElement, xpBarMaxElement, armorValueElement, airElement, breakProgressElement } = yield* Effect.sync(() => ({
      fpsElement: document.getElementById('fps-value'),
      healthValueElement: document.getElementById('health-value'),
      healthMaxElement: document.getElementById('health-max'),
      hungerValueElement: document.getElementById('hunger-value'),
      hungerMaxElement: document.getElementById('hunger-max'),
      xpLevelElement: document.getElementById('xp-level'),
      xpBarElement: document.getElementById('xp-bar'),
      xpBarMaxElement: document.getElementById('xp-bar-max'),
      armorValueElement: document.getElementById('armor-value'),
      airElement: document.getElementById('air-display'),
      breakProgressElement: document.getElementById('break-progress'),
    }))

    // gamePausedRef tracks transient overlay state (settings/inventory/trading)
    // — distinct from sessionPausedRef (FR-1.4 pause-menu / quit-to-title).
    const gamePausedRef = yield* Ref.make(false)

    const { frameHandlerWithBrowserEvents, maintenanceHandler } = yield* buildSessionRuntime(
      {
        renderer, scene, camera, composerRT, composer,
        gtaoPass, bloomPass, bokehPass, godRaysPass, smaaPass,
        lighting, fpsElement, healthValueElement, healthMaxElement, hungerValueElement, hungerMaxElement, xpLevelElement, xpBarElement, xpBarMaxElement, armorValueElement, airElement, breakProgressElement,
        control, gamePausedRef, respawnPositionRef,
        pendingResizeRef, pendingSaveDirtyChunksRef, persistSessionState,
        deathScreen, debugOverlay, biomeService, recipeService,
      },
      {
        gameState, playerCameraState, firstPersonCamera, thirdPersonCamera,
        blockHighlight, inputService, blockService, hotbarService, hotbarRenderer,
        chunkManagerService, timeService, settingsService, debugFeatureFlags, settingsOverlay, pauseMenu,
        inventoryRenderer, inventoryService, equipmentService, fpsCounter, worldRendererService,
        entityRenderer, chunkMeshService, particleSystem, healthService, hungerService, xpService, fishingService,
        soundManager, musicManager, entityManager, mobSpawner, villageService,
        tradingPresentation, redstoneService, cropGrowthService, fluidService, furnaceService, netherService, weatherService,
        perfHud, gameMode: gameModeService,
        // Multiplayer is intentionally disabled by default (Option.none).
        // To enable: pass Option.some(MultiplayerServiceLive(client)) where
        // client is a real WebSocket ClientService instance.
        multiplayer: Option.none(),
      },
    )

    yield* installBrowserEventBridge({
      canvas,
      inputPointerLock: inputService.requestPointerLock(),
      gamePausedRef,
      pendingResizeRef,
      pendingSaveDirtyChunksRef,
      gameLoopService,
      frameHandler: frameHandlerWithBrowserEvents,
    })

    yield* Effect.log('Game initialized — inventory, day/night cycle, and settings ready')

    yield* installPerfHudCounters(perfHud, chunkManagerService, () => terrainPool.queueDepth())

    yield* Effect.acquireRelease(
      Effect.all(
        [
          gameLoopService.start(frameHandlerWithBrowserEvents),
          gameLoopService.startMaintenance(maintenanceHandler),
        ],
        { concurrency: 'unbounded', discard: true },
      ),
      () => gameLoopService.stop(),
    ).pipe(
      Effect.mapError((cause) => new StartupError({ reason: 'Failed to start game loop', cause })),
    )

    yield* waitForInitialFrameRate(fpsElement)
    yield* loadingScreen.hide()

    // Wait until the user requests quit-to-title (signaled by the Wave-2 pause
    // menu via `requestQuitToTitle(control)`). Once fulfilled, the Effect.gen
    // exits and Effect.scoped releases all session resources.
    yield* Deferred.await(control.quitToTitleSignal)

    // Best-effort save flush before tearing down — metadata save runs first so
    // player-position / health / inventory restoration is prioritized for
    // quit-to-title flows, while both stages are time-bounded so a stalled save
    // path cannot trap the user in-session indefinitely.
    yield* Effect.raceFirst(
      persistSessionState().pipe(Effect.catchAllCause(() => Effect.void)),
      Effect.sleep(Duration.seconds(5)),
    )
    yield* Effect.raceFirst(
      chunkManagerService.saveDirtyChunks().pipe(Effect.catchAllCause(() => Effect.void)),
      Effect.sleep(Duration.seconds(5)),
    )

    return { reason: 'quit-to-title' as const, control }
  })
