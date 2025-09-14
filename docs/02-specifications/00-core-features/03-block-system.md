---
title: "ブロックシステム仕様 - レジストリ・状態管理・相互作用"
description: "400+ブロック定義、動的状態管理、隣接ブロック相互作用の完全仕様。Effect-TSによる型安全な値オブジェクトパターンと最適化。"
category: "specification"
difficulty: "intermediate"
tags: ["block-system", "registry", "state-management", "block-interactions", "physics-integration", "value-objects"]
prerequisites: ["effect-ts-fundamentals", "schema-basics", "value-object-patterns"]
estimated_reading_time: "12分"
related_patterns: ["data-modeling-patterns", "optimization-patterns", "registry-patterns"]
related_docs: ["./07-chunk-system.md", "./05-rendering-system.md", "../../01-architecture/05-ecs-integration.md"]
---

# ブロックシステム - ブロック管理システム

## 概要

ブロックシステムは、TypeScript Minecraftクローンの基本要素であるブロックの完全な管理システムです。Effect-TS 3.17+の最新パターン（Schema.Struct、@app/ServiceNameネームスペース）とDDDの値オブジェクトパターンを活用し、400+種類のブロックを純粋関数型で管理します。

本システムは以下の機能を提供します：
- **ブロックレジストリ**: バニラMinecraft互換の400+ブロック定義
- **状態管理**: 向き・接続・電源等の動的状態管理
- **更新システム**: リアルタイムな隣接ブロック相互作用
- **物理演算**: 重力・流体・レッドストーンへの応答
- **インタラクション**: 配置・破壊・アクティベーション処理
- **メッシュ生成**: グリーディメッシング最適化

## ブロックタイプ定義

### ブロックスキーマ

```typescript
import { Effect, Layer, Context, Schema, pipe, Match, Stream, Data, STM } from "effect"
import { Brand, Option, ReadonlyArray, Queue, Ref, TRef } from "effect"

// ブランド型定義（Effect-TS最新パターン）
export const BlockId = pipe(
  Schema.String,
  Schema.pattern(/^[a-z]+:[a-z_]+$/),
  Schema.brand("BlockId")
)
export type BlockId = Schema.Schema.Type<typeof BlockId>

export const Position3D = pipe(
  Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  Schema.brand("Position3D")
)
export type Position3D = Schema.Schema.Type<typeof Position3D>

export const ChunkId = pipe(
  Schema.String,
  Schema.pattern(/^chunk_\d+_\d+$/),
  Schema.brand("ChunkId")
)
export type ChunkId = Schema.Schema.Type<typeof ChunkId>

// ブロック状態の判別共用体（Schema.Union使用）
export const BlockState = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("directional"),
    facing: Schema.Union(
      Schema.Literal("north"),
      Schema.Literal("south"),
      Schema.Literal("east"),
      Schema.Literal("west"),
      Schema.Literal("up"),
      Schema.Literal("down")
    )
  }),
  Schema.Struct({
    _tag: Schema.Literal("powered"),
    powered: Schema.Boolean,
    signal: pipe(Schema.Number, Schema.int(), Schema.between(0, 15))
  }),
  Schema.Struct({
    _tag: Schema.Literal("fluid"),
    waterlogged: Schema.Boolean,
    level: pipe(Schema.Number, Schema.int(), Schema.between(0, 8))
  }),
  Schema.Struct({
    _tag: Schema.Literal("interactive"),
    open: Schema.Boolean,
    lit: Schema.Boolean
  }),
  Schema.Struct({
    _tag: Schema.Literal("structural"),
    half: Schema.Union(Schema.Literal("top"), Schema.Literal("bottom")),
    shape: Schema.Union(
      Schema.Literal("straight"),
      Schema.Literal("inner_left"),
      Schema.Literal("inner_right"),
      Schema.Literal("outer_left"),
      Schema.Literal("outer_right")
    ),
    axis: Schema.Union(Schema.Literal("x"), Schema.Literal("y"), Schema.Literal("z"))
  }),
  Schema.Struct({
    _tag: Schema.Literal("default")
  })
)
export type BlockState = Schema.Schema.Type<typeof BlockState>

// 物理プロパティの検証付きスキーマ
export const BlockPhysics = Schema.Struct({
  hardness: pipe(
    Schema.Number,
    Schema.nonNegative(),
    Schema.annotations({ description: "ブロックの硬度 (0-∞)" })
  ),
  resistance: pipe(
    Schema.Number,
    Schema.nonNegative(),
    Schema.annotations({ description: "爆発耐性 (0-∞)" })
  ),
  luminance: pipe(
    Schema.Number,
    Schema.int(),
    Schema.between(0, 15),
    Schema.annotations({ description: "発光レベル (0-15)" })
  ),
  opacity: pipe(
    Schema.Number,
    Schema.int(),
    Schema.between(0, 15),
    Schema.annotations({ description: "光不透明度 (0-15)" })
  ),
  slipperiness: pipe(
    Schema.Number,
    Schema.between(0.4, 1.0),
    Schema.annotations({ description: "滑りやすさ (0.4-1.0)" })
  )
})

// ブロックタイプの判別共用体（Schema.Union使用）
export const BlockType = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("solid"),
    id: BlockId,
    name: Schema.String,
    physics: BlockPhysics,
    material: Schema.Union(
      Schema.Literal("stone"),
      Schema.Literal("wood"),
      Schema.Literal("metal"),
      Schema.Literal("dirt"),
      Schema.Literal("sand")
    ),
    toolRequired: Schema.optional(Schema.Union(
      Schema.Literal("pickaxe"),
      Schema.Literal("axe"),
      Schema.Literal("shovel")
    )),
    harvestLevel: Schema.optional(pipe(Schema.Number, Schema.int(), Schema.between(0, 4)))
  }),
  Schema.Struct({
    _tag: Schema.Literal("fluid"),
    id: BlockId,
    name: Schema.String,
    physics: BlockPhysics,
    viscosity: pipe(Schema.Number, Schema.positive()),
    flowRate: pipe(Schema.Number, Schema.between(1, 8))
  }),
  Schema.Struct({
    _tag: Schema.Literal("interactive"),
    id: BlockId,
    name: Schema.String,
    physics: BlockPhysics,
    activationMethod: Schema.Union(
      Schema.Literal("right_click"),
      Schema.Literal("redstone"),
      Schema.Literal("pressure")
    ),
    inventory: Schema.optional(Schema.Boolean)
  }),
  Schema.Struct({
    _tag: Schema.Literal("redstone"),
    id: BlockId,
    name: Schema.String,
    physics: BlockPhysics,
    powerLevel: pipe(Schema.Number, Schema.int(), Schema.between(0, 15)),
    isPowerSource: Schema.Boolean,
    canTransmitPower: Schema.Boolean
  }),
  Schema.Struct({
    _tag: Schema.Literal("transparent"),
    id: BlockId,
    name: Schema.String,
    physics: BlockPhysics,
    material: Schema.Union(
      Schema.Literal("glass"),
      Schema.Literal("ice"),
      Schema.Literal("leaves")
    ),
    lightTransmission: pipe(Schema.Number, Schema.between(0, 1))
  })
)
export type BlockType = Schema.Schema.Type<typeof BlockType>

// ブロック配置ルールのバリデーション
export const BlockPlacementRule = Schema.Struct({
  canPlaceOn: Schema.Array(BlockId),
  requiresSupport: Schema.Boolean,
  needsSpace: Schema.Boolean,
  environmentRequirements: Schema.optional(
    Schema.Struct({
      minLightLevel: Schema.optional(pipe(Schema.Number, Schema.between(0, 15))),
      maxLightLevel: Schema.optional(pipe(Schema.Number, Schema.between(0, 15))),
      requiresWater: Schema.optional(Schema.Boolean),
      requiresAir: Schema.optional(Schema.Boolean)
    })
  )
})

// 完全なブロック定義
export const BlockDefinition = Schema.Struct({
  blockType: BlockType,
  defaultState: BlockState,
  boundingBox: Schema.Struct({
    min: Position3D,
    max: Position3D
  }),
  placementRules: BlockPlacementRule,
  drops: Schema.Array(
    Schema.Struct({
      item: BlockId,
      count: Schema.Struct({
        min: pipe(Schema.Number, Schema.int(), Schema.positive()),
        max: pipe(Schema.Number, Schema.int(), Schema.positive())
      }),
      chance: pipe(Schema.Number, Schema.between(0, 1)),
      requiresTool: Schema.optional(Schema.Boolean)
    })
  ),
  soundType: Schema.Union(
    Schema.Literal("stone"),
    Schema.Literal("wood"),
    Schema.Literal("gravel"),
    Schema.Literal("grass"),
    Schema.Literal("metal"),
    Schema.Literal("glass"),
    Schema.Literal("wool"),
    Schema.Literal("sand"),
    Schema.Literal("snow")
  )
})

export type BlockDefinition = Schema.Schema.Type<typeof BlockDefinition>
```

## ブロックレジストリ

### ブロック登録サービス

