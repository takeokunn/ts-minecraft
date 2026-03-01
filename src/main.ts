import { Duration, Effect, Layer, Option, Ref, Schedule } from 'effect'
import * as THREE from 'three'

// Import existing infrastructure services
import { RendererService, RendererServiceLive } from '@/infrastructure/three/renderer/renderer-service'
import { SceneService, SceneServiceLive } from '@/infrastructure/three/scene/scene-service'
import { PerspectiveCameraService, PerspectiveCameraServiceLive } from '@/infrastructure/three/camera/perspective'
import { TextureServiceLive, BlockMeshServiceLive } from '@/infrastructure/three'
import { WorldRendererService, WorldRendererServiceLive } from '@/infrastructure/three/world-renderer'
import { FPSCounter, FPSCounterLive } from '@/presentation/fps-counter'
import { BlockRegistryLive } from '@/domain'

// Import cannon-es infrastructure services
import { PhysicsWorldServiceLive } from '@/infrastructure/cannon/boundary/world-service'
import { RigidBodyServiceLive } from '@/infrastructure/cannon/boundary/body-service'
import { ShapeServiceLive } from '@/infrastructure/cannon/boundary/shape-service'

// Import Phase 6 infrastructure services
import { NoiseService, NoiseServiceLive } from '@/infrastructure/noise/noise-service'
import { StorageService, StorageServiceLive } from '@/infrastructure/storage/storage-service'
import { ChunkMeshServiceLive } from '@/infrastructure/three/meshing/chunk-mesh'

// Import Phase 6 domain services
import { ChunkServiceLive, CHUNK_SIZE, CHUNK_HEIGHT } from '@/domain/chunk'

// Import Phase 6 application services
import { BiomeServiceLive } from '@/application/biome/biome-service'
import { ChunkManagerService, ChunkManagerServiceLive } from '@/application/chunk/chunk-manager-service'

// Import Phase 3 services
import { PlayerServiceLive } from '@/domain/player'

// Import Phase 5 services
import { BlockService, BlockServiceLive } from '@/application/block/block-service'
import { HotbarService, HotbarServiceLive } from '@/application/hotbar/hotbar-service'
import { HotbarRenderer, HotbarRendererLive } from '@/presentation/hud/hotbar-three'

// Import Phase 7 services
import { InventoryServiceLive } from '@/application/inventory/inventory-service'
import { TimeService, TimeServiceLive } from '@/application/time/time-service'
import { SettingsService, SettingsServiceLive } from '@/application/settings/settings-service'
import { SettingsOverlay, SettingsOverlayLive } from '@/presentation/settings/settings-overlay'
import { InventoryRenderer, InventoryRendererLive } from '@/presentation/inventory/inventory-renderer'

import type { WorldId } from '@/shared/kernel'

// Import Phase 4 services
import { GameStateService, GameStateServiceLive, DEFAULT_PLAYER_ID } from '@/application/game-state'
import { FirstPersonCameraService, FirstPersonCameraServiceLive } from '@/application/camera/first-person-camera-service'
import { MovementServiceLive } from '@/application/player/movement-service'
import { PhysicsServiceLive } from '@/application/physics/physics-service'
import { PlayerCameraStateLive } from '@/domain/player-camera'
import { Crosshair, CrosshairLive, DomOperationsLive } from '@/presentation/hud/crosshair'
import { BlockHighlight, BlockHighlightLive } from '@/presentation/highlight/block-highlight'
import { RaycastingServiceLive } from '@/application/raycasting/raycasting-service'
import { InputService, InputServiceLive, KeyMappings } from '@/presentation/input/input-service'
import { GameLoopService, GameLoopServiceLive } from '@/application/game-loop'

// Build layers from the bottom up, providing dependencies at each level

