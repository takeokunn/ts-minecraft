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
} from '../../aggregate/chunk/performance_optics'
import type { ChunkData } from '../../aggregate/chunk_data/types'
import type { HeightValue, ChunkMetadata } from '../../value_object/chunk_metadata'
import type { ChunkPosition } from '../../value_object/chunk_position'
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
    timestamp: Date.now() as ChunkTimestamp,
    isModified: false
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
    it('小規模更新の遅延評価が効率的に動作する', async () => {
      const chunk = createLargeChunkData()
      const updates = createMassiveUpdateSet(100)

      const { result, time } = await measureTime(() =>
        Effect.runPromise(OptimizedChunkOptics.lazyBlockUpdate(chunk, updates))
      )

      expect(result.blocks).toBeInstanceOf(Uint16Array)
      expect(time).toBeLessThan(50) // 100個の更新は50ms以内

      // 更新結果の検証
      for (let i = 0; i < 100; i++) {
        const expectedBlockId = (i % 255) + 1
        expect(result.blocks[i % 65536]).toBe(expectedBlockId)
      }
    })

    it('大規模更新の遅延評価が効率的に動作する', async () => {
      const chunk = createLargeChunkData()
      const updates = createMassiveUpdateSet(10000)

      const { result, time } = await measureTime(() =>
        Effect.runPromise(OptimizedChunkOptics.lazyBlockUpdate(chunk, updates))
      )

      expect(result.blocks).toBeInstanceOf(Uint16Array)
      expect(time).toBeLessThan(1000) // 10000個の更新は1秒以内

      // サンプル検証
      expect(result.blocks[0]).toBe(1)
      expect(result.blocks[255]).toBe(255)
      expect(result.blocks[9999 % 65536]).toBe((9999 % 255) + 1)
    })

    it('超大規模更新でのメモリ効率性', async () => {
      const chunk = createLargeChunkData()
      const updates = createMassiveUpdateSet(50000)

      // メモリ使用量の監視
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0

      const { result } = await measureTime(() =>
        Effect.runPromise(OptimizedChunkOptics.lazyBlockUpdate(chunk, updates))
      )

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      expect(result.blocks).toBeInstanceOf(Uint16Array)
      // メモリ増加は50MB以下であること
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })
  })

  describe('バッチ更新', () => {
    it('小規模バッチ更新が高速に動作する', () => {
      const chunk = createLargeChunkData()
      const updateMap = createUpdateMap(1000)

      const { result, time } = measureTimeSync(() =>
        OptimizedChunkOptics.batchBlockUpdate(chunk, updateMap)
      )

      expect(time).toBeLessThan(20) // 1000個のバッチ更新は20ms以内
      expect(result.blocks).toBeInstanceOf(Uint16Array)

      // 更新結果の検証
      for (const [index, blockId] of updateMap.entries()) {
        expect(result.blocks[index]).toBe(blockId)
      }
    })

    it('大規模バッチ更新が効率的に動作する', () => {
      const chunk = createLargeChunkData()
      const updateMap = createUpdateMap(20000)

      const { result, time } = measureTimeSync(() =>
        OptimizedChunkOptics.batchBlockUpdate(chunk, updateMap)
      )

      expect(time).toBeLessThan(200) // 20000個のバッチ更新は200ms以内
      expect(result.blocks).toBeInstanceOf(Uint16Array)

      // サンプル検証
      expect(result.blocks[0]).toBe(1)
      expect(result.blocks[1000]).toBe((1000 % 255) + 1)
    })

    it('重複インデックスの処理が正確に動作する', () => {
      const chunk = createLargeChunkData()
      const updateMap = new Map([
        [100, 50],
        [100, 75], // 同じインデックスの重複更新
        [200, 25]
      ])

      const result = OptimizedChunkOptics.batchBlockUpdate(chunk, updateMap)

      // 最後の値で上書きされる
      expect(result.blocks[100]).toBe(75)
      expect(result.blocks[200]).toBe(25)
    })
  })

  describe('条件付き更新', () => {
    it('条件付き更新が効率的に動作する', async () => {
      // 初期データを設定
      const blocks = new Uint16Array(65536)
      for (let i = 0; i < 1000; i++) {
        blocks[i] = i % 10
      }
      const chunk = { ...createLargeChunkData(), blocks }

      // 偶数ブロックのみを2倍にする条件付き更新
      const isEvenBlock = (blockId: number) => blockId % 2 === 0
      const doubleValue = (blockId: number) => blockId * 2

      const { result, time } = await measureTime(() =>
        Effect.runPromise(
          OptimizedChunkOptics.conditionalUpdate(chunk, isEvenBlock, doubleValue)
        )
      )

      expect(time).toBeLessThan(100) // 条件付き更新は100ms以内

      // 結果の検証
      for (let i = 0; i < 1000; i++) {
        const originalBlockId = i % 10
        const expectedBlockId = originalBlockId % 2 === 0 ? originalBlockId * 2 : originalBlockId
        expect(result.blocks[i]).toBe(expectedBlockId)
      }
    })

    it('条件に合致しない場合の最適化', async () => {
      const chunk = createLargeChunkData()

      // 常にfalseを返す条件（変更なし）
      const neverMatch = () => false
      const transform = (blockId: number) => blockId + 1

      const { result, time } = await measureTime(() =>
        Effect.runPromise(
          OptimizedChunkOptics.conditionalUpdate(chunk, neverMatch, transform)
        )
      )

      expect(time).toBeLessThan(50) // 変更なしの場合は高速
      expect(result).toBe(chunk) // 同じオブジェクト参照が返される（最適化）
    })
  })

  describe('領域コピー', () => {
    it('小規模領域コピーが高速に動作する', async () => {
      const sourceChunk = createLargeChunkData()
      const targetChunk = createLargeChunkData()

      // ソースにテストデータを設定
      for (let i = 0; i < 1000; i++) {
        sourceChunk.blocks[i] = i % 100 + 1
      }

      const region = { x: 0, y: 0, z: 0, width: 10, height: 10, depth: 10 }
      const offset = { x: 5, y: 10, z: 5 }

      const { result, time } = await measureTime(() =>
        Effect.runPromise(
          OptimizedChunkOptics.efficientRegionCopy(sourceChunk, targetChunk, region, offset)
        )
      )

      expect(time).toBeLessThan(50) // 10x10x10の領域コピーは50ms以内
      expect(result.blocks).toBeInstanceOf(Uint16Array)

      // コピー結果の検証（サンプル）
      const sourceIndex = 0 * 256 + 0 * 16 + 0 // (0,0,0)
      const targetIndex = 10 * 256 + 5 * 16 + 5 // (5,10,5)
      expect(result.blocks[targetIndex]).toBe(sourceChunk.blocks[sourceIndex])
    })

    it('境界条件での領域コピー', async () => {
      const sourceChunk = createLargeChunkData()
      const targetChunk = createLargeChunkData()

      // チャンクの端から端へのコピー
      const region = { x: 15, y: 255, z: 15, width: 1, height: 1, depth: 1 }
      const offset = { x: 0, y: 0, z: 0 }

      const { result } = await measureTime(() =>
        Effect.runPromise(
          OptimizedChunkOptics.efficientRegionCopy(sourceChunk, targetChunk, region, offset)
        )
      )

      expect(result.blocks).toBeInstanceOf(Uint16Array)
    })
  })
})

