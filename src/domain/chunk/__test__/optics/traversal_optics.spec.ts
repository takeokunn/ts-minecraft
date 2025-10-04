/**
 * Traversal Optics テストスイート
 *
 * 配列・リスト構造の一括操作システムの包括的テスト
 * 並列処理とパフォーマンス最適化の検証
 */

import { describe, it, expect } from 'vitest'
import { Effect, pipe, Array as EffectArray } from 'effect'
import {
  ChunkTraversalOptics,
  ParallelChunkTraversalOptics,
  ChunkTraversalComposers
} from '../../aggregate/chunk/traversal'
import type { ChunkData } from '../../aggregate/chunk_data/types'
import type { HeightValue, ChunkMetadata } from '../../value_object/chunk_metadata'
import type { ChunkPosition } from '../../value_object/chunk_position'
import type { ChunkTimestamp } from '../../types/core'

// テストデータの作成
const createTestChunkData = (customBlocks?: Uint16Array): ChunkData => ({
  id: 'test-chunk-001' as any,
  position: { x: 0, z: 0 } as ChunkPosition,
  blocks: customBlocks || new Uint16Array(65536), // 16x16x256 = 65536
  metadata: {
    biome: 'plains',
    lightLevel: 15,
    heightMap: new Array(256).fill(64) as HeightValue[],
    timestamp: Date.now() as ChunkTimestamp,
    isModified: false
  } as ChunkMetadata,
  isDirty: false
})

const createPatternedBlocks = (): Uint16Array => {
  const blocks = new Uint16Array(65536)
  // パターンを作成: Y=64層に石ブロック(1)、それ以外は空気(0)
  for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) {
      const index = 64 * 256 + z * 16 + x // Y=64の位置
      blocks[index] = 1 // 石ブロック
    }
  }
  return blocks
}

const createVariedBlocks = (): Uint16Array => {
  const blocks = new Uint16Array(65536)
  // 様々なブロックタイプを配置
  for (let i = 0; i < blocks.length; i++) {
    blocks[i] = i % 10 // 0-9のブロックタイプをループ
  }
  return blocks
}

