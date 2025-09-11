import { Effect, Ref, Context, Layer, Queue, Option } from 'effect'

/**
 * Resource types that can be managed
 */
export type ResourceType = 'texture' | 'mesh' | 'shader' | 'buffer' | 'audio' | 'model' | 'animation' | 'material'

/**
 * Resource metadata
 */
export interface ResourceMetadata {
  readonly id: string
  readonly type: ResourceType
  readonly size: number
  readonly lastAccessed: number
  readonly accessCount: number
  readonly priority: 'low' | 'medium' | 'high' | 'critical'
  readonly tags: string[]
}

/**
 * Managed resource with automatic cleanup
 */
export interface ManagedResource<T> {
  readonly metadata: ResourceMetadata
  readonly data: T
  readonly dispose: Effect.Effect<void, never, never>
}

/**
 * Resource cache configuration
 */
export interface ResourceCacheConfig {
  readonly maxMemoryMB: number
  readonly maxItems: number
  readonly ttlMs: number
  readonly enableLRU: boolean
  readonly enablePreloading: boolean
  readonly compressionEnabled: boolean
}

/**
 * Resource loading strategy
 */
export type LoadingStrategy = 'immediate' | 'lazy' | 'preload' | 'streaming'

/**
 * Resource loader definition
 */
export interface ResourceLoader<T> {
  readonly load: (id: string, options?: any) => Effect.Effect<T, Error, never>
  readonly unload: (resource: T) => Effect.Effect<void, never, never>
  readonly getSize: (resource: T) => number
  readonly compress?: (resource: T) => Effect.Effect<T, never, never>
  readonly decompress?: (resource: T) => Effect.Effect<T, never, never>
}

/**
 * Resource cache statistics
 */
export interface ResourceStats {
  readonly totalItems: number
  readonly totalMemoryMB: number
  readonly hitRate: number
  readonly missCount: number
  readonly evictionCount: number
  readonly preloadCount: number
  readonly compressionRatio: number
}

/**
 * Resource Service for dependency injection
 */
export const ResourceService = Context.GenericTag<{
  readonly registerLoader: <T>(type: ResourceType, loader: ResourceLoader<T>) => Effect.Effect<void, never, never>

  readonly load: <T>(id: string, type: ResourceType, strategy?: LoadingStrategy, options?: any) => Effect.Effect<ManagedResource<T>, Error, never>

  readonly get: <T>(id: string, type: ResourceType) => Effect.Effect<Option.Option<ManagedResource<T>>, never, never>

  readonly unload: (id: string, type: ResourceType) => Effect.Effect<void, never, never>

  readonly preload: (resources: Array<{ id: string; type: ResourceType; options?: any }>) => Effect.Effect<void, Error, never>

  readonly evict: (strategy: 'lru' | 'size' | 'access' | 'all') => Effect.Effect<number, never, never>

  readonly getStats: () => Effect.Effect<ResourceStats, never, never>
  readonly clearCache: () => Effect.Effect<void, never, never>

  readonly startGC: () => Effect.Effect<void, never, never>
  readonly stopGC: () => Effect.Effect<void, never, never>

  readonly exportCache: () => Effect.Effect<
    {
      resources: Array<{ id: string; type: ResourceType; size: number }>
      stats: ResourceStats
    },
    never,
    never
  >
}>('ResourceService')

/**
 * Create resource service implementation
 */
