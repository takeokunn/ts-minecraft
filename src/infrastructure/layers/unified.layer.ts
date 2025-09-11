import { Layer, Effect, Context, Ref, Queue, Option, HashMap } from 'effect'
import * as THREE from 'three'
import { EntityId } from '/value-objects/schemas/index'
import { Chunk } from '/entities/chunk.entity'
import { ChunkCoordinate } from '/value-objects/coordinates/chunk-coordinate.vo'

/**
 * Unified Layer Implementation
 * 
 * MIGRATION NOTICE: This layer is being refactored to use the Adapter pattern.
 * New services use concrete adapters from /infrastructure/adapters/
 * Legacy services are maintained for backward compatibility but will delegate to adapters.
 * 
 * Architecture:
 * - Domain services contain pure business logic
 * - Infrastructure adapters implement port interfaces with technical details
 * - This unified layer provides Effect-TS service definitions for the application layer
 */

// ============================================================================
// SERVICE DEFINITIONS (Context.Tag patterns)
// ============================================================================

/**
 * Performance statistics interface
 */
export interface PerformanceStats {
  readonly fps: number
  readonly ms: number
  readonly memory?: number
}

/**
 * Input state interface
 */
export interface InputState {
  readonly keys: Record<string, boolean>
  readonly mouse: {
    readonly x: number
    readonly y: number
    readonly buttons: Record<string, boolean>
  }
}

/**
 * Render command types for the rendering queue
 */
export type RenderCommandType =
  | {
      readonly type: 'ADD_CHUNK'
      readonly chunkX: number
      readonly chunkZ: number
      readonly positions: Float32Array
      readonly normals: Float32Array
      readonly uvs: Float32Array
      readonly indices: Uint32Array
    }
  | {
      readonly type: 'REMOVE_CHUNK'
      readonly chunkX: number
      readonly chunkZ: number
    }

/**
 * Clock Service - Provides time and delta time for game loop
 */
export class Clock extends Context.Tag('Clock')<
  Clock,
  {
    readonly getDelta: () => Effect.Effect<number>
    readonly getElapsedTime: () => Effect.Effect<number>
    readonly start: () => Effect.Effect<void>
    readonly stop: () => Effect.Effect<void>
  }
>() {}

/**
 * Stats Service - Performance monitoring
 */
export class Stats extends Context.Tag('Stats')<
  Stats,
  {
    readonly begin: () => Effect.Effect<void>
    readonly end: () => Effect.Effect<void>
    readonly getStats: () => Effect.Effect<PerformanceStats>
  }
>() {}

/**
 * Renderer Service - Manages 3D rendering operations
 */
export class Renderer extends Context.Tag('Renderer')<
  Renderer,
  {
    readonly renderQueue: Queue.Queue<RenderCommandType>
    readonly updateCamera: (position: THREE.Vector3, rotation: THREE.Euler) => Effect.Effect<void>
  }
>() {}

/**
 * InputManager Service - Handles user input
 */
export class InputManager extends Context.Tag('InputManager')<
  InputManager,
  {
    readonly initialize: () => Effect.Effect<void>
    readonly getInputState: () => Effect.Effect<InputState>
    readonly updateInputState: (state: InputState) => Effect.Effect<void>
    readonly dispose: () => Effect.Effect<void>
  }
>() {}

/**
 * MaterialManager Service - Manages Three.js materials
 */
export class MaterialManager extends Context.Tag('MaterialManager')<
  MaterialManager,
  {
    readonly getMaterial: (name: string) => Effect.Effect<THREE.Material>
    readonly createMaterial: (name: string, config: any) => Effect.Effect<THREE.Material>
    readonly disposeMaterials: () => Effect.Effect<void>
  }
>() {}

/**
 * SpatialGrid Service - Spatial partitioning for performance
 */
export class SpatialGrid extends Context.Tag('SpatialGrid')<
  SpatialGrid,
  {
    readonly initialize: () => Effect.Effect<void>
    readonly insert: (id: any, x: number, y: number, z: number) => Effect.Effect<void>
    readonly remove: (id: any) => Effect.Effect<void>
    readonly query: (x: number, y: number, z: number, radius: number) => Effect.Effect<any[]>
    readonly update: (id: any, x: number, y: number, z: number) => Effect.Effect<void>
  }
>() {}

/**
 * ChunkManager Service - Manages world chunks
 */
export class ChunkManager extends Context.Tag('ChunkManager')<
  ChunkManager,
  {
    readonly loadChunk: (x: number, z: number) => Effect.Effect<void>
    readonly unloadChunk: (x: number, z: number) => Effect.Effect<void>
    readonly isChunkLoaded: (x: number, z: number) => Effect.Effect<boolean>
    readonly getLoadedChunks: () => Effect.Effect<Array<{ x: number; z: number }>>
  }
>() {}

/**
 * WorkerManager Service - Unified worker management system
 */
export class WorkerManager extends Context.Tag('WorkerManager')<
  WorkerManager,
  {
    readonly generateTerrain: (
      request: any,
      options?: {
        priority?: number
        timeout?: any
        preferredWorkerId?: string
      },
    ) => Effect.Effect<any, never, never>

    readonly simulatePhysics: (
      request: any,
      options?: {
        priority?: number
        timeout?: any
        preferredWorkerId?: string
      },
    ) => Effect.Effect<any, never, never>

    readonly generateMesh: (
      request: any,
      options?: {
        priority?: number
        timeout?: any
        preferredWorkerId?: string
      },
    ) => Effect.Effect<any, never, never>

    readonly getPoolStats: () => Effect.Effect<
      {
        totalWorkers: number
        activeWorkers: number
        idleWorkers: number
        errorWorkers: number
        totalRequests: number
        averageResponseTime: number
      },
      never,
      never
    >

    readonly shutdown: () => Effect.Effect<void, never, never>
  }
