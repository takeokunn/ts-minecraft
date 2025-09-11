/**
 * Chunk Repository Implementation - Manages chunk data storage and retrieval
 *
 * This repository handles chunk-specific operations including chunk loading,
 * saving, generation status tracking, and spatial indexing. It provides
 * efficient access patterns for world streaming and terrain management.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as HashMap from 'effect/HashMap'
import * as Ref from 'effect/Ref'
import * as Option from 'effect/Option'
import * as Array from 'effect/Array'

import { Chunk } from '/entities/components/world/chunk'
import { BlockType } from '/value-objects/block-type.vo'
import { ChunkCoordinate } from '/value-objects/coordinates/chunk-coordinate.vo'

/**
 * Chunk metadata for tracking generation status and performance metrics
 */
export interface ChunkMetadata {
  readonly coordinate: ChunkCoordinate
  readonly generatedAt: number
  readonly lastModified: number
  readonly lastAccessed: number
  readonly blockCount: number
  readonly nonAirBlockCount: number
  readonly generationStage: 'empty' | 'terrain' | 'features' | 'decorations' | 'complete'
  readonly isDirty: boolean // Has unsaved changes
  readonly memorySize: number // Estimated memory usage in bytes
  readonly version: number // For optimistic locking
}

/**
 * Chunk query options for filtering and pagination
 */
export interface ChunkQueryOptions {
  readonly center?: ChunkCoordinate
  readonly radius?: number
  readonly generationStage?: ChunkMetadata['generationStage']
  readonly onlyDirty?: boolean
  readonly sortBy?: 'lastAccessed' | 'lastModified' | 'generatedAt' | 'distance'
  readonly limit?: number
  readonly offset?: number
}

/**
 * Chunk statistics for performance monitoring
 */
export interface ChunkStats {
  readonly totalChunks: number
  readonly loadedChunks: number
  readonly dirtyChunks: number
  readonly memoryUsage: number
  readonly averageBlockDensity: number
  readonly chunksByStage: Record<ChunkMetadata['generationStage'], number>
}

/**
 * Chunk change tracking for synchronization and undo systems
 */
export interface ChunkChange {
  readonly chunkCoordinate: ChunkCoordinate
  readonly blockIndex: number
  readonly previousBlockType: BlockType
  readonly newBlockType: BlockType
  readonly timestamp: number
  readonly playerId?: string
}

/**
 * Chunk Repository interface
 */
export interface IChunkRepository {
  // Basic chunk operations
  readonly getChunk: (coordinate: ChunkCoordinate) => Effect.Effect<Option.Option<Chunk>, never, never>
  readonly setChunk: (chunk: Chunk) => Effect.Effect<void, never, never>
  readonly removeChunk: (coordinate: ChunkCoordinate) => Effect.Effect<boolean, never, never>
  readonly hasChunk: (coordinate: ChunkCoordinate) => Effect.Effect<boolean, never, never>

  // Chunk metadata operations
  readonly getChunkMetadata: (coordinate: ChunkCoordinate) => Effect.Effect<Option.Option<ChunkMetadata>, never, never>
  readonly updateChunkMetadata: (coordinate: ChunkCoordinate, updater: (metadata: ChunkMetadata) => ChunkMetadata) => Effect.Effect<boolean, never, never>
  readonly markChunkDirty: (coordinate: ChunkCoordinate) => Effect.Effect<void, never, never>
  readonly markChunkClean: (coordinate: ChunkCoordinate) => Effect.Effect<void, never, never>

  // Bulk operations
  readonly getChunks: (coordinates: ReadonlyArray<ChunkCoordinate>) => Effect.Effect<HashMap.HashMap<string, Chunk>, never, never>
  readonly setChunks: (chunks: ReadonlyArray<Chunk>) => Effect.Effect<void, never, never>
  readonly removeChunks: (coordinates: ReadonlyArray<ChunkCoordinate>) => Effect.Effect<number, never, never>

  // Spatial queries
  readonly getChunksInRadius: (center: ChunkCoordinate, radius: number) => Effect.Effect<ReadonlyArray<Chunk>, never, never>
  readonly getChunksInArea: (minX: number, minZ: number, maxX: number, maxZ: number) => Effect.Effect<ReadonlyArray<Chunk>, never, never>
  readonly findChunks: (options: ChunkQueryOptions) => Effect.Effect<ReadonlyArray<Chunk>, never, never>

