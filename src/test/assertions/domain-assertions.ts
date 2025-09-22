/**
 * ドメインアサーション - ドメイン固有の検証ヘルパー
 *
 * プロジェクトのドメインロジックに特化したアサーション関数集。
 * Effect-TSの汎用アサーションではなく、ビジネスロジックの検証に集中。
 */

import { expect } from '@effect/vitest'
import type { ChunkData } from '../../domain/chunk/ChunkData.ts'
import type { ChunkPosition } from '../../domain/chunk/ChunkPosition.ts'
import type { Chunk } from '../../domain/chunk/Chunk.ts'
import type { BiomeType } from '../../domain/world/types.ts'
import type { Vector3 } from '../../domain/world/types.ts'
import type { BlockType } from '../../domain/block/BlockType.ts'
import { CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_MIN_Y, CHUNK_MAX_Y } from '../../domain/chunk/ChunkData.ts'

// ========================
// Chunk アサーション
// ========================

export const ChunkAssertions = {
  /**
   * チャンクが特定の位置にブロックを持つことを確認
   */
  hasBlock: (chunk: ChunkData, x: number, y: number, z: number, blockId: number) => {
    const index = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE
    expect(chunk.blocks[index]).toBe(blockId)
  },

  /**
   * チャンクが空（全て空気ブロック）であることを確認
   */
  isEmpty: (chunk: ChunkData) => {
    for (let i = 0; i < chunk.blocks.length; i++) {
      if (chunk.blocks[i] !== 0) {
        expect.fail(`Chunk is not empty: found non-air block at index ${i}`)
      }
    }
  },

  /**
   * チャンクが完全に生成されていることを確認
   */
  isFullyGenerated: (chunk: ChunkData) => {
    expect(chunk.blocks).toBeDefined()
    expect(chunk.blocks.length).toBe(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT)
    expect(chunk.metadata).toBeDefined()
    expect(chunk.metadata.heightMap).toBeDefined()
    expect(chunk.metadata.heightMap.length).toBe(CHUNK_SIZE * CHUNK_SIZE)
  },

  /**
   * チャンクが有効な範囲内のブロックIDを持つことを確認
   */
  hasValidBlockIds: (chunk: ChunkData, maxBlockId: number = 255) => {
    for (let i = 0; i < chunk.blocks.length; i++) {
      const blockId = chunk.blocks[i]!
      if (blockId < 0 || blockId > maxBlockId) {
        expect.fail(`Invalid block ID ${blockId} at index ${i}`)
      }
    }
  },

  /**
   * チャンクの高さマップが有効であることを確認
   */
  hasValidHeightMap: (chunk: ChunkData) => {
    const heightMap = chunk.metadata.heightMap
    expect(heightMap.length).toBe(CHUNK_SIZE * CHUNK_SIZE)

    for (let i = 0; i < heightMap.length; i++) {
      const height = heightMap[i]!
      if (height < CHUNK_MIN_Y || height > CHUNK_MAX_Y) {
        expect.fail(`Invalid height ${height} at heightmap index ${i}`)
      }
    }
  },

  /**
   * チャンクが特定のバイオームを持つことを確認
   */
  hasBiome: (chunk: ChunkData, expectedBiome: BiomeType) => {
    expect(chunk.metadata.biome).toBe(expectedBiome)
  },

  /**
   * チャンクが修正済みフラグを持つことを確認
   */
  isModified: (chunk: ChunkData, expected: boolean = true) => {
    expect(chunk.metadata.isModified).toBe(expected)
  },

  /**
   * チャンク位置が正しいことを確認
   */
  hasPosition: (chunk: ChunkData, expectedPosition: ChunkPosition) => {
    expect(chunk.position).toEqual(expectedPosition)
  },

  /**
   * チャンクのライトレベルが有効であることを確認
   */
  hasValidLightLevel: (chunk: ChunkData) => {
    const lightLevel = chunk.metadata.lightLevel
    expect(lightLevel).toBeGreaterThanOrEqual(0)
    expect(lightLevel).toBeLessThanOrEqual(15)
  },
}

