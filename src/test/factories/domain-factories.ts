/**
 * ドメインファクトリー - テスト用のドメインオブジェクト生成
 *
 * Effect-TSのラッパーではなく、プロジェクトのドメインロジックに特化した
 * テストデータ生成のためのファクトリー関数集
 */

import { Effect } from 'effect'
import { createChunkData, type ChunkMetadata, CHUNK_SIZE } from '../../domain/chunk/ChunkData'
import { type ChunkPosition } from '../../domain/chunk/ChunkPosition'
import { createChunk, createEmptyChunk, type Chunk } from '../../domain/chunk/Chunk'
import { createWorldGenerator } from '../../domain/world/createWorldGenerator'
import { type GeneratorOptions } from '../../domain/world/GeneratorOptions'
import { BrandedTypes } from '../../shared/types/branded'
import type { BiomeType } from '../../domain/world/types'
import type { Vector3 } from '../../domain/world/types'
import type { BlockType } from '../../domain/block/BlockType'

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
   * NPCエンティティを生成
   */
  createNPC: (type: string = 'villager', position: Vector3 = { x: 0, y: 64, z: 0 }) => ({
    id: BrandedTypes.createEntityId(`${type}_${Date.now()}`),
    type,
    position,
    rotation: { x: 0, y: 0, z: 0 },
    health: 20,
    tags: ['npc', type],
  }),

  /**
   * アイテムエンティティを生成
   */
  createItem: (itemType: string, position: Vector3, quantity: number = 1) => ({
    id: BrandedTypes.createItemId(`item_${itemType}_${Date.now()}`),
    type: 'item',
    itemType,
    quantity,
    position,
    rotation: { x: 0, y: 0, z: 0 },
    tags: ['item'],
  }),

  /**
   * ランダムエンティティを生成
   */
  createRandom: (types: string[] = ['zombie', 'skeleton', 'spider'], position?: Vector3) => {
    const randomType = types[Math.floor(Math.random() * types.length)]!
    const randomPosition = position || {
      x: Math.floor(Math.random() * 100) - 50,
      y: 64,
      z: Math.floor(Math.random() * 100) - 50,
    }

    return EntityFactory.createNPC(randomType, randomPosition)
  },
}

// ========================
// Block ドメインファクトリー
// ========================

export const BlockFactory = {
  /**
   * 基本ブロックタイプを生成
   */
  createType: (
    id: number,
    name: string,
    category: BlockType['category'] = 'natural',
    overrides: Partial<BlockType> = {}
  ): BlockType => ({
    id: String(id),
    name,
    category,
    texture: name,
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
    drops: [],
    sound: {
      break: 'stone',
      place: 'stone',
      step: 'stone',
    },
    stackSize: 64,
    tags: [],
    ...overrides,
  }),

  /**
   * 空気ブロック
   */
  createAir: (): BlockType =>
    BlockFactory.createType(0, 'air', 'natural', {
      stackSize: 0,
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
    }),

  /**
   * 石ブロック
   */
  createStone: (): BlockType =>
    BlockFactory.createType(1, 'stone', 'natural', {
      tool: 'pickaxe',
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
    }),

  /**
   * 草ブロック
   */
  createGrass: (): BlockType =>
    BlockFactory.createType(2, 'grass_block', 'natural', {
      tool: 'shovel',
      physics: {
        hardness: 0.6,
        resistance: 0.6,
        luminance: 0,
        opacity: 15,
        flammable: false,
        gravity: false,
        solid: true,
        replaceable: false,
        waterloggable: false,
      },
    }),

  /**
   * 光源ブロック
   */
  createLightSource: (luminance: number = 15): BlockType =>
    BlockFactory.createType(
      89, // torch
      'torch',
      'decoration',
      {
        physics: {
          hardness: 0,
          resistance: 0,
          luminance,
          opacity: 0,
          flammable: true,
          gravity: false,
          solid: false,
          replaceable: false,
          waterloggable: false,
        },
      }
    ),
}

// ========================
// Coordinate ファクトリー
// ========================

export const CoordinateFactory = {
  /**
   * ランダムな座標を生成
   */
  createRandom: (range: number = 100): Vector3 => ({
    x: Math.floor(Math.random() * range * 2) - range,
    y: Math.floor(Math.random() * 256),
    z: Math.floor(Math.random() * range * 2) - range,
  }),

  /**
   * チャンク座標を生成
   */
  createChunkPosition: (x: number = 0, z: number = 0): ChunkPosition => ({
    x,
    z,
  }),

  /**
   * ブロック座標をチャンク座標に変換
   */
  blockToChunk: (blockX: number, blockZ: number): ChunkPosition => ({
    x: Math.floor(blockX / CHUNK_SIZE),
    z: Math.floor(blockZ / CHUNK_SIZE),
  }),

  /**
   * 隣接するチャンク座標を生成
   */
  createNeighbors: (center: ChunkPosition): ChunkPosition[] => [
    { x: center.x - 1, z: center.z - 1 },
    { x: center.x, z: center.z - 1 },
    { x: center.x + 1, z: center.z - 1 },
    { x: center.x - 1, z: center.z },
    { x: center.x + 1, z: center.z },
    { x: center.x - 1, z: center.z + 1 },
    { x: center.x, z: center.z + 1 },
    { x: center.x + 1, z: center.z + 1 },
  ],

  /**
   * 指定半径内のチャンク座標を生成
   */
  createChunksInRadius: (center: ChunkPosition, radius: number): ChunkPosition[] => {
    const chunks: ChunkPosition[] = []
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      for (let z = center.z - radius; z <= center.z + radius; z++) {
        chunks.push({ x, z })
      }
    }
    return chunks
  },
}

// ========================
// Random ファクトリー
// ========================

export const RandomFactory = {
  /**
   * シード付きランダム生成器
   */
  createSeeded: (seed: number) => {
    let state = seed
    return {
      next: () => {
        state = (state * 1664525 + 1013904223) % 4294967296
        return state / 4294967296
      },
      nextInt: (max: number) => Math.floor(RandomFactory.createSeeded(seed).next() * max),
      nextFloat: (min: number = 0, max: number = 1) => min + RandomFactory.createSeeded(seed).next() * (max - min),
    }
  },

  /**
   * ランダムなバイオームタイプ
   */
  createBiomeType: (): BiomeType => {
    const biomes: BiomeType[] = [
      'plains',
      'desert',
      'forest',
      'jungle',
      'swamp',
      'taiga',
      'snowy_tundra',
      'mountains',
      'ocean',
      'river',
      'beach',
      'mushroom_fields',
      'savanna',
      'badlands',
    ]
    return biomes[Math.floor(Math.random() * biomes.length)]!
  },

  /**
   * ランダムなブロックID
   */
  createBlockId: (min: number = 1, max: number = 255) => Math.floor(Math.random() * (max - min + 1)) + min,

  /**
   * ランダムなチャンク配列
   */
  createChunkArray: (length: number = 16, blockId?: number) => {
    const array = new Uint16Array(length)
    const id = blockId ?? RandomFactory.createBlockId()
    array.fill(id)
    return array
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

// デフォルトエクスポート
export default DomainFactories