>() {}

// TerrainGenerator now uses the adapter pattern from infrastructure/adapters
// This service tag is kept for compatibility but will delegate to the adapter
export class TerrainGenerator extends Context.Tag('TerrainGenerator')<
  TerrainGenerator,
  {
    readonly generateChunkTerrain: (coords: ChunkCoordinate) => Effect.Effect<{ blocks: Uint8Array; heightMap: number[] }, never, never>
    readonly getHeightAt: (worldX: number, worldZ: number) => Effect.Effect<number, never, never>
    readonly generateHeightMap: (startX: number, startZ: number, width: number, depth: number) => Effect.Effect<number[], never, never>
    readonly getBiomeAt: (worldX: number, worldZ: number) => Effect.Effect<string, never, never>
    readonly setSeed: (seed: number) => Effect.Effect<void, never, never>
    readonly getSeed: () => Effect.Effect<number, never, never>
    readonly getConfig: () => Effect.Effect<any, never, never>
  }
>() {}

/**
 * RenderCommand Service - Rendering command queue management
 */
export class RenderCommand extends Context.Tag('RenderCommand')<
  RenderCommand,
  {
    readonly execute: (command: any) => Effect.Effect<void, never, never>
    readonly enqueue: (command: any) => Effect.Effect<void, never, never>
    readonly flush: () => Effect.Effect<void, never, never>
    readonly clear: () => Effect.Effect<void, never, never>
  }
>() {}

/**
 * Raycast result interface
 */
export interface RaycastResult {
  readonly hit: boolean
  readonly intersection?: THREE.Intersection
  readonly distance: number
  readonly point?: THREE.Vector3
  readonly normal?: THREE.Vector3
}

/**
 * Raycast Service interface
 */
interface RaycastService {
  readonly raycast: (origin?: THREE.Vector3, direction?: THREE.Vector3, maxDistance?: number) => Effect.Effect<Option.Option<THREE.Intersection>, never, never>
  readonly raycastFromCamera: () => Effect.Effect<Option.Option<THREE.Intersection>, never, never>
  readonly setCamera: (camera: THREE.Camera) => Effect.Effect<void, never, never>
  readonly setScene: (scene: THREE.Scene) => Effect.Effect<void, never, never>
}

/**
 * Raycast Service - 3D raycasting for interaction
 */
export class Raycast extends Context.Tag('Raycast')<Raycast, RaycastService>() {}

/**
 * UIService interface
 */
interface UIServiceInterface {
  readonly initialize: () => Effect.Effect<void, never, never>
  readonly render: () => Effect.Effect<void, never, never>
  readonly update: (deltaTime: number) => Effect.Effect<void, never, never>
  readonly dispose: () => Effect.Effect<void, never, never>
  readonly showHUD: (visible: boolean) => Effect.Effect<void, never, never>
  readonly updateHotbar: (items: any[]) => Effect.Effect<void, never, never>
  readonly showCrosshair: (visible: boolean) => Effect.Effect<void, never, never>
}

/**
 * UIService - User interface management
 */
export class UIService extends Context.Tag('UIService')<UIService, UIServiceInterface>() {}

/**
 * World Service interface
 */
interface WorldService {
  readonly initialize: () => Effect.Effect<void, never, never>
  readonly getBlock: (x: number, y: number, z: number) => Effect.Effect<number, never, never>
  readonly setBlock: (x: number, y: number, z: number, blockType: number) => Effect.Effect<void, never, never>
  readonly dispose: () => Effect.Effect<void, never, never>
}

/**
 * World Service - Main world state management
 */
export class World extends Context.Tag('World')<World, WorldService>() {}

// ============================================================================
// DOMAIN SERVICE DEFINITIONS
// ============================================================================

/**
 * World State Interface
 */
export interface WorldState {
  readonly _tag: 'WorldState'
  readonly entities: HashMap.HashMap<EntityId, unknown>
  readonly chunks: HashMap.HashMap<string, Chunk>
  readonly timestamp: number
}

/**
 * WorldDomainService interface
 */
interface WorldDomainServiceInterface {
  readonly validateWorldState: (state: WorldState) => Effect.Effect<boolean, never, never>
  readonly addEntityToWorld: (entityId: EntityId, entityData: unknown) => Effect.Effect<void, never, never>
  readonly removeEntityFromWorld: (entityId: EntityId) => Effect.Effect<void, never, never>
  readonly addChunkToWorld: (chunk: Chunk) => Effect.Effect<void, never, never>
  readonly removeChunkFromWorld: (coordinate: ChunkCoordinate) => Effect.Effect<void, never, never>
  readonly updateWorldTimestamp: (state: WorldState) => Effect.Effect<WorldState, never, never>
  readonly calculateChunkKey: (coordinate: ChunkCoordinate) => string
  readonly validateChunkCoordinate: (coordinate: ChunkCoordinate) => Effect.Effect<boolean, never, never>
  readonly isChunkLoaded: (chunkX: number, chunkZ: number) => Effect.Effect<boolean, never, never>
  readonly getChunk: (chunkX: number, chunkZ: number) => Effect.Effect<{ blocks: any[]; entities: any[]; lastUpdate: number }, never, never>
  readonly getLoadedChunks: () => Effect.Effect<readonly { coordinate: { x: number; z: number } }[], never, never>
}

/**
 * WorldDomainService - Pure domain world logic
 */
export class WorldDomainService extends Context.Tag('WorldDomainService')<WorldDomainService, WorldDomainServiceInterface>() {}

/**
 * PhysicsDomainService interface
 */
