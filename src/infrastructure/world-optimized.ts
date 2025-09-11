import { Effect, Layer, Ref, HashMap, HashSet, Option } from 'effect'

import { Archetype } from '@/domain/archetypes'
import { Vector3Float as Vector3 } from '@/domain/value-objects/common'
import {
  Chunk,
  componentNamesSet,
  type Components,
  ComponentSchemas,
  type ComponentName,
  type ComponentOfName,
} from '@/domain/entities/components'
import { type EntityId, toEntityId } from '@/domain/entities'
import { toChunkIndex } from '@/domain/geometry'
import { type LegacyQuery, type OptimizedQuery } from '@/domain/queries'
import { type Voxel } from '@/domain/world'
import { World } from '@/runtime/services'
import { ObjectPool } from '@/domain/performance/object-pool'
import { AdvancedSpatialGridState } from './spatial-grid'
import { ChunkCacheState } from './chunk-cache'
import * as S from "@effect/schema/Schema"

// Import errors from centralized location
import {
  ComponentNotFoundError,
  QuerySingleResultNotFoundError,
  ComponentDecodeError,
} from '@/domain/errors'

// --- Optimization Configuration ---

const CONFIG = {
  ARCHETYPE_POOLING: true,
  QUERY_CACHING: true,
  ENTITY_BATCHING: true,
  DIRTY_TRACKING: true,
  CHUNK_STREAMING: true,
  BACKGROUND_PROCESSING: true,
  MAX_ENTITIES_PER_FRAME: 1000,
  BATCH_SIZE: 100,
  QUERY_CACHE_SIZE: 256,
  CHUNK_CACHE_SIZE: 512,
} as const

// --- Enhanced Data Types ---

/**
 * Enhanced component storage with performance optimizations
 */
export interface OptimizedComponentStorage {
  readonly [K in ComponentName]: {
    data: HashMap.HashMap<EntityId, Components[K]>
    dirty: Set<EntityId>
    lastAccess: number
    accessCount: number
  }
}

/**
 * Enhanced archetype storage with spatial indexing
 */
export interface OptimizedArchetypeStorage {
  data: HashMap.HashMap<string, HashSet.HashSet<EntityId>>
  spatialIndex: Map<string, Set<EntityId>> // Chunk-based spatial indexing
  queryCache: Map<string, CachedQuery>
  lastOptimization: number
}

/**
 * Cached query result
 */
export interface CachedQuery {
  result: ReadonlyArray<[EntityId, ...any[]]>
  lastUpdate: number
  dependencies: Set<ComponentName>
  isValid: boolean
}

/**
 * World change event
 */
export interface WorldChangeEvent {
  type: 'entity_added' | 'entity_removed' | 'component_changed' | 'chunk_loaded' | 'chunk_unloaded'
  entityId?: EntityId
  componentName?: ComponentName
  chunkCoords?: { x: number; z: number }
  timestamp: number
}

/**
 * Enhanced world state with performance optimizations
 */
export interface OptimizedWorldState {
  readonly nextEntityId: number
  readonly entities: HashMap.HashMap<EntityId, string> // Map<EntityId, ArchetypeKey>
  readonly archetypes: OptimizedArchetypeStorage
  readonly components: OptimizedComponentStorage
  readonly chunks: HashMap.HashMap<string, Chunk>
  readonly spatialGrid: AdvancedSpatialGridState
  readonly chunkCache: ChunkCacheState
  readonly changeEvents: WorldChangeEvent[]
  readonly metrics: {
    totalEntities: number
    totalComponents: number
    totalChunks: number
    loadedChunks: number
    queriesPerSecond: number
    averageQueryTime: number
    memoryUsage: number
    lastGC: number
  }
}

/**
 * Entity batch for efficient processing
 */
export interface EntityBatch {
  entities: EntityId[]
  archetype: string
  components: ComponentName[]
  isDirty: boolean
  lastProcessed: number
}

// --- Memory Pools ---

const _entityIdPool = new ObjectPool<EntityId>(
  () => toEntityId(0),
  (id) => id,
  10000
)