  // Block-level operations
  readonly getBlock: (chunkCoord: ChunkCoordinate, blockIndex: number) => Effect.Effect<Option.Option<BlockType>, never, never>
  readonly setBlock: (chunkCoord: ChunkCoordinate, blockIndex: number, blockType: BlockType) => Effect.Effect<boolean, never, never>
  readonly updateBlocks: (chunkCoord: ChunkCoordinate, updates: ReadonlyArray<{ index: number; blockType: BlockType }>) => Effect.Effect<boolean, never, never>

  // Change tracking
  readonly getChunkChanges: (chunkCoord?: ChunkCoordinate, since?: number) => Effect.Effect<ReadonlyArray<ChunkChange>, never, never>
  readonly clearChangeHistory: (before?: number) => Effect.Effect<number, never, never>

  // Generation status management
  readonly setGenerationStage: (coordinate: ChunkCoordinate, stage: ChunkMetadata['generationStage']) => Effect.Effect<void, never, never>
  readonly getChunksByGenerationStage: (stage: ChunkMetadata['generationStage']) => Effect.Effect<ReadonlyArray<ChunkCoordinate>, never, never>
  readonly getIncompleteChunks: () => Effect.Effect<ReadonlyArray<ChunkCoordinate>, never, never>

  // Performance and maintenance
  readonly getChunkStats: () => Effect.Effect<ChunkStats, never, never>
  readonly unloadOldChunks: (maxAge: number, maxCount?: number) => Effect.Effect<number, never, never>
  readonly compactStorage: () => Effect.Effect<void, never, never>
  readonly validateChunkData: (coordinate: ChunkCoordinate) => Effect.Effect<boolean, never, never>
}

export class ChunkRepository extends Context.GenericTag('ChunkRepository')<ChunkRepository, IChunkRepository>() {}

/**
 * Chunk repository state
 */
interface ChunkRepositoryState {
  readonly chunks: HashMap.HashMap<string, Chunk>
  readonly metadata: HashMap.HashMap<string, ChunkMetadata>
  readonly changes: Array<ChunkChange>
  readonly maxChangeHistory: number
  readonly spatialIndex: HashMap.HashMap<string, ReadonlySet<string>> // Region -> Chunk keys for spatial queries
}

/**
 * Helper functions
 */
const chunkKey = (coordinate: ChunkCoordinate): string => `${coordinate.x},${coordinate.z}`

const regionKey = (coordinate: ChunkCoordinate, regionSize: number = 8): string => `${Math.floor(coordinate.x / regionSize)},${Math.floor(coordinate.z / regionSize)}`

const parseChunkKey = (key: string): ChunkCoordinate => {
  const [x, z] = key.split(',').map(Number)
  return { x, z }
}

const calculateDistance = (a: ChunkCoordinate, b: ChunkCoordinate): number => Math.sqrt((a.x - b.x) ** 2 + (a.z - b.z) ** 2)

const estimateChunkMemorySize = (chunk: Chunk): number => {
  // Rough estimation: blocks array + metadata
  const blocksSize = chunk.blocks.length * 4 // Assuming 4 bytes per block type
  const metadataSize = 200 // Estimated overhead
  return blocksSize + metadataSize
}

/**
 * Chunk Repository Implementation
 */
export class ChunkRepositoryImpl implements IChunkRepository {
  constructor(private readonly stateRef: Ref.Ref<ChunkRepositoryState>) {}

  readonly getChunk = (coordinate: ChunkCoordinate): Effect.Effect<Option.Option<Chunk>, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        const key = chunkKey(coordinate)
        const chunk = HashMap.get(state.chunks, key)

        // Update last accessed time
        if (Option.isSome(chunk)) {
          yield* _(
            this.updateChunkMetadata(coordinate, (metadata) => ({
              ...metadata,
              lastAccessed: Date.now(),
            })),
          )
        }