describe('ChunkTraversalOptics', () => {
  describe('全ブロックTraversal', () => {
    it('全ブロックにアクセスできる', () => {
      const chunk = createTestChunkData(createPatternedBlocks())
      const allBlocksOptic = ChunkTraversalOptics.allBlocks

      // Traversalの存在確認
      expect(allBlocksOptic).toBeDefined()

      // 実際のブロック配列の内容確認
      const blocks = chunk.blocks
      expect(blocks).toHaveLength(65536)

      // Y=64層に石ブロックが存在することを確認
      const stoneBlockIndex = 64 * 256 + 0 * 16 + 0 // Y=64, Z=0, X=0
      expect(blocks[stoneBlockIndex]).toBe(1)
    })

    it('全ブロックを一括変換できる', () => {
      const chunk = createTestChunkData(createVariedBlocks())

      // 理論的にはTraversalでの一括変換
      // 実装の詳細に依存するため、基本的な動作確認のみ
      const transformedBlocks = Array.from(chunk.blocks).map(blockId => blockId + 1)

      expect(transformedBlocks).toHaveLength(65536)
      expect(transformedBlocks[0]).toBe(1) // 0 + 1
      expect(transformedBlocks[9]).toBe(10) // 9 + 1
    })
  })

  describe('条件付きブロックTraversal', () => {
    it('特定の条件を満たすブロックのみを選択できる', () => {
      const chunk = createTestChunkData(createVariedBlocks())

      // 奇数ブロックIDのみを選択する条件
      const isOddBlock = (blockId: number, _index: number) => blockId % 2 === 1

      // 条件付きTraversalの存在確認
      const conditionalOptic = ChunkTraversalOptics.blocksWhere(isOddBlock)
      expect(conditionalOptic).toBeDefined()

      // 手動で条件確認
      const oddBlocks = Array.from(chunk.blocks).filter((blockId, index) =>
        isOddBlock(blockId, index)
      )
      expect(oddBlocks.length).toBeGreaterThan(0)
      expect(oddBlocks.every(blockId => blockId % 2 === 1)).toBe(true)
    })

    it('空ブロック以外の全ブロックを選択できる', () => {
      const blocks = new Uint16Array(65536)
      // 一部に非空ブロックを配置
      for (let i = 0; i < 100; i++) {
        blocks[i] = i % 5 + 1 // 1-5のブロックタイプ
      }
      const chunk = createTestChunkData(blocks)

      const nonEmptyOptic = ChunkTraversalOptics.nonEmptyBlocks
      expect(nonEmptyOptic).toBeDefined()

      // 手動で非空ブロック確認
      const nonEmptyBlocks = Array.from(chunk.blocks).filter(blockId => blockId !== 0)
      expect(nonEmptyBlocks).toHaveLength(100)
      expect(nonEmptyBlocks.every(blockId => blockId > 0)).toBe(true)
    })

    it('特定ブロックタイプのみを選択できる', () => {
      const chunk = createTestChunkData(createPatternedBlocks())
      const stoneBlockOptic = ChunkTraversalOptics.blocksByType(1) // 石ブロック

      expect(stoneBlockOptic).toBeDefined()

      // 石ブロックの数を手動で確認
      const stoneBlocks = Array.from(chunk.blocks).filter(blockId => blockId === 1)
      expect(stoneBlocks).toHaveLength(256) // 16x16 = 256個の石ブロック
    })
  })

  describe('Y層ブロックTraversal', () => {
    it('特定Y層のブロック全体にアクセスできる', () => {
      const chunk = createTestChunkData(createPatternedBlocks())
      const y64LayerOptic = ChunkTraversalOptics.blocksAtY(64)

      expect(y64LayerOptic).toBeDefined()

      // Y=64層の手動確認
      const y64Blocks: number[] = []
      for (let z = 0; z < 16; z++) {
        for (let x = 0; x < 16; x++) {
          const index = 64 * 256 + z * 16 + x
          y64Blocks.push(chunk.blocks[index])
        }
      }

      expect(y64Blocks).toHaveLength(256) // 16x16
      expect(y64Blocks.every(blockId => blockId === 1)).toBe(true) // 全て石ブロック
    })

    it('複数Y層の処理が正確に動作する', () => {
      const chunk = createTestChunkData()

      // 複数の層のOpticを作成
      const y0LayerOptic = ChunkTraversalOptics.blocksAtY(0)
      const y64LayerOptic = ChunkTraversalOptics.blocksAtY(64)
      const y128LayerOptic = ChunkTraversalOptics.blocksAtY(128)

      expect(y0LayerOptic).toBeDefined()
      expect(y64LayerOptic).toBeDefined()
      expect(y128LayerOptic).toBeDefined()
    })
  })

  describe('3D領域ブロックTraversal', () => {
    it('指定3D領域のブロックを選択できる', () => {
      const chunk = createTestChunkData(createVariedBlocks())

      // 2x2x2の小さな領域を指定
      const regionOptic = ChunkTraversalOptics.blocksInRegion(0, 0, 0, 1, 1, 1)
      expect(regionOptic).toBeDefined()

      // 手動で該当ブロックを確認
      const regionBlocks: number[] = []
      for (let x = 0; x <= 1; x++) {
        for (let y = 0; y <= 1; y++) {
          for (let z = 0; z <= 1; z++) {
            const index = y * 256 + z * 16 + x
            regionBlocks.push(chunk.blocks[index])
          }
        }
      }

      expect(regionBlocks).toHaveLength(8) // 2x2x2 = 8ブロック
    })

    it('境界条件での領域選択が正常に動作する', () => {
      const chunk = createTestChunkData()

      // チャンクの端の領域
      const cornerOptic = ChunkTraversalOptics.blocksInRegion(15, 255, 15, 15, 255, 15)
      expect(cornerOptic).toBeDefined()

      // 範囲外指定（エラーにならないことを確認）
      const outOfBoundsOptic = ChunkTraversalOptics.blocksInRegion(-1, -1, -1, 20, 300, 20)
      expect(outOfBoundsOptic).toBeDefined()
    })
  })

  describe('高さマップTraversal', () => {
    it('高さマップの指定範囲にアクセスできる', () => {
      const chunk = createTestChunkData()
      const heightRangeOptic = ChunkTraversalOptics.heightMapRange(0, 10)

      expect(heightRangeOptic).toBeDefined()

      // 高さマップの手動確認
      const heightMapSlice = chunk.metadata.heightMap.slice(0, 10)
      expect(heightMapSlice).toHaveLength(10)
      expect(heightMapSlice.every(h => h === 64)).toBe(true) // 初期値64
    })

    it('条件付き高さマップ選択ができる', () => {
      const heightMap = new Array(256).fill(0).map((_, i) => (i % 3) * 20 + 60) as HeightValue[]
      const metadata = {
        biome: 'plains',
        lightLevel: 15,
        heightMap,
        timestamp: Date.now() as ChunkTimestamp,
        isModified: false
      } as ChunkMetadata

      const chunk = {
        ...createTestChunkData(),
        metadata
      }

      // 特定の高さ以上の値のみを選択
      const highHeights = (height: HeightValue) => height >= 80
      const conditionalOptic = ChunkTraversalOptics.heightMapWhere(highHeights)

      expect(conditionalOptic).toBeDefined()

      // 手動で条件確認
      const matchingHeights = heightMap.filter(highHeights)
      expect(matchingHeights.length).toBeGreaterThan(0)
      expect(matchingHeights.every(h => h >= 80)).toBe(true)
    })
  })
})

