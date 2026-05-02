import { Array as Arr, Cause, Clock, Deferred, Duration, Effect, MutableRef, Option, Random, Ref, Schedule, Schema } from 'effect'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { Sky } from 'three/addons/objects/Sky.js'
import { GodRaysPass, SceneService, PerspectiveCameraService, WorldRendererService, EntityRendererService, ChunkMeshService } from '@ts-minecraft/world-renderer'

import { StartupError } from '@ts-minecraft/domain'

import { ParticleSystemService } from '@ts-minecraft/world-renderer/particles/particle-system'
import { installPerfHudCounters } from '@ts-minecraft/perf-hud'

import { BiomeService } from '@ts-minecraft/biome-classifier'
import { ChunkManagerService } from '@ts-minecraft/chunk-manager'
import { GameStateService } from '@ts-minecraft/game-session'
import { BlockService } from '@ts-minecraft/block-service'
import { HotbarService } from '@ts-minecraft/hotbar-system'
import { PlayerCameraStateService } from '@ts-minecraft/camera-controller'
import { FirstPersonCameraService } from '@ts-minecraft/camera-controller'
import { ThirdPersonCameraService } from '@ts-minecraft/camera-controller'
import { CrosshairService } from '@ts-minecraft/app/presentation/hud/crosshair'
import { DebugOverlayService } from '@ts-minecraft/app/presentation/hud/debug-overlay'
import { LoadingScreenService } from '@ts-minecraft/app/presentation/loading/loading-screen'
import { BlockHighlightService } from '@ts-minecraft/app/presentation/highlight/block-highlight'
import { InputService } from '@ts-minecraft/app/presentation/input/input-service'
import { HotbarRendererService } from '@ts-minecraft/app/presentation/hud/hotbar-three'
import { FPSCounterService } from '@ts-minecraft/app/presentation/fps-counter'
import { TimeService } from '@ts-minecraft/day-night-cycle'
import { resolvePreset } from '@ts-minecraft/settings-manager'
import { SettingsOverlayService } from '@ts-minecraft/app/presentation/settings/settings-overlay'
import { PauseMenuService } from '@ts-minecraft/app/presentation/menu/pause-menu'
import { DeathScreenService } from '@ts-minecraft/app/presentation/menu/death-screen'
import { InventoryRendererService } from '@ts-minecraft/app/presentation/inventory/inventory-renderer'
import { InventoryService } from '@ts-minecraft/inventory-system'
import { RecipeService } from '@ts-minecraft/crafting-system'
import { HealthService } from '@ts-minecraft/player-controller'
import { EntityManager, MobSpawner } from '@ts-minecraft/entity-manager'
import { VillageService } from '@ts-minecraft/village-system'
import { TradingPresentationService } from '@ts-minecraft/app/presentation/trading'
import { RedstoneService } from '@ts-minecraft/redstone-circuit'
import { FluidService } from '@ts-minecraft/fluid-simulation'
import { FurnaceService } from '@ts-minecraft/furnace-system'
import { GameLoopService } from '@ts-minecraft/game-loop'
import { GameModeService, type GameMode } from '@ts-minecraft/game-mode'
import type { WorldMetadata } from '@ts-minecraft/block-storage'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex } from '@ts-minecraft/domain'
import { DEFAULT_PLAYER_ID, MAX_SHADOW_HALF_EXTENT, type ColorPort, SkyMaterialPortSchema, WorldId } from '@ts-minecraft/kernel'

import { createFrameHandlers } from '@ts-minecraft/app/frame-handler'
import { installBrowserEventBridge, type PendingResize, wrapFrameHandlerWithBrowserEffects } from '@ts-minecraft/app/main/browser-runtime'
import { installQaApi } from '@ts-minecraft/app/main/qa-api'
import {
  type SessionControl,
  createSessionControl,
} from '@ts-minecraft/app/main/session-control'
import {
  MAX_SEED_VALUE,
  SUN_COLOR, AMBIENT_COLOR, SKY_COLOR_NIGHT, SKY_COLOR_DAY,
  BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
  BOKEH_FOCUS, BOKEH_APERTURE, BOKEH_MAXBLUR,
  GTAO_BLEND_INTENSITY,
} from '@ts-minecraft/app/main.config'

import type { BootContext } from '@ts-minecraft/app/main/boot'

