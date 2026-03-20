/**
 * Application layer composition — wires all services into a single Effect Layer graph.
 *
 * This file lives at src/ root (not src/application/) so it can import from all three
 * layers (Infrastructure → Application → Presentation) without layer inversion.
 * All Layer constants are exported so tests can provide subsets of the full graph.
 *
 * Dependency order: Infrastructure → Application → Presentation
 */
import { Effect, Layer } from 'effect'

// Three.js rendering infrastructure
import { RendererServiceLive } from '@/infrastructure/three/renderer/renderer-service'
import { SceneServiceLive } from '@/infrastructure/three/scene/scene-service'
import { PerspectiveCameraServiceLive } from '@/infrastructure/three/camera/perspective'
import { TextureServiceLive, BlockMeshServiceLive } from '@/infrastructure/three'
import { WorldRendererServiceLive } from '@/infrastructure/three/world-renderer'
import { FPSCounterLive } from '@/presentation/fps-counter'
import { BlockRegistryLive } from '@/domain'

// Physics infrastructure (custom engine)
import { PhysicsWorldServiceLive, RigidBodyServiceLive, ShapeServiceLive } from '@/infrastructure/physics/boundary'

// Procedural generation and storage infrastructure
import { NoiseService, NoiseServiceLive } from '@/infrastructure/noise/noise-service'
import { StorageService, StorageServiceLive } from '@/infrastructure/storage/storage-service'
import { ChunkMeshServiceLive } from '@/infrastructure/three/meshing/chunk-mesh'

// Chunk domain service
import { ChunkServiceLive } from '@/domain/chunk'

// Application-layer ports (decouple application from infrastructure)
import { NoiseServicePort } from '@/application/noise/noise-service-port'
import { StorageServicePort } from '@/application/storage/storage-service-port'

// Terrain and chunk management
import { BiomeServiceLive } from '@/application/biome/biome-service'
import { ChunkManagerServiceLive } from '@/application/chunk/chunk-manager-service'

// Player state, health, and movement
import { PlayerServiceLive } from '@/application/player/player-state'
import { HealthServiceLive } from '@/application/player/health-service'
import { MovementServiceLive } from '@/application/player/movement-service'

// Block interaction and hotbar
import { BlockServiceLive } from '@/application/block/block-service'
import { HotbarServiceLive } from '@/application/hotbar/hotbar-service'
import { HotbarRendererLive } from '@/presentation/hud/hotbar-three'

// Inventory, time, settings, and overlays
import { InventoryServiceLive } from '@/application/inventory/inventory-service'
import { RecipeServiceLive } from '@/application/crafting/recipe-service'
import { TimeServiceLive } from '@/application/time/time-service'
import { SettingsServiceLive } from '@/application/settings/settings-service'
import { SettingsOverlayLive } from '@/presentation/settings/settings-overlay'
import { InventoryRendererLive } from '@/presentation/inventory/inventory-renderer'

// Game state, camera, physics, input, raycasting, and game loop
import { GameStateServiceLive } from '@/application/game-state'
import { FirstPersonCameraServiceLive } from '@/application/camera/first-person-camera-service'
import { PhysicsServiceLive } from '@/application/physics/physics-service'
import { PlayerCameraStateLive } from '@/application/camera/camera-state'
import { CrosshairLive, DomOperationsLive } from '@/presentation/hud/crosshair'
import { BlockHighlightLive } from '@/presentation/highlight/block-highlight'
import { RaycastingServiceLive } from '@/infrastructure/three/raycasting/raycasting-service'
import { InputServiceLive, PlayerInputServiceLive } from '@/presentation/input/input-service'
import { GameLoopServiceLive } from '@/application/game-loop'

// Build layers from the bottom up, providing dependencies at each level

