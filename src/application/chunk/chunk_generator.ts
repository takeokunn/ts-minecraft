/**
 * @fileoverview Parallel Chunk Generator - Fiber並列化によるチャンク生成
 *
 * FIBER_STM_QUEUE_POOL_STREAM_DESIGN.md H-1実装
 * チャンク生成の並列化をFiber + Effect.forEachで実現
 */

import { WorldStateSTMTag } from '@/application/world/world_state_stm'
import type { ChunkData } from '@/domain/world/types/core/world_types'
import type { WorldSeed } from '@/domain/world/value_object'
import { ChunkCoordinateSchema, makeUnsafeWorldCoordinate2D } from '@/domain/biome/value_object/coordinates'
import type { ChunkCoordinate } from '@/domain/biome/value_object/coordinates/chunk_coordinate'
import { PerlinNoiseService, type PerlinNoiseConfig } from '@domain/world_generation/domain_service/noise_generation'
import { ErrorCauseSchema } from '@shared/schema/error'
import { makeErrorFactory } from '@shared/schema/tagged_error_factory'
import { Clock, Context, DateTime, Effect, Fiber, HashSet, Layer, Match, Option, Order, ReadonlyArray, Schema, Stream, pipe } from 'effect'

/**
 * チャンク生成エラー
 */
export const ChunkGenerationErrorSchema = Schema.TaggedError('ChunkGenerationError', {
  message: Schema.String,
  coordinate: ChunkCoordinateSchema,
  cause: ErrorCauseSchema,
})
export type ChunkGenerationError = Schema.Schema.Type<typeof ChunkGenerationErrorSchema>
export const ChunkGenerationError = makeErrorFactory(ChunkGenerationErrorSchema)

/**
 * Parallel Chunk Generator Service
 *
 * Fiberベースの並列チャンク生成を提供
 */
export interface ParallelChunkGenerator {
  /**
   * チャンクを並列生成（concurrency制限付き）
   *
   * @param coordinates - 生成対象のチャンク座標リスト
   * @param options - 並列度制御オプション
   * @returns 生成されたチャンクデータの配列
   */
  readonly generateParallel: (
    coordinates: ReadonlyArray<ChunkCoordinate>,
    options?: { concurrency?: number }
  ) => Effect.Effect<ReadonlyArray<ChunkData>, ChunkGenerationError>

  /**
   * バックグラウンドでチャンクを並列生成
   *
   * @param coordinates - 生成対象のチャンク座標リスト
   * @param options - 並列度制御オプション
   * @returns 実行中のFiber（Fiber.awaitで待機・結果取得可能）
   */
  readonly generateInBackground: (
    coordinates: ReadonlyArray<ChunkCoordinate>,
    options?: { concurrency?: number }
  ) => Effect.Effect<Fiber.RuntimeFiber<ReadonlyArray<ChunkData>, ChunkGenerationError>>

  /**
   * Fiberの実行結果を待機して取得
   *
   * @param fiber - 待機対象のFiber
   * @returns チャンクデータの配列
   */
  readonly awaitGeneration: (
    fiber: Fiber.RuntimeFiber<ReadonlyArray<ChunkData>, ChunkGenerationError>
  ) => Effect.Effect<ReadonlyArray<ChunkData>, ChunkGenerationError>
}

/**
 * ParallelChunkGenerator Service Tag
 */
export const ParallelChunkGeneratorTag = Context.GenericTag<ParallelChunkGenerator>(
  '@minecraft/application/chunk/ParallelChunkGenerator'
)

/**
 * チャンク生成の基底関数（モック実装）
 *
 * 実際の実装では、WorldGeneratorやTerrainGeneratorを呼び出す
 *
 * @param coordinate - チャンク座標
 * @returns 生成されたチャンクデータ
 */
const CHUNK_SIZE = 16
const BASE_HEIGHT = 62
const HEIGHT_VARIANCE = 24
const SEA_LEVEL = 62

const buildNoiseConfig = (seed: bigint): PerlinNoiseConfig => ({
  frequency: 0.0125,
  amplitude: 1,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2,
  seed,
  gradientMode: 'improved',
  interpolation: 'quintic',
  enableVectorization: false,
})

type SeedLike = WorldSeed | number | bigint | { readonly value: number | bigint }

