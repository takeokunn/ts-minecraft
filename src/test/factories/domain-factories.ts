/**
 * ドメインファクトリー - テスト用のドメインオブジェクト生成
 *
 * Effect-TSのラッパーではなく、プロジェクトのドメインロジックに特化した
 * テストデータ生成のためのファクトリー関数集
 */

import * as Effect from 'effect/Effect'
import { createChunkData, type ChunkPosition, type ChunkMetadata, CHUNK_SIZE } from '../../domain/chunk/ChunkData'
import { createChunk, createEmptyChunk, type Chunk } from '../../domain/chunk/Chunk'
import { createWorldGenerator, type GeneratorOptions } from '../../domain/world/createWorldGenerator'
import { BrandedTypes } from '../../shared/types/branded'
import type { BiomeType } from '../../domain/world/BiomeTypes'
import type { BlockType } from '../../domain/block/BlockType'
import type { Vector3 } from '../../shared/types'

// ========================
// Chunk ドメインファクトリー
// ========================

export const ChunkFactory = {
  /**
   * チャンクデータを生成
   */
  createData: (position: ChunkPosition, metadata?: Partial<ChunkMetadata>) => {
    return createChunkData(position, metadata)
  },

  /**
   * 空のチャンクを生成
   */
  createEmpty: (position: ChunkPosition) => {
    return createEmptyChunk(position)
  },

  /**
   * ブロックで埋められたチャンクを生成
   */
  createFilled: (position: ChunkPosition, blockId: number) => {
    const data = createChunkData(position)
    data.blocks.fill(blockId)
    return createChunk(data)
  },

  /**
   * パターンで埋められたチャンクを生成（チェッカーボードなど）
   */
  createPattern: (position: ChunkPosition, pattern: (x: number, y: number, z: number) => number) => {
    const data = createChunkData(position)
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < 384; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const index = x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE
          data.blocks[index] = pattern(x, y, z)
        }
      }
    }
    return createChunk(data)
  },

  /**
   * チャンクロードリクエストを生成
   */
  createLoadRequest: (
    position: ChunkPosition,
    priority: 'immediate' | 'high' | 'normal' | 'low' = 'normal',
    distance: number = 0
  ) => ({
    position,
    priority,
    distance,
    timestamp: Date.now(),
  }),
}

// ========================
// World ドメインファクトリー
// ========================

export const WorldFactory = {
  /**
   * ワールドジェネレーターを生成
   */
  createGenerator: (options?: Partial<GeneratorOptions>) => {
    return createWorldGenerator(options)
  },

  /**
   * テスト用の固定シードジェネレーター
   */
  createTestGenerator: () => {
    return createWorldGenerator({
      seed: 12345, // 固定シード
      generateStructures: true,
      seaLevel: 63,
    })
  },

  /**
   * フラットワールドジェネレーター
   */
  createFlatGenerator: () => {
    return createWorldGenerator({
      seed: 0,
      generateStructures: false,
      seaLevel: 0,
    })
  },

  /**
   * バイオーム情報を生成
   */
  createBiome: (type: BiomeType = 'plains', overrides: Partial<any> = {}) => ({
    type,
    temperature: 0.7,
    humidity: 0.4,
    elevation: 64,
    ...overrides,
  }),

  /**
   * 構造物を生成
   */
  createStructure: (type: string, position: Vector3) => ({
    type,
    position,
    boundingBox: {
      min: position,
      max: { x: position.x + 16, y: position.y + 16, z: position.z + 16 },
    },
    metadata: {},
  }),
}

// ========================
// Entity ドメインファクトリー
// ========================

export const EntityFactory = {
  /**
   * プレイヤーエンティティを生成
   */
  createPlayer: (name: string = 'TestPlayer', position: Vector3 = { x: 0, y: 64, z: 0 }) => ({
    id: BrandedTypes.createPlayerId(`player_${name}_${Date.now()}`),
    name,
    position,
    rotation: { x: 0, y: 0, z: 0 },
    health: 20,
    hunger: 20,
    inventory: [],
    tags: ['player'],
  }),

  /**
   * モブエンティティを生成
   */
  createMob: (type: string = 'zombie', position: Vector3 = { x: 0, y: 64, z: 0 }) => ({
    id: `mob_${type}_${Date.now()}`,
    type,
    position,
    rotation: { x: 0, y: 0, z: 0 },
    health: 10,
    ai: {
      targetPlayer: null,
      pathfinding: [],
    },
    tags: ['mob', type],
  }),

  /**
   * アイテムエンティティを生成
   */
  createItem: (itemType: string = 'stone', amount: number = 1, position: Vector3 = { x: 0, y: 64, z: 0 }) => ({
    id: `item_${itemType}_${Date.now()}`,
    itemType,
    amount,
    position,
    velocity: { x: 0, y: -0.5, z: 0 },
    age: 0,
    tags: ['item'],
  }),
}

// ========================
// Block ドメインファクトリー
// ========================

