import { Cause, Clock, Duration, Effect, Option, Random, Ref, Schedule } from 'effect'
import { StartupError } from '@/domain/errors'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js'
import { SSRPass } from 'three/addons/postprocessing/SSRPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { Sky } from 'three/addons/objects/Sky.js'
import { GodRaysPass } from '@/infrastructure/three/god-rays-pass'

import { RendererService } from '@/infrastructure/three/renderer/renderer-service'
import { SceneService } from '@/infrastructure/three/scene/scene-service'
import { PerspectiveCameraService } from '@/infrastructure/three/camera/perspective'
import { WorldRendererService } from '@/infrastructure/three/world-renderer'

import { NoiseService } from '@/infrastructure/noise/noise-service'
import { StorageService } from '@/infrastructure/storage/storage-service'

import { ChunkManagerService } from '@/application/chunk/chunk-manager-service'
import { GameStateService } from '@/application/game-state'
import { BlockService } from '@/application/block/block-service'
import { HotbarService } from '@/application/hotbar/hotbar-service'
import { FirstPersonCameraService } from '@/application/camera/first-person-camera-service'
import { CrosshairService } from '@/presentation/hud/crosshair'
import { BlockHighlightService } from '@/presentation/highlight/block-highlight'
import { InputService } from '@/presentation/input/input-service'
import { HotbarRendererService } from '@/presentation/hud/hotbar-three'
import { FPSCounterService } from '@/presentation/fps-counter'
import { TimeService } from '@/application/time/time-service'
import { SettingsService } from '@/application/settings/settings-service'
import { SettingsOverlayService } from '@/presentation/settings/settings-overlay'
import { InventoryRendererService } from '@/presentation/inventory/inventory-renderer'
import { GameLoopService } from '@/application/game-loop'
import { HealthService } from '@/application/player/health-service'
import { CHUNK_HEIGHT, blockIndex } from '@/domain/chunk'

import { MainLive } from '@/layers'
import { createFrameHandler } from '@/frame-handler'

import { WorldId } from '@/shared/kernel'

// World identifier used for all storage operations
const WORLD_ID = WorldId.make('world-1')

// Named constants for magic values used during world initialization and lighting setup
const MAX_SEED_VALUE = 0xFFFFFFFF
const SUN_COLOR = 0xffffff
const AMBIENT_COLOR = 0x404040
const SKY_COLOR_NIGHT = 0x0a0a1a // dark blue
const SKY_COLOR_DAY = 0x87ceeb  // sky blue

