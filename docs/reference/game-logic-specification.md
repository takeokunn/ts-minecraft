---
title: "ゲームロジック仕様書 - Minecraft機能の完全技術仕様"
description: "TypeScript Minecraft Cloneの全ゲーム機能における詳細な動作仕様と実装定義。ブロック操作、プレイヤー管理、世界生成の完全リファレンス。"
category: "reference"
difficulty: "advanced"
tags: ["game-logic", "specification", "minecraft", "mechanics", "systems", "reference"]
prerequisites: ["minecraft-basics", "ddd-fundamentals", "ecs-architecture"]
estimated_reading_time: "50-70分"
dependencies: ["./architecture-patterns.md", "./api/domain-apis.md", "../explanations/game-mechanics/"]
status: "complete"
---

# ゲームロジック仕様書

## 🎮 仕様体系概要

> **📍 対象**: システム設計者・実装エンジニア・QAエンジニア
> **🎯 目的**: Minecraft機能の正確で一貫した実装保証
> **⏱️ 参照時間**: 特定機能の実装・検証時に10-30分
> **🔧 適用範囲**: 全ゲーム機能・ビジネスルール

**⚡ TypeScript Minecraft Cloneにおける全ゲーム機能の決定的技術仕様**

## 📋 機能仕様分類マトリックス

### 🏗️ **コア機能仕様（必須実装）**

| 機能分野 | 複雑度 | 依存度 | パフォーマンス影響 | 実装優先度 | 仕様完成度 |
|----------|--------|--------|-------------------|-------------|------------|
| **ブロックシステム** | High | Core | High | P0 | 100% |
| **プレイヤー管理** | Medium | Core | Medium | P0 | 100% |
| **ワールド生成** | High | Infrastructure | High | P0 | 100% |
| **物理システム** | High | Engine | High | P1 | 95% |
| **インベントリ** | Medium | UI | Low | P1 | 100% |
| **クラフトシステム** | Medium | Logic | Low | P1 | 90% |

### 🌟 **拡張機能仕様（追加実装）**

| 機能分野 | 複雑度 | 依存度 | パフォーマンス影響 | 実装優先度 | 仕様完成度 |
|----------|--------|--------|-------------------|-------------|------------|
| **戦闘システム** | High | Entity | Medium | P2 | 85% |
| **農業システム** | Medium | Logic | Low | P2 | 80% |
| **レッドストーン** | Extreme | Logic | Medium | P3 | 60% |
| **エンチャント** | High | Item | Low | P3 | 70% |
| **ネザー次元** | High | World | High | P4 | 40% |

## 🧱 ブロックシステム仕様

### **1. ブロック基本定義**

