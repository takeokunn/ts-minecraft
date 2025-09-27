/**
 * ViewDistance Service Test Suite
 * 1対1対応テストファイル
 */

import { it } from '@effect/vitest'
import { Effect, TestClock } from 'effect'
import { describe, expect } from 'vitest'
import type { ChunkPosition } from '../ChunkPosition'
import {
  ViewDistance,
  ViewDistanceLive,
  analyzePerformanceTrend,
  calculateAverageMetrics,
  calculateChunkPriority,
  calculateOptimalViewDistance,
  defaultViewDistanceConfig,
  getVisibleChunkPositions,
  type PerformanceMetrics,
} from '../ViewDistance'

// =============================================================================
// Test Utilities
// =============================================================================

// runViewDistanceTest helper removed - use it.effect with proper provider pattern instead

const createMockMetrics = (overrides: Partial<PerformanceMetrics> = {}): PerformanceMetrics => ({
  frameRate: 60,
  memoryUsageMB: 1000,
  averageChunkLoadTimeMs: 100,
  totalLoadedChunks: 400,
  timestamp: Date.now(),
  ...overrides,
})

// =============================================================================
// Pure Function Tests
// =============================================================================

describe('Performance Analysis Functions', () => {
  describe('calculateAverageMetrics', () => {
    it.effect('空の履歴に対してnullを返す', () =>
      Effect.gen(function* () {
        const average = calculateAverageMetrics([])
        expect(average).toBeNull()
      })
    )

    it.effect('単一のメトリクスに対してそのまま返す', () =>
      Effect.gen(function* () {
        const metrics = createMockMetrics({ frameRate: 45 })
        const average = calculateAverageMetrics([metrics], 10)

        expect(average?.frameRate).toBe(45)
        expect(average?.memoryUsageMB).toBe(1000)
      })
    )

    it.effect('複数メトリクスの平均を正しく計算する', () =>
      Effect.gen(function* () {
        const metrics = [
          createMockMetrics({ frameRate: 60, memoryUsageMB: 800 }),
          createMockMetrics({ frameRate: 50, memoryUsageMB: 1200 }),
          createMockMetrics({ frameRate: 70, memoryUsageMB: 1000 }),
        ]

        const average = calculateAverageMetrics(metrics, 10)

        expect(average?.frameRate).toBe(60) // (60+50+70)/3
        expect(average?.memoryUsageMB).toBe(1000) // (800+1200+1000)/3
      })
    )

    it.effect('サンプル数制限が正しく適用される', () =>
      Effect.gen(function* () {
        const metrics = Array.from({ length: 10 }, (_, i) => createMockMetrics({ frameRate: 60 + i }))

        const average = calculateAverageMetrics(metrics, 3)

        // 最後の3つの平均: (67+68+69)/3 = 68
        expect(average?.frameRate).toBe(68)
      })
    )
  })

  describe('analyzePerformanceTrend', () => {
    it.effect('履歴が不足している場合は全て安定を返す', () =>
      Effect.gen(function* () {
        const metrics = [createMockMetrics()]
        const trend = analyzePerformanceTrend(metrics, defaultViewDistanceConfig)

        expect(trend.frameRateTrend).toBe('stable')
        expect(trend.memoryTrend).toBe('stable')
        expect(trend.loadTimeTrend).toBe('stable')
      })
    )

    it.effect('フレームレート向上を正しく検出する', () =>
      Effect.gen(function* () {
        const config = { ...defaultViewDistanceConfig, adjustmentThreshold: 0.1 }

        // 古いメトリクス: 低いフレームレート
        const olderMetrics = Array.from({ length: 5 }, () => createMockMetrics({ frameRate: 45 }))

        // 新しいメトリクス: 高いフレームレート
        const recentMetrics = Array.from({ length: 5 }, () => createMockMetrics({ frameRate: 60 }))

        const allMetrics = [...Array.from({ length: 5 }, () => createMockMetrics()), ...olderMetrics, ...recentMetrics]

        const trend = analyzePerformanceTrend(allMetrics, config)
        expect(trend.frameRateTrend).toBe('improving')
      })
    )

    it.effect('メモリ使用量悪化を正しく検出する', () =>
      Effect.gen(function* () {
        const config = { ...defaultViewDistanceConfig, adjustmentThreshold: 0.1 }

        const olderMetrics = Array.from({ length: 5 }, () => createMockMetrics({ memoryUsageMB: 800 }))

        const recentMetrics = Array.from({ length: 5 }, () => createMockMetrics({ memoryUsageMB: 1200 }))

        const allMetrics = [...Array.from({ length: 5 }, () => createMockMetrics()), ...olderMetrics, ...recentMetrics]

        const trend = analyzePerformanceTrend(allMetrics, config)
        expect(trend.memoryTrend).toBe('degrading')
      })
    )
  })

  describe('calculateOptimalViewDistance', () => {
    const config = defaultViewDistanceConfig

    it.effect('低フレームレートで描画距離を減らす', () =>
      Effect.gen(function* () {
        const metrics = createMockMetrics({ frameRate: 30 }) // 目標60の50%
        const result = calculateOptimalViewDistance(16, metrics, config)

        expect(result.suggestedDistance).toBeLessThan(16)
        expect(result.reason).toBe('performance_low')
        expect(result.confidence).toBeGreaterThan(0.7)
      })
    )

    it.effect('高メモリ使用量で描画距離を減らす', () =>
      Effect.gen(function* () {
        const metrics = createMockMetrics({ memoryUsageMB: 1800 }) // 上限2000の90%
        const result = calculateOptimalViewDistance(16, metrics, config)

        expect(result.suggestedDistance).toBeLessThan(16)
        expect(result.reason).toBe('memory_high')
        expect(result.confidence).toBeGreaterThan(0.8)
      })
    )

    it.effect('高ロード時間で描画距離を減らす', () =>
      Effect.gen(function* () {
        const metrics = createMockMetrics({ averageChunkLoadTimeMs: 300 })
        const result = calculateOptimalViewDistance(16, metrics, config)

        expect(result.suggestedDistance).toBeLessThan(16)
        expect(result.reason).toBe('load_time_high')
        expect(result.confidence).toBeGreaterThan(0.6)
      })
    )

    it.effect('良好なパフォーマンスで描画距離を増やす', () =>
      Effect.gen(function* () {
        const metrics = createMockMetrics({
          frameRate: 75, // 目標の125%
          memoryUsageMB: 1000, // 上限の50%
          averageChunkLoadTimeMs: 50, // 基準の50%
        })
        const result = calculateOptimalViewDistance(16, metrics, config)

        expect(result.suggestedDistance).toBeGreaterThan(16)
        expect(result.reason).toBe('performance_good')
      })
    )

    it.effect('最小・最大描画距離の制限を守る', () =>
      Effect.gen(function* () {
        const metrics = createMockMetrics({ frameRate: 10 })

        const result = calculateOptimalViewDistance(4, metrics, config) // 既に最小
        expect(result.suggestedDistance).toBeGreaterThanOrEqual(config.minViewDistance)

        const maxResult = calculateOptimalViewDistance(
          32,
          {
            ...metrics,
            frameRate: 90,
            memoryUsageMB: 500,
            averageChunkLoadTimeMs: 30,
          },
          config
        )
        expect(maxResult.suggestedDistance).toBeLessThanOrEqual(config.maxViewDistance)
      })
    )
  })
})

