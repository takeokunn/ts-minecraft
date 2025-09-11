import { Effect, Ref, Cache, Duration, Schedule, Queue, Option, pipe } from 'effect'
import { Context } from 'effect'
import { Profile, MemoryDetector, Metrics } from '@/core/performance'

/**
 * Resource types and interfaces
 */
export type ResourceType = 'texture' | 'audio' | 'mesh' | 'shader' | 'chunk' | 'config'

export interface Resource<T = any> {
  readonly id: string
  readonly type: ResourceType
  readonly data: T
  readonly size: number
  readonly lastAccessed: number
  readonly loadTime: number
  readonly priority: ResourcePriority
}

export type ResourcePriority = 'critical' | 'high' | 'normal' | 'low'

export interface ResourceRequest<T = any> {
  readonly id: string
  readonly type: ResourceType
  readonly priority: ResourcePriority
  readonly loader: () => Promise<T>
  readonly validator?: (data: T) => boolean
  readonly estimatedSize?: number
}

/**
 * Resource loading strategies
 */
export type LoadingStrategy = 
  | 'immediate'    // Load immediately when requested
  | 'lazy'         // Load when first accessed
  | 'preload'      // Load in background based on predictions
  | 'ondemand'     // Load only when explicitly requested

export interface ResourceManagerConfig {
  readonly maxMemoryUsage: number // bytes
  readonly maxCacheSize: number   // number of items
  readonly preloadDistance: number // chunks/areas to preload
  readonly gcThreshold: number     // memory threshold for cleanup
  readonly defaultStrategy: LoadingStrategy
  readonly strategies: Partial<Record<ResourceType, LoadingStrategy>>
}

export const defaultResourceConfig: ResourceManagerConfig = {
  maxMemoryUsage: 256 * 1024 * 1024, // 256MB
  maxCacheSize: 10000,
  preloadDistance: 3,
  gcThreshold: 200 * 1024 * 1024, // 200MB
  defaultStrategy: 'lazy',
  strategies: {
    texture: 'lazy',
    audio: 'ondemand', 
    mesh: 'lazy',
    shader: 'preload',
    chunk: 'lazy',
    config: 'immediate'
  }
}

/**
 * Resource cache with LRU eviction and memory management
 */
interface ResourceCache {
  readonly get: <T>(id: string) => Effect.Effect<Option.Option<Resource<T>>, never, never>
  readonly set: <T>(resource: Resource<T>) => Effect.Effect<void, never, never>
  readonly remove: (id: string) => Effect.Effect<void, never, never>
  readonly clear: () => Effect.Effect<void, never, never>
  readonly getStats: () => Effect.Effect<{
    size: number
    memoryUsage: number
    hitRate: number
    missRate: number
  }, never, never>
  readonly cleanup: () => Effect.Effect<void, never, never>
}

/**
 * Resource loading queue with priority scheduling
 */
interface LoadingQueue {
  readonly enqueue: <T>(request: ResourceRequest<T>) => Effect.Effect<void, never, never>
  readonly dequeue: () => Effect.Effect<Option.Option<ResourceRequest>, never, never>
  readonly clear: () => Effect.Effect<void, never, never>
  readonly size: () => Effect.Effect<number, never, never>
}

/**
 * Create resource cache with LRU eviction
 */
