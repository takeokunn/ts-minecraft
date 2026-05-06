import { Array as Arr, Cause, Deferred, Duration, Effect, MutableRef, Option, Ref, Schedule } from 'effect'
import { SceneService, PerspectiveCameraService, WorldRendererService, EntityRendererService, ChunkMeshService } from '@ts-minecraft/rendering'

import { StartupError } from '@ts-minecraft/game'

import { ParticleSystemService } from '@ts-minecraft/rendering/particles/particle-system'
import { installPerfHudCounters } from '@ts-minecraft/rendering'

import { BiomeService, ChunkManagerService, BlockService, FluidService, setActiveChunkWorldId } from '@ts-minecraft/terrain'
import { GameStateService, TimeService, resolvePreset, GameLoopService, GameModeService, type GameMode } from '@ts-minecraft/game'
import { HotbarService, InventoryService, RecipeService } from '@ts-minecraft/inventory'
import { FurnaceService } from '@ts-minecraft/furnace'
import { PlayerCameraStateService, FirstPersonCameraService, ThirdPersonCameraService, HealthService } from '@ts-minecraft/player'
import { EntityManager, MobSpawner, VillageService, RedstoneService } from '@ts-minecraft/entities'
import { CrosshairService } from '@ts-minecraft/app/presentation/hud/crosshair'
import { DebugOverlayService } from '@ts-minecraft/app/presentation/hud/debug-overlay'
import { LoadingScreenService } from '@ts-minecraft/app/presentation/loading/loading-screen'
import { BlockHighlightService } from '@ts-minecraft/app/presentation/highlight/block-highlight'
import { InputService } from '@ts-minecraft/app/presentation/input/input-service'
import { HotbarRendererService } from '@ts-minecraft/app/presentation/hud/hotbar-three'
import { FPSCounterService } from '@ts-minecraft/app/presentation/fps-counter'
import { SettingsOverlayService } from '@ts-minecraft/app/presentation/settings/settings-overlay'
import { PauseMenuService } from '@ts-minecraft/app/presentation/menu/pause-menu'
import { DeathScreenService } from '@ts-minecraft/app/presentation/menu/death-screen'
import { InventoryRendererService } from '@ts-minecraft/app/presentation/inventory/inventory-renderer'
import { TradingPresentationService } from '@ts-minecraft/app/presentation/trading'
import { CHUNK_SIZE, CHUNK_HEIGHT, WorldId } from '@ts-minecraft/kernel'

import { installBrowserEventBridge, type PendingResize } from '@ts-minecraft/app/main/browser-runtime'
import {
  type SessionControl,
  createSessionControl,
} from '@ts-minecraft/app/main/session-control'
import { buildPostProcessing } from '@ts-minecraft/app/main/session-post-processing'
import { loadOrCreateWorld, buildRespawnPosition } from '@ts-minecraft/app/main/session-world-loader'
import { buildLighting } from '@ts-minecraft/app/main/session-lighting'
import { buildSessionRuntime } from '@ts-minecraft/app/main/session-runtime'
import { buildPersistSessionState, restoreSavedState } from '@ts-minecraft/app/main/session-save'

import type { BootContext } from '@ts-minecraft/app/main/boot'

// 0.5 = noon in TimeService's day fraction (0.0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk).
const BOOT_TIME_OF_DAY = 0.5

const MIN_LOADING_SCREEN_DURATION_MS = 2500

export type SessionResult = {
  readonly reason: 'quit-to-title' | 'never-returned'
  readonly control: SessionControl
}