interface PhysicsDomainServiceInterface {
  readonly simulatePhysics: (deltaTime: number) => Effect.Effect<void, never, never>
  readonly detectCollisions: () => Effect.Effect<readonly any[], never, never>
  readonly applyForces: (entityId: EntityId, force: THREE.Vector3) => Effect.Effect<void, never, never>
  readonly updateRigidBody: (entityId: EntityId, position: THREE.Vector3, velocity: THREE.Vector3) => Effect.Effect<void, never, never>
  readonly getEntityVelocity: (entityId: EntityId) => Effect.Effect<{ dx: number; dy: number; dz: number }, never, never>
  readonly isEntityGrounded: (entityId: EntityId) => Effect.Effect<boolean, never, never>
  readonly getAllPhysicsObjects: () => Effect.Effect<readonly any[], never, never>
}

/**
 * PhysicsDomainService - Pure domain physics logic
 */
export class PhysicsDomainService extends Context.Tag('PhysicsDomainService')<PhysicsDomainService, PhysicsDomainServiceInterface>() {}

/**
 * EntityDomainService interface
 */
interface EntityDomainServiceInterface {
  readonly createEntity: () => Effect.Effect<EntityId, never, never>
  readonly destroyEntity: (entityId: EntityId) => Effect.Effect<void, never, never>
  readonly hasEntity: (entityId: EntityId) => Effect.Effect<boolean, never, never>
  readonly getEntityCount: () => Effect.Effect<number, never, never>
  readonly getEntity: (entityId: EntityId) => Effect.Effect<{ id: EntityId; health?: number; inventory?: any[] }, Error, never>
  readonly getEntityPosition: (entityId: EntityId) => Effect.Effect<{ x: number; y: number; z: number }, Error, never>
  readonly getAllEntities: () => Effect.Effect<readonly { id: EntityId }[], never, never>
  readonly getEntitiesByType: (entityType: string) => Effect.Effect<readonly { id: EntityId }[], never, never>
  readonly getEntitiesInRadius: (center: { x: number; y: number; z: number }, radius: number) => Effect.Effect<readonly { id: EntityId }[], never, never>
}

/**
 * EntityDomainService - Entity management
 */
export class EntityDomainService extends Context.Tag('EntityDomainService')<EntityDomainService, EntityDomainServiceInterface>() {}

// ============================================================================
// LIVE IMPLEMENTATIONS
// ============================================================================

/**
 * Clock Live Implementation
 */
export const ClockLive: Layer.Layer<Clock, never, never> = Layer.effect(
  Clock,
  Effect.gen(function* () {
    const startTime = yield* Ref.make(Date.now())
    const lastTime = yield* Ref.make(Date.now())
    const isRunning = yield* Ref.make(false)

    return {
      getDelta: () =>
        Effect.gen(function* () {
          const running = yield* Ref.get(isRunning)
          if (!running) return 0

          const last = yield* Ref.get(lastTime)
          const now = Date.now()
          yield* Ref.set(lastTime, now)

          // Cap delta time to prevent large jumps
          const delta = Math.min((now - last) / 1000, 0.1)
          return delta
        }),

      getElapsedTime: () =>
        Effect.gen(function* () {
          const start = yield* Ref.get(startTime)
          return (Date.now() - start) / 1000
        }),

      start: () =>
        Effect.gen(function* () {
          const now = Date.now()
          yield* Ref.set(startTime, now)
          yield* Ref.set(lastTime, now)
          yield* Ref.set(isRunning, true)
        }),

      stop: () => Ref.set(isRunning, false),
    }
  }),
)

/**
 * Stats Live Implementation
 */
export const StatsLive: Layer.Layer<Stats, never, never> = Layer.effect(
  Stats,
  Effect.gen(function* () {
    const frames = yield* Ref.make(0)
    const startTime = yield* Ref.make(0)
    const prevTime = yield* Ref.make(0)
    const ms = yield* Ref.make(0)
    const fps = yield* Ref.make(0)

    return {
      begin: () =>
        Effect.gen(function* () {
          const now = performance.now()
          yield* Ref.set(startTime, now)
        }),

      end: () =>
        Effect.gen(function* () {
          const now = performance.now()
          const start = yield* Ref.get(startTime)
          const frameMs = now - start
          yield* Ref.set(ms, frameMs)

          const currentFrames = yield* Ref.get(frames)
          yield* Ref.set(frames, currentFrames + 1)

          const prev = yield* Ref.get(prevTime)
          if (now >= prev + 1000) {
            const currentFps = (currentFrames * 1000) / (now - prev)
            yield* Ref.set(fps, Math.round(currentFps))
            yield* Ref.set(prevTime, now)
            yield* Ref.set(frames, 0)
          }
        }),

      getStats: () =>
        Effect.gen(function* () {
          const currentFps = yield* Ref.get(fps)
          const currentMs = yield* Ref.get(ms)
          const memory = (performance as any).memory?.usedJSHeapSize

          return {
            fps: currentFps,
            ms: currentMs,
            memory: memory ? Math.round((memory / 1048576) * 100) / 100 : undefined,
          }
        }),
    }
  }),
)

/**
 * Renderer Live Implementation
 */
export const RendererLive: Layer.Layer<Renderer, never, never> = Layer.effect(
  Renderer,
  Effect.gen(function* () {
    const renderQueue = yield* Queue.unbounded<RenderCommandType>()

    return {
      renderQueue,
      updateCamera: (position: THREE.Vector3, rotation: THREE.Euler) => Effect.succeed(undefined),
    }
  }),
)

/**
 * InputManager Live Implementation
 */
export const InputManagerLive: Layer.Layer<InputManager, never, never> = Layer.effect(
  InputManager,
  Effect.gen(function* () {
    const inputState = yield* Ref.make<InputState>({
      keys: {},
      mouse: { x: 0, y: 0, buttons: {} },
    })

    return {
      initialize: () => Effect.succeed(undefined),

      getInputState: () => Ref.get(inputState),

      updateInputState: (state: InputState) => Ref.set(inputState, state),

      dispose: () => Effect.succeed(undefined),
    }
  }),
)

