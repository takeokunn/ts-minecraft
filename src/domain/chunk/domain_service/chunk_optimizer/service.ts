import { Array as Arr, Clock, Context, Effect, Layer, Match, Number as Num, Option, Order, pipe } from 'effect'
import type { ChunkData } from '../../aggregate/chunk'
import { ChunkDataValidationError } from '../../aggregate/chunk_data'
import { CHUNK_SIZE, CHUNK_VOLUME } from '../../types'
import {
  type BlockCount,
  type BlockId,
  type ChunkMetadataError,
  type ChunkOptimizationDetails,
  type OptimizationStrategyKind,
  type Percentage,
  type Timestamp,
  createOptimizationDetails,
  createOptimizationRecord,
  makeBlockCount,
  makeBlockId,
  makePercentage,
  makeTimestamp,
  withOptimizationRecord,
} from '../../value_object/chunk_metadata'

export type OptimizationStrategy =
  | { readonly _tag: 'MemoryOptimization'; readonly aggressive: boolean }
  | { readonly _tag: 'CompressionOptimization'; readonly algorithm: CompressionAlgorithm }
  | { readonly _tag: 'AccessOptimization'; readonly cacheSize: number }
  | { readonly _tag: 'RedundancyElimination'; readonly threshold: number }

export const OptimizationStrategy = {
  MemoryOptimization: (aggressive = false): OptimizationStrategy => ({
    _tag: 'MemoryOptimization',
    aggressive,
  }),
  CompressionOptimization: (algorithm: CompressionAlgorithm): OptimizationStrategy => ({
    _tag: 'CompressionOptimization',
    algorithm,
  }),
  AccessOptimization: (cacheSize: number): OptimizationStrategy => ({
    _tag: 'AccessOptimization',
    cacheSize,
  }),
  RedundancyElimination: (threshold: number): OptimizationStrategy => ({
    _tag: 'RedundancyElimination',
    threshold,
  }),
}

export interface OptimizationMetricFrequency {
  readonly blockId: BlockId
  readonly frequency: BlockCount
}

export interface OptimizationMetrics {
  readonly memoryUsage: BlockCount
  readonly compressionRatio: Percentage
  readonly accessPatterns: ReadonlyArray<OptimizationMetricFrequency>
  readonly redundancy: Percentage
  readonly timestamp: Timestamp
  readonly optimizationPotential: Percentage
}

export interface OptimizationResult {
  readonly originalSize: BlockCount
  readonly optimizedSize: BlockCount
  readonly compressionRatio: Percentage
  readonly strategy: OptimizationStrategy
  readonly timeSpent: number
  readonly qualityLoss: Percentage
  readonly chunk: ChunkData
}

export interface ChunkOptimizationService {
  readonly optimizeMemory: (chunk: ChunkData) => Effect.Effect<ChunkData, ChunkDataValidationError>
  readonly optimizeCompression: (
    chunk: ChunkData,
    algorithm?: CompressionAlgorithm
  ) => Effect.Effect<ChunkData, ChunkDataValidationError>
  readonly optimizeAccess: (
    chunk: ChunkData,
    accessPatterns?: ReadonlyArray<AccessPattern>,
    cacheSize?: number
  ) => Effect.Effect<ChunkData, ChunkDataValidationError>
  readonly analyzeEfficiency: (chunk: ChunkData) => Effect.Effect<OptimizationMetrics, ChunkDataValidationError>
  readonly suggestOptimizations: (
    metrics: OptimizationMetrics
  ) => Effect.Effect<ReadonlyArray<OptimizationStrategy>, ChunkDataValidationError>
  readonly applyOptimization: (
    chunk: ChunkData,
    strategy: OptimizationStrategy
  ) => Effect.Effect<OptimizationResult, ChunkDataValidationError>
  readonly eliminateRedundancy: (
    chunk: ChunkData,
    threshold?: number
  ) => Effect.Effect<ChunkData, ChunkDataValidationError>
  readonly defragment: (chunk: ChunkData) => Effect.Effect<ChunkData, ChunkDataValidationError>
}

export const ChunkOptimizationService = Context.GenericTag<ChunkOptimizationService>('ChunkOptimizationService')

type CompressionAlgorithm = 'rle' | 'delta' | 'palette'