const createResourceCache = (config: ResourceManagerConfig): Effect.Effect<ResourceCache, never, never> =>
  Effect.gen(function* () {
    const cache = new Map<string, Resource>()
    const accessOrder = yield* Ref.make<string[]>([])
    const memoryUsage = yield* Ref.make(0)
    const stats = yield* Ref.make({
      hits: 0,
      misses: 0,
      evictions: 0
    })
    
    const updateAccessOrder = (id: string) =>
      Ref.update(accessOrder, order => {
        const filtered = order.filter(item => item !== id)
        return [...filtered, id] // Move to end (most recent)
      })
    
    const evictLRU = (): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const order = yield* Ref.get(accessOrder)
        const currentMemory = yield* Ref.get(memoryUsage)
        
        // Evict until under memory threshold
        while (order.length > 0 && currentMemory > config.gcThreshold) {
          const oldestId = order[0]
          const resource = cache.get(oldestId)
          
          if (resource) {
            cache.delete(oldestId)
            yield* Ref.update(memoryUsage, mem => mem - resource.size)
            yield* Ref.update(stats, s => ({ ...s, evictions: s.evictions + 1 }))
            
            yield* Effect.logInfo(`Evicted resource: ${oldestId} (${resource.size} bytes)`)
          }
          
          yield* Ref.update(accessOrder, o => o.slice(1))
          const newOrder = yield* Ref.get(accessOrder)
          order.splice(0, order.length, ...newOrder)
        }
      })
    
    return {
      get: <T>(id: string) =>
        Effect.gen(function* () {
          const resource = cache.get(id)
          
          if (resource) {
            yield* updateAccessOrder(id)
            yield* Ref.update(stats, s => ({ ...s, hits: s.hits + 1 }))
            return Option.some(resource as Resource<T>)
          } else {
            yield* Ref.update(stats, s => ({ ...s, misses: s.misses + 1 }))
            return Option.none()
          }
        }),
      
      set: <T>(resource: Resource<T>) =>
        Effect.gen(function* () {
          // Check if we need to evict first
          const currentMemory = yield* Ref.get(memoryUsage)
          if (currentMemory + resource.size > config.maxMemoryUsage) {
            yield* evictLRU()
          }
          
          // Remove existing resource if present
          const existing = cache.get(resource.id)
          if (existing) {
            yield* Ref.update(memoryUsage, mem => mem - existing.size)
          }
          
          // Add new resource
          cache.set(resource.id, resource)
          yield* Ref.update(memoryUsage, mem => mem + resource.size)
          yield* updateAccessOrder(resource.id)
          
          // Track memory usage
          yield* MemoryDetector.trackObjects(`resource_${resource.type}`, 1, resource.size)
        }),
      
      remove: (id: string) =>
        Effect.gen(function* () {
          const resource = cache.get(id)
          if (resource) {
            cache.delete(id)
            yield* Ref.update(memoryUsage, mem => mem - resource.size)
            yield* Ref.update(accessOrder, order => order.filter(item => item !== id))
            
            yield* MemoryDetector.trackObjects(`resource_${resource.type}`, -1, -resource.size)
          }
        }),
      
      clear: () =>
        Effect.gen(function* () {
          cache.clear()
          yield* Ref.set(memoryUsage, 0)
          yield* Ref.set(accessOrder, [])
          yield* Effect.log('Resource cache cleared')
        }),
      
      getStats: () =>
        Effect.gen(function* () {
          const currentStats = yield* Ref.get(stats)
          const memory = yield* Ref.get(memoryUsage)
          const total = currentStats.hits + currentStats.misses
          
          return {
            size: cache.size,
            memoryUsage: memory,
            hitRate: total > 0 ? currentStats.hits / total : 0,
            missRate: total > 0 ? currentStats.misses / total : 0
          }
        }),
      
      cleanup: evictLRU
    }
  })

/**
 * Create priority-based loading queue
 */
const createLoadingQueue = (): Effect.Effect<LoadingQueue, never, never> =>
  Effect.gen(function* () {
    const criticalQueue = yield* Queue.unbounded<ResourceRequest>()
    const highQueue = yield* Queue.unbounded<ResourceRequest>()
    const normalQueue = yield* Queue.unbounded<ResourceRequest>()
    const lowQueue = yield* Queue.unbounded<ResourceRequest>()
    
    const getQueueByPriority = (priority: ResourcePriority) => {
      switch (priority) {
        case 'critical': return criticalQueue
        case 'high': return highQueue
        case 'normal': return normalQueue
        case 'low': return lowQueue
      }
    }
    
    return {
      enqueue: <T>(request: ResourceRequest<T>) =>
        Queue.offer(getQueueByPriority(request.priority), request),
      
      dequeue: () =>
        Effect.gen(function* () {
          // Try queues in priority order
          const criticalItem = yield* Queue.poll(criticalQueue)
          if (Option.isSome(criticalItem)) return criticalItem
          
          const highItem = yield* Queue.poll(highQueue)
          if (Option.isSome(highItem)) return highItem
          
          const normalItem = yield* Queue.poll(normalQueue)
          if (Option.isSome(normalItem)) return normalItem
          
          const lowItem = yield* Queue.poll(lowQueue)
          if (Option.isSome(lowItem)) return lowItem
          
          return Option.none()
        }),
      
      clear: () =>
        Effect.gen(function* () {
          yield* Queue.clear(criticalQueue)
          yield* Queue.clear(highQueue)
          yield* Queue.clear(normalQueue)
          yield* Queue.clear(lowQueue)
        }),
      
      size: () =>
        Effect.gen(function* () {
          const sizes = yield* Effect.all([
            Queue.size(criticalQueue),
            Queue.size(highQueue),
            Queue.size(normalQueue),
            Queue.size(lowQueue)
          ])
          return sizes.reduce((total, size) => total + size, 0)
        })
    }
  })