        return chunk
      }.bind(this),
    )

  readonly setChunk = (chunk: Chunk): Effect.Effect<void, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        const coordinate = { x: chunk.chunkX, z: chunk.chunkZ }
        const key = chunkKey(coordinate)
        const now = Date.now()

        // Calculate chunk statistics
        const nonAirBlockCount = chunk.blocks.filter((block) => block !== 'air').length
        const memorySize = estimateChunkMemorySize(chunk)

        // Get existing metadata or create new
        const existingMetadata = HashMap.get(state.metadata, key)
        const metadata: ChunkMetadata = Option.match(existingMetadata, {
          onNone: () => ({
            coordinate,
            generatedAt: now,
            lastModified: now,
            lastAccessed: now,
            blockCount: chunk.blocks.length,
            nonAirBlockCount,
            generationStage: 'complete',
            isDirty: false,
            memorySize,
            version: 1,
          }),
          onSome: (existing) => ({
            ...existing,
            lastModified: now,
            lastAccessed: now,
            blockCount: chunk.blocks.length,
            nonAirBlockCount,
            memorySize,
            version: existing.version + 1,
          }),
        })

        // Update spatial index
        const regionKey_ = regionKey(coordinate)
        const existingRegion = HashMap.get(state.spatialIndex, regionKey_) ?? new Set()
        const newSpatialIndex = HashMap.set(state.spatialIndex, regionKey_, new Set([...existingRegion, key]))

        yield* _(
          Ref.update(this.stateRef, (s) => ({
            ...s,
            chunks: HashMap.set(s.chunks, key, chunk),
            metadata: HashMap.set(s.metadata, key, metadata),
            spatialIndex: newSpatialIndex,
          })),
        )
      }.bind(this),
    )

  readonly removeChunk = (coordinate: ChunkCoordinate): Effect.Effect<boolean, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        const key = chunkKey(coordinate)

        if (!HashMap.has(state.chunks, key)) {
          return false
        }

        // Update spatial index
        const regionKey_ = regionKey(coordinate)
        const existingRegion = HashMap.get(state.spatialIndex, regionKey_) ?? new Set()
        const newRegion = new Set(existingRegion)
        newRegion.delete(key)
        const newSpatialIndex = newRegion.size > 0 ? HashMap.set(state.spatialIndex, regionKey_, newRegion) : HashMap.remove(state.spatialIndex, regionKey_)

        yield* _(
          Ref.update(this.stateRef, (s) => ({
            ...s,
            chunks: HashMap.remove(s.chunks, key),
            metadata: HashMap.remove(s.metadata, key),
            spatialIndex: newSpatialIndex,
          })),
        )

        return true
      }.bind(this),
    )

  readonly hasChunk = (coordinate: ChunkCoordinate): Effect.Effect<boolean, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        return HashMap.has(state.chunks, chunkKey(coordinate))
      }.bind(this),
    )

  readonly getChunkMetadata = (coordinate: ChunkCoordinate): Effect.Effect<Option.Option<ChunkMetadata>, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        return HashMap.get(state.metadata, chunkKey(coordinate))
      }.bind(this),
    )

  readonly updateChunkMetadata = (coordinate: ChunkCoordinate, updater: (metadata: ChunkMetadata) => ChunkMetadata): Effect.Effect<boolean, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        const key = chunkKey(coordinate)
        const existingMetadata = HashMap.get(state.metadata, key)

        if (Option.isNone(existingMetadata)) {
          return false
        }

        const updatedMetadata = updater(existingMetadata.value)

        yield* _(
          Ref.update(this.stateRef, (s) => ({
            ...s,
            metadata: HashMap.set(s.metadata, key, updatedMetadata),
          })),
        )

        return true
      }.bind(this),
    )

  readonly markChunkDirty = (coordinate: ChunkCoordinate): Effect.Effect<void, never, never> =>
    Effect.gen(
      function* (_) {
        yield* _(
          this.updateChunkMetadata(coordinate, (metadata) => ({
            ...metadata,
            isDirty: true,
            lastModified: Date.now(),
          })),
        )
      }.bind(this),
    )

  readonly markChunkClean = (coordinate: ChunkCoordinate): Effect.Effect<void, never, never> =>
    Effect.gen(
      function* (_) {
        yield* _(
          this.updateChunkMetadata(coordinate, (metadata) => ({
            ...metadata,
            isDirty: false,
          })),
        )
      }.bind(this),
    )

  readonly getChunks = (coordinates: ReadonlyArray<ChunkCoordinate>): Effect.Effect<HashMap.HashMap<string, Chunk>, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        const result = HashMap.empty<string, Chunk>()

        for (const coordinate of coordinates) {
          const key = chunkKey(coordinate)
          const chunk = HashMap.get(state.chunks, key)
          if (Option.isSome(chunk)) {
            HashMap.set(result, key, chunk.value)
            // Update last accessed time
            yield* _(
              this.updateChunkMetadata(coordinate, (metadata) => ({
                ...metadata,
                lastAccessed: Date.now(),
              })),
            )
          }
        }

        return result
      }.bind(this),
    )

  readonly setChunks = (chunks: ReadonlyArray<Chunk>): Effect.Effect<void, never, never> =>
    Effect.gen(
      function* (_) {
        for (const chunk of chunks) {
          yield* _(this.setChunk(chunk))
        }
      }.bind(this),
    )

  readonly removeChunks = (coordinates: ReadonlyArray<ChunkCoordinate>): Effect.Effect<number, never, never> =>
    Effect.gen(
      function* (_) {
        let removedCount = 0
        for (const coordinate of coordinates) {
          const removed = yield* _(this.removeChunk(coordinate))
          if (removed) removedCount++
        }
        return removedCount
      }.bind(this),
    )

  readonly getChunksInRadius = (center: ChunkCoordinate, radius: number): Effect.Effect<ReadonlyArray<Chunk>, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        const chunks: Chunk[] = []

        for (const [key, chunk] of HashMap.entries(state.chunks)) {
          const coordinate = parseChunkKey(key)
          const distance = calculateDistance(center, coordinate)
          if (distance <= radius) {
            chunks.push(chunk)
          }
        }

        return chunks.sort((a, b) => {
          const distA = calculateDistance(center, { x: a.chunkX, z: a.chunkZ })
          const distB = calculateDistance(center, { x: b.chunkX, z: b.chunkZ })
          return distA - distB
        })
      }.bind(this),
    )

  readonly getChunksInArea = (minX: number, minZ: number, maxX: number, maxZ: number): Effect.Effect<ReadonlyArray<Chunk>, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        const chunks: Chunk[] = []

        for (const [_, chunk] of HashMap.entries(state.chunks)) {
          if (chunk.chunkX >= minX && chunk.chunkX <= maxX && chunk.chunkZ >= minZ && chunk.chunkZ <= maxZ) {
            chunks.push(chunk)
          }
        }

        return chunks
      }.bind(this),
    )

  readonly findChunks = (options: ChunkQueryOptions): Effect.Effect<ReadonlyArray<Chunk>, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        let chunks = Array.from(HashMap.values(state.chunks))

        // Apply filters
        if (options.center && options.radius) {
          chunks = chunks.filter((chunk) => {
            const distance = calculateDistance(options.center!, { x: chunk.chunkX, z: chunk.chunkZ })
            return distance <= options.radius!
          })
        }

        if (options.generationStage || options.onlyDirty) {
          chunks = chunks.filter((chunk) => {
            const metadata = HashMap.get(state.metadata, chunkKey({ x: chunk.chunkX, z: chunk.chunkZ }))
            if (Option.isNone(metadata)) return false

            const meta = metadata.value
            if (options.generationStage && meta.generationStage !== options.generationStage) return false
            if (options.onlyDirty && !meta.isDirty) return false

            return true
          })
        }

        // Apply sorting
        if (options.sortBy) {
          chunks = chunks.sort((a, b) => {
            const metaA = HashMap.get(state.metadata, chunkKey({ x: a.chunkX, z: a.chunkZ }))
            const metaB = HashMap.get(state.metadata, chunkKey({ x: b.chunkX, z: b.chunkZ }))

            if (Option.isNone(metaA) || Option.isNone(metaB)) return 0

            switch (options.sortBy) {
              case 'lastAccessed':
                return metaB.value.lastAccessed - metaA.value.lastAccessed
              case 'lastModified':
                return metaB.value.lastModified - metaA.value.lastModified
              case 'generatedAt':
                return metaB.value.generatedAt - metaA.value.generatedAt
              case 'distance':
                if (!options.center) return 0
                const distA = calculateDistance(options.center, { x: a.chunkX, z: a.chunkZ })
                const distB = calculateDistance(options.center, { x: b.chunkX, z: b.chunkZ })
                return distA - distB
              default:
                return 0
            }
          })
        }

        // Apply pagination
        let result = chunks
        if (options.offset) result = result.slice(options.offset)
        if (options.limit) result = result.slice(0, options.limit)

        return result
      }.bind(this),
    )

  readonly getBlock = (chunkCoord: ChunkCoordinate, blockIndex: number): Effect.Effect<Option.Option<BlockType>, never, never> =>
    Effect.gen(
      function* (_) {
        const chunkOpt = yield* _(this.getChunk(chunkCoord))

        if (Option.isNone(chunkOpt)) {
          return Option.none()
        }

        const chunk = chunkOpt.value
        if (blockIndex < 0 || blockIndex >= chunk.blocks.length) {
          return Option.none()
        }

        return Option.some(chunk.blocks[blockIndex])
      }.bind(this),
    )

  readonly setBlock = (chunkCoord: ChunkCoordinate, blockIndex: number, blockType: BlockType): Effect.Effect<boolean, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        const key = chunkKey(chunkCoord)
        const chunkOpt = HashMap.get(state.chunks, key)

        if (Option.isNone(chunkOpt)) {
          return false
        }

        const chunk = chunkOpt.value
        if (blockIndex < 0 || blockIndex >= chunk.blocks.length) {
          return false
        }

        const previousBlockType = chunk.blocks[blockIndex]
        const newBlocks = [...chunk.blocks]
        newBlocks[blockIndex] = blockType

        const updatedChunk: Chunk = { ...chunk, blocks: newBlocks }

        // Record change
        const change: ChunkChange = {
          chunkCoordinate: chunkCoord,
          blockIndex,
          previousBlockType,
          newBlockType: blockType,
          timestamp: Date.now(),
        }

        yield* _(
          Ref.update(this.stateRef, (s) => ({
            ...s,
            chunks: HashMap.set(s.chunks, key, updatedChunk),
            changes: [...s.changes.slice(-s.maxChangeHistory + 1), change],
          })),
        )

        yield* _(this.markChunkDirty(chunkCoord))

        return true
      }.bind(this),
    )

  readonly updateBlocks = (chunkCoord: ChunkCoordinate, updates: ReadonlyArray<{ index: number; blockType: BlockType }>): Effect.Effect<boolean, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        const key = chunkKey(chunkCoord)
        const chunkOpt = HashMap.get(state.chunks, key)

        if (Option.isNone(chunkOpt)) {
          return false
        }

        const chunk = chunkOpt.value
        const newBlocks = [...chunk.blocks]
        const changes: ChunkChange[] = []
        const now = Date.now()

        for (const update of updates) {
          if (update.index >= 0 && update.index < newBlocks.length) {
            const previousBlockType = newBlocks[update.index]
            newBlocks[update.index] = update.blockType

            changes.push({
              chunkCoordinate: chunkCoord,
              blockIndex: update.index,
              previousBlockType,
              newBlockType: update.blockType,
              timestamp: now,
            })
          }
        }

        const updatedChunk: Chunk = { ...chunk, blocks: newBlocks }

        yield* _(
          Ref.update(this.stateRef, (s) => ({
            ...s,
            chunks: HashMap.set(s.chunks, key, updatedChunk),
            changes: [...s.changes.slice(-s.maxChangeHistory + changes.length), ...changes],
          })),
        )

        yield* _(this.markChunkDirty(chunkCoord))

        return true
      }.bind(this),
    )

  // Simplified implementations of remaining methods
  readonly getChunkChanges = (chunkCoord?: ChunkCoordinate, since?: number): Effect.Effect<ReadonlyArray<ChunkChange>, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        let changes = state.changes

        if (chunkCoord) {
          changes = changes.filter((change) => change.chunkCoordinate.x === chunkCoord.x && change.chunkCoordinate.z === chunkCoord.z)
        }

        if (since) {
          changes = changes.filter((change) => change.timestamp >= since)
        }

        return changes
      }.bind(this),
    )

  readonly clearChangeHistory = (before?: number): Effect.Effect<number, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        const cutoff = before ?? Date.now()
        const oldChanges = state.changes.filter((change) => change.timestamp < cutoff)
        const newChanges = state.changes.filter((change) => change.timestamp >= cutoff)

        yield* _(
          Ref.update(this.stateRef, (s) => ({
            ...s,
            changes: newChanges,
          })),
        )

        return oldChanges.length
      }.bind(this),
    )

  readonly setGenerationStage = (coordinate: ChunkCoordinate, stage: ChunkMetadata['generationStage']): Effect.Effect<void, never, never> =>
    Effect.gen(
      function* (_) {
        yield* _(
          this.updateChunkMetadata(coordinate, (metadata) => ({
            ...metadata,
            generationStage: stage,
            lastModified: Date.now(),
          })),
        )
      }.bind(this),
    )

  readonly getChunksByGenerationStage = (stage: ChunkMetadata['generationStage']): Effect.Effect<ReadonlyArray<ChunkCoordinate>, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        const coordinates: ChunkCoordinate[] = []

        for (const [key, metadata] of HashMap.entries(state.metadata)) {
          if (metadata.generationStage === stage) {
            coordinates.push(parseChunkKey(key))
          }
        }

        return coordinates
      }.bind(this),
    )

  readonly getIncompleteChunks = (): Effect.Effect<ReadonlyArray<ChunkCoordinate>, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        const coordinates: ChunkCoordinate[] = []

        for (const [key, metadata] of HashMap.entries(state.metadata)) {
          if (metadata.generationStage !== 'complete') {
            coordinates.push(parseChunkKey(key))
          }
        }

        return coordinates
      }.bind(this),
    )

  readonly getChunkStats = (): Effect.Effect<ChunkStats, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))

        const totalChunks = HashMap.size(state.chunks)
        let dirtyChunks = 0
        let memoryUsage = 0
        let totalBlocks = 0
        let totalNonAirBlocks = 0
        const chunksByStage: Record<ChunkMetadata['generationStage'], number> = {
          empty: 0,
          terrain: 0,
          features: 0,
          decorations: 0,
          complete: 0,
        }

        for (const metadata of HashMap.values(state.metadata)) {
          if (metadata.isDirty) dirtyChunks++
          memoryUsage += metadata.memorySize
          totalBlocks += metadata.blockCount
          totalNonAirBlocks += metadata.nonAirBlockCount
          chunksByStage[metadata.generationStage]++
        }

        return {
          totalChunks,
          loadedChunks: totalChunks,
          dirtyChunks,
          memoryUsage,
          averageBlockDensity: totalBlocks > 0 ? totalNonAirBlocks / totalBlocks : 0,
          chunksByStage,
        }
      }.bind(this),
    )

  readonly unloadOldChunks = (maxAge: number, maxCount?: number): Effect.Effect<number, never, never> =>
    Effect.gen(
      function* (_) {
        const state = yield* _(Ref.get(this.stateRef))
        const now = Date.now()
        const cutoff = now - maxAge

        const oldChunks = Array.from(HashMap.entries(state.metadata))
          .filter(([_, metadata]) => metadata.lastAccessed < cutoff && !metadata.isDirty)
          .sort(([_, a], [__, b]) => a.lastAccessed - b.lastAccessed)
          .slice(0, maxCount)
          .map(([key, _]) => parseChunkKey(key))

        const unloadedCount = yield* _(this.removeChunks(oldChunks))
        return unloadedCount
      }.bind(this),
    )

  readonly compactStorage = (): Effect.Effect<void, never, never> =>
    Effect.gen(
      function* (_) {
        // Remove empty regions from spatial index
        yield* _(
          Ref.update(this.stateRef, (s) => ({
            ...s,
            spatialIndex: HashMap.filter(s.spatialIndex, (regionChunks) => regionChunks.size > 0),
          })),
        )
      }.bind(this),
    )

  readonly validateChunkData = (coordinate: ChunkCoordinate): Effect.Effect<boolean, never, never> =>
    Effect.gen(
      function* (_) {
        const chunkOpt = yield* _(this.getChunk(coordinate))

        if (Option.isNone(chunkOpt)) {
          return false
        }

        const chunk = chunkOpt.value

        // Validate chunk structure
        if (chunk.chunkX !== coordinate.x || chunk.chunkZ !== coordinate.z) {
          return false
        }

        // Validate blocks array length (assuming 16x256x16 = 65536 blocks)
        if (chunk.blocks.length !== 65536) {
          return false
        }

        // All blocks should be valid block types
        const validBlocks = chunk.blocks.every((block) => typeof block === 'string' && block.length > 0)

        return validBlocks
      }.bind(this),
    )
}

/**
 * Chunk Repository Layer
 */
export const ChunkRepositoryLive = Layer.effect(
  ChunkRepository,
  Effect.gen(function* (_) {
    const initialState: ChunkRepositoryState = {
      chunks: HashMap.empty(),
      metadata: HashMap.empty(),
      changes: [],
      maxChangeHistory: 10000,
      spatialIndex: HashMap.empty(),
    }

    const stateRef = yield* _(Ref.make(initialState))

    return new ChunkRepositoryImpl(stateRef)
  }),
)