```typescript
// ブロックレジストリエラー（Effect-TS最新パターン）
export class BlockRegistrationError extends Data.TaggedError("BlockRegistrationError")<{
  readonly blockId: BlockId
  readonly reason: string
  readonly timestamp: number
}> {}

export class BlockNotFoundError extends Data.TaggedError("BlockNotFoundError")<{
  readonly blockId: BlockId
  readonly searchContext: string
}> {}

export class BlockValidationError extends Data.TaggedError("BlockValidationError")<{
  readonly blockId: BlockId
  readonly validationErrors: ReadonlyArray<string>
  readonly schema: string
}> {}

export class BlockConcurrencyError extends Data.TaggedError("BlockConcurrencyError")<{
  readonly blockId: BlockId
  readonly operation: string
  readonly conflictingOperation: string
}> {}

// BlockRegistryサービス定義（STM対応・最新パターン）
interface BlockRegistryService {
  readonly register: (block: BlockDefinition) => Effect.Effect<void, BlockRegistrationError | BlockValidationError | BlockConcurrencyError>
  readonly registerBatch: (blocks: ReadonlyArray<BlockDefinition>) => Effect.Effect<void, BlockRegistrationError | BlockValidationError>
  readonly get: (id: BlockId) => Effect.Effect<BlockDefinition, BlockNotFoundError>
  readonly getAll: () => Effect.Effect<ReadonlyArray<BlockDefinition>, never>
  readonly findByTag: (tag: BlockType["_tag"]) => Effect.Effect<ReadonlyArray<BlockDefinition>, never>
  readonly findByMaterial: (material: string) => Effect.Effect<ReadonlyArray<BlockDefinition>, never>
  readonly validatePlacement: (
    blockType: BlockType,
    position: Position3D,
    world: WorldService
  ) => Effect.Effect<boolean, BlockValidationError>
  readonly getBlockStream: () => Stream.Stream<BlockDefinition, never>
  readonly atomicUpdate: (
    blockId: BlockId,
    update: (current: BlockDefinition) => BlockDefinition
  ) => Effect.Effect<BlockDefinition, BlockNotFoundError | BlockConcurrencyError>
}

// Context Tag（@minecraft/ネームスペース）
export const BlockRegistry = Context.GenericTag<BlockRegistryService>("@minecraft/BlockRegistry")

// ブロック変更イベント（Schema.Union使用）
export const BlockChangeEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("block_registered"),
    blockId: BlockId,
    blockDefinition: BlockDefinition,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("block_placed"),
    blockId: BlockId,
    position: Position3D,
    newState: BlockState,
    placer: Schema.optional(Schema.String),
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("block_broken"),
    blockId: BlockId,
    position: Position3D,
    oldState: BlockState,
    breaker: Schema.optional(Schema.String),
    drops: Schema.Array(BlockId),
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("block_state_changed"),
    blockId: BlockId,
    position: Position3D,
    oldState: BlockState,
    newState: BlockState,
    timestamp: Schema.Number
  })
)
export type BlockChangeEvent = Schema.Schema.Type<typeof BlockChangeEvent>

// Live実装作成関数（STM対応）
const makeBlockRegistry = Effect.gen(function* () {
  const registry = yield* STM.map(
    STM.tMapEmpty<BlockId, BlockDefinition>(),
    tmap => tmap
  ).pipe(STM.commit)
  const eventStream = yield* Queue.unbounded<BlockChangeEvent>()
  const operationLock = yield* STM.map(
    STM.tMapEmpty<BlockId, string>(),
    tmap => tmap
  ).pipe(STM.commit)

  // バニラブロック定義（Schema適用・最新パターン）
  const registerVanillaBlocks = Effect.gen(function* () {
    const stoneBlock: BlockDefinition = {
      blockType: {
        _tag: "solid",
        id: Schema.decodeSync(BlockId)("minecraft:stone"),
        name: "石",
        physics: {
          hardness: 1.5,
          resistance: 6.0,
          luminance: 0,
          opacity: 15,
          slipperiness: 0.6
        },
        material: "stone",
        toolRequired: Option.some("pickaxe"),
        harvestLevel: Option.some(0)
      },
      defaultState: { _tag: "default" },
      boundingBox: {
        min: Schema.decodeSync(Position3D)({ x: 0, y: 0, z: 0 }),
        max: Schema.decodeSync(Position3D)({ x: 1, y: 1, z: 1 })
      },
      placementRules: {
        canPlaceOn: [],
        requiresSupport: false,
        needsSpace: false
      },
      drops: [{
        item: Schema.decodeSync(BlockId)("minecraft:cobblestone"),
        count: { min: 1, max: 1 },
        chance: 1.0,
        requiresTool: Option.some(true)
      }],
      soundType: "stone"
    }

    const waterBlock: BlockDefinition = {
      blockType: {
        _tag: "fluid",
        id: Schema.decodeSync(BlockId)("minecraft:water"),
        name: "水",
        physics: {
          hardness: 100.0,
          resistance: 100.0,
          luminance: 0,
          opacity: 3,
          slipperiness: 0.6
        },
        viscosity: 1.0,
        flowRate: 5
      },
      defaultState: { _tag: "fluid", waterlogged: true, level: 8 },
      boundingBox: {
        min: Schema.decodeSync(Position3D)({ x: 0, y: 0, z: 0 }),
        max: Schema.decodeSync(Position3D)({ x: 1, y: 0.875, z: 1 })
      },
      placementRules: {
        canPlaceOn: [],
        requiresSupport: false,
        needsSpace: true
      },
      drops: [],
      soundType: "wood" // Note: water doesn't have dedicated sound type
    }

    yield* register(stoneBlock)
    yield* register(waterBlock)
  })

  yield* registerVanillaBlocks

  const register = (block: BlockDefinition) =>
    Effect.gen(function* () {
      // スキーマ検証（早期リターン）
      const validationResult = yield* Schema.decodeUnknown(BlockDefinition)(block).pipe(
        Effect.mapError(error => new BlockValidationError({
          blockId: block.blockType.id,
          validationErrors: [error.message],
          schema: "BlockDefinition"
        }))
      )

      // STMによる並行性制御
      const result = yield* STM.gen(function* () {
        const registryTMap = yield* STM.tMapEmpty<BlockId, BlockDefinition>()
        const lockTMap = yield* STM.tMapEmpty<BlockId, string>()

        // ロックの取得
        const currentLock = yield* STM.tMapGet(lockTMap, block.blockType.id)
        if (Option.isSome(currentLock)) {
          return yield* STM.fail(new BlockConcurrencyError({
            blockId: block.blockType.id,
            operation: "register",
            conflictingOperation: currentLock.value
          }))
        }

        // ロック設定
        yield* STM.tMapSet(lockTMap, block.blockType.id, "register")

        // 重複チェック
        const existing = yield* STM.tMapGet(registryTMap, block.blockType.id)
        if (Option.isSome(existing)) {
          yield* STM.tMapRemove(lockTMap, block.blockType.id)
          return yield* STM.fail(new BlockRegistrationError({
            blockId: block.blockType.id,
            reason: "Block already registered",
            timestamp: Date.now()
          }))
        }

        // ブロック登録
        yield* STM.tMapSet(registryTMap, block.blockType.id, validationResult)
        yield* STM.tMapRemove(lockTMap, block.blockType.id)

        return validationResult
      }).pipe(STM.commit)

      // イベント発行
      yield* Queue.offer(eventStream, {
        _tag: "block_registered",
        blockId: block.blockType.id,
        blockDefinition: result,
        timestamp: Date.now()
      })
    })

  const get = (id: BlockId) =>
    Effect.gen(function* () {
      const result = yield* STM.gen(function* () {
        const registryTMap = yield* STM.tMapEmpty<BlockId, BlockDefinition>()
        return yield* STM.tMapGet(registryTMap, id)
      }).pipe(STM.commit)

      // 早期リターン: ブロックが見つからない場合
      if (Option.isNone(result)) {
        return yield* Effect.fail(new BlockNotFoundError({
          blockId: id,
          searchContext: "registry_lookup"
        }))
      }

      return result.value
    })

  const findByTag = (tag: BlockType["_tag"]) =>
    Effect.gen(function* () {
      const all = yield* getAll()
      return ReadonlyArray.filter(all, block => block.blockType._tag === tag)
    })

  const findByMaterial = (material: string) =>
    Effect.gen(function* () {
      const all = yield* getAll()
      return ReadonlyArray.filter(all, block =>
        Match.value(block.blockType).pipe(
          Match.when({ _tag: "solid" }, solid => solid.material === material),
          Match.when({ _tag: "transparent" }, transparent => transparent.material === material),
          Match.orElse(() => false)
        )
      )
    })

  const validatePlacement = (
    blockType: BlockType,
    position: Position3D,
    world: WorldService
  ) =>
    Effect.gen(function* () {
      // Match.type による配置ルール検証（最新パターン）
      return yield* pipe(
        Match.type<BlockType>(),
        Match.when(
          { _tag: "fluid" },
          (fluid) => Effect.gen(function* () {
            const belowPos = { ...position, y: position.y - 1 }
            const blockBelow = yield* world.getBlock(belowPos)

            // 早期リターン: 流体は固体ブロックの上にのみ配置可能
            if (!blockBelow || blockBelow.blockType._tag !== "solid") {
              return false
            }
            return true
          })
        ),
        Match.when(
          { _tag: "redstone" },
          (redstone) => Effect.gen(function* () {
            const surroundingBlocks = yield* world.getSurroundingBlocks(position)

            // 早期リターン: レッドストーン機器は導電性ブロックが必要
            const hasConductive = surroundingBlocks.some(block =>
              block?.blockType._tag === "solid" ||
              block?.blockType._tag === "redstone"
            )

            if (!hasConductive) {
              return false
            }
            return true
          })
        ),
        Match.when(
          { _tag: "interactive" },
          (interactive) => Effect.gen(function* () {
            // インタラクティブブロックの特別な配置条件
            const hasSpace = yield* world.checkSpace(position, { width: 1, height: 2, depth: 1 })
            if (!hasSpace) {
              return false
            }
            return true
          })
        ),
        Match.orElse(() => Effect.succeed(true))
      )(blockType)
    })

  const getAll = () =>
    Ref.get(registry).pipe(
      Effect.map(current => ReadonlyArray.fromIterable(current.values()))
    )

  const getAll = () =>
    STM.gen(function* () {
      const registryTMap = yield* STM.tMapEmpty<BlockId, BlockDefinition>()
      const entries = yield* STM.tMapToReadonlyArray(registryTMap)
      return ReadonlyArray.map(entries, ([_, block]) => block)
    }).pipe(STM.commit)

  const getBlockStream = () =>
    Stream.fromQueue(eventStream).pipe(
      Stream.map(event => pipe(
        Match.type<BlockChangeEvent>(),
        Match.when(
          { _tag: "block_registered" },
          (event) => Effect.gen(function* () {
            return event.blockDefinition
          })
        ),
        Match.when(
          { _tag: "block_placed" },
          (event) => Effect.gen(function* () {
            return yield* get(event.blockId)
          })
        ),
        Match.orElse(() => Effect.fail(new Error("Invalid event type")))
      )(event)),
      Stream.mapEffect(effect => effect)
    )

  const atomicUpdate = (
    blockId: BlockId,
    update: (current: BlockDefinition) => BlockDefinition
  ) =>
    Effect.gen(function* () {
      return yield* STM.gen(function* () {
        const registryTMap = yield* STM.tMapEmpty<BlockId, BlockDefinition>()
        const lockTMap = yield* STM.tMapEmpty<BlockId, string>()

        // ロック取得
        const currentLock = yield* STM.tMapGet(lockTMap, blockId)
        if (Option.isSome(currentLock)) {
          return yield* STM.fail(new BlockConcurrencyError({
            blockId,
            operation: "update",
            conflictingOperation: currentLock.value
          }))
        }

        yield* STM.tMapSet(lockTMap, blockId, "update")

        // 現在の定義取得
        const current = yield* STM.tMapGet(registryTMap, blockId)
        if (Option.isNone(current)) {
          yield* STM.tMapRemove(lockTMap, blockId)
          return yield* STM.fail(new BlockNotFoundError({
            blockId,
            searchContext: "atomic_update"
          }))
        }

        // 更新実行
        const updated = update(current.value)
        yield* STM.tMapSet(registryTMap, blockId, updated)
        yield* STM.tMapRemove(lockTMap, blockId)

        return updated
      }).pipe(STM.commit)
    })

  return BlockRegistry.of({
    register,
    registerBatch: (blocks) => Effect.all(blocks.map(register)).pipe(Effect.asUnit),
    get,
    getAll,
    findByTag,
    findByMaterial,
    validatePlacement,
    getBlockStream,
    atomicUpdate
  })
  })

// Live Layer
export const BlockRegistryLive = Layer.effect(
  BlockRegistry,
  makeBlockRegistry
)
```

