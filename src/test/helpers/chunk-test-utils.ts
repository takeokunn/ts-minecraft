/**
 * Chunkドメイン専用テストヘルパー関数
 * 100%カバレッジとEffect-TSパターンに特化
 */
import { Effect } from 'effect'
import { expect } from 'vitest'
import { expectEffectSuccess, expectEffectFailure, testAllBranches } from './effect-test-utils.js'
import {
  createChunkData,
  type ChunkData,
  CHUNK_SIZE,
  CHUNK_HEIGHT,
  CHUNK_MIN_Y,
  CHUNK_MAX_Y,
} from '../../domain/chunk/ChunkData.js'
import { createChunk, type Chunk, ChunkBoundsError, ChunkSerializationError } from '../../domain/chunk/Chunk.js'
import { type ChunkPosition } from '../../domain/chunk/ChunkPosition.js'

/**
 * テスト用チャンクデータのファクトリー
 */
export interface ChunkTestDataOptions {
  readonly position?: ChunkPosition
  readonly fillPattern?: 'empty' | 'solid' | 'random' | 'pattern'
  readonly blockId?: number
  readonly seed?: number
}

export const createTestChunkData = (options: ChunkTestDataOptions = {}): ChunkData => {
  const { position = { x: 0, z: 0 }, fillPattern = 'empty', blockId = 1, seed = 12345 } = options

  const chunkData = createChunkData(position)

  switch (fillPattern) {
    case 'solid':
      chunkData.blocks.fill(blockId)
      break
    case 'random':
      const rng = seededRandom(seed)
      for (let i = 0; i < chunkData.blocks.length; i++) {
        chunkData.blocks[i] = Math.floor(rng() * 10) + 1
      }
      break
    case 'pattern':
      for (let i = 0; i < chunkData.blocks.length; i++) {
        chunkData.blocks[i] = (i % 5) + 1
      }
      break
    case 'empty':
    default:
      // すでに空なので何もしない
      break
  }

  return chunkData
}

/**
 * テスト用チャンク作成ヘルパー
 */
export const createTestChunk = (options: ChunkTestDataOptions = {}): Chunk => {
  return createChunk(createTestChunkData(options))
}

/**
 * 座標境界テストのためのケース生成
 */
export const generateBoundaryTestCases = () => {
  const validCases = [
    { x: 0, y: CHUNK_MIN_Y, z: 0, name: 'minimum bounds' },
    { x: CHUNK_SIZE - 1, y: CHUNK_MAX_Y, z: CHUNK_SIZE - 1, name: 'maximum bounds' },
    { x: 8, y: 64, z: 8, name: 'center coordinates' },
  ]

  const invalidCases = [
    { x: -1, y: 0, z: 0, name: 'negative x' },
    { x: CHUNK_SIZE, y: 0, z: 0, name: 'x out of bounds' },
    { x: 0, y: CHUNK_MIN_Y - 1, z: 0, name: 'y below minimum' },
    { x: 0, y: CHUNK_MAX_Y + 1, z: 0, name: 'y above maximum' },
    { x: 0, y: 0, z: -1, name: 'negative z' },
    { x: 0, y: 0, z: CHUNK_SIZE, name: 'z out of bounds' },
  ]

  return { validCases, invalidCases }
}

/**
 * チャンク操作の包括的テストヘルパー
 */
export const testChunkOperationBoundaries = async (
  chunk: Chunk,
  operation: 'getBlock' | 'setBlock' | 'fillRegion'
): Promise<void> => {
  const { validCases, invalidCases } = generateBoundaryTestCases()

  for (const testCase of validCases) {
    switch (operation) {
      case 'getBlock':
        await expectEffectSuccess(chunk.getBlock(testCase.x, testCase.y, testCase.z))
        break
      case 'setBlock':
        await expectEffectSuccess(chunk.setBlock(testCase.x, testCase.y, testCase.z, 1))
        break
      case 'fillRegion':
        await expectEffectSuccess(
          chunk.fillRegion(testCase.x, testCase.y, testCase.z, testCase.x, testCase.y, testCase.z, 1)
        )
        break
    }
  }

  for (const testCase of invalidCases) {
    switch (operation) {
      case 'getBlock':
        await expectEffectFailure(chunk.getBlock(testCase.x, testCase.y, testCase.z))
        break
      case 'setBlock':
        await expectEffectFailure(chunk.setBlock(testCase.x, testCase.y, testCase.z, 1))
        break
      case 'fillRegion':
        await expectEffectFailure(
          chunk.fillRegion(testCase.x, testCase.y, testCase.z, testCase.x, testCase.y, testCase.z, 1)
        )
        break
    }
  }
}

/**
 * シリアライゼーション/デシリアライゼーションテストヘルパー
 */
export const testChunkSerialization = async (chunk: Chunk): Promise<void> => {
  // 正常なシリアライゼーション
  const serialized = await expectEffectSuccess(chunk.serialize())
  expect(serialized).toBeInstanceOf(ArrayBuffer)
  expect(serialized.byteLength).toBeGreaterThan(0)

  // 正常なデシリアライゼーション
  const deserialized = await expectEffectSuccess(chunk.deserialize(serialized))
  expect(deserialized.position).toEqual(chunk.position)
  expect(deserialized.blocks).toEqual(chunk.blocks)

  // 無効なデータでのデシリアライゼーション
  const invalidData = new ArrayBuffer(10) // 小さすぎるバッファ
  await expectEffectFailure(chunk.deserialize(invalidData))

  // 無効なバージョンのテスト
  const invalidVersionBuffer = new ArrayBuffer(1024)
  const view = new DataView(invalidVersionBuffer)
  view.setUint32(0, 999, true) // 無効なバージョン
  await expectEffectFailure(chunk.deserialize(invalidVersionBuffer))
}

