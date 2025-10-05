import { Schema } from '@effect/schema'
import { describe, expect, it } from '@effect/vitest'
import * as fc from 'effect/FastCheck'
import { Array as Arr, Effect, Layer, Match, Option, pipe } from 'effect'
import { ChunkDataSchema } from '../../aggregate/chunk_data/types'
import { CHUNK_SIZE, CHUNK_VOLUME } from '../../types/core'
import {
  makeBlockCount,
  makePercentage,
  makeTimestamp,
  type ChunkMetadata,
  type ChunkOptimizationRecord,
  type Percentage,
} from '../../value_object/chunk_metadata'
import { ChunkOptimizationService, ChunkOptimizationServiceLive, OptimizationStrategy } from '../chunk_optimizer'

const TestLayer: Layer.Layer<ChunkOptimizationService> = ChunkOptimizationServiceLive

const baseMetadata = {
  biome: 'plains',
  lightLevel: 15,
  isModified: false,
  lastUpdate: 0,
  heightMap: Array.from({ length: CHUNK_SIZE * CHUNK_SIZE }, () => 64),
} satisfies Schema.Schema.Input<ChunkMetadata>

const buildChunk = (
  blocks: Uint16Array,
  metadataOverrides?: Partial<Schema.Schema.Input<ChunkMetadata>>
) =>
  Schema.decodeEffect(ChunkDataSchema)({
    position: { x: 0, z: 0 },
    blocks,
    metadata: { ...baseMetadata, ...metadataOverrides },
    isDirty: false,
  })

const runWithService = <A>(effect: Effect.Effect<A>) => effect.pipe(Effect.provide(TestLayer))

const lastRecord = (metadata: ChunkMetadata): Option.Option<ChunkOptimizationRecord> =>
  pipe(
    metadata.optimizations,
    Option.fromNullable,
    Option.flatMap((records) => Option.fromNullable(records.at(-1)))
  )

const expectRecordStrategy = (
  record: Option.Option<ChunkOptimizationRecord>,
  strategy: ChunkOptimizationRecord['strategy']
) =>
  expect(pipe(record, Option.map((item) => item.strategy), Option.getOrElse(() => undefined))).toBe(strategy)