const _archetypePool = new ObjectPool<Archetype>(
  () => ({} as Archetype),
  (archetype) => {
    // Clear all properties
    Object.keys(archetype).forEach(key => delete (archetype as any)[key])
    return archetype
  },
  1000
)


const _arrayPool = new ObjectPool<any[]>(
  () => [],
  (array) => {
    array.length = 0
    return array
  },
  500
)


// --- Helper Functions ---

const getArchetypeKey = (components: ReadonlyArray<ComponentName>): string => {
  return [...components].sort().join(',')
}

const getChunkKey = (chunkX: number, chunkZ: number) => `${chunkX},${chunkZ}`

const getSpatialKey = (position: Vector3): string => {
  const chunkX = Math.floor(position[0] / 16)
  const chunkZ = Math.floor(position[2] / 16)
  return getChunkKey(chunkX, chunkZ)
}

const createQueryKey = (query: LegacyQuery<any> | OptimizedQuery<any>): string => {
  return `${query.components.sort().join(',')}:${JSON.stringify(query)}`
}

/**
 * Check if query cache is valid
 */
const isCacheValid = (cache: CachedQuery, maxAge: number = 16): boolean => {
  return cache.isValid && (Date.now() - cache.lastUpdate) < maxAge
}

/**
 * Invalidate query cache when components change
 */
const invalidateQueryCache = (
  archetypes: OptimizedArchetypeStorage,
  componentName: ComponentName
): void => {
  for (const [, cache] of archetypes.queryCache) {
    if (cache.dependencies.has(componentName)) {
      cache.isValid = false
    }
  }
}

/**
 * Get entities in spatial region
 */
const getEntitiesInChunk = (
  state: OptimizedWorldState,
  chunkX: number,
  chunkZ: number
): Set<EntityId> => {
  const spatialKey = getChunkKey(chunkX, chunkZ)
  return state.archetypes.spatialIndex.get(spatialKey) || new Set()
}

/**
 * Update spatial index for entity
 */
const updateSpatialIndex = (
  state: OptimizedWorldState,
  entityId: EntityId,
  oldPosition?: Vector3,
  newPosition?: Vector3
): OptimizedWorldState => {
  // Remove from old position
  if (oldPosition) {
    const oldKey = getSpatialKey(oldPosition)
    const oldSet = state.archetypes.spatialIndex.get(oldKey)
    if (oldSet) {
      oldSet.delete(entityId)
      if (oldSet.size === 0) {
        state.archetypes.spatialIndex.delete(oldKey)
      }
    }
  }

  // Add to new position
  if (newPosition) {
    const newKey = getSpatialKey(newPosition)
    let newSet = state.archetypes.spatialIndex.get(newKey)
    if (!newSet) {
      newSet = new Set()
      state.archetypes.spatialIndex.set(newKey, newSet)
    }
    newSet.add(entityId)
  }

  return state
}

// --- Optimized Pure Functions ---