/**
 * 圧縮/展開テストヘルパー
 */
export const testChunkCompression = async (chunk: Chunk): Promise<void> => {
  // 正常な圧縮
  const compressed = await expectEffectSuccess(chunk.compress())
  expect(compressed).toBeInstanceOf(ArrayBuffer)

  // 正常な展開
  const decompressed = await expectEffectSuccess(chunk.decompress(compressed))
  expect(decompressed.position).toEqual(chunk.position)

  // 無効なデータでの展開
  const invalidCompressed = new ArrayBuffer(5) // 小さすぎるバッファ
  await expectEffectFailure(chunk.decompress(invalidCompressed))
}

/**
 * チャンクメモリ使用量テストヘルパー
 */
export const testChunkMemoryUsage = (chunk: Chunk): void => {
  const usage = chunk.getMemoryUsage()

  // 最小メモリ使用量のチェック
  const expectedMinimum = chunk.blocks.byteLength + chunk.metadata.heightMap.length * 8
  expect(usage).toBeGreaterThanOrEqual(expectedMinimum)

  // 最大メモリ使用量のチェック（200KB以下）
  expect(usage).toBeLessThanOrEqual(200 * 1024)
}

/**
 * チャンククローンテストヘルパー
 */
export const testChunkClone = async (originalChunk: Chunk): Promise<void> => {
  const cloned = originalChunk.clone()

  // 基本的な同等性
  expect(cloned.position).toEqual(originalChunk.position)
  expect(cloned.blocks).toEqual(originalChunk.blocks)
  expect(cloned.metadata).toEqual(originalChunk.metadata)
  expect(cloned.isDirty).toBe(originalChunk.isDirty)

  // 独立性の確認（一方を変更しても他方に影響しない）
  const modifiedClone = await expectEffectSuccess(cloned.setBlock(0, 0, 0, 999))
  const originalBlock = await expectEffectSuccess(originalChunk.getBlock(0, 0, 0))
  const clonedBlock = await expectEffectSuccess(modifiedClone.getBlock(0, 0, 0))

  expect(originalBlock).not.toBe(clonedBlock)
}

/**
 * fillRegion の網羅的テストヘルパー
 */
export const testFillRegionComprehensive = async (chunk: Chunk): Promise<void> => {
  const testCases = [
    {
      name: 'single block',
      startX: 0,
      startY: 0,
      startZ: 0,
      endX: 0,
      endY: 0,
      endZ: 0,
      blockId: 5,
      expectedResult: 'success' as const,
    },
    {
      name: 'small region',
      startX: 0,
      startY: 0,
      startZ: 0,
      endX: 2,
      endY: 2,
      endZ: 2,
      blockId: 10,
      expectedResult: 'success' as const,
    },
    {
      name: 'invalid start coordinates',
      startX: -1,
      startY: 0,
      startZ: 0,
      endX: 5,
      endY: 5,
      endZ: 5,
      blockId: 1,
      expectedResult: 'failure' as const,
      errorType: ChunkBoundsError,
    },
    {
      name: 'invalid end coordinates',
      startX: 0,
      startY: 0,
      startZ: 0,
      endX: CHUNK_SIZE,
      endY: 5,
      endZ: 5,
      blockId: 1,
      expectedResult: 'failure' as const,
      errorType: ChunkBoundsError,
    },
  ]

  for (const testCase of testCases) {
    if (testCase.expectedResult === 'success') {
      const result = await expectEffectSuccess(
        chunk.fillRegion(
          testCase.startX,
          testCase.startY,
          testCase.startZ,
          testCase.endX,
          testCase.endY,
          testCase.endZ,
          testCase.blockId
        )
      )
      expect(result).toBeDefined()
    } else {
      const error = await expectEffectFailure(
        chunk.fillRegion(
          testCase.startX,
          testCase.startY,
          testCase.startZ,
          testCase.endX,
          testCase.endY,
          testCase.endZ,
          testCase.blockId
        )
      )
      if (testCase.errorType) {
        expect(error).toBeInstanceOf(testCase.errorType)
      }
    }
  }
}

/**
 * 簡易的な疑似乱数生成器（テスト結果の再現性のため）
 */
function seededRandom(seed: number): () => number {
  let current = seed
  return () => {
    current = (current * 1664525 + 1013904223) % 2 ** 32
    return current / 2 ** 32
  }
}

/**
 * 全エッジケースを網羅するテストスイート実行ヘルパー
 */
export const runComprehensiveChunkTests = async (chunk: Chunk): Promise<void> => {
  // 境界テスト
  await testChunkOperationBoundaries(chunk, 'getBlock')
  await testChunkOperationBoundaries(chunk, 'setBlock')
  await testChunkOperationBoundaries(chunk, 'fillRegion')

  // シリアライゼーションテスト
  await testChunkSerialization(chunk)

  // 圧縮テスト
  await testChunkCompression(chunk)

  // メモリテスト
  testChunkMemoryUsage(chunk)

  // クローンテスト
  await testChunkClone(chunk)

  // fillRegion包括テスト
  await testFillRegionComprehensive(chunk)
}
