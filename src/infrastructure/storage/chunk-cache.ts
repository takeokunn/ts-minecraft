import { Effect, Layer, Ref, Option } from 'effect'

import type { Chunk } from '@domain/entities/components/world/chunk'
import { ObjectPool } from '@infrastructure/performance/object-pool'
import { ChunkManager } from '@domain/services/chunk-manager.service'
import { toChunkX, toChunkZ } from '@domain/value-objects/common'

// --- Configuration ---

const CONFIG = {
  MAX_CACHE_SIZE: 512, // Maximum cached chunks
  CACHE_LEVELS: 4, // Multi-level cache hierarchy
  PREFETCH_RADIUS: 3, // Chunks to prefetch around player
  UNLOAD_THRESHOLD: 5000, // Time before unloading unused chunks (ms)
  COMPRESSION_ENABLED: true, // Enable chunk compression
  WORKER_ENABLED: true, // Use workers for chunk operations
} as const

// --- Advanced Chunk Cache Types ---

/**
 * Chunk cache entry with metadata
 */
export interface ChunkCacheEntry {
  readonly chunk: Chunk
  readonly compressedData?: Uint8Array
  lastAccessed: number
  accessCount: number
  isDirty: boolean
  isLoading: boolean
  loadPromise?: Promise<Chunk>
  readonly priority: number
  readonly size: number
}

/**
 * LRU Cache Node for double-linked list
 */
interface CacheNode {
  key: string
  entry: ChunkCacheEntry
  prev: CacheNode | null
  next: CacheNode | null
}

/**
 * Multi-level cache structure
 */
export interface ChunkCacheState {
  readonly l1Cache: Map<string, CacheNode> // Hot cache - in memory
  readonly l2Cache: Map<string, ChunkCacheEntry> // Warm cache - compressed
  readonly l3Cache: Map<string, string> // Cold cache - serialized
  readonly lruHead: CacheNode | null
  readonly lruTail: CacheNode | null
  readonly loadingChunks: Set<string>
  readonly dirtyChunks: Set<string>
  readonly prefetchQueue: string[]
  readonly metrics: {
    l1Hits: number
    l2Hits: number
    l3Hits: number
    misses: number
    totalRequests: number
    compressionRatio: number
    memoryUsage: number
  }
}

/**
 * Chunk operation priority levels
 */
export enum ChunkPriority {
  CRITICAL = 0, // Player's current chunk
  HIGH = 1, // Immediately surrounding chunks
  NORMAL = 2, // Within render distance
  LOW = 3, // Prefetch chunks
  BACKGROUND = 4, // Distant chunks
}

// --- Memory Pooling ---

const cacheNodePool = new ObjectPool<CacheNode>(
  () => ({
    key: '',
    entry: {
      chunk: {
        chunkX: 0,
        chunkZ: 0,
        blocks: new Array(16 * 16 * 256).fill('air'),
        entities: [],
        blockEntities: [],
        biome: 'plains',
        isLoaded: false,
        lightData: undefined,
      },
      lastAccessed: 0,
      accessCount: 0,
      isDirty: false,
      isLoading: false,
      priority: ChunkPriority.NORMAL,
      size: 0,
    },
    prev: null,
    next: null,
  }),
  (node: CacheNode) => {
    node.key = ''
    node.entry.lastAccessed = 0
    node.entry.accessCount = 0
    node.entry.isDirty = false
    node.entry.isLoading = false
    node.entry.loadPromise = undefined
    node.prev = null
    node.next = null
    return node
  },
  CONFIG.MAX_CACHE_SIZE,
)

// --- Compression Utilities ---

/**
 * Compress chunk data using Run-Length Encoding
 */
const compressChunk = (chunk: Chunk): Uint8Array => {
  if (!CONFIG.COMPRESSION_ENABLED) {
    return new TextEncoder().encode(JSON.stringify(chunk))
  }

  // Simple RLE compression for blocks
  const compressed: number[] = []
  let current = chunk.blocks[0]
  let count = 1

  // Convert block types to numbers for better compression
  const blockTypeMap: { [key: string]: number } = {
    air: 0,
    stone: 1,
    dirt: 2,
    grass: 3,
    cobblestone: 4,
    wood: 5,
    sand: 6,
    gravel: 7,
    water: 8,
    lava: 9,
  }

  for (let i = 1; i < chunk.blocks.length; i++) {
    if (chunk.blocks[i] === current && count < 255) {
      count++
    } else {
      compressed.push(blockTypeMap[current as string] || 0, count)
      current = chunk.blocks[i]
      count = 1
    }
  }
  compressed.push(blockTypeMap[current as string] || 0, count)

  return new Uint8Array(compressed)
}