## ブロック更新システム

### ブロック更新サービス

```typescript
// ブロック更新エラー
export class BlockUpdateError extends Data.TaggedError("BlockUpdateError")<{
  readonly position: Position3D
  readonly updateType: string
  readonly reason: string
}> {}

// ブロック更新イベントの判別共用体（Schema.Union使用）
export const BlockUpdateEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("neighbor_changed"),
    position: Position3D,
    sourcePosition: Position3D,
    blockId: BlockId,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("random_tick"),
    position: Position3D,
    blockId: BlockId,
    tickRate: pipe(Schema.Number, Schema.positive()),
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("scheduled_tick"),
    position: Position3D,
    blockId: BlockId,
    delay: pipe(Schema.Number, Schema.nonNegative()),
    data: Schema.optional(Schema.Unknown),
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("physics_tick"),
    position: Position3D,
    blockId: BlockId,
    force: Schema.optional(Position3D),
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("redstone_change"),
    position: Position3D,
    blockId: BlockId,
    powerLevel: pipe(Schema.Number, Schema.int(), Schema.between(0, 15)),
    timestamp: Schema.Number
  })
)
export type BlockUpdateEvent = Schema.Schema.Type<typeof BlockUpdateEvent>

// BlockUpdateServiceインターフェース
interface BlockUpdateService {
  readonly scheduleUpdate: (
    position: Position3D,
    delay: number,
    data?: unknown
  ) => Effect.Effect<void, never>

  readonly processUpdateStream: () => Stream.Stream<BlockUpdateEvent, BlockUpdateError>

  readonly neighborChanged: (
    position: Position3D,
    sourcePosition: Position3D
  ) => Effect.Effect<void, never>

  readonly startRandomTick: (
    position: Position3D,
    tickRate: number
  ) => Effect.Effect<void, never>

  readonly handlePhysicsUpdate: (
    position: Position3D,
    force?: Position3D
  ) => Effect.Effect<void, BlockUpdateError>

  readonly updateRedstoneNetwork: (
    position: Position3D,
    powerLevel: number
  ) => Effect.Effect<void, never>
}

// Context Tag（@minecraft/ネームスペース）
export const BlockUpdateService = Context.GenericTag<BlockUpdateService>("@minecraft/BlockUpdateService")

// Live実装作成関数
const makeBlockUpdateService = Effect.gen(function* () {
  const world = yield* WorldService
  const physics = yield* PhysicsService
  const registry = yield* BlockRegistry
  const updateQueue = yield* Queue.unbounded<BlockUpdateEvent>()

  const scheduleUpdate = (position: Position3D, delay: number, data?: unknown) =>
    Effect.gen(function* () {
      const block = yield* world.getBlock(position)
      yield* Effect.sleep(Duration.millis(delay))
      yield* Queue.offer(updateQueue, {
        _tag: "scheduled_tick",
        position,
        blockId: block.blockType.id,
        delay,
        data,
        timestamp: Date.now()
      })
    }).pipe(Effect.forkDaemon)

  const processUpdateStream = () =>
    Stream.fromQueue(updateQueue).pipe(
      Stream.mapEffect(event => processUpdateEvent(event)),
      Stream.catchAll(error => Stream.succeed(error))
    )

  const processUpdateEvent = (event: BlockUpdateEvent) =>
    Effect.gen(function* () {
      const block = yield* world.getBlock(event.position).pipe(
        Effect.mapError(error => new BlockUpdateError({
          position: event.position,
          updateType: event._tag,
          reason: `Failed to get block: ${error.message}`
        }))
      )

      const definition = yield* registry.get(event.blockId).pipe(
        Effect.mapError(error => new BlockUpdateError({
          position: event.position,
          updateType: event._tag,
          reason: `Block definition not found: ${error.message}`
        }))
      )

      // Match.type による更新タイプ別処理（最新パターン）
      return yield* pipe(
        Match.type<BlockUpdateEvent>(),
        Match.when(
          { _tag: "neighbor_changed" },
          (event) => handleNeighborChange(event.position, event.sourcePosition, definition)
        ),
        Match.when(
          { _tag: "random_tick" },
          (event) => handleRandomTick(event.position, definition, event.tickRate)
        ),
        Match.when(
          { _tag: "scheduled_tick" },
          (event) => handleScheduledTick(event.position, definition, event.data)
        ),
        Match.when(
          { _tag: "physics_tick" },
          (event) => handlePhysicsTick(event.position, definition, event.force)
        ),
        Match.when(
          { _tag: "redstone_change" },
          (event) => handleRedstoneChange(event.position, definition, event.powerLevel)
        ),
        Match.exhaustive
      )(event)
    })

  const neighborChanged = (position: Position3D, sourcePosition: Position3D) =>
    Effect.gen(function* () {
      const block = yield* world.getBlock(position)
      yield* Queue.offer(updateQueue, {
        _tag: "neighbor_changed",
        position,
        sourcePosition,
        blockId: block.blockType.id,
        timestamp: Date.now()
      })
    })

  const startRandomTick = (position: Position3D, tickRate: number) =>
    Effect.gen(function* () {
      const block = yield* world.getBlock(position)
      yield* Queue.offer(updateQueue, {
        _tag: "random_tick",
        position,
        blockId: block.blockType.id,
        tickRate,
        timestamp: Date.now()
      })
    })

  const handlePhysicsUpdate = (position: Position3D, force?: Position3D) =>
    Effect.gen(function* () {
      const block = yield* world.getBlock(position)
      yield* Queue.offer(updateQueue, {
        _tag: "physics_tick",
        position,
        blockId: block.blockType.id,
        force,
        timestamp: Date.now()
      })
    })

  const updateRedstoneNetwork = (position: Position3D, powerLevel: number) =>
    Effect.gen(function* () {
      const block = yield* world.getBlock(position)
      yield* Queue.offer(updateQueue, {
        _tag: "redstone_change",
        position,
        blockId: block.blockType.id,
        powerLevel,
        timestamp: Date.now()
      })
    })

  // 具体的な更新ハンドラー（早期リターンパターン適用）
  const handleNeighborChange = (
    position: Position3D,
    sourcePosition: Position3D,
    definition: BlockDefinition
  ) =>
    Effect.gen(function* () {
      // Match.type によるブロックカテゴリ別処理（最新パターン）
      return yield* pipe(
        Match.type<BlockType>(),
        Match.when(
          { _tag: "solid", material: "sand" },
          () => handleGravityBlock(position, definition)
        ),
        Match.when(
          { _tag: "redstone" },
          (redstone) => handleRedstoneNeighborChange(position, redstone)
        ),
        Match.when(
          { _tag: "fluid" },
          (fluid) => handleFluidFlow(position, fluid)
        ),
        Match.when(
          { _tag: "interactive" },
          (interactive) => handleInteractiveNeighborChange(position, interactive)
        ),
        Match.orElse(() => Effect.void)
      )(definition.blockType)
    })

  const handleRandomTick = (
    position: Position3D,
    definition: BlockDefinition,
    tickRate: number
  ) =>
    Effect.gen(function* () {
      // 早期リターン: ランダムティックが不要なブロック
      if (tickRate <= 0) {
        return
      }

      // Match.type による成長・変化処理
      yield* pipe(
        Match.type<BlockType>(),
        Match.when(
          { _tag: "solid", material: "dirt" },
          () => spreadGrass(position)
        ),
        Match.when(
          { _tag: "transparent", material: "ice" },
          () => Effect.gen(function* () {
            const lightLevel = yield* world.getLightLevel(position)
            // 早期リターン: 光レベルが低い場合は融解しない
            if (lightLevel <= 11) {
              return
            }
            yield* world.setBlock(position, Schema.decodeSync(BlockId)("minecraft:water"))
          })
        ),
        Match.orElse(() => Effect.void)
      )(definition.blockType)
    })

  const handleScheduledTick = (
    position: Position3D,
    definition: BlockDefinition,
    data?: unknown
  ) =>
    Effect.gen(function* () {
      // データの検証
      const validatedData = data ?
        yield* Schema.decodeUnknown(Schema.Unknown)(data) :
        undefined

      // Match.type による遅延処理
      yield* pipe(
        Match.type<BlockType>(),
        Match.when(
          { _tag: "redstone" },
          (redstone) => handleRedstoneScheduledTick(position, redstone, validatedData)
        ),
        Match.when(
          { _tag: "interactive" },
          (interactive) => handleInteractiveScheduledTick(position, interactive, validatedData)
        ),
        Match.orElse(() => Effect.void)
      )(definition.blockType)
    })

  const handlePhysicsTick = (
    position: Position3D,
    definition: BlockDefinition,
    force?: Position3D
  ) =>
    Effect.gen(function* () {
      // Match.type による物理処理
      yield* pipe(
        Match.type<BlockType>(),
        Match.when(
          { _tag: "solid" },
          (solid) => Effect.gen(function* () {
            // 早期リターン: 重力の影響を受けないマテリアル
            if (solid.material === "stone" || solid.material === "metal") {
              return
            }
            yield* handleGravityBlock(position, definition)
          })
        ),
        Match.when(
          { _tag: "fluid" },
          (fluid) => handleFluidPhysics(position, fluid, force)
        ),
        Match.orElse(() => Effect.void)
      )(definition.blockType)
    })

  const handleRedstoneChange = (
    position: Position3D,
    definition: BlockDefinition,
    powerLevel: number
  ) =>
    Effect.gen(function* () {
      // 早期リターン: レッドストーン機器でない場合
      if (definition.blockType._tag !== "redstone") {
        return
      }

      const redstoneBlock = definition.blockType as Extract<BlockType, { _tag: "redstone" }>

      // パワーレベルによる状態更新
      const newState: BlockState = powerLevel > 0 ?
        { _tag: "powered", powered: true, signal: powerLevel } :
        { _tag: "default" }

      yield* world.updateBlockState(position, newState)

      // 隣接ブロックへの伝播
      const neighbors = yield* world.getNeighborPositions(position)
      yield* Effect.all(
        neighbors.map(neighborPos =>
          updateRedstoneNetwork(neighborPos, Math.max(0, powerLevel - 1))
        )
      )
    })

  return BlockUpdateService.of({
    scheduleUpdate,
    processUpdateStream,
    neighborChanged,
    startRandomTick,
    handlePhysicsUpdate,
    updateRedstoneNetwork
  })
  })

// Live Layer
export const BlockUpdateServiceLive = Layer.effect(
  BlockUpdateService,
  makeBlockUpdateService
)
```

