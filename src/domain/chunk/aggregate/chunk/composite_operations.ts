import { Cache, Clock, Duration, Effect, Chunk as EffectChunk, Either, Match, Option, pipe } from 'effect'
import { getUsedHeapSize } from '../../../performance'
import type { ChunkTimestamp } from '../../types'
import { CHUNK_HEIGHT, CHUNK_MIN_Y, CHUNK_SIZE } from '../../types'
import type { ChunkMetadata, HeightValue } from '../../value_object/chunk_metadata'
import type { ChunkPosition } from '../../value_object/chunk_position'
import type { ChunkData } from '../chunk_data'
import { ChunkDataOptics } from './index'

const rangeFromOffset = (start: number, size: number): ReadonlyArray<number> =>
  size <= 0 ? [] : Array.from({ length: size }, (_, index) => start + index)

const inclusiveRange = (start: number, end: number): ReadonlyArray<number> =>
  start > end ? [] : Array.from({ length: end - start + 1 }, (_, index) => start + index)

const isWithinChunkVolume = (x: number, y: number, z: number): boolean =>
  x >= 0 && x < CHUNK_SIZE && y >= CHUNK_MIN_Y && y < CHUNK_MIN_Y + CHUNK_HEIGHT && z >= 0 && z < CHUNK_SIZE

const localBlockIndex = (x: number, y: number, z: number): number =>
  (y - CHUNK_MIN_Y) * CHUNK_SIZE * CHUNK_SIZE + z * CHUNK_SIZE + x

const heightMapIndex = (x: number, z: number): number => z * CHUNK_SIZE + x

const applyBlockUpdates = (
  chunk: ChunkData,
  updates: ReadonlyArray<{ readonly index: number; readonly blockId: number }>
): ChunkData => updates.reduce((acc, { index, blockId }) => ChunkDataOptics.blockAt(index).replace(blockId)(acc), chunk)

const applyHeightUpdates = (
  chunk: ChunkData,
  updates: ReadonlyArray<{ readonly index: number; readonly height: HeightValue }>
): ChunkData =>
  updates.reduce((acc, { index, height }) => ChunkDataOptics.heightMapAt(index).replace(height)(acc), chunk)

const markDirtyAt =
  (timestamp: ChunkTimestamp) =>
  (chunk: ChunkData): ChunkData =>
    pipe(chunk, ChunkDataOptics.isDirty.replace(true), ChunkDataOptics.metadataTimestamp.replace(timestamp))

const recalculateLightLevel = (currentLevel: number, blockIndex: number, newBlockId: number): number => {
  const blockOpacity = getBlockOpacity(newBlockId)
  const lightReduction = blockOpacity > 0 ? Math.min(currentLevel, blockOpacity) : 0
  return Math.max(0, currentLevel - lightReduction)
}

const getBlockOpacity = (blockId: number): number =>
  (
    ({
      0: 0,
      1: 15,
      2: 15,
      3: 0,
    }) satisfies Record<number, number>
  )[blockId] ?? 0

const recalculatePositionalMetadata = (
  position: ChunkPosition,
  currentMetadata: ChunkMetadata
): Effect.Effect<ChunkMetadata> =>
  Effect.gen(function* () {
    const timestamp = yield* Clock.currentTimeMillis
    return {
      ...currentMetadata,
      biome: calculateBiomeFromPosition(position),
      timestamp: timestamp as ChunkTimestamp,
    }
  })

const calculateBiomeFromPosition = (position: ChunkPosition): string =>
  pipe(
    position,
    Match.value,
    Match.when(
      (pos) => Math.abs(pos.x) + Math.abs(pos.z) < 10,
      () => 'plains'
    ),
    Match.when(
      (pos) => pos.x < 0 && pos.z < 0,
      () => 'forest'
    ),
    Match.orElse(() => 'desert')
  )

