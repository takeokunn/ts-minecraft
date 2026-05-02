/**
 * Infrastructure-tier Layers — pure infrastructure services + port bridges that
 * decouple the application layer from THREE.js / IndexedDB / WebWorker concerns.
 *
 * Dependency order: pure services (BaseLayer, NoiseLayer) → port bridges →
 * BiomeLayer/PhysicsLayer (application services that consume only ports).
 */
import { Effect, Layer } from 'effect'

// Three.js rendering infrastructure
import { RendererServiceLive, SceneServiceLive, PerspectiveCameraServiceLive, TextureServiceLive, BlockMeshServiceLive, ChunkMeshServiceLive } from '@ts-minecraft/world-renderer'
import { BlockRegistryLive } from '@ts-minecraft/domain'

// Physics infrastructure (custom engine)
import {
  PhysicsWorldService,
  PhysicsWorldServiceLive,
  RigidBodyService,
  RigidBodyServiceLive,
  ShapeService,
  ShapeServiceLive,
} from '@ts-minecraft/physics-engine'
import {
  PhysicsWorldPort,
  RigidBodyPort,
  ShapePort,
} from '@ts-minecraft/physics-engine'

// Procedural generation and storage infrastructure
import { NoiseService, NoiseServiceLive } from '@ts-minecraft/noise-generator'
import { StorageService, StorageServiceLive } from '@ts-minecraft/block-storage'
import { TerrainWorkerPool, TerrainWorkerPoolLive } from '@ts-minecraft/terrain-worker-pool'

// Chunk domain service
import { ChunkServiceLive } from '@ts-minecraft/domain'

// Application-layer ports (decouple application from infrastructure)
import { NoiseServicePort } from '@ts-minecraft/noise-generator'
import { StorageServicePort } from '@ts-minecraft/block-storage'
import { TerrainWorkerPoolPort, TerrainGenerationError as PortTerrainGenerationError } from '@ts-minecraft/terrain-generator'
import { EnvironmentLive } from '@ts-minecraft/environment'

// Terrain
import { BiomeServiceLive } from '@ts-minecraft/biome-classifier'

// Application services that consume only ports — live alongside infrastructure
// because they have no presentation/game-logic dependencies.
import { PhysicsServiceLive } from '@ts-minecraft/physics-engine'

// Player state (used by GameLayer in game-logic.ts; declared here because
// PlayerServiceLive has no dependencies and is part of the base graph).
import { PlayerServiceLive } from '@ts-minecraft/player-controller'

// Input infrastructure (raw DOM/keyboard) — exposed at this layer because
// DomOperationsLive is the lowest-level DOM port the rest of the graph builds on.
import { InputServiceLive } from '@ts-minecraft/app/presentation/input/input-service'
import { DomOperationsLive } from '@ts-minecraft/app/presentation/hud/crosshair'