// Level 1: BaseLayer — pure infrastructure with no dependencies
const BaseLayer = Layer.mergeAll(
  // Three.js services
  RendererServiceLive,
  SceneServiceLive,
  PerspectiveCameraServiceLive,
  TextureServiceLive,
  BlockMeshServiceLive,
  BlockRegistryLive,
  // Domain services
  PlayerServiceLive,
  // Cannon-es services
  PhysicsWorldServiceLive,
  RigidBodyServiceLive,
  ShapeServiceLive,
  // Input and DOM
  InputServiceLive,
  DomOperationsLive,
  // FPS counter
  FPSCounterLive,
  // Phase 6 infrastructure (no deps)
  StorageServiceLive,
  ChunkServiceLive,
  ChunkMeshServiceLive,
  // Game loop service (no external service dependencies)
  GameLoopServiceLive,
)

// Shared NoiseService — single instance provided to all dependents
const NoiseLayer = NoiseServiceLive

// Level 2: BiomeService depends on NoiseService
const BiomeLayer = BiomeServiceLive.pipe(
  Layer.provide(NoiseLayer),
)

// Level 2: PhysicsService depends on PhysicsWorldService, RigidBodyService, ShapeService
const PhysicsLayer = PhysicsServiceLive.pipe(
  Layer.provide(PhysicsWorldServiceLive),
  Layer.provide(RigidBodyServiceLive),
  Layer.provide(ShapeServiceLive),
)

// MovementService depends on InputService
const MovementLayer = MovementServiceLive.pipe(
  Layer.provide(InputServiceLive),
)

// PlayerCameraState has no dependencies
const CameraStateLayer = PlayerCameraStateLive

// RaycastingService has no dependencies
const RaycastingLayer = RaycastingServiceLive

// Level 3: Crosshair depends on DomOperations
const CrosshairLayer = CrosshairLive.pipe(
  Layer.provide(DomOperationsLive),
)

// BlockHighlight depends on RaycastingService
const BlockHighlightLayer = BlockHighlightLive.pipe(
  Layer.provide(RaycastingLayer),
)

// FirstPersonCameraService depends on InputService and PlayerCameraState
const FirstPersonCameraLayer = FirstPersonCameraServiceLive.pipe(
  Layer.provide(InputServiceLive),
  Layer.provide(CameraStateLayer),
)

// Level 3: ChunkManagerService depends on ChunkService, StorageService, BiomeService, NoiseService
const ChunkManagerLayer = ChunkManagerServiceLive.pipe(
  Layer.provide(ChunkServiceLive),
  Layer.provide(StorageServiceLive),
  Layer.provide(BiomeLayer),
  Layer.provide(NoiseLayer),
)

// Level 4: GameStateService (no WorldService dependency in Phase 6)
const GameLayer = GameStateServiceLive.pipe(
  Layer.provide(PlayerServiceLive),
  Layer.provide(PhysicsLayer),
  Layer.provide(MovementLayer),
  Layer.provide(CameraStateLayer),
)

// Level 4: WorldRendererService depends on ChunkMeshService and SceneService
const WorldRendererLayer = WorldRendererServiceLive.pipe(
  Layer.provide(ChunkMeshServiceLive),
  Layer.provide(SceneServiceLive),
)

// Level 4: BlockService depends on ChunkManagerService, ChunkService, PlayerService
const BlockLayer = BlockServiceLive.pipe(
  Layer.provide(ChunkManagerLayer),
  Layer.provide(ChunkServiceLive),
  Layer.provide(PlayerServiceLive),
)

// Phase 7: InventoryService depends on BlockRegistry
const InventoryLayer = InventoryServiceLive.pipe(
  Layer.provide(BlockRegistryLive),
)

// HotbarService depends on InputService and InventoryService
const HotbarLayer = HotbarServiceLive.pipe(
  Layer.provide(InputServiceLive),
  Layer.provide(InventoryLayer),
)

// HotbarRenderer depends on RendererService
const HotbarRendererLayer = HotbarRendererLive.pipe(
  Layer.provide(RendererServiceLive),
)