const recalculateHeight = (chunk: ChunkData, x: number, z: number, startY: number): number =>
  pipe(
    inclusiveRange(CHUNK_MIN_Y, startY - 1)
      .slice()
      .reverse()
      .find((currentY) => chunk.blocks[localBlockIndex(x, currentY, z)] !== 0),
    Option.fromNullable,
    Option.getOrElse(() => CHUNK_MIN_Y)
  )

/**
 * 複合操作パターン
 */
export const ChunkCompositeOperations = {
  setBlockWithMetadata: (
    chunk: ChunkData,
    blockIndex: number,
    blockId: number,
    updateTime: ChunkTimestamp
  ): ChunkData =>
    pipe(
      chunk,
      ChunkDataOptics.blockAt(blockIndex).replace(blockId),
      ChunkDataOptics.metadataLightLevel.modify((level) => recalculateLightLevel(level, blockIndex, blockId)),
      markDirtyAt(updateTime)
    ),

  setBlockRegionWithHeightMap: (
    chunk: ChunkData,
    region: {
      readonly x: number
      readonly y: number
      readonly z: number
      readonly width: number
      readonly height: number
      readonly depth: number
    },
    blockId: number,
    updateTime: ChunkTimestamp
  ): Effect.Effect<ChunkData> =>
    Effect.sync(() => {
      const xs = rangeFromOffset(region.x, region.width)
      const ys = rangeFromOffset(region.y, region.height)
      const zs = rangeFromOffset(region.z, region.depth)

      const coordinates = xs.flatMap((x) => ys.flatMap((y) => zs.map((z) => ({ x, y, z }))))

      const validCoordinates = coordinates.filter(({ x, y, z }) => isWithinChunkVolume(x, y, z))

      const blockUpdates = validCoordinates.map(({ x, y, z }) => ({
        index: localBlockIndex(x, y, z),
        blockId,
      }))

      const heightUpdates = validCoordinates
        .map(({ x, y, z }) => ({
          index: heightMapIndex(x, z),
          height: y as HeightValue,
          isSolid: blockId !== 0,
        }))
        .filter(({ isSolid, index, height }) =>
          pipe(
            isSolid,
            Match.value,
            Match.when(true, () => height > chunk.metadata.heightMap[index]),
            Match.orElse(() => false)
          )
        )
        .map(({ index, height }) => ({ index, height }))

      return pipe(
        chunk,
        (initial) => applyBlockUpdates(initial, blockUpdates),
        (updated) => applyHeightUpdates(updated, heightUpdates),
        markDirtyAt(updateTime)
      )
    }),

  conditionalCompositeUpdate: (
    chunk: ChunkData,
    predicate: (blockId: number, index: number) => boolean,
    transform: (blockId: number, index: number) => number,
    metadataUpdate: Partial<ChunkMetadata>
  ): Effect.Effect<ChunkData> =>
    Effect.sync(() => {
      const blocks = Array.from(chunk.blocks)

      const blockUpdates = blocks
        .map((blockId, index) => ({ blockId, index }))
        .filter(({ blockId, index }) => predicate(blockId, index))
        .map(({ blockId, index }) => ({
          index,
          blockId: transform(blockId, index),
        }))
        .filter(({ blockId, index }) => blockId !== blocks[index])

      return pipe(
        blockUpdates.length === 0,
        Match.value,
        Match.when(true, () => chunk),
        Match.orElse(() =>
          pipe(
            chunk,
            (initial) => applyBlockUpdates(initial, blockUpdates),
            ChunkDataOptics.metadata.modify((metadata) => ({
              ...metadata,
              ...metadataUpdate,
            })),
            ChunkDataOptics.isDirty.replace(true)
          )
        )
      )
    }),

  relocateChunkWithRecalculation: (
    chunk: ChunkData,
    newPosition: ChunkPosition,
    recalculateMetadata: boolean = true
  ): Effect.Effect<ChunkData> =>
    Effect.gen(function* () {
      const relocated = pipe(
        chunk,
        ChunkDataOptics.position.replace(newPosition),
        ChunkDataOptics.isDirty.replace(true)
      )

      return yield* pipe(
        Option.fromPredicate((flag: boolean) => flag)(recalculateMetadata),
        Option.match({
          onNone: () => Effect.succeed(relocated),
          onSome: () =>
            pipe(
              recalculatePositionalMetadata(newPosition, chunk.metadata),
              Effect.map((metadata) => ChunkDataOptics.metadata.replace(metadata)(relocated))
            ),
        })
      )
    }),
} as const