const addArchetypeOptimized = (state: OptimizedWorldState, archetype: Archetype): [EntityId, OptimizedWorldState] => {
  const entityId = toEntityId(state.nextEntityId)
  const componentEntries = Object.entries(archetype) as [ComponentName, Components[ComponentName]][]
  const archetypeKey = getArchetypeKey(componentEntries.map(([name]) => name))

  // Get position for spatial indexing
  const positionComponent = archetype.position as Components['position'] | undefined
  const position = positionComponent ? [positionComponent.x, positionComponent.y, positionComponent.z] as Vector3 : undefined

  // Update archetypes
  const newArchetypeEntities = HashMap.has(state.archetypes.data, archetypeKey)
    ? HashMap.modify(state.archetypes.data, archetypeKey, (set) => HashSet.add(set, entityId))
    : HashMap.set(state.archetypes.data, archetypeKey, HashSet.make(entityId))

  // Update components with dirty tracking
  const newComponents = componentEntries.reduce((acc, [name, component]) => {
    const componentStorage = acc[name]
    const newData = HashMap.set(componentStorage.data, entityId, component)
    const newDirty = new Set(componentStorage.dirty)
    newDirty.add(entityId)
    
    return {
      ...acc,
      [name]: {
        ...componentStorage,
        data: newData,
        dirty: newDirty,
        lastAccess: Date.now(),
        accessCount: componentStorage.accessCount + 1,
      }
    }
  }, state.components)

  // Invalidate query cache for affected components
  componentEntries.forEach(([name]) => {
    invalidateQueryCache(state.archetypes, name)
  })

  // Update spatial index
  let newState: OptimizedWorldState = {
    ...state,
    nextEntityId: state.nextEntityId + 1,
    entities: HashMap.set(state.entities, entityId, archetypeKey),
    archetypes: {
      ...state.archetypes,
      data: newArchetypeEntities,
    },
    components: newComponents,
    metrics: {
      ...state.metrics,
      totalEntities: state.metrics.totalEntities + 1,
    },
  }

  if (position) {
    newState = updateSpatialIndex(newState, entityId, undefined, position)
  }

  // Add change event
  const changeEvent: WorldChangeEvent = {
    type: 'entity_added',
    entityId,
    timestamp: Date.now(),
  }
  newState.changeEvents.push(changeEvent)

  return [entityId, newState]
}

const removeEntityOptimized = (state: OptimizedWorldState, entityId: EntityId): OptimizedWorldState => {
  const archetypeKeyOpt = HashMap.get(state.entities, entityId)
  if (Option.isNone(archetypeKeyOpt)) {
    return state
  }
  const archetypeKey = archetypeKeyOpt.value

  // Get current position for spatial index cleanup
  const positionComponent = HashMap.get(state.components.position.data, entityId)
  const position = Option.isSome(positionComponent) 
    ? [positionComponent.value.x, positionComponent.value.y, positionComponent.value.z] as Vector3 
    : undefined

  // Update archetypes
  const newArchetypeEntities = HashMap.modify(state.archetypes.data, archetypeKey, (set) => HashSet.remove(set, entityId))

  // Update components
  const componentNamesToRemove = archetypeKey.split(',') as ComponentName[]
  const newComponents = componentNamesToRemove.reduce((acc, componentName) => {
    const componentStorage = acc[componentName]
    const newData = HashMap.remove(componentStorage.data, entityId)
    const newDirty = new Set(componentStorage.dirty)
    newDirty.delete(entityId)
    
    return {
      ...acc,
      [componentName]: {
        ...componentStorage,
        data: newData,
        dirty: newDirty,
      }
    }
  }, state.components)

  // Invalidate query cache
  componentNamesToRemove.forEach(name => {
    invalidateQueryCache(state.archetypes, name)
  })

  let newState: OptimizedWorldState = {
    ...state,
    entities: HashMap.remove(state.entities, entityId),
    archetypes: {
      ...state.archetypes,
      data: newArchetypeEntities,
    },
    components: newComponents,
    metrics: {
      ...state.metrics,
      totalEntities: Math.max(0, state.metrics.totalEntities - 1),
    },
  }

  // Update spatial index
  if (position) {
    newState = updateSpatialIndex(newState, entityId, position, undefined)
  }

  // Add change event
  const changeEvent: WorldChangeEvent = {
    type: 'entity_removed',
    entityId,
    timestamp: Date.now(),
  }
  newState.changeEvents.push(changeEvent)

  return newState
}

