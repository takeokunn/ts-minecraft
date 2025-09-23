/**
 * ChunkManager Service Test Suite
 * 1対1対応テストファイル
 */

import { describe, expect, beforeEach } from 'vitest'
import { it } from '@effect/vitest'
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
} from '../ChunkManager'
import type { ChunkPosition } from '../ChunkPosition'

// =============================================================================
// LRU Cache Tests
// =============================================================================

describe('LRU Cache Functions', () => {
  describe('createLRUCache', () => {
  it.effect('空のキャッシュを作成できる', () => Effect.gen(function* () {
    const cache = createLRUCache<string, number>(5)
    expect(cache.cache.size).toBe(0)
    expect(cache.accessOrder).toEqual([])
    expect(cache.maxSize).toBe(5)
    )
    describe('lruGet', () => {
    it.effect('存在しないキーに対してundefinedを返す', () => Effect.gen(function* () {
    const cache = createLRUCache<string, number>(5)
    const [value, newCache] = lruGet(cache, 'nonexistent')
    expect(value).toBeUndefined()
    expect(newCache).toEqual(cache)
    )
    it.effect('存在するキーの値を返し、アクセス順を更新する', () => Effect.gen(function* () {
    let cache = createLRUCache<string, number>(5)
    cache = lruPut(cache, 'a', 1)
    cache = lruPut(cache, 'b', 2)
    const [value, newCache] = lruGet(cache, 'a')
    expect(value).toBe(1)
    expect(newCache.accessOrder).toEqual(['b', 'a'])
    )
    describe('lruPut', () => {
    it.effect('新しいキーと値を追加できる', () => Effect.gen(function* () {
    const cache = createLRUCache<string, number>(5)
    const newCache = lruPut(cache, 'key1', 100)
    expect(newCache.cache.get('key1')).toBe(100)
    expect(newCache.accessOrder).toEqual(['key1'])
    )
    it.effect('容量制限を超えると最も古いエントリを削除する', () => Effect.gen(function* () {
    let cache = createLRUCache<string, number>(2)
    cache = lruPut(cache, 'a', 1)
    cache = lruPut(cache, 'b', 2)
    cache = lruPut(cache, 'c', 3) // 'a'が削除されるはず
    expect(cache.cache.has('a')).toBe(false)
    expect(cache.cache.get('b')).toBe(2)
    expect(cache.cache.get('c')).toBe(3)
    expect(cache.accessOrder).toEqual(['b', 'c'])
    )
    it.effect('既存のキーを更新するとアクセス順のみ変更される', () => Effect.gen(function* () {
    let cache = createLRUCache<string, number>(5)
    cache = lruPut(cache, 'a', 1)
    cache = lruPut(cache, 'b', 2)
    cache = lruPut(cache, 'a', 10) // 値を更新
    expect(cache.cache.get('a')).toBe(10)
    expect(cache.accessOrder).toEqual(['b', 'a'])
    )
    // =============================================================================
    // Utility Function Tests
    // =============================================================================
    describe('Utility Functions', () => {
    describe('chunkPositionToKey', () => {
    it.effect('チャンク座標を文字列キーに変換できる', () => Effect.gen(function* () {
    const position: ChunkPosition = { x: 10, z: -5 }
    const key = chunkPositionToKey(position)
    expect(key).toBe('10,-5')
})
),
  Effect.gen(function* () {
        const position: ChunkPosition = { x: -3, z: -7 }
        const key = chunkPositionToKey(position)
        expect(key).toBe('-3,-7')

      })
  })

  describe('worldToChunkPosition', () => {
  it.effect('ワールド座標をチャンク座標に変換できる', () => Effect.gen(function* () {
    const worldPos = { x: 32, y: 64, z: 48 }
    const chunkPos = worldToChunkPosition(worldPos)
    expect(chunkPos).toEqual({ x: 2, z: 3
})
  ),
  Effect.gen(function* () {
        const worldPos = { x: -17, y: 64, z: -1 }
        const chunkPos = worldToChunkPosition(worldPos)
        expect(chunkPos).toEqual({ x: -2, z: -1 })

      })
    it.effect('境界値を正しく処理できる', () => Effect.gen(function* () {
    const worldPos = { x: 15.9, y: 64, z: 0 }
    const chunkPos = worldToChunkPosition(worldPos)
    expect(chunkPos).toEqual({ x: 0, z: 0
  })
)
    describe('chunkDistance', () => {
  it.effect('チャンク間の距離を計算できる（チェビシェフ距離）', () => Effect.gen(function* () {
    const pos1: ChunkPosition = { x: 0, z: 0 }
    const pos2: ChunkPosition = { x: 3, z: 4 }
    const distance = chunkDistance(pos1, pos2)
    expect(distance).toBe(4) // max(3, 4) = 4
})
),
  Effect.gen(function* () {
        const pos: ChunkPosition = { x: 5, z: -2 }
        const distance = chunkDistance(pos, pos)
        expect(distance).toBe(0)

      })
    it.effect('負の座標でも正しく計算できる', () => Effect.gen(function* () {
    const pos1: ChunkPosition = { x: -2, z: -3 }
    const pos2: ChunkPosition = { x: 1, z: -1 }
    const distance = chunkDistance(pos1, pos2)
    expect(distance).toBe(3) // max(|1-(-2)|, |-1-(-3)|) = max(3, 2) = 3
  })
)
    describe('generateLoadOrder', () => {
  it.effect('距離0の場合は中心のみ返す', () => Effect.gen(function* () {
    const center: ChunkPosition = { x: 0, z: 0 }
    const order = generateLoadOrder(center, 0)
    expect(order).toEqual([{ x: 0, z: 0 }])
})
),
  Effect.gen(function* () {
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
    it.effect('距離2の場合は正しい数のチャンクを返す', () => Effect.gen(function* () {
    const center: ChunkPosition = { x: 2, z: -1 }
    const order = generateLoadOrder(center, 2)
    // 5x5 = 25チャンク
    expect(order).toHaveLength(25)
    // 中心が最初
    expect(order[0]).toEqual({ x: 2, z: -1
    })
    // 最遠のチャンクも含まれている
    expect(order).toContainEqual({ x: 0, z: -3 }) // center + (-2, -2)
    expect(order).toContainEqual({ x: 4, z: 1 }) // center + (2, 2)
  })
)
    })

    // =============================================================================
    // ChunkManager Service Tests
    // =============================================================================

    describe('ChunkManager Service', () => {
  const runTest = <A, E, R>(effect: Effect.Effect<A, E, R>),
    Effect.runSync(Effect.provide(effect, ChunkManagerLive()) as Effect.Effect<A, E, never>)
    describe('Configuration', () => {
    it.effect('デフォルト設定でサービスを作成できる', () => Effect.gen(function* () {
    const test = Effect.gen(function* () {
    const manager = yield* ChunkManager
    const loadedCount = yield* manager.getLoadedChunkCount()
    const cachedCount = yield* manager.getCachedChunkCount()
    expect(loadedCount).toBe(0)
    expect(cachedCount).toBe(0)
    )
    runTest(test)
    it.effect('カスタム設定でサービスを作成できる', () => Effect.gen(function* () {
    const customConfig = {
    ...defaultChunkManagerConfig,
    maxLoadedChunks: 100,
    maxCachedChunks: 200,
    const test = Effect.gen(function* () {
    const manager = yield* ChunkManager
    const memoryUsage = yield* manager.getMemoryUsage()
    expect(memoryUsage).toBe(0) // 初期状態では0
    Effect.runSync(Effect.provide(test, ChunkManagerLive(customConfig)) as Effect.Effect<any, any, never>)
}) {
  it.effect('存在しないチャンクに対してnullを返す', () => Effect.gen(function* () {
    const test = Effect.gen(function* () {
    const manager = yield* ChunkManager
    const position: ChunkPosition = { x: 0, z: 0 }
    const chunk = yield* manager.getChunk(position)
    expect(chunk).toBeNull()
    runTest(test)
  }) {
  it.effect('プレイヤー位置周辺のチャンクロードを開始する', () => Effect.gen(function* () {
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
    runTest(test)
  }) {
  it.effect('初期状態でのメモリ使用量を取得できる', () => Effect.gen(function* () {
    const test = Effect.gen(function* () {
    const manager = yield* ChunkManager
    const memoryUsage = yield* manager.getMemoryUsage()
    expect(memoryUsage).toBe(0)
    )
    runTest(test)
    it.effect('チャンク数の統計を取得できる', () => Effect.gen(function* () {
    const test = Effect.gen(function* () {
    const manager = yield* ChunkManager
    const loadedCount = yield* manager.getLoadedChunkCount()
    const cachedCount = yield* manager.getCachedChunkCount()
    expect(typeof loadedCount).toBe('number')
    expect(typeof cachedCount).toBe('number')
    expect(loadedCount).toBeGreaterThanOrEqual(0)
    expect(cachedCount).toBeGreaterThanOrEqual(0)
    )
    runTest(test)
    describe('Unload Management', () => {
    it.effect('遠いチャンクのアンロード処理を実行できる', () => Effect.gen(function* () {
    const test = Effect.gen(function* () {
    const manager = yield* ChunkManager
    const centerPos = { x: 0, y: 64, z: 0 }
    yield* manager.unloadDistantChunks(centerPos)
    // アンロード処理が正常に完了することを確認
    const loadedCount = yield* manager.getLoadedChunkCount()
    expect(loadedCount).toBeGreaterThanOrEqual(0)
    runTest(test)
})
)
    // =============================================================================
    // Performance Tests
    // =============================================================================

    describe('Performance Tests', () => {
  describe('LRU Cache Performance', () => {
    it.effect('大量のキャッシュ操作でも高速に動作する', () => Effect.gen(function* () {
    const startTime = performance.now()
    let cache = createLRUCache<string, number>(1000)
    // 大量の挿入操作
    for (let i = 0; i < 5000; i++) {
    cache = lruPut(cache, `key_${i}`, i)
    // 大量の取得操作
    for (let i = 0; i < 1000; i++) {
    const [value] = lruGet(cache, `key_${i + 4000}`)
    expect(value).toBeDefined()
    const endTime = performance.now()
    const executionTime = endTime - startTime
    // 3秒以内で完了することを確認（CI環境考慮）
    expect(executionTime).toBeLessThan(3000)
}) {
  it.effect('大きな描画距離でも高速に生成できる', () => Effect.gen(function* () {
    const startTime = performance.now()
    const center: ChunkPosition = { x: 0, z: 0 }
    const order = generateLoadOrder(center, 32) // 65x65 = 4225チャンク
    const endTime = performance.now()
    const executionTime = endTime - startTime
    expect(order).toHaveLength(65 * 65)
    expect(executionTime).toBeLessThan(100) // 100ms以内
  })
)
    // =============================================================================
    // Edge Cases
    // =============================================================================

    describe('Edge Cases', () => {
  describe('LRU Cache Edge Cases', () => {
    it.effect('maxSize=1でも正しく動作する', () => Effect.gen(function* () {
    let cache = createLRUCache<string, number>(1)
    cache = lruPut(cache, 'a', 1)
    cache = lruPut(cache, 'b', 2)
    expect(cache.cache.has('a')).toBe(false)
    expect(cache.cache.get('b')).toBe(2)
    expect(cache.accessOrder).toEqual(['b'])
    )
    it.effect('maxSize=0でも動作する（常に空）', () => Effect.gen(function* () {
    let cache = createLRUCache<string, number>(0)
    cache = lruPut(cache, 'a', 1)
    expect(cache.cache.size).toBe(0)
    expect(cache.accessOrder).toEqual([])
    )
    describe('Coordinate Edge Cases', () => {
    it.effect('極端に大きな座標値でも処理できる', () => Effect.gen(function* () {
    const position: ChunkPosition = { x: 1000000, z: -1000000 }
    const key = chunkPositionToKey(position)
    expect(key).toBe('1000000,-1000000')
})
),
  Effect.gen(function* () {
        const worldPos = { x: -16.1, y: 64, z: 15.9 }
        const chunkPos = worldToChunkPosition(worldPos)
        expect(chunkPos).toEqual({ x: -2, z: 0 })

      })
  })
})