// 0.5 = noon in TimeService's day fraction (0.0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk).
const BOOT_TIME_OF_DAY = 0.5

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
    const { composerRT, composer, gtaoPass, godRaysPass, bloomPass, bokehPass, smaaPass } = yield* Effect.sync(() => {
      const rt = new THREE.WebGLRenderTarget(
        canvas.clientWidth,
        canvas.clientHeight,
        { type: THREE.HalfFloatType }
      )
      const comp = new EffectComposer(renderer, rt)
      comp.addPass(new RenderPass(scene, camera))

      const gtaoPassInstance = new GTAOPass(scene, camera, canvas.clientWidth, canvas.clientHeight)
      gtaoPassInstance.blendIntensity = GTAO_BLEND_INTENSITY
      gtaoPassInstance.enabled = initialGraphics.ssaoEnabled
      gtaoPassInstance.setSize(
        initialGraphics.ssaoEnabled ? Math.ceil(canvas.clientWidth / 2) : 1,
        initialGraphics.ssaoEnabled ? Math.ceil(canvas.clientHeight / 2) : 1,
      )
      comp.addPass(gtaoPassInstance)
      const gtao: Option.Option<GTAOPass> = Option.some(gtaoPassInstance)

      const godRaysPassInstance = new GodRaysPass()
      godRaysPassInstance.enabled = initialGraphics.godRaysEnabled
      godRaysPassInstance.setSize(initialGraphics.godRaysEnabled ? canvas.clientWidth : 1, initialGraphics.godRaysEnabled ? canvas.clientHeight : 1)
      comp.addPass(godRaysPassInstance)
      const godRays: Option.Option<GodRaysPass> = Option.some(godRaysPassInstance)

      const bloomPassInstance = new UnrealBloomPass(
        new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
        BLOOM_STRENGTH,
        BLOOM_RADIUS,
        BLOOM_THRESHOLD,
      )
      bloomPassInstance.enabled = initialGraphics.bloomEnabled
      bloomPassInstance.strength = initialGraphics.bloomStrength
      bloomPassInstance.setSize(initialGraphics.bloomEnabled ? canvas.clientWidth : 1, initialGraphics.bloomEnabled ? canvas.clientHeight : 1)
      comp.addPass(bloomPassInstance)
      const bloom: Option.Option<UnrealBloomPass> = Option.some(bloomPassInstance)

      const bokehPassInstance = new BokehPass(scene, camera, {
        focus: BOKEH_FOCUS,
        aperture: BOKEH_APERTURE,
        maxblur: BOKEH_MAXBLUR,
      })
      bokehPassInstance.enabled = initialGraphics.dofEnabled
      bokehPassInstance.setSize(initialGraphics.dofEnabled ? canvas.clientWidth : 1, initialGraphics.dofEnabled ? canvas.clientHeight : 1)
      comp.addPass(bokehPassInstance)
      const bokeh: Option.Option<BokehPass> = Option.some(bokehPassInstance)

      const smaaPassInstance = new SMAAPass(canvas.clientWidth, canvas.clientHeight)
      smaaPassInstance.enabled = initialGraphics.smaaEnabled
      smaaPassInstance.setSize(initialGraphics.smaaEnabled ? canvas.clientWidth : 1, initialGraphics.smaaEnabled ? canvas.clientHeight : 1)
      comp.addPass(smaaPassInstance)
      const smaa: Option.Option<SMAAPass> = Option.some(smaaPassInstance)

      comp.addPass(new OutputPass())

      return { composerRT: rt, composer: comp, gtaoPass: gtao, godRaysPass: godRays, bloomPass: bloom, bokehPass: bokeh, smaaPass: smaa }
    })

    // Composer + pass disposal at session end (FR-1.8 GPU teardown).
    yield* Effect.acquireRelease(
      Effect.void,
      () => Effect.sync(() => {
        const passes: ReadonlyArray<Option.Option<{ dispose(): void }>> = [gtaoPass, bloomPass, bokehPass, godRaysPass, smaaPass]
        Arr.forEach(passes, (pass) => Option.match(pass, { onNone: () => {}, onSome: (p) => p.dispose() }))
        composerRT.dispose()
        composer.dispose()
      }),
    )

    // World metadata: load existing or create fresh (with seed + spawn).
    type SavedPlayerState = NonNullable<WorldMetadata['playerState']>
    type SavedFurnaceStates = NonNullable<WorldMetadata['furnaceStates']>
    type WorldBootstrap = {
      readonly seed: number
      readonly createdAt: Date
      readonly baseSpawnPosition: { readonly x: number; readonly y: number; readonly z: number }
      readonly savedPlayerState: Option.Option<SavedPlayerState>
      readonly savedFurnaceStates: Option.Option<SavedFurnaceStates>
      readonly gameMode: GameMode
    }

    const loadOrCreateWorld: Effect.Effect<WorldBootstrap, StartupError, never> =
      storageService.loadWorldMetadata(worldId).pipe(
        Effect.mapError((cause) => new StartupError({ reason: 'Failed to load world metadata', cause })),
        Effect.flatMap((existingMetadata) =>
          Option.match(existingMetadata, {
            onSome: (metadata): Effect.Effect<WorldBootstrap, StartupError, never> =>
              noiseService.setSeed(metadata.seed).pipe(
                Effect.andThen(gameModeService.set(metadata.gameMode)),
                Effect.andThen(
                  Effect.log(
                    `Loaded world '${worldId}' with seed ${metadata.seed} (gameMode=${metadata.gameMode}, saveVersion=${metadata.saveVersion})`,
                  ),
                ),
                Effect.as({
                  seed: metadata.seed,
                  createdAt: metadata.createdAt,
                  baseSpawnPosition: metadata.playerSpawn ?? { x: 0, y: 100, z: 0 },
                  savedPlayerState: Option.fromNullable(metadata.playerState),
                  savedFurnaceStates: Option.fromNullable(metadata.furnaceStates),
                  gameMode: metadata.gameMode,
                }),
              ),
            onNone: (): Effect.Effect<WorldBootstrap, StartupError, never> =>
              Effect.all(
                [Random.nextIntBetween(0, MAX_SEED_VALUE), Clock.currentTimeMillis],
                { concurrency: 'unbounded' },
              ).pipe(
                Effect.flatMap(([seed, nowMs]) => {
                  const pos = { x: 0, y: 100, z: 0 }
                  const now = new Date(nowMs)
                  return noiseService.setSeed(seed).pipe(
                    Effect.andThen(
                      storageService.saveWorldMetadata(worldId, {
                        seed,
                        createdAt: now,
                        lastPlayed: now,
                        playerSpawn: pos,
                        gameMode: initialGameMode,
                        saveVersion: 1,
                      }),
                    ),
                    Effect.andThen(
                      Effect.log(`Created new world '${worldId}' with seed ${seed} (gameMode=${initialGameMode})`),
                    ),
                    Effect.as({
                      seed,
                      createdAt: now,
                      baseSpawnPosition: pos,
                      savedPlayerState: Option.none(),
                      savedFurnaceStates: Option.none(),
                      gameMode: initialGameMode,
                    }),
                    Effect.mapError((cause) => new StartupError({ reason: 'Failed to save fresh world metadata', cause })),
                  )
                }),
              ),
          }),
        ),
      )
    const worldBootstrap = yield* loadOrCreateWorld

    // Persist session state — serializes player + furnace + active gameMode.
    const persistSessionState = () =>
      Effect.gen(function* () {
        const nowMs = yield* Clock.currentTimeMillis
        const playerPosition = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
        const inventory = yield* inventoryService.serialize()
        const health = yield* healthService.getHealth()
        const timeOfDay = yield* timeService.getTimeOfDay()
        const furnaceStates = yield* furnaceService.serialize()
        const gameMode = yield* gameModeService.get()
        yield* storageService.saveWorldMetadata(worldId, {
          seed: worldBootstrap.seed,
          createdAt: worldBootstrap.createdAt,
          lastPlayed: new Date(nowMs),
          playerSpawn: worldBootstrap.baseSpawnPosition,
          playerState: {
            position: playerPosition,
            health: health.current,
            inventory,
            timeOfDay,
          },
          furnaceStates,
          gameMode,
          saveVersion: 1,
        })
      })

    const initialChunkLoadAnchor = Option.getOrElse(
      Option.map(worldBootstrap.savedPlayerState, (saved) => saved.position),
      () => worldBootstrap.baseSpawnPosition,
    )

    yield* chunkManagerService.loadChunksAroundPlayer(initialChunkLoadAnchor, initialSettings.renderDistance)
    const initialChunks = yield* chunkManagerService.getLoadedChunks()
    // FR-1.7: drive `syncChunksToScene` until every queued chunk has a mesh in
    // the scene before lifting the loading screen. The first call may stop
    // short of a full drain (`MAX_CHUNK_UPDATES_PER_FRAME`/time-budget caps);
    // we re-invoke until it returns `true`. A 9-chunk 3×3 prewarm completes
    // well inside the cap, so the loop iterates at most a handful of times.
    yield* Effect.iterate(false, {
      while: (settled) => !settled,
      body: () =>
        worldRendererService.syncChunksToScene(initialChunks, scene).pipe(
          Effect.flatMap((settled) =>
            settled ? Effect.succeed(true) : Effect.sleep(Duration.millis(50)).pipe(Effect.as(false)),
          ),
        ),
    })
    // Hide the loading screen now that the 3×3 prewarm has fully landed in
    // the scene graph. Idempotent if the overlay was never created (SSR path).
    yield* loadingScreen.hide()

    const defaultRespawnPosition = yield* Effect.gen(function* () {
      const spawnChunk = yield* chunkManagerService.getChunk({ x: 0, z: 0 })
      const spawnBlocks: Readonly<Uint8Array> = spawnChunk.blocks
      const surfaceY = Option.getOrElse(
        Arr.findFirst(
          Arr.makeBy(CHUNK_HEIGHT, (i) => CHUNK_HEIGHT - 1 - i),
          (y) =>
            Option.match(blockIndex(0, y, 0), {
              onNone: () => false,
              onSome: (idx) => spawnBlocks[idx] !== 0,
            }),
        ),
        () => 64,
      )
      return { ...worldBootstrap.baseSpawnPosition, y: surfaceY + 1 + 3 }
    })

    const spawnPosition = Option.getOrElse(
      Option.map(worldBootstrap.savedPlayerState, (saved) => saved.position),
      () => defaultRespawnPosition,
    )

    // Lighting setup: directional sun + ambient + Sky shader.
    const light = yield* Effect.sync(() => {
      const l = new THREE.DirectionalLight(SUN_COLOR, 1)
      l.shadow.mapSize.width = 2048
      l.shadow.mapSize.height = 2048
      l.shadow.camera.near = 0.5
      l.shadow.camera.far = Math.max(initialSettings.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300)
      const shadowHalfExtent = Math.min(Math.ceil(initialSettings.renderDistance * CHUNK_SIZE * 0.5), MAX_SHADOW_HALF_EXTENT)
      l.shadow.camera.left = -shadowHalfExtent
      l.shadow.camera.right = shadowHalfExtent
      l.shadow.camera.top = shadowHalfExtent
      l.shadow.camera.bottom = -shadowHalfExtent
      l.position.set(5, 10, 7)
      l.castShadow = initialGraphics.shadowsEnabled
      return l
    })
    yield* sceneService.add(scene, light)
    yield* sceneService.add(scene, light.target)

    const ambientLight = yield* Effect.sync(() => new THREE.AmbientLight(AMBIENT_COLOR, 0.35))
    yield* sceneService.add(scene, ambientLight)

    const sky = yield* Effect.sync(() => {
      const s = new Sky()
      s.scale.setScalar(10000)
      return s
    })
    yield* sceneService.add(scene, sky)
    const skyPort = yield* Effect.sync(() => {
      const skyMaterial = Array.isArray(sky.material) ? sky.material[0] : sky.material
      if (!(skyMaterial instanceof THREE.ShaderMaterial)) {
        throw new StartupError({ reason: 'Sky material is not a ShaderMaterial' })
      }
      const skyShaderMaterial = skyMaterial
      Option.match(Option.fromNullable(skyShaderMaterial.uniforms['mieCoefficient']), { onNone: () => {}, onSome: (u) => { u.value = 0.005 } })
      Option.match(Option.fromNullable(skyShaderMaterial.uniforms['mieDirectionalG']), { onNone: () => {}, onSome: (u) => { u.value = 0.7 } })
      return Schema.decodeUnknownSync(SkyMaterialPortSchema)({
        uniforms: {
          sunPosition: skyShaderMaterial.uniforms['sunPosition'],
          turbidity: skyShaderMaterial.uniforms['turbidity'],
          rayleigh: skyShaderMaterial.uniforms['rayleigh'],
        },
      })
    })

    const { skyNight, skyDay, skyCurrent } = yield* Effect.sync(() => ({
      skyNight: new THREE.Color(SKY_COLOR_NIGHT),
      skyDay: new THREE.Color(SKY_COLOR_DAY),
      skyCurrent: new THREE.Color(),
    }))

    yield* gameState.initialize(spawnPosition)

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

    yield* Option.match(worldBootstrap.savedPlayerState, {
      onNone: () => Effect.void,
      onSome: (saved) =>
        Effect.gen(function* () {
          yield* inventoryService.deserialize(saved.inventory)
          yield* healthService.reset()
          const resetHealth = yield* healthService.getHealth()
          const damageToApply = Math.max(0, resetHealth.current - saved.health)
          if (damageToApply > 0) {
            yield* healthService.applyDamage(damageToApply)
          }
        }),
    })

    yield* Option.match(worldBootstrap.savedFurnaceStates, {
      onNone: () => Effect.void,
      onSome: (saved) => furnaceService.deserialize(saved),
    })

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
    const dayNightRenderer = {
      setClearColor: (color: ColorPort) => renderer.setClearColor(new THREE.Color().setRGB(color.r, color.g, color.b)),
    }

    const { frameHandler, maintenanceHandler } = yield* createFrameHandlers(
      {
        renderer,
        scene,
        camera,
        respawnPosition: defaultRespawnPosition,
        lights: { light, ambientLight, renderer: dayNightRenderer, skyNight, skyDay, skyCurrent, sky: Option.some(skyPort) },
        skyMesh: Option.some(sky),
        fpsElement: Option.fromNullable(fpsElement),
        healthValueElement: Option.fromNullable(healthValueElement),
        healthMaxElement: Option.fromNullable(healthMaxElement),
        gamePausedRef,
        sessionPausedRef: control.isPausedRef,
        composer: Option.some(composer),
        gtaoPass,
        bloomPass,
        dofPass: bokehPass,
        godRaysPass,
        smaaPass,
      },
      {
        gameState,
        playerCameraState,
        firstPersonCamera,
        thirdPersonCamera,
        blockHighlight,
        inputService,
        blockService,
        hotbarService,
        hotbarRenderer,
        chunkManagerService,
        timeService,
        settingsService,
        settingsOverlay,
        pauseMenu,
        inventoryRenderer,
        inventoryService,
        fpsCounter,
        worldRendererService,
        entityRenderer,
        chunkMeshService,
        particleSystem,
        healthService,
        soundManager,
        musicManager,
        entityManager,
        mobSpawner,
        villageService,
        tradingPresentation,
        redstoneService,
        fluidService,
        furnaceService,
        perfHud,
        gameMode: gameModeService,
      },
    )

    yield* installQaApi({
      camera,
      scene,
      playerCameraState,
      blockHighlight,
      inputService,
      inventoryService,
      inventoryRenderer,
      gameState,
      chunkManagerService,
      blockService,
      hotbarService,
      recipeService,
      furnaceService,
      worldRendererService,
      entityManager,
    })

    yield* deathScreen.attach(control, defaultRespawnPosition)

    // FR-1.4: mount the in-session pause menu. Listens for ESC via the
    // frame-handler input stage (which calls `pauseMenu.openIfClosed(control)`)
    // and drives Resume / Settings / Save & Quit. Listeners + DOM are torn
    // down with the surrounding session scope on quit-to-title.
    yield* pauseMenu.attach(control, persistSessionState)

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
    })

    const frameHandlerWithBrowserEvents = wrapFrameHandlerWithBrowserEffects({
      pendingResizeRef,
      pendingSaveDirtyChunksRef,
      chunkManagerService,
      persistSessionState: persistSessionState().pipe(Effect.catchAllCause(() => Effect.void)),
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

    // Best-effort save flush before tearing down — release path also triggers
    // disposal of session-scoped GPU resources.
    yield* Effect.all(
      [chunkManagerService.saveDirtyChunks(), persistSessionState()],
      { concurrency: 'unbounded', discard: true },
    ).pipe(Effect.catchAllCause(() => Effect.void))

    return { reason: 'quit-to-title' as const, control }
  })