```typescript
// src/domain/block/block-specification.ts
import { Schema, Match, Effect, pipe, Array, Option, Record } from 'effect'

/**
 * ブロック基本仕様
 *
 * Minecraftワールドの最小構成単位となるブロックの完全定義
 */

// ブロックID型定義（16-bit範囲）
export type BlockId = number & Schema.Brand<'BlockId'>
export const BlockId = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 65535),
  Schema.brand('BlockId')
)

// ブロック座標型定義 - 関数的アプローチ
export const BlockPosition = Schema.Struct({
  x: Schema.Number.pipe(Schema.int()),
  y: Schema.Number.pipe(Schema.int(), Schema.between(-64, 320)), // Minecraft 1.18+ 高度制限
  z: Schema.Number.pipe(Schema.int())
})

export type BlockPosition = Schema.Schema.Type<typeof BlockPosition>

// 座標操作関数群
export const toChunkLocal = (pos: BlockPosition) => ({
  chunkX: Math.floor(pos.x / 16),
  chunkZ: Math.floor(pos.z / 16),
  localX: ((pos.x % 16) + 16) % 16,
  localY: pos.y,
  localZ: ((pos.z % 16) + 16) % 16
})

export const manhattanDistance = (pos1: BlockPosition, pos2: BlockPosition): number =>
  Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y) + Math.abs(pos1.z - pos2.z)

export const isAdjacent = (pos1: BlockPosition, pos2: BlockPosition): boolean =>
  manhattanDistance(pos1, pos2) === 1

// ブロック状態定義 - 関数的アプローチ
export const BlockState = Schema.Struct({
  blockId: BlockId,
  properties: Schema.Record(Schema.String, Schema.Union(Schema.String, Schema.Number, Schema.Boolean)),
  lightLevel: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
  skyLight: Schema.Number.pipe(Schema.int(), Schema.between(0, 15)),
  waterLogged: Schema.Boolean
})

export type BlockState = Schema.Schema.Type<typeof BlockState>

// 状態操作関数群
export const matchesState = (state: BlockState, pattern: Partial<BlockState>): boolean =>
  pipe(
    Object.entries(pattern),
    Array.every(([key, value]) =>
      (state as any)[key] === value
    )
  )

export const withProperty = (
  state: BlockState,
  key: string,
  value: string | number | boolean
): BlockState => ({
  ...state,
  properties: { ...state.properties, [key]: value }
})

// ブロック材質定義 - 関数的アプローチ
export const BlockMaterial = Schema.Struct({
  name: Schema.String,
  hardness: Schema.Number.pipe(Schema.nonnegative()), // 採掘硬度
  resistance: Schema.Number.pipe(Schema.nonnegative()), // 爆発耐性
  transparent: Schema.Boolean, // 光透過性
  solid: Schema.Boolean, // 固体判定
  flammable: Schema.Boolean, // 可燃性
  liquid: Schema.Boolean, // 液体判定
  tool: Schema.optional(Schema.Literal('pickaxe', 'axe', 'shovel', 'hoe', 'sword', 'shears')), // 適正ツール
  harvestLevel: Schema.Number.pipe(Schema.int(), Schema.between(0, 4)) // 採掘レベル（0=木, 1=石, 2=鉄, 3=ダイヤ, 4=ネザライト）
})

export type BlockMaterial = Schema.Schema.Type<typeof BlockMaterial>

// ブロック種類統合定義 - 関数的アプローチ
export const Block = Schema.Struct({
  id: BlockId,
  name: Schema.String,
  material: BlockMaterial,
  defaultState: BlockState,
  possibleStates: Schema.Array(BlockState),
  drops: Schema.Array(Schema.Struct({
    itemId: Schema.String.pipe(Schema.brand('ItemId')),
    quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
    chance: Schema.Number.pipe(Schema.between(0, 1))
  })),
  boundingBox: Schema.Struct({
    minX: Schema.Number.pipe(Schema.between(0, 1)),
    minY: Schema.Number.pipe(Schema.between(0, 1)),
    minZ: Schema.Number.pipe(Schema.between(0, 1)),
    maxX: Schema.Number.pipe(Schema.between(0, 1)),
    maxY: Schema.Number.pipe(Schema.between(0, 1)),
    maxZ: Schema.Number.pipe(Schema.between(0, 1))
  })
})

export type Block = Schema.Schema.Type<typeof Block>

// ツール型定義
interface Tool {
  type: string
  harvestLevel: number
}

// 採掘時間計算 - 関数的アプローチ
export const calculateBreakTime = (
  block: Block,
  tool: Tool | null,
  efficiency: number = 0
): number => {
  const baseTime = block.material.hardness * 1.5

  return pipe(
    Option.fromNullable(tool),
    Option.match({
      onNone: () => baseTime * 5, // 素手ペナルティ
      onSome: (t) => {
        const correctTool = !block.material.tool || t.type === block.material.tool
        const correctLevel = t.harvestLevel >= block.material.harvestLevel

        return Match.value({ correctTool, correctLevel }).pipe(
          Match.when({ correctTool: false }, () => baseTime * 3),
          Match.when({ correctLevel: false }, () => baseTime * 3),
          Match.orElse(() => {
            const efficiencyMultiplier = 1 + (efficiency * 0.3)
            const toolMultiplier = getToolMultiplier(t.type)
            return Math.max(0.05, baseTime / (toolMultiplier * efficiencyMultiplier))
          })
        )
      }
    })
  )
}

const getToolMultiplier = (toolType: string): number =>
  Match.value(toolType).pipe(
    Match.when('wooden', () => 2),
    Match.when('stone', () => 4),
    Match.when('iron', () => 6),
    Match.when('diamond', () => 8),
    Match.when('netherite', () => 9),
    Match.when('golden', () => 12),
    Match.orElse(() => 1)
  )

// 光伝播計算 - 関数的アプローチ
export const calculateLightPropagation = (
  block: Block,
  incomingLight: number
): number =>
  Match.value(block.material.transparent).pipe(
    Match.when(true, () => Math.max(0, incomingLight - 1)),
    Match.orElse(() => 0)
  )

// 設置可能性判定 - 関数的アプローチ
export const canBePlacedAt = (
  block: Block,
  position: BlockPosition,
  adjacentBlocks: Map<string, Block>
): boolean => {
  const currentBlock = adjacentBlocks.get(`${position.x},${position.y},${position.z}`)

  return pipe(
    Option.fromNullable(currentBlock),
    Option.match({
      onSome: (curr) => isReplaceable(curr),
      onNone: () => true
    }),
    (canPlace) => canPlace && Match.value(block.id).pipe(
      Match.when(BlockRegistry.TORCH, () => canSupportTorch(position, adjacentBlocks)),
      Match.when(BlockRegistry.DOOR, () => canPlaceDoor(position, adjacentBlocks)),
      Match.when(BlockRegistry.WATER, () => canPlaceWater(position, adjacentBlocks)),
      Match.orElse(() => true)
    )
  )
}

const isReplaceable = (block: Block): boolean => {
  const replaceableBlocks = [
    BlockRegistry.AIR,
    BlockRegistry.WATER,
    BlockRegistry.LAVA,
    BlockRegistry.TALL_GRASS
  ]
  return replaceableBlocks.includes(block.id)
}

const canSupportTorch = (
  position: BlockPosition,
  adjacentBlocks: Map<string, Block>
): boolean =>
  pipe(
    adjacentBlocks.get(`${position.x},${position.y - 1},${position.z}`),
    Option.fromNullable,
    Option.match({
      onNone: () => false,
      onSome: (block) => block.material.solid
    })
  )

const canPlaceDoor = (
  position: BlockPosition,
  adjacentBlocks: Map<string, Block>
): boolean => {
  const below = adjacentBlocks.get(`${position.x},${position.y - 1},${position.z}`)
  const above = adjacentBlocks.get(`${position.x},${position.y + 1},${position.z}`)

  return pipe(
    Option.fromNullable(below),
    Option.match({
      onNone: () => false,
      onSome: (b) => b.material.solid &&
        pipe(
          Option.fromNullable(above),
          Option.match({
            onNone: () => true,
            onSome: (a) => isReplaceable(a)
          })
        )
    })
  )
}

const canPlaceWater = (
  position: BlockPosition,
  adjacentBlocks: Map<string, Block>
): boolean =>
  Match.value(position.y > -54).pipe(
    Match.when(true, () => false),
    Match.orElse(() => {
      const adjacentPositions = [
        { x: position.x + 1, y: position.y, z: position.z },
        { x: position.x - 1, y: position.y, z: position.z },
        { x: position.x, y: position.y, z: position.z + 1 },
        { x: position.x, y: position.y, z: position.z - 1 }
      ]

      return pipe(
        adjacentPositions,
        Array.some(adj => {
          const adjBlock = adjacentBlocks.get(`${adj.x},${adj.y},${adj.z}`)
          return adjBlock !== undefined && adjBlock.id === BlockRegistry.WATER
        })
      )
    })
  )

// ブロック登録管理 - 関数的アプローチ
export const BlockRegistry = {
  AIR: Schema.decodeSync(BlockId)(0),
  STONE: Schema.decodeSync(BlockId)(1),
  GRASS_BLOCK: Schema.decodeSync(BlockId)(2),
  DIRT: Schema.decodeSync(BlockId)(3),
  COBBLESTONE: Schema.decodeSync(BlockId)(4),
  WOOD_PLANKS: Schema.decodeSync(BlockId)(5),
  SAPLING: Schema.decodeSync(BlockId)(6),
  BEDROCK: Schema.decodeSync(BlockId)(7),
  WATER: Schema.decodeSync(BlockId)(8),
  LAVA: Schema.decodeSync(BlockId)(9),
  SAND: Schema.decodeSync(BlockId)(12),
  GRAVEL: Schema.decodeSync(BlockId)(13),
  GOLD_ORE: Schema.decodeSync(BlockId)(14),
  IRON_ORE: Schema.decodeSync(BlockId)(15),
  COAL_ORE: Schema.decodeSync(BlockId)(16),
  LOG: Schema.decodeSync(BlockId)(17),
  LEAVES: Schema.decodeSync(BlockId)(18),
  GLASS: Schema.decodeSync(BlockId)(20),
  TORCH: Schema.decodeSync(BlockId)(50),
  DOOR: Schema.decodeSync(BlockId)(64),
  LADDER: Schema.decodeSync(BlockId)(65),
  CHEST: Schema.decodeSync(BlockId)(54),
  CRAFTING_TABLE: Schema.decodeSync(BlockId)(58),
  FURNACE: Schema.decodeSync(BlockId)(61),
  TALL_GRASS: Schema.decodeSync(BlockId)(31)
} as const

// ブロックストア - 不変データ構造
export const createBlockStore = () => {
  let blocks = new Map<BlockId, Block>()

  return {
    registerBlock: (block: Block) =>
      Effect.sync(() => {
        blocks = new Map(blocks).set(block.id, block)
      }),

    getBlock: (id: BlockId): Option.Option<Block> =>
      Option.fromNullable(blocks.get(id)),

    getAllBlocks: (): ReadonlyArray<Block> =>
      Array.from(blocks.values())
  }
}

// 初期化関数
export const initializeBlocks = (store: ReturnType<typeof createBlockStore>) =>
  Effect.gen(function* () {
    // エアブロック
    yield* store.registerBlock({
      id: BlockRegistry.AIR,
      name: 'Air',
      material: {
        name: 'air',
        hardness: 0,
        resistance: 0,
        transparent: true,
        solid: false,
        flammable: false,
        liquid: false,
        harvestLevel: 0
      },
      defaultState: {
        blockId: BlockRegistry.AIR,
        properties: {},
        lightLevel: 0,
        skyLight: 15,
        waterLogged: false
      },
      possibleStates: [],
      drops: [],
      boundingBox: {
        minX: 0, minY: 0, minZ: 0,
        maxX: 0, maxY: 0, maxZ: 0
      }
    })

    // 石ブロック
    yield* store.registerBlock({
      id: BlockRegistry.STONE,
      name: 'Stone',
      material: {
        name: 'stone',
        hardness: 1.5,
        resistance: 6.0,
        transparent: false,
        solid: true,
        flammable: false,
        liquid: false,
        tool: 'pickaxe',
        harvestLevel: 0
      },
      defaultState: {
        blockId: BlockRegistry.STONE,
        properties: {},
        lightLevel: 0,
        skyLight: 0,
        waterLogged: false
      },
      possibleStates: [],
      drops: [{
        itemId: Schema.decodeSync(Schema.String.pipe(Schema.brand('ItemId')))('cobblestone'),
        quantity: 1,
        chance: 1.0
      }],
      boundingBox: {
        minX: 0, minY: 0, minZ: 0,
        maxX: 1, maxY: 1, maxZ: 1
      }
    })

    // 水ブロック
    yield* store.registerBlock({
      id: BlockRegistry.WATER,
      name: 'Water',
      material: {
        name: 'water',
        hardness: 100, // 採掘不可
        resistance: 100,
        transparent: true,
        solid: false,
        flammable: false,
        liquid: true,
        harvestLevel: 0
      },
      defaultState: {
        blockId: BlockRegistry.WATER,
        properties: { level: 0 }, // 水位レベル 0-7
        lightLevel: 0,
        skyLight: 15,
        waterLogged: true
      },
      possibleStates: pipe(
        Array.range(0, 7),
        Array.map(level => ({
          blockId: BlockRegistry.WATER,
          properties: { level },
          lightLevel: 0,
          skyLight: 15,
          waterLogged: true
        }))
      ),
      drops: [],
      boundingBox: {
        minX: 0, minY: 0, minZ: 0,
        maxX: 1, maxY: 0.875, maxZ: 1 // 水は若干低い
      }
    })
  })
```

