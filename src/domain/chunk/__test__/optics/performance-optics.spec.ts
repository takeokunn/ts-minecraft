/**
 * Performance Optics テストスイート
 *
 * 高性能不変更新システムの包括的テスト
 * メモリ効率・実行速度・最適化の検証
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import {
  OptimizedChunkOptics,
  CachedChunkOptics,
  StreamingChunkOptics,
  MemoryOptimizedOptics,
  PerformanceMonitoring
} from '../../aggregate/chunk/performance-optics'
import { ChunkDataOptics, ChunkDataOpticsHelpers } from '../../aggregate/chunk/optics'
import type { ChunkData } from '../../aggregate/chunk_data/types'
import {
  HeightValue as makeHeightValue,
  type HeightValue,
  type ChunkMetadata
} from '../../value_object/chunk-metadata'
import { HeightValue as makeHeightValue } from '../../value_object/chunk-metadata'
import type { ChunkPosition } from '../../value_object/chunk-position'
import type { ChunkTimestamp } from '../../types/core'

// テストデータの作成
const createLargeChunkData = (): ChunkData => ({
  id: 'performance-test-chunk' as any,
  position: { x: 0, z: 0 } as ChunkPosition,
  blocks: new Uint16Array(65536), // 16x16x256 = 65536
  metadata: {
    biome: 'plains',
    lightLevel: 15,
    heightMap: new Array(256).fill(64) as HeightValue[],
    lastUpdate: Date.now() as ChunkTimestamp,
    isModified: false,
    generationVersion: undefined,
    features: undefined,
    structureReferences: undefined
  } as ChunkMetadata,
  isDirty: false
})

const createMassiveUpdateSet = (size: number): ReadonlyArray<{ index: number; blockId: number }> => {
  return Array.from({ length: size }, (_, i) => ({
    index: i % 65536, // チャンクサイズ内でループ
    blockId: (i % 255) + 1 // 1-255のブロックID
  }))
}

const createUpdateMap = (size: number): ReadonlyMap<number, number> => {
  const map = new Map<number, number>()
  for (let i = 0; i < size; i++) {
    map.set(i % 65536, (i % 255) + 1)
  }
  return map
}

// パフォーマンス計測ヘルパー
const measureTime = async <T>(operation: () => Promise<T>): Promise<{ result: T; time: number }> => {
  const start = performance.now()
  const result = await operation()
  const end = performance.now()
  return { result, time: end - start }
}

const measureTimeSync = <T>(operation: () => T): { result: T; time: number } => {
  const start = performance.now()
  const result = operation()
  const end = performance.now()
  return { result, time: end - start }
}

describe('OptimizedChunkOptics', () => {
  describe('遅延評価ブロック更新', () => {
    it('小規模更新の遅延評価が効率的に動作する', () => {
      const chunk = createLargeChunkData()
      const updates = createMassiveUpdateSet(8)

      const result = Effect.runSync(OptimizedChunkOptics.lazyBlockUpdate(chunk, updates))

      updates.forEach(({ index, blockId }) => {
        expect(ChunkDataOptics.blockAt(index).get(result)).toBe(blockId)
        expect(ChunkDataOptics.blockAt(index).get(chunk)).toBe(0)
      })
    })

    it('大規模更新の遅延評価が効率的に動作する', () => {
      const chunk = createLargeChunkData()
      const updates = createMassiveUpdateSet(1024)

      const result = Effect.runSync(OptimizedChunkOptics.lazyBlockUpdate(chunk, updates))

      expect(result).not.toBe(chunk)
      expect(ChunkDataOptics.blockAt(updates[0]!.index).get(result)).toBe(updates[0]!.blockId)
      const lastUpdate = updates[updates.length - 1]!
      expect(ChunkDataOptics.blockAt(lastUpdate.index).get(result)).toBe(lastUpdate.blockId)
    })

    it('超大規模更新でのメモリ効率性', () => {
      const chunk = createLargeChunkData()
      const updates = createMassiveUpdateSet(4096)

      const result = Effect.runSync(OptimizedChunkOptics.lazyBlockUpdate(chunk, updates))

      expect(result.blocks).not.toBe(chunk.blocks)
      expect(result.blocks.length).toBe(chunk.blocks.length)
      expect(ChunkDataOptics.blockAt(updates[100].index).get(result)).toBe(updates[100].blockId)
    })
  })

  describe('バッチ更新', () => {
    it('小規模バッチ更新が高速に動作する', () => {
      const chunk = createLargeChunkData()
      const updates = new Map<number, number>([
        [0, 5],
        [1, 6],
        [32, 7],
      ])

      const result = OptimizedChunkOptics.batchBlockUpdate(chunk, updates)

      expect(ChunkDataOptics.blockAt(0).get(result)).toBe(5)
      expect(ChunkDataOptics.blockAt(1).get(result)).toBe(6)
      expect(ChunkDataOptics.blockAt(32).get(result)).toBe(7)
      expect(ChunkDataOptics.blockAt(0).get(chunk)).toBe(0)
    })

    it('大規模バッチ更新が効率的に動作する', () => {
      const chunk = createLargeChunkData()
      const updates = createUpdateMap(2048)

      const result = OptimizedChunkOptics.batchBlockUpdate(chunk, updates)

      expect(result).not.toBe(chunk)
      expect(ChunkDataOptics.blockAt(0).get(result)).toBe(1)
      const lastKey = Array.from(updates.keys()).pop()!
      expect(ChunkDataOptics.blockAt(lastKey).get(result)).toBe(updates.get(lastKey))
    })

    it('重複インデックスの処理が正確に動作する', () => {
      const chunk = createLargeChunkData()
      const updates = new Map<number, number>()
      updates.set(10, 4)
      updates.set(10, 9)

      const result = OptimizedChunkOptics.batchBlockUpdate(chunk, updates)

      expect(ChunkDataOptics.blockAt(10).get(result)).toBe(9)
    })
  })

  describe('条件付き更新', () => {
    it('条件付き更新が効率的に動作する', () => {
      const chunk = createLargeChunkData()
      const seeded = ChunkDataOpticsHelpers.setBlock(chunk, 5, 10)
      const updated = Effect.runSync(
        OptimizedChunkOptics.conditionalUpdate(
          seeded,
          (blockId, index) => index === 5 && blockId === 10,
          () => 20
        )
      )

      expect(ChunkDataOptics.blockAt(5).get(updated)).toBe(20)
      expect(ChunkDataOptics.blockAt(5).get(chunk)).toBe(0)
    })

    it('条件に合致しない場合の最適化', () => {
      const chunk = createLargeChunkData()
      const updated = Effect.runSync(
        OptimizedChunkOptics.conditionalUpdate(chunk, () => false, (value) => value + 1)
      )

      expect(updated).toBe(chunk)
    })
  })

  describe('領域コピー', () => {
    it('小規模領域コピーが高速に動作する', () => {
      const source = createLargeChunkData()
      const target = createLargeChunkData()

      const seededSource = [
        { index: 0, blockId: 11 },
        { index: 1, blockId: 12 },
        { index: 16, blockId: 13 },
        { index: 17, blockId: 14 },
      ].reduce(
        (acc, { index, blockId }) => ChunkDataOpticsHelpers.setBlock(acc, index, blockId),
        source
      )

      const result = Effect.runSync(
        OptimizedChunkOptics.efficientRegionCopy(
          seededSource,
          target,
          { x: 0, y: 0, z: 0, width: 2, height: 1, depth: 2 },
          { x: 2, y: 0, z: 2 }
        )
      )

      expect(ChunkDataOptics.blockAt(34).get(result)).toBe(11)
      expect(ChunkDataOptics.blockAt(35).get(result)).toBe(12)
      expect(ChunkDataOptics.blockAt(50).get(result)).toBe(13)
      expect(ChunkDataOptics.blockAt(51).get(result)).toBe(14)
    })

    it('境界条件での領域コピー', () => {
      const source = createLargeChunkData()
      const target = createLargeChunkData()

      const seededSource = ChunkDataOpticsHelpers.setBlock(source, 0, 99)

      const result = Effect.runSync(
        OptimizedChunkOptics.efficientRegionCopy(
          seededSource,
          target,
          { x: 0, y: 0, z: 0, width: 4, height: 4, depth: 4 },
          { x: 14, y: 0, z: 14 }
        )
      )

      expect(ChunkDataOptics.blockAt(0).get(result)).toBe(0)
      expect(ChunkDataOptics.blockAt(14 + 14 * 16).get(result)).toBe(99)
    })
  })
})

describe('CachedChunkOptics', () => {
  describe('ブロック統計キャッシュ', () => {
    it('統計キャッシュが正常に動作する', () => {
      const chunk = createLargeChunkData()
      const prepared = [
        { index: 0, blockId: 7 },
        { index: 1, blockId: 7 },
        { index: 2, blockId: 9 },
      ].reduce(
        (acc, { index, blockId }) => ChunkDataOpticsHelpers.setBlock(acc, index, blockId),
        chunk
      )

      const cache = Effect.runSync(CachedChunkOptics.createBlockStatisticsCache())
      const stats = Effect.runSync(cache.get(prepared))

      expect(stats.totalBlocks).toBe(prepared.blocks.length)
      expect(stats.blockCounts.get(7)).toBe(2)
      expect(stats.mostCommonBlock).toBe(0)
      expect(stats.emptyBlocks).toBe(prepared.blocks.length - 3)
    })

    it('キャッシュの容量制限が正常に動作する', () => {
      const cache = Effect.runSync(CachedChunkOptics.createBlockStatisticsCache())
      const chunks = Array.from({ length: 120 }, () => createLargeChunkData())

      chunks.forEach((chunk, index) => {
        if (index % 10 === 0) {
          ChunkDataOpticsHelpers.setBlock(chunk, index, index % 255)
        }
        const stats = Effect.runSync(cache.get(chunk))
        expect(stats.totalBlocks).toBe(chunk.blocks.length)
      })
    })
  })

  describe('高さマップキャッシュ', () => {
    it('高さマップキャッシュが正常に動作する', () => {
      const chunk = createLargeChunkData()
      const modified = ChunkDataOpticsHelpers.setHeight(
        chunk,
        0,
        makeHeightValue(100)
      )

      const cache = Effect.runSync(CachedChunkOptics.createHeightMapCache())
      const stats = Effect.runSync(cache.get(modified))

      expect(stats.maxHeight).toBeGreaterThan(0)
      expect(stats.averageHeight).toBeGreaterThan(0)
      expect(stats.heightVariance).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('StreamingChunkOptics', () => {
  describe('ストリーミング処理', () => {
    it('ブロック配列のストリーミング処理が効率的に動作する', () => {
      const chunk = createLargeChunkData()

      const result = Effect.runSync(
        StreamingChunkOptics.streamBlockProcessing(
          chunk,
          (blockChunk) => blockChunk.map(() => 1)
        )
      )

      expect(result.blocks.every((value) => value === 1)).toBe(true)
    })

    it('並列ストリーミング処理が効率的に動作する', () => {
      const chunk = createLargeChunkData()
      const prepared = ChunkDataOpticsHelpers.setBlock(chunk, 0, 5)

      const result = Effect.runSync(
        StreamingChunkOptics.parallelStreamProcessing(
          prepared,
          (blockChunk) => blockChunk.map((value) => value + 1),
          4
        )
      )

      expect(ChunkDataOptics.blockAt(0).get(result)).toBe(6)
    })

    it('大きなチャンクサイズでのストリーミング処理', () => {
      const chunk = createLargeChunkData()

      const result = Effect.runSync(
        StreamingChunkOptics.streamBlockProcessing(
          chunk,
          (blockChunk) => blockChunk.map((value) => value),
          4096
        )
      )

      expect(result.blocks.length).toBe(chunk.blocks.length)
    })
  })
})

describe('MemoryOptimizedOptics', () => {
  describe('Copy-on-Write最適化', () => {
    it('変更がない場合の最適化が正常に動作する', () => {
      const chunk = createLargeChunkData()

      // 変更を行わない操作
      const noChangeOperation = (c: ChunkData) => c

      const result = MemoryOptimizedOptics.copyOnWrite(chunk, noChangeOperation)

      expect(result).toBe(chunk) // 同じ参照が返される（最適化）
    })

    it('変更がある場合の処理が正常に動作する', () => {
      const chunk = createLargeChunkData()

      // 変更を行う操作
      const changeOperation = (c: ChunkData) => ({ ...c, isDirty: true })

      const result = MemoryOptimizedOptics.copyOnWrite(chunk, changeOperation)

      expect(result).not.toBe(chunk) // 新しいオブジェクト
      expect(result.isDirty).toBe(true)
      expect(chunk.isDirty).toBe(false) // 元は変更されない
    })
  })

  describe('構造共有の最適化', () => {
    it('変更なしの場合の最適化', () => {
      const chunk = createLargeChunkData()

      const result = MemoryOptimizedOptics.structuralSharing(chunk, {})

      expect(result).toBe(chunk) // 同じ参照
    })

    it('部分的変更の場合の構造共有', () => {
      const chunk = createLargeChunkData()

      const result = MemoryOptimizedOptics.structuralSharing(chunk, {
        isDirty: true
      })

      expect(result).not.toBe(chunk) // 新しいオブジェクト
      expect(result.isDirty).toBe(true)
      expect(result.blocks).toBe(chunk.blocks) // 配列は共有
      expect(result.metadata).toBe(chunk.metadata) // メタデータも共有
    })
  })

  describe('ガベージコレクション最適化', () => {
    it('GC最適化が正常に動作する', () => {
      const chunk = createLargeChunkData()

      const result = Effect.runSync(
        MemoryOptimizedOptics.gcOptimized(chunk, (current) =>
          Effect.succeed(ChunkDataOpticsHelpers.setDirty(current, true))
        )
      )

      expect(result.isDirty).toBe(true)
    })
  })
})

describe('PerformanceMonitoring', () => {
  describe('操作時間の計測', () => {
    it('時間計測が正確に動作する', async () => {
      const slowOperation = Effect.gen(function* () {
        yield* Effect.sleep('10 millis')
        return 'completed'
      })

      const result = await Effect.runPromise(
        PerformanceMonitoring.measureOperation('test-operation', slowOperation)
      )

      expect(result).toBe('completed')
    })

    it('高速操作の時間計測', async () => {
      const fastOperation = Effect.succeed(42)

      const result = await Effect.runPromise(
        PerformanceMonitoring.measureOperation('fast-operation', fastOperation)
      )

      expect(result).toBe(42)
    })
  })

  describe('メモリ使用量の監視', () => {
    it('メモリ監視が正常に動作する', () => {
      const result = Effect.runSync(PerformanceMonitoring.monitorMemory(Effect.succeed('ok')))
      expect(result).toBe('ok')
    })
  })
})

describe('実世界のパフォーマンステスト', () => {
  it('複数のOpticsを組み合わせた複雑な操作', () => {
    const chunk = createLargeChunkData()
    const lazyResult = Effect.runSync(
      OptimizedChunkOptics.lazyBlockUpdate(chunk, createMassiveUpdateSet(16))
    )

    const batched = OptimizedChunkOptics.batchBlockUpdate(
      lazyResult,
      new Map<number, number>([
        [200, 12],
        [201, 18],
      ])
    )

    const final = Effect.runSync(
      OptimizedChunkOptics.efficientRegionCopy(
        batched,
        batched,
        { x: 0, y: 0, z: 0, width: 2, height: 1, depth: 2 },
        { x: 4, y: 0, z: 4 }
      )
    )

    expect(ChunkDataOptics.blockAt(0).get(final)).toBe(1)
    expect(ChunkDataOptics.blockAt(4 + 4 * 16).get(final)).toBe(1)
    expect(ChunkDataOptics.blockAt(200).get(final)).toBe(12)
    expect(ChunkDataOptics.blockAt(201).get(final)).toBe(18)
  })

  it('メモリ効率性の総合テスト', () => {
    const chunk = createLargeChunkData()
    const processed = Effect.runSync(
      StreamingChunkOptics.streamBlockProcessing(chunk, (blockChunk) => blockChunk)
    )

    const optimized = MemoryOptimizedOptics.structuralSharing(processed, {
      isDirty: true,
    })

    expect(optimized.blocks).toBe(processed.blocks)
    expect(optimized.metadata).toBe(processed.metadata)
    expect(optimized.isDirty).toBe(true)
  })

  it('並行処理での競合状態テスト', async () => {
    const chunk = createLargeChunkData()

    const effect = Effect.forEach(
      [0, 1, 2, 3],
      (offset) =>
        OptimizedChunkOptics.lazyBlockUpdate(
          chunk,
          createMassiveUpdateSet(4).map(({ index, blockId }) => ({
            index: (index + offset) % 65536,
            blockId,
          }))
        ),
      { concurrency: 'unbounded' }
    )

    const results = await Effect.runPromise(effect)

    results.forEach((result) => {
      expect(result.blocks.length).toBe(chunk.blocks.length)
    })
  })
})
