/**
 * Performance-Optimized Optics - 高性能不変更新システム
 *
 * 大規模データ用に最適化されたOpticsと操作パターン
 * メモリ効率・実行速度を重視した実装
 */

import {
  Cache,
  Chunk as EffectChunk,
  Duration,
  Effect,
  Match,
  Option,
  pipe,
} from 'effect'
import type { ChunkData } from '../chunk_data/types'
import type { HeightValue } from '../../value_object/chunk_metadata'
import { ChunkDataOptics } from './optics'

/**
 * 高性能ブロック操作用のOptimized Optics
 * 大規模データでの効率的な操作を実現
 */
export const OptimizedChunkOptics = {
  /**
   * 遅延評価によるブロック更新
   * 更新処理を遅延させて必要時のみ実行
   * @param chunk - 対象チャンクデータ
   * @param updates - 更新データの配列
   */
  lazyBlockUpdate: (
    chunk: ChunkData,
    updates: ReadonlyArray<{ index: number; blockId: number }>
  ): Effect.Effect<ChunkData> =>
    Effect.gen(function* () {
      // 更新を遅延評価でバッチ処理
      const lazyUpdates = updates.map(({ index, blockId }) =>
        Effect.sync(() =>
          ChunkDataOptics.blockAt(index).replace(blockId)
        )
      )

      // バッチサイズを動的に調整
      const batchSize = Math.min(512, Math.max(64, updates.length / 4))
      const batches = EffectChunk.fromIterable(lazyUpdates)

      return yield* pipe(
        EffectChunk.chunksOf(batches, batchSize),
        Effect.reduce(chunk, (acc, batch) =>
          Effect.gen(function* () {
            const operations = yield* Effect.all(batch)
            return operations.reduce((chunkAcc, op) => op(chunkAcc), acc)
          })
        )
      )
    }),

  /**
   * バッチ更新用のOptics
   * 複数の更新を効率的にまとめて実行
   * @param chunk - 対象チャンクデータ
   * @param blockUpdates - ブロック更新のMap
   */
  batchBlockUpdate: (
    chunk: ChunkData,
    blockUpdates: ReadonlyMap<number, number>
  ): ChunkData => {
    // MapをArrayに変換してtraverseで効率的に処理
    const updates = Array.from(blockUpdates.entries())

    // 更新を1回のパスで適用（copy-on-writeを最小化）
    return updates.reduce(
      (acc, [index, blockId]) =>
        ChunkDataOptics.blockAt(index).replace(blockId)(acc),
      chunk
    )
  },

  /**
   * 条件付き高性能更新
   * 変更が必要な箇所のみを効率的に更新
   * @param chunk - 対象チャンクデータ
   * @param predicate - 更新条件
   * @param transform - 変換関数
   */
  conditionalUpdate: (
    chunk: ChunkData,
    predicate: (blockId: number, index: number) => boolean,
    transform: (blockId: number) => number
  ): Effect.Effect<ChunkData> =>
    Effect.gen(function* () {
      const blocks = chunk.blocks
      const changeMap = new Map<number, number>()

      // 変更が必要な箇所のみを特定（EffectChunkによる並列処理）
      const blockIndices = Array.from({ length: blocks.length }, (_, i) => i)
      
      yield* pipe(
        EffectChunk.fromIterable(blockIndices),
        EffectChunk.forEach((i) =>
          Effect.sync(() => {
            const currentBlock = blocks[i]
            return pipe(
              predicate(currentBlock, i),
              Match.value,
              Match.when(true, () => {
                const newBlock = transform(currentBlock)
                return pipe(
                  newBlock !== currentBlock,
                  Match.value,
                  Match.when(true, () => changeMap.set(i, newBlock)),
                  Match.when(false, () => {}),
                  Match.exhaustive
                )
              }),
              Match.when(false, () => {}),
              Match.exhaustive
            )
          }),
          { concurrency: 'unbounded' }
        )
      )

      // 変更がない場合は元のオブジェクトを返す
      return pipe(
        changeMap.size === 0,
        Match.value,
        Match.when(true, () => chunk),
        Match.when(false, () => OptimizedChunkOptics.batchBlockUpdate(chunk, changeMap)),
        Match.exhaustive
      )
    }),

  /**
   * メモリ効率的な領域コピー
   * 指定領域のブロックを効率的にコピー
   * @param sourceChunk - コピー元チャンク
   * @param targetChunk - コピー先チャンク
   * @param sourceRegion - コピー元領域
   * @param targetOffset - コピー先オフセット
   */
  efficientRegionCopy: (
    sourceChunk: ChunkData,
    targetChunk: ChunkData,
    sourceRegion: { x: number; y: number; z: number; width: number; height: number; depth: number },
    targetOffset: { x: number; y: number; z: number }
  ): Effect.Effect<ChunkData> =>
    Effect.gen(function* () {
      const updates = new Map<number, number>()

      // 3D領域をEffectChunkで並列処理
      const yRange = Array.from({ length: sourceRegion.height }, (_, i) => i)
      
      yield* pipe(
        EffectChunk.fromIterable(yRange),
        EffectChunk.forEach((y) =>
          Effect.gen(function* () {
            const zRange = Array.from({ length: sourceRegion.depth }, (_, i) => i)
            
            yield* pipe(
              EffectChunk.fromIterable(zRange),
              EffectChunk.forEach((z) =>
                Effect.gen(function* () {
                  const xRange = Array.from({ length: sourceRegion.width }, (_, i) => i)
                  
                  yield* pipe(
                    EffectChunk.fromIterable(xRange),
                    EffectChunk.forEach((x) =>
                      Effect.sync(() => {
                        // ソース座標
                        const srcX = sourceRegion.x + x
                        const srcY = sourceRegion.y + y
                        const srcZ = sourceRegion.z + z
                        const srcIndex = srcY * 256 + srcZ * 16 + srcX

                        // ターゲット座標
                        const tgtX = targetOffset.x + x
                        const tgtY = targetOffset.y + y
                        const tgtZ = targetOffset.z + z
                        const tgtIndex = tgtY * 256 + tgtZ * 16 + tgtX

                        // 境界チェック（Match.valueによる安全な条件分岐）
                        return pipe(
                          srcIndex < sourceChunk.blocks.length &&
                          tgtIndex < targetChunk.blocks.length &&
                          tgtX >= 0 && tgtX < 16 &&
                          tgtY >= 0 && tgtY < 384 &&
                          tgtZ >= 0 && tgtZ < 16,
                          Match.value,
                          Match.when(true, () => 
                            updates.set(tgtIndex, sourceChunk.blocks[srcIndex])
                          ),
                          Match.when(false, () => {}),
                          Match.exhaustive
                        )
                      })
                    ),
                    { concurrency: 'unbounded' }
                  )
                }),
                { concurrency: 'unbounded' }
              )
            )
          }),
          { concurrency: 'unbounded' }
        )
      )

      return OptimizedChunkOptics.batchBlockUpdate(targetChunk, updates)
    }),
} as const