// Main application
const mainProgram = Effect.gen(function* () {
  // Get canvas element
  const canvas = yield* Effect.gen(function* () {
    const el = document.getElementById('game-canvas')
    if (!el) return yield* Effect.fail(new StartupError({ reason: 'Canvas element not found' }))
    return el as HTMLCanvasElement
  }).pipe(
    Effect.mapError((error) =>
      error instanceof StartupError ? error : new StartupError({ reason: 'Failed to get canvas', cause: error })
    )
  )

  // Get infrastructure services
  const rendererService = yield* RendererService
  const sceneService = yield* SceneService
  const cameraService = yield* PerspectiveCameraService
  const worldRendererService = yield* WorldRendererService

  // Game state, camera, input, block interaction, and hotbar
  const gameState = yield* GameStateService
  const firstPersonCamera = yield* FirstPersonCameraService
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

  // Get game loop service
  const gameLoopService = yield* GameLoopService

  // Health service for fall damage and HP tracking
  const healthService = yield* HealthService

  // Create renderer
  const renderer = yield* rendererService.create(canvas)

  // Shadow map: always initialized as enabled (cannot change after first render).
  // castShadow on lights is toggled per-frame based on settings.
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  // Create scene
  const scene = yield* sceneService.create()

  // Create camera
  const camera = yield* cameraService.create({
    fov: 75,
    aspect: canvas.clientWidth / canvas.clientHeight,
    near: 0.1,
    far: 1000,
  })

  // EffectComposer: HDR render target required for UnrealBloomPass to work correctly
  const composerRT = new THREE.WebGLRenderTarget(
    canvas.clientWidth,
    canvas.clientHeight,
    { type: THREE.HalfFloatType }
  )
  const composer = new EffectComposer(renderer, composerRT)
  composer.addPass(new RenderPass(scene, camera))

  // GTAO replaces SSAO (Ground Truth Ambient Occlusion — higher quality)
  const gtaoPass = new GTAOPass(scene, camera, canvas.clientWidth, canvas.clientHeight)
  gtaoPass.blendIntensity = 1.0
  composer.addPass(gtaoPass)

  // SSR (screen-space reflections for water surfaces)
  // groundReflector is typed as required in SSRPassParams but works as null at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ssrPass = new SSRPass({ renderer, scene, camera, width: canvas.clientWidth, height: canvas.clientHeight, selects: [] as THREE.Mesh[], groundReflector: null } as any)
  composer.addPass(ssrPass)

  // God rays (crepuscular light shafts — screen-space radial blur)
  const godRaysPass = new GodRaysPass()
  composer.addPass(godRaysPass)

  // Bloom: threshold=0.85 prevents terrain from glowing; only sky/lava-bright surfaces bloom
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
    0.5,  // strength
    0.4,  // radius
    0.85, // threshold
  )
  composer.addPass(bloomPass)

  // Depth of field (bokeh)
  const bokehPass = new BokehPass(scene, camera, { focus: 10.0, aperture: 0.002, maxblur: 0.01 })
  composer.addPass(bokehPass)

  // SMAA anti-aliasing (must be after bloom, before OutputPass)
  const smaaPass = new SMAAPass(canvas.clientWidth, canvas.clientHeight)
  composer.addPass(smaaPass)

  composer.addPass(new OutputPass())

  // World initialization: load or create world metadata, set noise seed
  const existingMetadata = yield* storageService.loadWorldMetadata(WORLD_ID)
  let spawnPosition: { x: number; y: number; z: number }

  if (Option.isSome(existingMetadata)) {
    const metadata = existingMetadata.value
    yield* noiseService.setSeed(metadata.seed)
    // Null-guard: old metadata format may not have playerSpawn (pre-migration)
    spawnPosition = metadata.playerSpawn ?? { x: 0, y: 100, z: 0 }
    yield* Effect.log(`Loaded world '${WORLD_ID}' with seed ${metadata.seed}`)
  } else {
    const seed = yield* Random.nextIntBetween(0, MAX_SEED_VALUE)
    yield* noiseService.setSeed(seed)
    spawnPosition = { x: 0, y: 100, z: 0 }
    const nowMs = yield* Clock.currentTimeMillis
    const now = new Date(nowMs)
    yield* storageService.saveWorldMetadata(WORLD_ID, {
      seed,
      createdAt: now,
      lastPlayed: now,
      playerSpawn: spawnPosition,
    })
    yield* Effect.log(`Created new world '${WORLD_ID}' with seed ${seed}`)
  }

  // Auto-save: persist dirty chunks every 5 seconds using Effect scheduler
  yield* Effect.forkDaemon(
    Effect.repeat(
      chunkManagerService.saveDirtyChunks().pipe(
        Effect.catchAllCause((cause) => Effect.logError(`Auto-save error: ${Cause.pretty(cause)}`))
      ),
      Schedule.spaced(Duration.seconds(5))
    )
  )

  // Initialize: load chunks around spawn position, sync to scene
  yield* chunkManagerService.loadChunksAroundPlayer(spawnPosition)
  const initialChunks = yield* chunkManagerService.getLoadedChunks()
  yield* worldRendererService.syncChunksToScene(initialChunks, scene)

  // Determine terrain surface height at spawn column (lx=0, lz=0 of chunk 0,0)
  // by scanning downward from the top until we find a non-air block.
  // This aligns the physics ground plane with the visual terrain surface.
  const spawnChunk = yield* chunkManagerService.getChunk({ x: 0, z: 0 })
  // readonly snapshot for spawn height detection
  const spawnBlocks = spawnChunk.blocks as Readonly<Uint8Array>
  let surfaceY = 64 // fallback to sea level
  for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
    const idx = blockIndex(0, y, 0) // lx=0, lz=0
    if (idx !== null && spawnBlocks[idx] !== 0) { // 0 = AIR
      surfaceY = y
      break
    }
  }
  // surfaceY is the block INDEX of the highest solid block.
  // The visual top surface of that block is at surfaceY + 1 (blocks render as [y, y+1] cubes).
  // Spawn player 3 blocks above the visual terrain surface.
  spawnPosition = { ...spawnPosition, y: surfaceY + 1 + 3 }

  // Add directional light (sun — intensity driven by day/night cycle)
  const light = new THREE.DirectionalLight(SUN_COLOR, 1)
  // Configure shadow map: 2048×2048 resolution, frustum covers render area (8 chunks × 16 = 128 units)
  light.shadow.mapSize.width = 2048
  light.shadow.mapSize.height = 2048
  light.shadow.camera.near = 0.5
  light.shadow.camera.far = 500
  light.shadow.camera.left = -128
  light.shadow.camera.right = 128
  light.shadow.camera.top = 128
  light.shadow.camera.bottom = -128
  light.position.set(5, 10, 7)
  yield* sceneService.add(scene, light)
  // light.target must be in the scene graph for target position updates to take effect
  yield* sceneService.add(scene, light.target)

  // Add ambient light (sky — intensity driven by day/night cycle)
  const ambientLight = new THREE.AmbientLight(AMBIENT_COLOR, 0.5)
  yield* sceneService.add(scene, ambientLight)

  // Physical sky: Three.Sky Preetham model — replaces simple sky color lerp when enabled
  const sky = new Sky()
  sky.scale.setScalar(10000)
  yield* sceneService.add(scene, sky)
  const skyShaderMaterial = sky.material as THREE.ShaderMaterial
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  skyShaderMaterial.uniforms['mieCoefficient']!.value = 0.005
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  skyShaderMaterial.uniforms['mieDirectionalG']!.value = 0.7

  // SkyMaterialPort: duck-typed view of sky uniforms for DayNightLightsPort
  const skyPort: import('@/shared/math/three/day-night-port').SkyMaterialPort = {
    uniforms: {
      sunPosition: skyShaderMaterial.uniforms['sunPosition'] as { value: { set(x: number, y: number, z: number): void } },
      turbidity: skyShaderMaterial.uniforms['turbidity'] as { value: number },
      rayleigh: skyShaderMaterial.uniforms['rayleigh'] as { value: number },
    },
  }

  // Precomputed sky colors for smooth day/night lerp
  const skyNight = new THREE.Color(SKY_COLOR_NIGHT)
  const skyDay = new THREE.Color(SKY_COLOR_DAY)
  const skyCurrent = new THREE.Color()

  // Initialize game state — physics ground plane at visual terrain surface (surfaceY + 1)
  yield* gameState.initialize(spawnPosition, surfaceY + 1)

  // Initialize block highlight
  yield* blockHighlight.initialize(scene)

  // Initialize hotbar renderer
  yield* hotbarRenderer.initialize(canvas.clientWidth, canvas.clientHeight)

  // Apply initial day length from persisted settings, then set time to noon for visibility
  const initialSettings = yield* settingsService.getSettings()
  // Apply initial shadow state from persisted settings
  light.castShadow = initialSettings.shadowsEnabled
  yield* timeService.setDayLength(initialSettings.dayLengthSeconds)
  yield* timeService.setTimeOfDay(0.5)

  // Show crosshair
  yield* crosshair.show()

  // Define named handlers so removeEventListener can match the same reference
  const handleVisibilityChange = () => {
    if (document.hidden) {
      // runFork is used in DOM event handlers (not runPromise) — fire-and-forget without blocking
      Effect.runFork(
        chunkManagerService.saveDirtyChunks().pipe(
          Effect.catchAllCause(() => Effect.void)
        )
      )
    }
  }
  const handleBeforeUnload = () => {
    Effect.runFork(chunkManagerService.saveDirtyChunks().pipe(Effect.catchAllCause(() => Effect.void)))
  }
  const handleCanvasClick = () => {
    Effect.runFork(
      inputService.requestPointerLock().pipe(
        Effect.catchAllCause((cause) => Effect.logError('pointer lock failed', cause))
      )
    )
  }

  yield* Effect.acquireRelease(
    Effect.sync(() => {
      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('beforeunload', handleBeforeUnload)
      canvas.addEventListener('click', handleCanvasClick)
    }),
    () => Effect.sync(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      canvas.removeEventListener('click', handleCanvasClick)
    })
  )

  yield* Effect.acquireRelease(
    Effect.void,
    () => Effect.sync(() => {
      gtaoPass.dispose()
      bloomPass.dispose()
      bokehPass.dispose()
      ssrPass.dispose()
      godRaysPass.dispose()
      smaaPass.dispose()
      composerRT.dispose()
      composer.dispose()
    })
  )

  // FPS display
  const fpsElement = document.getElementById('fps-value')

  // Health display
  const healthValueElement = document.getElementById('health-value')
  const healthMaxElement = document.getElementById('health-max')

  // Game pause state: true when a modal overlay (settings/inventory) is open
  const gamePausedRef = yield* Ref.make(false)

  // Build frame handler: Three.js deps plus all explicit service instances.
  // Services are passed directly (not via Effect context) so R = never,
  // avoiding the per-frame Effect.provide(MainLive) that re-builds all 30+ layers every frame.
  const frameHandler = createFrameHandler(
    {
      renderer,
      scene,
      camera,
      lights: { light, ambientLight, renderer, skyNight, skyDay, skyCurrent, sky: skyPort },
      skyMesh: sky,
      fpsElement,
      healthValueElement,
      healthMaxElement,
      gamePausedRef,
      composer,
      gtaoPass,
      bloomPass,
      ssrPass,
      dofPass: bokehPass,
      godRaysPass,
      smaaPass,
    },
    {
      gameState,
      firstPersonCamera,
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
      fpsCounter,
      worldRendererService,
      healthService,
    }
  )

  yield* Effect.log('Game initialized — inventory, day/night cycle, and settings ready')

  // Start the game loop via GameLoopService
  yield* gameLoopService.start(frameHandler)

  // Keep the scope alive for the entire application lifetime.
  // Effect.scoped would close all scoped resources (DOM elements, event listeners) the moment
  // mainProgram's Effect.gen returns. Effect.never prevents that — scoped services such as
  // SettingsOverlayService and InventoryRendererService keep their DOM elements alive.
  yield* Effect.never
})

// Run program with all layers provided
Effect.runPromise(
  mainProgram.pipe(
    Effect.scoped,
    Effect.provide(MainLive),
    Effect.catchAllCause(cause =>
      Effect.logError(`Startup failed: ${Cause.pretty(cause)}`)
    ),
  ),
)