## ブロックインタラクションシステム

### ブロックインタラクションサービス

```typescript
// BlockInteractionServiceインターフェース
interface BlockInteractionServiceInterface {
  readonly onBlockPlace: (
    position: WorldPosition,
    block: BlockId,
    placer: PlayerId,
    face: BlockFace
  ) => Effect.Effect<void, PlaceError>

  readonly onBlockBreak: (
    position: WorldPosition,
    breaker: PlayerId,
    tool?: ItemStack
  ) => Effect.Effect<ReadonlyArray<ItemStack>, BreakError>

  readonly onBlockActivate: (
    position: WorldPosition,
    player: PlayerId,
    hand: "main" | "off"
  ) => Effect.Effect<boolean, ActivateError>

  readonly onBlockCollide: (
    position: WorldPosition,
    entity: EntityId,
    velocity: Vector3
  ) => Effect.Effect<void, never>
}

// Context Tag（最新パターン）
export const BlockInteractionService = Context.GenericTag<BlockInteractionServiceInterface>("@app/BlockInteractionService")

// Live実装作成関数
const makeBlockInteractionService = Effect.gen(function* () {
  const world = yield* WorldService
  const registry = yield* BlockRegistry
  const events = yield* EventBus
  const inventory = yield* InventoryService

    const onBlockPlace = (
      position: WorldPosition,
      blockId: BlockId,
      placer: PlayerId,
      face: BlockFace
    ) => Effect.gen(function* () {
      // 配置位置の検証
      const targetPos = getPlacementPosition(position, face)
      const currentBlock = yield* world.getBlock(targetPos)

      // 早期リターン: 置き換え不可能なブロックの場合
      if (!currentBlock.isReplaceable) {
        return yield* Effect.fail(new BlockNotReplaceableError())
      }

      // 早期リターン: エンティティが阻害している場合
      const entities = yield* world.getEntitiesAt(targetPos)
      if (entities.length > 0) {
        return yield* Effect.fail(new EntityObstructionError())
      }

      // ブロック配置
      const definition = yield* registry.get(blockId)
      const state = getStateForPlacement(definition, position, face, placer)

      yield* world.setBlock(targetPos, blockId, state)

      // イベント発行
      yield* events.publish({
        type: "block_placed",
        position: targetPos,
        block: blockId,
        placer,
        timestamp: Date.now()
      })

      // 隣接ブロックに更新通知
      yield* notifyNeighbors(targetPos)
    })

    const onBlockBreak = (
      position: WorldPosition,
      breaker: PlayerId,
      tool?: ItemStack
    ) => Effect.gen(function* () {
      const block = yield* world.getBlock(position)
      const definition = yield* registry.get(block.id)

      // 早期リターン: 破壊不可能なブロックの場合
      if (definition.hardness < 0) {
        return yield* Effect.fail(new UnbreakableBlockError())
      }

      // 早期リターン: 不適切なツールの場合（ドロップなし）
      if (definition.toolRequired && (!tool || !isCorrectTool(tool, definition))) {
        yield* world.setBlock(position, "minecraft:air" as BlockId)
        return []
      }

      // ドロップ計算
      const drops = calculateDrops(definition, tool)

      // ブロック削除
      yield* world.setBlock(position, "minecraft:air" as BlockId)

      // イベント発行
      yield* events.publish({
        type: "block_broken",
        position,
        block: block.id,
        breaker,
        drops,
        timestamp: Date.now()
      })

      // 隣接ブロックに更新通知
      yield* notifyNeighbors(position)

      return drops
    })

    const onBlockActivate = (
      position: WorldPosition,
      player: PlayerId,
      hand: "main" | "off"
    ) => Effect.gen(function* () {
      const block = yield* world.getBlock(position)
      const definition = yield* registry.get(block.id)

      // Match.value パターンによるインタラクティブブロック処理（最新パターン）
      return yield* pipe(
        Match.value(block.id),
        Match.when(
          Schema.decodeSync(BlockId)("minecraft:chest"),
          () => Effect.gen(function* () {
            yield* openContainer(position, player)
            return true
          })
        ),
        Match.when(
          Schema.decodeSync(BlockId)("minecraft:crafting_table"),
          () => Effect.gen(function* () {
            yield* openCraftingInterface(player)
            return true
          })
        ),
        Match.when(
          (id) => id === Schema.decodeSync(BlockId)("minecraft:door") ||
                  id === Schema.decodeSync(BlockId)("minecraft:trapdoor"),
          () => Effect.gen(function* () {
            yield* toggleDoor(position)
            return true
          })
        ),
        Match.when(
          (id) => id === Schema.decodeSync(BlockId)("minecraft:lever") ||
                  id === Schema.decodeSync(BlockId)("minecraft:button"),
          () => Effect.gen(function* () {
            yield* toggleRedstone(position)
            return true
          })
        ),
        Match.orElse(() => Effect.succeed(false))
      )
    })

    const onBlockCollide = (
      position: WorldPosition,
      entity: EntityId,
      velocity: Vector3
    ) => Effect.gen(function* () {
      const block = yield* world.getBlock(position)

      // Match.value パターンによる特殊ブロック衝突処理
      yield* pipe(
        Match.value(block.id),
        Match.when(
          Schema.decodeSync(BlockId)("minecraft:slime_block"),
          () => bounceEntity(entity, velocity)
        ),
        Match.when(
          Schema.decodeSync(BlockId)("minecraft:soul_sand"),
          () => slowEntity(entity)
        ),
        Match.when(
          Schema.decodeSync(BlockId)("minecraft:cactus"),
          () => damageEntity(entity, 1)
        ),
        Match.when(
          Schema.decodeSync(BlockId)("minecraft:lava"),
          () => burnEntity(entity)
        ),
        Match.orElse(() => Effect.void)
      )
    })

    return BlockInteractionService.of({ onBlockPlace, onBlockBreak, onBlockActivate, onBlockCollide })
  })

// Live Layer
export const BlockInteractionServiceLive = Layer.effect(
  BlockInteractionService,
  makeBlockInteractionService
)
```

