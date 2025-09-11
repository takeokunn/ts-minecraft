/**
 * Advanced Cache System (Effect-TS Implementation)
 * Multi-layer caching with LRU, TTL, and invalidation strategies
 */

import { Effect, Context, Layer, Cache, Duration, Ref, HashMap, Option, pipe, Schedule, Fiber, Queue, Metric, Chunk } from 'effect'
import * as S from 'effect/Schema'

// ============================================================================
// Schema Definitions
// ============================================================================

export const CacheStrategy = S.Literal('LRU', 'LFU', 'FIFO', 'TTL')
export type CacheStrategy = S.Schema.Type<typeof CacheStrategy>

export const CacheLevel = S.Literal('L1', 'L2', 'L3')
export type CacheLevel = S.Schema.Type<typeof CacheLevel>

export const CacheEntry = S.Struct({
  key: S.String,
  value: S.Unknown,
  size: S.Number,
  createdAt: S.Number,
  lastAccessedAt: S.Number,
  accessCount: S.Number,
  ttl: S.optional(S.Number),
})
export type CacheEntry = S.Schema.Type<typeof CacheEntry>

export const CacheConfig = S.Struct({
  name: S.String,
  strategy: CacheStrategy,
  maxSize: S.Number, // in bytes
  maxEntries: S.Number,
  ttl: S.optional(S.Number), // milliseconds
  levels: S.Array(
    S.Struct({
      level: CacheLevel,
      maxSize: S.Number,
      strategy: CacheStrategy,
    }),
  ),
  persistence: S.Boolean,
  compression: S.Boolean,
})
export type CacheConfig = S.Schema.Type<typeof CacheConfig>

export const CacheStats = S.Struct({
  hits: S.Number,
  misses: S.Number,
  evictions: S.Number,
  currentSize: S.Number,
  currentEntries: S.Number,
  hitRate: S.Number,
  averageAccessTime: S.Number,
})
export type CacheStats = S.Schema.Type<typeof CacheStats>

// ============================================================================
// Error Definitions
// ============================================================================

export class CacheError extends S.TaggedError<CacheError>()('CacheError', {
  message: S.String,
  key: S.optional(S.String),
}) {}

export class CacheMissError extends S.TaggedError<CacheMissError>()('CacheMissError', {
  key: S.String,
  level: S.optional(CacheLevel),
}) {}

// ============================================================================
// Multi-Level Cache Service
// ============================================================================

export interface MultiLevelCacheService {
  readonly get: <T>(key: string) => Effect.Effect<T, CacheMissError>

  readonly set: <T>(
    key: string,
    value: T,
    options?: {
      ttl?: Duration.Duration
      level?: CacheLevel
      size?: number
    },
  ) => Effect.Effect<void>

  readonly has: (key: string) => Effect.Effect<boolean>

  readonly invalidate: (key: string) => Effect.Effect<void>

  readonly invalidatePattern: (pattern: string) => Effect.Effect<number>

  readonly clear: (level?: CacheLevel) => Effect.Effect<void>

  readonly getStats: (level?: CacheLevel) => Effect.Effect<CacheStats>

  readonly warmUp: <T>(keys: ReadonlyArray<string>, loader: (key: string) => Effect.Effect<T>) => Effect.Effect<void>

  readonly startEviction: (interval: Duration.Duration) => Effect.Effect<Fiber.Fiber<void>>
}

export const MultiLevelCacheService = Context.GenericTag<MultiLevelCacheService>('MultiLevelCacheService')

// ============================================================================
// LRU Cache Implementation
// ============================================================================

interface LRUNode<T> {
  key: string
  value: T
  size: number
  prev: LRUNode<T> | null
  next: LRUNode<T> | null
  timestamp: number
  accessCount: number
}

/**
 * Functional LRU Cache State
 */
interface LRUCacheState<T> {
  readonly cache: Map<string, LRUNode<T>>
  readonly head: LRUNode<T> | null
  readonly tail: LRUNode<T> | null
  readonly currentSize: number
  readonly maxSize: number
  readonly maxEntries: number
}

/**
 * Create a functional LRU Cache using Effect-TS Ref
 */
