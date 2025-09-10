import { Layer, Effect, Ref, Queue, Option } from 'effect'
import { World, Renderer, InputManager, Clock, Stats, SpatialGrid } from '@/services'
import { WorldState } from '@/domain/world'
import { EntityId, toEntityId } from '@/domain/entity'
import { AABB } from '@/domain/geometry'
import * as HashMap from 'effect/HashMap'
import * as HashSet from 'effect/HashSet'

/**
 * Mock Layer implementations for testing
 * Provides in-memory implementations of all services
 */

/**
 * Mock World Layer
 */
export const WorldMockLive = Layer.effect(
  World,
  Effect.gen(function* () {
    const initialState: WorldState = {
      nextEntityId: 1,
      entities: HashMap.empty(),
      archetypes: HashMap.empty(),
      components: {
        position: HashMap.empty(),
        velocity: HashMap.empty(),
        player: HashMap.empty(),
        inputState: HashMap.empty(),
        cameraState: HashMap.empty(),
        hotbar: HashMap.empty(),
        target: HashMap.empty(),
        gravity: HashMap.empty(),
        collider: HashMap.empty(),
        renderable: HashMap.empty(),
        instancedMeshRenderable: HashMap.empty(),
        terrainBlock: HashMap.empty(),
        chunk: HashMap.empty(),
        camera: HashMap.empty(),
        targetBlock: HashMap.empty(),
        chunkLoaderState: HashMap.empty(),
      },
      chunks: HashMap.empty()
    }
    
    const state = yield* Ref.make(initialState)
    
    return World.of({
      state,
      
      addArchetype: (archetype) =>
        Ref.modify(state, (s) => {
          const entityId = toEntityId(s.nextEntityId)
          const newState = {
            ...s,
            nextEntityId: s.nextEntityId + 1,
            entities: HashMap.set(s.entities, entityId, 'test-archetype')
          }
          return [entityId, newState] as const
        }),
      
      removeEntity: (entityId) =>
        Ref.modify(state, (s) => {
          const newState = {
            ...s,
            entities: HashMap.remove(s.entities, entityId)
          }
          return [undefined, newState] as const
        }),
      
      getComponent: (entityId, componentName) =>
        Ref.get(state).pipe(
          Effect.map((s) => 
            HashMap.get(s.components[componentName], entityId)
          )
        ),
      
      getComponentUnsafe: (entityId, componentName) =>
        Ref.get(state).pipe(
          Effect.flatMap((s) => {
            const component = HashMap.get(s.components[componentName], entityId)
            return Option.isSome(component)
              ? Effect.succeed(component.value)
              : Effect.fail(new Error(`Component ${componentName} not found for entity ${entityId}`))
          })
        ),
      
      updateComponent: (entityId, componentName, data) =>
        Ref.modify(state, (s) => {
          const current = HashMap.get(s.components[componentName], entityId)
          if (Option.isNone(current)) {
            return [undefined, s] as const
          }
          
          const updated = { ...current.value, ...data }
          const newComponentMap = HashMap.set(s.components[componentName], entityId, updated as any)
          const newComponents = { ...s.components, [componentName]: newComponentMap }
          const newState = { ...s, components: newComponents }
          
          return [undefined, newState] as const
        }),
      
      query: () => Effect.succeed([]),
      querySoA: () => Effect.succeed({ entities: [], components: {} as any }),
      queryUnsafe: () => Effect.succeed([]),
      querySingle: () => Effect.succeed(Option.none()),
      querySingleUnsafe: () => Effect.fail(new Error('No results')),
      
      getChunk: () => Effect.succeed(Option.none()),
      setChunk: () => Effect.succeed(undefined),
      getVoxel: () => Effect.succeed(Option.none()),
      setVoxel: () => Effect.succeed(undefined)
    })
  })
)

/**
 * Mock Renderer Layer
 */
export const RendererMockLive = Layer.effect(
  Renderer,
  Effect.gen(function* () {
    const renderQueue = yield* Queue.unbounded()
    
    return Renderer.of({
      renderQueue,
      updateCamera: () => Effect.succeed(undefined)
    })
  })
)

/**
 * Mock InputManager Layer
 */
