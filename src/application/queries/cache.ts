/**
 * Query Cache System
 * Provides intelligent caching for query results with TTL and invalidation strategies
 */

import { ComponentName } from '@/domain/entities/components'

import { QueryMetrics } from './builder'

/**
 * Cache entry with metadata
 */
interface CacheEntry<T = any> {
  data: T
  timestamp: number
  accessCount: number
  lastAccessed: number
  ttl: number
  size: number
  dependencies: Set<ComponentName>
}

/**
 * Cache eviction policies
 */
export enum EvictionPolicy {
  LRU = 'lru',
  LFU = 'lfu',
  TTL = 'ttl',
  FIFO = 'fifo',
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  maxSize: number
  defaultTtl: number
  evictionPolicy: EvictionPolicy
  enableMetrics: boolean
  autoCleanupInterval: number
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number
  misses: number
  evictions: number
  totalEntries: number
  memoryUsage: number
  hitRate: number
}

/**
 * Query result cache with intelligent invalidation
 */
export class QueryCache {
  private cache: Map<string, CacheEntry> = new Map()
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalEntries: 0,
    memoryUsage: 0,
    hitRate: 0,
  }

  private cleanupTimer?: NodeJS.Timeout | undefined

  constructor(private config: CacheConfig) {
    if (config.autoCleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup()
      }, config.autoCleanupInterval)
    }
  }

  /**
   * Get cached query result
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      this.updateHitRate()
      return undefined
    }

    const now = Date.now()
    
    // Check TTL expiration
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.stats.misses++
      this.stats.evictions++
      this.updateStats()
      return undefined
    }

    // Update access metadata
    entry.accessCount++
    entry.lastAccessed = now
    
    this.stats.hits++
    this.updateHitRate()
    
    return entry.data as T
  }

  /**
   * Cache query result with dependencies
   */
  set<T>(
    key: string, 
    data: T, 
    dependencies: ComponentName[] = [], 
    ttl?: number
  ): void {
    const now = Date.now()
    const entryTtl = ttl ?? this.config.defaultTtl
    const size = this.estimateSize(data)

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      ttl: entryTtl,
      size,
      dependencies: new Set(dependencies),
    }

    // Evict if necessary
    while (this.shouldEvict(size)) {
      this.evictOne()
    }

    this.cache.set(key, entry)
    this.updateStats()
  }

  /**
   * Invalidate cache entries that depend on modified components
   */
  invalidate(modifiedComponents: ComponentName[]): number {
    let invalidated = 0
    const modifiedSet = new Set(modifiedComponents)

    for (const [key, entry] of this.cache.entries()) {
      // Check if any dependencies were modified
      const hasIntersection = [...entry.dependencies].some(dep => modifiedSet.has(dep))
      
      if (hasIntersection) {
        this.cache.delete(key)
        invalidated++
      }
    }

    this.updateStats()
    return invalidated
  }

  /**
   * Invalidate specific cache entry
   */
  invalidateKey(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.updateStats()
    }
    return deleted
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
    this.stats.evictions += this.stats.totalEntries
    this.updateStats()
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.stats.evictions += cleaned
      this.updateStats()
    }

    return cleaned
  }

  /**
   * Get cache entries for debugging
   */
  getEntries(): Array<{ key: string; entry: CacheEntry }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      entry: { ...entry, dependencies: Array.from(entry.dependencies) },
    }))
  }

  private shouldEvict(newEntrySize: number): boolean {
    return this.stats.memoryUsage + newEntrySize > this.config.maxSize
  }

  private evictOne(): void {
    if (this.cache.size === 0) return

    let keyToEvict: string

    switch (this.config.evictionPolicy) {
      case EvictionPolicy.LRU:
        keyToEvict = this.findLRUKey()
        break
      case EvictionPolicy.LFU:
        keyToEvict = this.findLFUKey()
        break
      case EvictionPolicy.TTL:
        keyToEvict = this.findOldestTTLKey()
        break
      case EvictionPolicy.FIFO:
      default:
        const firstKey = this.cache.keys().next().value
        keyToEvict = firstKey ?? ''
        break
    }

    if (keyToEvict) {
      this.cache.delete(keyToEvict)
    }
    this.stats.evictions++
  }

  private findLRUKey(): string {
    let oldestTime = Infinity
    let lruKey = ''

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed
        lruKey = key
      }
    }

    return lruKey
  }

  private findLFUKey(): string {
    let lowestCount = Infinity
    let lfuKey = ''

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < lowestCount) {
        lowestCount = entry.accessCount
        lfuKey = key
      }
    }

    return lfuKey
  }

  private findOldestTTLKey(): string {
    let oldestTimestamp = Infinity
    let oldestKey = ''

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp
        oldestKey = key
      }
    }

    return oldestKey
  }

  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2 // Rough estimation
    } catch {
      return 1024 // Default size for non-serializable data
    }
  }

  private updateStats(): void {
    this.stats.totalEntries = this.cache.size
    this.stats.memoryUsage = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.size, 0)
    this.updateHitRate()
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses
    this.stats.hitRate = total === 0 ? 0 : this.stats.hits / total
  }

  /**
   * Dispose cache and cleanup resources
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
    this.clear()
  }
}

/**
 * Global query cache instance
 */
export const globalQueryCache = new QueryCache({
  maxSize: 50 * 1024 * 1024, // 50MB
  defaultTtl: 30000, // 30 seconds
  evictionPolicy: EvictionPolicy.LRU,
  enableMetrics: true,
  autoCleanupInterval: 10000, // 10 seconds
})

/**
 * Query cache key generation
 */
export class CacheKeyGenerator {
  /**
   * Generate cache key for component-based query
   */
  static forComponents(
    required: ReadonlyArray<ComponentName>,
    forbidden: ReadonlyArray<ComponentName> = [],
    predicateHash?: string
  ): string {
    const requiredStr = [...required].sort().join(',')
    const forbiddenStr = [...forbidden].sort().join(',')
    const predicateStr = predicateHash ? `|pred:${predicateHash}` : ''
    
    return `comp:${requiredStr}|!${forbiddenStr}${predicateStr}`
  }

  /**
   * Generate cache key for entity list query
   */
  static forEntityList(entityIds: ReadonlyArray<string>): string {
    return `entities:${[...entityIds].sort().join(',')}`
  }

  /**
   * Generate hash for predicate function
   */
  static hashPredicate(predicate: Function): string {
    const funcStr = predicate.toString()
    return this.simpleHash(funcStr).toString(36)
  }

  private static simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return hash
  }
}

/**
 * Cache-aware query metrics
 */
export interface CachedQueryMetrics extends QueryMetrics {
  cacheKey?: string
  cacheHit: boolean
  cacheInvalidations: number
}

/**
 * Query result with caching metadata
 */
export interface CachedQueryResult<T> {
  data: T
  metrics: CachedQueryMetrics
  fromCache: boolean
  cacheKey?: string
}