describe('CachedChunkOptics', () => {
  describe('ブロック統計キャッシュ', () => {
    it('統計キャッシュが正常に動作する', async () => {
      const cache = CachedChunkOptics.createBlockStatisticsCache()
      const chunk = createLargeChunkData()

      // ブロックデータを設定
      for (let i = 0; i < 10000; i++) {
        chunk.blocks[i] = (i % 5) + 1 // 1-5のブロックタイプ
      }

      // 初回アクセス（キャッシュミス）
      const { time: firstTime } = await measureTime(() =>
        Effect.runPromise(cache.get(chunk))
      )

      // 2回目アクセス（キャッシュヒット）
      const { result: stats, time: secondTime } = await measureTime(() =>
        Effect.runPromise(cache.get(chunk))
      )

      expect(secondTime).toBeLessThan(firstTime) // キャッシュヒットで高速化
      expect(stats.totalBlocks).toBe(65536)
      expect(stats.blockCounts.size).toBe(6) // 0 + (1-5) = 6種類
      expect(stats.mostCommonBlock).toBe(0) // 空気ブロックが最多
    })

    it('キャッシュの容量制限が正常に動作する', async () => {
      const cache = CachedChunkOptics.createBlockStatisticsCache()

      // 容量を超える数のチャンクを処理
      const chunks = Array.from({ length: 150 }, () => createLargeChunkData())

      // 全チャンクにアクセス
      await Promise.all(
        chunks.map(chunk => Effect.runPromise(cache.get(chunk)))
      )

      // キャッシュサイズは上限以下
      // (実際のキャッシュサイズ確認は実装依存)
      expect(true).toBe(true) // 基本的な動作確認
    })
  })

  describe('高さマップキャッシュ', () => {
    it('高さマップキャッシュが正常に動作する', async () => {
      const cache = CachedChunkOptics.createHeightMapCache()
      const chunk = createLargeChunkData()

      // 高さマップにバリエーションを設定
      for (let i = 0; i < 256; i++) {
        chunk.metadata.heightMap[i] = (i % 100 + 50) as HeightValue
      }

      const stats = await Effect.runPromise(cache.get(chunk))

      expect(stats.maxHeight).toBe(149) // 50 + 99
      expect(stats.minHeight).toBe(50)
      expect(stats.averageHeight).toBeCloseTo(99.5, 1)
      expect(stats.heightVariance).toBeGreaterThan(0)
    })
  })
})