// Phase 7: SettingsService has no Effect dependencies (uses localStorage internally)
const SettingsLayer = SettingsServiceLive

// Phase 7: SettingsOverlay depends on SettingsService
const SettingsOverlayLayer = SettingsOverlayLive.pipe(
  Layer.provide(SettingsLayer),
)

// Phase 7: InventoryRenderer depends on InventoryService and HotbarService
const InventoryRendererLayer = InventoryRendererLive.pipe(
  Layer.provide(InventoryLayer),
  Layer.provide(HotbarLayer),
)

// Merge all layers into a single application layer
const MainLive = Layer.mergeAll(
  BaseLayer,
  NoiseLayer,
  BiomeLayer,
  PhysicsLayer,
  MovementLayer,
  CameraStateLayer,
  RaycastingLayer,
  CrosshairLayer,
  BlockHighlightLayer,
  FirstPersonCameraLayer,
  GameLayer,
  ChunkManagerLayer,
  WorldRendererLayer,
  BlockLayer,
  HotbarLayer,
  HotbarRendererLayer,
  InventoryLayer,
  TimeServiceLive,
  SettingsLayer,
  SettingsOverlayLayer,
  InventoryRendererLayer,
  GameLoopServiceLive,
)

// World identifier used for all storage operations
const WORLD_ID = 'world-1' as WorldId

// Eye level offset for camera (player height - half body height)
const EYE_LEVEL_OFFSET = 0.7

