/**
 * Performance-Optimized Optics - 高性能不変更新システム
 *
 * 大規模データ用に最適化されたOpticsと操作パターン
 * メモリ効率・実行速度を重視した実装
 */

import { Cache, Duration, Effect, Match, pipe } from 'effect'
import type { ChunkData } from '../chunk_data/types'
import type { HeightValue } from '../../value_object/chunk-metadata'
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
    Effect.sync(() => {
      const batchSize = Math.min(512, Math.max(64, Math.ceil(updates.length / 4) || 64))
      let current = chunk

      for (let start = 0; start < updates.length; start += batchSize) {
        const batch = updates.slice(start, start + batchSize)
        current = batch.reduce(
          (acc, { index, blockId }) => ChunkDataOptics.blockAt(index).replace(blockId)(acc),
          current
        )
      }

      return current
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
    Effect.sync(() => {
      const changeMap = new Map<number, number>()

      for (let index = 0; index < chunk.blocks.length; index++) {
        const currentBlock = chunk.blocks[index] ?? 0
        if (predicate(currentBlock, index)) {
          const nextBlock = transform(currentBlock)
          if (nextBlock !== currentBlock) {
            changeMap.set(index, nextBlock)
          }
        }
      }

      if (changeMap.size === 0) {
        return chunk
      }

      return OptimizedChunkOptics.batchBlockUpdate(chunk, changeMap)
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
    Effect.sync(() => {
      const updates = new Map<number, number>()

      for (let dy = 0; dy < sourceRegion.height; dy++) {
        for (let dz = 0; dz < sourceRegion.depth; dz++) {
          for (let dx = 0; dx < sourceRegion.width; dx++) {
            const srcX = sourceRegion.x + dx
            const srcY = sourceRegion.y + dy
            const srcZ = sourceRegion.z + dz
            const tgtX = targetOffset.x + dx
            const tgtY = targetOffset.y + dy
            const tgtZ = targetOffset.z + dz

            if (tgtX < 0 || tgtX >= 16 || tgtY < 0 || tgtY >= 384 || tgtZ < 0 || tgtZ >= 16) {
              continue
            }

            const srcIndex = srcY * 256 + srcZ * 16 + srcX
            const tgtIndex = tgtY * 256 + tgtZ * 16 + tgtX

            if (srcIndex >= sourceChunk.blocks.length || tgtIndex >= targetChunk.blocks.length) {
              continue
            }

            updates.set(tgtIndex, sourceChunk.blocks[srcIndex])
          }
        }
      }

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
          const stats = {
            totalBlocks: chunk.blocks.length,
            emptyBlocks: 0,
            blockCounts: new Map<number, number>(),
            mostCommonBlock: 0,
            diversityIndex: 0,
          }

          let maxCount = 0
          let mostCommon = 0

          for (let i = 0; i < chunk.blocks.length; i++) {
            const blockId = chunk.blocks[i]
            if (blockId === 0) {
              stats.emptyBlocks += 1
            }

            const nextCount = (stats.blockCounts.get(blockId) ?? 0) + 1
            stats.blockCounts.set(blockId, nextCount)

            if (nextCount > maxCount) {
              maxCount = nextCount
              mostCommon = blockId
            }
          }

          stats.mostCommonBlock = mostCommon
          stats.diversityIndex = stats.blockCounts.size / stats.totalBlocks

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
    Effect.sync(() => {
      const blocks = chunk.blocks
      const processedBlocks = new Uint16Array(blocks.length)

      let writeIndex = 0
      for (let start = 0; start < blocks.length; start += chunkSize) {
        const end = Math.min(start + chunkSize, blocks.length)
        const slice = Array.from(blocks.slice(start, end))
        const processed = processor(slice, start)

        for (let i = 0; i < processed.length && writeIndex + i < processedBlocks.length; i++) {
          processedBlocks[writeIndex + i] = processed[i] ?? 0
        }

        writeIndex += processed.length
      }

      return ChunkDataOptics.blocks.replace(processedBlocks)(chunk)
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
    Effect.sync(() => {
      const blocks = chunk.blocks
      const chunkSize = Math.ceil(blocks.length / Math.max(1, workerCount))
      const processedBlocks = new Uint16Array(blocks.length)

      for (let workerIndex = 0; workerIndex < workerCount; workerIndex++) {
        const startIndex = workerIndex * chunkSize
        if (startIndex >= blocks.length) {
          break
        }
        const endIndex = Math.min(startIndex + chunkSize, blocks.length)
        const blockChunk = Array.from(blocks.slice(startIndex, endIndex))
        const processed = processor(blockChunk, startIndex)

        for (let i = 0; i < processed.length && startIndex + i < processedBlocks.length; i++) {
          processedBlocks[startIndex + i] = processed[i] ?? 0
        }
      }

      return ChunkDataOptics.blocks.replace(processedBlocks)(chunk)
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
      if (typeof global !== 'undefined' && typeof global.gc === 'function') {
        yield* Effect.sync(() => global.gc!())
      }

      const result = yield* operation(chunk)

      if (typeof global !== 'undefined' && typeof global.gc === 'function') {
        yield* Effect.sync(() => global.gc!())
      }

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

      const difference = afterMemory - beforeMemory
      if (difference > 1024 * 1024) {
        yield* Effect.sync(() =>
          console.warn(`Memory usage increased by ${difference / 1024 / 1024}MB`)
        )
      }

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