const createResourceServiceImpl = (config: ResourceCacheConfig): Effect.Effect<Context.Tag.Service<typeof ResourceService>, never, never> =>
  Effect.gen(function* () {
    const cache = yield* Ref.make<Map<string, ManagedResource<any>>>(new Map())
    const loaders = yield* Ref.make<Map<ResourceType, ResourceLoader<any>>>(new Map())
    const stats = yield* Ref.make<ResourceStats>({
      totalItems: 0,
      totalMemoryMB: 0,
      hitRate: 0,
      missCount: 0,
      evictionCount: 0,
      preloadCount: 0,
      compressionRatio: 0,
    })
    const preloadQueue = yield* Queue.unbounded<{ id: string; type: ResourceType; options?: any }>()
    const gcRunning = yield* Ref.make(false)

    const generateCacheKey = (id: string, type: ResourceType) => `${type}:${id}`

    const updateStats = (update: Partial<ResourceStats>) => Ref.update(stats, (current) => ({ ...current, ...update }))

    const calculateMemoryUsage = () =>
      Effect.gen(function* () {
        const cacheMap = yield* Ref.get(cache)
        let totalSize = 0
        for (const resource of cacheMap.values()) {
          totalSize += resource.metadata.size
        }
        return totalSize / (1024 * 1024) // Convert to MB
      })

    const shouldEvict = () =>
      Effect.gen(function* () {
        const cacheMap = yield* Ref.get(cache)
        const memoryMB = yield* calculateMemoryUsage()

        return cacheMap.size >= config.maxItems || memoryMB >= config.maxMemoryMB
      })

    const evictLRU = () =>
      Effect.gen(function* () {
        const cacheMap = yield* Ref.get(cache)
        let oldestResource: ManagedResource<any> | null = null
        let oldestKey: string | null = null
        let oldestTime = Date.now()

        for (const [key, resource] of cacheMap.entries()) {
          if (resource.metadata.lastAccessed < oldestTime && resource.metadata.priority !== 'critical') {
            oldestTime = resource.metadata.lastAccessed
            oldestResource = resource
            oldestKey = key
          }
        }

        if (oldestResource && oldestKey) {
          yield* oldestResource.dispose
          yield* Ref.update(cache, (map) => {
            const newMap = new Map(map)
            newMap.delete(oldestKey)
            return newMap
          })
          return 1
        }
        return 0
      })

    const evictBySize = () =>
      Effect.gen(function* () {
        const cacheMap = yield* Ref.get(cache)
        const resources = Array.from(cacheMap.entries())
          .filter(([_, resource]) => resource.metadata.priority !== 'critical')
          .sort(([_, a], [__, b]) => b.metadata.size - a.metadata.size)

        let evicted = 0
        for (const [key, resource] of resources) {
          if (evicted >= 5) break // Evict maximum 5 largest resources at once

          yield* resource.dispose
          yield* Ref.update(cache, (map) => {
            const newMap = new Map(map)
            newMap.delete(key)
            return newMap
          })
          evicted++
        }

        return evicted
      })

    const runGC = () =>
      Effect.gen(function* () {
        const isRunning = yield* Ref.get(gcRunning)
        if (isRunning) return

        yield* Ref.set(gcRunning, true)

        try {
          const cacheMap = yield* Ref.get(cache)
          const now = Date.now()
          let evicted = 0

          for (const [key, resource] of cacheMap.entries()) {
            // Check TTL expiration
            if (now - resource.metadata.lastAccessed > config.ttlMs && resource.metadata.priority !== 'critical') {
              yield* resource.dispose
              yield* Ref.update(cache, (map) => {
                const newMap = new Map(map)
                newMap.delete(key)
                return newMap
              })
              evicted++
            }
          }

          yield* updateStats({ evictionCount: evicted })
          yield* Effect.logDebug(`Resource GC: evicted ${evicted} expired resources`)
        } finally {
          yield* Ref.set(gcRunning, false)
        }
      })

    const processPreloadQueue = () =>
      Effect.gen(function* () {
        while (true) {
          const item = yield* Queue.take(preloadQueue)
          try {
            yield* Effect.gen(function* () {
              const service = {
                load: (id: string, type: ResourceType, strategy?: LoadingStrategy, options?: any) => loadResource(id, type, strategy, options),
              } as any
              yield* service.load(item.id, item.type, 'preload', item.options)
              yield* updateStats({ preloadCount: 1 })
            }).pipe(Effect.catchAll(() => Effect.succeed(undefined as void)))
          } catch {
            // Ignore preload failures
          }
        }
      })

    const loadResource = <T>(id: string, type: ResourceType, strategy: LoadingStrategy = 'immediate', options?: any): Effect.Effect<ManagedResource<T>, Error, never> =>
      Effect.gen(function* () {
        const cacheKey = generateCacheKey(id, type)
        const cached = (yield* Ref.get(cache)).get(cacheKey)

        if (cached) {
          // Update access metadata
          const updatedMetadata: ResourceMetadata = {
            ...cached.metadata,
            lastAccessed: Date.now(),
            accessCount: cached.metadata.accessCount + 1,
          }

          const updatedResource = { ...cached, metadata: updatedMetadata }

          yield* Ref.update(cache, (map) => new Map(map).set(cacheKey, updatedResource))

          yield* updateStats({ hitRate: 0.1 }) // Increment hit rate
          return updatedResource as ManagedResource<T>
        }

        // Cache miss
        yield* updateStats({ missCount: 1 })

        const loaderMap = yield* Ref.get(loaders)
        const loader = loaderMap.get(type)

        if (!loader) {
          yield* Effect.fail(new Error(`No loader registered for resource type: ${type}`))
        }

        // Load the resource
        const data = yield* loader.load(id, options)
        const size = loader.getSize(data)

        // Compress if enabled and supported
        const finalData = config.compressionEnabled && loader.compress ? yield* loader.compress(data) : data

        const metadata: ResourceMetadata = {
          id,
          type,
          size,
          lastAccessed: Date.now(),
          accessCount: 1,
          priority: options?.priority || 'medium',
          tags: options?.tags || [],
        }

        const managedResource: ManagedResource<T> = {
          metadata,
          data: finalData,
          dispose: Effect.gen(function* () {
            yield* loader.unload(finalData)
          }),
        }

        // Check if we need to evict before adding
        const needsEviction = yield* shouldEvict()
        if (needsEviction && config.enableLRU) {
          yield* evictLRU()
        }

        // Add to cache
        yield* Ref.update(cache, (map) => new Map(map).set(cacheKey, managedResource))

        // Update stats
        const memoryMB = yield* calculateMemoryUsage()
        yield* updateStats({
          totalItems: 1,
          totalMemoryMB: memoryMB,
        })

        return managedResource
      })

    // Start background processes
    if (config.enablePreloading) {
      Effect.runFork(processPreloadQueue())
    }

    return {
      registerLoader: <T>(type: ResourceType, loader: ResourceLoader<T>) => Ref.update(loaders, (map) => new Map(map).set(type, loader)),

      load: loadResource,

      get: <T>(id: string, type: ResourceType) =>
        Effect.gen(function* () {
          const cacheKey = generateCacheKey(id, type)
          const cacheMap = yield* Ref.get(cache)
          const resource = cacheMap.get(cacheKey) as ManagedResource<T> | undefined
          return resource ? Option.some(resource) : Option.none()
        }),

      unload: (id: string, type: ResourceType) =>
        Effect.gen(function* () {
          const cacheKey = generateCacheKey(id, type)
          const cacheMap = yield* Ref.get(cache)
          const resource = cacheMap.get(cacheKey)

          if (resource) {
            yield* resource.dispose
            yield* Ref.update(cache, (map) => {
              const newMap = new Map(map)
              newMap.delete(cacheKey)
              return newMap
            })

            const memoryMB = yield* calculateMemoryUsage()
            yield* updateStats({
              totalItems: -1,
              totalMemoryMB: memoryMB,
            })
          }
        }),

      preload: (resources) =>
        Effect.gen(function* () {
          if (!config.enablePreloading) {
            return
          }

          for (const resource of resources) {
            yield* Queue.offer(preloadQueue, resource)
          }
        }),

      evict: (strategy) =>
        Effect.gen(function* () {
          switch (strategy) {
            case 'lru':
              return yield* evictLRU()
            case 'size':
              return yield* evictBySize()
            case 'access':
              // Evict least accessed resources
              return yield* evictLRU()
            case 'all':
              const cacheMap = yield* Ref.get(cache)
              let evicted = 0
              for (const [key, resource] of cacheMap.entries()) {
                if (resource.metadata.priority !== 'critical') {
                  yield* resource.dispose
                  evicted++
                }
              }
              yield* Ref.update(cache, (map) => {
                const newMap = new Map()
                for (const [key, resource] of map.entries()) {
                  if (resource.metadata.priority === 'critical') {
                    newMap.set(key, resource)
                  }
                }
                return newMap
              })
              return evicted
            default:
              return 0
          }
        }),

      getStats: () => Ref.get(stats),

      clearCache: () =>
        Effect.gen(function* () {
          const cacheMap = yield* Ref.get(cache)
          for (const resource of cacheMap.values()) {
            yield* resource.dispose
          }
          yield* Ref.set(cache, new Map())
          yield* Ref.set(stats, {
            totalItems: 0,
            totalMemoryMB: 0,
            hitRate: 0,
            missCount: 0,
            evictionCount: 0,
            preloadCount: 0,
            compressionRatio: 0,
          })
        }),

      startGC: () =>
        Effect.gen(function* () {
          const gcInterval = setInterval(() => {
            Effect.runFork(runGC())
          }, 30000) // Run GC every 30 seconds

          // Store interval ID for cleanup
          yield* Effect.sync(() => {
            // @ts-ignore - Store for cleanup
            globalThis._resourceGCInterval = gcInterval
          })
        }),

      stopGC: () =>
        Effect.sync(() => {
          // @ts-ignore
          if (globalThis._resourceGCInterval) {
            // @ts-ignore
            clearInterval(globalThis._resourceGCInterval)
            // @ts-ignore
            delete globalThis._resourceGCInterval
          }
        }),

      exportCache: () =>
        Effect.gen(function* () {
          const cacheMap = yield* Ref.get(cache)
          const currentStats = yield* Ref.get(stats)

          const resources = Array.from(cacheMap.values()).map((resource) => ({
            id: resource.metadata.id,
            type: resource.metadata.type,
            size: resource.metadata.size,
          }))

          return {
            resources,
            stats: currentStats,
          }
        }),
    }
  })

