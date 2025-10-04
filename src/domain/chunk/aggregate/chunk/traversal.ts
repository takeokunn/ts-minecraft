import { Effect, Match, pipe } from 'effect'
import type { ChunkData } from '../chunk_data/types'
import { ChunkDataOptics } from './optics'
import type { HeightValue } from '../../value_object/chunk_metadata'
import { CHUNK_MIN_Y, CHUNK_SIZE } from '../../types/core'

const blocksPerLayer = CHUNK_SIZE * CHUNK_SIZE

const modifyBlocks = (
  chunk: ChunkData,
  mapper: (block: number, index: number) => number
): ChunkData =>
  ChunkDataOptics.blocks.modify((blocks) => blocks.map(mapper))(chunk)

const modifyHeightMap = (
  chunk: ChunkData,
  mapper: (height: HeightValue, index: number) => HeightValue
): ChunkData =>
  ChunkDataOptics.metadata.modify((metadata) => ({
    ...metadata,
    heightMap: metadata.heightMap.map((height, index) => mapper(height as HeightValue, index)),
  }))(chunk)

const indexToCoordinates = (index: number) => {
  const layer = Math.floor(index / blocksPerLayer)
  const withinLayer = index % blocksPerLayer
  const z = Math.floor(withinLayer / CHUNK_SIZE)
  const x = withinLayer % CHUNK_SIZE
  return {
    x,
    y: layer + CHUNK_MIN_Y,
    z,
  }
}

const withinRegion = (
  coords: { readonly x: number; readonly y: number; readonly z: number },
  region: { readonly x1: number; readonly x2: number; readonly y1: number; readonly y2: number; readonly z1: number; readonly z2: number }
): boolean =>
  coords.x >= region.x1 && coords.x <= region.x2 &&
  coords.y >= region.y1 && coords.y <= region.y2 &&
  coords.z >= region.z1 && coords.z <= region.z2

export const ChunkTraversalOperations = {
  mapAllBlocks: (
    chunk: ChunkData,
    transform: (blockId: number, index: number) => number
  ): ChunkData => modifyBlocks(chunk, transform),

  mapBlocksWhere: (
    chunk: ChunkData,
    predicate: (blockId: number, index: number) => boolean,
    transform: (blockId: number, index: number) => number
  ): ChunkData =>
    modifyBlocks(chunk, (blockId, index) =>
      predicate(blockId, index) ? transform(blockId, index) : blockId
    ),

  mapHeightMapRange: (
    chunk: ChunkData,
    start: number,
    end: number,
    transform: (height: HeightValue, index: number) => HeightValue
  ): ChunkData =>
    modifyHeightMap(chunk, (height, index) =>
      index >= start && index < end ? transform(height, index) : height
    ),

  mapBlocksAtY: (
    chunk: ChunkData,
    y: number,
    transform: (blockId: number, index: number) => number
  ): ChunkData =>
    ChunkTraversalOperations.mapBlocksWhere(
      chunk,
      (_, index) => indexToCoordinates(index).y === y,
      transform
    ),

  mapBlocksByType: (
    chunk: ChunkData,
    blockType: number,
    transform: (blockId: number, index: number) => number
  ): ChunkData =>
    ChunkTraversalOperations.mapBlocksWhere(
      chunk,
      (blockId) => blockId === blockType,
      transform
    ),

  mapNonEmptyBlocks: (
    chunk: ChunkData,
    transform: (blockId: number, index: number) => number
  ): ChunkData =>
    ChunkTraversalOperations.mapBlocksWhere(
      chunk,
      (blockId) => blockId !== 0,
      transform
    ),

  mapBlocksInRegion: (
    chunk: ChunkData,
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    transform: (blockId: number, index: number) => number
  ): ChunkData =>
    ChunkTraversalOperations.mapBlocksWhere(
      chunk,
      (_, index) => withinRegion(indexToCoordinates(index), { x1, x2, y1, y2, z1, z2 }),
      transform
    ),

  mapHeightMapWhere: (
    chunk: ChunkData,
    predicate: (height: HeightValue, index: number) => boolean,
    transform: (height: HeightValue, index: number) => HeightValue
  ): ChunkData =>
    modifyHeightMap(chunk, (height, index) =>
      predicate(height, index) ? transform(height, index) : height
    ),
} as const

const applyBlockUpdates = (
  chunk: ChunkData,
  updates: ReadonlyArray<{ readonly index: number; readonly blockId: number }>
): ChunkData =>
  updates.reduce(
    (acc, { index, blockId }) => ChunkDataOptics.blockAt(index).replace(blockId)(acc),
    chunk
  )

const applyHeightUpdates = (
  chunk: ChunkData,
  updates: ReadonlyArray<{ readonly index: number; readonly height: HeightValue }>
): ChunkData =>
  updates.reduce(
    (acc, { index, height }) => ChunkDataOptics.heightMapAt(index).replace(height)(acc),
    chunk
  )

