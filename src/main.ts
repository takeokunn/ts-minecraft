import { Array as Arr, Cause, Clock, Duration, Effect, Option, Random, Ref, Schedule, Schema, MutableRef } from 'effect'
import { StartupError } from '@/domain/errors'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { Sky } from 'three/addons/objects/Sky.js'
import { GodRaysPass } from '@/infrastructure/three/god-rays-pass'

import { RendererService } from '@/infrastructure/three/renderer/renderer-service'
import { SceneService } from '@/infrastructure/three/scene/scene-service'
import { PerspectiveCameraService } from '@/infrastructure/three/camera/perspective'
import { WorldRendererService } from '@/infrastructure/three/world-renderer'
import { EntityRendererService } from '@/infrastructure/three/entity-renderer'
import { ChunkMeshService } from '@/infrastructure/three/meshing/chunk-mesh'

import { NoiseService } from '@/infrastructure/noise/noise-service'
import { StorageService } from '@/infrastructure/storage/storage-service'

import { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import { GameStateService } from '@/application/game-state'
import { BlockService } from '@/application/block/block-service'
import { HotbarService } from '@/application/hotbar/hotbar-service'
import { PlayerCameraStateService } from '@/application/camera/camera-state'
import { FirstPersonCameraService } from '@/application/camera/first-person-camera-service'
import { ThirdPersonCameraService } from '@/application/camera/third-person-camera-service'
import { CrosshairService } from '@/presentation/hud/crosshair'
import { BlockHighlightService } from '@/presentation/highlight/block-highlight'
import { InputService } from '@/presentation/input/input-service'
import { HotbarRendererService } from '@/presentation/hud/hotbar-three'
import { FPSCounterService } from '@/presentation/fps-counter'
import { TimeService } from '@/application/time/time-service'
import { SettingsService, resolvePreset } from '@/application/settings/settings-service'
import { SettingsOverlayService } from '@/presentation/settings/settings-overlay'
import { InventoryRendererService } from '@/presentation/inventory/inventory-renderer'
import { InventoryService } from '@/application/inventory/inventory-service'
import { RecipeService } from '@/application/crafting/recipe-service'
import { HealthService } from '@/application/player/health-service'
import { MusicManager, SoundManager } from '@/audio'
import { EntityManager } from '@/entity/entityManager'
import { MobSpawner } from '@/entity/spawner'
import { VillageService } from '@/village/village-service'
import { TradingPresentationService } from '@/presentation/trading'
import { RedstoneService } from '@/redstone/redstone-service'
import { FluidService } from '@/application/fluid/fluid-service'
import { FurnaceService } from '@/application/furnace/furnace-service'
import { GameLoopService } from '@/application/game-loop'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex } from '@/domain/chunk'
import { DEFAULT_PLAYER_ID } from '@/application/constants'
import { MAX_SHADOW_HALF_EXTENT } from '@/shared/rendering-constants'

import { MainLive } from '@/layers'
import { createFrameHandlers } from '@/frame-handler'
import { installBrowserEventBridge, type PendingResize, wrapFrameHandlerWithBrowserEffects } from '@/main/browser-runtime'
import { installQaApi } from '@/main/qa-api'
import { type ColorPort } from '@/shared/math/three'
import { SkyMaterialPortSchema } from '@/shared/math/three/day-night-port'

import { WorldId } from '@/shared/kernel'
import {
  MAX_SEED_VALUE,
  SUN_COLOR, AMBIENT_COLOR, SKY_COLOR_NIGHT, SKY_COLOR_DAY,
  BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD,
  BOKEH_FOCUS, BOKEH_APERTURE, BOKEH_MAXBLUR,
  GTAO_BLEND_INTENSITY,
} from '@/main.config'

// World identifier used for all storage operations
const WORLD_ID = WorldId.make('world-1')