const createLRUCache = <T>(maxSize: number, maxEntries: number) => Effect.gen(function* () {
  const stateRef = yield* Ref.make<LRUCacheState<T>>({
    cache: new Map(),
    head: null,
    tail: null,
    currentSize: 0,
    maxSize,
    maxEntries,
  })

  const moveToHead = (state: LRUCacheState<T>, node: LRUNode<T>): LRUCacheState<T> => {
    const newState = removeNode(state, node)
    return addToHead(newState, node)
  }

  const addToHead = (state: LRUCacheState<T>, node: LRUNode<T>): LRUCacheState<T> => {
    node.prev = null
    node.next = state.head

    if (state.head) {
      state.head.prev = node
    }

    const newHead = node
    const newTail = state.tail || node

    return {
      ...state,
      head: newHead,
      tail: newTail,
    }
  }

  const removeNode = (state: LRUCacheState<T>, node: LRUNode<T>): LRUCacheState<T> => {
    let newHead = state.head
    let newTail = state.tail

    if (node.prev) {
      node.prev.next = node.next
    } else {
      newHead = node.next
    }

    if (node.next) {
      node.next.prev = node.prev
    } else {
      newTail = node.prev
    }

    return {
      ...state,
      head: newHead,
      tail: newTail,
    }
  }

  const evictTail = (state: LRUCacheState<T>): LRUCacheState<T> => {
    if (!state.tail) return state

    const key = state.tail.key
    const newState = removeNode(state, state.tail)
    const newCache = new Map(state.cache)
    newCache.delete(key)

    return {
      ...newState,
      cache: newCache,
      currentSize: newState.currentSize - state.tail.size,
    }
  }

  return {
    get: (key: string) => Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const node = state.cache.get(key)
      
      if (!node) return undefined

      // Update node access info
      node.accessCount++
      node.timestamp = Date.now()

      // Move to head (most recently used)
      const newState = moveToHead(state, node)
      yield* Ref.set(stateRef, newState)

      return node.value
    }),

    set: (key: string, value: T, size: number) => Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const existing = state.cache.get(key)

      if (existing) {
        // Update existing node
        const newCurrentSize = state.currentSize - existing.size + size
        existing.value = value
        existing.size = size
        existing.timestamp = Date.now()
        existing.accessCount++

        const newState = {
          ...moveToHead(state, existing),
          currentSize: newCurrentSize,
        }
        yield* Ref.set(stateRef, newState)
      } else {
        // Create new node
        const node: LRUNode<T> = {
          key,
          value,
          size,
          prev: null,
          next: null,
          timestamp: Date.now(),
          accessCount: 1,
        }

        const newCache = new Map(state.cache)
        newCache.set(key, node)

        let newState: LRUCacheState<T> = {
          ...addToHead(state, node),
          cache: newCache,
          currentSize: state.currentSize + size,
        }

        // Evict if necessary
        while ((newState.currentSize > newState.maxSize || newState.cache.size > newState.maxEntries) && newState.tail) {
          newState = evictTail(newState)
        }

        yield* Ref.set(stateRef, newState)
      }
    }),

    delete: (key: string) => Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const node = state.cache.get(key)
      
      if (!node) return false

      const newState = removeNode(state, node)
      const newCache = new Map(state.cache)
      newCache.delete(key)

      yield* Ref.set(stateRef, {
        ...newState,
        cache: newCache,
        currentSize: newState.currentSize - node.size,
      })

      return true
    }),

    clear: () => Effect.gen(function* () {
      yield* Ref.set(stateRef, {
        cache: new Map(),
        head: null,
        tail: null,
        currentSize: 0,
        maxSize,
        maxEntries,
      })
    }),

    getStats: () => Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return {
        currentSize: state.currentSize,
        currentEntries: state.cache.size,
        maxSize: state.maxSize,
        maxEntries: state.maxEntries,
      }
    }),
  }
})

// ============================================================================
// Multi-Level Cache Implementation
// ============================================================================

