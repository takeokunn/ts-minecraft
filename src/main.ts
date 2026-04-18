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
import { HOTBAR_START } from '@/application/inventory/inventory-service'
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
import { DeltaTimeSecs } from '@/shared/kernel'
import { EntityManager } from '@/entity/entityManager'
import { EntityType } from '@/entity/entity'
import { MobSpawner } from '@/entity/spawner'
import { VillageService } from '@/village/village-service'
import { TradingPresentationService } from '@/presentation/trading'
import { RedstoneService } from '@/redstone/redstone-service'
import { FluidService } from '@/application/fluid/fluid-service'
import { GameLoopService } from '@/application/game-loop'
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex, setBlockInChunk } from '@/domain/chunk'
import { MAX_SHADOW_HALF_EXTENT } from '@/shared/rendering-constants'

import { MainLive } from '@/layers'
import { createFrameHandler } from '@/frame-handler'
import { type ColorPort } from '@/shared/math/three'
import { SkyMaterialPortSchema } from '@/shared/math/three/day-night-port'

import { SlotIndex, WorldId } from '@/shared/kernel'
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
  const gameLoopService = yield* GameLoopService

  // Create renderer
  const renderer = yield* rendererService.create(canvas)

  // Shadow map: always initialized as enabled (cannot change after first render).
  // castShadow on lights is toggled per-frame based on settings.
  yield* Effect.sync(() => {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
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

  // EffectComposer: HDR render target required for UnrealBloomPass to work correctly
  // FR-013: Use 8-bit RT when bloom is disabled at startup (50% bandwidth savings).
  // This is a one-time decision — changing quality mid-session does not recreate the composer.
  // FR-013: Deferred pass construction — only allocate GPU render targets and compile shaders
  // for passes that are enabled at startup. Disabled passes get Option.none(), saving VRAM
  // and startup shader compilation time.
  const { composerRT, composer, gtaoPass, godRaysPass, bloomPass, bokehPass, smaaPass } = yield* Effect.sync(() => {
    const composerType = initialGraphics.bloomEnabled ? THREE.HalfFloatType : THREE.UnsignedByteType
    const rt = new THREE.WebGLRenderTarget(
      canvas.clientWidth,
      canvas.clientHeight,
      { type: composerType }
    )
    const comp = new EffectComposer(renderer, rt)
    comp.addPass(new RenderPass(scene, camera))

    // GTAO replaces SSAO (Ground Truth Ambient Occlusion — higher quality)
    const gtao: Option.Option<GTAOPass> = initialGraphics.ssaoEnabled
      ? Option.some((() => { const p = new GTAOPass(scene, camera, canvas.clientWidth, canvas.clientHeight); p.blendIntensity = GTAO_BLEND_INTENSITY; comp.addPass(p); return p })())
      : Option.none()

    // God rays (crepuscular light shafts — screen-space radial blur)
    const godRays: Option.Option<GodRaysPass> = initialGraphics.godRaysEnabled
      ? Option.some((() => { const p = new GodRaysPass(); comp.addPass(p); return p })())
      : Option.none()

    // Bloom: BLOOM_THRESHOLD prevents terrain from glowing; only sky/lava-bright surfaces bloom
    const bloom: Option.Option<UnrealBloomPass> = initialGraphics.bloomEnabled
      ? Option.some((() => { const p = new UnrealBloomPass(new THREE.Vector2(canvas.clientWidth, canvas.clientHeight), BLOOM_STRENGTH, BLOOM_RADIUS, BLOOM_THRESHOLD); comp.addPass(p); return p })())
      : Option.none()

    // Depth of field (bokeh)
    const bokeh: Option.Option<BokehPass> = initialGraphics.dofEnabled
      ? Option.some((() => { const p = new BokehPass(scene, camera, { focus: BOKEH_FOCUS, aperture: BOKEH_APERTURE, maxblur: BOKEH_MAXBLUR }); comp.addPass(p); return p })())
      : Option.none()

    // SMAA anti-aliasing (must be after bloom, before OutputPass)
    const smaa: Option.Option<SMAAPass> = initialGraphics.smaaEnabled
      ? Option.some((() => { const p = new SMAAPass(canvas.clientWidth, canvas.clientHeight); comp.addPass(p); return p })())
      : Option.none()

    comp.addPass(new OutputPass())

    return { composerRT: rt, composer: comp, gtaoPass: gtao, godRaysPass: godRays, bloomPass: bloom, bokehPass: bokeh, smaaPass: smaa }
  })

  // World initialization: load or create world metadata, set noise seed
  const existingMetadata = yield* storageService.loadWorldMetadata(WORLD_ID)
  const baseSpawnPosition = yield* Option.match(existingMetadata, {
    onSome: (metadata) =>
      // Null-guard: old metadata format may not have playerSpawn (pre-migration)
      noiseService.setSeed(metadata.seed).pipe(
        Effect.andThen(Effect.log(`Loaded world '${WORLD_ID}' with seed ${metadata.seed}`)),
        Effect.as(Option.getOrElse(Option.fromNullable(metadata.playerSpawn), () => ({ x: 0, y: 100, z: 0 })))
      ),
    onNone: () =>
      Effect.all([Random.nextIntBetween(0, MAX_SEED_VALUE), Clock.currentTimeMillis], { concurrency: 'unbounded' }).pipe(
        Effect.flatMap(([seed, nowMs]) => {
          const pos = { x: 0, y: 100, z: 0 }
          const now = new Date(nowMs)
          return noiseService.setSeed(seed).pipe(
            Effect.andThen(storageService.saveWorldMetadata(WORLD_ID, { seed, createdAt: now, lastPlayed: now, playerSpawn: pos })),
            Effect.andThen(Effect.log(`Created new world '${WORLD_ID}' with seed ${seed}`)),
            Effect.as(pos)
          )
        })
      ),
  })

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
  yield* chunkManagerService.loadChunksAroundPlayer(baseSpawnPosition, initialSettings.renderDistance)
  const initialChunks = yield* chunkManagerService.getLoadedChunks()
  yield* worldRendererService.syncChunksToScene(initialChunks, scene)

  // Determine terrain surface height at spawn column (lx=0, lz=0 of chunk 0,0)
  // by scanning downward from the top until we find a non-air block.
  // This aligns the physics ground plane with the visual terrain surface.
  const spawnChunk = yield* chunkManagerService.getChunk({ x: 0, z: 0 })
  // readonly snapshot for spawn height detection
  const spawnBlocks: Readonly<Uint8Array> = spawnChunk.blocks
  // surfaceY is the block INDEX of the highest solid block.
  // The visual top surface of that block is at surfaceY + 1 (blocks render as [y, y+1] cubes).
  // Spawn player 3 blocks above the visual terrain surface.
  const surfaceY = Option.getOrElse(
    Arr.findFirst(
      Arr.makeBy(CHUNK_HEIGHT, (i) => CHUNK_HEIGHT - 1 - i),
      (y) => {
        return Option.match(blockIndex(0, y, 0), { // lx=0, lz=0
          onNone: () => false,
          onSome: (idx) => spawnBlocks[idx] !== 0, // 0 = AIR
        })
      }
    ),
    () => 64 // fallback to sea level
  )
  const spawnPosition = { ...baseSpawnPosition, y: surfaceY + 1 + 3 }

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

  // Initialize game state — physics ground plane at visual terrain surface (surfaceY + 1)
  yield* gameState.initialize(spawnPosition, surfaceY + 1)

  // Initialize block highlight
  yield* blockHighlight.initialize(scene)

  // Initialize hotbar renderer
  yield* hotbarRenderer.initialize(canvas.clientWidth, canvas.clientHeight)

  // Apply initial day length from persisted settings, then set time to noon for visibility
  yield* timeService.setDayLength(initialSettings.dayLengthSeconds)
  yield* timeService.setTimeOfDay(0.5)

  // Show crosshair
  yield* crosshair.show()

  // Canvas resize handler: update renderer, camera, composer, and all resolution-dependent passes.
  // Without this, resizing the browser window produces stretched/blurry rendering.
  type PendingResize = { readonly width: number; readonly height: number }
  const pendingResizeRef = MutableRef.make<Option.Option<PendingResize>>(Option.none())
  const pendingSaveDirtyChunksRef = MutableRef.make(false)

  const handleResize = () => {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w === 0 || h === 0) return
    MutableRef.set(pendingResizeRef, Option.some({ width: w, height: h }))
  }

  // Define named handlers so removeEventListener can match the same reference
  const handleVisibilityChange = () => {
    if (document.hidden) {
      MutableRef.set(pendingSaveDirtyChunksRef, true)
    }
  }
  const handleBeforeUnload = () => {
    MutableRef.set(pendingSaveDirtyChunksRef, true)
  }
  const handleCanvasMouseDown = () => {
    Effect.runSync(inputService.requestPointerLock())
  }

  yield* Effect.acquireRelease(
    Effect.sync(() => {
      window.addEventListener('resize', handleResize)
      document.addEventListener('visibilitychange', handleVisibilityChange)
      window.addEventListener('beforeunload', handleBeforeUnload)
      canvas.addEventListener('mousedown', handleCanvasMouseDown)
    }),
    () => Effect.sync(() => {
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      canvas.removeEventListener('mousedown', handleCanvasMouseDown)
    })
  )

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
  const frameHandler = yield* createFrameHandler(
    {
      renderer,
      scene,
      camera,
      respawnPosition: spawnPosition,
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
    }
  )

  yield* Effect.sync(() => {
    if (typeof window === 'undefined') return

    let stagedResourceBlocks: Array<{ pos: { x: number; y: number; z: number }; blockType: import('@/domain/block').BlockType }> = []

    const qa = {
      getInventorySnapshot: () =>
        Effect.runPromise(
          inventoryService.getAllSlots().pipe(
            Effect.map((slots) => Arr.map(slots, (slot, index) =>
              Option.match(slot, {
                onNone: () => null,
                onSome: (stack) => ({ slot: index, blockType: stack.blockType, count: stack.count }),
              })
            )),
          ),
        ),
      openInventoryForQA: () => Effect.runPromise(inventoryRenderer.toggle()),
      stageProgressionScenario: () =>
        Effect.runPromise(Effect.gen(function* () {
          stagedResourceBlocks = []
          const direction = new THREE.Vector3()
          camera.getWorldDirection(direction)
          direction.normalize()

          const placeBlockAhead = (distance: number, blockType: import('@/domain/block').BlockType) =>
            Effect.gen(function* () {
              const wx = Math.floor(camera.position.x + direction.x * distance)
              const wy = Math.floor(camera.position.y)
              const wz = Math.floor(camera.position.z + direction.z * distance)
              const chunkCoord = { x: Math.floor(wx / CHUNK_SIZE), z: Math.floor(wz / CHUNK_SIZE) }
              const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
              const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
              const chunk = yield* chunkManagerService.getChunk(chunkCoord)
              yield* setBlockInChunk(chunk, lx, wy, lz, blockType)
              yield* chunkManagerService.markChunkDirty(chunkCoord)
              stagedResourceBlocks.push({ pos: { x: wx, y: wy, z: wz }, blockType })
            })

          yield* placeBlockAhead(4, 'WOOD')
          yield* placeBlockAhead(5, 'WOOD')
          yield* placeBlockAhead(6, 'WOOD')
          yield* placeBlockAhead(3, 'STONE')

          yield* blockHighlight.invalidateCache()
        })),
      collectStagedResources: () =>
        Effect.runPromise(Effect.gen(function* () {
          yield* Effect.forEach(
            stagedResourceBlocks,
            ({ pos }) => blockService.breakBlock(pos),
            { concurrency: 1, discard: true },
          )
          stagedResourceBlocks = []
        })),
      spawnLowHealthZombieInFront: () =>
        Effect.runPromise(Effect.gen(function* () {
          const direction = new THREE.Vector3()
          camera.getWorldDirection(direction)
          direction.normalize()
          const zombiePos = {
            x: camera.position.x + direction.x * 6,
            y: camera.position.y,
            z: camera.position.z + direction.z * 6,
          }
          const zombieId = yield* entityManager.addEntity(EntityType.Zombie, zombiePos)
          yield* entityManager.applyDamage(zombieId, 12)
        })),
      clearBlocksInFront: () =>
        Effect.runPromise(Effect.gen(function* () {
          const direction = new THREE.Vector3()
          camera.getWorldDirection(direction)
          direction.normalize()
          yield* Effect.forEach([3, 4] as const, (distance) => {
            const pos = {
              x: Math.floor(camera.position.x + direction.x * distance),
              y: Math.floor(camera.position.y),
              z: Math.floor(camera.position.z + direction.z * distance),
            }
            return blockService.breakBlock(pos).pipe(Effect.catchAll(() => Effect.void))
          }, { concurrency: 1, discard: true })
          yield* blockHighlight.invalidateCache()
        })),
      attackFirstZombie: () =>
        Effect.runPromise(Effect.gen(function* () {
          const qaSwordDamage = 8
          const qaHandDamage = 4
          const entities = yield* entityManager.getEntities()
          const zombieOpt = Arr.findFirst(entities, (entity) => entity.type === 'Zombie')
          if (Option.isNone(zombieOpt)) return false
          const zombie = Option.getOrThrow(zombieOpt)
          const selectedItem = yield* hotbarService.getSelectedBlockType()
          const damage = Option.match(selectedItem, {
            onNone: () => qaHandDamage,
            onSome: (item) => item === 'WOODEN_SWORD' ? qaSwordDamage : qaHandDamage,
          })
          yield* entityManager.applyDamage(zombie.entityId, damage)
          return true
        })),
      placeSelectedItemInFront: () =>
        Effect.runPromise(Effect.gen(function* () {
          const direction = new THREE.Vector3()
          camera.getWorldDirection(direction)
          direction.normalize()
          const selectedItem = yield* hotbarService.getSelectedBlockType()
          const selectedSlot = yield* hotbarService.getSelectedSlot()
          yield* Option.match(selectedItem, {
            onNone: () => Effect.void,
            onSome: (blockType) =>
              blockService.placeBlock(
                {
                  x: Math.floor(camera.position.x + direction.x * 4),
                  y: Math.floor(camera.position.y),
                  z: Math.floor(camera.position.z + direction.z * 4),
                },
                blockType,
                SlotIndex.make(HOTBAR_START + SlotIndex.toNumber(selectedSlot)),
              ).pipe(Effect.catchAll(() => Effect.void)),
          })
          yield* blockHighlight.invalidateCache()
        })),
      moveItemToHotbar: (blockType: import('@/domain/block').BlockType, hotbarIndex: number) =>
        Effect.runPromise(Effect.gen(function* () {
          const slots = yield* inventoryService.getAllSlots()
          const fromIndexOpt = Arr.findFirstIndex(slots, (slot) => Option.match(slot, { onNone: () => false, onSome: (stack) => stack.blockType === blockType }))
          if (Option.isNone(fromIndexOpt)) return false
          const fromIndex = Option.getOrThrow(fromIndexOpt)
          yield* inventoryService.moveStack(SlotIndex.make(fromIndex), SlotIndex.make(HOTBAR_START + hotbarIndex))
          yield* hotbarService.setSelectedSlot(SlotIndex.make(hotbarIndex))
          return true
        })),
      selectHotbarSlot: (hotbarIndex: number) =>
        Effect.runPromise(hotbarService.setSelectedSlot(SlotIndex.make(hotbarIndex))),
      getRecipeButtons: () => Arr.map(recipeService.getAllRecipes(), (recipe) => recipe.id),
      getEntitySnapshot: () => Effect.runPromise(entityManager.getEntities()),
    }

    Reflect.set(window as object, '__TS_MINECRAFT_QA__', qa)
  })

  const frameHandlerWithBrowserEvents = (deltaTime: DeltaTimeSecs) =>
    Effect.gen(function* () {
      const pendingSaveDirtyChunks = MutableRef.get(pendingSaveDirtyChunksRef)
      MutableRef.set(pendingSaveDirtyChunksRef, false)
      if (pendingSaveDirtyChunks) {
        yield* chunkManagerService.saveDirtyChunks().pipe(
          Effect.catchAllCause(() => Effect.void)
        )
      }

      const pendingResize = MutableRef.get(pendingResizeRef)
      MutableRef.set(pendingResizeRef, Option.none())

      yield* Option.match(pendingResize, {
        onNone: () => Effect.void,
        onSome: ({ width, height }) =>
          Effect.sync(() => {
            const dpr = Math.min(window.devicePixelRatio, 2)
            renderer.setPixelRatio(dpr)
            renderer.setSize(width, height)
            camera.aspect = width / height
            camera.updateProjectionMatrix()
            composerRT.setSize(width, height)
            composer.setSize(width, height)
            // Only resize passes that were created AND are currently enabled — prevents VRAM
            // re-expansion on window resize for passes disabled by graphics preset (FR-006).
            // The frame handler manages each pass's `enabled` flag based on settings.
            const gtaoOrNull = Option.getOrNull(gtaoPass)
            const bloomOrNull = Option.getOrNull(bloomPass)
            const bokehOrNull = Option.getOrNull(bokehPass)
            const smaaOrNull = Option.getOrNull(smaaPass)
            const godRaysOrNull = Option.getOrNull(godRaysPass)
            if (gtaoOrNull && gtaoOrNull.enabled) gtaoOrNull.setSize(width, height)
            if (bloomOrNull && bloomOrNull.enabled) bloomOrNull.setSize(width, height)
            if (bokehOrNull && bokehOrNull.enabled) bokehOrNull.setSize(width, height)
            if (smaaOrNull && smaaOrNull.enabled) smaaOrNull.setSize(width, height)
            if (godRaysOrNull && godRaysOrNull.enabled) godRaysOrNull.setSize(width, height)
          }),
      })

      yield* frameHandler(deltaTime)
    })

  yield* Effect.log('Game initialized — inventory, day/night cycle, and settings ready')

  yield* Effect.acquireRelease(
    gameLoopService.start(frameHandlerWithBrowserEvents),
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
