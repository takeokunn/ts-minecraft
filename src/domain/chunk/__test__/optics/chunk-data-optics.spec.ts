/**
 * ChunkDataOptics テストスイート
 *
 * ChunkDataへの不変更新システムの包括的テスト
 * Property-based Testing とEffect-TSパターンを活用
 */

import { describe, it, expect } from 'vitest'
import { Effect, pipe, Array as EffectArray } from 'effect'
import { ChunkDataOptics, ChunkDataOpticsHelpers, ChunkDataMultiAccessOptics } from '../../aggregate/chunk/optics'
import type { ChunkData } from '../../aggregate/chunk_data/types'
import type { ChunkMetadata, HeightValue } from '../../value_object/chunk-metadata'
import { HeightValue as makeHeightValue } from '../../value_object/chunk-metadata'
import { createChunkPositionSync } from '../../value_object/chunk-position'
import type { ChunkPosition } from '../../value_object/chunk-position'
import type { ChunkTimestamp } from '../../types/core'

// テストデータの作成
const createTestChunkData = (): ChunkData => ({
  id: 'test-chunk-001' as any,
  position: { x: 0, z: 0 } as ChunkPosition,
  blocks: new Uint16Array(65536), // 16x16x256 = 65536 ブロック
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

const createTestChunkMetadata = (): ChunkMetadata => ({
  biome: 'forest',
  lightLevel: 12,
  heightMap: new Array(256).fill(80) as HeightValue[],
  lastUpdate: Date.now() as ChunkTimestamp,
  isModified: true,
  generationVersion: undefined,
  features: undefined,
  structureReferences: undefined
})

describe('ChunkDataOptics', () => {
  describe('基本プロパティアクセス', () => {
    it('IDへの正確なアクセスができる', () => {
      const chunk = createTestChunkData()
      const id = ChunkDataOptics.id.get(chunk)
      expect(id).toBe('test-chunk-001')
    })

    it('位置情報への正確なアクセスができる', () => {
      const chunk = createTestChunkData()
      const position = ChunkDataOptics.position.get(chunk)
      expect(position).toEqual({ x: 0, z: 0 })
    })

    it('ブロック配列への正確なアクセスができる', () => {
      const chunk = createTestChunkData()
      const blocks = ChunkDataOptics.blocks.get(chunk)
      expect(blocks).toBeInstanceOf(Uint16Array)
      expect(blocks.length).toBe(65536)
    })

    it('メタデータへの正確なアクセスができる', () => {
      const chunk = createTestChunkData()
      const metadata = ChunkDataOptics.metadata.get(chunk)
      expect(metadata.biome).toBe('plains')
      expect(metadata.lightLevel).toBe(15)
    })

    it('ダーティフラグへの正確なアクセスができる', () => {
      const chunk = createTestChunkData()
      const isDirty = ChunkDataOptics.isDirty.get(chunk)
      expect(isDirty).toBe(false)
    })
  })

  describe('ネストしたプロパティアクセス', () => {
    it('メタデータ内のバイオーム情報にアクセスできる', () => {
      const chunk = createTestChunkData()
      const biome = ChunkDataOptics.metadataBiome.get(chunk)
      expect(biome).toBe('plains')
    })

    it('メタデータ内の光レベル情報にアクセスできる', () => {
      const chunk = createTestChunkData()
      const lightLevel = ChunkDataOptics.metadataLightLevel.get(chunk)
      expect(lightLevel).toBe(15)
    })

    it('メタデータ内の高さマップにアクセスできる', () => {
      const chunk = createTestChunkData()
      const heightMap = ChunkDataOptics.metadataHeightMap.get(chunk)
      expect(heightMap).toHaveLength(256)
      expect(heightMap.every(h => h === 64)).toBe(true)
    })

    it('位置座標の個別要素にアクセスできる', () => {
      const chunk = createTestChunkData()
      const x = ChunkDataOptics.positionX.get(chunk)
      const z = ChunkDataOptics.positionZ.get(chunk)
      expect(x).toBe(0)
      expect(z).toBe(0)
    })
  })

  describe('動的インデックスアクセス', () => {
    it('指定インデックスのブロックにアクセスできる', () => {
      const chunk = createTestChunkData()
      const targetIndex = 123

      const updated = ChunkDataOptics.blockAt(targetIndex).replace(42)(chunk)

      expect(updated).not.toBe(chunk)
      expect(ChunkDataOptics.blockAt(targetIndex).get(updated)).toBe(42)
      expect(ChunkDataOptics.blockAt(targetIndex).get(chunk)).toBe(0)
    })

    it('指定インデックスの高さマップ値にアクセスできる', () => {
      const chunk = createTestChunkData()
      const targetIndex = 10
      const newHeight = makeHeightValue(90)

      const updated = ChunkDataOptics.heightMapAt(targetIndex).replace(newHeight)(chunk)

      expect(updated).not.toBe(chunk)
      expect(ChunkDataOptics.heightMapAt(targetIndex).get(updated)).toBe(newHeight)
      expect(ChunkDataOptics.heightMapAt(targetIndex).get(chunk)).toBe(64)
    })

    it('境界値でのアクセスが正常に動作する', () => {
      const chunk = createTestChunkData()

      // 最初と最後のブロックへのアクセス
      const firstBlock = ChunkDataOptics.blockAt(0).get(chunk)
      const lastBlock = ChunkDataOptics.blockAt(65535).get(chunk)

      expect(firstBlock).toBe(0) // 初期値
      expect(lastBlock).toBe(0) // 初期値
    })
  })

  describe('不変性の検証', () => {
    it('プロパティ更新時に元のオブジェクトが変更されない', () => {
      const chunk = createTestChunkData()

      const updated = ChunkDataOptics.isDirty.replace(true)(chunk)

      expect(updated).not.toBe(chunk)
      expect(ChunkDataOptics.isDirty.get(chunk)).toBe(false)
      expect(ChunkDataOptics.isDirty.get(updated)).toBe(true)
    })

    it('ネストしたプロパティ更新時の不変性が保たれる', () => {
      const chunk = createTestChunkData()

      const updated = ChunkDataOptics.metadataLightLevel.replace(8)(chunk)

      expect(updated).not.toBe(chunk)
      expect(updated.metadata).not.toBe(chunk.metadata)
      expect(ChunkDataOptics.metadataLightLevel.get(updated)).toBe(8)
      expect(ChunkDataOptics.metadataLightLevel.get(chunk)).toBe(15)
    })
  })

  describe('型安全性の検証', () => {
    it('型安全なプロパティアクセスが機能する', () => {
      const chunk = createTestChunkData()

      // TypeScriptの型チェックにより、存在しないプロパティへのアクセスはコンパイルエラー
      // これは実行時ではなくコンパイル時のテスト

      // 正しい型でのアクセス
      const position: ChunkPosition = ChunkDataOptics.position.get(chunk)
      const isDirty: boolean = ChunkDataOptics.isDirty.get(chunk)

      expect(position).toBeDefined()
      expect(typeof isDirty).toBe('boolean')
    })
  })
})

describe('ChunkDataOpticsHelpers', () => {
  describe('ブロック操作', () => {
    it('ブロックIDを正確に設定できる', () => {
      const chunk = createTestChunkData()
      const index = 512

      const updated = ChunkDataOpticsHelpers.setBlock(chunk, index, 99)

      expect(updated).not.toBe(chunk)
      expect(ChunkDataOptics.blockAt(index).get(updated)).toBe(99)
      expect(ChunkDataOptics.blockAt(index).get(chunk)).toBe(0)
    })

    it('ブロックIDを変換関数で更新できる', () => {
      const chunk = createTestChunkData()
      const index = 1024
      const seeded = ChunkDataOpticsHelpers.setBlock(chunk, index, 10)

      const updated = ChunkDataOpticsHelpers.modifyBlock(seeded, index, (value) => value + 5)

      expect(ChunkDataOptics.blockAt(index).get(updated)).toBe(15)
      expect(ChunkDataOptics.blockAt(index).get(chunk)).toBe(0)
    })
  })

  describe('高さマップ操作', () => {
    it('高さマップ値を正確に設定できる', () => {
      const chunk = createTestChunkData()
      const index = 5
      const height = makeHeightValue(120)

      const updated = ChunkDataOpticsHelpers.setHeight(chunk, index, height)

      expect(updated).not.toBe(chunk)
      expect(ChunkDataOptics.heightMapAt(index).get(updated)).toBe(height)
      expect(ChunkDataOptics.heightMapAt(index).get(chunk)).toBe(64)
    })

    it('高さマップ値を変換関数で更新できる', () => {
      const chunk = createTestChunkData()
      const index = 12
      const seeded = ChunkDataOpticsHelpers.setHeight(chunk, index, makeHeightValue(70))

      const updated = ChunkDataOpticsHelpers.modifyHeight(seeded, index, (value) =>
        makeHeightValue(Number(value) + 5)
      )

      expect(ChunkDataOptics.heightMapAt(index).get(updated)).toBe(makeHeightValue(75))
      expect(ChunkDataOptics.heightMapAt(index).get(chunk)).toBe(64)
    })
  })

  describe('メタデータ操作', () => {
    it('メタデータを部分的に更新できる', () => {
      const chunk = createTestChunkData()

      const updated = ChunkDataOpticsHelpers.updateMetadata(chunk, {
        biome: 'desert',
        lightLevel: 9,
      })

      expect(updated).not.toBe(chunk)
      expect(updated.metadata).not.toBe(chunk.metadata)
      expect(updated.metadata.biome).toBe('desert')
      expect(updated.metadata.lightLevel).toBe(9)
      expect(chunk.metadata.lightLevel).toBe(15)
    })

    it('位置情報を正確に設定できる', () => {
      const chunk = createTestChunkData()
      const newPosition = createChunkPositionSync(3, -2)

      const updated = ChunkDataOpticsHelpers.setPosition(chunk, newPosition)

      expect(updated).not.toBe(chunk)
      expect(updated.position).toEqual(newPosition)
      expect(chunk.position).toEqual({ x: 0, z: 0 })
    })
  })

  describe('ダーティフラグ操作', () => {
    it('ダーティフラグを設定できる', () => {
      const chunk = createTestChunkData()

      const updated = ChunkDataOpticsHelpers.setDirty(chunk, true)

      expect(updated).not.toBe(chunk)
      expect(updated.isDirty).toBe(true)
      expect(chunk.isDirty).toBe(false)
    })

    it('マーク操作が正確に動作する', () => {
      const chunk = createTestChunkData()

      const marked = ChunkDataOpticsHelpers.markDirty(chunk)
      expect(marked.isDirty).toBe(true)

      const cleaned = ChunkDataOpticsHelpers.markClean(marked)
      expect(cleaned.isDirty).toBe(false)
      expect(chunk.isDirty).toBe(false)
    })
  })
})

describe('ChunkDataMultiAccessOptics', () => {
  describe('範囲アクセス', () => {
    it('指定範囲のブロック群にアクセスできる', () => {
      const chunk = createTestChunkData()
      const rangeOptic = ChunkDataMultiAccessOptics.blocksRange(0, 4)

      const updated = rangeOptic.replace([1, 2, 3, 4])(chunk)

      expect(updated).not.toBe(chunk)
      expect(rangeOptic.get(updated)).toEqual([1, 2, 3, 4])
      expect(rangeOptic.get(chunk)).toEqual([0, 0, 0, 0])
    })

    it('3D領域のブロック群にアクセスできる', () => {
      const chunk = createTestChunkData()
      const values = [5, 6, 7, 8]
      const regionOptic = ChunkDataMultiAccessOptics.blocksInRegion(0, 0, 2, 2, 0)

      const updated = regionOptic.replace(values)(chunk)

      expect(updated).not.toBe(chunk)
      expect(ChunkDataOptics.blockAt(0).get(updated)).toBe(5)
      expect(ChunkDataOptics.blockAt(1).get(updated)).toBe(6)
      expect(ChunkDataOptics.blockAt(16).get(updated)).toBe(7)
      expect(ChunkDataOptics.blockAt(17).get(updated)).toBe(8)
      expect(ChunkDataOptics.blockAt(0).get(chunk)).toBe(0)
    })
  })

  describe('高さマップ領域アクセス', () => {
    it('指定領域の高さマップにアクセスできる', () => {
      const chunk = createTestChunkData()
      const heightRegionOptic = ChunkDataMultiAccessOptics.heightMapRegion(0, 0, 2, 2)
      const newHeights = [
        makeHeightValue(70),
        makeHeightValue(71),
        makeHeightValue(72),
        makeHeightValue(73),
      ]

      const updated = heightRegionOptic.replace(newHeights)(chunk)

      expect(updated).not.toBe(chunk)
      expect(ChunkDataOptics.heightMapAt(0).get(updated)).toBe(newHeights[0])
      expect(ChunkDataOptics.heightMapAt(1).get(updated)).toBe(newHeights[1])
      expect(ChunkDataOptics.heightMapAt(16).get(updated)).toBe(newHeights[2])
      expect(ChunkDataOptics.heightMapAt(17).get(updated)).toBe(newHeights[3])
      expect(ChunkDataOptics.heightMapAt(0).get(chunk)).toBe(64)
    })
  })
})

describe('パフォーマンステスト', () => {
  it('大量のブロック更新が効率的に実行される', () => {
    const chunk = createTestChunkData()
    const updates = Array.from({ length: 1024 }, (_, index) => index)

    const updated = updates.reduce(
      (current, index) =>
        ChunkDataOpticsHelpers.modifyBlock(current, index, () => (index % 255) + 1),
      chunk
    )

    expect(updated).not.toBe(chunk)
    expect(updates.every((index) => ChunkDataOptics.blockAt(index).get(updated) === (index % 255) + 1)).toBe(true)
    expect(updates.every((index) => ChunkDataOptics.blockAt(index).get(chunk) === 0)).toBe(true)
  })

  it('深いネスト構造への高速アクセス', () => {
    const chunk = createTestChunkData()
    const startTime = performance.now()

    // 深いネスト構造への100回アクセス
    for (let i = 0; i < 100; i++) {
      const biome = ChunkDataOptics.metadataBiome.get(chunk)
      const lightLevel = ChunkDataOptics.metadataLightLevel.get(chunk)
      const heightValue = ChunkDataOptics.heightMapAt(i % 256).get(chunk)

      expect(biome).toBeDefined()
      expect(lightLevel).toBeDefined()
      expect(heightValue).toBeDefined()
    }

    const endTime = performance.now()
    const executionTime = endTime - startTime

    // パフォーマンス要件: 100回のアクセスが10ms以内
    expect(executionTime).toBeLessThan(10)
  })
})

describe('エラーハンドリング', () => {
  it('無効なインデックスアクセスが適切に処理される', () => {
    const chunk = createTestChunkData()

    // 境界外アクセスのテスト
    // Note: Uint16Arrayは境界外アクセスでundefinedを返すが、
    // 実際の実装では適切な境界チェックが必要

    // 負のインデックス
    expect(() => ChunkDataOptics.blockAt(-1).get(chunk)).not.toThrow()

    // 範囲外のインデックス
    expect(() => ChunkDataOptics.blockAt(100000).get(chunk)).not.toThrow()
  })

  it('無効なメタデータ更新が適切に処理される', () => {
    const chunk = createTestChunkData()

    expect(() =>
      ChunkDataOpticsHelpers.updateMetadata(chunk, {
        lightLevel: 20, // 0〜15の範囲外でスキーマ違反
      })
    ).toThrow()

    expect(chunk.metadata.lightLevel).toBe(15)
  })
})