/**
 * キャッシュ機能付きの高性能Optics操作
 */
export const CachedChunkOptics = {
  /**
   * ブロック統計のキャッシュ付き計算
   * 頻繁にアクセスされる統計情報をキャッシュ
   */
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
            diversityIndex: 0
          }

          // 統計を関数型パターンで並列計算
          const blockStats = pipe(
            Chunk.fromIterable(blocks),
            Chunk.reduce(
              {
                counts: new Map<number, number>(),
                maxCount: 0,
                mostCommon: 0,
                emptyBlocks: 0
              },
              (acc, blockId) => {
                const newEmptyBlocks = blockId === 0 ? acc.emptyBlocks + 1 : acc.emptyBlocks
                const count = (acc.counts.get(blockId) || 0) + 1
                const newCounts = new Map(acc.counts).set(blockId, count)
                const isNewMax = count > acc.maxCount

                return {
                  counts: newCounts,
                  maxCount: isNewMax ? count : acc.maxCount,
                  mostCommon: isNewMax ? blockId : acc.mostCommon,
                  emptyBlocks: newEmptyBlocks
                }
              }
            )
          )

          stats.emptyBlocks = blockStats.emptyBlocks
          const counts = blockStats.counts
          const mostCommon = blockStats.mostCommon

          stats.blockCounts = counts
          stats.mostCommonBlock = mostCommon
          stats.diversityIndex = counts.size / blocks.length

          return stats
        })
    }),

  /**
   * 高さマップの最適化されたキャッシュ付きアクセス
   */
  createHeightMapCache: () =>
    Cache.make({
      capacity: 50,
      timeToLive: Duration.minutes(10),
      lookup: (chunk: ChunkData) =>
        Effect.sync(() => {
          const heightMap = chunk.metadata.heightMap
          return {
            maxHeight: Math.max(...heightMap),
            minHeight: Math.min(...heightMap),
            averageHeight: heightMap.reduce((sum, h) => sum + h, 0) / heightMap.length,
            heightVariance: calculateVariance(heightMap)
          }
        })
    }),
} as const