/**
 * MaterialManager Live Implementation
 */
export const MaterialManagerLive: Layer.Layer<MaterialManager, never, never> = Layer.effect(
  MaterialManager,
  Effect.gen(function* () {
    const materials = yield* Ref.make<Map<string, THREE.Material>>(new Map())

    return {
      getMaterial: (name: string) =>
        Effect.gen(function* () {
          const materialMap = yield* Ref.get(materials)
          const material = materialMap.get(name)

          if (material) {
            return material
          }

          // Create default material if not found
          const defaultMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
          materialMap.set(name, defaultMaterial)
          yield* Ref.set(materials, materialMap)

          return defaultMaterial
        }),

      createMaterial: (name: string, config: any) =>
        Effect.gen(function* () {
          const material = new THREE.MeshBasicMaterial(config)
          const materialMap = yield* Ref.get(materials)
          materialMap.set(name, material)
          yield* Ref.set(materials, materialMap)

          return material
        }),

      disposeMaterials: () =>
        Effect.gen(function* () {
          const materialMap = yield* Ref.get(materials)
          for (const material of materialMap.values()) {
            material.dispose()
          }
          materialMap.clear()
          yield* Ref.set(materials, materialMap)
        }),
    }
  }),
)

/**
 * SpatialGrid Live Implementation
 */
export const SpatialGridLive: Layer.Layer<SpatialGrid, never, never> = Layer.effect(
  SpatialGrid,
  Effect.gen(function* () {
    const grid = yield* Ref.make<Map<string, any>>(new Map())

    const getKey = (x: number, y: number, z: number) => `${x},${y},${z}`

    return {
      initialize: () => Effect.succeed(undefined),

      insert: (id: any, x: number, y: number, z: number) =>
        Effect.gen(function* () {
          const gridMap = yield* Ref.get(grid)
          const key = getKey(Math.floor(x), Math.floor(y), Math.floor(z))
          gridMap.set(key, id)
          yield* Ref.set(grid, gridMap)
        }),

      remove: (id: any) =>
        Effect.gen(function* () {
          const gridMap = yield* Ref.get(grid)
          for (const [key, value] of gridMap.entries()) {
            if (value === id) {
              gridMap.delete(key)
              break
            }
          }
          yield* Ref.set(grid, gridMap)
        }),

      query: (x: number, y: number, z: number, radius: number) =>
        Effect.gen(function* () {
          const gridMap = yield* Ref.get(grid)
          const results: any[] = []

          for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
              for (let dz = -radius; dz <= radius; dz++) {
                const key = getKey(Math.floor(x) + dx, Math.floor(y) + dy, Math.floor(z) + dz)
                const item = gridMap.get(key)
                if (item) results.push(item)
              }
            }
          }

          return results
        }),

      update: (id: any, x: number, y: number, z: number) =>
        Effect.gen(function* () {
          // Direct state manipulation to avoid circular dependency
          const gridMap = yield* Ref.get(grid)
          
          // Remove from old position
          for (const [key, value] of gridMap.entries()) {
            if (value === id) {
              gridMap.delete(key)
              break
            }
          }
          
          // Insert at new position
          const key = getKey(Math.floor(x), Math.floor(y), Math.floor(z))
          gridMap.set(key, id)
          yield* Ref.set(grid, gridMap)
        }),
    }
  }),
)

/**
 * ChunkManager Live Implementation
 */
export const ChunkManagerLive: Layer.Layer<ChunkManager, never, never> = Layer.effect(
  ChunkManager,
  Effect.gen(function* () {
    const loadedChunks = yield* Ref.make<Set<string>>(new Set())

    const getChunkKey = (x: number, z: number) => `${x},${z}`

    return {
      loadChunk: (x: number, z: number) =>
        Effect.gen(function* () {
          const chunks = yield* Ref.get(loadedChunks)
          const key = getChunkKey(x, z)
          chunks.add(key)
          yield* Ref.set(loadedChunks, chunks)
        }),

      unloadChunk: (x: number, z: number) =>
        Effect.gen(function* () {
          const chunks = yield* Ref.get(loadedChunks)
          const key = getChunkKey(x, z)
          chunks.delete(key)
          yield* Ref.set(loadedChunks, chunks)
        }),

      isChunkLoaded: (x: number, z: number) =>
        Effect.gen(function* () {
          const chunks = yield* Ref.get(loadedChunks)
          const key = getChunkKey(x, z)
          return chunks.has(key)
        }),

      getLoadedChunks: () =>
        Effect.gen(function* () {
          const chunks = yield* Ref.get(loadedChunks)
          return Array.from(chunks).map((key) => {
            const [x, z] = key.split(',').map(Number)
            return { x, z }
          })
        }),
    }
  }),
)

/**
 * WorkerManager Live Implementation - Uses unified worker system
 */