export const BlockFactory = {
  /**
   * ブロックタイプを生成
   */
  createType: (overrides: Partial<BlockType> = {}): BlockType => ({
    id: BrandedTypes.createBlockTypeId(1),
    name: 'Test Block',
    category: 'natural',
    stackSize: 64,
    texture: 'test_texture',
    physics: {
      hardness: 1.0,
      resistance: 1.0,
      luminance: 0,
      opacity: 15,
      flammable: false,
      gravity: false,
      solid: true,
      replaceable: false,
      waterloggable: false,
    },
    tool: 'none',
    minToolLevel: 0,
    sound: {
      break: 'block.stone.break',
      place: 'block.stone.place',
      step: 'block.stone.step',
    },
    drops: [],
    tags: [],
    ...overrides,
  } as BlockType),

  /**
   * 石ブロックを生成
   */
  createStone: (): BlockType => BlockFactory.createType({
    id: BrandedTypes.createBlockTypeId(1),
    name: 'Stone',
    category: 'natural',
    texture: 'stone',
    physics: {
      hardness: 1.5,
      resistance: 6.0,
      luminance: 0,
      opacity: 15,
      flammable: false,
      gravity: false,
      solid: true,
      replaceable: false,
      waterloggable: false,
    },
    tool: 'pickaxe',
    minToolLevel: 0,
  }),

  /**
   * 土ブロックを生成
   */
  createDirt: (): BlockType => BlockFactory.createType({
    id: BrandedTypes.createBlockTypeId(3),
    name: 'Dirt',
    category: 'natural',
    texture: 'dirt',
    physics: {
      hardness: 0.5,
      resistance: 0.5,
      luminance: 0,
      opacity: 15,
      flammable: false,
      gravity: false,
      solid: true,
      replaceable: false,
      waterloggable: false,
    },
    tool: 'shovel',
    minToolLevel: 0,
  }),

  /**
   * 水ブロックを生成
   */
  createWater: (): BlockType => BlockFactory.createType({
    id: BrandedTypes.createBlockTypeId(9),
    name: 'Water',
    category: 'fluid',
    texture: 'water_still',
    physics: {
      hardness: 100.0,
      resistance: 100.0,
      luminance: 0,
      opacity: 3,
      flammable: false,
      gravity: true,
      solid: false,
      replaceable: true,
      waterloggable: false,
    },
    tool: 'none',
    minToolLevel: 0,
  }),

  /**
   * 空気ブロックを生成
   */
  createAir: (): BlockType => BlockFactory.createType({
    id: BrandedTypes.createBlockTypeId(0),
    name: 'Air',
    category: 'air',
    texture: 'air',
    physics: {
      hardness: 0,
      resistance: 0,
      luminance: 0,
      opacity: 0,
      flammable: false,
      gravity: false,
      solid: false,
      replaceable: true,
      waterloggable: false,
    },
    tool: 'none',
    minToolLevel: 0,
  }),
}

// ========================
// Coordinate ドメインファクトリー
// ========================

export const CoordinateFactory = {
  /**
   * ワールド座標を生成
   */
  world: (x: number = 0, y: number = 64, z: number = 0): Vector3 => ({
    x: BrandedTypes.createWorldCoordinate(x),
    y: BrandedTypes.createWorldCoordinate(y),
    z: BrandedTypes.createWorldCoordinate(z),
  }),

  /**
   * チャンク座標を生成
   */
  chunk: (x: number = 0, z: number = 0): ChunkPosition => ({
    x,
    z,
  }),

  /**
   * ローカル座標を生成（チャンク内座標）
   */
  local: (x: number = 0, y: number = 0, z: number = 0): Vector3 => ({
    x: x % CHUNK_SIZE,
    y,
    z: z % CHUNK_SIZE,
  }),

  /**
   * チャンクIDを生成
   */
  chunkId: (x: number, z: number): string => {
    return BrandedTypes.createChunkId(`chunk_${x}_${z}`)
  },
}

// ========================
// Random データファクトリー
// ========================

export const RandomFactory = {
  /**
   * ランダム文字列を生成
   */
  string: (length: number = 8): string => {
    return Math.random().toString(36).substring(2, 2 + length)
  },

  /**
   * ランダム整数を生成
   */
  int: (min: number = 0, max: number = 100): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },

  /**
   * ランダム浮動小数点数を生成
   */
  float: (min: number = 0, max: number = 1): number => {
    return Math.random() * (max - min) + min
  },

  /**
   * ランダムブール値を生成
   */
  boolean: (probability: number = 0.5): boolean => {
    return Math.random() < probability
  },

  /**
   * ランダムプレイヤーIDを生成
   */
  playerId: (prefix: string = 'player'): string => {
    return BrandedTypes.createPlayerId(`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`)
  },

  /**
   * 配列からランダムに要素を選択
   */
  pick: <T>(array: T[]): T | undefined => {
    return array[Math.floor(Math.random() * array.length)]
  },

  /**
   * 配列をシャッフル
   */
  shuffle: <T>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
    }
    return shuffled
  },
}

// ========================
// 統合エクスポート
// ========================

export const DomainFactories = {
  Chunk: ChunkFactory,
  World: WorldFactory,
  Entity: EntityFactory,
  Block: BlockFactory,
  Coordinate: CoordinateFactory,
  Random: RandomFactory,
} as const

export default DomainFactories