type AccessPattern = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly frequency: number
}

const DEFAULT_REDUNDANCY_THRESHOLD = 0.8
const MAX_RUN_LENGTH = 65535
const blocksPerLayer = CHUNK_SIZE * CHUNK_SIZE

const frequencyOrder = pipe(
  Num.Order,
  Order.mapInput((entry: readonly [number, number]) => entry[1]),
  Order.reverse
)

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const toValidationError = (error: ChunkMetadataError): ChunkDataValidationError =>
  ChunkDataValidationError({
    message: error.message,
    field: error.issues.at(0)?.field,
    value: error.issues,
  })

const toBlockArray = (blocks: Uint16Array): ReadonlyArray<number> => Array.from(blocks)

const toFrequencyMap = (blocks: ReadonlyArray<number>): Map<number, number> =>
  blocks.reduce<Map<number, number>>((map, blockId) => {
    map.set(blockId, (map.get(blockId) ?? 0) + 1)
    return map
  }, new Map<number, number>())

const sortByFrequency = (frequencyMap: Map<number, number>): ReadonlyArray<readonly [number, number]> =>
  Arr.sort(Array.from(frequencyMap.entries()), frequencyOrder)

const toRankMap = (entries: ReadonlyArray<readonly [number, number]>): Map<number, number> =>
  Array.from(entries.entries()).reduce<Map<number, number>>((map, [index, [blockId]]) => {
    map.set(blockId, index)
    return map
  }, new Map<number, number>())

const calculateRedundancy = (frequencyMap: Map<number, number>, totalBlocks: number): number =>
  pipe(
    totalBlocks,
    (count) => count === 0,
    Match.value,
    Match.when(true, () => 0),
    Match.orElse(() => 1 - frequencyMap.size / totalBlocks)
  )

const runLengthEncode = (blocks: ReadonlyArray<number>): ReadonlyArray<number> =>
  blocks
    .reduce<Array<{ readonly blockId: number; readonly count: number }>>(
      (state, blockId) =>
        pipe(
          state.at(-1),
          Option.fromNullable,
          Option.match({
            onNone: () => [...state, { blockId, count: 1 }],
            onSome: (last) =>
              pipe(
                last.blockId === blockId && last.count < MAX_RUN_LENGTH,
                Match.value,
                Match.when(true, () => [
                  ...state.slice(0, Math.max(0, state.length - 1)),
                  { blockId, count: last.count + 1 },
                ]),
                Match.orElse(() => [...state, { blockId, count: 1 }])
              ),
          })
        ),
      []
    )
    .flatMap(({ blockId, count }) => [blockId, count])

const deltaEncode = (blocks: ReadonlyArray<number>): ReadonlyArray<number> =>
  blocks.reduce<{
    readonly encoded: ReadonlyArray<number>
    readonly previous: Option.Option<number>
  }>(
    (state, blockId) =>
      pipe(
        state.previous,
        Option.match({
          onNone: () => ({ encoded: [...state.encoded, blockId], previous: Option.some(blockId) }),
          onSome: (prev) => ({ encoded: [...state.encoded, blockId - prev], previous: Option.some(blockId) }),
        })
      ),
    { encoded: [], previous: Option.none<number>() }
  ).encoded

const paletteEncode = (blocks: ReadonlyArray<number>): ReadonlyArray<number> => {
  const palette = Array.from(new Set(blocks))
  const paletteIndex = new Map(palette.map((blockId, index) => [blockId, index]))
  return blocks.map((blockId) => paletteIndex.get(blockId) ?? 0)
}

const finalizeOptimization = (
  chunk: ChunkData,
  strategy: OptimizationStrategyKind,
  optimizedBlocks: ReadonlyArray<number>,
  detailsInput?: Parameters<typeof createOptimizationDetails>[0]
): Effect.Effect<ChunkData, ChunkDataValidationError> =>
  Effect.gen(function* () {
    const timestampValue = yield* Clock.currentTimeMillis
    const timestamp = yield* makeTimestamp(timestampValue)

    const details = yield* pipe(
      Option.fromNullable(detailsInput),
      Option.match({
        onNone: () => Effect.succeed<ChunkOptimizationDetails | undefined>(undefined),
        onSome: (input) => createOptimizationDetails(input),
      })
    )

    const record = yield* createOptimizationRecord(strategy, timestamp, details)
    const metadata = yield* withOptimizationRecord(chunk.metadata, record)

    return {
      ...chunk,
      blocks: Uint16Array.from(optimizedBlocks),
      metadata,
      isDirty: true,
    }
  }).pipe(Effect.mapError(toValidationError))