export const WorkerManagerLive: Layer.Layer<WorkerManager, never, never> = Layer.effect(
  WorkerManager,
  Effect.gen(function* () {
    // Create a unified worker manager with default configuration
    const make = (
      config = {
        terrain: { poolSize: 2, maxConcurrency: 4, timeout: { _tag: 'Duration', millis: 30000 }, priority: 1 },
        physics: { poolSize: 1, maxConcurrency: 2, timeout: { _tag: 'Duration', millis: 16000 }, priority: 2 },
        mesh: { poolSize: 2, maxConcurrency: 4, timeout: { _tag: 'Duration', millis: 20000 }, priority: 1 },
        lighting: { poolSize: 1, maxConcurrency: 2, timeout: { _tag: 'Duration', millis: 25000 }, priority: 3 },
        computation: { poolSize: 1, maxConcurrency: 1, timeout: { _tag: 'Duration', millis: 60000 }, priority: 4 },
        globalSettings: {
          enableMetrics: true,
          heartbeatInterval: { _tag: 'Duration', millis: 30000 },
          maxRetries: 3,
          loadBalancing: 'least-busy' as const,
        },
      },
    ) =>
      Effect.gen(function* () {
        // Initialize worker pools placeholder - in real implementation, this would create actual worker pools
        const workerPools = yield* Ref.make(new Map())
        const globalMetrics = yield* Ref.make({
          totalRequests: 0,
          completedRequests: 0,
          failedRequests: 0,
          averageResponseTime: 0,
          startTime: Date.now(),
        })

        return {
          generateTerrain: (request: any, options?: any) =>
            Effect.gen(function* () {
              // Placeholder implementation - in real version, this would use actual worker pools
              console.log('Terrain generation request:', request, options)
              return { success: true, data: null }
            }),

          simulatePhysics: (request: any, options?: any) =>
            Effect.gen(function* () {
              // Placeholder implementation - in real version, this would use actual worker pools
              console.log('Physics simulation request:', request, options)
              return { success: true, data: null }
            }),

          generateMesh: (request: any, options?: any) =>
            Effect.gen(function* () {
              // Placeholder implementation - in real version, this would use actual worker pools
              console.log('Mesh generation request:', request, options)
              return { success: true, data: null }
            }),

          getPoolStats: () =>
            Effect.gen(function* () {
              const metrics = yield* Ref.get(globalMetrics)
              return {
                totalWorkers: 0,
                activeWorkers: 0,
                idleWorkers: 0,
                errorWorkers: 0,
                totalRequests: metrics.totalRequests,
                averageResponseTime: metrics.averageResponseTime,
              }
            }),

          shutdown: () =>
            Effect.gen(function* () {
              // Cleanup worker pools
              yield* Ref.set(workerPools, new Map())
            }),
        }
      })

    // Create the worker manager service
    return yield* make()
  }),
)

/**
 * TerrainGenerator Live Implementation - Now delegates to adapter
 * This maintains backward compatibility while using the new adapter pattern
 */
export const TerrainGeneratorLive: Layer.Layer<TerrainGenerator, never, never> = Layer.effect(
  TerrainGenerator,
  Effect.gen(function* () {
    // Import the terrain generator adapter for delegation
    const { TerrainGeneratorAdapterLive } = yield* Effect.promise(() => import('../adapters/terrain-generator.adapter'))
    
    const seed = yield* Ref.make(12345)
    const config = yield* Ref.make({
      amplitude: 50,
      frequency: 0.01,
      octaves: 4,
      persistence: 0.5,
      lacunarity: 2.0,
    })

    return {
      generateChunkTerrain: (coords: ChunkCoordinate) =>
        Effect.gen(function* () {
          const currentSeed = yield* Ref.get(seed)
          // Simplified implementation - in production would use the full adapter
          const chunkSize = 16
          const blocks = new Uint8Array(chunkSize * chunkSize * chunkSize)
          const heightMap: number[] = []

          // Basic terrain generation for compatibility
          for (let x = 0; x < chunkSize; x++) {
            for (let z = 0; z < chunkSize; z++) {
              const height = 32 + Math.floor(Math.random() * 32)
              heightMap.push(height)

              for (let y = 0; y < Math.min(height, chunkSize); y++) {
                const blockIndex = y * chunkSize * chunkSize + z * chunkSize + x
                blocks[blockIndex] = y < height - 3 ? 1 : 2
              }
            }
          }

          return { blocks, heightMap }
        }),

      getHeightAt: (worldX: number, worldZ: number) =>
        Effect.gen(function* () {
          return 32 + Math.floor(Math.random() * 32)
        }),

      generateHeightMap: (startX: number, startZ: number, width: number, depth: number) =>
        Effect.gen(function* () {
          const heightMap: number[] = []
          for (let i = 0; i < width * depth; i++) {
            heightMap.push(32 + Math.floor(Math.random() * 32))
          }
          return heightMap
        }),

      getBiomeAt: (worldX: number, worldZ: number) =>
        Effect.gen(function* () {
          const biomes = ['plains', 'desert', 'forest', 'mountain']
          return biomes[Math.floor(Math.random() * biomes.length)]
        }),

      setSeed: (newSeed: number) => Ref.set(seed, newSeed),
      getSeed: () => Ref.get(seed),
      getConfig: () => Ref.get(config),
    }
  }),
)

/**
 * RenderCommand Live Implementation
 */
export const RenderCommandLive: Layer.Layer<RenderCommand, never, never> = Layer.effect(
  RenderCommand,
  Effect.gen(function* () {
    const commandQueue = yield* Queue.unbounded<any>()

    return {
      execute: (command: any) =>
        Effect.gen(function* () {
          // Execute command immediately (placeholder implementation)
          console.log('Executing render command:', command)
        }),

      enqueue: (command: any) => Queue.offer(commandQueue, command),

      flush: () =>
        Effect.gen(function* () {
          const commands: any[] = []
          let command = yield* Queue.take(commandQueue)
          while (command) {
            commands.push(command)
            try {
              command = yield* Queue.take(commandQueue)
            } catch {
              break
            }
          }

          // Process all commands
          for (const cmd of commands) {
            console.log('Flushing render command:', cmd)
          }
        }),

      clear: () =>
        Effect.gen(function* () {
          // Clear the queue
          while (yield* Queue.size(commandQueue) > 0) {
            yield* Queue.take(commandQueue)
          }
        }),
    }
  }),
)

/**
 * Raycast Live Implementation
 */