export const ChunkStateCompositeOperations = {
  initializeLoading: (chunk: ChunkData, loadingStartTime: ChunkTimestamp): ChunkData =>
    pipe(chunk, ChunkDataOptics.isDirty.replace(false), ChunkDataOptics.metadataTimestamp.replace(loadingStartTime)),

  completeSaving: (chunk: ChunkData, saveTime: ChunkTimestamp): ChunkData =>
    pipe(chunk, ChunkDataOptics.isDirty.replace(false), ChunkDataOptics.metadataTimestamp.replace(saveTime)),

  markError: (chunk: ChunkData, errorTime: ChunkTimestamp): ChunkData =>
    ChunkDataOptics.metadataTimestamp.replace(errorTime)(chunk),
} as const

export const ChunkBatchCompositeOperations = {
  batchSyncUpdate: (
    chunks: ReadonlyArray<ChunkData>,
    operation: (chunk: ChunkData, index: number) => ChunkData
  ): ReadonlyArray<ChunkData> => chunks.map(operation),

  batchAsyncUpdate: (
    chunks: ReadonlyArray<ChunkData>,
    operation: (chunk: ChunkData, index: number) => Effect.Effect<ChunkData>
  ): Effect.Effect<ReadonlyArray<ChunkData>> => Effect.forEach(chunks, operation, { concurrency: 'unbounded' }),

  conditionalBatchUpdate: (
    chunks: ReadonlyArray<ChunkData>,
    predicate: (chunk: ChunkData, index: number) => boolean,
    operation: (chunk: ChunkData, index: number) => ChunkData
  ): ReadonlyArray<ChunkData> =>
    chunks.map((chunk, index) => (predicate(chunk, index) ? operation(chunk, index) : chunk)),

  parallelBatchUpdate: (
    chunks: ReadonlyArray<ChunkData>,
    operation: (chunk: ChunkData, index: number) => Effect.Effect<ChunkData>,
    maxConcurrency: number = 4
  ): Effect.Effect<ReadonlyArray<ChunkData>> => Effect.forEach(chunks, operation, { concurrency: maxConcurrency }),
} as const

export const ChunkTransactionalOperations = {
  transactionalUpdate: (
    chunk: ChunkData,
    operations: ReadonlyArray<(chunk: ChunkData) => Either.Either<ChunkData, string>>
  ): Either.Either<ChunkData, string> =>
    operations.reduce<Either.Either<ChunkData, string>>(
      (acc, operation) => pipe(acc, Either.flatMap(operation)),
      Either.right(chunk)
    ),

  asyncTransactionalUpdate: (
    chunk: ChunkData,
    operations: ReadonlyArray<(chunk: ChunkData) => Effect.Effect<ChunkData, string>>
  ): Effect.Effect<ChunkData, string> => Effect.reduce(operations, chunk, (current, operation) => operation(current)),

  savepointTransactionalUpdate: (
    chunk: ChunkData,
    operations: ReadonlyArray<{
      readonly operation: (chunk: ChunkData) => Either.Either<ChunkData, string>
      readonly savepoint?: boolean
    }>
  ): Either.Either<ChunkData, { readonly error: string; readonly rollbackTo?: ChunkData }> =>
    operations
      .reduce<
        Either.Either<
          { readonly current: ChunkData; readonly savepoint: ChunkData },
          { readonly error: string; readonly rollbackTo?: ChunkData }
        >
      >(
        (acc, { operation, savepoint }) =>
          pipe(
            acc,
            Either.flatMap(({ current, savepoint: currentSavepoint }) => {
              const nextSavepoint = savepoint ? current : currentSavepoint
              return pipe(
                operation(current),
                Either.map((updated) => ({ current: updated, savepoint: nextSavepoint })),
                Either.mapError((error) => ({ error, rollbackTo: nextSavepoint }))
              )
            })
          ),
        Either.right({ current: chunk, savepoint: chunk })
      )
      .pipe(Either.map(({ current }) => current)),
} as const