// ========================
// World アサーション
// ========================

export const WorldAssertions = {
  /**
   * ワールドが特定の位置にバイオームを持つことを確認
   */
  hasBiomeAt: (biomeMap: BiomeType[][], x: number, z: number, expectedBiome: BiomeType) => {
    const biome = biomeMap[x]?.[z]
    expect(biome).toBe(expectedBiome)
  },

  /**
   * 高さマップが有効な範囲内であることを確認
   */
  hasValidHeights: (heightMap: number[][], minHeight: number = -64, maxHeight: number = 320) => {
    for (let x = 0; x < heightMap.length; x++) {
      const column = heightMap[x]!
      for (let z = 0; z < column.length; z++) {
        const height = column[z]!
        if (height < minHeight || height > maxHeight) {
          expect.fail(`Invalid height ${height} at position (${x}, ${z})`)
        }
      }
    }
  },

  /**
   * 構造物が有効な位置にあることを確認
   */
  hasValidStructurePosition: (structure: { position: Vector3; type: string }) => {
    expect(structure.position.x).toBeDefined()
    expect(structure.position.y).toBeDefined()
    expect(structure.position.z).toBeDefined()
    expect(structure.type).toBeTruthy()
  },

  /**
   * スポーンポイントが有効であることを確認
   */
  hasValidSpawnPoint: (spawnPoint: Vector3) => {
    expect(spawnPoint.y).toBeGreaterThanOrEqual(0)
    expect(spawnPoint.y).toBeLessThanOrEqual(320)
  },

  /**
   * シード値が設定されていることを確認
   */
  hasSeed: (seed: number) => {
    expect(seed).toBeDefined()
    expect(typeof seed).toBe('number')
  },
}

// ========================
// Entity アサーション
// ========================

export const EntityAssertions = {
  /**
   * エンティティが特定のタグを持つことを確認
   */
  hasTag: (entity: { tags: string[] }, tag: string) => {
    expect(entity.tags).toContain(tag)
  },

  /**
   * エンティティが生存していることを確認
   */
  isAlive: (entity: { health: number }) => {
    expect(entity.health).toBeGreaterThan(0)
  },

  /**
   * エンティティが有効な位置にあることを確認
   */
  hasValidPosition: (entity: { position: Vector3 }) => {
    expect(entity.position.x).toBeDefined()
    expect(entity.position.y).toBeDefined()
    expect(entity.position.z).toBeDefined()
    expect(entity.position.y).toBeGreaterThanOrEqual(-64)
    expect(entity.position.y).toBeLessThanOrEqual(320)
  },

  /**
   * エンティティが有効なIDを持つことを確認
   */
  hasValidId: (entity: { id: string | number }) => {
    expect(entity.id).toBeDefined()
    expect(entity.id).toBeTruthy()
  },

  /**
   * プレイヤーの空腹度が有効であることを確認
   */
  hasValidHunger: (player: { hunger: number }) => {
    expect(player.hunger).toBeGreaterThanOrEqual(0)
    expect(player.hunger).toBeLessThanOrEqual(20)
  },

  /**
   * エンティティの回転が有効であることを確認
   */
  hasValidRotation: (entity: { rotation: Vector3 }) => {
    expect(entity.rotation.x).toBeGreaterThanOrEqual(-180)
    expect(entity.rotation.x).toBeLessThanOrEqual(180)
    expect(entity.rotation.y).toBeGreaterThanOrEqual(-90)
    expect(entity.rotation.y).toBeLessThanOrEqual(90)
  },

  /**
   * インベントリが有効であることを確認
   */
  hasValidInventory: (entity: { inventory: any[] }, maxSize: number = 36) => {
    expect(entity.inventory).toBeDefined()
    expect(entity.inventory.length).toBeLessThanOrEqual(maxSize)
  },
}

// ========================
// Block アサーション
// ========================