// Main application
const mainProgram = Effect.gen(function* () {
  // Get canvas element
  const canvas = yield* Effect.try({
    try: () => {
      const el = document.getElementById('game-canvas')
      if (!el) {
        throw new Error('Canvas element not found')
      }
      return el as HTMLCanvasElement
    },
    catch: (error) => new Error(`Failed to get canvas: ${error}`),
  })

  // Get infrastructure services
  const rendererService = yield* RendererService
  const sceneService = yield* SceneService
  const cameraService = yield* PerspectiveCameraService
  const worldRendererService = yield* WorldRendererService
  const fpsCounter = yield* FPSCounter

  // Get Phase 4 services
  const gameState = yield* GameStateService
  const firstPersonCamera = yield* FirstPersonCameraService
  const crosshair = yield* Crosshair
  const blockHighlight = yield* BlockHighlight
  const inputService = yield* InputService

  // Get Phase 5 services
  const blockService = yield* BlockService
  const hotbarService = yield* HotbarService
  const hotbarRenderer = yield* HotbarRenderer

  // Get Phase 6 services
  const chunkManagerService = yield* ChunkManagerService
  const noiseService = yield* NoiseService
  const storageService = yield* StorageService

  // Get Phase 7 services
  const timeService = yield* TimeService
  const settingsService = yield* SettingsService
  const settingsOverlay = yield* SettingsOverlay
  const inventoryRenderer = yield* InventoryRenderer

  // Get game loop service
  const gameLoopService = yield* GameLoopService

  // Create renderer
  const renderer = yield* rendererService.create(canvas)

  // Create scene
  const scene = yield* sceneService.create()

  // Create camera
  const camera = yield* cameraService.create({
    fov: 75,
    aspect: canvas.clientWidth / canvas.clientHeight,
    near: 0.1,
    far: 1000,
  })

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
    const seed = Math.floor(Math.random() * 0xFFFFFFFF)
    yield* noiseService.setSeed(seed)
    spawnPosition = { x: 0, y: 100, z: 0 }
    yield* storageService.saveWorldMetadata(WORLD_ID, {
      seed,
      createdAt: new Date(),
      lastPlayed: new Date(),
      playerSpawn: spawnPosition,
    })
    yield* Effect.log(`Created new world '${WORLD_ID}' with seed ${seed}`)
  }

  // Auto-save: persist dirty chunks every 5 seconds using Effect scheduler
  yield* Effect.fork(
    Effect.repeat(
      chunkManagerService.saveDirtyChunks().pipe(
        Effect.catchAll((e) => Effect.logError(`Auto-save error: ${String(e)}`))
      ),
      Schedule.fixed(Duration.seconds(5))
    )
  )

  // Save on tab hide (best-effort)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      Effect.runPromise(
        chunkManagerService.saveDirtyChunks().pipe(
          Effect.catchAll(() => Effect.void)
        )
      )
    }
  })

  // Best-effort save before unload (IndexedDB async, may not complete before unload)
  window.addEventListener('beforeunload', () => {
    Effect.runPromise(chunkManagerService.saveDirtyChunks()).catch(() => {})
  })

  // Initialize: load chunks around spawn position, sync to scene
  yield* chunkManagerService.loadChunksAroundPlayer(spawnPosition)
  const initialChunks = yield* chunkManagerService.getLoadedChunks()
  yield* worldRendererService.syncChunksToScene(initialChunks, scene)

  // Determine terrain surface height at spawn column (lx=0, lz=0 of chunk 0,0)
  // by scanning downward from the top until we find a non-air block.
  // This aligns the physics ground plane with the visual terrain surface.
  const spawnChunk = yield* chunkManagerService.getChunk({ x: 0, z: 0 })
  let surfaceY = 64 // fallback to sea level
  for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
    const idx = y + 0 * CHUNK_HEIGHT + 0 * CHUNK_HEIGHT * CHUNK_SIZE // lx=0, lz=0
    if (spawnChunk.blocks[idx] !== 0) { // 0 = AIR
      surfaceY = y
      break
    }
  }
  // Spawn player 3 blocks above the terrain surface so they land on it
  spawnPosition = { ...spawnPosition, y: surfaceY + 3 }

  // Add directional light (sun — intensity driven by day/night cycle)
  const light = new THREE.DirectionalLight(0xffffff, 1)
  light.position.set(5, 10, 7)
  yield* sceneService.add(scene, light)

  // Add ambient light (sky — intensity driven by day/night cycle)
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
  yield* sceneService.add(scene, ambientLight)

  // Precomputed sky colors for smooth day/night lerp
  const skyNight = new THREE.Color(0x0a0a1a)
  const skyDay = new THREE.Color(0x87ceeb)
  const skyCurrent = new THREE.Color()

  // Initialize game state — physics ground plane at terrain surface level
  yield* gameState.initialize(spawnPosition, surfaceY)

  // Initialize block highlight
  yield* blockHighlight.initialize(scene)

  // Initialize hotbar renderer
  yield* hotbarRenderer.initialize(canvas.clientWidth, canvas.clientHeight)

  // Initialize Phase 7 overlays
  yield* settingsOverlay.initialize()
  yield* inventoryRenderer.initialize()

  // Apply initial day length from persisted settings, then set time to noon for visibility
  const initialSettings = yield* settingsService.getSettings()
  yield* timeService.setDayLength(initialSettings.dayLengthSeconds)
  yield* timeService.setTimeOfDay(0.5)

  // Show crosshair
  yield* crosshair.show()

  // Set up pointer lock on canvas click (requestPointerLock is synchronous — sets state via Ref)
  canvas.addEventListener('click', () => {
    Effect.runSync(inputService.requestPointerLock())
  })

  // FPS display
  const fpsElement = document.getElementById('fps-value')

  // Game pause state: true when a modal overlay (settings/inventory) is open
  const gamePausedRef = yield* Ref.make(false)

  // Single frame handler — all 11 operations in sequence, single Effect.runPromise per frame
  const frameHandler = (deltaTime: number): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      // 1. Chunk streaming (throttled internally to 200ms)
      yield* Effect.gen(function* () {
        const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
        yield* chunkManagerService.loadChunksAroundPlayer(playerPos)
        const loadedChunks = yield* chunkManagerService.getLoadedChunks()
        yield* worldRendererService.syncChunksToScene(loadedChunks, scene)
        yield* worldRendererService.applyFrustumCulling(camera)
      }).pipe(Effect.catchAll((e) => Effect.logError(`Chunk streaming error: ${String(e)}`)))

      // 2. Day/night cycle: advance time and update lighting + sky color
      yield* Effect.gen(function* () {
        yield* timeService.advanceTick(deltaTime)
        const timeOfDay = yield* timeService.getTimeOfDay()

        // Sun arc: 0.25=dawn, 0.5=noon, 0.75=dusk, 0.0/1.0=midnight
        // sin peaks at noon (0.5), zero at dawn/dusk, negative at night → clamp to 0
        const dayFactor = Math.max(0, Math.sin((timeOfDay - 0.25) * Math.PI * 2))

        // Directional light follows a horizontal arc east→west
        const sunAngle = (timeOfDay - 0.25) * Math.PI  // 0 at dawn, π at dusk
        light.intensity = 0.2 + dayFactor * 0.8
        light.position.set(Math.cos(sunAngle) * 50, Math.sin(sunAngle) * 80, 0)

        // Ambient light dims at night
        ambientLight.intensity = 0.1 + dayFactor * 0.4

        // Sky background: lerp between night (dark blue) and day (sky blue)
        skyCurrent.lerpColors(skyNight, skyDay, dayFactor)
        renderer.setClearColor(skyCurrent)
      }).pipe(Effect.catchAll((e) => Effect.logError(`Day/night error: ${String(e)}`)))

      // 3. Update game state (input -> movement -> physics -> position sync)
      yield* gameState.update(deltaTime).pipe(
        Effect.catchAll((e) => Effect.logError(`Physics update error: ${String(e)}`))
      )

      // 4. Update camera rotation from mouse look (suppressed when a modal is open)
      yield* Effect.gen(function* () {
        const paused = yield* Ref.get(gamePausedRef)
        if (!paused) yield* firstPersonCamera.update(camera)
      })

      // 5. Update block highlight
      yield* blockHighlight.update(camera, scene)

      // 6. Handle overlay toggles: Escape (settings), E (inventory)
      yield* Effect.gen(function* () {
        const escPressed = yield* inputService.consumeKeyPress(KeyMappings.ESCAPE)
        const inventoryPressed = yield* inputService.consumeKeyPress(KeyMappings.INVENTORY_OPEN)

        if (escPressed) {
          const isInvOpen = yield* inventoryRenderer.isOpen()
          const isSettingsOpen = yield* settingsOverlay.isOpen()

          if (isInvOpen) {
            // Close inventory
            yield* inventoryRenderer.toggle()
            yield* Ref.set(gamePausedRef, false)
          } else if (isSettingsOpen) {
            // Close settings
            yield* settingsOverlay.toggle()
            yield* Ref.set(gamePausedRef, false)
          } else {
            // Open settings
            const nowOpen = yield* settingsOverlay.toggle()
            yield* Ref.set(gamePausedRef, nowOpen)
          }
        }

        if (inventoryPressed) {
          const isInvOpen = yield* inventoryRenderer.isOpen()
          if (isInvOpen) {
            // Close inventory
            yield* inventoryRenderer.toggle()
            yield* Ref.set(gamePausedRef, false)
          } else {
            // Close settings first if open, then open inventory
            const isSettingsOpen = yield* settingsOverlay.isOpen()
            if (isSettingsOpen) yield* settingsOverlay.toggle()
            yield* inventoryRenderer.toggle()
            yield* Ref.set(gamePausedRef, true)
          }
        }

        // Sync day length to TimeService in case user applied settings changes
        const currentSettings = yield* settingsService.getSettings()
        yield* timeService.setDayLength(currentSettings.dayLengthSeconds)

        // Refresh inventory display when open
        yield* inventoryRenderer.update()
      }).pipe(Effect.catchAll((e) => Effect.logError(`Overlay error: ${String(e)}`)))

      // 7. Handle block interaction (break/place) and hotbar (suppressed when paused)
      yield* Effect.gen(function* () {
        const paused = yield* Ref.get(gamePausedRef)
        if (paused) return

        // Update hotbar slot selection (keyboard 1-9 and mouse wheel)
        yield* hotbarService.update()

        // Process block break/place clicks
        const leftClick = yield* inputService.consumeMouseClick(0)
        const rightClick = yield* inputService.consumeMouseClick(2)

        if (leftClick || rightClick) {
          const targetBlock = yield* blockHighlight.getTargetBlock()
          const targetHit = yield* blockHighlight.getTargetHit()

          if (leftClick && targetBlock !== null) {
            yield* blockService.breakBlock({ x: targetBlock.x, y: targetBlock.y, z: targetBlock.z })
            // Re-mesh the affected chunk
            const chunkCoord = {
              x: Math.floor(targetBlock.x / CHUNK_SIZE),
              z: Math.floor(targetBlock.z / CHUNK_SIZE),
            }
            const updatedChunk = yield* chunkManagerService.getChunk(chunkCoord)
            yield* worldRendererService.updateChunkInScene(updatedChunk, scene)
          }

          if (rightClick && targetHit !== null) {
            const adjacentPos = {
              x: targetHit.blockX + Math.round(targetHit.normal.x),
              y: targetHit.blockY + Math.round(targetHit.normal.y),
              z: targetHit.blockZ + Math.round(targetHit.normal.z),
            }
            const selectedBlock = yield* hotbarService.getSelectedBlockType()
            if (Option.isSome(selectedBlock)) {
              yield* blockService.placeBlock(adjacentPos, selectedBlock.value)
              // Re-mesh the affected chunk
              const chunkCoord = {
                x: Math.floor(adjacentPos.x / CHUNK_SIZE),
                z: Math.floor(adjacentPos.z / CHUNK_SIZE),
              }
              const updatedChunk = yield* chunkManagerService.getChunk(chunkCoord)
              yield* worldRendererService.updateChunkInScene(updatedChunk, scene)
            }
          }
        }

        // Update hotbar renderer with current slot state
        const slots = yield* hotbarService.getSlots()
        const selectedSlot = yield* hotbarService.getSelectedSlot()
        yield* hotbarRenderer.update(slots, selectedSlot)
      }).pipe(Effect.catchAll((e) => Effect.logError(`Block interaction error: ${String(e)}`)))

      // 8. Sync camera position with player
      yield* Effect.gen(function* () {
        const playerPos = yield* gameState.getPlayerPosition(DEFAULT_PLAYER_ID)
        camera.position.set(playerPos.x, playerPos.y + EYE_LEVEL_OFFSET, playerPos.z)
      }).pipe(Effect.catchAll((e) => Effect.logError(`Camera sync error: ${String(e)}`)))

      // 9. Update FPS display
      yield* Effect.gen(function* () {
        const fps = yield* fpsCounter.getFPS()
        if (fpsElement) fpsElement.textContent = fps.toFixed(1)
        yield* fpsCounter.tick(deltaTime)
      })

      // 10. Render world
      renderer.render(scene, camera)

      // 11. Render HUD hotbar overlay (second pass; autoClear=false prevents erasing the main scene)
      renderer.autoClear = false
      yield* hotbarRenderer.render(renderer).pipe(
        Effect.catchAll((e) => Effect.logError(`HUD render error: ${String(e)}`))
      )
      renderer.autoClear = true
    })

  yield* Effect.log('Game started with Phase 7 architecture - Full polish with inventory, day/night cycle, and settings')

  // Start the game loop via GameLoopService
  yield* gameLoopService.start(frameHandler)
})

// Run program with all layers provided
Effect.runPromise(
  mainProgram.pipe(
    Effect.provide(MainLive),
  ),
).catch((error: unknown) => {
  console.error('Failed to start application:', error)
  throw error
})
