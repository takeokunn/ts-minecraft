// Infrastructure-tier Layers — pure infrastructure services + port bridges that
// decouple the application layer from THREE.js / IndexedDB / WebWorker concerns.
// Dependency order: pure services (BaseLayer, NoiseLayer) → port bridges →
// BiomeLayer/PhysicsLayer (application services that consume only ports).
import { Effect, Layer } from 'effect'

// Three.js rendering infrastructure
import { RendererServiceLive, SceneServiceLive, PerspectiveCameraServiceLive, TextureServiceLive, BlockMeshServiceLive, ChunkMeshServiceLive } from '@ts-minecraft/rendering'
import { BlockRegistryLive } from '@ts-minecraft/world-state'

// Physics infrastructure (custom engine)
import {
  PhysicsWorldService,
  PhysicsWorldServiceLive,
  RigidBodyService,
  RigidBodyServiceLive,
  ShapeService,
  ShapeServiceLive,
} from '@ts-minecraft/physics'
import {
  PhysicsWorldPort,
  RigidBodyPort,
  ShapePort,
} from '@ts-minecraft/physics'

// Procedural generation and storage infrastructure
import { NoiseService, NoiseServiceLive } from '@ts-minecraft/terrain'
import { StorageService, StorageServiceLive } from '@ts-minecraft/world-state'
import { TerrainWorkerPool, TerrainWorkerPoolLive } from '@ts-minecraft/terrain'

// Chunk domain service
import { ChunkServiceLive } from '@ts-minecraft/terrain'

// Application-layer ports (decouple application from infrastructure)
import { NoiseServicePort } from '@ts-minecraft/terrain'
import { StorageServicePort } from '@ts-minecraft/terrain'
import { TerrainWorkerPoolPort, TerrainGenerationError as PortTerrainGenerationError } from '@ts-minecraft/terrain'
import { EnvironmentLive } from '@ts-minecraft/world-state'

// Terrain
import { BiomeServiceLive } from '@ts-minecraft/terrain'

// Application services that consume only ports — live alongside infrastructure
// because they have no presentation/game-logic dependencies.
import { PhysicsServiceLive } from '@ts-minecraft/physics'

// Player state (used by GameLayer in game-logic.ts; declared here because
// PlayerServiceLive has no dependencies and is part of the base graph).
import { PlayerServiceLive } from '@ts-minecraft/player'

// Input infrastructure (raw DOM/keyboard) — exposed at this layer because
// DomOperationsLive is the lowest-level DOM port the rest of the graph builds on.
import { InputServiceLive } from '@ts-minecraft/app/presentation/input/input-service'
import { DomOperationsLive } from '@ts-minecraft/app/presentation/hud/crosshair'

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
      // `getSeed` is exposed as a plain Effect (not a thunk) on the port to match
      // the read-only "current seed" semantics. The infrastructure-side method
      // is a thunk that builds an `Effect.sync` per call; we evaluate it once
      // here and reuse the resulting Effect — same value, same shape.
      getSeed: noise.getSeed(),
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

// Bridge: satisfies TerrainWorkerPoolPort using the infrastructure TerrainWorkerPool.
// `generateTerrain` is the only method the application layer consumes; we widen the
// infrastructure error to the application-side `TerrainGenerationError` via `mapError`
// so the application layer never imports infrastructure types. Other infrastructure-only
// fields on the worker pool (workerCount, queueDepth) are deliberately not exposed.
export const TerrainWorkerPoolPortLayer = Layer.effect(
  TerrainWorkerPoolPort,
  Effect.map(TerrainWorkerPool, (pool) => {
    return TerrainWorkerPoolPort.of({
      _tag: '@minecraft/application/terrain/TerrainWorkerPoolPort' as const,
      generateTerrain: (coord, options) =>
        pool.generateTerrain(coord, options).pipe(
          Effect.mapError((err) => new PortTerrainGenerationError({ reason: err.reason, chunk: err.chunk })),
        ),
    })
  })
).pipe(Layer.provide(TerrainWorkerPoolLive))

// Level 2: BiomeService depends on NoiseServicePort (via bridge)
export const BiomeLayer = BiomeServiceLive.pipe(
  Layer.provide(NoisePortLayer),
)

// Bridge: satisfies PhysicsWorldPort using the infrastructure PhysicsWorldService implementation.
export const PhysicsWorldPortLayer = Layer.effect(
  PhysicsWorldPort,
  Effect.map(PhysicsWorldService, (svc) => {
    return PhysicsWorldPort.of({
      _tag: '@minecraft/application/physics/PhysicsWorldPort' as const,
      create: (config) => svc.create(config),
      addBody: (world, body) => svc.addBody(world, body),
      removeBody: (world, body) => svc.removeBody(world, body),
      step: (world, deltaTime) => svc.step(world, deltaTime),
    })
  })
).pipe(Layer.provide(PhysicsWorldServiceLive))

// Bridge: satisfies RigidBodyPort using the infrastructure RigidBodyService implementation.
export const RigidBodyPortLayer = Layer.effect(
  RigidBodyPort,
  Effect.map(RigidBodyService, (svc) => {
    return RigidBodyPort.of({
      _tag: '@minecraft/application/physics/RigidBodyPort' as const,
      create: (config) => svc.create(config),
      setPosition: (body, position) => svc.setPosition(body, position),
      setQuaternion: (body, quaternion) => svc.setQuaternion(body, quaternion),
      setVelocity: (body, velocity) => svc.setVelocity(body, velocity),
      setAngularVelocity: (body, angularVelocity) => svc.setAngularVelocity(body, angularVelocity),
      addShape: (body, shape) => svc.addShape(body, shape),
      updateMassProperties: (body) => svc.updateMassProperties(body),
    })
  })
).pipe(Layer.provide(RigidBodyServiceLive))

// Bridge: satisfies ShapePort using the infrastructure ShapeService implementation.
export const ShapePortLayer = Layer.effect(
  ShapePort,
  Effect.map(ShapeService, (svc) => {
    return ShapePort.of({
      _tag: '@minecraft/application/physics/ShapePort' as const,
      createBox: (config) => svc.createBox(config),
      createSphere: (config) => svc.createSphere(config),
      createPlane: () => svc.createPlane(),
    })
  })
).pipe(Layer.provide(ShapeServiceLive))

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