export const CachedChunkOptics = {
  createBlockStatisticsCache: () =>
    Cache.make({
      capacity: 100,
      timeToLive: Duration.minutes(5),
      lookup: (chunk: ChunkData) =>
        Effect.sync(() => {
          const blocks = chunk.blocks
          const stats = {
            totalBlocks: blocks.length,
            emptyBlocks: 0,
            blockCounts: new Map<number, number>(),
            mostCommonBlock: 0,
            diversityIndex: 0,
          }

          const blockStats = blocks.reduce(
            (acc, blockId) => {
              const emptyBlocks = blockId === 0 ? acc.emptyBlocks + 1 : acc.emptyBlocks
              const count = (acc.counts.get(blockId) ?? 0) + 1
              const counts = new Map(acc.counts).set(blockId, count)
              const isNewMax = count > acc.maxCount

              return {
                counts,
                maxCount: isNewMax ? count : acc.maxCount,
                mostCommon: isNewMax ? blockId : acc.mostCommon,
                emptyBlocks,
              }
            },
            {
              counts: new Map<number, number>(),
              maxCount: 0,
              mostCommon: 0,
              emptyBlocks: 0,
            }
          )

          stats.emptyBlocks = blockStats.emptyBlocks
          stats.blockCounts = blockStats.counts
          stats.mostCommonBlock = blockStats.mostCommon
          stats.diversityIndex = blockStats.counts.size / blocks.length

          return stats
        }),
    }),

  createHeightMapCache: () =>
    Cache.make({
      capacity: 50,
      timeToLive: Duration.minutes(10),
      lookup: (chunk: ChunkData) =>
        Effect.sync(() => {
          const heightMap = chunk.metadata.heightMap
          const maxHeight = Math.max(...heightMap)
          const minHeight = Math.min(...heightMap)
          const averageHeight = heightMap.reduce((sum, h) => sum + h, 0) / heightMap.length
          const variance = calculateVariance(heightMap)

          return {
            maxHeight,
            minHeight,
            averageHeight,
            heightVariance: variance,
          }
        }),
    }),
} as const

export const StreamingChunkOptics = {
  streamBlockProcessing: (
    chunk: ChunkData,
    processor: (blockChunk: ReadonlyArray<number>, startIndex: number) => ReadonlyArray<number>,
    chunkSize: number = 1024
  ): Effect.Effect<ChunkData> =>
    Effect.gen(function* () {
      const blocks = Array.from(chunk.blocks)
      const chunkIndices = Array.from({ length: Math.ceil(blocks.length / chunkSize) }, (_, i) => i)

      const processedBlocks: number[] = []

      yield* pipe(
        EffectChunk.fromIterable(chunkIndices),
        EffectChunk.forEach((chunkIndex) =>
          Effect.gen(function* () {
            const startIndex = chunkIndex * chunkSize
            const endIndex = Math.min(startIndex + chunkSize, blocks.length)
            const blockChunk = blocks.slice(startIndex, endIndex)

            processedBlocks.push(...processor(blockChunk, startIndex))

            return yield* pipe(
              (chunkIndex * chunkSize) % (chunkSize * 10) === 0,
              Match.value,
              Match.when(true, () => Effect.sleep(Duration.millis(0))),
              Match.orElse(() => Effect.unit)
            )
          })
        )
      )

      return ChunkDataOptics.blocks.replace(new Uint16Array(processedBlocks))(chunk)
    }),

  parallelStreamProcessing: (
    chunk: ChunkData,
    processor: (blockChunk: ReadonlyArray<number>, startIndex: number) => ReadonlyArray<number>,
    workerCount: number = 4
  ): Effect.Effect<ChunkData> =>
    Effect.gen(function* () {
      const blocks = Array.from(chunk.blocks)
      const chunkSize = Math.ceil(blocks.length / workerCount)
      const workerIndices = Array.from({ length: workerCount }, (_, i) => i)

      const results = yield* pipe(
        EffectChunk.fromIterable(workerIndices),
        EffectChunk.mapEffect((workerIndex) =>
          Effect.sync(() => {
            const startIndex = workerIndex * chunkSize
            const endIndex = Math.min(startIndex + chunkSize, blocks.length)
            const blockChunk = blocks.slice(startIndex, endIndex)

            return {
              startIndex,
              processed: processor(blockChunk, startIndex),
            }
          })
        ),
        EffectChunk.runCollect
      )

      const mergedBlocks = new Array(blocks.length)
      results.forEach(({ startIndex, processed }) => {
        processed.forEach((value, offset) => {
          mergedBlocks[startIndex + offset] = value
        })
      })

      return ChunkDataOptics.blocks.replace(new Uint16Array(mergedBlocks))(chunk)
    }),
} as const