// Level 1: BaseLayer — pure infrastructure with no dependencies
export const BaseLayer = Layer.mergeAll(
  // Three.js services
  RendererServiceLive,
  SceneServiceLive,
  PerspectiveCameraServiceLive,
  TextureServiceLive,
  BlockMeshServiceLive,
  BlockRegistryLive,
  // Domain services
  PlayerServiceLive,
  // Input and DOM
  InputServiceLive,
  DomOperationsLive,
  // FPSCounterLive moved to PresentationLayers
  StorageServiceLive,
  ChunkServiceLive,
  ChunkMeshServiceLive,
  // Game loop service (no external service dependencies)
  GameLoopServiceLive,
)

// Shared NoiseService — single instance provided to all dependents
export const NoiseLayer = NoiseServiceLive

// Bridge: satisfies NoiseServicePort using the infrastructure NoiseService implementation.
// Same pattern as PlayerInputServiceLive: the cast is safe because Layer.effect() only
// accesses the 3 declared methods (noise2D, octaveNoise2D, setSeed).
export const NoisePortLayer = Layer.effect(
  NoiseServicePort,
  Effect.map(NoiseService, (noise) => {
    // Typed intermediate validates that NoiseService exposes all 3 required port methods
    // with the correct signatures. If a method is renamed or its signature changes, tsc fails here.
    const impl: { noise2D: NoiseService['noise2D']; octaveNoise2D: NoiseService['octaveNoise2D']; setSeed: NoiseService['setSeed'] } = {
      noise2D: (x, z) => noise.noise2D(x, z),
      octaveNoise2D: (x, z, o, p, l) => noise.octaveNoise2D(x, z, o, p, l),
      setSeed: (seed) => noise.setSeed(seed),
    }
    // The `as unknown as NoiseServicePort` cast is unavoidable: Effect.Service adds a `_tag`
    // discriminant that plain objects cannot satisfy structurally.
    return impl as unknown as NoiseServicePort
  })
).pipe(Layer.provide(NoiseLayer))

// Bridge: satisfies StorageServicePort using the infrastructure StorageService implementation.
export const StoragePortLayer = Layer.effect(
  StorageServicePort,
  Effect.map(StorageService, (storage) => {
    // Typed intermediate validates that StorageService exposes both required port methods
    // with the correct signatures. If a method is renamed or its signature changes, tsc fails here.
    const impl: { saveChunk: StorageService['saveChunk']; loadChunk: StorageService['loadChunk'] } = {
      saveChunk: (worldId, chunkCoord, blocks) => storage.saveChunk(worldId, chunkCoord, blocks),
      loadChunk: (worldId, chunkCoord) => storage.loadChunk(worldId, chunkCoord),
    }
    // The `as unknown as StorageServicePort` cast is unavoidable: Effect.Service adds a `_tag`
    // discriminant that plain objects cannot satisfy structurally.
    return impl as unknown as StorageServicePort
  })
).pipe(Layer.provide(StorageServiceLive))

// Level 2: BiomeService depends on NoiseServicePort (via bridge)
export const BiomeLayer = BiomeServiceLive.pipe(
  Layer.provide(NoisePortLayer),
)

// Level 2: PhysicsService depends on PhysicsWorldService, RigidBodyService, ShapeService (all independent peers)
export const PhysicsLayer = PhysicsServiceLive.pipe(
  Layer.provide(Layer.mergeAll(PhysicsWorldServiceLive, RigidBodyServiceLive, ShapeServiceLive))
)

// PlayerInputServiceLive: adapter bridging InputService (presentation) to PlayerInputService (application)
export const PlayerInputLayer = PlayerInputServiceLive.pipe(
  Layer.provide(InputServiceLive),
)

// MovementService depends on PlayerInputService
export const MovementLayer = MovementServiceLive.pipe(
  Layer.provide(PlayerInputLayer),
)

// PlayerCameraState has no dependencies
export const CameraStateLayer = PlayerCameraStateLive

// RaycastingService has no dependencies
export const RaycastingLayer = RaycastingServiceLive

// Level 3: Crosshair depends on DomOperations
export const CrosshairLayer = CrosshairLive.pipe(
  Layer.provide(DomOperationsLive),
)

// BlockHighlight depends on RaycastingService
export const BlockHighlightLayer = BlockHighlightLive.pipe(
  Layer.provide(RaycastingLayer),
)