/**
 * Decompress chunk data
 */
const decompressChunk = (data: Uint8Array, chunkX: number, chunkZ: number): Chunk => {
  if (!CONFIG.COMPRESSION_ENABLED) {
    return JSON.parse(new TextDecoder().decode(data))
  }

  const blockTypes = ['air', 'stone', 'dirt', 'grass', 'cobblestone', 'wood', 'sand', 'gravel', 'water', 'lava']
  const blocks: string[] = []

  for (let i = 0; i < data.length; i += 2) {
    const blockType = blockTypes[data[i]] || 'air'
    const count = data[i + 1]
    for (let j = 0; j < count; j++) {
      blocks.push(blockType)
    }
  }

  return {
    chunkX: toChunkX(chunkX),
    chunkZ: toChunkZ(chunkZ),
    blocks,
    entities: [],
    blockEntities: [],
    biome: 'plains',
    isLoaded: true,
    lightData: undefined,
  }
}

// --- Cache Management Functions ---

/**
 * Create new cache entry
 */
const createCacheEntry = (chunk: Chunk, priority: ChunkPriority): ChunkCacheEntry => {
  const compressedData = CONFIG.COMPRESSION_ENABLED ? compressChunk(chunk) : undefined
  const size = compressedData ? compressedData.length : JSON.stringify(chunk).length

  return {
    chunk,
    compressedData,
    lastAccessed: Date.now(),
    accessCount: 1,
    isDirty: false,
    isLoading: false,
    priority,
    size,
  }
}

/**
 * Update LRU list when accessing a node
 */
const moveToFront = (state: ChunkCacheState, node: CacheNode): ChunkCacheState => {
  if (node === state.lruHead) return state

  // Calculate new tail before mutation
  const newTail = node === state.lruTail ? node.prev : state.lruTail

  // Remove node from current position
  if (node.prev) node.prev.next = node.next
  if (node.next) node.next.prev = node.prev

  // Move to front
  node.prev = null
  node.next = state.lruHead
  if (state.lruHead) state.lruHead.prev = node

  const newHead = node

  return {
    ...state,
    lruHead: newHead,
    lruTail: newTail,
  }
}

/**
 * Remove LRU node
 */
const removeLRU = (state: ChunkCacheState): [ChunkCacheState, CacheNode | null] => {
  if (!state.lruTail) return [state, null]

  const nodeToRemove = state.lruTail
  const newTail = nodeToRemove.prev

  if (newTail) {
    newTail.next = null
  } else {
    // List becomes empty
    return [{ ...state, lruHead: null, lruTail: null }, nodeToRemove]
  }

  return [{ ...state, lruTail: newTail }, nodeToRemove]
}

/**
 * Add chunk to L1 cache
 */
const addToL1Cache = (state: ChunkCacheState, key: string, entry: ChunkCacheEntry): ChunkCacheState => {
  const node = cacheNodePool.acquire()
  node.key = key
  node.entry = entry

  let newState = state

  // Check if cache is full
  if (state.l1Cache.size >= CONFIG.MAX_CACHE_SIZE) {
    const [stateAfterRemoval, removedNode] = removeLRU(state)
    newState = stateAfterRemoval

    if (removedNode) {
      // Move to L2 cache
      const compressedEntry = {
        ...removedNode.entry,
        compressedData: compressChunk(removedNode.entry.chunk),
      }
      const newL2Cache = new Map(newState.l2Cache)
      newL2Cache.set(removedNode.key, compressedEntry)

      const newL1Cache = new Map(newState.l1Cache)
      newL1Cache.delete(removedNode.key)

      newState = {
        ...newState,
        l1Cache: newL1Cache,
        l2Cache: newL2Cache,
      }
      cacheNodePool.release(removedNode)
    }
  }

  // Add new node to front
  node.next = newState.lruHead
  if (newState.lruHead) newState.lruHead.prev = node
  const newTail = newState.lruTail || node

  const newL1Cache = new Map(newState.l1Cache)
  newL1Cache.set(key, node)

  return {
    ...newState,
    l1Cache: newL1Cache,
    lruHead: node,
    lruTail: newTail,
  }
}

/**
 * Get chunk from cache hierarchy
 */
