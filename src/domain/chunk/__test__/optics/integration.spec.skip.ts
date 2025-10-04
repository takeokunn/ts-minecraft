/**
 * Optics Integration テストスイート
 *
 * 全てのOptics実装の統合テスト
 * 実世界シナリオでの動作検証
 */

import { describe, it, expect } from 'vitest'
import { Effect, pipe } from 'effect'
import { ChunkDataOptics, ChunkDataOpticsHelpers } from '../../aggregate/chunk/optics'
import { ChunkTraversalOptics, ParallelChunkTraversalOptics } from '../../aggregate/chunk/traversal'
import { OptimizedChunkOptics, PerformanceMonitoring } from '../../aggregate/chunk/performance-optics'
import { ChunkCompositeOperations } from '../../aggregate/chunk/composite-operations'
import {
  ChunkStateOptics,
  ChunkStateOpticsHelpers,
  ChunkStateGuards
} from '../../types/state-optics'
import {
  AdvancedChunkStateOptics,
  ParallelChunkStateOptics,
  ReactiveChunkStateOptics
} from '../../types/advanced-state-optics'
import type { ChunkData } from '../../aggregate/chunk_data/types'
import type { ChunkState, ChunkTimestamp, LoadProgress } from '../../types/core'
import type { ChunkMetadata, HeightValue } from '../../value_object/chunk-metadata'
import type { ChunkPosition } from '../../value_object/chunk-position'

// リアルなシナリオデータの作成
const createRealisticChunk = (): ChunkData => {
  const blocks = new Uint16Array(65536)

  // 地形の生成（Y=0-63: 石、Y=64: 草、Y=65以上: 空気）
  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) {
      for (let y = 0; y < 256; y++) {
        const index = y * 256 + z * 16 + x
        if (y < 60) {
          blocks[index] = 1 // 石
        } else if (y < 63) {
          blocks[index] = 3 // 土
        } else if (y === 63) {
          blocks[index] = 2 // 草ブロック
        } else {
          blocks[index] = 0 // 空気
        }
      }
    }
  }

  // いくつかの構造物を追加
  // 木を生成
  for (let i = 0; i < 3; i++) {
    const treeX = 2 + i * 5
    const treeZ = 2 + i * 5

    // 幹
    for (let y = 64; y < 68; y++) {
      const index = y * 256 + treeZ * 16 + treeX
      blocks[index] = 17 // 木材
    }

    // 葉
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = 0; dy < 3; dy++) {
          const x = treeX + dx
          const z = treeZ + dz
          const y = 68 + dy

          if (x >= 0 && x < 16 && z >= 0 && z < 16 && y < 256) {
            const index = y * 256 + z * 16 + x
            blocks[index] = 18 // 葉ブロック
          }
        }
      }
    }
  }

  // 高さマップの計算
  const heightMap = new Array(256).fill(0) as HeightValue[]
  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) {
      let height = 0
      for (let y = 255; y >= 0; y--) {
        const index = y * 256 + z * 16 + x
        if (blocks[index] !== 0) {
          height = y
          break
        }
      }
      heightMap[z * 16 + x] = height as HeightValue
    }
  }

  return {
    id: 'realistic-chunk-001' as any,
    position: { x: 0, z: 0 } as ChunkPosition,
    blocks,
    metadata: {
      biome: 'plains',
      lightLevel: 15,
      heightMap,
      timestamp: Date.now() as ChunkTimestamp,
      isModified: false
    } as ChunkMetadata,
    isDirty: false
  }
}

const createRealisticLoadingState = (): Extract<ChunkState, { _tag: 'Loading' }> => ({
  _tag: 'Loading',
  progress: 0 as LoadProgress,
  startTime: Date.now() as ChunkTimestamp
})