// =============================================================================
// Chunk Position Functions Tests
// =============================================================================

describe('Chunk Position Functions', () => {
  describe('getVisibleChunkPositions', () => {
    it.effect('描画距離0では中心チャンクのみ返す', () =>
      Effect.gen(function* () {
        const center = { x: 16, y: 64, z: 32 }
        const positions = getVisibleChunkPositions(center, 0)

        expect(positions).toHaveLength(1)
        expect(positions[0]).toEqual({ x: 1, z: 2 })
      })
    )

    it.effect('描画距離1では9つのチャンクを返す', () =>
      Effect.gen(function* () {
        const center = { x: 0, y: 64, z: 0 }
        const positions = getVisibleChunkPositions(center, 1)

        expect(positions).toHaveLength(9) // 3x3
        expect(positions).toContainEqual({ x: 0, z: 0 }) // 中心
        expect(positions).toContainEqual({ x: -1, z: -1 }) // 角
        expect(positions).toContainEqual({ x: 1, z: 1 }) // 角
      })
    )

    it.effect('描画距離2では正しい数のチャンクを返す', () =>
      Effect.gen(function* () {
        const center = { x: 0, y: 64, z: 0 }
        const positions = getVisibleChunkPositions(center, 2)

        expect(positions).toHaveLength(25) // 5x5
      })
    )

    it.effect('ワールド座標からチャンク座標への変換が正しい', () =>
      Effect.gen(function* () {
        const center = { x: 17, y: 64, z: -15 }
        const positions = getVisibleChunkPositions(center, 1)

        // 17/16=1.0625→1, -15/16=-0.9375→-1
        const centerChunk = { x: 1, z: -1 }
        expect(positions).toContainEqual(centerChunk)
      })
    )
  })

  describe('calculateChunkPriority', () => {
    it.effect('プレイヤーに近いチャンクほど高い優先度を持つ', () =>
      Effect.gen(function* () {
        const playerPos = { x: 0, y: 64, z: 0 }
        const viewDistance = 4

        const nearChunk: ChunkPosition = { x: 0, z: 0 }
        const farChunk: ChunkPosition = { x: 3, z: 3 }

        const nearPriority = calculateChunkPriority(nearChunk, playerPos, viewDistance)
        const farPriority = calculateChunkPriority(farChunk, playerPos, viewDistance)

        expect(nearPriority).toBeGreaterThan(farPriority)
      })
    )

    it.effect('プレイヤーの前方にあるチャンクがやや高い優先度を持つ', () =>
      Effect.gen(function* () {
        const playerPos = { x: 0, y: 64, z: 0 }
        const viewDistance = 4

        const frontChunk: ChunkPosition = { x: 1, z: 0 } // 右（前方と仮定）
        const backChunk: ChunkPosition = { x: -1, z: 0 } // 左（後方と仮定）

        const frontPriority = calculateChunkPriority(frontChunk, playerPos, viewDistance)
        const backPriority = calculateChunkPriority(backChunk, playerPos, viewDistance)

        expect(frontPriority).toBeGreaterThanOrEqual(backPriority)
      })
    )

    it.effect('優先度が0-1の範囲内にある', () =>
      Effect.gen(function* () {
        const playerPos = { x: 0, y: 64, z: 0 }
        const viewDistance = 4

        const chunk: ChunkPosition = { x: 2, z: 1 }
        const priority = calculateChunkPriority(chunk, playerPos, viewDistance)

        expect(priority).toBeGreaterThanOrEqual(0)
        expect(priority).toBeLessThanOrEqual(1)
      })
    )
  })
})

