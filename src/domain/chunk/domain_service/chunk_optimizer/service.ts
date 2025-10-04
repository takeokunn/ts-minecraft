import { Clock, Context, Effect, Layer, Match, Option, pipe } from 'effect'
import type { ChunkData } from '../../aggregate/chunk'
import { ChunkDataValidationError } from '../../aggregate/chunk-data'
import { CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_VOLUME } from '../../types/core'

export type OptimizationStrategy =
  | { readonly _tag: 'MemoryOptimization'; readonly aggressive: boolean }
  | { readonly _tag: 'CompressionOptimization'; readonly algorithm: 'rle' | 'delta' | 'palette' }
  | { readonly _tag: 'AccessOptimization'; readonly cacheSize: number }
  | { readonly _tag: 'RedundancyElimination'; readonly threshold: number }

export const OptimizationStrategy = {
  MemoryOptimization: (aggressive = false): OptimizationStrategy => ({
    _tag: 'MemoryOptimization',
    aggressive,
  }),
  CompressionOptimization: (algorithm: 'rle' | 'delta' | 'palette'): OptimizationStrategy => ({
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

export interface OptimizationMetrics {
  readonly memoryUsage: number
  readonly compressionRatio: number
  readonly accessPatterns: ReadonlyArray<{ readonly blockId: number; readonly frequency: number }>
  readonly redundancy: number
  readonly timestamp: number
  readonly optimizationPotential: number
}

export interface OptimizationResult {
  readonly originalSize: number
  readonly optimizedSize: number
  readonly compressionRatio: number
  readonly strategy: OptimizationStrategy
  readonly timeSpent: number
  readonly qualityLoss: number
  readonly chunk: ChunkData
}

export interface ChunkOptimizationService {
  readonly optimizeMemory: (chunk: ChunkData) => Effect.Effect<ChunkData, ChunkDataValidationError>
  readonly optimizeCompression: (chunk: ChunkData, algorithm?: 'rle' | 'delta' | 'palette') => Effect.Effect<ChunkData, ChunkDataValidationError>
  readonly optimizeAccess: (
    chunk: ChunkData,
    accessPatterns?: ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number; readonly frequency: number }>
  ) => Effect.Effect<ChunkData, ChunkDataValidationError>
  readonly analyzeEfficiency: (chunk: ChunkData) => Effect.Effect<OptimizationMetrics, ChunkDataValidationError>
  readonly suggestOptimizations: (metrics: OptimizationMetrics) => Effect.Effect<ReadonlyArray<OptimizationStrategy>, ChunkDataValidationError>
  readonly applyOptimization: (chunk: ChunkData, strategy: OptimizationStrategy) => Effect.Effect<OptimizationResult, ChunkDataValidationError>
  readonly eliminateRedundancy: (chunk: ChunkData, threshold?: number) => Effect.Effect<ChunkData, ChunkDataValidationError>
  readonly defragment: (chunk: ChunkData) => Effect.Effect<ChunkData, ChunkDataValidationError>
}

export const ChunkOptimizationService = Context.GenericTag<ChunkOptimizationService>('ChunkOptimizationService')

const DEFAULT_REDUNDANCY_THRESHOLD = 0.8

const blocksPerLayer = CHUNK_SIZE * CHUNK_SIZE

const toFrequencyMap = (blocks: Uint16Array): Map<number, number> =>
  Array.from(blocks).reduce((acc, blockId) => {
    acc.set(blockId, (acc.get(blockId) ?? 0) + 1)
    return acc
  }, new Map<number, number>())

const sortedByFrequency = (frequencyMap: Map<number, number>): ReadonlyArray<[number, number]> =>
  Array.from(frequencyMap.entries()).sort(([, a], [, b]) => b - a)

const computeOptimizationMetadata = (
  chunk: ChunkData,
  optimizedBlocks: ReadonlyArray<number>
) => ({
  ...chunk,
  blocks: Uint16Array.from(optimizedBlocks),
  metadata: {
    ...chunk.metadata,
    isModified: true,
  },
  isDirty: true,
})

const memoryOptimization = (chunk: ChunkData): Effect.Effect<ChunkData> =>
  Effect.sync(() => {
    const frequencyMap = toFrequencyMap(chunk.blocks)
    const ordered = sortedByFrequency(frequencyMap)
    const keepThreshold = Math.floor(ordered.length * 0.9)
    const rankMap = new Map(ordered.map(([blockId], index) => [blockId, index]))
    const replacementId = ordered.at(0)?.[0] ?? 0

    const optimized = Array.from(chunk.blocks).map((blockId) => {
      const frequency = frequencyMap.get(blockId) ?? 0
      const rank = rankMap.get(blockId) ?? 0
      const shouldReplace = rank >= keepThreshold && frequency < 10
      return pipe(
        shouldReplace,
        Match.value,
        Match.when(true, () => replacementId),
        Match.orElse(() => blockId)
      )
    })

    return computeOptimizationMetadata(chunk, optimized)
  })

const runLengthEncode = (blockArray: ReadonlyArray<number>): ReadonlyArray<number> => {
  const initialState = {
    encoded: [] as ReadonlyArray<{ readonly blockId: number; readonly count: number }>,
    last: Option.none<{ readonly blockId: number; readonly count: number }>(),
  }

  const state = blockArray.reduce((current, blockId) =>
    pipe(
      current.last,
      Option.flatMap((lastEntry) =>
        pipe(
          lastEntry.blockId === blockId && lastEntry.count < 65535,
          Match.value,
          Match.when(true, () =>
            Option.some<{ readonly blockId: number; readonly count: number }>({
              blockId,
              count: lastEntry.count + 1,
            })
          ),
          Match.orElse(() => Option.none<{ readonly blockId: number; readonly count: number }>() )
        )
      ),
      Option.match({
        onSome: (updated) => ({
          encoded: [...current.encoded.slice(0, -1), updated],
          last: Option.some(updated),
        }),
        onNone: () => ({
          encoded: [...current.encoded, { blockId, count: 1 }],
          last: Option.some({ blockId, count: 1 }),
        }),
      })
    ),
    initialState
  )

  return state.encoded.flatMap(({ blockId, count }) => [blockId, count])
}

const applyRunLengthEncoding = (chunk: ChunkData): Effect.Effect<ChunkData> =>
  Effect.sync(() => {
    const blockArray = Array.from(chunk.blocks)
    const encoded = runLengthEncode(blockArray)

    return pipe(
      encoded.length < blockArray.length,
      Match.value,
      Match.when(true, () =>
        computeOptimizationMetadata(chunk, encoded, {
          compression: {
            algorithm: 'rle',
            originalLength: blockArray.length,
            compressedLength: encoded.length,
          },
        })
      ),
      Match.orElse(() => chunk)
    )
  })

const applyDeltaCompression = (chunk: ChunkData): Effect.Effect<ChunkData> =>
  Effect.sync(() => {
    const blockArray = Array.from(chunk.blocks)
    const deltas = blockArray.reduce<ReadonlyArray<number>>((acc, blockId, index) =>
      index === 0
        ? [...acc, blockId]
        : [...acc, blockId - blockArray[index - 1]!] ,
      []
    )

    return computeOptimizationMetadata(chunk, deltas)
  })

const applyPaletteCompression = (chunk: ChunkData): Effect.Effect<ChunkData> =>
  Effect.sync(() => {
    const blockArray = Array.from(chunk.blocks)
    const palette = Array.from(new Set(blockArray))
    const paletteIndex = new Map(palette.map((blockId, index) => [blockId, index]))
    const paletteEncoded = blockArray.map((blockId) => paletteIndex.get(blockId) ?? 0)

    return computeOptimizationMetadata(chunk, paletteEncoded)
  })

const accessOptimization = (
  chunk: ChunkData,
  accessPatterns: ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number; readonly frequency: number }>,
  cacheSize?: number
): Effect.Effect<ChunkData> =>
  Effect.sync(() => {
    const frequencyMap = accessPatterns.reduce((acc, pattern) => {
      const index = pattern.y * blocksPerLayer + pattern.z * CHUNK_SIZE + pattern.x
      if (index >= 0 && index < chunk.blocks.length) {
        acc.set(index, pattern.frequency)
      }
      return acc
    }, new Map<number, number>())

    const sortedIndices = Array.from({ length: chunk.blocks.length }, (_, index) => index)
      .sort((a, b) => (frequencyMap.get(b) ?? 0) - (frequencyMap.get(a) ?? 0))

    const optimized = sortedIndices.map((originIndex) => chunk.blocks[originIndex]!)

    return computeOptimizationMetadata(chunk, optimized)
  })

const analyzeEfficiency = (chunk: ChunkData): Effect.Effect<OptimizationMetrics> =>
  Effect.gen(function* () {
    const blockArray = Array.from(chunk.blocks)
    const frequencyMap = toFrequencyMap(chunk.blocks)
    const memoryUsage = chunk.blocks.byteLength + JSON.stringify(chunk.metadata).length
    const maxFrequency = frequencyMap.size > 0 ? Math.max(...frequencyMap.values()) : 0
    const compressionRatio = blockArray.length === 0 ? 0 : maxFrequency / blockArray.length
    const redundancy = blockArray.length === 0 ? 0 : 1 - frequencyMap.size / blockArray.length
    const accessPatterns = Array.from(frequencyMap.entries())
      .map(([blockId, frequency]) => ({ blockId, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
    const timestamp = yield* Clock.currentTimeMillis
    const optimizationPotential = Math.min(
      redundancy * 0.4 + (compressionRatio > 0.5 ? 0.3 : 0) + (frequencyMap.size < CHUNK_VOLUME * 0.1 ? 0.3 : 0),
      1
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

const suggestOptimizations = (metrics: OptimizationMetrics): Effect.Effect<ReadonlyArray<OptimizationStrategy>> =>
  Effect.sync(() => {
    const redundancySuggestions = pipe(
      metrics.redundancy > 0.7,
      Match.value,
      Match.when(true, () => [
        OptimizationStrategy.MemoryOptimization(true),
        OptimizationStrategy.RedundancyElimination(0.8),
      ]),
      Match.orElse((): ReadonlyArray<OptimizationStrategy> => [])
    )

    const compressionSuggestions = pipe(
      metrics.compressionRatio > 0.6,
      Match.value,
      Match.when(true, () => [OptimizationStrategy.CompressionOptimization('rle')]),
      Match.orElse((): ReadonlyArray<OptimizationStrategy> => [])
    )

    const accessSuggestions = pipe(
      metrics.accessPatterns.at(0)?.frequency ?? 0,
      (topFrequency) => topFrequency > CHUNK_VOLUME * 0.3,
      Match.value,
      Match.when(true, () => [OptimizationStrategy.AccessOptimization(64)]),
      Match.orElse((): ReadonlyArray<OptimizationStrategy> => [])
    )

    const memorySuggestions = pipe(
      metrics.memoryUsage > CHUNK_VOLUME * 2.5,
      Match.value,
      Match.when(true, () => [OptimizationStrategy.MemoryOptimization(false)]),
      Match.orElse((): ReadonlyArray<OptimizationStrategy> => [])
    )

    return [
      ...redundancySuggestions,
      ...compressionSuggestions,
      ...accessSuggestions,
      ...memorySuggestions,
    ]
  })

const eliminateRedundancy = (chunk: ChunkData, threshold: number): Effect.Effect<ChunkData> =>
  Effect.sync(() => {
    const frequencyMap = toFrequencyMap(chunk.blocks)
    const totalBlocks = chunk.blocks.length

    const dominantBlocks = Array.from(frequencyMap.entries())
      .filter(([, frequency]) => frequency / totalBlocks >= threshold)
      .map(([blockId]) => blockId)

    const fallback = dominantBlocks.at(0) ?? 0

    const optimized = Array.from(chunk.blocks).map((blockId) =>
      pipe(
        frequencyMap.get(blockId) ?? 0,
        (frequency) => frequency / totalBlocks >= threshold,
        Match.value,
        Match.when(true, () => fallback),
        Match.orElse(() => blockId)
      )
    )

    return computeOptimizationMetadata(chunk, optimized)
  })

const defragment = (chunk: ChunkData): Effect.Effect<ChunkData> =>
  Effect.sync(() => {
    const palette = Array.from(new Set(chunk.blocks)).sort((a, b) => a - b)
    const mapping = new Map(palette.map((blockId, index) => [blockId, index]))
    const remapped = Array.from(chunk.blocks).map((blockId) => mapping.get(blockId) ?? 0)

    return computeOptimizationMetadata(chunk, remapped)
  })

const compressionOptimization = (chunk: ChunkData, algorithm: 'rle' | 'delta' | 'palette'): Effect.Effect<ChunkData> =>
  Match.value(algorithm).pipe(
    Match.when('rle', () => applyRunLengthEncoding(chunk)),
    Match.when('delta', () => applyDeltaCompression(chunk)),
    Match.when('palette', () => applyPaletteCompression(chunk)),
    Match.exhaustive
  )

export const ChunkOptimizationServiceLive = Layer.effect(
  ChunkOptimizationService,
  Effect.gen(function* () {
    const service: ChunkOptimizationService = {
      optimizeMemory: (chunk) => memoryOptimization(chunk),

      optimizeCompression: (chunk, algorithm = 'rle') => compressionOptimization(chunk, algorithm),

      optimizeAccess: (chunk, patterns = []) => accessOptimization(chunk, patterns, patterns.length),

      analyzeEfficiency: (chunk) => analyzeEfficiency(chunk),

      suggestOptimizations: (metrics) => suggestOptimizations(metrics),

      applyOptimization: (chunk, strategy) =>
        Effect.gen(function* () {
          const startTime = yield* Clock.currentTimeMillis

          const optimizedChunk = yield* Match.value(strategy).pipe(
            Match.when({ _tag: 'MemoryOptimization' }, () => memoryOptimization(chunk)),
            Match.when({ _tag: 'CompressionOptimization' }, ({ algorithm }) =>
              compressionOptimization(chunk, algorithm)
            ),
            Match.when({ _tag: 'AccessOptimization' }, ({ cacheSize }) =>
              accessOptimization(chunk, [], cacheSize)
            ),
            Match.when({ _tag: 'RedundancyElimination' }, ({ threshold }) =>
              eliminateRedundancy(chunk, threshold)
            ),
            Match.exhaustive
          )

          const optimizedSize = optimizedChunk.blocks.byteLength
          const originalSize = chunk.blocks.byteLength
          const qualityLoss = Math.max(
            0,
            (new Set(chunk.blocks).size - new Set(optimizedChunk.blocks).size) /
              Math.max(1, new Set(chunk.blocks).size)
          )
          const endTime = yield* Clock.currentTimeMillis

          return {
            originalSize,
            optimizedSize,
            compressionRatio: optimizedSize / Math.max(1, originalSize),
            strategy,
            timeSpent: endTime - startTime,
            qualityLoss,
            chunk: optimizedChunk,
          }
        }),

      eliminateRedundancy: (chunk, threshold = DEFAULT_REDUNDANCY_THRESHOLD) =>
        eliminateRedundancy(chunk, threshold),

      defragment: (chunk) => defragment(chunk),
    }

    return service
  })
)