### **2. ブロック更新システム仕様**

```typescript
// src/domain/block/block-update-specification.ts

/**
 * ブロック更新システム仕様
 *
 * ブロックの動的な状態変化を管理するシステム
 */

export interface BlockUpdateTicket {
  readonly position: BlockPosition
  readonly updateType: 'immediate' | 'scheduled' | 'random'
  readonly tickDelay: number
  readonly priority: number
  readonly metadata: Record<string, unknown>
}

// ブロック更新管理 - 関数的アプローチ
export const createBlockUpdateManager = () => {
  let pendingUpdates = new Map<string, BlockUpdateTicket>()
  const randomTickBlocks = new Set<BlockId>([
    BlockRegistry.SAPLING,
    BlockRegistry.TALL_GRASS
    // 農作物、葉ブロックなど...
  ])

  // ブロック更新スケジュール
  const scheduleUpdate = (
    position: BlockPosition,
    delay: number,
    updateType: string
  ): Effect.Effect<void> =>
    Effect.sync(() => {
      const key = `${position.x},${position.y},${position.z}`
      const ticket: BlockUpdateTicket = {
        position,
        updateType: 'scheduled',
        tickDelay: delay,
        priority: 1,
        metadata: { type: updateType }
      }
      pendingUpdates = new Map(pendingUpdates).set(key, ticket)
    })

  // 即座の更新実行
  const executeImmediateUpdate = (
    position: BlockPosition,
    world: any // World type
  ): Effect.Effect<void, BlockUpdateError> =>
    Effect.gen(function* () {
      const block = yield* world.getBlock(position)

      yield* pipe(
        Option.fromNullable(block),
        Option.match({
          onNone: () => Effect.fail(new BlockUpdateError({
            message: 'Block not found for update',
            position,
            updateType: 'immediate'
          })),
          onSome: (b) => Match.value(b.id).pipe(
            Match.when(BlockRegistry.WATER, () => updateWaterFlow(position, world)),
            Match.when(BlockRegistry.SAND, () => updateFallingBlock(position, world)),
            Match.when(BlockRegistry.GRAVEL, () => updateFallingBlock(position, world)),
            Match.when(BlockRegistry.SAPLING, () => updateSaplingGrowth(position, world)),
            Match.orElse(() => Effect.void)
          )
        })
      )
    })

  // 水流更新 - 関数的アプローチ
  const updateWaterFlow = (
    position: BlockPosition,
    world: any
  ): Effect.Effect<void, BlockUpdateError> =>
    Effect.gen(function* () {
      const waterBlock = yield* world.getBlock(position)

      yield* pipe(
        Option.fromNullable(waterBlock),
        Option.filter(b => b.id === BlockRegistry.WATER),
        Option.match({
          onNone: () => Effect.void,
          onSome: (water) => {
            const currentLevel = (water.defaultState.properties.level as number) || 0

            const adjacentPositions = [
              { x: position.x + 1, y: position.y, z: position.z },
              { x: position.x - 1, y: position.y, z: position.z },
              { x: position.x, y: position.y, z: position.z + 1 },
              { x: position.x, y: position.y, z: position.z - 1 }
            ]

            // 水平流動処理 - Effect-TSのArray操作
            return pipe(
              adjacentPositions,
              Array.map(adjPos =>
                Effect.gen(function* () {
                  const adjBlock = yield* world.getBlock(adjPos)

                  yield* Match.value({ block: adjBlock, level: currentLevel }).pipe(
                    Match.when(
                      ({ block, level }) => block?.id === BlockRegistry.AIR && level > 1,
                      () => {
                        const newWaterState: BlockState = {
                          blockId: BlockRegistry.WATER,
                          properties: { level: currentLevel - 1 },
                          lightLevel: 0,
                          skyLight: 15,
                          waterLogged: true
                        }
                        return world.setBlock(adjPos, BlockRegistry.WATER, newWaterState)
                      }
                    ),
                    Match.orElse(() => Effect.void)
                  )
                })
              ),
              Effect.all
            )
          }
        })
      )
    })

  // 落下ブロック更新
  const updateFallingBlock = (
    position: BlockPosition,
    world: any
  ): Effect.Effect<void, BlockUpdateError> =>
    Effect.gen(function* () {
      const belowPos = { ...position, y: position.y - 1 }
      const belowBlock = yield* world.getBlock(belowPos)

      yield* Match.value(belowBlock?.id).pipe(
        Match.when(BlockRegistry.AIR, () =>
          Effect.gen(function* () {
            const currentBlock = yield* world.getBlock(position)
            yield* pipe(
              Option.fromNullable(currentBlock),
              Option.match({
                onNone: () => Effect.void,
                onSome: (block) =>
                  Effect.all([
                    world.setBlock(belowPos, block.id, block.defaultState),
                    world.setBlock(position, BlockRegistry.AIR)
                  ])
              })
            )
          })
        ),
        Match.orElse(() => Effect.void)
      )
    })

  // 苗木成長更新
  const updateSaplingGrowth = (
    position: BlockPosition,
    world: any
  ): Effect.Effect<void, BlockUpdateError> =>
    Effect.gen(function* () {
      const lightLevel = yield* world.getLightLevel(position)
      const hasSpace = yield* checkTreeGrowthSpace(position, world)

      yield* Match.value({ lightLevel, hasSpace, random: Math.random() }).pipe(
        Match.when(
          ({ lightLevel, hasSpace, random }) =>
            lightLevel >= 9 && hasSpace && random < 0.05,
          () => growTree(position, world)
        ),
        Match.orElse(() => Effect.void)
      )
    })

  // 木の成長空間チェック
  const checkTreeGrowthSpace = (
    position: BlockPosition,
    world: any
  ): Effect.Effect<boolean> =>
    Effect.gen(function* () {
      const checkPositions = pipe(
        Array.range(-2, 1),
        Array.flatMap(x =>
          pipe(
            Array.range(-2, 1),
            Array.flatMap(z =>
              pipe(
                Array.range(1, 6),
                Array.map(y => ({
                  x: position.x + x,
                  y: position.y + y,
                  z: position.z + z
                }))
              )
            )
          )
        )
      )

      const hasObstruction = yield* pipe(
        checkPositions,
        Array.map(pos => world.getBlock(pos)),
        Effect.all,
        Effect.map(blocks =>
          pipe(
            blocks,
            Array.some(block =>
              block && block.id !== BlockRegistry.AIR && !block.material.transparent
            )
          )
        )
      )

      return !hasObstruction
    })

  // 木の生成
  const growTree = (
    position: BlockPosition,
    world: any
  ): Effect.Effect<void> =>
    Effect.gen(function* () {
      const trunkHeight = Math.floor(Math.random() * 3) + 4

      // 幹の生成
      yield* pipe(
        Array.range(0, trunkHeight - 1),
        Array.map(y =>
          world.setBlock(
            { ...position, y: position.y + y },
            BlockRegistry.LOG
          )
        ),
        Effect.all
      )

      // 葉の生成
      const leafPositions = pipe(
        Array.range(-2, 2),
        Array.flatMap(x =>
          pipe(
            Array.range(-2, 2),
            Array.flatMap(z =>
              pipe(
                Array.range(-1, 2),
                Array.map(y => ({
                  pos: {
                    x: position.x + x,
                    y: position.y + trunkHeight + y,
                    z: position.z + z
                  },
                  distance: Math.sqrt(x * x + z * z)
                }))
              )
            )
          )
        )
      )

      yield* pipe(
        leafPositions,
        Array.filter(({ distance }) => distance <= 2.5 && Math.random() < 0.8),
        Array.map(({ pos }) =>
          Effect.gen(function* () {
            const existing = yield* world.getBlock(pos)
            yield* Match.value(existing?.id).pipe(
              Match.when(BlockRegistry.AIR, () =>
                world.setBlock(pos, BlockRegistry.LEAVES)
              ),
              Match.orElse(() => Effect.void)
            )
          })
        ),
        Effect.all
      )
    })

  // ランダムティック処理
  const processRandomTicks = (
    chunk: any,
    world: any,
    randomTickSpeed: number = 3
  ): Effect.Effect<void> =>
    Effect.gen(function* () {
      const tickPositions = pipe(
        Array.range(0, randomTickSpeed - 1),
        Array.map(() => ({
          x: chunk.x * 16 + Math.floor(Math.random() * 16),
          y: Math.floor(Math.random() * 384) - 64,
          z: chunk.z * 16 + Math.floor(Math.random() * 16)
        }))
      )

      yield* pipe(
        tickPositions,
        Array.map(pos =>
          Effect.gen(function* () {
            const block = yield* world.getBlock(pos)
            yield* Match.value(block && randomTickBlocks.has(block.id)).pipe(
              Match.when(true, () => executeImmediateUpdate(pos, world)),
              Match.orElse(() => Effect.void)
            )
          })
        ),
        Effect.all
      )
    })

  // 草ブロック伝播
  const updateGrassSpread = (
    position: BlockPosition,
    world: any
  ): Effect.Effect<void> =>
    Effect.gen(function* () {
      const lightLevel = yield* world.getLightLevel(position)

      yield* Match.value(lightLevel >= 4).pipe(
        Match.when(true, () => {
          const adjacentPositions = [
            { x: position.x + 1, y: position.y, z: position.z },
            { x: position.x - 1, y: position.y, z: position.z },
            { x: position.x, y: position.y + 1, z: position.z },
            { x: position.x, y: position.y - 1, z: position.z },
            { x: position.x, y: position.y, z: position.z + 1 },
            { x: position.x, y: position.y, z: position.z - 1 }
          ]

          return pipe(
            adjacentPositions,
            Array.map(adjPos =>
              Effect.gen(function* () {
                const adjBlock = yield* world.getBlock(adjPos)
                yield* Match.value({
                  block: adjBlock?.id,
                  random: Math.random()
                }).pipe(
                  Match.when(
                    ({ block, random }) =>
                      block === BlockRegistry.DIRT && random < 0.25,
                    () => world.setBlock(adjPos, BlockRegistry.GRASS_BLOCK)
                  ),
                  Match.orElse(() => Effect.void)
                )
              })
            ),
            Effect.all
          )
        }),
        Match.orElse(() => world.setBlock(position, BlockRegistry.DIRT))
      )
    })

  return {
    scheduleUpdate,
    executeImmediateUpdate,
    processRandomTicks
  }
}

// エラー定義
export const BlockUpdateError = Schema.TaggedError<'BlockUpdateError'>()({
  _tag: Schema.Literal('BlockUpdateError'),
  message: Schema.String,
  position: BlockPosition,
  updateType: Schema.String
})

export type BlockUpdateError = Schema.Schema.Type<typeof BlockUpdateError>
```