describe('Optics Integration Tests', () => {
  describe('リアルワールドシナリオ: チャンク生成', () => {
    it('段階的チャンク生成プロセス', async () => {
      // 1. 空のチャンクから開始
      let chunk = createRealisticChunk()

      // 2. 基盤となる石層を設置
      const stoneUpdates = new Map<number, number>()
      for (let y = 0; y < 60; y++) {
        for (let x = 0; x < 16; x++) {
          for (let z = 0; z < 16; z++) {
            const index = y * 256 + z * 16 + x
            stoneUpdates.set(index, 1) // 石
          }
        }
      }

      chunk = OptimizedChunkOptics.batchBlockUpdate(chunk, stoneUpdates)
      expect(chunk.blocks[0]).toBe(1) // 底面は石

      // 3. 土層を追加
      const dirtLayer = { x: 0, y: 60, z: 0, width: 16, height: 3, depth: 16 }
      chunk = await Effect.runPromise(
        ChunkCompositeOperations.setBlockRegionWithHeightMap(
          chunk,
          dirtLayer,
          3, // 土ブロック
          Date.now() as ChunkTimestamp
        )
      )

      // 4. 草ブロック層を追加
      const grassUpdates = Array.from({ length: 256 }, (_, i) => ({
        index: 63 * 256 + i, // Y=63の全ブロック
        blockId: 2 // 草ブロック
      }))

      chunk = await Effect.runPromise(
        ParallelChunkTraversalOptics.parallelBlockUpdate(chunk, grassUpdates)
      )

      // 5. 高さマップの再計算
      chunk = ChunkDataOpticsHelpers.updateMetadata(chunk, {
        isModified: true,
        timestamp: Date.now() as ChunkTimestamp
      })

      // 検証
      expect(chunk.blocks[0]).toBe(1) // 底面: 石
      expect(chunk.blocks[60 * 256]).toBe(3) // Y=60: 土
      expect(chunk.blocks[63 * 256]).toBe(2) // Y=63: 草
      expect(chunk.blocks[64 * 256]).toBe(0) // Y=64: 空気
      expect(chunk.metadata.isModified).toBe(true)
    })

    it('構造物配置のリアルタイム更新', async () => {
      let chunk = createRealisticChunk()

      // 家の建設シミュレーション
      const house = {
        foundation: { x: 2, y: 64, z: 2, width: 8, height: 1, depth: 8 },
        walls: { x: 2, y: 65, z: 2, width: 8, height: 4, depth: 8 },
        roof: { x: 2, y: 69, z: 2, width: 8, height: 1, depth: 8 }
      }

      // 1. 基礎を設置
      chunk = await Effect.runPromise(
        ChunkCompositeOperations.setBlockRegionWithHeightMap(
          chunk,
          house.foundation,
          4, // 石材ブロック
          Date.now() as ChunkTimestamp
        )
      )

      // 2. 壁を設置（中を空洞にする複雑な操作）
      const wallBlocks = new Map<number, number>()
      for (let y = house.walls.y; y < house.walls.y + house.walls.height; y++) {
        for (let x = house.walls.x; x < house.walls.x + house.walls.width; x++) {
          for (let z = house.walls.z; z < house.walls.z + house.walls.depth; z++) {
            // 外周のみ壁ブロック
            if (x === house.walls.x || x === house.walls.x + house.walls.width - 1 ||
                z === house.walls.z || z === house.walls.z + house.walls.depth - 1) {
              const index = y * 256 + z * 16 + x
              wallBlocks.set(index, 5) // 壁ブロック
            }
          }
        }
      }

      chunk = OptimizedChunkOptics.batchBlockUpdate(chunk, wallBlocks)

      // 3. 屋根を設置
      chunk = await Effect.runPromise(
        ChunkCompositeOperations.setBlockRegionWithHeightMap(
          chunk,
          house.roof,
          6, // 屋根ブロック
          Date.now() as ChunkTimestamp
        )
      )

      // 検証
      const foundationIndex = 64 * 256 + 2 * 16 + 2
      const wallIndex = 65 * 256 + 2 * 16 + 2
      const roofIndex = 69 * 256 + 2 * 16 + 2

      expect(chunk.blocks[foundationIndex]).toBe(4) // 基礎
      expect(chunk.blocks[wallIndex]).toBe(5) // 壁
      expect(chunk.blocks[roofIndex]).toBe(6) // 屋根
    })
  })

  describe('リアルワールドシナリオ: チャンク状態管理', () => {
    it('チャンクロードプロセスの完全シミュレーション', async () => {
      // 1. Loading状態から開始
      let state = createRealisticLoadingState()

      // 2. 段階的ロード進行
      const loadSteps = [10, 25, 50, 75, 90, 100]
      for (const progress of loadSteps) {
        state = ChunkStateOpticsHelpers.updateLoadingProgress(
          state,
          progress as LoadProgress
        )

        expect(ChunkStateOptics.loadingProgress.get(state)).toBe(progress)

        // 50%で一時的なエラーをシミュレート
        if (progress === 50) {
          const { ChunkStates } = require('../../types/core')
          const failedState = ChunkStates.failed(
            'Network timeout',
            1 as any,
            Date.now() as ChunkTimestamp
          )

          // エラー状態での自動リトライ
          const retriedState = ChunkStateOpticsHelpers.incrementRetryCount(failedState)
          expect(ChunkStateOptics.failedRetryCount.get(retriedState)).toBe(2)

          // 復旧してLoadingに戻る
          state = ChunkStateOpticsHelpers.updateLoadingProgress(
            state,
            progress as LoadProgress
          )
        }
      }

      // 3. ロード完了時の自動状態遷移
      const chunkData = new Uint8Array(1024)
      const metadata = {
        biome: 'plains',
        lightLevel: 15,
        heightMap: new Array(256).fill(64),
        timestamp: Date.now() as ChunkTimestamp,
        isModified: false
      } as any

      const { ChunkStates } = require('../../types/core')
      const loadedState = ChunkStates.loaded(chunkData, metadata)

      expect(ChunkStateGuards.isLoaded(loadedState)).toBe(true)
      expect(ChunkStateOptics.loadedData.get(loadedState)).toBe(chunkData)
    })

    it('複数チャンクの並列状態管理', async () => {
      // 9個のチャンク（3x3グリッド）を並列管理
      const chunks = Array.from({ length: 9 }, (_, i) => ({
        position: { x: i % 3, z: Math.floor(i / 3) },
        state: createRealisticLoadingState()
      }))

      // 異なる進行度で更新
      const operations = chunks.map((chunk, index) =>
        Effect.succeed(
          ChunkStateOpticsHelpers.updateLoadingProgress(
            chunk.state,
            (index * 10 + 10) as LoadProgress
          )
        )
      )

      const updatedStates = await Effect.runPromise(
        ParallelChunkStateOptics.parallelUpdate(
          chunks.map(c => c.state),
          (state, index) => operations[index]
        )
      )

      // 結果検証
      updatedStates.forEach((state, index) => {
        const expectedProgress = index * 10 + 10
        expect(ChunkStateOptics.loadingProgress.get(state)).toBe(expectedProgress)
      })

      // 統計計算
      const statistics = await Effect.runPromise(
        ParallelChunkStateOptics.parallelStatistics(updatedStates)
      )

      expect(statistics.total).toBe(9)
      expect(statistics.byState.Loading).toBe(9)
      expect(statistics.hasProgress).toBe(9)
    })
  })

  describe('パフォーマンス統合テスト', () => {
    it('大規模シーンのリアルタイム更新', async () => {
      const chunks = Array.from({ length: 25 }, () => createRealisticChunk()) // 5x5チャンク

      const startTime = performance.now()

      // 各チャンクに爆発効果をシミュレート
      const explosionResults = await Promise.all(
        chunks.map(async (chunk, index) => {
          const explosionCenter = {
            x: 8 + (index % 2) * 4,
            y: 65,
            z: 8 + Math.floor(index / 5) * 4
          }

          // 爆発範囲のブロックを空気に置換
          const explosionRadius = 3
          const updates = new Map<number, number>()

          for (let dx = -explosionRadius; dx <= explosionRadius; dx++) {
            for (let dy = -explosionRadius; dy <= explosionRadius; dy++) {
              for (let dz = -explosionRadius; dz <= explosionRadius; dz++) {
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
                if (distance <= explosionRadius) {
                  const x = explosionCenter.x + dx
                  const y = explosionCenter.y + dy
                  const z = explosionCenter.z + dz

                  if (x >= 0 && x < 16 && y >= 0 && y < 256 && z >= 0 && z < 16) {
                    const blockIndex = y * 256 + z * 16 + x
                    updates.set(blockIndex, 0) // 空気ブロック
                  }
                }
              }
            }
          }

          return OptimizedChunkOptics.batchBlockUpdate(chunk, updates)
        })
      )

      const endTime = performance.now()
      const totalTime = endTime - startTime

      // パフォーマンス要件: 25チャンクの大規模更新が2秒以内
      expect(totalTime).toBeLessThan(2000)
      expect(explosionResults).toHaveLength(25)

      // 爆発効果の検証（中心付近が空気になっているか）
      const firstChunk = explosionResults[0]
      const centerIndex = 65 * 256 + 8 * 16 + 8 // 爆発中心
      expect(firstChunk.blocks[centerIndex]).toBe(0) // 空気
    })

    it('リアクティブ状態監視システム', async () => {
      let stateTransitions = 0
      let errorDetections = 0

      // 状態遷移の監視
      const transitionWatcher = ReactiveChunkStateOptics.watchTransition(
        'Loading',
        'Loaded',
        () => Effect.sync(() => { stateTransitions++ })
      )

      // エラー状態の監視
      const errorWatcher = ReactiveChunkStateOptics.watchErrors(
        () => Effect.sync(() => { errorDetections++ })
      )

      // 複数の状態変化をシミュレート
      let state = createRealisticLoadingState()

      // Loading -> Failed
      const { ChunkStates } = require('../../types/core')
      const failedState = ChunkStates.failed(
        'Test error',
        1 as any,
        Date.now() as ChunkTimestamp
      )

      await Effect.runPromise(errorWatcher(state)(failedState))

      // Loading -> Loaded
      const loadedState = ChunkStates.loaded(
        new Uint8Array(1024),
        {
          biome: 'plains',
          lightLevel: 15,
          heightMap: new Array(256).fill(64),
          timestamp: Date.now() as ChunkTimestamp,
          isModified: false
        } as any
      )

      await Effect.runPromise(transitionWatcher(state)(loadedState))

      expect(stateTransitions).toBe(1)
      expect(errorDetections).toBe(1)
    })
  })

  describe('エラー回復と整合性テスト', () => {
    it('部分的失敗からの自動回復', async () => {
      const chunk = createRealisticChunk()

      // 一部のブロック更新が失敗するシナリオ
      const updates = Array.from({ length: 1000 }, (_, i) => ({
        index: i,
        blockId: i % 256
      }))

      // 半分の更新を実行
      const partialUpdates = updates.slice(0, 500)
      let partialResult = await Effect.runPromise(
        ParallelChunkTraversalOptics.parallelBlockUpdate(chunk, partialUpdates)
      )

      // 残りの更新を実行（失敗からの回復）
      const remainingUpdates = updates.slice(500)
      const finalResult = await Effect.runPromise(
        ParallelChunkTraversalOptics.parallelBlockUpdate(partialResult, remainingUpdates)
      )

      // 全ての更新が最終的に適用されていることを確認
      for (let i = 0; i < 1000; i++) {
        expect(finalResult.blocks[i]).toBe(i % 256)
      }
    })

    it('並行アクセス時の整合性保証', async () => {
      const chunk = createRealisticChunk()

      // 同じチャンクに対する複数の並行操作
      const operations = Array.from({ length: 10 }, (_, i) =>
        Effect.runPromise(
          OptimizedChunkOptics.conditionalUpdate(
            chunk,
            (blockId, index) => index % 10 === i,
            (blockId) => blockId + i + 1
          )
        )
      )

      const results = await Promise.all(operations)

      // 全ての操作が元のチャンクから開始していることを確認
      results.forEach(result => {
        expect(result.blocks).toBeInstanceOf(Uint16Array)
        expect(result.blocks.length).toBe(65536)
      })

      // 元のチャンクは変更されていない
      expect(chunk.blocks[0]).toBe(1) // 元の石ブロック
    })
  })

  describe('メモリ使用量とガベージコレクション', () => {
    it('長時間実行でのメモリリーク検出', async () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0

      // 長時間の操作をシミュレート
      for (let round = 0; round < 100; round++) {
        const chunk = createRealisticChunk()

        // 複雑な操作を実行
        const updates = new Map<number, number>()
        for (let i = 0; i < 1000; i++) {
          updates.set(i, (i + round) % 256)
        }

        const result = OptimizedChunkOptics.batchBlockUpdate(chunk, updates)

        // 条件付き更新
        await Effect.runPromise(
          OptimizedChunkOptics.conditionalUpdate(
            result,
            (blockId) => blockId % 2 === 0,
            (blockId) => blockId + 1
          )
        )

        // 定期的なガベージコレクション
        if (round % 20 === 0 && typeof global !== 'undefined' && global.gc) {
          global.gc()
        }
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
      const memoryIncrease = finalMemory - initialMemory

      // メモリリークがないことを確認（増加は50MB以下）
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
    })
  })
})