// Runs ONE world session. Lifecycle:
//   1. Allocates per-world scene + camera + composer + post-processing passes.
//   2. Loads (or creates) world metadata for `worldId` and seeds NoiseService.
//   3. Initializes per-world domain state (chunks, entities, health, inventory, etc.).
//   4. Forks the game loop + maintenance + auto-save daemons.
//   5. Awaits `quitToTitleSignal` (set by pause-menu "Save & Quit").
//   6. Releases all session-scoped resources (composer RTs, scene meshes, forked daemons)
//      via Effect.scoped's release stack — boot-level resources survive untouched.
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
    // FR-1.3 — death screen overlay; mounted below via `deathScreen.attach`.
    const deathScreen = yield* DeathScreenService
    // FR-1.5/FR-1.7 — debug overlay (F3) and loading screen are session-scoped:
    // both rely on session DOM that tears down on quit-to-title.
    const debugOverlay = yield* DebugOverlayService
    const loadingScreen = yield* LoadingScreenService
    const inventoryRenderer = yield* InventoryRendererService
    const inventoryService = yield* InventoryService
    const recipeService = yield* RecipeService
    const healthService = yield* HealthService
    const entityManager = yield* EntityManager
    const mobSpawner = yield* MobSpawner
    const villageService = yield* VillageService
    const tradingPresentation = yield* TradingPresentationService
    const redstoneService = yield* RedstoneService
    const fluidService = yield* FluidService
    const furnaceService = yield* FurnaceService
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

    // Seed the GameModeService with the persisted game mode (will be overridden
    // below if metadata loads successfully — done first so cleanup paths see
    // the correct mode).
    yield* gameModeService.set(initialGameMode)

    // Settings snapshot + resolved graphics — used for camera/shadow far plane.
    const initialSettings = yield* settingsService.getSettings()
    const initialGraphics = resolvePreset(initialSettings.graphicsQuality)

    const scene = yield* sceneService.create()

    const camera = yield* cameraService.create({
      fov: 75,
      aspect: canvas.clientWidth / canvas.clientHeight,
      near: 0.1,
      far: Math.max(initialSettings.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300),
    })

    // EffectComposer + 5 post-processing passes — kept in session scope for now
    // (see boot.ts comment for rationale). All pass instances always exist so
    // live preset changes can enable them later without silently no-oping.
    const { composerRT, composer, gtaoPass, godRaysPass, bloomPass, bokehPass, smaaPass } = yield* buildPostProcessing(renderer, scene, camera, canvas, initialGraphics)

    // Composer + pass disposal at session end (FR-1.8 GPU teardown).
    yield* Effect.acquireRelease(
      Effect.void,
      () => Effect.sync(() => {
        const passes: ReadonlyArray<Option.Option<{ dispose(): void }>> = [gtaoPass, bloomPass, bokehPass, godRaysPass, smaaPass]
        Arr.forEach(passes, (pass) => Option.map(pass, (p) => p.dispose()))
        composerRT.dispose()
        composer.dispose()
      }),
    )

    // World metadata: load existing or create fresh (with seed + spawn).
    const worldBootstrap = yield* loadOrCreateWorld(worldId, initialGameMode, storageService, noiseService, gameModeService)

    // Persist session state — serializes player + furnace + active gameMode.
    const persistSessionState = buildPersistSessionState({
      gameState,
      inventoryService,
      healthService,
      timeService,
      furnaceService,
      gameModeService,
      storageService,
      worldBootstrap,
      worldId,
    })

    const loadingStartedAtMs = yield* Effect.sync(() => Date.now())

    const initialChunkLoadAnchor = Option.getOrElse(
      Option.map(worldBootstrap.savedPlayerState, (saved) => saved.position),
      () => worldBootstrap.baseSpawnPosition,
    )

    yield* Effect.sync(() => setActiveChunkWorldId(worldId))
    yield* chunkManagerService.loadChunksAroundPlayer(initialChunkLoadAnchor, initialSettings.renderDistance)
    const initialChunks = yield* chunkManagerService.getLoadedChunks()
    // Drive `syncChunksToScene` until every queued chunk has a mesh in
    // the scene before lifting the loading screen. A single call can stop short
    // due to time-budget / per-call caps, so we loop until settled.
    yield* Effect.raceFirst(
      Effect.iterate(false, {
        while: (settled) => !settled,
        body: () =>
          worldRendererService.syncChunksToScene(initialChunks, scene).pipe(
            Effect.flatMap((settled) =>
              settled ? Effect.succeed(true) : Effect.sleep(Duration.millis(50)).pipe(Effect.as(false)),
            ),
          ),
      }),
      Effect.sleep(Duration.seconds(30)).pipe(
        Effect.flatMap(() => Effect.fail(new Error('Timed out while syncing initial chunk meshes'))),
      ),
    ).pipe(
      Effect.catchAll((cause) =>
        loadingScreen.showError('Failed to prepare initial terrain meshes.').pipe(
          Effect.zipRight(Effect.logError(`Loading gate failed: ${String(cause)}`)),
          Effect.zipRight(Effect.sleep(Duration.seconds(3))),
          Effect.zipRight(Effect.fail(new StartupError({ reason: 'Failed to prepare initial chunk meshes', cause }))),
        ),
      ),
    )

    // Additional safety gate: wait until terrain worker queue is drained.
    yield* Effect.raceFirst(
      Effect.iterate(false, {
        while: (queueDrained) => !queueDrained,
        body: () =>
          Effect.sync(() => terrainPool.queueDepth() === 0).pipe(
            Effect.flatMap((queueDrained) =>
              queueDrained ? Effect.succeed(true) : Effect.sleep(Duration.millis(25)).pipe(Effect.as(false)),
            ),
          ),
      }),
      Effect.sleep(Duration.seconds(30)).pipe(
        Effect.flatMap(() => Effect.fail(new Error('Timed out while draining terrain worker queue'))),
      ),
    ).pipe(
      Effect.catchAll((cause) =>
        loadingScreen.showError('Terrain generation took too long and was aborted.').pipe(
          Effect.zipRight(Effect.logError(`Terrain queue drain failed: ${String(cause)}`)),
          Effect.zipRight(Effect.sleep(Duration.seconds(3))),
          Effect.zipRight(Effect.fail(new StartupError({ reason: 'Timed out while draining terrain worker queue', cause }))),
        ),
      ),
    )

    // Enforce a minimum loading-screen display duration to avoid abrupt flashes.
    const loadingElapsedMs = (yield* Effect.sync(() => Date.now())) - loadingStartedAtMs
    const remainingLoadingMs = Math.max(0, MIN_LOADING_SCREEN_DURATION_MS - loadingElapsedMs)
    if (remainingLoadingMs > 0) {
      yield* Effect.sleep(Duration.millis(remainingLoadingMs))
    }

    // Hide the loading screen only after terrain is ready and min duration elapsed.
    // Idempotent if the overlay was never created (SSR path).
    yield* loadingScreen.hide()

    const defaultRespawnPosition = yield* buildRespawnPosition(worldBootstrap.baseSpawnPosition, chunkManagerService)

    const spawnPosition = Option.getOrElse(
      Option.map(worldBootstrap.savedPlayerState, (saved) => saved.position),
      () => defaultRespawnPosition,
    )

    // Lighting setup: directional sun + ambient + Sky shader.
    const lighting = yield* buildLighting(scene, sceneService, initialSettings, initialGraphics)

    yield* gameState.initialize(spawnPosition)

    yield* restoreSavedState(worldBootstrap, { inventoryService, healthService, furnaceService })

    // Auto-save daemon: spaced (not fixed) Schedule prevents burst on tab-resume.
    // Lives on its own forkDaemon so it continues regardless of pause-state.
    yield* Effect.forkDaemon(
      Effect.repeat(
        Effect.all([
          chunkManagerService.saveDirtyChunks(),
          persistSessionState(),
        ], { concurrency: 'unbounded', discard: true }).pipe(
          Effect.catchAllCause((cause) => Effect.logError(`Auto-save error: ${Cause.pretty(cause)}`)),
        ),
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

    // Browser event bridge: resize + visibility-save + pointer-lock.
    const pendingResizeRef = MutableRef.make<Option.Option<PendingResize>>(Option.none())
    const pendingSaveDirtyChunksRef = MutableRef.make(false)
    yield* installBrowserEventBridge({
      canvas,
      inputPointerLock: inputService.requestPointerLock(),
      pendingResizeRef,
      pendingSaveDirtyChunksRef,
    })

    // FPS + health DOM elements (resolved once at session start; pre-cached for HUD).
    const { fpsElement, healthValueElement, healthMaxElement } = yield* Effect.sync(() => ({
      fpsElement: document.getElementById('fps-value'),
      healthValueElement: document.getElementById('health-value'),
      healthMaxElement: document.getElementById('health-max'),
    }))

    // gamePausedRef tracks transient overlay state (settings/inventory/trading)
    // — distinct from sessionPausedRef (FR-1.4 pause-menu / quit-to-title).
    const gamePausedRef = yield* Ref.make(false)

    const { frameHandlerWithBrowserEvents, maintenanceHandler } = yield* buildSessionRuntime(
      {
        renderer, scene, camera, composerRT, composer,
        gtaoPass, bloomPass, bokehPass, godRaysPass, smaaPass,
        lighting, fpsElement, healthValueElement, healthMaxElement,
        control, gamePausedRef, defaultRespawnPosition,
        pendingResizeRef, pendingSaveDirtyChunksRef, persistSessionState,
        deathScreen, debugOverlay, biomeService, recipeService,
      },
      {
        gameState, playerCameraState, firstPersonCamera, thirdPersonCamera,
        blockHighlight, inputService, blockService, hotbarService, hotbarRenderer,
        chunkManagerService, timeService, settingsService, settingsOverlay, pauseMenu,
        inventoryRenderer, inventoryService, fpsCounter, worldRendererService,
        entityRenderer, chunkMeshService, particleSystem, healthService,
        soundManager, musicManager, entityManager, mobSpawner, villageService,
        tradingPresentation, redstoneService, fluidService, furnaceService,
        perfHud, gameMode: gameModeService,
      },
    )

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
