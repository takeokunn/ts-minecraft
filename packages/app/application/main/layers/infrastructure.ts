// Infrastructure-tier Layers — pure infrastructure services + port bridges that
// decouple the application layer from THREE.js / IndexedDB / WebWorker concerns.
// Dependency order: pure services (BaseLayer, NoiseLayer) → port bridges →
// BiomeLayer/PhysicsLayer (application services that consume only ports).
import { Effect, Layer } from 'effect'

// Three.js rendering infrastructure
import { RendererServiceLive, SceneServiceLive, PerspectiveCameraServiceLive, TextureServiceLive, BlockMeshServiceLive, ChunkMeshServiceLive } from '@ts-minecraft/rendering'
import { BlockRegistryLive } from '@ts-minecraft/block'

// Physics infrastructure (custom engine)
import {
  PhysicsWorldPortLayer,
  RigidBodyPortLayer,
  ShapePortLayer,
} from '@ts-minecraft/game'

// Procedural generation and storage infrastructure
import { NoiseService, NoiseServiceLive, StorageService, StorageServiceLive } from '@ts-minecraft/world'
export { TerrainWorkerPoolPortLayer } from '@ts-minecraft/worker'

// Chunk domain service
import { ChunkServiceLive } from '@ts-minecraft/world'

// Application-layer ports (decouple application from infrastructure)
import { NoiseServicePort, StorageServicePort, EnvironmentLive } from '@ts-minecraft/world'

// Terrain
import { BiomeServiceLive } from '@ts-minecraft/world'

// Application services that consume only ports — live alongside infrastructure
// because they have no presentation/game-logic dependencies.
import { PhysicsServiceLive } from '@ts-minecraft/game'

// Player state (used by GameLayer in game-logic.ts; declared here because
// PlayerServiceLive has no dependencies and is part of the base graph).
import { PlayerServiceLive } from '@ts-minecraft/entity'

// Input infrastructure (raw DOM/keyboard) — exposed at this layer because
// DomOperationsLive is the lowest-level DOM port the rest of the graph builds on.
import { InputServiceLive } from '@ts-minecraft/presentation/input/input-service'
import { DomOperationsLive } from '@ts-minecraft/presentation/hud/crosshair'

// Game loop service (no external service dependencies)
import { GameLoopServiceLive } from '@ts-minecraft/game'

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
  // FPS counter presentation wiring lives in PresentationLayers.
  StorageServiceLive,
  ChunkServiceLive,
  ChunkMeshServiceLive,
  // Game loop service (no external service dependencies)
  GameLoopServiceLive,
)

// Shared NoiseService — single instance provided to all dependents
export const NoiseLayer = NoiseServiceLive

// Bridge: satisfies NoiseServicePort using the infrastructure NoiseService implementation.
export const NoisePortLayer = Layer.effect(
  NoiseServicePort,
  Effect.map(NoiseService, (noise) => {
    return NoiseServicePort.of({
      _tag: '@minecraft/application/noise/NoiseServicePort' as const,
      noise2D: (x, z) => noise.noise2D(x, z),
      octaveNoise2D: (x, z, o, p, l) => noise.octaveNoise2D(x, z, o, p, l),
      setSeed: (seed) => noise.setSeed(seed),
      // `getSeed` is a plain Effect on both the service and port — no call needed.
      getSeed: noise.getSeed,
      octaveNoise2DBatch: (points, o, p, l) => noise.octaveNoise2DBatch(points, o, p, l),
      noise2DBatch: (points) => noise.noise2DBatch(points),
      octaveNoise2DBatchXY: (xs, zs, o, p, l) => noise.octaveNoise2DBatchXY(xs, zs, o, p, l),
      noise2DBatchXY: (xs, zs) => noise.noise2DBatchXY(xs, zs),
      noise3D: (x, y, z) => noise.noise3D(x, y, z),
      noise3DBatchXYZ: (xs, ys, zs) => noise.noise3DBatchXYZ(xs, ys, zs),
      continentalness: (x, z) => noise.continentalness(x, z),
      erosion: (x, z) => noise.erosion(x, z),
      weirdness: (x, z) => noise.weirdness(x, z),
      jaggedness: (x, z) => noise.jaggedness(x, z),
      sampleTerrainChannels: (xStart, zStart) => noise.sampleTerrainChannels(xStart, zStart),
    })
  })
).pipe(Layer.provide(NoiseLayer))

// Bridge: satisfies StorageServicePort using the infrastructure StorageService implementation.
export const StoragePortLayer = Layer.effect(
  StorageServicePort,
  Effect.map(StorageService, (storage) => {
    return StorageServicePort.of({
      _tag: '@minecraft/application/storage/StorageServicePort' as const,
      saveChunk: (worldId, chunkCoord, blocks) => storage.saveChunk(worldId, chunkCoord, blocks),
      loadChunk: (worldId, chunkCoord) => storage.loadChunk(worldId, chunkCoord),
    })
  })
).pipe(Layer.provide(StorageServiceLive))

// Level 2: BiomeService depends on NoiseServicePort (via bridge)
export const BiomeLayer = BiomeServiceLive.pipe(
  Layer.provide(NoisePortLayer),
)

// Level 2: PhysicsService depends on PhysicsWorldPort, RigidBodyPort, ShapePort (all independent peers, satisfied by bridges)
export const PhysicsLayer = PhysicsServiceLive.pipe(
  Layer.provide(Layer.mergeAll(PhysicsWorldPortLayer, RigidBodyPortLayer, ShapePortLayer))
)

// EnvironmentPort bridge: browser-backed implementation reads window.location.hostname
export const EnvironmentLayer = EnvironmentLive

// Top-level bundle re-exported by index.ts
export const InfrastructureLayers = Layer.mergeAll(
  BaseLayer,
  NoiseLayer,
  BiomeLayer,
  PhysicsLayer,
  // WorldRendererLayer moved to GameLogicLayers
)