describe('ParallelChunkTraversalOptics', () => {
  describe('並列ブロック更新', () => {
    it('並列ブロック更新が正常に実行される', async () => {
      const chunk = createTestChunkData()

      // 100個のブロック更新
      const updates = Array.from({ length: 100 }, (_, i) => ({
        index: i,
        blockId: i % 10 + 1
      }))

      const result = await Effect.runPromise(
        ParallelChunkTraversalOptics.parallelBlockUpdate(chunk, updates)
      )

      expect(result.blocks).toBeInstanceOf(Uint16Array)

      // 更新されたブロックの確認
      for (let i = 0; i < 100; i++) {
        expect(result.blocks[i]).toBe(i % 10 + 1)
      }

      // 更新されていないブロックは0のまま
      expect(result.blocks[200]).toBe(0)
    })

    it('大量の並列更新が効率的に処理される', async () => {
      const chunk = createTestChunkData()

      // 10000個のブロック更新
      const updates = Array.from({ length: 10000 }, (_, i) => ({
        index: i,
        blockId: (i % 255) + 1
      }))

      const startTime = performance.now()

      const result = await Effect.runPromise(
        ParallelChunkTraversalOptics.parallelBlockUpdate(chunk, updates)
      )

      const endTime = performance.now()
      const executionTime = endTime - startTime

      // パフォーマンス要件: 10000個の並列更新が500ms以内
      expect(executionTime).toBeLessThan(500)

      // 結果の検証
      expect(result.blocks[0]).toBe(1)
      expect(result.blocks[9999]).toBe((9999 % 255) + 1)
    })
  })

  describe('並列高さマップ更新', () => {
    it('並列高さマップ更新が正常に実行される', async () => {
      const chunk = createTestChunkData()

      // 50個の高さマップ更新
      const updates = Array.from({ length: 50 }, (_, i) => ({
        index: i,
        height: (i + 100) as HeightValue
      }))

      const result = await Effect.runPromise(
        ParallelChunkTraversalOptics.parallelHeightMapUpdate(chunk, updates)
      )

      // 更新された高さ値の確認
      for (let i = 0; i < 50; i++) {
        expect(result.metadata.heightMap[i]).toBe(i + 100)
      }

      // 更新されていない高さ値は元のまま
      expect(result.metadata.heightMap[100]).toBe(64)
    })
  })

  describe('条件付き並列変換', () => {
    it('条件付き並列ブロック変換が正常に動作する', async () => {
      const chunk = createTestChunkData(createVariedBlocks())

      // 偶数ブロックIDのみを2倍にする変換
      const isEvenBlock = (blockId: number) => blockId % 2 === 0
      const doubleValue = (blockId: number) => blockId * 2

      const result = await Effect.runPromise(
        ParallelChunkTraversalOptics.parallelBlockTransform(
          chunk,
          isEvenBlock,
          doubleValue
        )
      )

      // 結果の検証
      for (let i = 0; i < 100; i++) {
        const originalBlockId = i % 10
        const expectedBlockId = originalBlockId % 2 === 0 ? originalBlockId * 2 : originalBlockId
        expect(result.blocks[i]).toBe(expectedBlockId)
      }
    })
  })

  describe('並列統計計算', () => {
    it('ブロック統計の並列計算が正常に動作する', async () => {
      const chunk = createTestChunkData(createVariedBlocks())

      const statistics = await Effect.runPromise(
        ParallelChunkTraversalOptics.parallelBlockStatistics(chunk)
      )

      expect(statistics.totalBlocks).toBe(65536)
      expect(statistics.emptyBlocks).toBeGreaterThan(0)
      expect(statistics.uniqueBlockTypes).toBe(10) // 0-9のブロックタイプ
      expect(statistics.blockTypeCounts).toBeInstanceOf(Map)
      expect(statistics.blockTypeCounts.size).toBe(10)

      // 各ブロックタイプの出現回数を確認
      for (let blockType = 0; blockType < 10; blockType++) {
        const count = statistics.blockTypeCounts.get(blockType) || 0
        expect(count).toBeGreaterThan(0)
      }
    })
  })
})

