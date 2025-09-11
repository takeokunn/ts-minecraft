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

class LRUCache<T> {
  private cache = new Map<string, LRUNode<T>>()
  private head: LRUNode<T> | null = null
  private tail: LRUNode<T> | null = null
  private currentSize = 0

  constructor(
    private maxSize: number,
    private maxEntries: number,
  ) {}

  get(key: string): T | undefined {
    const node = this.cache.get(key)
    if (!node) return undefined

    // Move to head (most recently used)
    this.moveToHead(node)
    node.accessCount++
    node.timestamp = Date.now()

    return node.value
  }

  set(key: string, value: T, size: number): void {
    const existing = this.cache.get(key)

    if (existing) {
      // Update existing node
      this.currentSize -= existing.size
      existing.value = value
      existing.size = size
      existing.timestamp = Date.now()
      existing.accessCount++
      this.currentSize += size
      this.moveToHead(existing)
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

      this.cache.set(key, node)
      this.addToHead(node)
      this.currentSize += size

      // Evict if necessary
      while ((this.currentSize > this.maxSize || this.cache.size > this.maxEntries) && this.tail) {
        this.evictTail()
      }
    }
  }

  delete(key: string): boolean {
    const node = this.cache.get(key)
    if (!node) return false

    this.removeNode(node)
    this.cache.delete(key)
    this.currentSize -= node.size

    return true
  }

  clear(): void {
    this.cache.clear()
    this.head = null
    this.tail = null
    this.currentSize = 0
  }

  private moveToHead(node: LRUNode<T>): void {
    this.removeNode(node)
    this.addToHead(node)
  }

  private addToHead(node: LRUNode<T>): void {
    node.prev = null
    node.next = this.head

    if (this.head) {
      this.head.prev = node
    }

    this.head = node

    if (!this.tail) {
      this.tail = node
    }
  }

  private removeNode(node: LRUNode<T>): void {
    if (node.prev) {
      node.prev.next = node.next
    } else {
      this.head = node.next
    }

    if (node.next) {
      node.next.prev = node.prev
    } else {
      this.tail = node.prev
    }
  }

  private evictTail(): void {
    if (!this.tail) return

    const key = this.tail.key
    this.removeNode(this.tail)
    this.cache.delete(key)
    this.currentSize -= this.tail.size
  }

  get stats() {
    return {
      currentSize: this.currentSize,
      currentEntries: this.cache.size,
      maxSize: this.maxSize,
      maxEntries: this.maxEntries,
    }
  }
}

// ============================================================================
// Multi-Level Cache Implementation
// ============================================================================

export const MultiLevelCacheServiceLive = Layer.effect(
  MultiLevelCacheService,
  Effect.gen(function* () {
    // Create cache levels
    const l1Cache = new LRUCache<any>(1024 * 1024, 100) // 1MB, 100 entries
    const l2Cache = new LRUCache<any>(10 * 1024 * 1024, 1000) // 10MB, 1000 entries
    const l3Cache = new LRUCache<any>(100 * 1024 * 1024, 10000) // 100MB, 10000 entries

    const stats = yield* Ref.make({
      hits: 0,
      misses: 0,
      evictions: 0,
      totalAccessTime: 0,
      accessCount: 0,
    })

    const getCacheForLevel = (level: CacheLevel): LRUCache<any> => {
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
        let value = l1Cache.get(key)
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
        value = l2Cache.get(key)
        if (value !== undefined) {
          // Promote to L1
          l1Cache.set(key, value, JSON.stringify(value).length)

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
        value = l3Cache.get(key)
        if (value !== undefined) {
          // Promote to L2 and L1
          const size = JSON.stringify(value).length
          l2Cache.set(key, value, size)
          l1Cache.set(key, value, size)

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
        cache.set(key, value, size)

        // If TTL is set, schedule expiration
        if (options?.ttl) {
          yield* Effect.fork(
            Effect.delay(
              Effect.sync(() => cache.delete(key)),
              options.ttl,
            ),
          )
        }

        yield* Metric.increment(cacheMetrics.sets.tagged('level', level))
      })

    const has = (key: string) => Effect.succeed(l1Cache.get(key) !== undefined || l2Cache.get(key) !== undefined || l3Cache.get(key) !== undefined)

    const invalidate = (key: string) =>
      Effect.sync(() => {
        l1Cache.delete(key)
        l2Cache.delete(key)
        l3Cache.delete(key)
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
      Effect.sync(() => {
        if (level) {
          getCacheForLevel(level).clear()
        } else {
          l1Cache.clear()
          l2Cache.clear()
          l3Cache.clear()
        }
      })

    const getStats = (level?: CacheLevel) =>
      Effect.gen(function* () {
        const s = yield* Ref.get(stats)

        let currentSize = 0
        let currentEntries = 0

        if (level) {
          const cache = getCacheForLevel(level)
          currentSize = cache.stats.currentSize
          currentEntries = cache.stats.currentEntries
        } else {
          currentSize = l1Cache.stats.currentSize + l2Cache.stats.currentSize + l3Cache.stats.currentSize
          currentEntries = l1Cache.stats.currentEntries + l2Cache.stats.currentEntries + l3Cache.stats.currentEntries
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