## ブロックレンダリング

### ブロックメッシュ生成

```typescript
// BlockMeshServiceインターフェース
interface BlockMeshServiceInterface {
  readonly generateMesh: (
    block: BlockDefinition,
    state: BlockState,
    neighbors: NeighborBlocks
  ) => Effect.Effect<BlockMesh, never>

  readonly generateChunkMesh: (
    chunk: Chunk
  ) => Effect.Effect<ChunkMesh, never>

  readonly updateMesh: (
    position: WorldPosition
  ) => Effect.Effect<void, never>
}

// Context Tag（最新パターン）
export const BlockMeshService = Context.GenericTag<BlockMeshServiceInterface>("@app/BlockMeshService")

// Live実装
export const BlockMeshServiceLive = Layer.succeed(
  BlockMeshService,
  BlockMeshService.of({
    generateMesh: (block, state, neighbors) =>
      Effect.gen(function* () {
        const vertices: number[] = []
        const uvs: number[] = []
        const normals: number[] = []
        const indices: number[] = []

        // 各面の可視性チェック
        const faces = {
          top: !neighbors.top || neighbors.top.isTransparent,
          bottom: !neighbors.bottom || neighbors.bottom.isTransparent,
          north: !neighbors.north || neighbors.north.isTransparent,
          south: !neighbors.south || neighbors.south.isTransparent,
          east: !neighbors.east || neighbors.east.isTransparent,
          west: !neighbors.west || neighbors.west.isTransparent
        }

        // 可視面のメッシュ生成
        if (faces.top) addFace(vertices, uvs, normals, indices, "top", block)
        if (faces.bottom) addFace(vertices, uvs, normals, indices, "bottom", block)
        if (faces.north) addFace(vertices, uvs, normals, indices, "north", block)
        if (faces.south) addFace(vertices, uvs, normals, indices, "south", block)
        if (faces.east) addFace(vertices, uvs, normals, indices, "east", block)
        if (faces.west) addFace(vertices, uvs, normals, indices, "west", block)

        return {
          vertices: new Float32Array(vertices),
          uvs: new Float32Array(uvs),
          normals: new Float32Array(normals),
          indices: new Uint16Array(indices)
        }
      }),

    generateChunkMesh: (chunk) =>
      Effect.gen(function* () {
        // グリーディメッシング最適化
        const meshData = yield* greedyMeshing(chunk)
        return createOptimizedMesh(meshData)
      }),

    updateMesh: (position) =>
      Effect.gen(function* () {
        const chunkCoord = worldToChunkCoord(position)
        const chunk = yield* ChunkManager.getChunk(chunkCoord)
        const mesh = yield* generateChunkMesh(chunk)
        yield* RenderingService.updateChunkMesh(chunkCoord, mesh)
      })
  })
)
```

## 完全なブロックシステムレイヤー

```typescript
export const BlockSystemLayer = Layer.mergeAll(
  BlockRegistryLive,
  BlockUpdateServiceLive,
  BlockInteractionServiceLive,
  BlockMeshServiceLive
).pipe(
  Layer.provide(WorldServiceLive),
  Layer.provide(PhysicsServiceLive),
  Layer.provide(EventBusLive),
  Layer.provide(InventoryServiceLive),
  Layer.provide(ChunkManagerLive),
  Layer.provide(RenderingServiceLive)
)
```

## ブロック物理システム

### 物理エンジン統合

```typescript
// ブロック物理システム
interface BlockPhysicsServiceInterface {
  readonly processGravity: (
    position: WorldPosition
  ) => Effect.Effect<void, PhysicsError>

  readonly simulateFluidFlow: (
    position: WorldPosition,
    fluidType: "water" | "lava"
  ) => Effect.Effect<void, FluidError>

  readonly handleExplosion: (
    center: WorldPosition,
    power: number,
    createFire: boolean
  ) => Effect.Effect<void, ExplosionError>

  readonly processBlockFalling: (
    position: WorldPosition
  ) => Effect.Effect<void, never>
}

// Context Tag（最新パターン）
export const BlockPhysicsService = Context.GenericTag<BlockPhysicsServiceInterface>("@app/BlockPhysicsService")

// Live実装
const makeBlockPhysicsService = Effect.gen(function* () {
  const world = yield* WorldService
  const entity = yield* EntityService
  const particle = yield* ParticleService

  const processGravity = (position: WorldPosition) =>
    Effect.gen(function* () {
      const block = yield* world.getBlock(position)

      // 重力の影響を受けるブロックかチェック
      if (!isGravityAffected(block.id)) {
        return
      }

      const below = { ...position, y: position.y - 1 }
      const blockBelow = yield* world.getBlock(below)

      // 下に空間があるかチェック
      if (!blockBelow || blockBelow.id === "minecraft:air" || isFluid(blockBelow.id)) {
        // 落下エンティティを作成
        yield* createFallingBlock(position, block)
        yield* world.setBlock(position, "minecraft:air" as BlockId)
      }
    })

  const simulateFluidFlow = (position: WorldPosition, fluidType: "water" | "lava") =>
    Effect.gen(function* () {
      const currentBlock = yield* world.getBlock(position)

      // 流体レベルを取得
      const currentLevel = getFluidLevel(currentBlock)

      // 隣接ブロックへの流れをシミュレート
      const neighbors = yield* getNeighborPositions(position)

      for (const neighborPos of neighbors) {
        const neighbor = yield* world.getBlock(neighborPos)

        // 流れる条件をチェック
        if (canFluidFlowTo(currentBlock, neighbor, fluidType)) {
          const targetLevel = calculateFlowLevel(currentLevel, neighbor)

          // 新しい流体ブロックを配置
          yield* placeFluidBlock(neighborPos, fluidType, targetLevel)

          // 下向きの流れを優先
          if (neighborPos.y < position.y) {
            yield* scheduleFluidUpdate(neighborPos, 2) // 2tick後
          } else {
            yield* scheduleFluidUpdate(neighborPos, 5) // 5tick後
          }
        }
      }

      // 流体の更新を継続するかチェック
      if (shouldContinueFlow(currentLevel)) {
        yield* scheduleFluidUpdate(position, getFluidTickRate(fluidType))
      }
    })

  const handleExplosion = (center: WorldPosition, power: number, createFire: boolean) =>
    Effect.gen(function* () {
      const affectedPositions = calculateExplosionSphere(center, power)

      for (const pos of affectedPositions) {
        const distance = calculateDistance(center, pos)
        const intensity = calculateExplosionIntensity(power, distance)

        const block = yield* world.getBlock(pos)

        // ブロックの爆発耐性チェック
        if (block.properties.resistance < intensity) {
          // ブロックを破壊
          yield* world.setBlock(pos, "minecraft:air" as BlockId)

          // ドロップアイテムを生成（確率的）
          const dropChance = 1.0 / power // 爆発力に反比例
          if (Math.random() < dropChance) {
            yield* spawnBlockDrops(pos, block)
          }

          // 火を設置（TNT等）
          if (createFire && Math.random() < 0.3) {
            yield* maybeSetFire(pos)
          }

          // 爆発パーティクルを生成
          yield* particle.spawn({
            type: "explosion",
            position: pos,
            velocity: calculateExplosionVelocity(center, pos, intensity),
            lifetime: 30
          })
        }
      }

      // 爆発音の再生
      yield* playExplosionSound(center, power)
    })

  const processBlockFalling = (position: WorldPosition) =>
    Effect.gen(function* () {
      const block = yield* world.getBlock(position)

      // 落下ブロック（砂、砂利等）の処理
      const fallDistance = yield* calculateFallDistance(position)

      if (fallDistance > 0) {
        const landingPos = { ...position, y: position.y - fallDistance }

        // 着地処理
        const landingBlock = yield* world.getBlock(landingPos)

        if (landingBlock.id === "minecraft:air") {
          // 通常の着地
          yield* world.setBlock(landingPos, block.id)
          yield* world.setBlock(position, "minecraft:air" as BlockId)
        } else if (isBreakableByFalling(landingBlock.id)) {
          // 既存ブロックを破壊して着地
          const drops = yield* calculateBlockDrops(landingPos, landingBlock)
          yield* spawnItems(landingPos, drops)
          yield* world.setBlock(landingPos, block.id)
          yield* world.setBlock(position, "minecraft:air" as BlockId)
        }

        // 落下音を再生
        yield* playSoundEffect(landingPos, "block.sand.fall")
      }
    })

  return BlockPhysicsService.of({
    processGravity,
    simulateFluidFlow,
    handleExplosion,
    processBlockFalling
  })
})

// 重力の影響を受けるブロック判定（最新パターン）
const isGravityAffected = (blockId: BlockId): boolean =>
  pipe(
    Match.value(blockId),
    Match.when(Schema.decodeSync(BlockId)("minecraft:sand"), () => true),
    Match.when(Schema.decodeSync(BlockId)("minecraft:gravel"), () => true),
    Match.when(Schema.decodeSync(BlockId)("minecraft:anvil"), () => true),
    Match.when(Schema.decodeSync(BlockId)("minecraft:concrete_powder"), () => true),
    Match.orElse(() => false)
  )

// 流体レベル計算
const calculateFlowLevel = (sourceLevel: number, targetBlock: BlockDefinition): number => {
  if (targetBlock.id === "minecraft:air") {
    return Math.max(0, sourceLevel - 1)
  }
  return 0
}

// 爆発範囲計算（球体）
const calculateExplosionSphere = (center: WorldPosition, radius: number): WorldPosition[] => {
  const positions: WorldPosition[] = []
  const radiusSquared = radius * radius

  for (let x = -radius; x <= radius; x++) {
    for (let y = -radius; y <= radius; y++) {
      for (let z = -radius; z <= radius; z++) {
        const distanceSquared = x * x + y * y + z * z

        if (distanceSquared <= radiusSquared) {
          positions.push({
            x: center.x + x,
            y: center.y + y,
            z: center.z + z
          })
        }
      }
    }
  }

  return positions
}

// Live Layer
export const BlockPhysicsServiceLive = Layer.effect(
  BlockPhysicsService,
  makeBlockPhysicsService
)
```

