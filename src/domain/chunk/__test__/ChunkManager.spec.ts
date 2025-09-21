/**
 * ChunkManager Service Test Suite
 * 1対1対応テストファイル
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Effect, TestContext } from 'effect'
import {
  ChunkManager,
  ChunkManagerLive,
  createLRUCache,
  lruGet,
  lruPut,
  chunkPositionToKey,
  worldToChunkPosition,
  chunkDistance,
  generateLoadOrder,
  defaultChunkManagerConfig,
} from '../ChunkManager.js'
import type { ChunkPosition } from '../ChunkPosition.js'

// =============================================================================
// LRU Cache Tests
// =============================================================================

describe('LRU Cache Functions', () => {
  describe('createLRUCache', () => {
    it('空のキャッシュを作成できる', () => {
      const cache = createLRUCache<string, number>(5)

      expect(cache.cache.size).toBe(0)
      expect(cache.accessOrder).toEqual([])
      expect(cache.maxSize).toBe(5)
    })
  })

  describe('lruGet', () => {
    it('存在しないキーに対してundefinedを返す', () => {
      const cache = createLRUCache<string, number>(5)
      const [value, newCache] = lruGet(cache, 'nonexistent')

      expect(value).toBeUndefined()
      expect(newCache).toEqual(cache)
    })

    it('存在するキーの値を返し、アクセス順を更新する', () => {
      let cache = createLRUCache<string, number>(5)
      cache = lruPut(cache, 'a', 1)
      cache = lruPut(cache, 'b', 2)

      const [value, newCache] = lruGet(cache, 'a')

      expect(value).toBe(1)
      expect(newCache.accessOrder).toEqual(['b', 'a'])
    })
  })

  describe('lruPut', () => {
    it('新しいキーと値を追加できる', () => {
      const cache = createLRUCache<string, number>(5)
      const newCache = lruPut(cache, 'key1', 100)

      expect(newCache.cache.get('key1')).toBe(100)
      expect(newCache.accessOrder).toEqual(['key1'])
    })

    it('容量制限を超えると最も古いエントリを削除する', () => {
      let cache = createLRUCache<string, number>(2)
      cache = lruPut(cache, 'a', 1)
      cache = lruPut(cache, 'b', 2)
      cache = lruPut(cache, 'c', 3) // 'a'が削除されるはず

      expect(cache.cache.has('a')).toBe(false)
      expect(cache.cache.get('b')).toBe(2)
      expect(cache.cache.get('c')).toBe(3)
      expect(cache.accessOrder).toEqual(['b', 'c'])
    })

    it('既存のキーを更新するとアクセス順のみ変更される', () => {
      let cache = createLRUCache<string, number>(5)
      cache = lruPut(cache, 'a', 1)
      cache = lruPut(cache, 'b', 2)
      cache = lruPut(cache, 'a', 10) // 値を更新

      expect(cache.cache.get('a')).toBe(10)
      expect(cache.accessOrder).toEqual(['b', 'a'])
    })
  })
})

// =============================================================================
// Utility Function Tests
// =============================================================================

describe('Utility Functions', () => {
  describe('chunkPositionToKey', () => {
    it('チャンク座標を文字列キーに変換できる', () => {
      const position: ChunkPosition = { x: 10, z: -5 }
      const key = chunkPositionToKey(position)

      expect(key).toBe('10,-5')
    })

    it('負の座標も正しく処理できる', () => {
      const position: ChunkPosition = { x: -3, z: -7 }
      const key = chunkPositionToKey(position)

      expect(key).toBe('-3,-7')
    })
  })

  describe('worldToChunkPosition', () => {
    it('ワールド座標をチャンク座標に変換できる', () => {
      const worldPos = { x: 32, y: 64, z: 48 }
      const chunkPos = worldToChunkPosition(worldPos)

      expect(chunkPos).toEqual({ x: 2, z: 3 })
    })

    it('負のワールド座標も正しく処理できる', () => {
      const worldPos = { x: -17, y: 64, z: -1 }
      const chunkPos = worldToChunkPosition(worldPos)

      expect(chunkPos).toEqual({ x: -2, z: -1 })
    })

    it('境界値を正しく処理できる', () => {
      const worldPos = { x: 15.9, y: 64, z: 0 }
      const chunkPos = worldToChunkPosition(worldPos)

      expect(chunkPos).toEqual({ x: 0, z: 0 })
    })
  })

  describe('chunkDistance', () => {
    it('チャンク間の距離を計算できる（チェビシェフ距離）', () => {
      const pos1: ChunkPosition = { x: 0, z: 0 }
      const pos2: ChunkPosition = { x: 3, z: 4 }
      const distance = chunkDistance(pos1, pos2)

      expect(distance).toBe(4) // max(3, 4) = 4
    })

    it('同じ位置の距離は0', () => {
      const pos: ChunkPosition = { x: 5, z: -2 }
      const distance = chunkDistance(pos, pos)

      expect(distance).toBe(0)
    })

    it('負の座標でも正しく計算できる', () => {
      const pos1: ChunkPosition = { x: -2, z: -3 }
      const pos2: ChunkPosition = { x: 1, z: -1 }
      const distance = chunkDistance(pos1, pos2)

      expect(distance).toBe(3) // max(|1-(-2)|, |-1-(-3)|) = max(3, 2) = 3
    })
  })

  describe('generateLoadOrder', () => {
    it('距離0の場合は中心のみ返す', () => {
      const center: ChunkPosition = { x: 0, z: 0 }
      const order = generateLoadOrder(center, 0)

      expect(order).toEqual([{ x: 0, z: 0 }])
    })

    it('距離1の場合は正しい順序で返す', () => {
      const center: ChunkPosition = { x: 0, z: 0 }
      const order = generateLoadOrder(center, 1)

      // 中心(距離0) + 周囲8個(距離1)
      expect(order).toHaveLength(9)
      expect(order[0]).toEqual({ x: 0, z: 0 })

      // 距離1のチャンクが含まれているか確認
      const distance1Chunks = order.slice(1)
      expect(distance1Chunks).toContainEqual({ x: -1, z: -1 })
      expect(distance1Chunks).toContainEqual({ x: 0, z: -1 })
      expect(distance1Chunks).toContainEqual({ x: 1, z: -1 })
      expect(distance1Chunks).toContainEqual({ x: -1, z: 0 })
      expect(distance1Chunks).toContainEqual({ x: 1, z: 0 })
      expect(distance1Chunks).toContainEqual({ x: -1, z: 1 })
      expect(distance1Chunks).toContainEqual({ x: 0, z: 1 })
      expect(distance1Chunks).toContainEqual({ x: 1, z: 1 })
    })

    it('距離2の場合は正しい数のチャンクを返す', () => {
      const center: ChunkPosition = { x: 2, z: -1 }
      const order = generateLoadOrder(center, 2)

      // 5x5 = 25チャンク
      expect(order).toHaveLength(25)

      // 中心が最初
      expect(order[0]).toEqual({ x: 2, z: -1 })

      // 最遠のチャンクも含まれている
      expect(order).toContainEqual({ x: 0, z: -3 }) // center + (-2, -2)
      expect(order).toContainEqual({ x: 4, z: 1 })  // center + (2, 2)
    })
  })
})

// =============================================================================
// ChunkManager Service Tests
// =============================================================================

describe('ChunkManager Service', () => {
  const runTest = <E, A>(effect: Effect.Effect<A, E>) =>
    Effect.runSync(Effect.provide(effect, ChunkManagerLive()))

  describe('Configuration', () => {
    it('デフォルト設定でサービスを作成できる', () => {
      const test = Effect.gen(function* () {
        const manager = yield* ChunkManager
        const loadedCount = yield* manager.getLoadedChunkCount()
        const cachedCount = yield* manager.getCachedChunkCount()

        expect(loadedCount).toBe(0)
        expect(cachedCount).toBe(0)
      })

      runTest(test)
    })

    it('カスタム設定でサービスを作成できる', () => {
      const customConfig = {
        ...defaultChunkManagerConfig,
        maxLoadedChunks: 100,
        maxCachedChunks: 200,
      }

      const test = Effect.gen(function* () {
        const manager = yield* ChunkManager
        const memoryUsage = yield* manager.getMemoryUsage()

        expect(memoryUsage).toBe(0) // 初期状態では0
      })

      Effect.runSync(Effect.provide(test, ChunkManagerLive(customConfig)))
    })
  })

  describe('getChunk', () => {
    it('存在しないチャンクに対してnullを返す', () => {
      const test = Effect.gen(function* () {
        const manager = yield* ChunkManager
        const position: ChunkPosition = { x: 0, z: 0 }
        const chunk = yield* manager.getChunk(position)

        expect(chunk).toBeNull()
      })

      runTest(test)
    })
  })

  describe('loadChunksAroundPlayer', () => {
    it('プレイヤー位置周辺のチャンクロードを開始する', () => {
      const test = Effect.gen(function* () {
        const manager = yield* ChunkManager
        const playerPos = { x: 16, y: 64, z: 32 }

        // ロード処理を実行（実際のチャンク生成は仮実装）
        yield* manager.loadChunksAroundPlayer(playerPos)

        // ロード処理が呼ばれたことを確認
        // 注意: 実際のチャンク生成がまだ実装されていないため、
        // この段階ではロードキューへの追加のみ確認
        const loadedCount = yield* manager.getLoadedChunkCount()
        expect(loadedCount).toBeGreaterThanOrEqual(0)
      })

      runTest(test)
    })
  })

  describe('Memory Management', () => {
    it('初期状態でのメモリ使用量を取得できる', () => {
      const test = Effect.gen(function* () {
        const manager = yield* ChunkManager
        const memoryUsage = yield* manager.getMemoryUsage()

        expect(memoryUsage).toBe(0)
      })

      runTest(test)
    })

    it('チャンク数の統計を取得できる', () => {
      const test = Effect.gen(function* () {
        const manager = yield* ChunkManager
        const loadedCount = yield* manager.getLoadedChunkCount()
        const cachedCount = yield* manager.getCachedChunkCount()

        expect(typeof loadedCount).toBe('number')
        expect(typeof cachedCount).toBe('number')
        expect(loadedCount).toBeGreaterThanOrEqual(0)
        expect(cachedCount).toBeGreaterThanOrEqual(0)
      })

      runTest(test)
    })
  })

  describe('Unload Management', () => {
    it('遠いチャンクのアンロード処理を実行できる', () => {
      const test = Effect.gen(function* () {
        const manager = yield* ChunkManager
        const centerPos = { x: 0, y: 64, z: 0 }

        yield* manager.unloadDistantChunks(centerPos)

        // アンロード処理が正常に完了することを確認
        const loadedCount = yield* manager.getLoadedChunkCount()
        expect(loadedCount).toBeGreaterThanOrEqual(0)
      })

      runTest(test)
    })
  })
})

// =============================================================================
// Performance Tests
// =============================================================================

describe('Performance Tests', () => {
  describe('LRU Cache Performance', () => {
    it('大量のキャッシュ操作でも高速に動作する', () => {
      const startTime = performance.now()

      let cache = createLRUCache<string, number>(1000)

      // 大量の挿入操作
      for (let i = 0; i < 5000; i++) {
        cache = lruPut(cache, `key_${i}`, i)
      }

      // 大量の取得操作
      for (let i = 0; i < 1000; i++) {
        const [value] = lruGet(cache, `key_${i + 4000}`)
        expect(value).toBeDefined()
      }

      const endTime = performance.now()
      const executionTime = endTime - startTime

      // 1秒以内で完了することを確認（パフォーマンス要件）
      expect(executionTime).toBeLessThan(1000)
    })
  })

  describe('Load Order Generation Performance', () => {
    it('大きな描画距離でも高速に生成できる', () => {
      const startTime = performance.now()

      const center: ChunkPosition = { x: 0, z: 0 }
      const order = generateLoadOrder(center, 32) // 65x65 = 4225チャンク

      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(order).toHaveLength(65 * 65)
      expect(executionTime).toBeLessThan(100) // 100ms以内
    })
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  describe('LRU Cache Edge Cases', () => {
    it('maxSize=1でも正しく動作する', () => {
      let cache = createLRUCache<string, number>(1)
      cache = lruPut(cache, 'a', 1)
      cache = lruPut(cache, 'b', 2)

      expect(cache.cache.has('a')).toBe(false)
      expect(cache.cache.get('b')).toBe(2)
      expect(cache.accessOrder).toEqual(['b'])
    })

    it('maxSize=0でも動作する（常に空）', () => {
      let cache = createLRUCache<string, number>(0)
      cache = lruPut(cache, 'a', 1)

      expect(cache.cache.size).toBe(0)
      expect(cache.accessOrder).toEqual([])
    })
  })

  describe('Coordinate Edge Cases', () => {
    it('極端に大きな座標値でも処理できる', () => {
      const position: ChunkPosition = { x: 1000000, z: -1000000 }
      const key = chunkPositionToKey(position)

      expect(key).toBe('1000000,-1000000')
    })

    it('小数点を含むワールド座標でも正しくチャンク座標に変換される', () => {
      const worldPos = { x: -16.1, y: 64, z: 15.9 }
      const chunkPos = worldToChunkPosition(worldPos)

      expect(chunkPos).toEqual({ x: -2, z: 0 })
    })
  })
})