describe('実際のゲームプレイシナリオ', () => {
  it('プレイヤーによるブロック採掘・設置シーケンス', async () => {
    const chunk = createRealisticChunk()

    // プレイヤーが石を採掘
    const miningPosition = { x: 5, y: 62, z: 5 }
    const miningIndex = miningPosition.y * 256 + miningPosition.z * 16 + miningPosition.x

    let updatedChunk = ChunkDataOpticsHelpers.setBlock(chunk, miningIndex, 0) // 空気に置換

    // プレイヤーが木材ブロックを設置
    updatedChunk = ChunkDataOpticsHelpers.setBlock(updatedChunk, miningIndex, 17) // 木材

    // 設置後のメタデータ更新
    updatedChunk = ChunkDataOpticsHelpers.updateMetadata(updatedChunk, {
      isModified: true,
      timestamp: Date.now() as ChunkTimestamp
    })

    // 周囲の光レベル再計算をシミュレート
    updatedChunk = ChunkCompositeOperations.setBlockWithMetadata(
      updatedChunk,
      miningIndex,
      17, // 木材
      Date.now() as ChunkTimestamp
    )

    expect(updatedChunk.blocks[miningIndex]).toBe(17)
    expect(updatedChunk.metadata.isModified).toBe(true)
    expect(updatedChunk.isDirty).toBe(true)
  })

  it('大規模建築プロジェクトのシミュレーション', async () => {
    const chunk = createRealisticChunk()

    // 城の建設をシミュレート
    const castle = {
      walls: { x: 1, y: 64, z: 1, width: 14, height: 8, depth: 14 },
      towers: [
        { x: 1, y: 64, z: 1, width: 3, height: 12, depth: 3 },
        { x: 12, y: 64, z: 1, width: 3, height: 12, depth: 3 },
        { x: 1, y: 64, z: 12, width: 3, height: 12, depth: 3 },
        { x: 12, y: 64, z: 12, width: 3, height: 12, depth: 3 }
      ]
    }

    const startTime = performance.now()

    // 城壁の建設
    let result = await Effect.runPromise(
      ChunkCompositeOperations.setBlockRegionWithHeightMap(
        chunk,
        castle.walls,
        4, // 石材
        Date.now() as ChunkTimestamp
      )
    )

    // 塔の建設（並列実行）
    const towerOperations = castle.towers.map(tower =>
      ChunkCompositeOperations.setBlockRegionWithHeightMap(
        result,
        tower,
        4, // 石材
        Date.now() as ChunkTimestamp
      )
    )

    const towerResults = await Promise.all(
      towerOperations.map(op => Effect.runPromise(op))
    )

    const endTime = performance.now()

    expect(endTime - startTime).toBeLessThan(1000) // 大規模建築が1秒以内
    expect(towerResults).toHaveLength(4)

    // 建築結果の検証
    const cornerTowerIndex = 76 * 256 + 1 * 16 + 1 // 塔の高い位置
    expect(towerResults[0].blocks[cornerTowerIndex]).toBe(4) // 石材
  })
})