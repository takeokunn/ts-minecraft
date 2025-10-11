/**
 * @fileoverview Parallel Chunk Generator - Fiber並列化によるチャンク生成
 *
 * FIBER_STM_QUEUE_POOL_STREAM_DESIGN.md H-1実装
 * チャンク生成の並列化をFiber + Effect.forEachで実現
 */

import type { ChunkData } from '@/domain/world/types/core/world_types'
import type { ChunkCoordinate } from '@/domain/world/value_object/coordinates/chunk_coordinate'
import { Context, Effect, Fiber, Layer, Schema, Stream } from 'effect'

/**
 * チャンク生成エラー
 */
export class ChunkGenerationError extends Schema.TaggedError<ChunkGenerationError>()('ChunkGenerationError', {
  message: Schema.String,
  coordinate: Schema.Unknown, // ChunkCoordinate型
  cause: Schema.Unknown,
}) {}

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
const generateSingleChunk = (coordinate: ChunkCoordinate): Effect.Effect<ChunkData, ChunkGenerationError> =>
  Effect.gen(function* () {
    // TODO: 実際のチャンク生成ロジックに置き換え
    // 例: yield* WorldGeneratorTag.pipe(Effect.flatMap(gen => gen.generateChunk(coordinate)))

    yield* Effect.logInfo(`Generating chunk at (${coordinate.x}, ${coordinate.z})`)

    // シミュレーション: チャンク生成処理（100-500ms）
    yield* Effect.sleep(`${100 + Math.random() * 400} millis`)

    // モックチャンクデータの作成
    const mockChunkData: ChunkData = {
      coordinate,
      blocks: new Uint16Array(16 * 16 * 384), // CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT
      metadata: {
        generatedAt: Date.now(),
        biome: 'plains',
      },
    }

    yield* Effect.logInfo(`Chunk generated successfully at (${coordinate.x}, ${coordinate.z})`)
    return mockChunkData
  }).pipe(
    Effect.catchAll((error) =>
      Effect.fail(
        new ChunkGenerationError({
          message: `Failed to generate chunk at (${coordinate.x}, ${coordinate.z})`,
          coordinate,
          cause: error,
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
        const calculateConcurrency = (): number => {
          if (options?.concurrency !== undefined) {
            return options.concurrency
          }
          const cpuCount = typeof navigator !== 'undefined' && navigator.hardwareConcurrency 
            ? navigator.hardwareConcurrency 
            : 4
          return Math.min(Math.max(cpuCount, 2), 8)
        }

        const concurrency = calculateConcurrency()

        yield* Effect.logInfo(
          `Starting parallel chunk generation: ${coordinates.length} chunks, concurrency: ${concurrency} (CPU cores: ${typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 'unknown' : 'unknown'})`
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
