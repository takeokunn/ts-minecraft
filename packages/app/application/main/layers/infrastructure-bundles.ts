import { Layer } from 'effect'

import { Effect } from 'effect'

// Three.js rendering infrastructure
import {
  RendererService,
  SceneService,
  PerspectiveCameraService,
  TextureService,
  BlockMeshService,
  ChunkMeshService,
} from '@ts-minecraft/rendering'
import { BlockRegistry } from '@ts-minecraft/block'

// Physics infrastructure (custom engine)
import {
  PhysicsWorldPortLayer,
  RigidBodyPortLayer,
  ShapePortLayer,
  SettingsStorageServiceLayer,
} from '@ts-minecraft/game'

// Procedural generation and storage infrastructure
import { NoiseService, StorageService } from '@ts-minecraft/world'
export { TerrainWorkerPoolPortLayer } from '@ts-minecraft/worker'

// Chunk domain service
import { ChunkService } from '@ts-minecraft/world'

// Application-layer ports (decouple application from infrastructure)
import { NoiseServicePort, StorageServicePort, EnvironmentLayer } from '@ts-minecraft/world'

// Terrain
import { BiomeService } from '@ts-minecraft/world'

// Application services that consume only ports — live alongside infrastructure
// because they have no presentation/game-logic dependencies.
import { PhysicsService } from '@ts-minecraft/game'

// Player state (used by GameLayer in game-logic-game-state-bundles.ts;
// declared here because PlayerService has no dependencies and is part of the base graph).
import { PlayerService } from '@ts-minecraft/entity'

// Input infrastructure (raw DOM/keyboard) — exposed at this layer because
// DomOperationsService.Default is the lowest-level DOM port the rest of the graph builds on.
import { InputService } from '@ts-minecraft/presentation'
import { DomOperationsService } from '@ts-minecraft/presentation'

// Game loop service (no external service dependencies)
import { GameLoopService } from '@ts-minecraft/game'

// Build layers from the bottom up, providing dependencies at each level.
// Sequence the layers explicitly so bridge layers do not leak their required
// services into the final environment.
export const BaseLayer = RendererService.Default.pipe(
  Layer.provideMerge(SceneService.Default),
  Layer.provideMerge(PerspectiveCameraService.Default),
  Layer.provideMerge(TextureService.Default),
  Layer.provideMerge(BlockMeshService.Default),
  Layer.provideMerge(BlockRegistry.Default),
  Layer.provideMerge(PlayerService.Default),
  Layer.provideMerge(InputService.Default),
  Layer.provideMerge(DomOperationsService.Default),
  Layer.provideMerge(StorageService.Default),
  Layer.provideMerge(ChunkService.Default),
  Layer.provideMerge(ChunkMeshService.Default),
  Layer.provideMerge(GameLoopService.Default),
)

// Shared NoiseService — single instance provided to all dependents
export const NoiseLayer = NoiseService.Default

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
).pipe(Layer.provide(StorageService.Default))

// Level 2: BiomeService depends on NoiseServicePort (via bridge)
export const BiomeLayer = BiomeService.Default.pipe(
  Layer.provide(NoisePortLayer),
)

// Level 2: PhysicsService depends on PhysicsWorldPort, RigidBodyPort, ShapePort (all independent peers, satisfied by bridges)
export const PhysicsLayer = PhysicsService.Default.pipe(
  Layer.provide(Layer.mergeAll(PhysicsWorldPortLayer, RigidBodyPortLayer, ShapePortLayer))
)

// EnvironmentPort bridge: browser-backed implementation reads window.location.hostname
export const PlatformInfrastructureLayers = BaseLayer.pipe(
  Layer.provideMerge(NoiseLayer),
  Layer.provideMerge(NoisePortLayer),
  Layer.provideMerge(StoragePortLayer),
  Layer.provideMerge(SettingsStorageServiceLayer),
  Layer.provideMerge(EnvironmentLayer),
)

export const SimulationInfrastructureLayers = Layer.mergeAll(
  BiomeLayer,
  PhysicsLayer,
)

export const InfrastructureLayers = PlatformInfrastructureLayers.pipe(
  Layer.provideMerge(SimulationInfrastructureLayers),
)

export { EnvironmentLayer } from '@ts-minecraft/world'