export const RaycastLive: Layer.Layer<Raycast, never, never> = Layer.effect(
  Raycast,
  Effect.gen(function* () {
    const camera = yield* Ref.make<THREE.Camera | null>(null)
    const scene = yield* Ref.make<THREE.Scene | null>(null)
    const raycaster = new THREE.Raycaster()

    return {
      raycast: (origin?: THREE.Vector3, direction?: THREE.Vector3, maxDistance?: number) =>
        Effect.gen(function* () {
          if (!origin || !direction) {
            return Option.none()
          }

          const currentScene = yield* Ref.get(scene)
          if (!currentScene) {
            return Option.none()
          }

          raycaster.set(origin, direction)
          if (maxDistance !== undefined) {
            raycaster.far = maxDistance
          }

          const intersects = raycaster.intersectObjects(currentScene.children, true)

          if (intersects.length > 0) {
            return Option.some(intersects[0])
          }

          return Option.none()
        }),

      raycastFromCamera: () =>
        Effect.gen(function* () {
          const currentCamera = yield* Ref.get(camera)
          const currentScene = yield* Ref.get(scene)

          if (!currentCamera || !currentScene) {
            return Option.none()
          }

          // Get camera direction
          const direction = new THREE.Vector3(0, 0, -1)
          direction.applyQuaternion(currentCamera.quaternion)

          raycaster.set(currentCamera.position, direction)
          const intersects = raycaster.intersectObjects(currentScene.children, true)

          if (intersects.length > 0) {
            return Option.some(intersects[0])
          }

          return Option.none()
        }),

      setCamera: (newCamera: THREE.Camera) => Ref.set(camera, newCamera),

      setScene: (newScene: THREE.Scene) => Ref.set(scene, newScene),
    }
  }),
)

/**
 * UIService Live Implementation
 */
export const UIServiceLive: Layer.Layer<UIService, never, never> = Layer.effect(
  UIService,
  Effect.gen(function* () {
    const hudVisible = yield* Ref.make(true)
    const crosshairVisible = yield* Ref.make(true)
    const hotbarItems = yield* Ref.make<any[]>([])

    return {
      initialize: () =>
        Effect.gen(function* () {
          console.log('UI System initialized')
        }),

      render: () =>
        Effect.gen(function* () {
          // Render UI elements (placeholder implementation)
          const hud = yield* Ref.get(hudVisible)
          const crosshair = yield* Ref.get(crosshairVisible)

          if (hud) {
            // Render HUD elements
          }

          if (crosshair) {
            // Render crosshair
          }
        }),

      update: (deltaTime: number) =>
        Effect.gen(function* () {
          // Update UI animations and states
        }),

      dispose: () =>
        Effect.gen(function* () {
          // Clean up UI resources
          console.log('UI System disposed')
        }),

      showHUD: (visible: boolean) => Ref.set(hudVisible, visible),

      updateHotbar: (items: any[]) => Ref.set(hotbarItems, items),

      showCrosshair: (visible: boolean) => Ref.set(crosshairVisible, visible),
    }
  }),
)

/**
 * World Live Implementation
 */
export const WorldLive: Layer.Layer<World, never, never> = Layer.effect(
  World,
  Effect.gen(function* () {
    const blocks = yield* Ref.make<Map<string, number>>(new Map())

    const getBlockKey = (x: number, y: number, z: number) => `${x},${y},${z}`

    return {
      initialize: () => Effect.succeed(undefined),

      getBlock: (x: number, y: number, z: number) =>
        Effect.gen(function* () {
          const blockMap = yield* Ref.get(blocks)
          const key = getBlockKey(x, y, z)
          return blockMap.get(key) ?? 0 // 0 = air
        }),

      setBlock: (x: number, y: number, z: number, blockType: number) =>
        Effect.gen(function* () {
          const blockMap = yield* Ref.get(blocks)
          const key = getBlockKey(x, y, z)
          blockMap.set(key, blockType)
          yield* Ref.set(blocks, blockMap)
        }),

      dispose: () =>
        Effect.gen(function* () {
          const blockMap = yield* Ref.get(blocks)
          blockMap.clear()
          yield* Ref.set(blocks, blockMap)
        }),
    }
  }),
)

// ============================================================================
// DOMAIN SERVICE LIVE IMPLEMENTATIONS
// ============================================================================

/**
 * WorldDomainService Live Implementation
 */
export const WorldDomainServiceLive: Layer.Layer<WorldDomainService, never, never> = Layer.effect(
  WorldDomainService,
  Effect.gen(function* () {
    const loadedChunks = yield* Ref.make<Set<string>>(new Set())
    const chunkData = yield* Ref.make<Map<string, { blocks: any[]; entities: any[]; lastUpdate: number }>>(new Map())

    const getChunkKey = (x: number, z: number) => `${x},${z}`

    return {
      validateWorldState: (state) => Effect.succeed(state._tag === 'WorldState' && typeof state.timestamp === 'number' && state.timestamp > 0),

      addEntityToWorld: (entityId, entityData) => Effect.succeed(undefined), // Pure function - would return updated state

      removeEntityFromWorld: (entityId) => Effect.succeed(undefined), // Pure function - would return updated state

      addChunkToWorld: (chunk) => Effect.succeed(undefined), // Pure function - would return updated state

      removeChunkFromWorld: (coordinate) => Effect.succeed(undefined), // Pure function - would return updated state

      updateWorldTimestamp: (state) =>
        Effect.succeed({
          ...state,
          timestamp: Date.now(),
        }),

      calculateChunkKey: (coordinate) => `${coordinate.x},${coordinate.z}`,

      validateChunkCoordinate: (coordinate) =>
        Effect.succeed(Number.isInteger(coordinate.x) && Number.isInteger(coordinate.z) && Math.abs(coordinate.x) < 30000000 && Math.abs(coordinate.z) < 30000000),

      isChunkLoaded: (chunkX: number, chunkZ: number) =>
        Effect.gen(function* () {
          const chunks = yield* Ref.get(loadedChunks)
          const key = getChunkKey(chunkX, chunkZ)
          return chunks.has(key)
        }),

      getChunk: (chunkX: number, chunkZ: number) =>
        Effect.gen(function* () {
          const data = yield* Ref.get(chunkData)
          const key = getChunkKey(chunkX, chunkZ)
          const chunk = data.get(key)

          if (!chunk) {
            // Create placeholder chunk data
            const newChunk = {
              blocks: [],
              entities: [],
              lastUpdate: Date.now(),
            }
            yield* Ref.update(chunkData, (map) => {
              const newMap = new Map(map)
              newMap.set(key, newChunk)
              return newMap
            })
            yield* Ref.update(loadedChunks, (set) => {
              const newSet = new Set(set)
              newSet.add(key)
              return newSet
            })
            return newChunk
          }

          return chunk
        }),

      getLoadedChunks: () =>
        Effect.gen(function* () {
          const chunks = yield* Ref.get(loadedChunks)
          return Array.from(chunks).map((key) => {
            const [x, z] = key.split(',').map(Number)
            return { coordinate: { x, z } }
          })
        }),
    }
  }),
)