const getFromCache = (state: ChunkCacheState, key: string): [ChunkCacheState, ChunkCacheEntry | null, number] => {
  // Try L1 cache
  const l1Node = state.l1Cache.get(key)
  if (l1Node) {
    const updatedEntry = {
      ...l1Node.entry,
      lastAccessed: Date.now(),
      accessCount: l1Node.entry.accessCount + 1,
    }
    l1Node.entry = updatedEntry

    const newState = moveToFront(state, l1Node)
    return [
      {
        ...newState,
        metrics: {
          ...newState.metrics,
          l1Hits: newState.metrics.l1Hits + 1,
          totalRequests: newState.metrics.totalRequests + 1,
        },
      },
      updatedEntry,
      1,
    ]
  }

  // Try L2 cache
  const l2Entry = state.l2Cache.get(key)
  if (l2Entry) {
    // Decompress and move to L1
    const chunk = l2Entry.compressedData ? decompressChunk(l2Entry.compressedData, 0, 0) : l2Entry.chunk

    const newEntry = {
      ...l2Entry,
      chunk,
      lastAccessed: Date.now(),
      accessCount: l2Entry.accessCount + 1,
    }

    const newL2Cache = new Map(state.l2Cache)
    newL2Cache.delete(key)

    const newState = addToL1Cache(
      {
        ...state,
        l2Cache: newL2Cache,
      },
      key,
      newEntry,
    )

    return [
      {
        ...newState,
        metrics: {
          ...newState.metrics,
          l2Hits: newState.metrics.l2Hits + 1,
          totalRequests: newState.metrics.totalRequests + 1,
        },
      },
      newEntry,
      2,
    ]
  }

  // Try L3 cache
  const l3Data = state.l3Cache.get(key)
  if (l3Data) {
    const chunk = JSON.parse(l3Data) as Chunk
    const newEntry = createCacheEntry(chunk, ChunkPriority.NORMAL)

    const newL3Cache = new Map(state.l3Cache)
    newL3Cache.delete(key)

    const newState = addToL1Cache(
      {
        ...state,
        l3Cache: newL3Cache,
      },
      key,
      newEntry,
    )

    return [
      {
        ...newState,
        metrics: {
          ...newState.metrics,
          l3Hits: newState.metrics.l3Hits + 1,
          totalRequests: newState.metrics.totalRequests + 1,
        },
      },
      newEntry,
      3,
    ]
  }

  // Cache miss
  return [
    {
      ...state,
      metrics: {
        ...state.metrics,
        misses: state.metrics.misses + 1,
        totalRequests: state.metrics.totalRequests + 1,
      },
    },
    null,
    0,
  ]
}

/**
 * Calculate memory usage
 */
const calculateMemoryUsage = (state: ChunkCacheState): number => {
  let totalSize = 0

  for (const node of state.l1Cache.values()) {
    totalSize += node.entry.size
  }

  for (const entry of state.l2Cache.values()) {
    totalSize += entry.compressedData?.length || entry.size
  }

  for (const data of state.l3Cache.values()) {
    totalSize += data.length
  }

  return totalSize
}

// --- Pure Cache Operations ---

const putChunkPure = (state: ChunkCacheState, key: string, chunk: Chunk, priority: ChunkPriority = ChunkPriority.NORMAL): ChunkCacheState => {
  const entry = createCacheEntry(chunk, priority)
  return addToL1Cache(state, key, entry)
}

const getChunkPure = (state: ChunkCacheState, key: string): [ChunkCacheState, Chunk | null] => {
  const [newState, entry] = getFromCache(state, key)
  return [newState, entry?.chunk || null]
}

const removeChunkPure = (state: ChunkCacheState, key: string): ChunkCacheState => {
  const newL1Cache = new Map(state.l1Cache)
  const newL2Cache = new Map(state.l2Cache)
  const newL3Cache = new Map(state.l3Cache)

  const l1Node = newL1Cache.get(key)
  if (l1Node) {
    // Update LRU list
    if (l1Node.prev) l1Node.prev.next = l1Node.next
    if (l1Node.next) l1Node.next.prev = l1Node.prev

    let newHead = state.lruHead
    let newTail = state.lruTail

    if (l1Node === state.lruHead) newHead = l1Node.next
    if (l1Node === state.lruTail) newTail = l1Node.prev

    newL1Cache.delete(key)
    cacheNodePool.release(l1Node)

    return {
      ...state,
      l1Cache: newL1Cache,
      l2Cache: newL2Cache,
      l3Cache: newL3Cache,
      lruHead: newHead,
      lruTail: newTail,
    }
  }

  newL2Cache.delete(key)
  newL3Cache.delete(key)

  return {
    ...state,
    l1Cache: newL1Cache,
    l2Cache: newL2Cache,
    l3Cache: newL3Cache,
  }
}