// Main application
const mainProgram = Effect.gen(function* () {
  // Get canvas element
  const canvas = yield* Effect.sync(() => document.getElementById('game-canvas')).pipe(
    Effect.flatMap((el) =>
      el instanceof HTMLCanvasElement
        ? Effect.succeed(el)
        : Effect.fail(new StartupError({ reason: 'Canvas element not found' }))
    ),
    Effect.mapError((error) =>
      error instanceof StartupError ? error : new StartupError({ reason: 'Failed to get canvas', cause: error })
    )
  )

  // Get infrastructure services
  const rendererService = yield* RendererService
  const sceneService = yield* SceneService
  const cameraService = yield* PerspectiveCameraService
  const worldRendererService = yield* WorldRendererService
  const entityRenderer = yield* EntityRendererService
  const chunkMeshService = yield* ChunkMeshService

  // Game state, camera, input, block interaction, and hotbar
  const gameState = yield* GameStateService
  const playerCameraState = yield* PlayerCameraStateService
  const firstPersonCamera = yield* FirstPersonCameraService
  const thirdPersonCamera = yield* ThirdPersonCameraService
  const crosshair = yield* CrosshairService
  const blockHighlight = yield* BlockHighlightService
  const inputService = yield* InputService
  const blockService = yield* BlockService
  const hotbarService = yield* HotbarService

  // Rendering: HUD and FPS
  const hotbarRenderer = yield* HotbarRendererService
  const fpsCounter = yield* FPSCounterService

  // World generation and persistence
  const chunkManagerService = yield* ChunkManagerService
  // Composition root: direct infrastructure service access is intentional here.
  // main.ts is the application entry point and wires services together.
  // NoiseService is used for seeding (not a chunk-manager concern);
  // StorageService is used for world metadata (not in StorageServicePort which is chunk-only).
  const noiseService = yield* NoiseService
  const storageService = yield* StorageService

  // Time, settings, and UI overlays
  const timeService = yield* TimeService
  const settingsService = yield* SettingsService
  const settingsOverlay = yield* SettingsOverlayService
  const inventoryRenderer = yield* InventoryRendererService
  const inventoryService = yield* InventoryService
  const recipeService = yield* RecipeService

  // Health service for fall damage and HP tracking
  const healthService = yield* HealthService

  // Sound and music services
  const soundManager = yield* SoundManager
  const musicManager = yield* MusicManager

  // Entity system services (Phase 13 foundation)
  const entityManager = yield* EntityManager
  const mobSpawner = yield* MobSpawner

  // Village and trading services (Phase 15 foundation)
  const villageService = yield* VillageService
  const tradingPresentation = yield* TradingPresentationService

  // Redstone simulation service (Phase 16 foundation)
  const redstoneService = yield* RedstoneService

  // Fluid simulation service (water propagation)
  const fluidService = yield* FluidService
  const furnaceService = yield* FurnaceService
  const gameLoopService = yield* GameLoopService

  // Create renderer
  const renderer = yield* rendererService.create(canvas)

  // Shadow map: always initialized as enabled (cannot change after first render).
  // castShadow on lights is toggled per-frame based on settings.
  yield* Effect.sync(() => {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.shadowMap.autoUpdate = false
    renderer.shadowMap.needsUpdate = true
  })

  // Create scene
  const scene = yield* sceneService.create()

  // Load settings early — needed for dynamic camera far plane before first frame
  const initialSettings = yield* settingsService.getSettings()
  const initialGraphics = resolvePreset(initialSettings.graphicsQuality)

  // Create camera with dynamic far plane based on renderDistance.
  // Formula: renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT gives enough depth
  // to cover the diagonal of the visible chunk area plus full vertical range.
  // Floor of 300 prevents z-fighting at low render distances.
  const camera = yield* cameraService.create({
    fov: 75,
    aspect: canvas.clientWidth / canvas.clientHeight,
    near: 0.1,
    far: Math.max(initialSettings.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300),
  })

  // EffectComposer: HDR render target required for UnrealBloomPass to work correctly.
  // The composer render target stays HDR so live preset changes can safely enable bloom later.
  // Pass instances themselves are always constructed so live preset changes can enable them later
  // without silently no-oping. Disabled passes are immediately shrunk to 1x1 (or half-res for GTAO)
  // to minimize steady-state cost until a preset turns them on.
  const { composerRT, composer, gtaoPass, godRaysPass, bloomPass, bokehPass, smaaPass } = yield* Effect.sync(() => {
    const rt = new THREE.WebGLRenderTarget(
      canvas.clientWidth,
      canvas.clientHeight,
      { type: THREE.HalfFloatType }
    )
    const comp = new EffectComposer(renderer, rt)
    comp.addPass(new RenderPass(scene, camera))

    // GTAO replaces SSAO (Ground Truth Ambient Occlusion — higher quality)
    const gtaoPassInstance = new GTAOPass(scene, camera, canvas.clientWidth, canvas.clientHeight)
    gtaoPassInstance.blendIntensity = GTAO_BLEND_INTENSITY
    gtaoPassInstance.enabled = initialGraphics.ssaoEnabled
    gtaoPassInstance.setSize(
      initialGraphics.ssaoEnabled ? Math.ceil(canvas.clientWidth / 2) : 1,
      initialGraphics.ssaoEnabled ? Math.ceil(canvas.clientHeight / 2) : 1,
    )
    comp.addPass(gtaoPassInstance)
    const gtao: Option.Option<GTAOPass> = Option.some(gtaoPassInstance)

    // God rays (crepuscular light shafts — screen-space radial blur)
    const godRaysPassInstance = new GodRaysPass()
    godRaysPassInstance.enabled = initialGraphics.godRaysEnabled
    godRaysPassInstance.setSize(initialGraphics.godRaysEnabled ? canvas.clientWidth : 1, initialGraphics.godRaysEnabled ? canvas.clientHeight : 1)
    comp.addPass(godRaysPassInstance)
    const godRays: Option.Option<GodRaysPass> = Option.some(godRaysPassInstance)

    // Bloom: BLOOM_THRESHOLD prevents terrain from glowing; only sky/lava-bright surfaces bloom
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

    // Depth of field (bokeh)
    const bokehPassInstance = new BokehPass(scene, camera, {
      focus: BOKEH_FOCUS,
      aperture: BOKEH_APERTURE,
      maxblur: BOKEH_MAXBLUR,
    })
    bokehPassInstance.enabled = initialGraphics.dofEnabled
    bokehPassInstance.setSize(initialGraphics.dofEnabled ? canvas.clientWidth : 1, initialGraphics.dofEnabled ? canvas.clientHeight : 1)
    comp.addPass(bokehPassInstance)
    const bokeh: Option.Option<BokehPass> = Option.some(bokehPassInstance)

    // SMAA anti-aliasing (must be after bloom, before OutputPass)
    const smaaPassInstance = new SMAAPass(canvas.clientWidth, canvas.clientHeight)
    smaaPassInstance.enabled = initialGraphics.smaaEnabled
    smaaPassInstance.setSize(initialGraphics.smaaEnabled ? canvas.clientWidth : 1, initialGraphics.smaaEnabled ? canvas.clientHeight : 1)
    comp.addPass(smaaPassInstance)
    const smaa: Option.Option<SMAAPass> = Option.some(smaaPassInstance)

    comp.addPass(new OutputPass())

    return { composerRT: rt, composer: comp, gtaoPass: gtao, godRaysPass: godRays, bloomPass: bloom, bokehPass: bokeh, smaaPass: smaa }
  })

  // World initialization: load or create world metadata, set noise seed
  const existingMetadata = yield* storageService.loadWorldMetadata(WORLD_ID)
  const worldBootstrap = yield* Option.match(existingMetadata, {
    onSome: (metadata) =>
      // Null-guard: old metadata format may not have playerSpawn (pre-migration)
      noiseService.setSeed(metadata.seed).pipe(
        Effect.andThen(Effect.log(`Loaded world '${WORLD_ID}' with seed ${metadata.seed}`)),
        Effect.as({
          seed: metadata.seed,
          createdAt: metadata.createdAt,
          baseSpawnPosition: Option.getOrElse(Option.fromNullable(metadata.playerSpawn), () => ({ x: 0, y: 100, z: 0 })),
          savedPlayerState: Option.fromNullable(metadata.playerState),
          savedFurnaceStates: Option.fromNullable(metadata.furnaceStates),
        })
      ),
    onNone: () =>
      Effect.all([Random.nextIntBetween(0, MAX_SEED_VALUE), Clock.currentTimeMillis], { concurrency: 'unbounded' }).pipe(
        Effect.flatMap(([seed, nowMs]) => {
          const pos = { x: 0, y: 100, z: 0 }
          const now = new Date(nowMs)
          return noiseService.setSeed(seed).pipe(
            Effect.andThen(storageService.saveWorldMetadata(WORLD_ID, { seed, createdAt: now, lastPlayed: now, playerSpawn: pos })),
            Effect.andThen(Effect.log(`Created new world '${WORLD_ID}' with seed ${seed}`)),
            Effect.as({
              seed,
              createdAt: now,
              baseSpawnPosition: pos,
              savedPlayerState: Option.none(),
              savedFurnaceStates: Option.none(),
            })
          )
        })
      ),
  })

  const persistSessionState = () =>
    Effect.gen(function* () {
      const nowMs = yield* Clock.currentTimeMillis
      const playerPosition = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
      const inventory = yield* inventoryService.serialize()
      const health = yield* healthService.getHealth()
      const timeOfDay = yield* timeService.getTimeOfDay()
      const furnaceStates = yield* furnaceService.serialize()
      yield* storageService.saveWorldMetadata(WORLD_ID, {
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
      })
    })

  const initialChunkLoadAnchor = Option.getOrElse(
    Option.map(worldBootstrap.savedPlayerState, (saved) => saved.position),
    () => worldBootstrap.baseSpawnPosition,
  )

  // Initialize: load chunks around the effective startup position, not always world spawn.
  // This ensures resumed sessions prewarm the correct surrounding chunks before the first frame.
  yield* chunkManagerService.loadChunksAroundPlayer(initialChunkLoadAnchor, initialSettings.renderDistance)
  const initialChunks = yield* chunkManagerService.getLoadedChunks()
  yield* worldRendererService.syncChunksToScene(initialChunks, scene)

  const defaultRespawnPosition = yield* Effect.gen(function* () {
    const spawnChunk = yield* chunkManagerService.getChunk({ x: 0, z: 0 })
    const spawnBlocks: Readonly<Uint8Array> = spawnChunk.blocks
    const surfaceY = Option.getOrElse(
      Arr.findFirst(
        Arr.makeBy(CHUNK_HEIGHT, (i) => CHUNK_HEIGHT - 1 - i),
        (y) => {
          return Option.match(blockIndex(0, y, 0), {
            onNone: () => false,
            onSome: (idx) => spawnBlocks[idx] !== 0,
          })
        }
      ),
      () => 64,
    )
    return { ...worldBootstrap.baseSpawnPosition, y: surfaceY + 1 + 3 }
  })

  const spawnPosition = Option.getOrElse(
    Option.map(worldBootstrap.savedPlayerState, (saved) => saved.position),
    () => defaultRespawnPosition,
  )

  // initialSettings + initialGraphics loaded earlier (before camera creation) for dynamic far plane

  // Add directional light (sun — intensity driven by day/night cycle)
  const light = yield* Effect.sync(() => {
    const l = new THREE.DirectionalLight(SUN_COLOR, 1)
    // Shadow map: 2048 balances quality and GPU memory (was 4096 — 75% memory reduction)
    l.shadow.mapSize.width = 2048
    l.shadow.mapSize.height = 2048
    l.shadow.camera.near = 0.5
    l.shadow.camera.far = Math.max(initialSettings.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300)
    // Shadow frustum sized to renderDistance — tighter frustum = higher texel density.
    // Half the chunk span gives good coverage without wasting shadow map on distant terrain.
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
  // light.target must be in the scene graph for target position updates to take effect
  yield* sceneService.add(scene, light.target)

  // Add ambient light (sky — intensity driven by day/night cycle)
    const ambientLight = yield* Effect.sync(() => new THREE.AmbientLight(AMBIENT_COLOR, 0.35))
  yield* sceneService.add(scene, ambientLight)

  // Physical sky: Three.Sky Preetham model — replaces simple sky color lerp when enabled
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

    // SkyMaterialPort: duck-typed view of sky uniforms for DayNightLightsPort
    return Schema.decodeUnknownSync(SkyMaterialPortSchema)({
      uniforms: {
        sunPosition: skyShaderMaterial.uniforms['sunPosition'],
        turbidity: skyShaderMaterial.uniforms['turbidity'],
        rayleigh: skyShaderMaterial.uniforms['rayleigh'],
      },
    })
  })

  // Precomputed sky colors for smooth day/night lerp
  const { skyNight, skyDay, skyCurrent } = yield* Effect.sync(() => ({
    skyNight: new THREE.Color(SKY_COLOR_NIGHT),
    skyDay: new THREE.Color(SKY_COLOR_DAY),
    skyCurrent: new THREE.Color(),
  }))

  // Initialize game state. The legacy groundY parameter is retained for API compatibility only.
  yield* gameState.initialize(spawnPosition, 0)

  // Auto-save: start only after game state initialization so player state exists.
  yield* Effect.forkDaemon(
    Effect.repeat(
      Effect.all([
        chunkManagerService.saveDirtyChunks(),
        persistSessionState(),
      ], { concurrency: 'unbounded', discard: true }).pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Auto-save error: ${Cause.pretty(cause)}`))
      ),
      Schedule.spaced(Duration.seconds(5))
    )
  )

  yield* Option.match(worldBootstrap.savedPlayerState, {
    onNone: () => Effect.void,
    onSome: (saved) => Effect.gen(function* () {
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

  // Initialize block highlight
  yield* blockHighlight.initialize(scene)

  // Initialize hotbar renderer
  yield* hotbarRenderer.initialize(canvas.clientWidth, canvas.clientHeight)

  // Apply initial day length from persisted settings, then set time to noon for visibility
  yield* timeService.setDayLength(initialSettings.dayLengthSeconds)
  yield* Option.match(worldBootstrap.savedPlayerState, {
    onNone: () => timeService.setTimeOfDay(0.5),
    onSome: (saved) => timeService.setTimeOfDay(saved.timeOfDay),
  })

  // Show crosshair
  yield* crosshair.show()

  const pendingResizeRef = MutableRef.make<Option.Option<PendingResize>>(Option.none())
  const pendingSaveDirtyChunksRef = MutableRef.make(false)
  yield* installBrowserEventBridge({
    canvas,
    inputPointerLock: inputService.requestPointerLock(),
    pendingResizeRef,
    pendingSaveDirtyChunksRef,
  })

  yield* Effect.acquireRelease(
    Effect.void,
    () => Effect.sync(() => {
      const passes: ReadonlyArray<Option.Option<{ dispose(): void }>> = [gtaoPass, bloomPass, bokehPass, godRaysPass, smaaPass]
      Arr.forEach(passes, (pass) => Option.match(pass, { onNone: () => {}, onSome: (p) => p.dispose() }))
      composerRT.dispose()
      composer.dispose()
    })
  )

  // FPS and health display elements
  const { fpsElement, healthValueElement, healthMaxElement } = yield* Effect.sync(() => ({
    fpsElement: document.getElementById('fps-value'),
    healthValueElement: document.getElementById('health-value'),
    healthMaxElement: document.getElementById('health-max'),
  }))

  // Game pause state: true when a modal overlay (settings/inventory) is open
  const gamePausedRef = yield* Ref.make(false)
  const dayNightRenderer = {
    setClearColor: (color: ColorPort) => renderer.setClearColor(new THREE.Color().setRGB(color.r, color.g, color.b)),
  }

  // Build frame handler: Three.js deps plus all explicit service instances.
  // Services are passed directly (not via Effect context) so R = never,
  // avoiding the per-frame Effect.provide(MainLive) that re-builds all 30+ layers every frame.
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
      inventoryRenderer,
      inventoryService,
      fpsCounter,
      worldRendererService,
      entityRenderer,
      chunkMeshService,
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
    }
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

  yield* Effect.acquireRelease(
    Effect.all([
      gameLoopService.start(frameHandlerWithBrowserEvents),
      gameLoopService.startMaintenance(maintenanceHandler),
    ], { concurrency: 'unbounded', discard: true }),
    () => gameLoopService.stop()
  )

  // Keep the scope alive for the entire application lifetime.
  // Effect.scoped would close all scoped resources (DOM elements, event listeners) the moment
  // mainProgram's Effect.gen returns. Effect.never prevents that — scoped services such as
  // SettingsOverlayService and InventoryRendererService keep their DOM elements alive.
  yield* Effect.never
})

// Run program with all layers provided
Effect.runFork(
  mainProgram.pipe(
    Effect.scoped,
    Effect.provide(MainLive),
    Effect.catchAllCause((cause): Effect.Effect<void, never, never> =>
      Effect.logError(`Startup failed: ${Cause.pretty(cause)}`).pipe(Effect.asVoid)
    ),
  ),
)