/**
 * Main Resource Manager
 */
export interface ResourceManager {
  readonly load: <T>(request: ResourceRequest<T>) => Effect.Effect<Resource<T>, unknown, never>
  readonly get: <T>(id: string) => Effect.Effect<Option.Option<Resource<T>>, never, never>
  readonly preload: (ids: string[], type: ResourceType) => Effect.Effect<void, never, never>
  readonly unload: (id: string) => Effect.Effect<void, never, never>
  readonly cleanup: () => Effect.Effect<void, never, never>
  readonly getStats: () => Effect.Effect<{
    cacheStats: { size: number; memoryUsage: number; hitRate: number; missRate: number }
    queueSize: number
    loadingCount: number
  }, never, never>
}

/**
 * Create the main resource manager
 */
export const createResourceManager = (
  config: ResourceManagerConfig = defaultResourceConfig
): Effect.Effect<ResourceManager, never, never> =>
  Effect.gen(function* () {
    const cache = yield* createResourceCache(config)
    const loadingQueue = yield* createLoadingQueue()
    const loadingCount = yield* Ref.make(0)
    
    // Background loader worker
    const processLoadingQueue = Effect.gen(function* () {
      while (true) {
        const requestOption = yield* loadingQueue.dequeue()
        
        if (Option.isSome(requestOption)) {
          const request = requestOption.value
          
          yield* Profile.measure(`load_resource:${request.id}`)(
            Effect.gen(function* () {
              yield* Ref.update(loadingCount, c => c + 1)
              
              try {
                const startTime = performance.now()
                const data = yield* Effect.tryPromise(() => request.loader())
                const loadTime = performance.now() - startTime
                
                // Validate if validator provided
                if (request.validator && !request.validator(data)) {
                  yield* Effect.logError(`Resource validation failed: ${request.id}`)
                  return
                }
                
                const resource: Resource = {
                  id: request.id,
                  type: request.type,
                  data,
                  size: request.estimatedSize || 1024, // Default 1KB
                  lastAccessed: Date.now(),
                  loadTime,
                  priority: request.priority
                }
                
                yield* cache.set(resource)
                
                // Record metrics
                yield* Metrics.recordTimer(`resource.load_time`, loadTime, {
                  type: request.type,
                  priority: request.priority
                })
                yield* Metrics.recordGauge(`resource.size`, resource.size, {
                  type: request.type,
                  id: request.id
                })
                
                yield* Effect.logInfo(`Loaded resource: ${request.id} (${loadTime.toFixed(2)}ms, ${resource.size} bytes)`)
                
              } catch (error) {
                yield* Effect.logError(`Failed to load resource: ${request.id}`, error)
                yield* Metrics.increment(`resource.load_errors`, {
                  type: request.type,
                  id: request.id
                })
              } finally {
                yield* Ref.update(loadingCount, c => c - 1)
              }
            })
          )
        } else {
          // No requests, sleep briefly
          yield* Effect.sleep(Duration.millis(10))
        }
      }
    }).pipe(Effect.fork)
    
    // Start background loader
    yield* processLoadingQueue
    
    // Periodic cleanup
    const periodicCleanup = Effect.gen(function* () {
      yield* cache.cleanup()
      
      const stats = yield* cache.getStats()
      if (stats.memoryUsage > config.gcThreshold) {
        yield* Effect.logWarning(`Memory usage high: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)}MB`)
      }
    }).pipe(
      Effect.repeat(Schedule.fixed(Duration.seconds(30))),
      Effect.fork
    )
    
    yield* periodicCleanup
    
    return {
      load: <T>(request: ResourceRequest<T>) =>
        Effect.gen(function* () {
          // Check cache first
          const cached = yield* cache.get<T>(request.id)
          if (Option.isSome(cached)) {
            return cached.value
          }
          
          // Get loading strategy
          const strategy = config.strategies[request.type] || config.defaultStrategy
          
          switch (strategy) {
            case 'immediate':
              // Load synchronously
              const startTime = performance.now()
              const data = yield* Effect.tryPromise(() => request.loader())
              const loadTime = performance.now() - startTime
              
              const resource: Resource<T> = {
                id: request.id,
                type: request.type,
                data,
                size: request.estimatedSize || 1024,
                lastAccessed: Date.now(),
                loadTime,
                priority: request.priority
              }
              
              yield* cache.set(resource)
              return resource
              
            case 'lazy':
            case 'preload':
            case 'ondemand':
            default:
              // Queue for background loading
              yield* loadingQueue.enqueue(request)
              
              // Wait for loading to complete or timeout
              const waitForLoad = Effect.gen(function* () {
                let attempts = 0
                const maxAttempts = 100 // 10 seconds max
                
                while (attempts < maxAttempts) {
                  const loaded = yield* cache.get<T>(request.id)
                  if (Option.isSome(loaded)) {
                    return loaded.value
                  }
                  
                  yield* Effect.sleep(Duration.millis(100))
                  attempts++
                }
                
                return yield* Effect.fail(`Resource load timeout: ${request.id}`)
              })
              
              return yield* waitForLoad
          }
        }),
      
      get: <T>(id: string) => cache.get<T>(id),
      
      preload: (ids: string[], type: ResourceType) =>
        Effect.gen(function* () {
          for (const id of ids) {
            // Create a dummy request for preloading
            // In a real implementation, you'd have a registry of known resources
            const request: ResourceRequest = {
              id,
              type,
              priority: 'low',
              loader: () => Promise.resolve(null) // Placeholder
            }
            
            yield* loadingQueue.enqueue(request)
          }
        }),
      
      unload: (id: string) => cache.remove(id),
      
      cleanup: () =>
        Effect.gen(function* () {
          yield* cache.cleanup()
          yield* loadingQueue.clear()
          yield* Effect.log('Resource manager cleanup completed')
        }),
      
      getStats: () =>
        Effect.gen(function* () {
          const cacheStats = yield* cache.getStats()
          const queueSize = yield* loadingQueue.size()
          const currentLoadingCount = yield* Ref.get(loadingCount)
          
          return {
            cacheStats,
            queueSize,
            loadingCount: currentLoadingCount
          }
        })
    }
  })