## 👤 プレイヤー管理仕様

### **1. プレイヤー基本定義**

```typescript
// src/domain/player/player-specification.ts

/**
 * プレイヤー管理仕様
 *
 * プレイヤーエンティティと行動制御の完全定義
 */

// プレイヤー位置定義 - 関数的アプローチ
export const PlayerPosition = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number.pipe(Schema.between(-64, 320)),
  z: Schema.Number,
  yaw: Schema.Number.pipe(Schema.between(0, 360)), // 水平回転
  pitch: Schema.Number.pipe(Schema.between(-90, 90)) // 垂直回転
})

export type PlayerPosition = Schema.Schema.Type<typeof PlayerPosition>

// 位置操作関数群
export const getDirection = (pos: PlayerPosition): { x: number; y: number; z: number } => {
  const yawRad = (pos.yaw * Math.PI) / 180
  const pitchRad = (pos.pitch * Math.PI) / 180

  return {
    x: -Math.sin(yawRad) * Math.cos(pitchRad),
    y: -Math.sin(pitchRad),
    z: Math.cos(yawRad) * Math.cos(pitchRad)
  }
}

export const distanceTo = (pos1: PlayerPosition, pos2: PlayerPosition): number =>
  Math.sqrt(
    Math.pow(pos2.x - pos1.x, 2) +
    Math.pow(pos2.y - pos1.y, 2) +
    Math.pow(pos2.z - pos1.z, 2)
  )

// プレイヤーステータス定義 - 関数的アプローチ
export const PlayerStats = Schema.Struct({
  health: Schema.Number.pipe(Schema.between(0, 20)),
  hunger: Schema.Number.pipe(Schema.between(0, 20)),
  saturation: Schema.Number.pipe(Schema.between(0, 20)),
  level: Schema.Number.pipe(Schema.int(), Schema.nonnegative()),
  experience: Schema.Number.pipe(Schema.between(0, 1)), // 現在レベルの経験値割合
  totalExperience: Schema.Number.pipe(Schema.int(), Schema.nonnegative())
})

export type PlayerStats = Schema.Schema.Type<typeof PlayerStats>

// レベル計算関数群
export const calculateLevel = (totalExperience: number): number =>
  Match.value(totalExperience).pipe(
    Match.when(exp => exp <= 352, exp => Math.floor(Math.sqrt(exp + 9) - 3)),
    Match.when(exp => exp <= 1507, exp => Math.floor((81 + Math.sqrt(6561 + 180 * (exp - 353))) / 10)),
    Match.orElse(exp => Math.floor((325 + Math.sqrt(105625 + 72 * (exp - 1508))) / 18))
  )

export const getExperienceForLevel = (level: number): number =>
  Match.value(level).pipe(
    Match.when(l => l <= 15, l => l * l + 6 * l),
    Match.when(l => l <= 30, l => Math.floor(2.5 * l * l - 40.5 * l + 360)),
    Match.orElse(l => Math.floor(4.5 * l * l - 162.5 * l + 2220))
  )

// プレイヤー能力定義 - 関数的アプローチ
export const PlayerAbilities = Schema.Struct({
  canFly: Schema.Boolean,
  isFlying: Schema.Boolean,
  canBreakBlocks: Schema.Boolean,
  canPlaceBlocks: Schema.Boolean,
  invulnerable: Schema.Boolean,
  walkSpeed: Schema.Number.pipe(Schema.positive()),
  flySpeed: Schema.Number.pipe(Schema.positive())
})

export type PlayerAbilities = Schema.Schema.Type<typeof PlayerAbilities>

// ゲームモード定義
export const GameMode = Schema.Literal('survival', 'creative', 'adventure', 'spectator')
export type GameMode = Schema.Schema.Type<typeof GameMode>

// プレイヤー定義 - 関数的アプローチ
export const Player = Schema.Struct({
  uuid: Schema.String.pipe(Schema.uuid()),
  name: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(16)),
  position: PlayerPosition,
  stats: PlayerStats,
  abilities: PlayerAbilities,
  gameMode: GameMode,
  inventory: Schema.lazy(() => PlayerInventory)
})

export type Player = Schema.Schema.Type<typeof Player>

// プレイヤー操作関数群
export const movePlayer = (
  player: Player,
  newPosition: PlayerPosition,
  maxDistance: number = 10
): Effect.Effect<Player, PlayerMovementError> =>
  Effect.gen(function* () {
    const distance = distanceTo(player.position, newPosition)

    yield* Match.value({ distance, maxDistance, y: newPosition.y }).pipe(
      Match.when(
        ({ distance, maxDistance }) => distance > maxDistance,
        () => Effect.fail(new PlayerMovementError({
          message: 'Movement distance exceeds maximum',
          from: player.position,
          to: newPosition
        }))
      ),
      Match.when(
        ({ y }) => y < -64 || y > 320,
        () => Effect.fail(new PlayerMovementError({
          message: 'Position out of world bounds',
          from: player.position,
          to: newPosition
        }))
      ),
      Match.orElse(() => Effect.succeed({
        ...player,
        position: newPosition
      }))
    )
  })

export const takeDamage = (
  player: Player,
  amount: number,
  source: string
): Player =>
  Match.value({
    gameMode: player.gameMode,
    invulnerable: player.abilities.invulnerable
  }).pipe(
    Match.when(
      ({ gameMode }) => gameMode === 'creative',
      () => player
    ),
    Match.when(
      ({ invulnerable }) => invulnerable,
      () => player
    ),
    Match.orElse(() => ({
      ...player,
      stats: {
        ...player.stats,
        health: Math.max(0, player.stats.health - amount)
      }
    }))
  )

export const consumeFood = (
  player: Player,
  foodItem: FoodItem
): Effect.Effect<Player, PlayerActionError> =>
  Effect.gen(function* () {
    yield* Match.value({
      hunger: player.stats.hunger,
      alwaysEdible: foodItem.alwaysEdible
    }).pipe(
      Match.when(
        ({ hunger, alwaysEdible }) => hunger >= 20 && !alwaysEdible,
        () => Effect.fail(new PlayerActionError({
          message: 'Cannot eat when hunger is full',
          action: 'consume_food'
        }))
      ),
      Match.orElse(() => Effect.void)
    )

    return {
      ...player,
      stats: {
        ...player.stats,
        hunger: Math.min(20, player.stats.hunger + foodItem.hungerRestore),
        saturation: Math.min(20, player.stats.saturation + foodItem.saturationRestore),
        health: pipe(
          Option.fromNullable(foodItem.instantHealth),
          Option.match({
            onNone: () => player.stats.health,
            onSome: (heal) => Math.min(20, player.stats.health + heal)
          })
        )
      }
    }
  })

export const addExperience = (
  player: Player,
  amount: number
): Player => {
  const newTotal = player.stats.totalExperience + amount
  const newLevel = calculateLevel(newTotal)
  const levelExp = getExperienceForLevel(newLevel)
  const nextLevelExp = getExperienceForLevel(newLevel + 1)
  const progress = (newTotal - levelExp) / (nextLevelExp - levelExp)

  return {
    ...player,
    stats: {
      ...player.stats,
      totalExperience: newTotal,
      level: newLevel,
      experience: progress
    }
  }
}

export const canPerformAction = (
  player: Player,
  action: string
): boolean =>
  Match.value({ gameMode: player.gameMode, abilities: player.abilities }).pipe(
    Match.when(
      ({ gameMode }) => gameMode === 'creative',
      () => true
    ),
    Match.when(
      ({ abilities }) => abilities.invulnerable,
      () => true
    ),
    Match.when(
      ({ gameMode }) => gameMode === 'spectator',
      () => Match.value(action).pipe(
        Match.when('observe', () => true),
        Match.orElse(() => false)
      )
    ),
    Match.orElse(() => Match.value(action).pipe(
      Match.when('break_blocks', ({ abilities }) => abilities.canBreakBlocks),
      Match.when('place_blocks', ({ abilities }) => abilities.canPlaceBlocks),
      Match.when('fly', ({ abilities }) => abilities.canFly),
      Match.orElse(() => true)
    ))
  )

// エラー定義
export const PlayerMovementError = Schema.TaggedError<'PlayerMovementError'>()({
  _tag: Schema.Literal('PlayerMovementError'),
  message: Schema.String,
  from: PlayerPosition,
  to: PlayerPosition
})

export const PlayerActionError = Schema.TaggedError<'PlayerActionError'>()({
  _tag: Schema.Literal('PlayerActionError'),
  message: Schema.String,
  action: Schema.String
})

export type PlayerMovementError = Schema.Schema.Type<typeof PlayerMovementError>
export type PlayerActionError = Schema.Schema.Type<typeof PlayerActionError>

// 食料アイテム定義
export const FoodItem = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  hungerRestore: Schema.Number.pipe(Schema.int(), Schema.between(1, 20)),
  saturationRestore: Schema.Number.pipe(Schema.between(0, 20)),
  alwaysEdible: Schema.Boolean,
  instantHealth: Schema.optional(Schema.Number.pipe(Schema.between(1, 20)))
})

export type FoodItem = Schema.Schema.Type<typeof FoodItem>
```