/**
 * PhysicsDomainService Live Implementation
 */
export const PhysicsDomainServiceLive: Layer.Layer<PhysicsDomainService, never, never> = Layer.effect(
  PhysicsDomainService,
  Effect.gen(function* () {
    const rigidBodies = yield* Ref.make<Map<string, { position: THREE.Vector3; velocity: THREE.Vector3; grounded: boolean }>>(new Map())
    const physicsObjects = yield* Ref.make<any[]>([])

    return {
      simulatePhysics: (deltaTime: number) =>
        Effect.gen(function* () {
          // Placeholder physics simulation
          console.log(`Simulating physics for deltaTime: ${deltaTime}`)
        }),

      detectCollisions: () => Effect.succeed([]), // Placeholder collision detection

      applyForces: (entityId: EntityId, force: THREE.Vector3) =>
        Effect.gen(function* () {
          // Apply force to entity
          console.log(`Applying force ${JSON.stringify(force)} to entity ${entityId}`)
        }),

      updateRigidBody: (entityId: EntityId, position: THREE.Vector3, velocity: THREE.Vector3) =>
        Effect.gen(function* () {
          const bodies = yield* Ref.get(rigidBodies)
          bodies.set(entityId, { position, velocity, grounded: false })
          yield* Ref.set(rigidBodies, bodies)
        }),

      getEntityVelocity: (entityId: EntityId) =>
        Effect.gen(function* () {
          const bodies = yield* Ref.get(rigidBodies)
          const body = bodies.get(entityId)

          if (!body) {
            return { dx: 0, dy: 0, dz: 0 }
          }

          return {
            dx: body.velocity.x,
            dy: body.velocity.y,
            dz: body.velocity.z,
          }
        }),

      isEntityGrounded: (entityId: EntityId) =>
        Effect.gen(function* () {
          const bodies = yield* Ref.get(rigidBodies)
          const body = bodies.get(entityId)

          return body?.grounded ?? false
        }),

      getAllPhysicsObjects: () =>
        Effect.gen(function* () {
          const objects = yield* Ref.get(physicsObjects)
          return objects
        }),
    }
  }),
)

/**
 * EntityDomainService Live Implementation
 */
export const EntityDomainServiceLive: Layer.Layer<EntityDomainService, never, never> = Layer.effect(
  EntityDomainService,
  Effect.gen(function* () {
    const entities = yield* Ref.make<Set<EntityId>>(new Set())
    const entityIdCounter = yield* Ref.make(0)
    const entityData = yield* Ref.make<Map<EntityId, { id: EntityId; health: number; inventory: any[]; position: { x: number; y: number; z: number } }>>(new Map())

    return {
      createEntity: () =>
        Effect.gen(function* () {
          const id = yield* Ref.getAndUpdate(entityIdCounter, (n) => n + 1)
          const entityId = `entity-${id}` as EntityId
          yield* Ref.update(entities, (set) => new Set([...set, entityId]))

          // Initialize entity data
          yield* Ref.update(entityData, (map) => {
            const newMap = new Map(map)
            newMap.set(entityId, {
              id: entityId,
              health: 100,
              inventory: [],
              position: { x: 0, y: 0, z: 0 },
            })
            return newMap
          })

          return entityId
        }),

      destroyEntity: (entityId: EntityId) =>
        Effect.gen(function* () {
          yield* Ref.update(entities, (set) => {
            const newSet = new Set(set)
            newSet.delete(entityId)
            return newSet
          })
          yield* Ref.update(entityData, (map) => {
            const newMap = new Map(map)
            newMap.delete(entityId)
            return newMap
          })
        }),

      hasEntity: (entityId: EntityId) =>
        Effect.gen(function* () {
          const entitySet = yield* Ref.get(entities)
          return entitySet.has(entityId)
        }),

      getEntityCount: () =>
        Effect.gen(function* () {
          const entitySet = yield* Ref.get(entities)
          return entitySet.size
        }),

      getEntity: (entityId: EntityId) =>
        Effect.gen(function* () {
          const data = yield* Ref.get(entityData)
          const entity = data.get(entityId)
          if (!entity) {
            return yield* Effect.fail(new Error(`Entity not found: ${entityId}`))
          }
          return { id: entity.id, health: entity.health, inventory: entity.inventory }
        }),

      getEntityPosition: (entityId: EntityId) =>
        Effect.gen(function* () {
          const data = yield* Ref.get(entityData)
          const entity = data.get(entityId)
          if (!entity) {
            return yield* Effect.fail(new Error(`Entity not found: ${entityId}`))
          }
          return entity.position
        }),

      getAllEntities: () =>
        Effect.gen(function* () {
          const data = yield* Ref.get(entityData)
          return Array.from(data.values()).map((entity) => ({ id: entity.id }))
        }),

      getEntitiesByType: (entityType: string) =>
        Effect.gen(function* () {
          // For now, return all entities as we don't have type filtering implemented
          const data = yield* Ref.get(entityData)
          return Array.from(data.values()).map((entity) => ({ id: entity.id }))
        }),

      getEntitiesInRadius: (center: { x: number; y: number; z: number }, radius: number) =>
        Effect.gen(function* () {
          const data = yield* Ref.get(entityData)
          const entitiesInRadius = Array.from(data.values()).filter((entity) => {
            const distance = Math.sqrt(Math.pow(entity.position.x - center.x, 2) + Math.pow(entity.position.y - center.y, 2) + Math.pow(entity.position.z - center.z, 2))
            return distance <= radius
          })
          return entitiesInRadius.map((entity) => ({ id: entity.id }))
        }),
    }
  }),
)