const memoryOptimization = (chunk: ChunkData): Effect.Effect<ChunkData, ChunkDataValidationError> =>
  Effect.gen(function* () {
    const originalBlocks = toBlockArray(chunk.blocks)
    const frequencyMap = toFrequencyMap(originalBlocks)
    const ordered = sortByFrequency(frequencyMap)
    const rankMap = toRankMap(ordered)
    const keepThreshold = Math.floor(ordered.length * 0.9)
    const replacement = ordered.at(0)?.[0] ?? 0

    const optimizedBlocks = pipe(
      originalBlocks,
      Arr.map((blockId) =>
        pipe(
          Option.fromNullable(rankMap.get(blockId)),
          Option.match({
            onNone: () => blockId,
            onSome: (rank) =>
              pipe(
                frequencyMap.get(blockId) ?? 0,
                (frequency) => rank >= keepThreshold && frequency < 10,
                Match.value,
                Match.when(true, () => replacement),
                Match.orElse(() => blockId)
              ),
          })
        )
      )
    )

    return yield* finalizeOptimization(chunk, 'memory', optimizedBlocks, {
      originalBlockCount: chunk.blocks.length,
      optimizedBlockCount: optimizedBlocks.length,
      compressionRatio: optimizedBlocks.length / Math.max(1, chunk.blocks.length),
    })
  })

const compressionOptimization = (
  chunk: ChunkData,
  algorithm: CompressionAlgorithm
): Effect.Effect<ChunkData, ChunkDataValidationError> =>
  Effect.gen(function* () {
    const originalBlocks = toBlockArray(chunk.blocks)
    const optimizedBlocks = Match.value(algorithm).pipe(
      Match.when('rle', () => runLengthEncode(originalBlocks)),
      Match.when('delta', () => deltaEncode(originalBlocks)),
      Match.when('palette', () => paletteEncode(originalBlocks)),
      Match.exhaustive
    )

    const paletteSize = Match.value(algorithm).pipe(
      Match.when('palette', () => new Set(originalBlocks).size),
      Match.orElse(() => undefined)
    )

    return yield* finalizeOptimization(chunk, 'compression', optimizedBlocks, {
      algorithm,
      originalBlockCount: chunk.blocks.length,
      optimizedBlockCount: optimizedBlocks.length,
      compressionRatio: optimizedBlocks.length / Math.max(1, chunk.blocks.length),
      paletteSize,
    })
  })

const accessOptimization = (
  chunk: ChunkData,
  accessPatterns: ReadonlyArray<AccessPattern>,
  cacheSize?: number
): Effect.Effect<ChunkData, ChunkDataValidationError> =>
  Effect.gen(function* () {
    const frequencyMap = accessPatterns.reduce<Map<number, number>>((map, pattern) => {
      const index = pattern.y * blocksPerLayer + pattern.z * CHUNK_SIZE + pattern.x
      return pipe(
        index,
        Option.fromPredicate((value) => value >= 0 && value < chunk.blocks.length),
        Option.match({
          onNone: () => map,
          onSome: (validIndex) => {
            map.set(validIndex, (map.get(validIndex) ?? 0) + pattern.frequency)
            return map
          },
        })
      )
    }, new Map<number, number>())

    const accessOrder = pipe(
      Num.Order,
      Order.mapInput((index: number) => frequencyMap.get(index) ?? 0),
      Order.reverse
    )

    const sortedIndices = Arr.sort(
      Array.from({ length: chunk.blocks.length }, (_, index) => index),
      accessOrder
    )

    const optimizedBlocks = sortedIndices.map((originIndex) => chunk.blocks[originIndex] ?? 0)

    const size = cacheSize ?? accessPatterns.length

    return yield* finalizeOptimization(chunk, 'access', optimizedBlocks, {
      cacheSize: size,
      originalBlockCount: chunk.blocks.length,
      optimizedBlockCount: optimizedBlocks.length,
    })
  })