const normalizeSeed = (seed: SeedLike | null | undefined): bigint =>
  pipe(
    Option.fromNullable(seed),
    Match.value,
    Match.tag('None', () => 0n),
    Match.tag('Some', ({ value }) =>
      pipe(
        Match.value(value),
        Match.when((candidate): candidate is bigint => typeof candidate === 'bigint', (candidate) => candidate),
        Match.when((candidate): candidate is number => typeof candidate === 'number', (candidate) =>
          BigInt(Math.trunc(candidate))
        ),
        Match.when(
          (candidate): candidate is { readonly value: number | bigint } =>
            typeof candidate === 'object' && candidate !== null && 'value' in candidate,
          (candidate) =>
            pipe(
              candidate.value,
              Match.value,
              Match.when((inner): inner is bigint => typeof inner === 'bigint', (inner) => inner),
              Match.when((inner): inner is number => typeof inner === 'number', (inner) =>
                BigInt(Math.trunc(inner))
              ),
              Match.orElse(() => 0n),
              Match.exhaustive
            )
        ),
        Match.orElse(() => 0n),
        Match.exhaustive
      )
    ),
    Match.exhaustive
  )

const generateSingleChunk = (coordinate: ChunkCoordinate): Effect.Effect<ChunkData, ChunkGenerationError> =>
  Effect.gen(function* () {
    const start = yield* Clock.currentTimeMillis
    const worldState = yield* WorldStateSTMTag
    const metadata = yield* worldState.getMetadata()
    const perlin = yield* PerlinNoiseService
    const worldType = metadata.settings.worldType

    const variance = pipe(
      Match.value(worldType),
      Match.when('amplified', () => HEIGHT_VARIANCE * 2),
      Match.when('superflat', () => HEIGHT_VARIANCE * 0.25),
      Match.orElse(() => HEIGHT_VARIANCE),
      Match.exhaustive
    )
    const baseHeight = pipe(
      Match.value(worldType),
      Match.when('superflat', () => SEA_LEVEL),
      Match.orElse(() => BASE_HEIGHT),
      Match.exhaustive
    )

    const noiseConfig = buildNoiseConfig(normalizeSeed(metadata.seed))

    const chunkX = Number(coordinate.x)
    const chunkZ = Number(coordinate.z)
    const worldBaseX = chunkX * CHUNK_SIZE
    const worldBaseZ = chunkZ * CHUNK_SIZE

    const localPositions = pipe(
      ReadonlyArray.range(0, CHUNK_SIZE - 1),
      ReadonlyArray.flatMap((localZ) =>
        pipe(
          ReadonlyArray.range(0, CHUNK_SIZE - 1),
          ReadonlyArray.map((localX) => ({
            localX,
            localZ,
            worldCoord: makeUnsafeWorldCoordinate2D(worldBaseX + localX, worldBaseZ + localZ),
          }))
        )
      )
    )

    const samples = yield* pipe(
      localPositions,
      Effect.forEach(({ localX, localZ, worldCoord }) =>
        Effect.gen(function* () {
          const noiseSample = yield* perlin.sample2D(worldCoord, noiseConfig)

          const normalized = (noiseSample.value + 1) / 2
          const targetHeight = Math.round(baseHeight + (normalized - 0.5) * 2 * variance)
          const clampedHeight = Math.max(-64, Math.min(256, targetHeight))

          const biomeId =
            clampedHeight >= baseHeight + variance * 0.5
              ? 2
              : clampedHeight <= SEA_LEVEL - variance * 0.25
                ? 1
                : 0

          const structure = pipe(
            Match.value(noiseSample.value),
            Match.when((value) => value > 0.88, () => Option.some('peak_outcrop')),
            Match.when((value) => value < -0.92, () => Option.some('subterranean_cavern')),
            Match.orElse(() =>
              pipe(
                Match.value((chunkX + chunkZ) % 32 === 0 && localX === 8 && localZ === 8),
                Match.when(true, () => Option.some('waystone')),
                Match.orElse(() => Option.none<string>()),
                Match.exhaustive
              )
            ),
            Match.exhaustive
          )

          return {
            height: clampedHeight,
            biomeId,
            structure,
          }
        })
      )
    )

    const heightMap = pipe(samples, ReadonlyArray.map((sample) => sample.height), Array.from)
    const biomes = pipe(samples, ReadonlyArray.map((sample) => sample.biomeId), Array.from)
    const structures = pipe(
      samples,
      ReadonlyArray.reduce(HashSet.empty<string>(), (acc, sample) =>
        pipe(
          sample.structure,
          Option.match({
            onNone: () => acc,
            onSome: (tag) => HashSet.add(acc, tag),
          })
        )
      ),
      HashSet.values,
      ReadonlyArray.fromIterable,
      ReadonlyArray.sort(Order.string),
      Array.from
    )

    const generatedAt = yield* DateTime.nowAsDate
    const duration = (yield* Clock.currentTimeMillis) - start

    const chunkData: ChunkData = {
      coordinate,
      heightMap,
      biomes,
      structures,
      generatedAt,
    }

    const minHeight = Math.min(...heightMap)
    const maxHeight = Math.max(...heightMap)

    yield* Effect.logInfo(
      `Chunk generated at (${coordinate.x}, ${coordinate.z}) in ${duration} ms (height range ${minHeight}-${maxHeight})`
    )

    return chunkData
  }).pipe(
    Effect.annotateLogs({
      chunkX: String(coordinate.x),
      chunkZ: String(coordinate.z),
      operation: 'chunk_generation',
    }),
    Effect.catchAll((error) =>
      Effect.fail(
        ChunkGenerationError.make({
          message: `Failed to generate chunk at (${coordinate.x}, ${coordinate.z})`,
          coordinate,
          cause: error,
        })
      ).pipe(
        Effect.annotateLogs({
          chunkX: String(coordinate.x),
          chunkZ: String(coordinate.z),
          operation: 'chunk_generation',
          error: 'true',
        })
      )
    )
  )