const optimizeCachePure = (state: ChunkCacheState): ChunkCacheState => {
  const currentTime = Date.now()
  const newDirtyChunks = new Set(state.dirtyChunks)

  // Clean up old entries
  const newL2Cache = new Map<string, ChunkCacheEntry>()
  for (const [key, entry] of state.l2Cache) {
    if (currentTime - entry.lastAccessed < CONFIG.UNLOAD_THRESHOLD) {
      newL2Cache.set(key, entry)
    } else if (entry.isDirty) {
      // Keep dirty chunks
      newL2Cache.set(key, entry)
    }
  }

  const newL3Cache = new Map<string, string>()
  for (const [key, data] of state.l3Cache) {
    // Keep L3 cache for longer
    newL3Cache.set(key, data)
  }

  const memoryUsage = calculateMemoryUsage(state)

  return {
    ...state,
    l2Cache: newL2Cache,
    l3Cache: newL3Cache,
    dirtyChunks: newDirtyChunks,
    metrics: {
      ...state.metrics,
      memoryUsage,
    },
  }
}

// --- Effect Service ---

export const ChunkCacheLive = Layer.effect(
  ChunkManager,
  Effect.gen(function* (_) {
    const initialState: ChunkCacheState = {
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
    }

    const cacheRef = yield* _(Ref.make(initialState))

    // Auto-optimization
    const startOptimization = () =>
      Effect.gen(function* () {
        while (true) {
          yield* Effect.sleep(30000) // Optimize every 30 seconds
          yield* Ref.update(cacheRef, optimizeCachePure)
        }
      }).pipe(Effect.fork)

    yield* startOptimization()

    return {
      getChunk: (chunkX: number, chunkZ: number) =>
        Effect.gen(function* () {
          const key = `${chunkX},${chunkZ}`
          const state = yield* Ref.get(cacheRef)
          const [newState, chunk] = getChunkPure(state, key)
          yield* Ref.set(cacheRef, newState)
          return Option.fromNullable(chunk)
        }),

      setChunk: (chunk: Chunk, priority: ChunkPriority = ChunkPriority.NORMAL) =>
        Effect.gen(function* () {
          const key = `${chunk.chunkX},${chunk.chunkZ}`
          yield* Ref.update(cacheRef, (state) => putChunkPure(state, key, chunk, priority))
        }),

      removeChunk: (chunkX: number, chunkZ: number) =>
        Effect.gen(function* () {
          const key = `${chunkX},${chunkZ}`
          yield* Ref.update(cacheRef, (state) => removeChunkPure(state, key))
        }),

      preloadChunks: (centerX: number, centerZ: number, radius: number) =>
        Effect.gen(function* () {
          const chunks: Array<{ x: number; z: number }> = []

          for (let x = centerX - radius; x <= centerX + radius; x++) {
            for (let z = centerZ - radius; z <= centerZ + radius; z++) {
              const distance = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2)
              if (distance <= radius) {
                chunks.push({ x, z })
              }
            }
          }

          // Sort by distance for priority loading
          chunks.sort((a, b) => {
            const distA = Math.sqrt((a.x - centerX) ** 2 + (a.z - centerZ) ** 2)
            const distB = Math.sqrt((b.x - centerX) ** 2 + (b.z - centerZ) ** 2)
            return distA - distB
          })

          return chunks.map(({ x, z }) => ({ chunkX: x, chunkZ: z }))
        }),

      getCacheMetrics: () =>
        Ref.get(cacheRef).pipe(
          Effect.map((state) => ({
            ...state.metrics,
            hitRate: state.metrics.totalRequests > 0 ? ((state.metrics.l1Hits + state.metrics.l2Hits + state.metrics.l3Hits) / state.metrics.totalRequests) * 100 : 0,
            l1Size: state.l1Cache.size,
            l2Size: state.l2Cache.size,
            l3Size: state.l3Cache.size,
          })),
        ),

      optimize: () => Ref.update(cacheRef, optimizeCachePure),

      clear: () =>
        Effect.gen(function* () {
          const state = yield* Ref.get(cacheRef)
          // Release all pooled nodes
          for (const node of state.l1Cache.values()) {
            cacheNodePool.release(node)
          }
          yield* Ref.set(cacheRef, initialState)
        }),
    }
  }),
)

// Export types and configuration
export type { ChunkCacheState, ChunkCacheEntry }
export { ChunkPriority, CONFIG as ChunkCacheConfig }