export const MemoryOptimizedOptics = {
  copyOnWrite: <T>(chunk: ChunkData, updateFunction: (chunk: ChunkData) => ChunkData): ChunkData =>
    pipe(updateFunction(chunk), (updated) => (updated === chunk ? chunk : updated)),

  structuralSharing: (chunk: ChunkData, changes: Partial<ChunkData>): ChunkData =>
    pipe(
      Object.keys(changes).length === 0,
      Match.value,
      Match.when(true, () => chunk),
      Match.orElse(() => ({ ...chunk, ...changes }))
    ),

  gcOptimized: (
    chunk: ChunkData,
    operation: (chunk: ChunkData) => Effect.Effect<ChunkData>
  ): Effect.Effect<ChunkData> =>
    Effect.gen(function* () {
      yield* Effect.sync(() =>
        pipe(
          typeof global !== 'undefined' && typeof (global as typeof globalThis & { gc?: () => void }).gc === 'function',
          Match.value,
          Match.when(true, () => (global as typeof globalThis & { gc?: () => void }).gc?.()),
          Match.orElse(() => undefined)
        )
      )

      const result = yield* operation(chunk)

      yield* Effect.sync(() =>
        pipe(
          typeof global !== 'undefined' && typeof (global as typeof globalThis & { gc?: () => void }).gc === 'function',
          Match.value,
          Match.when(true, () => (global as typeof globalThis & { gc?: () => void }).gc?.()),
          Match.orElse(() => undefined)
        )
      )

      return result
    }),
} as const

export const PerformanceMonitoring = {
  measureOperation: <A>(operationName: string, operation: Effect.Effect<A>): Effect.Effect<A> =>
    Effect.gen(function* () {
      const startTime = yield* Effect.sync(() => performance.now())
      const result = yield* operation
      const endTime = yield* Effect.sync(() => performance.now())
      yield* Effect.sync(() => console.debug(`${operationName} took ${endTime - startTime}ms`))
      return result
    }),

  monitorMemory: <A>(operation: Effect.Effect<A>): Effect.Effect<A> =>
    Effect.gen(function* () {
      const beforeMemory = yield* getUsedHeapSize()
      const result = yield* operation
      const afterMemory = yield* getUsedHeapSize()

      yield* pipe(
        afterMemory - beforeMemory,
        (diff) => diff > 1024 * 1024,
        Match.value,
        Match.when(true, () =>
          Effect.sync(() => console.warn(`Memory usage increased by ${(afterMemory - beforeMemory) / 1024 / 1024}MB`))
        ),
        Match.orElse(() => Effect.unit)
      )

      return result
    }),
} as const

const calculateVariance = (values: ReadonlyArray<number>): number => {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  return values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length
}

export type CompositeOperation<T> = (chunk: ChunkData) => T
export type AsyncCompositeOperation<T> = (chunk: ChunkData) => Effect.Effect<T>
export type TransactionalOperation = (chunk: ChunkData) => Either.Either<ChunkData, string>
export type AsyncTransactionalOperation = (chunk: ChunkData) => Effect.Effect<ChunkData, string>