## レッドストーンシステム基盤

### レッドストーン信号処理

```typescript
// レッドストーン信号システム
interface RedstoneServiceInterface {
  readonly calculatePower: (
    position: WorldPosition
  ) => Effect.Effect<number, never>

  readonly propagatePower: (
    source: WorldPosition,
    power: number
  ) => Effect.Effect<void, never>

  readonly updateNetwork: (
    position: WorldPosition
  ) => Effect.Effect<void, never>

  readonly isRedstoneComponent: (
    blockId: BlockId
  ) => boolean

  readonly isPowered: (
    position: WorldPosition
  ) => Effect.Effect<boolean, never>
}

// Context Tag（最新パターン）
export const RedstoneService = Context.GenericTag<RedstoneServiceInterface>("@app/RedstoneService")

// Live実装
const makeRedstoneService = Effect.gen(function* () {
  const world = yield* WorldService
  const powerCache = yield* Ref.make(new Map<string, number>())

  const calculatePower = (position: WorldPosition) =>
    Effect.gen(function* () {
      const posKey = positionToKey(position)
      const cached = yield* Ref.get(powerCache)

      // キャッシュから取得
      if (cached.has(posKey)) {
        return cached.get(posKey)!
      }

      const block = yield* world.getBlock(position)
      let maxPower = 0

      // ダイレクト電源チェック（レッドストーントーチ、レバー等）
      if (isDirectPowerSource(block.id)) {
        maxPower = getDirectPowerLevel(block)
      } else {
        // 隣接ブロックからの電力を計算
        const neighbors = getNeighborPositions(position)

        for (const neighborPos of neighbors) {
          const neighbor = yield* world.getBlock(neighborPos)

          if (isRedstoneComponent(neighbor.id)) {
            const neighborPower = yield* calculateNeighborPower(neighborPos, neighbor)
            maxPower = Math.max(maxPower, neighborPower - 1)
          }
        }
      }

      // 最大15に制限
      maxPower = Math.min(15, Math.max(0, maxPower))

      // キャッシュに保存
      yield* Ref.update(powerCache, cache =>
        new Map(cache).set(posKey, maxPower)
      )

      return maxPower
    })

  const propagatePower = (source: WorldPosition, power: number) =>
    Effect.gen(function* () {
      const visited = new Set<string>()
      const queue = [{ position: source, power }]

      while (queue.length > 0) {
        const current = queue.shift()!
        const posKey = positionToKey(current.position)

        if (visited.has(posKey) || current.power <= 0) {
          continue
        }

        visited.add(posKey)

        const neighbors = getRedstoneNeighbors(current.position)

        for (const neighborPos of neighbors) {
          const neighbor = yield* world.getBlock(neighborPos)

          if (canTransmitPower(neighbor.id)) {
            const newPower = current.power - 1

            if (newPower > 0) {
              queue.push({ position: neighborPos, power: newPower })

              // レッドストーン機器の状態更新
              yield* updateRedstoneDevice(neighborPos, newPower)
            }
          }
        }
      }
    })

  const updateNetwork = (position: WorldPosition) =>
    Effect.gen(function* () {
      // キャッシュをクリア
      yield* Ref.set(powerCache, new Map())

      const block = yield* world.getBlock(position)

      // レッドストーン機器の動作判定
      const power = yield* calculatePower(position)
      const wasPowered = block.state.powered || false
      const nowPowered = power > 0

      // 状態変化があった場合のみ更新
      if (wasPowered !== nowPowered) {
        yield* world.updateBlockState(position, { powered: nowPowered })

        // 機器固有の処理
        yield* handleRedstoneDeviceUpdate(position, block.id, nowPowered)

        // 隣接ブロックに更新を伝播
        const neighbors = getNeighborPositions(position)
        for (const neighborPos of neighbors) {
          yield* BlockUpdateService.neighborChanged(neighborPos, position)
        }
      }
    })

  const isRedstoneComponent = (blockId: BlockId): boolean =>
    pipe(
      Match.value(blockId),
      Match.when(Schema.decodeSync(BlockId)("minecraft:redstone_wire"), () => true),
      Match.when(Schema.decodeSync(BlockId)("minecraft:redstone_torch"), () => true),
      Match.when(Schema.decodeSync(BlockId)("minecraft:lever"), () => true),
      Match.when(Schema.decodeSync(BlockId)("minecraft:button"), () => true),
      Match.when(Schema.decodeSync(BlockId)("minecraft:pressure_plate"), () => true),
      Match.when(Schema.decodeSync(BlockId)("minecraft:tripwire_hook"), () => true),
      Match.when(Schema.decodeSync(BlockId)("minecraft:observer"), () => true),
      Match.when(Schema.decodeSync(BlockId)("minecraft:dispenser"), () => true),
      Match.when(Schema.decodeSync(BlockId)("minecraft:dropper"), () => true),
      Match.when(Schema.decodeSync(BlockId)("minecraft:piston"), () => true),
      Match.orElse(() => false)
    )

  const isPowered = (position: WorldPosition) =>
    Effect.gen(function* () {
      const power = yield* calculatePower(position)
      return power > 0
    })

  // レッドストーン機器の状態更新
  const handleRedstoneDeviceUpdate = (
    position: WorldPosition,
    blockId: BlockId,
    powered: boolean
  ) =>
    pipe(
      Match.value(blockId),
      Match.when(
        Schema.decodeSync(BlockId)("minecraft:piston"),
        () => powered ? extendPiston(position) : retractPiston(position)
      ),
      Match.when(
        Schema.decodeSync(BlockId)("minecraft:dispenser"),
        () => powered ? activateDispenser(position) : Effect.unit
      ),
      Match.when(
        Schema.decodeSync(BlockId)("minecraft:redstone_lamp"),
        () => setLampState(position, powered)
      ),
      Match.orElse(() => Effect.unit)
    )

  return RedstoneService.of({
    calculatePower,
    propagatePower,
    updateNetwork,
    isRedstoneComponent,
    isPowered
  })
})

// ヘルパー関数
const positionToKey = (pos: WorldPosition): string => `${pos.x},${pos.y},${pos.z}`

const isDirectPowerSource = (blockId: BlockId): boolean =>
  Match.value(blockId).pipe(
    Match.when("minecraft:redstone_torch", () => true),
    Match.when("minecraft:lever", () => true),
    Match.when("minecraft:button", () => true),
    Match.orElse(() => false)
  )

const getDirectPowerLevel = (block: BlockDefinition): number =>
  Match.value(block.id).pipe(
    Match.when("minecraft:redstone_torch", () => 15),
    Match.when("minecraft:lever", () => block.state.powered ? 15 : 0),
    Match.when("minecraft:button", () => block.state.powered ? 15 : 0),
    Match.orElse(() => 0)
  )

// Live Layer
export const RedstoneServiceLive = Layer.effect(
  RedstoneService,
  makeRedstoneService
)
```

## ブロックレンダリング最適化

### 高度なメッシュ生成

