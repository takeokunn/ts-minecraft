// Game-logic-tier Layers — application services that orchestrate domain operations
// (game state, chunks, blocks, entities, inventory, audio, etc.).
// Depends on infrastructure-tier layers (see ./infrastructure.ts).
import { Layer } from 'effect'

// Three.js infrastructure consumed directly by world/entity/particle renderers
import { SceneServiceLive, WorldRendererServiceLive, EntityRendererLive, ChunkMeshServiceLive, RaycastingServiceLive, RendererServiceLive } from '@ts-minecraft/world-renderer'
import { ParticleSystemServiceLive } from '@ts-minecraft/world-renderer/particles/particle-system'

// Chunk domain service (used by ChunkManagerLayer / BlockLayer)
import { ChunkServiceLive } from '@ts-minecraft/domain'
import { BlockRegistryLive } from '@ts-minecraft/domain'

// Player state, health, and movement
import { PlayerServiceLive } from '@ts-minecraft/player-controller'
import { HealthServiceLive } from '@ts-minecraft/player-controller'
import { MovementServiceLive } from '@ts-minecraft/player-controller'

// Block interaction and hotbar
import { BlockServiceLive } from '@ts-minecraft/block-service'
import { HotbarServiceLive } from '@ts-minecraft/hotbar-system'
import { HotbarRendererLive } from '@ts-minecraft/app/presentation/hud/hotbar-three'

// Game mode (survival/creative) — single-instance state for the active session
import { GameModeServiceLive } from '@ts-minecraft/game-mode'

// Inventory, time, recipes, audio, entities
import { InventoryServiceLive } from '@ts-minecraft/inventory-system'
import { RecipeServiceLive } from '@ts-minecraft/crafting-system'
import { TimeServiceLive } from '@ts-minecraft/day-night-cycle'
import { AudioEngineLive, MusicManagerLive, SoundManagerLive } from '@ts-minecraft/audio-engine'
import { EntityManagerLive, MobSpawnerLive } from '@ts-minecraft/entity-manager'

// Village / Trading / Redstone simulation services
import { VillageServiceLive } from '@ts-minecraft/village-system'
import { TradingServiceLive } from '@ts-minecraft/trading-system'
import { RedstoneServiceLive } from '@ts-minecraft/redstone-circuit'

// Fluid, furnace, light engine
import { FluidServiceLive } from '@ts-minecraft/fluid-simulation'
import { FurnaceServiceLive } from '@ts-minecraft/furnace-system'
import { LightEngineLive } from '@ts-minecraft/light-engine'

// Chunk management
import { ChunkManagerServiceLive } from '@ts-minecraft/chunk-manager'

// Game state, camera state
import { GameStateServiceLive } from '@ts-minecraft/game-session'
import { PlayerCameraStateLive } from '@ts-minecraft/camera-controller'

// Input adapter (presentation → application)
import { InputServiceLive, PlayerInputServiceLive } from '@ts-minecraft/app/presentation/input/input-service'

// Cross-tier deps from infrastructure module
import {
  StoragePortLayer,
  NoisePortLayer,
  TerrainWorkerPoolPortLayer,
  BiomeLayer,
  PhysicsLayer,
} from './infrastructure'

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

// LightEngineService has no service dependencies — exposes Effect.succeed for compute/update
export const LightEngineLayer = LightEngineLive

// Level 3: ChunkManagerService depends on ChunkService, StorageServicePort, BiomeService,
// NoiseServicePort (port — now exposes getSeed too), LightEngineService, and
// TerrainWorkerPoolPort (off-thread terrain generation, with sync fallback in non-browser envs).
export const ChunkManagerLayer = ChunkManagerServiceLive.pipe(
  Layer.provide(Layer.mergeAll(
    ChunkServiceLive,
    StoragePortLayer,
    BiomeLayer,
    NoisePortLayer,
    LightEngineLayer,
    TerrainWorkerPoolPortLayer,
  ))
)

// Fluid simulation service depends on chunk and world state
export const FluidLayer = FluidServiceLive.pipe(
  Layer.provide(ChunkManagerLayer),
)

// InventoryService depends on BlockRegistry — declared before GameLayer because
// GameLayer's death-clears-inventory pathway (FR-1.3) requires it.
export const InventoryLayer = InventoryServiceLive.pipe(
  Layer.provide(BlockRegistryLive),
)