/**
 * ストリーミング処理用のOptics
 * 大容量データの段階的処理を実現
 */
export const StreamingChunkOptics = {
  /**
   * ブロック配列のストリーミング処理
   * 大きな配列を小さなチャンクに分けて段階的に処理
   * @param chunk - 対象チャンクデータ
   * @param processor - 各チャンクの処理関数
   * @param chunkSize - 処理チャンクサイズ
   */
  streamBlockProcessing: (
    chunk: ChunkData,
    processor: (blockChunk: ReadonlyArray<number>, startIndex: number) => ReadonlyArray<number>,
    chunkSize: number = 1024
  ): Effect.Effect<ChunkData> =>
    Effect.gen(function* () {
      const blocks = Array.from(chunk.blocks)
      const processedBlocks: number[] = []

      // ストリーミング処理をEffectChunkで実装
      const chunkIndices = Array.from(
        { length: Math.ceil(blocks.length / chunkSize) }, 
        (_, i) => i
      )

      yield* pipe(
        EffectChunk.fromIterable(chunkIndices),
        EffectChunk.forEach((chunkIndex) =>
          Effect.gen(function* () {
            const startIndex = chunkIndex * chunkSize
            const endIndex = Math.min(startIndex + chunkSize, blocks.length)
            const blockChunk = blocks.slice(startIndex, endIndex)

            const processed = processor(blockChunk, startIndex)
            processedBlocks.push(...processed)

            // 必要に応じて処理を一時停止してGCに時間を与える
            return yield* pipe(
              (chunkIndex * chunkSize) % (chunkSize * 10) === 0,
              Match.value,
              Match.when(true, () => Effect.sleep(Duration.millis(0))), // マイクロタスクキューに制御を渡す
              Match.when(false, () => Effect.succeed(undefined)),
              Match.exhaustive
            )
          })
        )
      )

      return pipe(
        chunk,
        ChunkDataOptics.blocks.replace(new Uint16Array(processedBlocks))
      )
    }),

  /**
   * 並列ストリーミング処理
   * 複数のワーカーで並列にストリーミング処理を実行
   * @param chunk - 対象チャンクデータ
   * @param processor - 処理関数
   * @param workerCount - ワーカー数
   */
  parallelStreamProcessing: (
    chunk: ChunkData,
    processor: (blockChunk: ReadonlyArray<number>, startIndex: number) => ReadonlyArray<number>,
    workerCount: number = 4
  ): Effect.Effect<ChunkData> =>
    Effect.gen(function* () {
      const blocks = Array.from(chunk.blocks)
      const chunkSize = Math.ceil(blocks.length / workerCount)

      // ワーカータスクをEffectChunkで並列実行
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
              processed: processor(blockChunk, startIndex)
            }
          }),
          { concurrency: 'unbounded' } // 完全な並列実行
        ),
        EffectChunk.runCollect
      )

      // 結果をマージ（Effect.genで安全に処理）
      const processedBlocks = yield* Effect.sync(() => {
        const result = new Array(blocks.length)
        results.forEach(({ startIndex, processed }) => {
          processed.forEach((block, index) => {
            result[startIndex + index] = block
          })
        })
        return result
      })

      return pipe(
        chunk,
        ChunkDataOptics.blocks.replace(new Uint16Array(processedBlocks))
      )
    }),
} as const

/**
 * メモリ最適化ユーティリティ
 */