export const ParallelChunkTraversalOptics = {
  parallelBlockUpdate: (
    chunk: ChunkData,
    updates: ReadonlyArray<{ readonly index: number; readonly blockId: number }>
  ): Effect.Effect<ChunkData> =>
    Effect.succeed(applyBlockUpdates(chunk, updates)),

  parallelHeightMapUpdate: (
    chunk: ChunkData,
    updates: ReadonlyArray<{ readonly index: number; readonly height: HeightValue }>
  ): Effect.Effect<ChunkData> =>
    Effect.succeed(applyHeightUpdates(chunk, updates)),

  parallelBlockTransform: (
    chunk: ChunkData,
    predicate: (blockId: number, index: number) => boolean,
    transform: (blockId: number, index: number) => number
  ): Effect.Effect<ChunkData> =>
    pipe(
      Array.from(chunk.blocks)
        .flatMap((blockId, index) =>
          predicate(blockId, index)
            ? [{ index, blockId: transform(blockId, index) }]
            : []
        )
        .filter(({ blockId, index }) => blockId !== chunk.blocks[index]),
      (updates) => ParallelChunkTraversalOptics.parallelBlockUpdate(chunk, updates)
    ),

  parallelBlockStatistics: (chunk: ChunkData): Effect.Effect<{
    readonly totalBlocks: number
    readonly emptyBlocks: number
    readonly uniqueBlockTypes: number
    readonly blockTypeCounts: Map<number, number>
  }> => {
    const blocks = chunk.blocks
    const partitionSize = 1024
    const partitions = Array.from({ length: Math.ceil(blocks.length / partitionSize) }, (_, i) => i)

    return pipe(
      partitions,
      Effect.reduce(
        {
          totalBlocks: 0,
          emptyBlocks: 0,
          blockTypeCounts: new Map<number, number>(),
        },
        (acc, partitionIndex) =>
          Effect.sync(() => {
            const start = partitionIndex * partitionSize
            const end = Math.min((partitionIndex + 1) * partitionSize, blocks.length)
            const slice = blocks.slice(start, end)

            const partitionStats = slice.reduce(
              ({ total, empty, counts }, blockId) => {
                const nextEmpty = blockId === 0 ? empty + 1 : empty
                const nextCounts = new Map(counts)
                nextCounts.set(blockId, (nextCounts.get(blockId) ?? 0) + 1)
                return {
                  total: total + 1,
                  empty: nextEmpty,
                  counts: nextCounts,
                }
              },
              {
                total: 0,
                empty: 0,
                counts: new Map<number, number>(),
              }
            )

            const mergedCounts = new Map(acc.blockTypeCounts)
            partitionStats.counts.forEach((count, blockId) => {
              mergedCounts.set(blockId, (mergedCounts.get(blockId) ?? 0) + count)
            })

            return {
              totalBlocks: acc.totalBlocks + partitionStats.total,
              emptyBlocks: acc.emptyBlocks + partitionStats.empty,
              blockTypeCounts: mergedCounts,
            }
          })
      ),
      Effect.map((stats) => ({
        totalBlocks: stats.totalBlocks,
        emptyBlocks: stats.emptyBlocks,
        uniqueBlockTypes: stats.blockTypeCounts.size,
        blockTypeCounts: stats.blockTypeCounts,
      }))
    )
  },
} as const

export const ChunkTraversalComposers = {
  sequence: (
    chunk: ChunkData,
    operations: ReadonlyArray<(chunk: ChunkData) => ChunkData>
  ): ChunkData => operations.reduce((acc, operation) => operation(acc), chunk),

  parallel: (
    chunk: ChunkData,
    operations: ReadonlyArray<(chunk: ChunkData) => Effect.Effect<ChunkData>>
  ): Effect.Effect<ChunkData> =>
    pipe(
      operations,
      Effect.forEach((operation) => operation(chunk), { concurrency: 'unbounded' }),
      Effect.map((results) => results.at(-1) ?? chunk)
    ),

  conditional: (
    chunk: ChunkData,
    condition: (chunk: ChunkData) => boolean,
    operation: (chunk: ChunkData) => ChunkData
  ): ChunkData =>
    pipe(
      condition(chunk),
      Match.value,
      Match.when(true, () => operation(chunk)),
      Match.orElse(() => chunk)
    ),
} as const

export const ChunkTraversalOptics = {
  allBlocks: (
    transform: (blockId: number, index: number) => number
  ) => (chunk: ChunkData) => ChunkTraversalOperations.mapAllBlocks(chunk, transform),

  blocksWhere: (
    predicate: (blockId: number, index: number) => boolean
  ) => (
    transform: (blockId: number, index: number) => number
  ) => (chunk: ChunkData) => ChunkTraversalOperations.mapBlocksWhere(chunk, predicate, transform),

  nonEmptyBlocks: (
    transform: (blockId: number, index: number) => number
  ) => (chunk: ChunkData) => ChunkTraversalOperations.mapNonEmptyBlocks(chunk, transform),

  blocksByType: (
    blockType: number
  ) => (
    transform: (blockId: number, index: number) => number
  ) => (chunk: ChunkData) => ChunkTraversalOperations.mapBlocksByType(chunk, blockType, transform),

  blocksAtY: (
    y: number
  ) => (
    transform: (blockId: number, index: number) => number
  ) => (chunk: ChunkData) => ChunkTraversalOperations.mapBlocksAtY(chunk, y, transform),

  blocksInRegion: (
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number
  ) => (
    transform: (blockId: number, index: number) => number
  ) => (chunk: ChunkData) =>
    ChunkTraversalOperations.mapBlocksInRegion(chunk, x1, y1, z1, x2, y2, z2, transform),

  heightMapRange: (
    start: number,
    end: number
  ) => (
    transform: (height: HeightValue, index: number) => HeightValue
  ) => (chunk: ChunkData) => ChunkTraversalOperations.mapHeightMapRange(chunk, start, end, transform),

  heightMapWhere: (
    predicate: (height: HeightValue, index: number) => boolean
  ) => (
    transform: (height: HeightValue, index: number) => HeightValue
  ) => (chunk: ChunkData) => ChunkTraversalOperations.mapHeightMapWhere(chunk, predicate, transform),
} as const

export type ChunkTraversalOperation<A> = (chunk: ChunkData) => ChunkData
export type ParallelChunkTraversalOperation = (chunk: ChunkData) => Effect.Effect<ChunkData>