const queryOptimized = <T extends ReadonlyArray<ComponentName>>(
  state: OptimizedWorldState,
  query: LegacyQuery<T> | OptimizedQuery<T>
): [OptimizedWorldState, ReadonlyArray<[EntityId, Array<Components[T[number]]>]>] => {
  const queryKey = createQueryKey(query)
  const cachedResult = state.archetypes.queryCache.get(queryKey)
  
  // Return cached result if valid
  if (cachedResult && CONFIG.QUERY_CACHING && isCacheValid(cachedResult)) {
    return [
      {
        ...state,
        metrics: {
          ...state.metrics,
          queriesPerSecond: state.metrics.queriesPerSecond + 1,
        }
      },
      cachedResult.result as ReadonlyArray<[EntityId, Array<Components[T[number]]>]>
    ]
  }

  const startTime = Date.now()
  const requiredComponents = HashSet.fromIterable(query.components)
  
  // Find matching archetypes
  const matchingArchetypes = HashMap.filter(state.archetypes.data, (_, key) => {
    const archetypeComponents = HashSet.fromIterable(key.split(','))
    return HashSet.isSubset(requiredComponents, archetypeComponents)
  })

  // Collect results
  const results = Array.from(matchingArchetypes).flatMap(([, entitySet]: [string, HashSet.HashSet<EntityId>]) => 
    Array.from(entitySet).map((entityId: EntityId) => {
      const componentOptions = query.components.map((name) => HashMap.get(state.components[name].data, entityId))
      const allComponents = Option.all(componentOptions)
      return Option.map(allComponents, (components) => [entityId, components] as [EntityId, Array<Components[T[number]]>])
    }).filter(Option.isSome).map(option => option.value)
  ).filter((result): result is [EntityId, Array<Components[T[number]]>] => result !== undefined)

  const queryTime = Date.now() - startTime

  // Cache the result
  if (CONFIG.QUERY_CACHING) {
    const cache: CachedQuery = {
      result: results,
      lastUpdate: Date.now(),
      dependencies: new Set(query.components),
      isValid: true,
    }
    
    // Limit cache size
    if (state.archetypes.queryCache.size >= CONFIG.QUERY_CACHE_SIZE) {
      const oldestKey = Array.from(state.archetypes.queryCache.keys())[0]
      state.archetypes.queryCache.delete(oldestKey)
    }
    
    state.archetypes.queryCache.set(queryKey, cache)
  }

  return [
    {
      ...state,
      metrics: {
        ...state.metrics,
        queriesPerSecond: state.metrics.queriesPerSecond + 1,
        averageQueryTime: (state.metrics.averageQueryTime + queryTime) / 2,
      }
    },
    results
  ]
}

/**
 * Process dirty entities in batches
 */
const processDirtyEntities = (state: OptimizedWorldState): OptimizedWorldState => {
  if (!CONFIG.ENTITY_BATCHING) return state

  const dirtyEntities = new Set<EntityId>()
  
  // Collect dirty entities from all components
  Object.values(state.components).forEach(componentStorage => {
    componentStorage.dirty.forEach(entityId => dirtyEntities.add(entityId))
  })

  if (dirtyEntities.size === 0) return state

  // Process in batches
  const entityArray = Array.from(dirtyEntities)
  const batchCount = Math.ceil(entityArray.length / CONFIG.BATCH_SIZE)
  let processedCount = 0

  for (let i = 0; i < batchCount && processedCount < CONFIG.MAX_ENTITIES_PER_FRAME; i++) {
    const batchStart = i * CONFIG.BATCH_SIZE
    const batchEnd = Math.min(batchStart + CONFIG.BATCH_SIZE, entityArray.length)
    const batch = entityArray.slice(batchStart, batchEnd)
    
    // Process batch (simplified - would include actual processing logic)
    batch.forEach(entityId => {
      // Update spatial index if position changed
      const positionComponent = HashMap.get(state.components.position?.data || HashMap.empty(), entityId)
      if (Option.isSome(positionComponent)) {
        const position = [positionComponent.value.x, positionComponent.value.y, positionComponent.value.z] as Vector3
        updateSpatialIndex(state, entityId, undefined, position)
      }
    })
    
    processedCount += batch.length
  }

  // Clear dirty flags for processed entities
  const newComponents = Object.fromEntries(
    Object.entries(state.components).map(([name, storage]) => [
      name,
      {
        ...storage,
        dirty: new Set(Array.from(storage.dirty).slice(processedCount))
      }
    ])
  ) as OptimizedComponentStorage

  return {
    ...state,
    components: newComponents
  }
}

/**
 * Optimize world state periodically
 */