```typescript
// 高度なメッシュ生成最適化
interface BlockRenderingServiceInterface {
  readonly generateOptimizedMesh: (
    chunk: Chunk
  ) => Effect.Effect<OptimizedMesh, never>

  readonly applyCulling: (
    block: BlockDefinition,
    neighbors: NeighborBlocks
  ) => CullingResult

  readonly generateLODMesh: (
    chunk: Chunk,
    distance: number
  ) => Effect.Effect<LODMesh, never>

  readonly batchMeshGeneration: (
    chunks: ReadonlyArray<Chunk>
  ) => Effect.Effect<ReadonlyArray<OptimizedMesh>, never>
}

// Context Tag（最新パターン）
export const BlockRenderingService = Context.GenericTag<BlockRenderingServiceInterface>("@app/BlockRenderingService")

// 最適化されたメッシュ生成
const makeBlockRenderingService = Effect.gen(function* () {
  const generateOptimizedMesh = (chunk: Chunk) =>
    Effect.gen(function* () {
      // グリーディメッシング最適化
      const greedyMesh = yield* greedyMeshing(chunk)

      // 面結合最適化
      const mergedMesh = yield* mergeFaces(greedyMesh)

      // バーテックス最適化
      const optimizedVertices = yield* optimizeVertices(mergedMesh)

      // インデックス生成
      const indices = generateIndices(optimizedVertices)

      return {
        vertices: optimizedVertices,
        indices,
        materialGroups: extractMaterialGroups(optimizedVertices),
        boundingBox: calculateBoundingBox(optimizedVertices)
      }
    })

  const applyCulling = (block: BlockDefinition, neighbors: NeighborBlocks): CullingResult => {
    const visibleFaces: BlockFace[] = []

    // 各面の可視性判定
    if (!neighbors.top || neighbors.top.isTransparent) visibleFaces.push("top")
    if (!neighbors.bottom || neighbors.bottom.isTransparent) visibleFaces.push("bottom")
    if (!neighbors.north || neighbors.north.isTransparent) visibleFaces.push("north")
    if (!neighbors.south || neighbors.south.isTransparent) visibleFaces.push("south")
    if (!neighbors.east || neighbors.east.isTransparent) visibleFaces.push("east")
    if (!neighbors.west || neighbors.west.isTransparent) visibleFaces.push("west")

    return {
      visibleFaces,
      shouldRender: visibleFaces.length > 0,
      isCompletelyHidden: visibleFaces.length === 0
    }
  }

  const generateLODMesh = (chunk: Chunk, distance: number) =>
    Effect.gen(function* () {
      // 距離に基づくLODレベル決定
      const lodLevel = calculateLODLevel(distance)

      switch (lodLevel) {
        case 0: // 高詳細（近距離）
          return yield* generateOptimizedMesh(chunk)

        case 1: // 中詳細
          const simplifiedChunk = yield* simplifyChunk(chunk, 0.7)
          return yield* generateOptimizedMesh(simplifiedChunk)

        case 2: // 低詳細（遠距離）
          const verySimplifiedChunk = yield* simplifyChunk(chunk, 0.4)
          return yield* generateOptimizedMesh(verySimplifiedChunk)

        default:
          // 非常に遠距離 - インポスター使用
          return yield* generateImpostor(chunk)
      }
    })

  const batchMeshGeneration = (chunks: ReadonlyArray<Chunk>) =>
    Effect.gen(function* () {
      // パラレル処理でメッシュ生成
      return yield* Effect.all(
        chunks.map(chunk => generateOptimizedMesh(chunk)),
        { concurrency: 4 } // CPU コア数に応じて調整
      )
    })

  return BlockRenderingService.of({
    generateOptimizedMesh,
    applyCulling,
    generateLODMesh,
    batchMeshGeneration
  })
})

// グリーディメッシング実装
const greedyMeshing = (chunk: Chunk): Effect.Effect<GreedyMesh, never> =>
  Effect.gen(function* () {
    const faces: Face[] = []
    const processed = new Set<string>()

    // X軸方向のスライス
    for (let x = 0; x <= 16; x++) {
      const mask = new Array<BlockType | null>(16 * 16).fill(null)

      for (let y = 0; y < 16; y++) {
        for (let z = 0; z < 16; z++) {
          const pos1 = { x: x - 1, y, z }
          const pos2 = { x, y, z }

          const block1 = x > 0 ? chunk.getBlock(pos1) : null
          const block2 = x < 16 ? chunk.getBlock(pos2) : null

          if (shouldCreateFace(block1, block2)) {
            mask[y * 16 + z] = block1 || block2
          }
        }
      }

      // マスクから面を生成
      const generatedFaces = yield* generateFacesFromMask(mask, "x", x)
      faces.push(...generatedFaces)
    }

    // Y軸、Z軸方向も同様に処理...

    return { faces, vertexCount: faces.length * 4 }
  })

// 頂点最適化
const optimizeVertices = (mesh: GreedyMesh): Effect.Effect<Float32Array, never> =>
  Effect.gen(function* () {
    const vertices: number[] = []
    const vertexMap = new Map<string, number>()

    for (const face of mesh.faces) {
      for (const vertex of face.vertices) {
        const key = `${vertex.x},${vertex.y},${vertex.z}`

        if (!vertexMap.has(key)) {
          vertexMap.set(key, vertices.length / 3)
          vertices.push(vertex.x, vertex.y, vertex.z)
        }
      }
    }

    return new Float32Array(vertices)
  })

// Live Layer
export const BlockRenderingServiceLive = Layer.effect(
  BlockRenderingService,
  makeBlockRenderingService
)
```

## パフォーマンス最適化 & メモリ管理

### メモリ効率の良いブロック管理

```typescript
// パフォーマンス最適化とメモリ管理
interface BlockPerformanceServiceInterface {
  readonly optimizeMemoryUsage: () => Effect.Effect<MemoryStats, never>
  readonly preloadBlocks: (region: WorldRegion) => Effect.Effect<void, never>
  readonly unloadUnusedBlocks: () => Effect.Effect<number, never>
  readonly getPerformanceMetrics: () => Effect.Effect<PerformanceMetrics, never>
  readonly enableCaching: (cacheSize: number) => Effect.Effect<void, never>
}

// Context Tag（最新パターン）
export const BlockPerformanceService = Context.GenericTag<BlockPerformanceServiceInterface>("@app/BlockPerformanceService")

// 高性能実装
const makeBlockPerformanceService = Effect.gen(function* () {
  // Structure of Arrays (SoA) による最適化
  const blockIds = yield* Ref.make(new Uint16Array(16 * 16 * 16 * 1000)) // 1000チャンク分
  const blockStates = yield* Ref.make(new Uint8Array(16 * 16 * 16 * 1000))
  const lightLevels = yield* Ref.make(new Uint8Array(16 * 16 * 16 * 1000))

  // LRU キャッシュ
  const meshCache = yield* Ref.make(new Map<string, CachedMesh>())
  const blockDataCache = yield* Ref.make(new Map<string, BlockData>())

  // パフォーマンス計測
  const performanceMetrics = yield* Ref.make({
    meshGenerationTime: 0,
    blockUpdateTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    renderTime: 0
  })

  const optimizeMemoryUsage = () =>
    Effect.gen(function* () {
      // ガベージコレクション実行
      yield* forceGarbageCollection()

      // 未使用メッシュキャッシュの削除
      yield* cleanupMeshCache()

      // ブロックデータの圧縮
      const compressedSize = yield* compressBlockData()

      // メモリ使用量計測
      const memoryUsage = yield* measureMemoryUsage()

      return {
        totalMemory: memoryUsage.total,
        usedMemory: memoryUsage.used,
        blockMemory: compressedSize,
        cacheMemory: yield* calculateCacheMemory(),
        meshMemory: yield* calculateMeshMemory()
      }
    })

  const preloadBlocks = (region: WorldRegion) =>
    Effect.gen(function* () {
      const chunks = getChunksInRegion(region)

      // 並列でブロックデータをプリロード
      yield* Effect.all(
        chunks.map(chunkPos =>
          Effect.gen(function* () {
            const chunk = yield* ChunkManager.getChunk(chunkPos)
            const mesh = yield* BlockRenderingService.generateOptimizedMesh(chunk)

            // キャッシュに保存
            const cacheKey = chunkPositionToKey(chunkPos)
            yield* Ref.update(meshCache, cache =>
              new Map(cache).set(cacheKey, {
                mesh,
                lastAccessed: Date.now(),
                accessCount: 1
              })
            )
          })
        ),
        { concurrency: 8 }
      )
    })

  const unloadUnusedBlocks = () =>
    Effect.gen(function* () {
      const currentTime = Date.now()
      const unloadThreshold = 5 * 60 * 1000 // 5分間未使用

      let unloadedCount = 0

      // メッシュキャッシュのクリーンアップ
      yield* Ref.update(meshCache, cache => {
        const newCache = new Map<string, CachedMesh>()

        for (const [key, cachedMesh] of cache.entries()) {
          if (currentTime - cachedMesh.lastAccessed < unloadThreshold) {
            newCache.set(key, cachedMesh)
          } else {
            unloadedCount++
          }
        }

        return newCache
      })

      // ブロックデータキャッシュのクリーンアップ
      yield* Ref.update(blockDataCache, cache => {
        const newCache = new Map<string, BlockData>()

        for (const [key, blockData] of cache.entries()) {
          if (currentTime - blockData.lastAccessed < unloadThreshold) {
            newCache.set(key, blockData)
          } else {
            unloadedCount++
          }
        }

        return newCache
      })

      return unloadedCount
    })

  const getPerformanceMetrics = () =>
    Effect.gen(function* () {
      const metrics = yield* Ref.get(performanceMetrics)
      const memoryStats = yield* optimizeMemoryUsage()
      const cacheStats = yield* calculateCacheStats()

      return {
        ...metrics,
        memoryStats,
        cacheStats,
        timestamp: Date.now()
      }
    })

  const enableCaching = (cacheSize: number) =>
    Effect.gen(function* () {
      // キャッシュサイズの設定
      yield* Ref.set(meshCache, new Map())
      yield* Ref.set(blockDataCache, new Map())

      // バックグラウンドでキャッシュクリーンアップを実行
      yield* Effect.forkDaemon(
        Effect.gen(function* () {
          yield* Effect.forever(
            Effect.gen(function* () {
              yield* Effect.sleep(Duration.seconds(30))
              yield* cleanupCacheIfNeeded(cacheSize)
            })
          )
        })
      )
    })

  // バッチ処理による高速化
  const batchBlockUpdates = (updates: BlockUpdate[]) =>
    Effect.gen(function* () {
      const startTime = performance.now()

      // 更新を種類別にグループ化
      const groupedUpdates = groupUpdatesByType(updates)

      // 各グループを並列処理
      yield* Effect.all([
        processMeshUpdates(groupedUpdates.mesh || []),
        processPhysicsUpdates(groupedUpdates.physics || []),
        processRedstoneUpdates(groupedUpdates.redstone || [])
      ])

      const endTime = performance.now()

      // パフォーマンス指標更新
      yield* Ref.update(performanceMetrics, metrics => ({
        ...metrics,
        blockUpdateTime: endTime - startTime
      }))
    })

  // SIMD最適化（TypedArray使用）
  const optimizedBlockProcessing = (blockData: Uint16Array) =>
    Effect.gen(function* () {
      // 16要素ずつ処理してSIMD最適化を活用
      const batchSize = 16
      const results = new Uint16Array(blockData.length)

      for (let i = 0; i < blockData.length; i += batchSize) {
        const batch = blockData.slice(i, Math.min(i + batchSize, blockData.length))
        const processed = processBatchOptimized(batch)
        results.set(processed, i)
      }

      return results
    })

  return BlockPerformanceService.of({
    optimizeMemoryUsage,
    preloadBlocks,
    unloadUnusedBlocks,
    getPerformanceMetrics,
    enableCaching
  })
})

// ヘルパー関数
const forceGarbageCollection = (): Effect.Effect<void, never> =>
  Effect.sync(() => {
    // WebWorkerでGCを促進
    if (typeof window !== "undefined" && window.gc) {
      window.gc()
    }
  })

const compressBlockData = (): Effect.Effect<number, never> =>
  Effect.sync(() => {
    // ブロックデータの圧縮実装
    // Run-Length Encoding等を使用
    return 0 // 圧縮後のサイズを返す
  })

const calculateCacheStats = (): Effect.Effect<CacheStats, never> =>
  Effect.sync(() => ({
    hitRate: 0.85,
    missRate: 0.15,
    totalRequests: 10000,
    cacheSize: 256 * 1024 * 1024 // 256MB
  }))

// Live Layer
export const BlockPerformanceServiceLive = Layer.effect(
  BlockPerformanceService,
  makeBlockPerformanceService
)

// 完全なBlock System Layer（拡張版）
export const CompleteBlockSystemLayer = Layer.mergeAll(
  BlockRegistryLive,
  BlockUpdateServiceLive,
  BlockInteractionServiceLive,
  BlockMeshServiceLive,
  BlockPhysicsServiceLive,
  RedstoneServiceLive,
  BlockRenderingServiceLive,
  BlockPerformanceServiceLive
).pipe(
  Layer.provide(WorldServiceLive),
  Layer.provide(PhysicsServiceLive),
  Layer.provide(EventBusLive),
  Layer.provide(InventoryServiceLive),
  Layer.provide(ChunkManagerLive),
  Layer.provide(RenderingServiceLive),
  Layer.provide(EntityServiceLive),
  Layer.provide(ParticleServiceLive)
)
```