const eliminateRedundancyInternal = (
  chunk: ChunkData,
  threshold: number
): Effect.Effect<ChunkData, ChunkDataValidationError> =>
  Effect.gen(function* () {
    const normalized = clamp01(threshold)
    const originalBlocks = toBlockArray(chunk.blocks)
    const frequencyMap = toFrequencyMap(originalBlocks)
    const totalBlocks = originalBlocks.length

    const dominantBlocks = pipe(
      frequencyMap,
      sortByFrequency,
      Arr.filter(([, frequency]) => frequency / Math.max(1, totalBlocks) >= normalized)
    )

    const fallback = dominantBlocks.at(0)?.[0] ?? 0

    const optimizedBlocks = pipe(
      originalBlocks,
      Arr.map((blockId) =>
        pipe(
          frequencyMap.get(blockId) ?? 0,
          (frequency) => frequency / Math.max(1, totalBlocks) >= normalized,
          Match.value,
          Match.when(true, () => fallback),
          Match.orElse(() => blockId)
        )
      )
    )

    const optimizedFrequency = toFrequencyMap(optimizedBlocks)

    return yield* finalizeOptimization(chunk, 'redundancy', optimizedBlocks, {
      originalBlockCount: chunk.blocks.length,
      optimizedBlockCount: optimizedBlocks.length,
      redundancyBefore: calculateRedundancy(frequencyMap, totalBlocks),
      redundancyAfter: calculateRedundancy(optimizedFrequency, optimizedBlocks.length),
      threshold: normalized,
    })
  })

const defragmentInternal = (chunk: ChunkData): Effect.Effect<ChunkData, ChunkDataValidationError> =>
  Effect.gen(function* () {
    const originalBlocks = toBlockArray(chunk.blocks)
    const palette = Array.from(new Set(originalBlocks)).sort((a, b) => a - b)
    const mapping = new Map(palette.map((blockId, index) => [blockId, index]))

    const remapped = originalBlocks.map((blockId) => mapping.get(blockId) ?? 0)

    return yield* finalizeOptimization(chunk, 'defragmentation', remapped, {
      originalBlockCount: chunk.blocks.length,
      optimizedBlockCount: remapped.length,
      mappingSize: palette.length,
    })
  })

const computeOptimizationResult = (
  chunk: ChunkData,
  strategy: OptimizationStrategy,
  optimized: ChunkData,
  timeSpent: number
): Effect.Effect<OptimizationResult, ChunkDataValidationError> =>
  Effect.gen(function* () {
    const originalSize = yield* makeBlockCount(chunk.blocks.byteLength)
    const optimizedSize = yield* makeBlockCount(optimized.blocks.byteLength)
    const compressionRatio = yield* makePercentage(clamp01(optimizedSize / Math.max(1, originalSize)))

    const originalUnique = new Set(chunk.blocks).size
    const optimizedUnique = new Set(optimized.blocks).size
    const qualityLoss = yield* makePercentage(
      clamp01(
        pipe(
          originalUnique,
          Match.value,
          Match.when(0, () => 0),
          Match.orElse(() => (originalUnique - optimizedUnique) / Math.max(1, originalUnique))
        )
      )
    )

    return {
      originalSize,
      optimizedSize,
      compressionRatio,
      strategy,
      timeSpent,
      qualityLoss,
      chunk: optimized,
    }
  }).pipe(Effect.mapError(toValidationError))