/**
 * ParallelChunkGenerator Live Implementation
 *
 * Streamベースの並列化でメモリ効率を最適化
 */
export const ParallelChunkGeneratorLive = Layer.succeed(
  ParallelChunkGeneratorTag,
  ParallelChunkGeneratorTag.of({
    generateParallel: (coordinates, options) =>
      Effect.gen(function* () {
        // 動的並行数制御: CPUコア数に基づく自動調整
        const calculateConcurrency = (): number =>
          pipe(
            Option.fromNullable(options?.concurrency),
            Match.value,
            Match.tag('None', () => {
              const cpuCount = pipe(
                Match.value(
                  typeof navigator !== 'undefined' && typeof navigator.hardwareConcurrency === 'number'
                ),
                Match.when(true, () => navigator.hardwareConcurrency as number),
                Match.orElse(() => 4),
                Match.exhaustive
              )

              return Math.min(Math.max(cpuCount, 2), 8)
            }),
            Match.tag('Some', ({ value }) => value),
            Match.exhaustive
          )

        const concurrency = calculateConcurrency()

        yield* Effect.logInfo(
          `Starting parallel chunk generation: ${coordinates.length} chunks, concurrency: ${concurrency} (CPU cores: ${typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency ?? 'unknown') : 'unknown'})`
        )

        // Streamベースの並列処理（メモリ効率化）
        const chunks = yield* Stream.fromIterable(coordinates).pipe(
          Stream.mapEffect((coord) => generateSingleChunk(coord), { concurrency }),
          Stream.runCollect,
          Effect.map((chunk) => Array.from(chunk))
        )

        yield* Effect.logInfo(`Parallel chunk generation completed: ${chunks.length} chunks`)
        return chunks
      }),

    generateInBackground: (coordinates, options) =>
      Effect.gen(function* () {
        yield* Effect.logInfo(`Forking background chunk generation: ${coordinates.length} chunks`)

        // Fiberでバックグラウンド実行
        const fiber = yield* Effect.fork(
          ParallelChunkGeneratorTag.pipe(
            Effect.flatMap((generator) => generator.generateParallel(coordinates, options))
          )
        )

        yield* Effect.logInfo(`Background chunk generation forked`)
        return fiber
      }),

    awaitGeneration: (fiber) =>
      Effect.gen(function* () {
        yield* Effect.logInfo('Awaiting chunk generation fiber...')

        // Fiber実行結果を待機
        const exit = yield* Fiber.await(fiber)

        // Exit結果をEffectに変換
        const chunks = yield* exit

        yield* Effect.logInfo(`Chunk generation fiber completed: ${chunks.length} chunks`)
        return chunks
      }),
  })
)