## プロパティベーステスト対応

### Fast-Check統合テストパターン

```typescript
import { it } from "@effect/vitest"
import { Arbitrary } from "fast-check"
import { Schema } from "effect"

// ブロック定義のArbitrary生成
const blockDefinitionArbitrary: Arbitrary<BlockDefinition> = Arbitrary.record({
  blockType: Arbitrary.oneof(
    // Solid Block
    Arbitrary.record({
      blockCategory: Arbitrary.constant("solid" as const),
      id: Arbitrary.string().map(s => Schema.decodeSync(BlockId)(`minecraft:${s.toLowerCase()}`)),
      name: Arbitrary.string(),
      physics: blockPhysicsArbitrary,
      material: Arbitrary.constantFrom("stone", "wood", "metal", "dirt", "sand"),
      toolRequired: Arbitrary.option(Arbitrary.constantFrom("pickaxe", "axe", "shovel")),
      harvestLevel: Arbitrary.option(Arbitrary.integer({ min: 0, max: 4 }))
    }),
    // Fluid Block
    Arbitrary.record({
      blockCategory: Arbitrary.constant("fluid" as const),
      id: Arbitrary.string().map(s => Schema.decodeSync(BlockId)(`minecraft:${s.toLowerCase()}`)),
      name: Arbitrary.string(),
      physics: blockPhysicsArbitrary,
      viscosity: Arbitrary.float({ min: 0.1, max: 10.0 }),
      flowRate: Arbitrary.integer({ min: 1, max: 8 })
    })
  ),
  defaultState: blockStateArbitrary,
  boundingBox: Arbitrary.record({
    min: position3DArbitrary,
    max: position3DArbitrary
  }),
  placementRules: blockPlacementRuleArbitrary,
  drops: Arbitrary.array(blockDropArbitrary),
  soundType: Arbitrary.constantFrom("stone", "wood", "gravel", "grass", "metal")
})

// 物理プロパティのArbitrary
const blockPhysicsArbitrary: Arbitrary<BlockPhysics> = Arbitrary.record({
  hardness: Arbitrary.float({ min: 0, max: 100 }),
  resistance: Arbitrary.float({ min: 0, max: 1000 }),
  luminance: Arbitrary.integer({ min: 0, max: 15 }),
  opacity: Arbitrary.integer({ min: 0, max: 15 }),
  slipperiness: Arbitrary.float({ min: 0.4, max: 1.0 })
}).map(data => Schema.decodeSync(BlockPhysics)(data))

// Position3DのArbitrary
const position3DArbitrary: Arbitrary<Position3D> = Arbitrary.record({
  x: Arbitrary.integer({ min: -1000, max: 1000 }),
  y: Arbitrary.integer({ min: -64, max: 320 }),
  z: Arbitrary.integer({ min: -1000, max: 1000 })
}).map(data => Schema.decodeSync(Position3D)(data))

// ブロック状態のArbitrary
const blockStateArbitrary: Arbitrary<BlockState> = Arbitrary.oneof(
  Arbitrary.record({
    stateType: Arbitrary.constant("directional" as const),
    facing: Arbitrary.constantFrom("north", "south", "east", "west", "up", "down")
  }),
  Arbitrary.record({
    stateType: Arbitrary.constant("powered" as const),
    powered: Arbitrary.boolean(),
    signal: Arbitrary.integer({ min: 0, max: 15 })
  }),
  Arbitrary.record({
    stateType: Arbitrary.constant("default" as const)
  })
).map(data => Schema.decodeSync(BlockState)(data))

// プロパティベーステストスイート
describe("Block System Properties", () => {
  it.prop("ブロック登録は常に成功するか一意性エラーのみ", [blockDefinitionArbitrary])(
    (blockDef) => Effect.gen(function* () {
      const registry = yield* BlockRegistry

      const result = yield* registry.register(blockDef).pipe(
        Effect.either
      )

      // プロパティ: 登録は成功するか、既に存在するエラーのみ
      return Either.match(result, {
        onLeft: (error) =>
          error._tag === "BlockRegistrationError" ||
          error._tag === "BlockValidationError",
        onRight: () => true
      })
    })
  )

  it.prop("ブロック配置検証は一貫性を保つ", [blockDefinitionArbitrary, position3DArbitrary])(
    (blockDef, position) => Effect.gen(function* () {
      const registry = yield* BlockRegistry
      const world = yield* WorldService

      yield* registry.register(blockDef)

      const canPlace1 = yield* registry.validatePlacement(blockDef.blockType, position, world)
      const canPlace2 = yield* registry.validatePlacement(blockDef.blockType, position, world)

      // プロパティ: 同じ条件での配置検証結果は一貫している
      return canPlace1 === canPlace2
    })
  )

  it.prop("ブロック物理プロパティは範囲内", [blockDefinitionArbitrary])(
    (blockDef) => Effect.gen(function* () {
      // プロパティ: 物理値が仕様範囲内
      const physics = blockDef.blockType.physics

      return (
        physics.hardness >= 0 &&
        physics.resistance >= 0 &&
        physics.luminance >= 0 && physics.luminance <= 15 &&
        physics.opacity >= 0 && physics.opacity <= 15 &&
        physics.slipperiness >= 0.4 && physics.slipperiness <= 1.0
      )
    })
  )

  it.prop("ブロック更新イベントは有効なスキーマに従う", [blockUpdateEventArbitrary])(
    (updateEvent) => Effect.gen(function* () {
      // プロパティ: 更新イベントはスキーマに適合
      const decoded = yield* Schema.decodeUnknown(BlockUpdateEvent)(updateEvent).pipe(
        Effect.either
      )

      return Either.isRight(decoded)
    })
  )

  it.prop("ブロック状態遷移は可逆性を持つ", [blockStateArbitrary])(
    (initialState) => Effect.gen(function* () {
      const registry = yield* BlockRegistry
      const position = Schema.decodeSync(Position3D)({ x: 0, y: 64, z: 0 })
      const world = yield* WorldService

      // 初期状態を設定
      yield* world.setBlockState(position, initialState)

      // 状態を取得
      const retrievedState = yield* world.getBlockState(position)

      // プロパティ: 設定した状態と取得した状態が一致
      return JSON.stringify(initialState) === JSON.stringify(retrievedState)
    })
  )
})

// テストファクトリー関数
export const createBlockTestFactory = () => ({
  // テスト用ブロック定義生成
  createTestBlock: (overrides?: Partial<BlockDefinition>): BlockDefinition => ({
    blockType: {
      blockCategory: "solid",
      id: Schema.decodeSync(BlockId)("minecraft:test_block"),
      name: "テストブロック",
      physics: {
        hardness: 1.0,
        resistance: 1.0,
        luminance: 0,
        opacity: 15,
        slipperiness: 0.6
      },
      material: "stone",
    },
    defaultState: { stateType: "default" },
    boundingBox: {
      min: Schema.decodeSync(Position3D)({ x: 0, y: 0, z: 0 }),
      max: Schema.decodeSync(Position3D)({ x: 1, y: 1, z: 1 })
    },
    placementRules: {
      canPlaceOn: [],
      requiresSupport: false,
      needsSpace: false
    },
    drops: [],
    soundType: "stone",
    ...overrides
  }),

  // テスト用レイヤー
  createTestLayer: () => Layer.mergeAll(
    TestBlockRegistryLive,
    TestWorldServiceLive
  ),

  // アサーション関数
  assertBlockValid: (block: BlockDefinition) =>
    Schema.decodeUnknown(BlockDefinition)(block).pipe(
      Effect.map(() => true),
      Effect.catchAll(() => Effect.succeed(false))
    )
})