const optimizeWorldState = (state: OptimizedWorldState): OptimizedWorldState => {
  const currentTime = Date.now()
  
  // Clean up old query cache entries
  if (CONFIG.QUERY_CACHING) {
    const CACHE_MAX_AGE = 60000 // 1 minute
    for (const [key, cache] of state.archetypes.queryCache) {
      if (currentTime - cache.lastUpdate > CACHE_MAX_AGE) {
        state.archetypes.queryCache.delete(key)
      }
    }
  }

  // Clean up old change events
  const EVENT_MAX_AGE = 30000 // 30 seconds
  const recentEvents = state.changeEvents.filter(
    event => currentTime - event.timestamp < EVENT_MAX_AGE
  )

  // Update metrics
  const memoryUsage = calculateMemoryUsage(state)

  return {
    ...state,
    changeEvents: recentEvents,
    archetypes: {
      ...state.archetypes,
      lastOptimization: currentTime,
    },
    metrics: {
      ...state.metrics,
      memoryUsage,
      lastGC: currentTime,
    },
  }
}

/**
 * Calculate approximate memory usage
 */
const calculateMemoryUsage = (state: OptimizedWorldState): number => {
  let totalSize = 0
  
  // Entities
  totalSize += state.metrics.totalEntities * 64 // Approximate size per entity
  
  // Components
  Object.values(state.components).forEach(storage => {
    totalSize += HashMap.size(storage.data) * 128 // Approximate size per component
  })
  
  // Chunks
  totalSize += HashMap.size(state.chunks) * (16 * 16 * 256 * 4) // Block data size
  
  // Query cache
  totalSize += state.archetypes.queryCache.size * 256 // Approximate cache entry size
  
  return totalSize
}

// --- Enhanced Effect Service ---