describe('chunk/domain_service/chunk_optimizer', () => {
  it.effect('optimizeMemory は最適化履歴を記録する', () =>
    runWithService(
      Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        const chunk = yield* buildChunk(new Uint16Array(Array.from({ length: CHUNK_VOLUME }, () => 2)))
        const optimized = yield* service.optimizeMemory(chunk)
        const record = lastRecord(optimized.metadata)

        expectRecordStrategy(record, 'memory')
        expect(record).toSatisfy((entry) => Option.isSome(entry))
        pipe(
          record,
          Option.map((entry) => {
            expect(entry.details?.originalBlockCount).toBe(chunk.blocks.length)
            expect(entry.details?.optimizedBlockCount).toBe(optimized.blocks.length)
          })
        )
      })
    )
  )

  it.effect('optimizeCompression palette はパレット情報を保持する', () =>
    runWithService(
      Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        const paletteBlocks = new Uint16Array(Array.from({ length: CHUNK_VOLUME }, (_, index) => index % 4))
        const chunk = yield* buildChunk(paletteBlocks)
        const optimized = yield* service.optimizeCompression(chunk, 'palette')
        const record = lastRecord(optimized.metadata)

        expectRecordStrategy(record, 'compression')
        pipe(
          record,
          Option.map((entry) => {
            expect(entry.details?.algorithm).toBe('palette')
            expect(entry.details?.paletteSize).toBe(4)
          })
        )
      })
    )
  )

  it.effect('optimizeAccess はキャッシュ情報を記録する', () =>
    runWithService(
      Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        const variedBlocks = new Uint16Array(Array.from({ length: CHUNK_VOLUME }, (_, index) => (index % 8) + 1))
        const chunk = yield* buildChunk(variedBlocks)
        const patterns = [
          { x: 0, y: 0, z: 0, frequency: 40 },
          { x: 1, y: 0, z: 0, frequency: 30 },
        ]
        const optimized = yield* service.optimizeAccess(chunk, patterns, 32)
        const record = lastRecord(optimized.metadata)

        expectRecordStrategy(record, 'access')
        pipe(
          record,
          Option.map((entry) => {
            expect(entry.details?.cacheSize).toBe(32)
            expect(entry.details?.optimizedBlockCount).toBe(optimized.blocks.length)
          })
        )
      })
    )
  )

  it.effect('eliminateRedundancy は冗長性の低減を行う', () =>
    runWithService(
      Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        const dominantBlock = 5
        const minorityBlock = 9
        const blocks = new Uint16Array(
          Array.from({ length: CHUNK_VOLUME }, (_, index) => (index % 5 === 0 ? minorityBlock : dominantBlock))
        )
        const chunk = yield* buildChunk(blocks)
        const optimized = yield* service.eliminateRedundancy(chunk, 0.6)
        const record = lastRecord(optimized.metadata)

        expectRecordStrategy(record, 'redundancy')
        pipe(
          record,
          Option.map((entry) => {
            expect(entry.details?.threshold).toBeCloseTo(0.6, 5)
            expect(entry.details?.redundancyAfter).toBeLessThan(entry.details?.redundancyBefore ?? 1)
          })
        )
      })
    )
  )

  it.effect('defragment はパレットサイズ情報を付加する', () =>
    runWithService(
      Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        const sparseBlocks = new Uint16Array(Array.from({ length: CHUNK_VOLUME }, (_, index) => index % 13))
        const chunk = yield* buildChunk(sparseBlocks)
        const optimized = yield* service.defragment(chunk)
        const record = lastRecord(optimized.metadata)

        expectRecordStrategy(record, 'defragmentation')
        pipe(
          record,
          Option.map((entry) => expect(entry.details?.mappingSize).toBeLessThanOrEqual(13))
        )
      })
    )
  )

  it.effect('applyOptimization は結果を包括的に返す', () =>
    runWithService(
      Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        const chunk = yield* buildChunk(new Uint16Array(Array.from({ length: CHUNK_VOLUME }, () => 3)))
        const result = yield* service.applyOptimization(chunk, OptimizationStrategy.MemoryOptimization())

        expect(Number(result.originalSize)).toBeGreaterThan(0)
        expect(Number(result.optimizedSize)).toBeGreaterThan(0)
        expect(Number(result.compressionRatio)).toBeGreaterThan(0)
        expect(result.strategy._tag).toBe('MemoryOptimization')
        expect(Number(result.qualityLoss)).toBeGreaterThanOrEqual(0)
      })
    )
  )

  it.effect('analyzeEfficiency は強い型のメトリクスを提供する', () =>
    runWithService(
      Effect.gen(function* () {
        const service = yield* ChunkOptimizationService
        const chunk = yield* buildChunk(new Uint16Array(Array.from({ length: CHUNK_VOLUME }, () => 7)))
        const metrics = yield* service.analyzeEfficiency(chunk)

        expect(Number(metrics.memoryUsage)).toBeGreaterThan(0)
        expect(Number(metrics.redundancy)).toBeGreaterThanOrEqual(0)
        expect(metrics.accessPatterns.length).toBeGreaterThan(0)
        expect(Number(metrics.optimizationPotential)).toBeGreaterThanOrEqual(0)
      })
    )
  )

  it('optimizeMemory は元のブロック集合を超えない (PBT)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 1024 }), { minLength: 8, maxLength: 128 }),
        async (values) => {
          const blocks = Uint16Array.from(values)
          const chunk = await buildChunk(blocks).pipe(Effect.runPromise)
          const optimized = await runWithService(
            Effect.gen(function* () {
              const service = yield* ChunkOptimizationService
              return yield* service.optimizeMemory(chunk)
            })
          ).pipe(Effect.runPromise)

          const originalSet = new Set(values)
          const optimizedSet = new Set(Array.from(optimized.blocks))
          optimizedSet.forEach((value) => expect(originalSet.has(value)).toBe(true))
        }
      ),
      { numRuns: 50 }
    )
  })

  it('eliminateRedundancy は閾値未満の冗長度では変換を抑制する (PBT)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 8 }),
        fc.integer({ min: 1, max: 8 }),
        async (dominant, minority) => {
          const dominantBlock = dominant
          const minorityBlock = dominant + minority
          const blocks = new Uint16Array(
            Array.from({ length: CHUNK_VOLUME }, (_, index) => (index % 10 === 0 ? minorityBlock : dominantBlock))
          )
          const chunk = await buildChunk(blocks).pipe(Effect.runPromise)
          const optimized = await runWithService(
            Effect.gen(function* () {
              const service = yield* ChunkOptimizationService
              return yield* service.eliminateRedundancy(chunk, 0.95)
            })
          ).pipe(Effect.runPromise)

          const originalUnique = new Set(Array.from(chunk.blocks)).size
          const optimizedUnique = new Set(Array.from(optimized.blocks)).size
          expect(optimizedUnique).toBeLessThanOrEqual(originalUnique)
        }
      ),
      { numRuns: 30 }
    )
  })
})