const analyzeEfficiencyInternal = (chunk: ChunkData): Effect.Effect<OptimizationMetrics, ChunkDataValidationError> =>
  Effect.gen(function* () {
    const blockArray = toBlockArray(chunk.blocks)
    const frequencyMap = toFrequencyMap(blockArray)
    const memoryUsage = yield* makeBlockCount(chunk.blocks.byteLength + JSON.stringify(chunk.metadata).length)

    const maxFrequency = Array.from(frequencyMap.values()).reduce((acc, value) => Math.max(acc, value), 0)

    const compressionRatio = yield* makePercentage(
      blockArray.length === 0 ? 0 : clamp01(maxFrequency / blockArray.length)
    )

    const redundancy = yield* makePercentage(calculateRedundancy(frequencyMap, blockArray.length))

    const accessPatterns = yield* Effect.forEach(sortByFrequency(frequencyMap), ([blockId, frequency]) =>
      Effect.gen(function* () {
        const id = yield* makeBlockId(blockId)
        const freq = yield* makeBlockCount(frequency)
        return { blockId: id, frequency: freq }
      }).pipe(Effect.mapError(toValidationError))
    )

    const timestampValue = yield* Clock.currentTimeMillis
    const timestamp = yield* makeTimestamp(timestampValue)

    const optimizationPotential = yield* makePercentage(
      clamp01(
        Number(redundancy) * 0.4 +
          (Number(compressionRatio) > 0.5 ? 0.3 : 0) +
          (frequencyMap.size < CHUNK_VOLUME * 0.1 ? 0.3 : 0)
      )
    )

    return {
      memoryUsage,
      compressionRatio,
      accessPatterns,
      redundancy,
      timestamp,
      optimizationPotential,
    }
  })

const suggestOptimizationsInternal = (metrics: OptimizationMetrics): ReadonlyArray<OptimizationStrategy> => {
  const suggestions: Array<OptimizationStrategy> = []

  pipe(
    Number(metrics.redundancy) > 0.7,
    Match.value,
    Match.when(true, () => {
      suggestions.push(OptimizationStrategy.MemoryOptimization(true))
      suggestions.push(OptimizationStrategy.RedundancyElimination(0.8))
    })
  )

  pipe(
    Number(metrics.compressionRatio) > 0.6,
    Match.value,
    Match.when(true, () => {
      suggestions.push(OptimizationStrategy.CompressionOptimization('rle'))
    })
  )

  pipe(
    metrics.accessPatterns.at(0)?.frequency,
    Option.fromNullable,
    Option.map((frequency) => Number(frequency) > CHUNK_VOLUME * 0.3),
    Option.filter((flag) => flag),
    Option.match({
      onSome: () => suggestions.push(OptimizationStrategy.AccessOptimization(64)),
      onNone: () => undefined,
    })
  )

  pipe(
    Number(metrics.memoryUsage) > CHUNK_VOLUME * 2.5,
    Match.value,
    Match.when(true, () => suggestions.push(OptimizationStrategy.MemoryOptimization(false)))
  )

  return suggestions
}

export const ChunkOptimizationServiceLive = Layer.effect(
  ChunkOptimizationService,
  Effect.gen(function* () {
    const service: ChunkOptimizationService = {
      optimizeMemory: (chunk) => memoryOptimization(chunk),

      optimizeCompression: (chunk, algorithm = 'rle') => compressionOptimization(chunk, algorithm),

      optimizeAccess: (chunk, patterns = [], cacheSize) =>
        accessOptimization(chunk, patterns, cacheSize ?? patterns.length),

      analyzeEfficiency: (chunk) => analyzeEfficiencyInternal(chunk),

      suggestOptimizations: (metrics) => Effect.succeed(suggestOptimizationsInternal(metrics)),

      applyOptimization: (chunk, strategy) =>
        Effect.gen(function* () {
          const start = yield* Clock.currentTimeMillis

          const optimized = yield* Match.value(strategy).pipe(
            Match.when({ _tag: 'MemoryOptimization' }, () => memoryOptimization(chunk)),
            Match.when({ _tag: 'CompressionOptimization' }, ({ algorithm }) =>
              compressionOptimization(chunk, algorithm)
            ),
            Match.when({ _tag: 'AccessOptimization' }, ({ cacheSize }) => accessOptimization(chunk, [], cacheSize)),
            Match.when({ _tag: 'RedundancyElimination' }, ({ threshold }) =>
              eliminateRedundancyInternal(chunk, threshold)
            ),
            Match.exhaustive
          )

          const end = yield* Clock.currentTimeMillis

          return yield* computeOptimizationResult(chunk, strategy, optimized, end - start)
        }),

      eliminateRedundancy: (chunk, threshold = DEFAULT_REDUNDANCY_THRESHOLD) =>
        eliminateRedundancyInternal(chunk, threshold),

      defragment: (chunk) => defragmentInternal(chunk),
    }

    return service
  })
)