// Game loop service (no external service dependencies)
import { GameLoopServiceLive } from '@ts-minecraft/game-loop'

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
    // Typed intermediate validates that NoiseService exposes the required port methods
    // with the correct signatures. If a method is renamed or its signature changes, tsc fails here.
    const impl: { noise2D: NoiseService['noise2D']; octaveNoise2D: NoiseService['octaveNoise2D']; setSeed: NoiseService['setSeed']; getSeed: Effect.Effect<number, never>; octaveNoise2DBatch: NoiseService['octaveNoise2DBatch']; noise2DBatch: NoiseService['noise2DBatch']; octaveNoise2DBatchXY: NoiseService['octaveNoise2DBatchXY']; noise2DBatchXY: NoiseService['noise2DBatchXY']; noise3D: NoiseService['noise3D']; noise3DBatchXYZ: NoiseService['noise3DBatchXYZ']; continentalness: NoiseService['continentalness']; erosion: NoiseService['erosion']; weirdness: NoiseService['weirdness']; jaggedness: NoiseService['jaggedness']; sampleTerrainChannels: NoiseService['sampleTerrainChannels'] } = {
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

// Bridge: satisfies TerrainWorkerPoolPort using the infrastructure TerrainWorkerPool.
// `generateTerrain` is the only method the application layer consumes; we widen the
// infrastructure error to the application-side `TerrainGenerationError` via `mapError`
// so the application layer never imports infrastructure types. Other infrastructure-only
// fields on the worker pool (workerCount, queueDepth) are deliberately not exposed.
export const TerrainWorkerPoolPortLayer = Layer.effect(
  TerrainWorkerPoolPort,
  Effect.map(TerrainWorkerPool, (pool) => {
    const impl: { generateTerrain: TerrainWorkerPoolPort['generateTerrain'] } = {
      generateTerrain: (coord, options) =>
        pool.generateTerrain(coord, options).pipe(
          Effect.mapError((err) => new PortTerrainGenerationError({ reason: err.reason, chunk: err.chunk })),
        ),
    }
    // Same `as unknown as` rationale as the other port bridges (see MEMORY.md).
    return impl as unknown as TerrainWorkerPoolPort
  })
).pipe(Layer.provide(TerrainWorkerPoolLive))

// Level 2: BiomeService depends on NoiseServicePort (via bridge)
export const BiomeLayer = BiomeServiceLive.pipe(
  Layer.provide(NoisePortLayer),
)

// Bridge: satisfies PhysicsWorldPort using the infrastructure PhysicsWorldService implementation.
// Same pattern as StoragePortLayer / NoisePortLayer.
export const PhysicsWorldPortLayer = Layer.effect(
  PhysicsWorldPort,
  Effect.map(PhysicsWorldService, (svc) => {
    const impl: { create: PhysicsWorldService['create']; addBody: PhysicsWorldService['addBody']; removeBody: PhysicsWorldService['removeBody']; step: PhysicsWorldService['step'] } = {
      create: (config) => svc.create(config),
      addBody: (world, body) => svc.addBody(world, body),
      removeBody: (world, body) => svc.removeBody(world, body),
      step: (world, deltaTime) => svc.step(world, deltaTime),
    }
    // The cast is unavoidable: Effect.Service adds a `_tag` discriminant that the
    // structural port surface intentionally omits. The typed `impl` above guarantees
    // method signatures match.
    return impl as unknown as PhysicsWorldPort
  })
).pipe(Layer.provide(PhysicsWorldServiceLive))

// Bridge: satisfies RigidBodyPort using the infrastructure RigidBodyService implementation.
export const RigidBodyPortLayer = Layer.effect(
  RigidBodyPort,
  Effect.map(RigidBodyService, (svc) => {
    const impl: { create: RigidBodyService['create']; setPosition: RigidBodyService['setPosition']; setQuaternion: RigidBodyService['setQuaternion']; setVelocity: RigidBodyService['setVelocity']; setAngularVelocity: RigidBodyService['setAngularVelocity']; addShape: RigidBodyService['addShape']; updateMassProperties: RigidBodyService['updateMassProperties'] } = {
      create: (config) => svc.create(config),
      setPosition: (body, position) => svc.setPosition(body, position),
      setQuaternion: (body, quaternion) => svc.setQuaternion(body, quaternion),
      setVelocity: (body, velocity) => svc.setVelocity(body, velocity),
      setAngularVelocity: (body, angularVelocity) => svc.setAngularVelocity(body, angularVelocity),
      addShape: (body, shape) => svc.addShape(body, shape),
      updateMassProperties: (body) => svc.updateMassProperties(body),
    }
    return impl as unknown as RigidBodyPort
  })
).pipe(Layer.provide(RigidBodyServiceLive))

// Bridge: satisfies ShapePort using the infrastructure ShapeService implementation.
export const ShapePortLayer = Layer.effect(
  ShapePort,
  Effect.map(ShapeService, (svc) => {
    const impl: { createBox: ShapeService['createBox']; createSphere: ShapeService['createSphere']; createPlane: ShapeService['createPlane'] } = {
      createBox: (config) => svc.createBox(config),
      createSphere: (config) => svc.createSphere(config),
      createPlane: () => svc.createPlane(),
    }
    return impl as unknown as ShapePort
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