export const InputManagerMockLive = Layer.effect(
  InputManager,
  Effect.gen(function* () {
    const isLocked = yield* Ref.make(false)
    
    return InputManager.of({
      isLocked,
      getState: () => Effect.succeed({
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        place: false,
        destroy: false
      }),
      getMouseState: () => Effect.succeed({ dx: 0, dy: 0 }),
      getHotbarSelection: () => Effect.succeed(0)
    })
  })
)

/**
 * Mock Clock Layer
 */
export const ClockMockLive = Layer.effect(
  Clock,
  Effect.gen(function* () {
    const startTime = yield* Ref.make(Date.now())
    const lastTime = yield* Ref.make(Date.now())
    
    return Clock.of({
      getDelta: () =>
        Ref.get(lastTime).pipe(
          Effect.flatMap((last) => {
            const now = Date.now()
            return Ref.set(lastTime, now).pipe(
              Effect.map(() => (now - last) / 1000)
            )
          })
        ),
      
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
        }),
      
      stop: () => Effect.succeed(undefined)
    })
  })
)

/**
 * Mock Stats Layer
 */
export const StatsMockLive = Layer.effect(
  Stats,
  Effect.gen(function* () {
    const frameCount = yield* Ref.make(0)
    const lastTime = yield* Ref.make(Date.now())
    
    return Stats.of({
      begin: () => Effect.succeed(undefined),
      end: () => 
        Ref.modify(frameCount, (n) => [undefined, n + 1]),
      getStats: () =>
        Effect.succeed({
          fps: 60,
          ms: 16.67,
          memory: 100
        })
    })
  })
)

/**
 * Mock SpatialGrid Layer
 */
export const SpatialGridMockLive = Layer.effect(
  SpatialGrid,
  Effect.gen(function* () {
    const grid = yield* Ref.make(new Map<EntityId, AABB>())
    
    return SpatialGrid.of({
      add: (entityId, aabb) =>
        Ref.modify(grid, (g) => {
          const newGrid = new Map(g)
          newGrid.set(entityId, aabb)
          return [undefined, newGrid] as const
        }),
      
      remove: (entityId) =>
        Ref.modify(grid, (g) => {
          const newGrid = new Map(g)
          newGrid.delete(entityId)
          return [undefined, newGrid] as const
        }),
      
      update: (entityId, aabb) =>
        Ref.modify(grid, (g) => {
          const newGrid = new Map(g)
          newGrid.set(entityId, aabb)
          return [undefined, newGrid] as const
        }),
      
      query: (queryAABB) =>
        Ref.get(grid).pipe(
          Effect.map((g) => {
            const results = new Set<EntityId>()
            
            // Simple AABB intersection check
            for (const [entityId, aabb] of g.entries()) {
              if (
                aabb.maxX >= queryAABB.minX &&
                aabb.minX <= queryAABB.maxX &&
                aabb.maxY >= queryAABB.minY &&
                aabb.minY <= queryAABB.maxY &&
                aabb.maxZ >= queryAABB.minZ &&
                aabb.minZ <= queryAABB.maxZ
              ) {
                results.add(entityId)
              }
            }
            
            return results
          })
        ),
      
      clear: () =>
        Ref.set(grid, new Map())
    })
  })
)

/**
 * Complete test layer combining all mocks
 */
export const TestLayers = Layer.mergeAll(
  WorldMockLive,
  RendererMockLive,
  InputManagerMockLive,
  ClockMockLive,
  StatsMockLive,
  SpatialGridMockLive
)

/**
 * Configurable mock layers with custom behavior
 */
export const createMockWorld = (customBehavior?: Partial<World['Type']>) =>
  Layer.effect(
    World,
    Effect.gen(function* () {
      const base = yield* WorldMockLive.pipe(Layer.build, Effect.map((context) => context.get(World)))
      return World.of({
        ...base,
        ...customBehavior
      })
    })
  )

export const createMockInputManager = (
  inputState?: Partial<{
    forward: boolean
    backward: boolean
    left: boolean
    right: boolean
    jump: boolean
    sprint: boolean
    place: boolean
    destroy: boolean
  }>
) =>
  Layer.effect(
    InputManager,
    Effect.gen(function* () {
      const isLocked = yield* Ref.make(false)
      
      return InputManager.of({
        isLocked,
        getState: () => Effect.succeed({
          forward: false,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sprint: false,
          place: false,
          destroy: false,
          ...inputState
        }),
        getMouseState: () => Effect.succeed({ dx: 0, dy: 0 }),
        getHotbarSelection: () => Effect.succeed(0)
      })
    })
  )