// FirstPersonCameraService depends on PlayerInputService and PlayerCameraState
export const FirstPersonCameraLayer = FirstPersonCameraServiceLive.pipe(
  Layer.provide(PlayerInputLayer),
  Layer.provide(CameraStateLayer),
)

// Level 3: ChunkManagerService depends on ChunkService, StorageServicePort, BiomeService, NoiseServicePort (all independent peers)
export const ChunkManagerLayer = ChunkManagerServiceLive.pipe(
  Layer.provide(Layer.mergeAll(ChunkServiceLive, StoragePortLayer, BiomeLayer, NoisePortLayer))
)

// Level 4: GameStateService depends on PlayerService, PhysicsService, MovementService, CameraState
export const GameLayer = GameStateServiceLive.pipe(
  Layer.provide(PlayerServiceLive),
  Layer.provide(PhysicsLayer),
  Layer.provide(MovementLayer),
  Layer.provide(CameraStateLayer),
)

// Level 4: WorldRendererService depends on ChunkMeshService and SceneService
export const WorldRendererLayer = WorldRendererServiceLive.pipe(
  Layer.provide(ChunkMeshServiceLive),
  Layer.provide(SceneServiceLive),
)

// InventoryService depends on BlockRegistry
export const InventoryLayer = InventoryServiceLive.pipe(
  Layer.provide(BlockRegistryLive),
)

// Level 4: BlockService depends on ChunkManagerService, ChunkService, PlayerService, InventoryService (all independent peers)
export const BlockLayer = BlockServiceLive.pipe(
  Layer.provide(Layer.mergeAll(ChunkManagerLayer, ChunkServiceLive, PlayerServiceLive, InventoryLayer))
)

// HotbarService depends on PlayerInputService and InventoryService
export const HotbarLayer = HotbarServiceLive.pipe(
  Layer.provide(PlayerInputLayer),
  Layer.provide(InventoryLayer),
)

// HotbarRenderer depends on RendererService
export const HotbarRendererLayer = HotbarRendererLive.pipe(
  Layer.provide(RendererServiceLive),
)

// SettingsService: reads/writes localStorage — no Effect service dependencies
export const SettingsLayer = SettingsServiceLive

// SettingsOverlay depends on SettingsService and DomOperations
export const SettingsOverlayLayer = SettingsOverlayLive.pipe(
  Layer.provide(SettingsLayer),
  Layer.provide(DomOperationsLive),
)

// InventoryRenderer depends on InventoryService, HotbarService, and DomOperations
export const InventoryRendererLayer = InventoryRendererLive.pipe(
  Layer.provide(InventoryLayer),
  Layer.provide(HotbarLayer),
  Layer.provide(DomOperationsLive),
)

// Top-level layer groups — used by MainLive and for isolated testing
export const InfrastructureLayers = Layer.mergeAll(
  BaseLayer,
  NoiseLayer,
  BiomeLayer,
  PhysicsLayer,
  // WorldRendererLayer moved to GameLogicLayers
)

export const GameLogicLayers = Layer.mergeAll(
  GameLayer,
  ChunkManagerLayer,
  BlockLayer,
  HotbarLayer,
  InventoryLayer,
  TimeServiceLive,
  HealthServiceLive,
  RecipeServiceLive,
  PlayerInputLayer,
  MovementLayer,
  CameraStateLayer,
  RaycastingLayer,
  WorldRendererLayer,  // moved from InfrastructureLayers: orchestrates application→infrastructure
)

export const PresentationLayers = Layer.mergeAll(
  CrosshairLayer,
  BlockHighlightLayer,
  FirstPersonCameraLayer,
  HotbarRendererLayer,
  SettingsLayer,
  SettingsOverlayLayer,
  InventoryRendererLayer,
  FPSCounterLive,  // presentation service: reads FPS counter state for HUD display
)

/** Full application layer: provides every service to mainProgram. */
export const MainLive = Layer.mergeAll(
  InfrastructureLayers,
  GameLogicLayers,
  PresentationLayers,
)