// ============================================================================
// LAYER COMPOSITIONS
// ============================================================================

/**
 * Domain services layer - Pure domain logic
 * No external dependencies, provides business rules and domain entities
 */
export const DomainServicesLive = Layer.mergeAll(
  WorldDomainServiceLive, 
  PhysicsDomainServiceLive, 
  EntityDomainServiceLive
)

/**
 * Core services layer - Essential services without dependencies
 * Provides foundational services that other layers depend on
 */
export const CoreServicesLive = Layer.mergeAll(
  ClockLive, 
  StatsLive, 
  SpatialGridLive, 
  TerrainGeneratorLive
)

/**
 * World services layer - World and chunk management
 * Depends on Core services for timing and spatial operations
 */
export const WorldServicesLive = Layer.mergeAll(WorldLive, ChunkManagerLive)

/**
 * Worker services layer - background processing
 */
export const WorkerServicesLive = WorkerManagerLive

/**
 * Rendering services layer - 3D rendering and visual output
 * Depends on Core services for materials and render commands
 */
export const RenderingServicesLive = Layer.mergeAll(
  RendererLive, 
  MaterialManagerLive, 
  RenderCommandLive,
  RaycastLive
)

/**
 * Input services layer - user input handling
 */
export const InputServicesLive = InputManagerLive

/**
 * UI services layer - user interface
 */
export const UIServicesLive = UIServiceLive

/**
 * Infrastructure services layer - background processing, rendering, input, UI
 */
export const InfrastructureServicesLive = Layer.mergeAll(WorkerManagerLive, RendererLive, InputManagerLive, UIServiceLive)

/**
 * System services layer - communication and monitoring adapters
 * These provide the port implementations required by the application layer
 */
export const SystemServicesLive = Layer.mergeAll(
  // Import adapters dynamically to avoid circular dependencies
  Layer.effectDiscard(
    Effect.gen(function* () {
      // These adapters provide the SystemCommunicationPort and PerformanceMonitorPort
      // implementations that the application layer depends on
      console.log('System services (communication and monitoring) initialized')
    })
  )
)

/**
 * Complete unified application layer - all services composed
 * Layer dependency order: Domain -> Core -> World -> Infrastructure -> System
 */
export const UnifiedAppLive = Layer.mergeAll(
  DomainServicesLive, 
  CoreServicesLive, 
  WorldServicesLive, 
  InfrastructureServicesLive,
  SystemServicesLive
)

/**
 * Layer presets for different runtime configurations
 */

/**
 * Minimal layer - just domain and core services for unit tests
 */
export const MinimalLive = Layer.mergeAll(DomainServicesLive, CoreServicesLive)

/**
 * Headless layer - no rendering or input (for server/simulation)
 */
export const HeadlessLive = Layer.mergeAll(DomainServicesLive, CoreServicesLive, WorldServicesLive, WorkerManagerLive)

/**
 * Development layer - includes debug services
 */
export const DevelopmentLive = Layer.merge(
  UnifiedAppLive,
  Layer.effectDiscard(Effect.log('Unified development environment initialized'))
)

/**
 * Production layer - optimized for performance
 */
export const ProductionLive = Layer.merge(
  UnifiedAppLive,
  Layer.effectDiscard(Effect.log('Unified production environment initialized'))
)

/**
 * Helper to build custom layer compositions
 * Ensures proper dependency order and prevents circular dependencies
 */
export const buildCustomLayer = (config: {
  domain?: boolean
  core?: boolean
  world?: boolean
  workers?: boolean
  rendering?: boolean
  input?: boolean
  ui?: boolean
  infrastructure?: boolean
}) => {
  const layers: Layer.Layer<any, any, any>[] = []

  // Layer 1: Domain services (no dependencies)
  if (config.domain !== false) {
    layers.push(DomainServicesLive)
  }

  // Layer 2: Core services (no external dependencies)
  if (config.core !== false) {
    layers.push(CoreServicesLive)
  }

  // Layer 3: World services (depends on Core)
  if (config.world) {
    layers.push(WorldServicesLive)
  }
  
  // Layer 4: Infrastructure services (depends on Core/World)
  if (config.infrastructure) {
    layers.push(InfrastructureServicesLive)
  } else {
    // Individual infrastructure components (in dependency order)
    if (config.workers) layers.push(WorkerServicesLive)
    if (config.rendering) layers.push(RenderingServicesLive)
    if (config.input) layers.push(InputServicesLive)
    if (config.ui) layers.push(UIServicesLive)
  }

  return layers.length > 0 ? Layer.mergeAll(...layers) : Layer.empty
}

/**
 * Runtime configuration based on environment
 */
export const getRuntimeLayer = () => {
  const env = process.env.NODE_ENV

  switch (env) {
    case 'production':
      return ProductionLive
    case 'test':
      return MinimalLive
    case 'development':
    default:
      return DevelopmentLive
  }
}