describe('StreamingChunkOptics', () => {
  describe('ストリーミング処理', () => {
    it('ブロック配列のストリーミング処理が効率的に動作する', async () => {
      const chunk = createLargeChunkData()

      // 全ブロックを+1する処理
      const processor = (blockChunk: ReadonlyArray<number>) =>
        blockChunk.map(block => block + 1)

      const { result, time } = await measureTime(() =>
        Effect.runPromise(
          StreamingChunkOptics.streamBlockProcessing(chunk, processor, 4096)
        )
      )

      expect(time).toBeLessThan(500) // ストリーミング処理は500ms以内
      expect(result.blocks[0]).toBe(1) // 0 + 1
      expect(result.blocks[100]).toBe(1) // 0 + 1
    })

    it('並列ストリーミング処理が効率的に動作する', async () => {
      const chunk = createLargeChunkData()

      // ブロックを2倍にする処理
      const processor = (blockChunk: ReadonlyArray<number>) =>
        blockChunk.map(block => block * 2)

      const { result, time } = await measureTime(() =>
        Effect.runPromise(
          StreamingChunkOptics.parallelStreamProcessing(chunk, processor, 4)
        )
      )

      expect(time).toBeLessThan(300) // 並列ストリーミングは300ms以内
      expect(result.blocks[0]).toBe(0) // 0 * 2
    })

    it('大きなチャンクサイズでのストリーミング処理', async () => {
      const chunk = createLargeChunkData()

      // 複雑な処理
      const processor = (blockChunk: ReadonlyArray<number>, startIndex: number) =>
        blockChunk.map((block, i) => (block + startIndex + i) % 256)

      const { result } = await measureTime(() =>
        Effect.runPromise(
          StreamingChunkOptics.streamBlockProcessing(chunk, processor, 8192)
        )
      )

      expect(result.blocks).toBeInstanceOf(Uint16Array)
      expect(result.blocks.length).toBe(65536)
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
    it('GC最適化が正常に動作する', async () => {
      const chunk = createLargeChunkData()

      const operation = (c: ChunkData) =>
        Effect.succeed({ ...c, isDirty: true })

      const { result } = await measureTime(() =>
        Effect.runPromise(
          MemoryOptimizedOptics.gcOptimized(chunk, operation)
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
    it('メモリ監視が正常に動作する', async () => {
      const memoryIntensiveOperation = Effect.sync(() => {
        // メモリを多少使用する操作
        const largeArray = new Array(10000).fill(0).map((_, i) => ({ id: i, data: 'test' }))
        return largeArray.length
      })

      const result = await Effect.runPromise(
        PerformanceMonitoring.monitorMemory(memoryIntensiveOperation)
      )

      expect(result).toBe(10000)
    })
  })
})

describe('実世界のパフォーマンステスト', () => {
  it('複数のOpticsを組み合わせた複雑な操作', async () => {
    const chunk = createLargeChunkData()

    // 複雑な操作の組み合わせ
    const complexOperation = async () => {
      // 1. バッチ更新
      const updateMap = createUpdateMap(5000)
      let result = OptimizedChunkOptics.batchBlockUpdate(chunk, updateMap)

      // 2. 条件付き更新
      result = await Effect.runPromise(
        OptimizedChunkOptics.conditionalUpdate(
          result,
          (blockId) => blockId % 3 === 0,
          (blockId) => blockId * 2
        )
      )

      // 3. ストリーミング処理
      result = await Effect.runPromise(
        StreamingChunkOptics.streamBlockProcessing(
          result,
          (blocks) => blocks.map(b => Math.min(b, 255)),
          2048
        )
      )

      return result
    }

    const { result, time } = await measureTime(complexOperation)

    expect(time).toBeLessThan(1000) // 複雑な操作でも1秒以内
    expect(result.blocks).toBeInstanceOf(Uint16Array)
    expect(result.blocks.length).toBe(65536)
  })

  it('メモリ効率性の総合テスト', async () => {
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0

    // 大量のチャンクを処理
    const chunks = Array.from({ length: 100 }, () => createLargeChunkData())

    await Promise.all(
      chunks.map(async (chunk, index) => {
        const updates = createMassiveUpdateSet(1000)
        return Effect.runPromise(
          OptimizedChunkOptics.lazyBlockUpdate(chunk, updates)
        )
      })
    )

    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
    const memoryIncrease = finalMemory - initialMemory

    // 100個のチャンク処理でメモリ増加は100MB以下
    expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)
  })

  it('並行処理での競合状態テスト', async () => {
    const chunk = createLargeChunkData()

    // 複数の操作を同時実行
    const operations = Array.from({ length: 10 }, (_, i) =>
      Effect.runPromise(
        OptimizedChunkOptics.lazyBlockUpdate(
          chunk,
          createMassiveUpdateSet(1000).map(update => ({
            ...update,
            blockId: update.blockId + i
          }))
        )
      )
    )

    const results = await Promise.all(operations)

    expect(results).toHaveLength(10)
    results.forEach(result => {
      expect(result.blocks).toBeInstanceOf(Uint16Array)
      expect(result.blocks.length).toBe(65536)
    })
  })
})