/**
 * Default resource cache configuration
 */
export const defaultResourceConfig: ResourceCacheConfig = {
  maxMemoryMB: 512,
  maxItems: 1000,
  ttlMs: 5 * 60 * 1000, // 5 minutes
  enableLRU: true,
  enablePreloading: true,
  compressionEnabled: false,
}

/**
 * Resource Service Layer implementation
 */
export const ResourceServiceLive = (config: ResourceCacheConfig = defaultResourceConfig) => Layer.effect(ResourceService, createResourceServiceImpl(config))

/**
 * Resource utilities
 */
export const withResource = <T, R, E>(
  id: string,
  type: ResourceType,
  fn: (resource: ManagedResource<T>) => Effect.Effect<R, E, never>,
): Effect.Effect<R, E | Error, ResourceService> =>
  Effect.gen(function* () {
    const service = yield* ResourceService
    const resource = yield* service.load<T>(id, type)
    return yield* fn(resource)
  })

/**
 * Batch load multiple resources
 */
export const loadBatch = (resources: Array<{ id: string; type: ResourceType; options?: any }>): Effect.Effect<ManagedResource<any>[], Error, ResourceService> =>
  Effect.gen(function* () {
    const service = yield* ResourceService
    const results: ManagedResource<any>[] = []

    for (const resource of resources) {
      const loaded = yield* service.load(resource.id, resource.type, 'immediate', resource.options)
      results.push(loaded)
    }

    return results
  })

/**
 * Create a resource loader helper
 */
export const createLoader = <T>(config: {
  load: (id: string, options?: any) => Effect.Effect<T, Error, never>
  unload: (resource: T) => Effect.Effect<void, never, never>
  getSize: (resource: T) => number
  compress?: (resource: T) => Effect.Effect<T, never, never>
  decompress?: (resource: T) => Effect.Effect<T, never, never>
}): ResourceLoader<T> => config