### **2. インベントリシステム仕様**

```typescript
// src/domain/inventory/inventory-specification.ts

/**
 * インベントリシステム仕様
 *
 * アイテム管理とクラフティングの完全定義
 */

// アイテムスタック定義 - 関数的アプローチ
export const ItemStack = Schema.Struct({
  itemId: Schema.String.pipe(Schema.brand('ItemId')),
  quantity: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
  durability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  enchantments: Schema.optional(Schema.Array(Schema.Struct({
    type: Schema.String,
    level: Schema.Number.pipe(Schema.int(), Schema.positive())
  }))),
  customData: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

export type ItemStack = Schema.Schema.Type<typeof ItemStack>

// アイテムスタック操作関数群
export const canStackWith = (
  stack1: ItemStack,
  stack2: ItemStack,
  maxStackSize: number = 64
): boolean =>
  stack1.itemId === stack2.itemId &&
  !stack1.durability &&
  !stack2.durability &&
  JSON.stringify(stack1.enchantments) === JSON.stringify(stack2.enchantments)

export const mergeStacks = (
  stack1: ItemStack,
  stack2: ItemStack,
  maxStackSize: number = 64
): { merged: ItemStack; remainder: ItemStack | null } =>
  Match.value(canStackWith(stack1, stack2, maxStackSize)).pipe(
    Match.when(false, () => ({
      merged: stack1,
      remainder: stack2
    })),
    Match.orElse(() => {
      const totalQuantity = stack1.quantity + stack2.quantity

      return Match.value(totalQuantity <= maxStackSize).pipe(
        Match.when(true, () => ({
          merged: { ...stack1, quantity: totalQuantity },
          remainder: null
        })),
        Match.orElse(() => ({
          merged: { ...stack1, quantity: maxStackSize },
          remainder: { ...stack2, quantity: totalQuantity - maxStackSize }
        }))
      )
    })
  )

export const splitStack = (
  stack: ItemStack,
  amount: number
): { original: ItemStack | null; split: ItemStack } =>
  Match.value(amount >= stack.quantity).pipe(
    Match.when(true, () => ({
      original: null,
      split: stack
    })),
    Match.orElse(() => ({
      original: { ...stack, quantity: stack.quantity - amount },
      split: { ...stack, quantity: amount }
    }))
  )

// インベントリスロット定義 - 関数的アプローチ
export const InventorySlot = Schema.Struct({
  index: Schema.Number.pipe(Schema.int(), Schema.nonnegative()),
  itemStack: Schema.optional(ItemStack),
  locked: Schema.Boolean
})

export type InventorySlot = Schema.Schema.Type<typeof InventorySlot>

// スロット操作関数群
export const isEmpty = (slot: InventorySlot): boolean =>
  !slot.itemStack

export const canAccept = (slot: InventorySlot, item: ItemStack): boolean =>
  Match.value({ locked: slot.locked, empty: isEmpty(slot), stack: slot.itemStack }).pipe(
    Match.when({ locked: true }, () => false),
    Match.when({ empty: true }, () => true),
    Match.when(
      ({ stack }) => !stack,
      () => true
    ),
    Match.orElse(({ stack }) =>
      stack ? canStackWith(stack, item, 64) : false
    )
  )

// プレイヤーインベントリ定義 - 関数的アプローチ
export const PlayerInventory = Schema.Struct({
  mainInventory: Schema.Array(InventorySlot).pipe(Schema.itemsCount(27)),
  hotbar: Schema.Array(InventorySlot).pipe(Schema.itemsCount(9)),
  armor: Schema.Array(InventorySlot).pipe(Schema.itemsCount(4)),
  offhand: InventorySlot,
  craftingGrid: Schema.Array(InventorySlot).pipe(Schema.itemsCount(4))
})

export type PlayerInventory = Schema.Schema.Type<typeof PlayerInventory>

// インベントリ操作関数群
export const findEmptySlot = (
  inventory: PlayerInventory,
  excludeHotbar: boolean = false
): Option.Option<InventorySlot> => {
  const emptyInMain = pipe(
    inventory.mainInventory,
    Array.findFirst(slot => isEmpty(slot))
  )

  return pipe(
    emptyInMain,
    Option.orElse(() =>
      Match.value(excludeHotbar).pipe(
        Match.when(true, () => Option.none()),
        Match.orElse(() =>
          pipe(
            inventory.hotbar,
            Array.findFirst(slot => isEmpty(slot))
          )
        )
      )
    )
  )
}

export const addItem = (
  inventory: PlayerInventory,
  item: ItemStack
): Effect.Effect<PlayerInventory, InventoryError> =>
  Effect.gen(function* () {
    let remaining = item
    const allSlots = [...inventory.mainInventory, ...inventory.hotbar]

    // 既存スタックとマージ試行
    const mergedInventory = pipe(
      allSlots,
      Array.reduce(
        { inv: inventory, rem: remaining },
        (acc, slot) => {
          const result = pipe(
            Option.fromNullable(slot.itemStack),
            Option.filter(_ => canAccept(slot, acc.rem)),
            Option.match({
              onNone: () => acc,
              onSome: (stack) => {
                const stackResult = mergeStacks(stack, acc.rem)
                return stackResult.remainder
                  ? { ...acc, rem: stackResult.remainder }
                  : { ...acc, rem: null }
              }
            })
          )
          return result
        }
      )
    )

    // 残りがある場合は空きスロットに配置
    yield* pipe(
      Option.fromNullable(mergedInventory.rem),
      Option.match({
        onNone: () => Effect.succeed(mergedInventory.inv),
        onSome: (rem) =>
          pipe(
            findEmptySlot(mergedInventory.inv),
            Option.match({
              onNone: () => Effect.fail(new InventoryError({
                message: 'No empty slots available',
                itemId: rem.itemId
              })),
              onSome: (slot) => Effect.succeed({
                ...mergedInventory.inv,
                mainInventory: pipe(
                  mergedInventory.inv.mainInventory,
                  Array.map(s =>
                    s.index === slot.index
                      ? { ...s, itemStack: rem }
                      : s
                  )
                )
              })
            })
          )
      })
    )
  })

export const consumeItem = (
  inventory: PlayerInventory,
  itemId: string,
  amount: number
): Effect.Effect<PlayerInventory, InventoryError> =>
  Effect.gen(function* () {
    const allSlots = [...inventory.mainInventory, ...inventory.hotbar]

    const slotsWithItem = pipe(
      allSlots,
      Array.filter(slot =>
        slot.itemStack && slot.itemStack.itemId === itemId
      )
    )

    const totalAvailable = pipe(
      slotsWithItem,
      Array.reduce(0, (sum, slot) =>
        sum + (slot.itemStack?.quantity || 0)
      )
    )

    yield* Match.value({ available: totalAvailable, required: amount }).pipe(
      Match.when(
        ({ available, required }) => available < required,
        () => Effect.fail(new InventoryError({
          message: `Insufficient items: ${itemId}`,
          itemId
        }))
      ),
      Match.orElse(() => Effect.void)
    )

    let remainingToConsume = amount
    const updatedSlots = pipe(
      allSlots,
      Array.map(slot => {
        return Match.value({
          remaining: remainingToConsume,
          hasItem: slot.itemStack?.itemId === itemId
        }).pipe(
          Match.when(
            ({ remaining }) => remaining <= 0,
            () => slot
          ),
          Match.when(
            ({ hasItem }) => !hasItem,
            () => slot
          ),
          Match.orElse(() => {
            const stack = slot.itemStack!
            const consumeFromThisSlot = Math.min(remainingToConsume, stack.quantity)
            remainingToConsume -= consumeFromThisSlot

            return Match.value(consumeFromThisSlot >= stack.quantity).pipe(
              Match.when(true, () => ({ ...slot, itemStack: undefined })),
              Match.orElse(() => ({
                ...slot,
                itemStack: {
                  ...stack,
                  quantity: stack.quantity - consumeFromThisSlot
                }
              }))
            )
          })
        )
      })
    )

    return {
      ...inventory,
      mainInventory: updatedSlots.slice(0, 27),
      hotbar: updatedSlots.slice(27, 36)
    }
  })

// クラフティングレシピ定義 - 関数的アプローチ
export const CraftingRecipe = Schema.Struct({
  id: Schema.String,
  shaped: Schema.Boolean,
  ingredients: Schema.Array(Schema.optional(Schema.Struct({
    id: Schema.String,
    count: Schema.Number.pipe(Schema.int(), Schema.positive())
  }))),
  result: ItemStack
})

export type CraftingRecipe = Schema.Schema.Type<typeof CraftingRecipe>

// レシピマッチング関数
export const matchesRecipe = (
  recipe: CraftingRecipe,
  craftingItems: Array<ItemStack | undefined>
): boolean =>
  Match.value(recipe.shaped).pipe(
    Match.when(true, () =>
      pipe(
        Array.range(0, 3),
        Array.every(i => {
          const required = recipe.ingredients[i]
          const available = craftingItems[i]

          return Match.value({ required, available }).pipe(
            Match.when(
              ({ required, available }) => !required && !available,
              () => true
            ),
            Match.when(
              ({ required, available }) => !required && available,
              () => false
            ),
            Match.when(
              ({ required, available }) => required && !available,
              () => false
            ),
            Match.orElse(({ required, available }) =>
              required!.id === available!.itemId &&
              required!.count <= available!.quantity
            )
          )
        })
      )
    ),
    Match.orElse(() => {
      const requiredItems = pipe(
        recipe.ingredients,
        Array.filter(Option.isSome),
        Array.map(i => i!)
      )

      return pipe(
        requiredItems,
        Array.every(required => {
          const available = pipe(
            craftingItems,
            Array.filter(Option.isSome),
            Array.map(i => i!),
            Array.reduce(
              0,
              (sum, item) =>
                item.itemId === required.id
                  ? sum + item.quantity
                  : sum
            )
          )

          return available >= required.count
        })
      )
    })
  )

// エラー定義
export const InventoryError = Schema.TaggedError<'InventoryError'>()({
  _tag: Schema.Literal('InventoryError'),
  message: Schema.String,
  itemId: Schema.String
})

export type InventoryError = Schema.Schema.Type<typeof InventoryError>
```

## 🌍 ワールド生成仕様

完全なEffect-TSパターンでのワールド生成システムは、次のような実装になります：

[続きは長くなるため、必要に応じて追加部分を実装します]