// =============================================================================
// ViewDistance Service Tests
// =============================================================================

describe('ViewDistance Service', () => {
  describe('Configuration', () => {
    it.effect('デフォルト設定でサービスを作成できる', () =>
      Effect.gen(function* () {
        const viewDistance = yield* ViewDistance
        const currentDistance = yield* viewDistance.getCurrentViewDistance()

        expect(currentDistance).toBe(defaultViewDistanceConfig.defaultViewDistance)
      }).pipe(Effect.provide(ViewDistanceLive()))
    )

    it.effect('カスタム設定でサービスを作成できる', () => {
      const customConfig = {
        ...defaultViewDistanceConfig,
        defaultViewDistance: 8,
        maxViewDistance: 24,
      }

      return Effect.gen(function* () {
        const viewDistance = yield* ViewDistance
        const currentDistance = yield* viewDistance.getCurrentViewDistance()

        expect(currentDistance).toBe(8)
      }).pipe(Effect.provide(ViewDistanceLive(customConfig)))
    })
  })

  describe('setViewDistance', () => {
    it.effect('描画距離を設定できる', () =>
      Effect.gen(function* () {
        const viewDistance = yield* ViewDistance

        yield* viewDistance.setViewDistance(12, 'manual')
        const newDistance = yield* viewDistance.getCurrentViewDistance()

        expect(newDistance).toBe(12)
      }).pipe(Effect.provide(ViewDistanceLive()))
    )

    it.effect('設定時に最小・最大値で制限される', () =>
      Effect.gen(function* () {
        const viewDistance = yield* ViewDistance

        // 最小値未満
        yield* viewDistance.setViewDistance(2, 'manual')
        expect(yield* viewDistance.getCurrentViewDistance()).toBe(defaultViewDistanceConfig.minViewDistance)

        // 最大値超過
        yield* viewDistance.setViewDistance(50, 'manual')
        expect(yield* viewDistance.getCurrentViewDistance()).toBe(defaultViewDistanceConfig.maxViewDistance)
      }).pipe(Effect.provide(ViewDistanceLive()))
    )

    it.effect('同じ値の設定では履歴が更新されない', () =>
      Effect.gen(function* () {
        const viewDistance = yield* ViewDistance

        const initialStats = yield* viewDistance.getPerformanceStats()
        const initialHistoryLength = initialStats.adjustmentHistory.length

        yield* viewDistance.setViewDistance(16, 'manual') // デフォルトと同じ

        const newStats = yield* viewDistance.getPerformanceStats()
        expect(newStats.adjustmentHistory).toHaveLength(initialHistoryLength)
      }).pipe(Effect.provide(ViewDistanceLive()))
    )
  })

  describe('updateMetrics', () => {
    it.effect('パフォーマンスメトリクスを更新できる', () =>
      Effect.gen(function* () {
        const viewDistance = yield* ViewDistance
        const metrics = createMockMetrics({ frameRate: 45 })

        yield* viewDistance.updateMetrics(metrics)

        const stats = yield* viewDistance.getPerformanceStats()
        expect(stats.currentMetrics?.frameRate).toBe(45)
      }).pipe(Effect.provide(ViewDistanceLive()))
    )

    it.effect('複数のメトリクスを履歴として保持する', () =>
      Effect.gen(function* () {
        const viewDistance = yield* ViewDistance

        const metrics1 = createMockMetrics({ frameRate: 60 })
        const metrics2 = createMockMetrics({ frameRate: 45 })

        yield* viewDistance.updateMetrics(metrics1)
        yield* viewDistance.updateMetrics(metrics2)

        const stats = yield* viewDistance.getPerformanceStats()
        expect(stats.currentMetrics?.frameRate).toBe(45)
        expect(stats.averageMetrics?.frameRate).toBe(52.5) // (60+45)/2
      }).pipe(Effect.provide(ViewDistanceLive()))
    )

    it.effect('履歴サイズの制限が適用される', () => {
      const config = {
        ...defaultViewDistanceConfig,
        metricsHistorySize: 3,
      }

      return Effect.gen(function* () {
        const viewDistance = yield* ViewDistance

        // 制限を超えるメトリクスを追加
        for (let i = 0; i < 5; i++) {
          yield* viewDistance.updateMetrics(createMockMetrics({ frameRate: 60 + i }))
        }

        const stats = yield* viewDistance.getPerformanceStats()

        // 最新の3つのみ保持されていることを確認
        // 平均は最後の3つ: (62+63+64)/3 = 63
        expect(stats.averageMetrics?.frameRate).toBe(63)
      }).pipe(Effect.provide(ViewDistanceLive(config)))
    })
  })

  describe('performAdaptiveAdjustment', () => {
    it.effect('適応調整が無効の場合はnullを返す', () => {
      const config = {
        ...defaultViewDistanceConfig,
        adaptiveEnabled: false,
      }

      return Effect.gen(function* () {
        const viewDistance = yield* ViewDistance

        // メトリクスを追加
        for (let i = 0; i < 15; i++) {
          yield* viewDistance.updateMetrics(createMockMetrics())
        }

        const adjustment = yield* viewDistance.performAdaptiveAdjustment()
        expect(adjustment).toBeNull()
      }).pipe(Effect.provide(ViewDistanceLive(config)))
    })

    it.effect('メトリクス履歴が不足している場合はnullを返す', () =>
      Effect.gen(function* () {
        const viewDistance = yield* ViewDistance

        // 少ないメトリクスのみ追加
        yield* viewDistance.updateMetrics(createMockMetrics())

        const adjustment = yield* viewDistance.performAdaptiveAdjustment()
        expect(adjustment).toBeNull()
      }).pipe(Effect.provide(ViewDistanceLive()))
    )

    it.effect('低パフォーマンスで自動的に描画距離を減らす', () =>
      Effect.gen(function* () {
        const viewDistance = yield* ViewDistance

        // 低パフォーマンスメトリクスを追加
        for (let i = 0; i < 15; i++) {
          yield* viewDistance.updateMetrics(createMockMetrics({ frameRate: 30 }))
        }

        // TestClockを使用して時間を進める（決定論的）
        yield* TestClock.adjust('6 seconds')

        const adjustment = yield* viewDistance.performAdaptiveAdjustment()

        expect(adjustment).not.toBeNull()
        expect(adjustment?.newDistance).toBeLessThan(adjustment?.oldDistance ?? 0)
        expect(adjustment?.reason).toBe('performance_low')
      }).pipe(Effect.provide(ViewDistanceLive()))
    )
  })

  describe('getVisibleChunks', () => {
    it.effect('現在の描画距離に基づいて見えるチャンクを返す', () =>
      Effect.gen(function* () {
        const viewDistance = yield* ViewDistance

        yield* viewDistance.setViewDistance(8, 'manual')

        // 設定が正しく反映されているかテスト
        const currentDistance = yield* viewDistance.getCurrentViewDistance()
        expect(currentDistance).toBe(8)

        const playerPos = { x: 0, y: 64, z: 0 }
        const visibleChunks = yield* viewDistance.getVisibleChunks(playerPos)

        expect(visibleChunks).toHaveLength(289) // 17x17
      }).pipe(Effect.provide(ViewDistanceLive()))
    )
  })

  describe('getVisibleChunksWithPriority', () => {
    it.effect('優先度付きでチャンクを返し、高い順にソートされる', () =>
      Effect.gen(function* () {
        const viewDistance = yield* ViewDistance

        yield* viewDistance.setViewDistance(5, 'manual')

        // 設定が正しく反映されているかテスト
        const currentDistance = yield* viewDistance.getCurrentViewDistance()
        expect(currentDistance).toBe(5)

        const playerPos = { x: 0, y: 64, z: 0 }
        const chunksWithPriority = yield* viewDistance.getVisibleChunksWithPriority(playerPos)

        expect(chunksWithPriority).toHaveLength(121) // 11x11

        // 優先度順にソートされていることを確認
        for (let i = 0; i < chunksWithPriority.length - 1; i++) {
          expect(chunksWithPriority[i]?.priority).toBeGreaterThanOrEqual(chunksWithPriority[i + 1]?.priority ?? 0)
        }

        // 中心チャンクが最高優先度であることを確認
        const centerChunk = chunksWithPriority.find((c) => c.position.x === 0 && c.position.z === 0)
        expect(centerChunk?.priority).toBe(chunksWithPriority[0]?.priority)
      }).pipe(Effect.provide(ViewDistanceLive()))
    )
  })

  describe('updateConfig', () => {
    it.effect('設定を部分的に更新できる', () =>
      Effect.gen(function* () {
        const viewDistance = yield* ViewDistance

        yield* viewDistance.updateConfig({
          maxViewDistance: 20,
          adaptiveEnabled: false,
        })

        // 新しい最大値を確認
        yield* viewDistance.setViewDistance(25, 'manual')
        const newDistance = yield* viewDistance.getCurrentViewDistance()

        expect(newDistance).toBe(20) // 新しい最大値で制限される
      }).pipe(Effect.provide(ViewDistanceLive()))
    )
  })

  describe('Performance Statistics', () => {
    it.effect('パフォーマンス統計を正しく取得できる', () =>
      Effect.gen(function* () {
        const viewDistance = yield* ViewDistance

        // メトリクスを追加
        yield* viewDistance.updateMetrics(createMockMetrics({ frameRate: 60 }))
        yield* viewDistance.updateMetrics(createMockMetrics({ frameRate: 45 }))

        // 描画距離調整
        yield* viewDistance.setViewDistance(12, 'manual')

        const stats = yield* viewDistance.getPerformanceStats()

        expect(stats.currentMetrics?.frameRate).toBe(45)
        expect(stats.averageMetrics?.frameRate).toBe(52.5)
        expect(stats.adjustmentHistory).toHaveLength(1)
        expect(stats.adjustmentHistory[0]?.newDistance).toBe(12)
      }).pipe(Effect.provide(ViewDistanceLive()))
    )
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe('Integration Tests', () => {
  it.effect('完全なワークフロー: メトリクス更新→適応調整→チャンク取得', () =>
    Effect.gen(function* () {
      const viewDistance = yield* ViewDistance

      // 初期状態
      const initialDistance = yield* viewDistance.getCurrentViewDistance()

      // 低パフォーマンスメトリクスを複数回更新
      for (let i = 0; i < 15; i++) {
        yield* viewDistance.updateMetrics(
          createMockMetrics({
            frameRate: 25, // 低いフレームレート
            memoryUsageMB: 1500,
            averageChunkLoadTimeMs: 250,
          })
        )
      }

      // 時間経過をシミュレート（決定論的）
      yield* TestClock.adjust('6 seconds')

      // 適応調整を実行
      const adjustment = yield* viewDistance.performAdaptiveAdjustment()

      expect(adjustment).not.toBeNull()
      expect(adjustment?.newDistance).toBeLessThan(initialDistance)

      // 新しい描画距離で見えるチャンクを取得
      const playerPos = { x: 0, y: 64, z: 0 }
      const visibleChunks = yield* viewDistance.getVisibleChunks(playerPos)

      // 減った描画距離に応じてチャンク数も減る
      const expectedChunks = (adjustment?.newDistance ?? 0) * 2 + 1
      expect(visibleChunks.length).toBeLessThanOrEqual(expectedChunks * expectedChunks)
    }).pipe(Effect.provide(ViewDistanceLive()))
  )
})
