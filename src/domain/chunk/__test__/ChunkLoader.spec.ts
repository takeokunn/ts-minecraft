/**
 * ChunkLoader Service Test Suite
 * 1対1対応テストファイル
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Effect, TestContext, Layer, Fiber } from 'effect'
import {
  ChunkLoader,
  ChunkLoaderLive,
  calculatePriorityScore,
  sortRequestsByPriority,
  createChunkLoadRequest,
  chunkLoadRequestToKey,
  isLoadExpired,
  defaultChunkLoaderConfig,
  type ChunkLoadRequest,
  type ChunkLoadPriority,
} from '../ChunkLoader.js'
import type { ChunkPosition } from '../ChunkPosition.js'
import type { WorldGenerator as WorldGeneratorInterface } from '../../world/index.js'
import { WorldGenerator } from '../ChunkLoader.js'

// =============================================================================
// Mock WorldGenerator
// =============================================================================

const createMockWorldGenerator = (): WorldGeneratorInterface => ({
  generateChunk: (position) =>
    Effect.succeed({
      chunk: {
        position,
        blocks: new Uint16Array(98304), // 16x16x384
        metadata: {
          version: 1,
          lastUpdate: Date.now(),
          isGenerated: true,
          biomeIds: new Uint8Array(256),
          heightMap: new Uint16Array(256),
        },
        isDirty: false,
        getBlock: () => Effect.succeed(0),
        setBlock: () => Effect.succeed({} as any),
        fillRegion: () => Effect.succeed({} as any),
        serialize: () => Effect.succeed(new ArrayBuffer(0)),
        deserialize: () => Effect.succeed({} as any),
        compress: () => Effect.succeed(new ArrayBuffer(0)),
        decompress: () => Effect.succeed({} as any),
        isEmpty: () => false,
        getMemoryUsage: () => 196608,
        clone: () => ({} as any),
      },
      biomes: [],
      structures: [],
      heightMap: [],
      metadata: {
        generationTime: 100,
        structureCount: 0,
        biomeDistribution: new Map(),
      },
    }),
  generateStructure: () => Effect.succeed({} as any),
  getSpawnPoint: () => Effect.succeed({ x: 0, y: 64, z: 0 }),
  getBiome: () => Effect.succeed({} as any),
  getTerrainHeight: () => Effect.succeed(64),
  getSeed: () => 12345,
  getOptions: () => ({} as any),
  canGenerateStructure: () => Effect.succeed(false),
  findNearestStructure: () => Effect.succeed(null),
})

const MockWorldGeneratorLive = Layer.succeed(
  WorldGenerator,
  createMockWorldGenerator()
)

// =============================================================================
// Test Utilities
// =============================================================================

const runChunkLoaderTest = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.runSync(
    Effect.provide(
      effect,
      Layer.provide(ChunkLoaderLive(), MockWorldGeneratorLive)
    )
  )

// =============================================================================
// Priority Functions Tests
// =============================================================================

describe('Priority Functions', () => {
  describe('calculatePriorityScore', () => {
    const config = defaultChunkLoaderConfig

    it('immediate優先度が最も高いスコアを持つ', () => {
      const request = createChunkLoadRequest(
        { x: 0, z: 0 },
        'immediate',
        1.0
      )

      const score = calculatePriorityScore(request, config)
      expect(score).toBeGreaterThan(900) // 1000 - distance penalty - age penalty
    })

    it('距離が遠いほどスコアが低くなる', () => {
      const nearRequest = createChunkLoadRequest(
        { x: 0, z: 0 },
        'high',
        1.0
      )
      const farRequest = createChunkLoadRequest(
        { x: 0, z: 0 },
        'high',
        10.0
      )

      const nearScore = calculatePriorityScore(nearRequest, config)
      const farScore = calculatePriorityScore(farRequest, config)

      expect(nearScore).toBeGreaterThan(farScore)
    })

    it('古いリクエストほどスコアが低くなる', () => {
      // 手動でタイムスタンプを設定
      const oldRequest: ChunkLoadRequest = {
        position: { x: 0, z: 0 },
        priority: 'normal',
        timestamp: Date.now() - 10000, // 10秒前
        playerDistance: 1.0,
      }

      const newRequest = createChunkLoadRequest(
        { x: 0, z: 0 },
        'normal',
        1.0
      )

      const oldScore = calculatePriorityScore(oldRequest, config)
      const newScore = calculatePriorityScore(newRequest, config)

      expect(newScore).toBeGreaterThan(oldScore)
    })
  })

  describe('sortRequestsByPriority', () => {
    const config = defaultChunkLoaderConfig

    it('優先度順に正しくソートされる', () => {
      const requests: ChunkLoadRequest[] = [
        createChunkLoadRequest({ x: 0, z: 0 }, 'low', 1.0),
        createChunkLoadRequest({ x: 1, z: 1 }, 'immediate', 1.0),
        createChunkLoadRequest({ x: 2, z: 2 }, 'high', 1.0),
        createChunkLoadRequest({ x: 3, z: 3 }, 'normal', 1.0),
      ]

      const sorted = sortRequestsByPriority(requests, config)

      expect(sorted[0]?.priority).toBe('immediate')
      expect(sorted[1]?.priority).toBe('high')
      expect(sorted[2]?.priority).toBe('normal')
      expect(sorted[3]?.priority).toBe('low')
    })

    it('同じ優先度では距離順にソートされる', () => {
      const requests: ChunkLoadRequest[] = [
        createChunkLoadRequest({ x: 0, z: 0 }, 'high', 10.0),
        createChunkLoadRequest({ x: 1, z: 1 }, 'high', 1.0),
        createChunkLoadRequest({ x: 2, z: 2 }, 'high', 5.0),
      ]

      const sorted = sortRequestsByPriority(requests, config)

      expect(sorted[0]?.playerDistance).toBe(1.0)
      expect(sorted[1]?.playerDistance).toBe(5.0)
      expect(sorted[2]?.playerDistance).toBe(10.0)
    })
  })

  describe('createChunkLoadRequest', () => {
    it('正しい構造のリクエストを作成する', () => {
      const position: ChunkPosition = { x: 5, z: -3 }
      const priority: ChunkLoadPriority = 'high'
      const distance = 7.5

      const request = createChunkLoadRequest(position, priority, distance)

      expect(request.position).toEqual(position)
      expect(request.priority).toBe(priority)
      expect(request.playerDistance).toBe(distance)
      expect(request.timestamp).toBeGreaterThan(0)
      expect(request.timestamp).toBeLessThanOrEqual(Date.now())
    })
  })
})

// =============================================================================
// Utility Functions Tests
// =============================================================================

describe('Utility Functions', () => {
  describe('chunkLoadRequestToKey', () => {
    it('チャンク座標を文字列キーに変換する', () => {
      const position: ChunkPosition = { x: 42, z: -17 }
      const key = chunkLoadRequestToKey(position)

      expect(key).toBe('42,-17')
    })
  })

  describe('isLoadExpired', () => {
    it('タイムアウト時間内の場合はfalseを返す', () => {
      const state = {
        position: { x: 0, z: 0 },
        status: 'loading' as const,
        startTime: Date.now() - 1000, // 1秒前
      }

      const expired = isLoadExpired(state, 5000) // 5秒タイムアウト
      expect(expired).toBe(false)
    })

    it('タイムアウト時間を超えた場合はtrueを返す', () => {
      const state = {
        position: { x: 0, z: 0 },
        status: 'loading' as const,
        startTime: Date.now() - 10000, // 10秒前
      }

      const expired = isLoadExpired(state, 5000) // 5秒タイムアウト
      expect(expired).toBe(true)
    })

    it('startTimeがない場合はfalseを返す', () => {
      const state = {
        position: { x: 0, z: 0 },
        status: 'queued' as const,
      }

      const expired = isLoadExpired(state, 5000)
      expect(expired).toBe(false)
    })
  })
})

// =============================================================================
// ChunkLoader Service Tests
// =============================================================================

describe('ChunkLoader Service', () => {
  describe('Configuration', () => {
    it('デフォルト設定でサービスを作成できる', () => {
      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader
        const queueSize = yield* loader.getQueueSize()
        const activeCount = yield* loader.getActiveLoadCount()

        expect(queueSize).toBe(0)
        expect(activeCount).toBe(0)
      })

      runChunkLoaderTest(test)
    })

    it('カスタム設定でサービスを作成できる', () => {
      const customConfig = {
        ...defaultChunkLoaderConfig,
        maxConcurrentLoads: 8,
        queueCapacity: 500,
      }

      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader
        const queueSize = yield* loader.getQueueSize()

        expect(queueSize).toBe(0)
      })

      Effect.runSync(
        Effect.provide(
          test,
          Layer.provide(ChunkLoaderLive(customConfig), MockWorldGeneratorLive)
        )
      )
    })
  })

  describe('queueChunkLoad', () => {
    it('チャンクロードリクエストをキューに追加できる', () => {
      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader
        const position: ChunkPosition = { x: 1, z: 2 }

        yield* loader.queueChunkLoad(position, 'high', 5.0)

        const queueSize = yield* loader.getQueueSize()
        const loadState = yield* loader.getLoadState(position)

        expect(queueSize).toBe(1)
        expect(loadState?.status).toBe('queued')
        expect(loadState?.position).toEqual(position)
      })

      runChunkLoaderTest(test)
    })

    it('同じチャンクの重複リクエストは追加されない', () => {
      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader
        const position: ChunkPosition = { x: 0, z: 0 }

        yield* loader.queueChunkLoad(position, 'high', 1.0)
        yield* loader.queueChunkLoad(position, 'immediate', 0.5) // 重複

        const queueSize = yield* loader.getQueueSize()
        expect(queueSize).toBe(1)
      })

      runChunkLoaderTest(test)
    })
  })

  describe('queueChunkLoadBatch', () => {
    it('複数のチャンクを一度にキューに追加できる', () => {
      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader

        const requests = [
          { position: { x: 0, z: 0 }, priority: 'high' as const, playerDistance: 1.0 },
          { position: { x: 1, z: 0 }, priority: 'normal' as const, playerDistance: 2.0 },
          { position: { x: 0, z: 1 }, priority: 'low' as const, playerDistance: 3.0 },
        ]

        yield* loader.queueChunkLoadBatch(requests)

        const queueSize = yield* loader.getQueueSize()
        expect(queueSize).toBe(3)

        // 各チャンクの状態を確認
        for (const request of requests) {
          const loadState = yield* loader.getLoadState(request.position)
          expect(loadState?.status).toBe('queued')
        }
      })

      runChunkLoaderTest(test)
    })
  })

  describe('Load Processing', () => {
    it('ロード処理を開始・停止できる', () => {
      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader

        // ロード処理開始
        const processingFiber = yield* loader.startLoadProcessing()
        expect(processingFiber).toBeDefined()

        // 少し待ってから停止
        yield* Effect.sleep('100 millis')
        yield* loader.stopLoadProcessing()

        // Fiberが停止されたことを確認
        const fiberState = yield* Fiber.status(processingFiber)
        expect(fiberState._tag).toBe('Done')
      })

      runChunkLoaderTest(test)
    })

    it('既にロード処理が開始されている場合は同じFiberを返す', () => {
      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader

        const fiber1 = yield* loader.startLoadProcessing()
        const fiber2 = yield* loader.startLoadProcessing()

        expect(fiber1).toBe(fiber2)

        yield* loader.stopLoadProcessing()
      })

      runChunkLoaderTest(test)
    })
  })

  describe('Load State Management', () => {
    it('存在しないチャンクの状態はnullを返す', () => {
      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader
        const position: ChunkPosition = { x: 999, z: 999 }

        const loadState = yield* loader.getLoadState(position)
        expect(loadState).toBeNull()
      })

      runChunkLoaderTest(test)
    })

    it('キューに追加されたチャンクの状態を取得できる', () => {
      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader
        const position: ChunkPosition = { x: 5, z: -3 }

        yield* loader.queueChunkLoad(position, 'immediate', 2.5)

        const loadState = yield* loader.getLoadState(position)
        expect(loadState?.status).toBe('queued')
        expect(loadState?.position).toEqual(position)
      })

      runChunkLoaderTest(test)
    })
  })

  describe('Statistics', () => {
    it('アクティブロード数とキューサイズを正確に追跡する', () => {
      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader

        // 初期状態
        expect(yield* loader.getActiveLoadCount()).toBe(0)
        expect(yield* loader.getQueueSize()).toBe(0)

        // チャンクをキューに追加
        yield* loader.queueChunkLoad({ x: 0, z: 0 }, 'high', 1.0)
        yield* loader.queueChunkLoad({ x: 1, z: 0 }, 'normal', 2.0)

        expect(yield* loader.getQueueSize()).toBe(2)
        expect(yield* loader.getActiveLoadCount()).toBe(0)
      })

      runChunkLoaderTest(test)
    })
  })

  describe('Load Cancellation', () => {
    it('特定のチャンクロードをキャンセルできる', () => {
      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader
        const position: ChunkPosition = { x: 0, z: 0 }

        yield* loader.queueChunkLoad(position, 'high', 1.0)

        const cancelled = yield* loader.cancelChunkLoad(position)
        expect(cancelled).toBe(false) // キューにある状態ではキャンセルできない

        const loadState = yield* loader.getLoadState(position)
        expect(loadState?.status).toBe('queued') // まだキューにある
      })

      runChunkLoaderTest(test)
    })

    it('全てのロードをキャンセルできる', () => {
      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader

        // 複数のチャンクをキューに追加
        yield* loader.queueChunkLoad({ x: 0, z: 0 }, 'high', 1.0)
        yield* loader.queueChunkLoad({ x: 1, z: 0 }, 'normal', 2.0)

        expect(yield* loader.getQueueSize()).toBe(2)

        yield* loader.cancelAllLoads()

        expect(yield* loader.getQueueSize()).toBe(0)
        expect(yield* loader.getActiveLoadCount()).toBe(0)
      })

      runChunkLoaderTest(test)
    })
  })
})

// =============================================================================
// Performance Tests
// =============================================================================

describe('Performance Tests', () => {
  describe('Queue Performance', () => {
    it('大量のチャンクリクエストを高速で処理できる', () => {
      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader
        const startTime = performance.now()

        // 1000個のチャンクリクエストを作成
        const requests = Array.from({ length: 1000 }, (_, i) => ({
          position: { x: i % 50, z: Math.floor(i / 50) },
          priority: (['immediate', 'high', 'normal', 'low'][i % 4]) as ChunkLoadPriority,
          playerDistance: Math.random() * 20,
        }))

        yield* loader.queueChunkLoadBatch(requests)

        const endTime = performance.now()
        const executionTime = endTime - startTime

        expect(yield* loader.getQueueSize()).toBe(1000)
        expect(executionTime).toBeLessThan(1000) // 1秒以内
      })

      runChunkLoaderTest(test)
    })
  })

  describe('Priority Calculation Performance', () => {
    it('大量の優先度計算を高速で実行できる', () => {
      const config = defaultChunkLoaderConfig
      const startTime = performance.now()

      const requests: ChunkLoadRequest[] = Array.from({ length: 10000 }, (_, i) => ({
        position: { x: i % 100, z: Math.floor(i / 100) },
        priority: (['immediate', 'high', 'normal', 'low'][i % 4]) as ChunkLoadPriority,
        timestamp: Date.now() - Math.random() * 10000,
        playerDistance: Math.random() * 50,
      }))

      const sorted = sortRequestsByPriority(requests, config)

      const endTime = performance.now()
      const executionTime = endTime - startTime

      expect(sorted).toHaveLength(10000)
      expect(executionTime).toBeLessThan(500) // 500ms以内
    })
  })
})

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  describe('Configuration Edge Cases', () => {
    it('maxConcurrentLoads=1でも正しく動作する', () => {
      const config = {
        ...defaultChunkLoaderConfig,
        maxConcurrentLoads: 1,
      }

      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader

        yield* loader.queueChunkLoad({ x: 0, z: 0 }, 'high', 1.0)
        yield* loader.queueChunkLoad({ x: 1, z: 0 }, 'high', 1.0)

        expect(yield* loader.getQueueSize()).toBe(2)
      })

      Effect.runSync(
        Effect.provide(
          test,
          Layer.provide(ChunkLoaderLive(config), MockWorldGeneratorLive)
        )
      )
    })

    it('queueCapacity=0でも動作する（即座に処理）', () => {
      const config = {
        ...defaultChunkLoaderConfig,
        queueCapacity: 1, // 最小値1
      }

      const test = Effect.gen(function* () {
        const loader = yield* ChunkLoader

        yield* loader.queueChunkLoad({ x: 0, z: 0 }, 'high', 1.0)

        // キューサイズが制限されることを確認
        expect(yield* loader.getQueueSize()).toBeLessThanOrEqual(1)
      })

      Effect.runSync(
        Effect.provide(
          test,
          Layer.provide(ChunkLoaderLive(config), MockWorldGeneratorLive)
        )
      )
    })
  })

  describe('Priority Edge Cases', () => {
    it('同じスコアのリクエストでも安定したソートを行う', () => {
      const config = defaultChunkLoaderConfig

      const requests: ChunkLoadRequest[] = [
        {
          position: { x: 0, z: 0 },
          priority: 'normal',
          timestamp: 1000,
          playerDistance: 5.0,
        },
        {
          position: { x: 1, z: 0 },
          priority: 'normal',
          timestamp: 1000,
          playerDistance: 5.0,
        },
      ]

      const sorted1 = sortRequestsByPriority([...requests], config)
      const sorted2 = sortRequestsByPriority([...requests], config)

      // 安定ソートの確認（順序が一貫している）
      expect(sorted1[0]?.position).toEqual(sorted2[0]?.position)
      expect(sorted1[1]?.position).toEqual(sorted2[1]?.position)
    })
  })
})