/**
 * Resource manager service tag
 */
export class ResourceManagerService extends Context.Tag('ResourceManagerService')<
  ResourceManagerService,
  ResourceManager
>() {}

/**
 * Texture loading utilities
 */
export const loadTexture = (
  url: string,
  priority: ResourcePriority = 'normal'
): ResourceRequest<HTMLImageElement> => ({
  id: url,
  type: 'texture',
  priority,
  loader: () => new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  }),
  validator: (img) => img.complete && img.naturalWidth > 0,
  estimatedSize: 1024 * 1024 // 1MB estimate
})

/**
 * Audio loading utilities  
 */
export const loadAudio = (
  url: string,
  priority: ResourcePriority = 'low'
): ResourceRequest<AudioBuffer> => ({
  id: url,
  type: 'audio', 
  priority,
  loader: async () => {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    const audioContext = new AudioContext()
    return await audioContext.decodeAudioData(arrayBuffer)
  },
  validator: (buffer) => buffer.length > 0,
  estimatedSize: 512 * 1024 // 512KB estimate
})

/**
 * Mesh loading utilities
 */
export const loadMesh = (
  url: string,
  priority: ResourcePriority = 'normal'
): ResourceRequest<any> => ({
  id: url,
  type: 'mesh',
  priority,
  loader: async () => {
    const response = await fetch(url)
    return await response.json()
  },
  estimatedSize: 2 * 1024 * 1024 // 2MB estimate
})

/**
 * Utility functions
 */
export const withResourceManager = <R, E, A>(
  fn: (manager: ResourceManager) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | ResourceManagerService> =>
  Effect.gen(function* () {
    const manager = yield* ResourceManagerService
    return yield* fn(manager)
  })

/**
 * Resource preloading based on prediction
 */
export const predictivePreloader = (
  currentPosition: { x: number; z: number },
  config: ResourceManagerConfig
): Effect.Effect<void, never, ResourceManagerService> =>
  Effect.gen(function* () {
    const manager = yield* ResourceManagerService
    
    // Predict needed resources based on position
    const chunkIds: string[] = []
    const distance = config.preloadDistance
    
    for (let x = -distance; x <= distance; x++) {
      for (let z = -distance; z <= distance; z++) {
        const chunkX = Math.floor(currentPosition.x / 16) + x
        const chunkZ = Math.floor(currentPosition.z / 16) + z
        chunkIds.push(`chunk_${chunkX}_${chunkZ}`)
      }
    }
    
    yield* manager.preload(chunkIds, 'chunk')
    yield* Effect.log(`Preloading ${chunkIds.length} chunks around position (${currentPosition.x}, ${currentPosition.z})`)
  })