export const MultiLevelCacheServiceLive = Layer.effect(
  MultiLevelCacheService,
  Effect.gen(function* () {
    // Create cache levels using functional LRU cache
    const l1Cache = yield* createLRUCache<any>(1024 * 1024, 100) // 1MB, 100 entries
    const l2Cache = yield* createLRUCache<any>(10 * 1024 * 1024, 1000) // 10MB, 1000 entries
    const l3Cache = yield* createLRUCache<any>(100 * 1024 * 1024, 10000) // 100MB, 10000 entries

    const stats = yield* Ref.make({
      hits: 0,
      misses: 0,
      evictions: 0,
      totalAccessTime: 0,
      accessCount: 0,
    })

    const getCacheForLevel = (level: CacheLevel) => {
      switch (level) {
        case 'L1':
          return l1Cache
        case 'L2':
          return l2Cache
        case 'L3':
          return l3Cache
      }
    }

    const get = <T>(key: string) =>
      Effect.gen(function* () {
        const startTime = performance.now()

        // Try L1 cache first
        let value = yield* l1Cache.get(key)
        if (value !== undefined) {
          yield* Ref.update(stats, (s) => ({
            ...s,
            hits: s.hits + 1,
            totalAccessTime: s.totalAccessTime + (performance.now() - startTime),
            accessCount: s.accessCount + 1,
          }))

          yield* Metric.increment(cacheMetrics.hits.tagged('level', 'L1'))
          return value as T
        }

        // Try L2 cache
        value = yield* l2Cache.get(key)
        if (value !== undefined) {
          // Promote to L1
          yield* l1Cache.set(key, value, JSON.stringify(value).length)

          yield* Ref.update(stats, (s) => ({
            ...s,
            hits: s.hits + 1,
            totalAccessTime: s.totalAccessTime + (performance.now() - startTime),
            accessCount: s.accessCount + 1,
          }))

          yield* Metric.increment(cacheMetrics.hits.tagged('level', 'L2'))
          return value as T
        }

        // Try L3 cache
        value = yield* l3Cache.get(key)
        if (value !== undefined) {
          // Promote to L2 and L1
          const size = JSON.stringify(value).length
          yield* l2Cache.set(key, value, size)
          yield* l1Cache.set(key, value, size)

          yield* Ref.update(stats, (s) => ({
            ...s,
            hits: s.hits + 1,
            totalAccessTime: s.totalAccessTime + (performance.now() - startTime),
            accessCount: s.accessCount + 1,
          }))

          yield* Metric.increment(cacheMetrics.hits.tagged('level', 'L3'))
          return value as T
        }

        // Cache miss
        yield* Ref.update(stats, (s) => ({
          ...s,
          misses: s.misses + 1,
          totalAccessTime: s.totalAccessTime + (performance.now() - startTime),
          accessCount: s.accessCount + 1,
        }))

        yield* Metric.increment(cacheMetrics.misses)

        return yield* Effect.fail(new CacheMissError({ key }))
      })

    const set = <T>(
      key: string,
      value: T,
      options?: {
        ttl?: Duration.Duration
        level?: CacheLevel
        size?: number
      },
    ) =>
      Effect.gen(function* () {
        const size = options?.size ?? JSON.stringify(value).length
        const level = options?.level ?? 'L1'

        const cache = getCacheForLevel(level)
        yield* cache.set(key, value, size)

        // If TTL is set, schedule expiration
        if (options?.ttl) {
          yield* Effect.fork(
            Effect.delay(
              cache.delete(key),
              options.ttl,
            ),
          )
        }

        yield* Metric.increment(cacheMetrics.sets.tagged('level', level))
      })

    const has = (key: string) => 
      Effect.gen(function* () {
        const l1Value = yield* l1Cache.get(key)
        if (l1Value !== undefined) return true
        
        const l2Value = yield* l2Cache.get(key)
        if (l2Value !== undefined) return true
        
        const l3Value = yield* l3Cache.get(key)
        return l3Value !== undefined
      })

    const invalidate = (key: string) =>
      Effect.gen(function* () {
        yield* l1Cache.delete(key)
        yield* l2Cache.delete(key)
        yield* l3Cache.delete(key)
      })

    const invalidatePattern = (pattern: string) =>
      Effect.sync(() => {
        const regex = new RegExp(pattern)
        let count = 0

        // This would be more efficient with proper indexing
        // For now, simple implementation
        const caches = [l1Cache, l2Cache, l3Cache]

        // Note: LRUCache would need to expose keys() method
        // This is a simplified version
        return count
      })

    const clear = (level?: CacheLevel) =>
      Effect.gen(function* () {
        if (level) {
          yield* getCacheForLevel(level).clear()
        } else {
          yield* l1Cache.clear()
          yield* l2Cache.clear()
          yield* l3Cache.clear()
        }
      })

    const getStats = (level?: CacheLevel) =>
      Effect.gen(function* () {
        const s = yield* Ref.get(stats)

        let currentSize = 0
        let currentEntries = 0

        if (level) {
          const cache = getCacheForLevel(level)
          const cacheStats = yield* cache.getStats()
          currentSize = cacheStats.currentSize
          currentEntries = cacheStats.currentEntries
        } else {
          const l1Stats = yield* l1Cache.getStats()
          const l2Stats = yield* l2Cache.getStats()
          const l3Stats = yield* l3Cache.getStats()
          currentSize = l1Stats.currentSize + l2Stats.currentSize + l3Stats.currentSize
          currentEntries = l1Stats.currentEntries + l2Stats.currentEntries + l3Stats.currentEntries
        }

        return {
          hits: s.hits,
          misses: s.misses,
          evictions: s.evictions,
          currentSize,
          currentEntries,
          hitRate: s.accessCount > 0 ? s.hits / s.accessCount : 0,
          averageAccessTime: s.accessCount > 0 ? s.totalAccessTime / s.accessCount : 0,
        }
      })

    const warmUp = <T>(keys: ReadonlyArray<string>, loader: (key: string) => Effect.Effect<T>) =>
      Effect.gen(function* () {
        yield* Effect.forEach(
          keys,
          (key) =>
            Effect.gen(function* () {
              const value = yield* loader(key)
              yield* set(key, value)
            }),
          { concurrency: 10 },
        )
      })

    const startEviction = (interval: Duration.Duration) =>
      Effect.fork(
        Effect.repeat(
          Effect.gen(function* () {
            // Implement TTL-based eviction
            // This would check timestamps and remove expired entries
            yield* Ref.update(stats, (s) => ({
              ...s,
              evictions: s.evictions + 1,
            }))
          }),
          Schedule.fixed(interval),
        ),
      )

    return {
      get,
      set,
      has,
      invalidate,
      invalidatePattern,
      clear,
      getStats,
      warmUp,
      startEviction,
    }
  }),
)