export const BlockAssertions = {
  /**
   * ブロックタイプが有効なIDを持つことを確認
   */
  hasValidId: (block: BlockType) => {
    expect(block.id).toBeDefined()
    expect(block.id).toBeGreaterThanOrEqual(0)
  },

  /**
   * ブロックが固体であることを確認
   */
  isSolid: (block: BlockType) => {
    expect(block.physics.solid).toBe(true)
  },

  /**
   * ブロックが液体であることを確認
   */
  isFluid: (block: BlockType) => {
    expect(block.category).toBe('fluid')
    expect(block.physics.solid).toBe(false)
  },

  /**
   * ブロックが透明であることを確認
   */
  isTransparent: (block: BlockType) => {
    expect(block.physics.opacity).toBeLessThan(15)
  },

  /**
   * ブロックが光源であることを確認
   */
  isLightSource: (block: BlockType) => {
    expect(block.physics.luminance).toBeGreaterThan(0)
  },

  /**
   * ブロックが有効な硬度を持つことを確認
   */
  hasValidHardness: (block: BlockType) => {
    expect(block.physics.hardness).toBeGreaterThanOrEqual(0)
  },

  /**
   * ブロックが有効なスタックサイズを持つことを確認
   */
  hasValidStackSize: (block: BlockType) => {
    expect(block.stackSize).toBeGreaterThan(0)
    expect(block.stackSize).toBeLessThanOrEqual(64)
  },

  /**
   * ブロックが特定のツールで破壊可能であることを確認
   */
  isBreakableWith: (block: BlockType, tool: string) => {
    expect(block.tool).toBe(tool)
  },

  /**
   * ブロックが有効なカテゴリを持つことを確認
   */
  hasValidCategory: (block: BlockType) => {
    const validCategories = [
      'natural',
      'building',
      'decoration',
      'redstone',
      'transport',
      'misc',
      'food',
      'tools',
      'combat',
      'fluid',
      'air',
    ]
    expect(validCategories).toContain(block.category)
  },
}

// ========================
// Performance アサーション
// ========================

export const PerformanceAssertions = {
  /**
   * 処理時間が許容範囲内であることを確認
   */
  isWithinTime: (duration: number, maxMs: number) => {
    expect(duration).toBeLessThanOrEqual(maxMs)
  },

  /**
   * メモリ使用量が許容範囲内であることを確認
   */
  isWithinMemory: (memoryUsage: number, maxBytes: number) => {
    expect(memoryUsage).toBeLessThanOrEqual(maxBytes)
  },

  /**
   * スループットが許容範囲内であることを確認
   */
  hasMinThroughput: (operationsPerSecond: number, minOps: number) => {
    expect(operationsPerSecond).toBeGreaterThanOrEqual(minOps)
  },
}

// ========================
// Validation アサーション
// ========================

export const ValidationAssertions = {
  /**
   * 座標が有効な範囲内であることを確認
   */
  isValidCoordinate: (coord: number, min: number = -30000000, max: number = 30000000) => {
    expect(coord).toBeGreaterThanOrEqual(min)
    expect(coord).toBeLessThanOrEqual(max)
    expect(Number.isFinite(coord)).toBe(true)
  },

  /**
   * 文字列が有効な形式であることを確認
   */
  matchesPattern: (value: string, pattern: RegExp) => {
    expect(value).toMatch(pattern)
  },

  /**
   * 配列が期待される要素を含むことを確認
   */
  containsAll: <T>(array: T[], expectedElements: T[]) => {
    for (const element of expectedElements) {
      expect(array).toContain(element)
    }
  },

  /**
   * オブジェクトが必須フィールドを持つことを確認
   */
  hasRequiredFields: (obj: any, fields: string[]) => {
    for (const field of fields) {
      expect(obj).toHaveProperty(field)
      expect(obj[field]).toBeDefined()
    }
  },
}

// ========================
// 統合エクスポート
// ========================

export const DomainAssertions = {
  Chunk: ChunkAssertions,
  World: WorldAssertions,
  Entity: EntityAssertions,
  Block: BlockAssertions,
  Performance: PerformanceAssertions,
  Validation: ValidationAssertions,
} as const

// デフォルトエクスポート
export default DomainAssertions