export const MemoryOptimizedOptics = {
  /**
   * Copy-on-Write最適化
   * 変更が必要な場合のみコピーを作成
   * @param chunk - 対象チャンク
   * @param updateFunction - 更新関数
   */
  copyOnWrite: <T>(
    chunk: ChunkData,
    updateFunction: (chunk: ChunkData) => ChunkData
  ): ChunkData => {
    const updated = updateFunction(chunk)

    // 参照が同じ場合は変更なしとして元のオブジェクトを返す
    return pipe(
      updated === chunk,
      Match.value,
      Match.when(true, () => chunk),
      Match.when(false, () => updated),
      Match.exhaustive
    )
  },

  /**
   * 構造共有の最適化
   * 変更されていない部分は元の構造を再利用
   * @param chunk - 対象チャンク
   * @param changes - 変更箇所のマップ
   */
  structuralSharing: (
    chunk: ChunkData,
    changes: Partial<ChunkData>
  ): ChunkData => {
    // 変更がない場合は元のオブジェクトを返す
    return pipe(
      Object.keys(changes).length === 0,
      Match.value,
      Match.when(true, () => chunk),
      Match.when(false, () => ({ ...chunk, ...changes })),
      Match.exhaustive
    )
  },

  /**
   * ガベージコレクション最適化
   * 大きなオブジェクトの効率的な処理
   * @param chunk - 対象チャンク
   * @param operation - 操作関数
   */
  gcOptimized: <T>(
    chunk: ChunkData,
    operation: (chunk: ChunkData) => Effect.Effect<ChunkData>
  ): Effect.Effect<ChunkData> =>
    Effect.gen(function* () {
      // 処理前に明示的にGCヒントを提供
      yield* Effect.sync(() =>
        pipe(
          typeof global !== 'undefined' && global.gc,
          Match.value,
          Match.when(true, () => global.gc!()),
          Match.when(false, () => {}),
          Match.exhaustive
        )
      )

      const result = yield* operation(chunk)

      // 処理後にも必要に応じてGCヒント
      yield* Effect.sync(() =>
        pipe(
          typeof global !== 'undefined' && global.gc,
          Match.value,
          Match.when(true, () => global.gc!()),
          Match.when(false, () => {}),
          Match.exhaustive
        )
      )

      return result
    }),
} as const

/**
 * パフォーマンス計測ユーティリティ
 */
export const PerformanceMonitoring = {
  /**
   * 操作時間の計測
   * @param operationName - 操作名
   * @param operation - 計測対象の操作
   */
  measureOperation: <A>(
    operationName: string,
    operation: Effect.Effect<A>
  ): Effect.Effect<A> =>
    Effect.gen(function* () {
      const startTime = yield* Effect.sync(() => performance.now())
      const result = yield* operation
      const endTime = yield* Effect.sync(() => performance.now())

      yield* Effect.sync(() => {
        console.debug(`${operationName} took ${endTime - startTime}ms`)
      })

      return result
    }),

  /**
   * メモリ使用量の監視
   * @param operation - 監視対象の操作
   */
  monitorMemory: <A>(operation: Effect.Effect<A>): Effect.Effect<A> =>
    Effect.gen(function* () {
      const beforeMemory = yield* Effect.sync(() =>
        (performance as any).memory?.usedJSHeapSize || 0
      )

      const result = yield* operation

      const afterMemory = yield* Effect.sync(() =>
        (performance as any).memory?.usedJSHeapSize || 0
      )

      yield* pipe(
        afterMemory - beforeMemory,
        (difference) => difference > 1024 * 1024,
        Match.value,
        Match.when(true, () =>
          Effect.sync(() =>
            console.warn(`Memory usage increased by ${(afterMemory - beforeMemory) / 1024 / 1024}MB`)
          )
        ),
        Match.orElse(() => Effect.unit)
      )

      return result
    }),
} as const

// ヘルパー関数
const calculateVariance = (values: ReadonlyArray<number>): number => {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length
}

/**
 * パフォーマンス最適化Optics用の型定義
 */
export type OptimizedOperation<T> = (chunk: ChunkData) => Effect.Effect<T>
export type BatchOperation = ReadonlyMap<number, number>
export type StreamProcessor<T> = (chunk: ReadonlyArray<number>, startIndex: number) => ReadonlyArray<T>