// ============================================================================
// Cache Metrics
// ============================================================================

const cacheMetrics = {
  hits: Metric.counter('cache_hits', {
    description: 'Number of cache hits',
  }),

  misses: Metric.counter('cache_misses', {
    description: 'Number of cache misses',
  }),

  sets: Metric.counter('cache_sets', {
    description: 'Number of cache sets',
  }),

  evictions: Metric.counter('cache_evictions', {
    description: 'Number of cache evictions',
  }),

  size: Metric.gauge('cache_size_bytes', {
    description: 'Current cache size in bytes',
  }),
}

// ============================================================================
// Cache Decorators
// ============================================================================

export const cached =
  <R, E, A>(key: string | ((args: any) => string), ttl?: Duration.Duration) =>
  (effect: Effect.Effect<A, E, R>) =>
    Effect.gen(function* () {
      const cache = yield* MultiLevelCacheService
      const cacheKey = typeof key === 'string' ? key : key(null)

      const cached = yield* cache.get<A>(cacheKey).pipe(Effect.catchTag('CacheMissError', () => Effect.tap(effect, (value) => cache.set(cacheKey, value, { ttl }))))

      return cached
    })

export const memoize = <Args extends ReadonlyArray<any>, R, E, A>(fn: (...args: Args) => Effect.Effect<A, E, R>, keyFn: (args: Args) => string, ttl?: Duration.Duration) => {
  return (...args: Args) =>
    Effect.gen(function* () {
      const cache = yield* MultiLevelCacheService
      const key = keyFn(args)

      return yield* cache.get<A>(key).pipe(Effect.catchTag('CacheMissError', () => Effect.tap(fn(...args), (value) => cache.set(key, value, { ttl }))))
    })
}

// ============================================================================
// Specialized Caches
// ============================================================================

export const createQueryCache = (config?: Partial<CacheConfig>) =>
  Effect.gen(function* () {
    const cache = yield* MultiLevelCacheService

    return {
      get: <T>(queryId: string) => cache.get<T>(`query:${queryId}`),
      set: <T>(queryId: string, result: T) => cache.set(`query:${queryId}`, result, { ttl: Duration.seconds(5) }),
      invalidate: (queryId: string) => cache.invalidate(`query:${queryId}`),
      invalidateAll: () => cache.invalidatePattern('^query:'),
    }
  })

export const createEntityCache = () =>
  Effect.gen(function* () {
    const cache = yield* MultiLevelCacheService

    return {
      get: <T>(entityId: string) => cache.get<T>(`entity:${entityId}`),
      set: <T>(entityId: string, entity: T) => cache.set(`entity:${entityId}`, entity, { level: 'L1' }),
      invalidate: (entityId: string) => cache.invalidate(`entity:${entityId}`),
      warmUp: (entityIds: ReadonlyArray<string>, loader: (id: string) => Effect.Effect<any>) =>
        cache.warmUp(
          entityIds.map((id) => `entity:${id}`),
          (key) => loader(key.replace('entity:', '')),
        ),
    }
  })