export const WorldOptimizedLive = Layer.effect(
  World,
  Effect.gen(function* (_) {
    const initialState: OptimizedWorldState = {
      nextEntityId: 0,
      entities: HashMap.empty(),
      archetypes: {
        data: HashMap.empty(),
        spatialIndex: new Map(),
        queryCache: new Map(),
        lastOptimization: Date.now(),
      },
      components: Object.fromEntries(
        Array.from(componentNamesSet).map((name) => [
          name, 
          {
            data: HashMap.empty(),
            dirty: new Set(),
            lastAccess: 0,
            accessCount: 0,
          }
        ])
      ) as OptimizedComponentStorage,
      chunks: HashMap.empty(),
      spatialGrid: {
        cells: new Map(),
        entityToCell: new Map(),
        octree: null,
        metrics: {
          totalEntities: 0,
          activeCells: 0,
          averageEntitiesPerCell: 0,
          maxEntitiesInCell: 0,
          lastOptimization: Date.now(),
        },
      },
      chunkCache: {
        l1Cache: new Map(),
        l2Cache: new Map(),
        l3Cache: new Map(),
        lruHead: null,
        lruTail: null,
        loadingChunks: new Set(),
        dirtyChunks: new Set(),
        prefetchQueue: [],
        metrics: {
          l1Hits: 0,
          l2Hits: 0,
          l3Hits: 0,
          misses: 0,
          totalRequests: 0,
          compressionRatio: 0,
          memoryUsage: 0,
        },
      },
      changeEvents: [],
      metrics: {
        totalEntities: 0,
        totalComponents: 0,
        totalChunks: 0,
        loadedChunks: 0,
        queriesPerSecond: 0,
        averageQueryTime: 0,
        memoryUsage: 0,
        lastGC: Date.now(),
      },
    }

    const state = yield* _(Ref.make(initialState))

    // Background optimization
    const startOptimization = () =>
      Effect.gen(function* () {
        while (true) {
          yield* Effect.sleep(5000) // Optimize every 5 seconds
          yield* Ref.update(state, optimizeWorldState)
          yield* Ref.update(state, processDirtyEntities)
        }
      }).pipe(Effect.fork)

    if (CONFIG.BACKGROUND_PROCESSING) {
      yield* startOptimization()
    }

    return {
      state,
      
      addArchetype: (archetype: Archetype) =>
        Ref.modify(state, (s) => addArchetypeOptimized(s, archetype)),

      removeEntity: (entityId: EntityId) =>
        Ref.update(state, (s) => removeEntityOptimized(s, entityId)),

      getComponent: <T extends ComponentName>(entityId: EntityId, componentName: T) =>
        Ref.get(state).pipe(
          Effect.map((s) => {
            const componentStorage = s.components[componentName]
            if (componentStorage) {
              // Update access tracking
              componentStorage.lastAccess = Date.now()
              componentStorage.accessCount++
              return HashMap.get(componentStorage.data, entityId)
            }
            return Option.none()
          })
        ),

      getComponentUnsafe: <T extends ComponentName>(entityId: EntityId, componentName: T) =>
        Effect.gen(function* () {
          const s = yield* _(Ref.get(state))
          const componentStorage = s.components[componentName]
          if (!componentStorage) {
            return Effect.fail(new ComponentNotFoundError(entityId, componentName))
          }
          return HashMap.get(componentStorage.data, entityId)
        }).pipe(
          Effect.flatten,
          Effect.mapError(() => new ComponentNotFoundError(entityId, componentName)),
        ),

      updateComponent: <T extends ComponentName>(
        entityId: EntityId,
        componentName: T,
        data: Partial<ComponentOfName<T>>,
      ) =>
        Ref.get(state).pipe(
          Effect.flatMap((s) => {
            const componentStorage = s.components[componentName]
            if (!componentStorage) {
              return Effect.fail(new ComponentNotFoundError(entityId, componentName))
            }

            return HashMap.get(componentStorage.data, entityId).pipe(
              Option.match({
                onNone: () => Effect.fail(new ComponentNotFoundError(entityId, componentName)),
                onSome: (current) => {
                  const updated = { ...current, ...data }
                  return S.decode(ComponentSchemas[componentName])(updated).pipe(
                    Effect.mapError((error) => new ComponentDecodeError(entityId, componentName, error)),
                    Effect.flatMap((decoded) => {
                      // Update component data
                      const newData = HashMap.set(componentStorage.data, entityId, decoded as any)
                      const newDirty = new Set(componentStorage.dirty)
                      newDirty.add(entityId)
                      
                      const newComponents = {
                        ...s.components,
                        [componentName]: {
                          ...componentStorage,
                          data: newData,
                          dirty: newDirty,
                          lastAccess: Date.now(),
                        }
                      }

                      // Invalidate query cache
                      invalidateQueryCache(s.archetypes, componentName)

                      return Ref.set(state, { 
                        ...s, 
                        components: newComponents as OptimizedComponentStorage
                      })
                    })
                  )
                }
              }),
            )
          }),
          Effect.asVoid,
        ),

      query: <T extends ReadonlyArray<ComponentName>>(query: LegacyQuery<T> | OptimizedQuery<T>) =>
        Ref.get(state).pipe(
          Effect.map((s) => {
            const [newState, results] = queryOptimized(s, query)
            // Update state with new metrics
            Effect.runSync(Ref.set(state, newState))
            return results
          }),
        ),

      queryUnsafe: <T extends ReadonlyArray<ComponentName>>(q: LegacyQuery<T> | OptimizedQuery<T>) =>
        Ref.get(state).pipe(
          Effect.map((s) => {
            const [, results] = queryOptimized(s, q)
            return results.map(([entityId, components]) => {
              return [entityId, ...components]
            })
          }),
        ),

      querySingle: <T extends ReadonlyArray<ComponentName>>(q: LegacyQuery<T> | OptimizedQuery<T>) =>
        Ref.get(state).pipe(
          Effect.map((s) => {
            const [, results] = queryOptimized(s, q)
            return Option.fromNullable(results[0])
          })
        ),

      querySingleUnsafe: <T extends ReadonlyArray<ComponentName>>(q: LegacyQuery<T> | OptimizedQuery<T>) =>
        Ref.get(state).pipe(
          Effect.flatMap((s) => {
            const [, results] = queryOptimized(s, q)
            const result = Option.fromNullable(results[0])
            return Option.match(result, {
              onNone: () => Effect.fail(new QuerySingleResultNotFoundError({ query: q, resultCount: 0, expectedCount: 1 })),
              onSome: (value) => Effect.succeed(value)
            })
          })
        ),

      querySoA: <T extends ReadonlyArray<ComponentName>>(query: LegacyQuery<T> | OptimizedQuery<T>) =>
        Ref.get(state).pipe(
          Effect.map((s) => {
            const [, results] = queryOptimized(s, query)
            const entities = results.map(([entityId]) => entityId)
            const components = Object.fromEntries(
              query.components.map((name, i) => [name, results.map(([, ...components]) => components[i])]),
            )

            return {
              entities,
              components: components as { [K in T[number]]: ReadonlyArray<Components[K]> },
            }
          }),
        ),

      // Chunk management (unchanged from original)
      getChunk: (chunkX: number, chunkZ: number) =>
        Ref.get(state).pipe(Effect.map((s) => HashMap.get(s.chunks, getChunkKey(chunkX, chunkZ)))),

      setChunk: (chunkX: number, chunkZ: number, chunk: Chunk) =>
        Ref.update(state, (s) => ({
          ...s,
          chunks: HashMap.set(s.chunks, getChunkKey(chunkX, chunkZ), chunk),
        })),

      getVoxel: (x: number, y: number, z: number) =>
        Ref.get(state).pipe(
          Effect.map((s) => {
            const chunkKey = getChunkKey(Math.floor(x / 16), Math.floor(z / 16))
            const chunkOpt = HashMap.get(s.chunks, chunkKey)
            return Option.match(chunkOpt, {
              onNone: () => Option.none<Voxel>(),
              onSome: (chunk) => {
                const vec: Vector3 = [x, y, z] as unknown as Vector3
                const index = toChunkIndex(vec)
                const blockType = chunk.blocks[index]
                if (blockType === 'air') {
                  return Option.none<Voxel>()
                }
                const voxel: Voxel = {
                  position: [Math.floor(x), Math.floor(y), Math.floor(z)] as unknown as Vector3,
                  blockType: blockType,
                }
                return Option.some(voxel)
              },
            })
          }),
        ),

      setVoxel: (x: number, y: number, z: number, voxel: Voxel) =>
        Ref.get(state).pipe(
          Effect.flatMap((s) => {
            const chunkKey = getChunkKey(Math.floor(x / 16), Math.floor(z / 16))
            const chunkOpt = HashMap.get(s.chunks, chunkKey)
            return Option.match(chunkOpt, {
              onNone: () => Effect.void,
              onSome: (chunk) => {
                const vec: Vector3 = [x, y, z] as unknown as Vector3
                const index = toChunkIndex(vec)
                const newBlocks = [...chunk.blocks]
                newBlocks[index] = voxel.blockType
                const newChunk: Chunk = { ...chunk, blocks: newBlocks }
                return Ref.update(state, (prevState) => ({
                  ...prevState,
                  chunks: HashMap.set(prevState.chunks, chunkKey, newChunk),
                }))
              },
            })
          })
        ),

      // Enhanced methods
      getEntitiesInChunk: (chunkX: number, chunkZ: number) =>
        Ref.get(state).pipe(
          Effect.map((s) => Array.from(getEntitiesInChunk(s, chunkX, chunkZ)))
        ),

      getWorldMetrics: () =>
        Ref.get(state).pipe(Effect.map((s) => s.metrics)),

      optimizeWorld: () =>
        Ref.update(state, optimizeWorldState),

      getChangeEvents: (since?: number) =>
        Ref.get(state).pipe(
          Effect.map((s) => {
            const sinceTime = since || 0
            return s.changeEvents.filter(event => event.timestamp > sinceTime)
          })
        ),
    }
  }),
)

// Export types and configuration
export type { 
  OptimizedWorldState, 
  OptimizedComponentStorage, 
  OptimizedArchetypeStorage, 
  WorldChangeEvent, 
  EntityBatch, 
  CachedQuery 
}
export { CONFIG as WorldOptimizedConfig }