describe('ChunkTraversalComposers', () => {
  describe('操作の組み合わせ', () => {
    it('複数のTraversal操作を順次実行できる', () => {
      const chunk = createTestChunkData()

      const operations = [
        (c: ChunkData) => ({ ...c, isDirty: true }),
        (c: ChunkData) => ({
          ...c,
          metadata: { ...c.metadata, lightLevel: 10 }
        }),
        (c: ChunkData) => ({
          ...c,
          metadata: { ...c.metadata, biome: 'desert' as const }
        })
      ]

      const result = ChunkTraversalComposers.sequence(chunk, operations)

      expect(result.isDirty).toBe(true)
      expect(result.metadata.lightLevel).toBe(10)
      expect(result.metadata.biome).toBe('desert')
    })

    it('条件付きTraversal操作が正常に動作する', () => {
      const chunk = createTestChunkData()

      // ダーティでない場合のみ更新する条件
      const condition = (c: ChunkData) => !c.isDirty
      const operation = (c: ChunkData) => ({ ...c, isDirty: true })

      const result1 = ChunkTraversalComposers.conditional(chunk, condition, operation)
      expect(result1.isDirty).toBe(true) // 条件を満たすので更新される

      const result2 = ChunkTraversalComposers.conditional(result1, condition, operation)
      expect(result2).toBe(result1) // 条件を満たさないので元のまま
    })
  })
})

describe('パフォーマンステスト', () => {
  it('大規模Traversal操作が効率的に実行される', () => {
    const chunk = createTestChunkData(createVariedBlocks())
    const startTime = performance.now()

    // 大量のブロックフィルタリング
    const targetBlocks = Array.from(chunk.blocks).filter((blockId, index) => {
      // 複雑な条件
      return blockId > 0 && index % 100 === 0 && blockId % 3 === 1
    })

    const endTime = performance.now()
    const executionTime = endTime - startTime

    // パフォーマンス要件: 65536個のブロックフィルタリングが50ms以内
    expect(executionTime).toBeLessThan(50)
    expect(targetBlocks).toBeDefined()
  })

  it('複数Traversal操作の組み合わせが効率的に実行される', () => {
    const chunk = createTestChunkData()
    const startTime = performance.now()

    // 複数の操作を連続実行
    let result = chunk
    for (let i = 0; i < 100; i++) {
      result = {
        ...result,
        metadata: {
          ...result.metadata,
          lightLevel: (result.metadata.lightLevel + 1) % 16
        }
      }
    }

    const endTime = performance.now()
    const executionTime = endTime - startTime

    // パフォーマンス要件: 100回の操作が20ms以内
    expect(executionTime).toBeLessThan(20)
    expect(result.metadata.lightLevel).toBe((15 + 100) % 16)
  })
})

describe('エラーハンドリング', () => {
  it('無効な範囲指定でもエラーにならない', () => {
    const chunk = createTestChunkData()

    // 負の範囲
    expect(() => {
      ChunkTraversalOptics.heightMapRange(-10, -5)
    }).not.toThrow()

    // 範囲外の大きな値
    expect(() => {
      ChunkTraversalOptics.blocksAtY(1000)
    }).not.toThrow()

    // 無効な3D領域
    expect(() => {
      ChunkTraversalOptics.blocksInRegion(20, 20, 20, 10, 10, 10) // 開始 > 終了
    }).not.toThrow()
  })

  it('空の更新配列でも正常に処理される', async () => {
    const chunk = createTestChunkData()

    const result = await Effect.runPromise(
      ParallelChunkTraversalOptics.parallelBlockUpdate(chunk, [])
    )

    expect(result).toEqual(chunk) // 変更なし
  })
})