// Level 4: GameStateService depends on PlayerService, PhysicsService, MovementService,
// CameraState, ChunkManagerService, GameModeService (mode-aware respawn FR-1.3),
// and InventoryService (clears on survival death).
export const GameLayer = GameStateServiceLive.pipe(
  Layer.provide(PlayerServiceLive),
  Layer.provide(PhysicsLayer),
  Layer.provide(MovementLayer),
  Layer.provide(CameraStateLayer),
  Layer.provide(ChunkManagerLayer),
  Layer.provide(GameModeServiceLive),
  Layer.provide(InventoryLayer),
)

// Level 4: WorldRendererService depends on ChunkMeshService and SceneService
export const WorldRendererLayer = WorldRendererServiceLive.pipe(
  Layer.provide(ChunkMeshServiceLive),
  Layer.provide(SceneServiceLive),
)

// Level 4: EntityRendererService depends on SceneService — mirrors WorldRendererLayer
export const EntityRendererLayer = EntityRendererLive.pipe(
  Layer.provide(SceneServiceLive),
)

// Level 4: ParticleSystemService depends on ChunkMeshService (atlas texture)
export const ParticleSystemLayer = ParticleSystemServiceLive.pipe(
  Layer.provide(ChunkMeshServiceLive),
)

// Audio infrastructure and managers
export const AudioEngineLayer = AudioEngineLive

export const SoundLayer = SoundManagerLive.pipe(
  Layer.provide(AudioEngineLayer),
)

export const MusicLayer = MusicManagerLive.pipe(
  Layer.provide(AudioEngineLayer),
)

// EntityManager has no service dependencies
export const EntityLayer = EntityManagerLive

// MobSpawner depends on EntityManager and TimeService
export const MobSpawnerLayer = MobSpawnerLive.pipe(
  Layer.provide(EntityLayer),
  Layer.provide(TimeServiceLive),
)

// HotbarService depends on PlayerInputService and InventoryService
export const HotbarLayer = HotbarServiceLive.pipe(
  Layer.provide(PlayerInputLayer),
  Layer.provide(InventoryLayer),
)

export const FurnaceLayer = FurnaceServiceLive.pipe(
  Layer.provide(RecipeServiceLive),
  Layer.provide(InventoryLayer),
  Layer.provide(GameLayer),
  Layer.provide(ChunkManagerLayer),
)

// Level 4: BlockService depends on ChunkManagerService, ChunkService, PlayerService, InventoryService (all independent peers)
export const BlockLayer = BlockServiceLive.pipe(
  Layer.provide(Layer.mergeAll(
    ChunkManagerLayer,
    ChunkServiceLive,
    FluidLayer,
    PlayerServiceLive,
    InventoryLayer,
    FurnaceLayer,
    HotbarServiceLive.pipe(
      Layer.provide(PlayerInputLayer),
      Layer.provide(InventoryLayer),
    ),
  ))
)

// HotbarRenderer depends on RendererService
export const HotbarRendererLayer = HotbarRendererLive.pipe(
  Layer.provide(RendererServiceLive),
)

// Village simulation has no service dependencies
export const VillageLayer = VillageServiceLive

// Trading depends on village state and inventory operations
export const TradingLayer = TradingServiceLive.pipe(
  Layer.provide(VillageLayer),
  Layer.provide(InventoryLayer),
)

// Redstone simulation service has no layer dependencies
export const RedstoneLayer = RedstoneServiceLive

// Top-level bundle re-exported by index.ts
export const GameLogicLayers = Layer.mergeAll(
  GameLayer,
  ChunkManagerLayer,
  BlockLayer,
  HotbarLayer,
  InventoryLayer,
  SoundLayer,
  MusicLayer,
  EntityLayer,
  TimeServiceLive,
  VillageLayer,
  TradingLayer,
  RedstoneLayer,
  FluidLayer,
  LightEngineLayer,
  MobSpawnerLayer,
  HealthServiceLive,
  RecipeServiceLive,
  FurnaceLayer,
  PlayerInputLayer,
  MovementLayer,
  CameraStateLayer,
  RaycastingLayer,
  WorldRendererLayer,  // moved from InfrastructureLayers: orchestrates application→infrastructure
  EntityRendererLayer,
  ParticleSystemLayer,
  GameModeServiceLive,
)
