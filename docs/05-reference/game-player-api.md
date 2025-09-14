---
title: "Game Player API Reference"
description: "TypeScript Minecraftクローンのプレイヤー管理APIリファレンス。実装者向けの完全なAPI仕様書。"
category: "reference"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'api', 'player', 'reference']
prerequisites: ['effect-ts-basics', 'domain-driven-design']
estimated_reading_time: "25分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# Player Management API Reference

## 概要

TypeScript Minecraftクローンのプレイヤー管理システムの完全なAPIリファレンスです。Effect-TS 3.17+とDDDパターンを使用し、型安全で関数型プログラミングに適したプレイヤー操作APIを提供します。

### システム全体像

プレイヤー管理システムは以下の主要コンポーネントで構成されています：

- **Player Domain Service**: プレイヤーエンティティの基本操作
- **Player Movement Service**: 移動・物理演算処理
- **Player Inventory Service**: インベントリ・装備管理
- **Player Action Processor**: プレイヤーアクション統合処理
- **Player Health System**: 体力・空腹度管理
- **Player Sync Service**: マルチプレイヤー同期

## 主要インターフェース

### IPlayerService - プレイヤー基本操作

```typescript
import { Effect, Context, Schema } from "effect"

// プレイヤーサービスインターフェース
export interface IPlayerService {
  readonly create: (params: Schema.Schema.Type<typeof CreatePlayerParams>) => Effect.Effect<Player, PlayerCreationError>
  readonly findById: (playerId: PlayerId) => Effect.Effect<Player, PlayerNotFoundError>
  readonly updatePosition: (params: Schema.Schema.Type<typeof UpdatePositionParams>) => Effect.Effect<Player, InvalidMovementError>
  readonly updateStats: (params: Schema.Schema.Type<typeof UpdateStatsParams>) => Effect.Effect<Player, PlayerUpdateError>
  readonly delete: (playerId: PlayerId) => Effect.Effect<void, PlayerNotFoundError>
}

// Context Tag定義（Effect-TS 3.17+最新パターン）
export const PlayerService = Context.GenericTag<IPlayerService>("@app/PlayerService")

// Layerベース実装パターン
export const PlayerServiceLive = Layer.effect(
  PlayerService,
  Effect.gen(function* () {
    const repository = yield* PlayerRepository
    const eventBus = yield* EventBus
    const validator = yield* SchemaValidator

    return PlayerService.of({
      create: (params) => Effect.gen(function* () {
        const validated = yield* Schema.decodeUnknown(CreatePlayerParams)(params)
        const player = createPlayerEntity(validated)
        yield* repository.save(player)
        yield* eventBus.publish(PlayerEvent.Created(player))
        return player
      }),
      findById: (playerId) => repository.findById(playerId),
      updatePosition: (params) => Effect.gen(function* () {
        const validated = yield* Schema.decodeUnknown(UpdatePositionParams)(params)
        const player = yield* repository.findById(validated.playerId)
        const updated = yield* updatePlayerPositionLogic(player, validated)
        yield* repository.update(updated)
        return updated
      }),
      updateStats: (params) => Effect.gen(function* () {
        const validated = yield* Schema.decodeUnknown(UpdateStatsParams)(params)
        const player = yield* repository.findById(validated.playerId)
        const updated = PlayerStateUpdates.updateStats(player, validated)
        yield* repository.update(updated)
        return updated
      }),
      delete: (playerId) => Effect.gen(function* () {
        yield* repository.delete(playerId)
        yield* eventBus.publish(PlayerEvent.Deleted({ playerId, timestamp: Date.now() }))
      })
    })
  })
)

// Schema定義
export const CreatePlayerParams = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("PlayerId")),
  name: Schema.String.pipe(
    Schema.minLength(3, { message: () => "プレイヤー名は3文字以上必要です" }),
    Schema.maxLength(16, { message: () => "プレイヤー名は16文字以下必要です" }),
    Schema.pattern(/^[a-zA-Z0-9_]+$/, { message: () => "プレイヤー名は英数字とアンダースコアのみ使用可能です" })
  ),
  position: Schema.Struct({
    x: Schema.Number.pipe(Schema.finite()),
    y: Schema.Number.pipe(Schema.finite(), Schema.between(-256, 320)),
    z: Schema.Number.pipe(Schema.finite())
  }),
  gameMode: Schema.Union(
    Schema.Literal("survival"),
    Schema.Literal("creative"),
    Schema.Literal("adventure"),
    Schema.Literal("spectator")
  )
}).pipe(
  Schema.annotations({
    identifier: "CreatePlayerParams",
    description: "プレイヤー作成パラメータ",
    examples: [
      {
        id: "player-123",
        name: "Steve",
        position: { x: 0, y: 64, z: 0 },
        gameMode: "survival"
      }
    ],
    jsonSchema: {
      title: "Create Player Parameters",
      description: "TypeScriptミネクラフトプレイヤー作成用完全パラメータセット"
    }
  })
)

// 高度なバリデーション拡張
export const CreatePlayerParamsWithAdvancedValidation = CreatePlayerParams.pipe(
  Schema.transform(
    Schema.Struct({
      id: Schema.String.pipe(Schema.brand("PlayerId")),
      name: Schema.String.pipe(Schema.brand("PlayerName")),
      position: Schema.Struct({
        x: Schema.Number,
        y: Schema.Number,
        z: Schema.Number
      }),
      gameMode: Schema.Union(
        Schema.Literal("survival"),
        Schema.Literal("creative"),
        Schema.Literal("adventure"),
        Schema.Literal("spectator")
      ),
      // 拡張フィールド
      initialStats: Schema.optional(Schema.Struct({
        health: Schema.Number.pipe(Schema.between(1, 20), Schema.withDefault(20)),
        hunger: Schema.Number.pipe(Schema.between(0, 20), Schema.withDefault(20)),
        experience: Schema.Number.pipe(Schema.nonNegative(), Schema.withDefault(0))
      })),
      spawnProtection: Schema.optional(Schema.Boolean.pipe(Schema.withDefault(true)))
    }),
    {
      strict: false,
      decode: (input) => ({
        ...input,
        metadata: {
          createdAt: Date.now(),
          version: "1.0.0",
          clientInfo: process.env.CLIENT_VERSION || "unknown"
        }
      }),
      encode: (output) => output
    }
  )
)

export const UpdatePositionParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  rotation: Schema.Struct({
    yaw: Schema.Number.pipe(Schema.between(-180, 180)),
    pitch: Schema.Number.pipe(Schema.between(-90, 90))
  })
})

export const UpdateStatsParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  health: Schema.optional(Schema.Number.pipe(Schema.between(0, 20))),
  hunger: Schema.optional(Schema.Number.pipe(Schema.between(0, 20))),
  experience: Schema.optional(Schema.Number.pipe(Schema.nonNegative()))
})
```

### IPlayerMovementService - プレイヤー移動

```typescript
// 移動サービスインターフェース
export interface IPlayerMovementService {
  readonly move: (params: Schema.Schema.Type<typeof MovePlayerParams>) => Effect.Effect<Position3D, MovementError>
  readonly jump: (playerId: PlayerId) => Effect.Effect<Player, JumpError>
  readonly applyPhysics: (playerId: PlayerId, deltaTime: number) => Effect.Effect<Player, never>
  readonly checkCollision: (playerId: PlayerId, newPosition: Position3D) => Effect.Effect<CollisionResult, never>
  readonly teleport: (params: Schema.Schema.Type<typeof TeleportParams>) => Effect.Effect<Player, TeleportError>
}

export const PlayerMovementService = Context.GenericTag<IPlayerMovementService>("@app/PlayerMovementService")

// 移動方向定義
export const Direction = Schema.Struct({
  forward: Schema.Boolean,
  backward: Schema.Boolean,
  left: Schema.Boolean,
  right: Schema.Boolean,
  jump: Schema.Boolean,
  sneak: Schema.Boolean,
  sprint: Schema.Boolean
})

export const MovePlayerParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  direction: Direction,
  deltaTime: Schema.Number.pipe(Schema.positive()),
  inputVector: Schema.Struct({
    x: Schema.Number.pipe(Schema.between(-1, 1)),
    z: Schema.Number.pipe(Schema.between(-1, 1))
  })
})

export const TeleportParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  destination: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  preserveRotation: Schema.optional(Schema.Boolean)
})

// 衝突結果
export const CollisionResult = Schema.Struct({
  hasCollision: Schema.Boolean,
  resolvedPosition: Schema.optional(Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  })),
  collisionAxis: Schema.optional(Schema.Union(
    Schema.Literal("x"),
    Schema.Literal("y"),
    Schema.Literal("z")
  )),
  isOnGround: Schema.Boolean
})
```

### IPlayerInventoryService - インベントリ管理

```typescript
// インベントリサービスインターフェース
export interface IPlayerInventoryService {
  readonly addItem: (params: Schema.Schema.Type<typeof AddItemParams>) => Effect.Effect<Player, InventoryFullError | InvalidItemError>
  readonly removeItem: (params: Schema.Schema.Type<typeof RemoveItemParams>) => Effect.Effect<Option.Option<ItemStack>, ItemNotFoundError>
  readonly moveItem: (params: Schema.Schema.Type<typeof MoveItemParams>) => Effect.Effect<Player, ItemTransferError>
  readonly equipItem: (params: Schema.Schema.Type<typeof EquipItemParams>) => Effect.Effect<Player, EquipError>
  readonly getInventory: (playerId: PlayerId) => Effect.Effect<Inventory, PlayerNotFoundError>
  readonly setSelectedSlot: (playerId: PlayerId, slotIndex: number) => Effect.Effect<Player, InvalidSlotError>
}

export const PlayerInventoryService = Context.GenericTag<IPlayerInventoryService>("@app/PlayerInventoryService")

// インベントリ操作パラメータ
export const AddItemParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  item: Schema.Struct({
    itemId: Schema.String.pipe(Schema.brand("ItemId")),
    count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
    durability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
    enchantments: Schema.optional(Schema.Array(Schema.Struct({
      id: Schema.String,
      level: Schema.Number.pipe(Schema.int(), Schema.between(1, 5))
    }))),
    metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
  }),
  preferredSlot: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(0, 35)))
})

export const RemoveItemParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  slotIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 35)),
  count: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive()))
})

export const MoveItemParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  fromSlot: Schema.Number.pipe(Schema.int(), Schema.between(0, 35)),
  toSlot: Schema.Number.pipe(Schema.int(), Schema.between(0, 35)),
  amount: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive()))
})

export const EquipItemParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  slotIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 35)),
  equipmentSlot: Schema.Union(
    Schema.Literal("helmet"),
    Schema.Literal("chestplate"),
    Schema.Literal("leggings"),
    Schema.Literal("boots"),
    Schema.Literal("mainHand"),
    Schema.Literal("offHand")
  )
})
```

### IPlayerActionProcessor - アクション処理

```typescript
// プレイヤーアクション統合処理
export interface IPlayerActionProcessor {
  readonly process: (playerId: PlayerId, action: PlayerAction) => Effect.Effect<ActionResult, ActionError>
  readonly processSequence: (playerId: PlayerId, actions: ReadonlyArray<PlayerAction>) => Effect.Effect<ReadonlyArray<ActionResult>, ActionError>
  readonly validateAction: (playerId: PlayerId, action: PlayerAction) => Effect.Effect<boolean, ValidationError>
}

export const PlayerActionProcessor = Context.GenericTag<IPlayerActionProcessor>("@app/PlayerActionProcessor")

// プレイヤーアクション定義（Tagged Union）
export const PlayerAction = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("Move"),
    direction: Direction,
    deltaTime: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("Jump")
  }),
  Schema.Struct({
    _tag: Schema.Literal("PlaceBlock"),
    position: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    blockType: Schema.String.pipe(Schema.brand("BlockType")),
    face: Schema.Union(
      Schema.Literal("top"),
      Schema.Literal("bottom"),
      Schema.Literal("north"),
      Schema.Literal("south"),
      Schema.Literal("east"),
      Schema.Literal("west")
    )
  }),
  Schema.Struct({
    _tag: Schema.Literal("BreakBlock"),
    position: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    tool: Schema.optional(Schema.String.pipe(Schema.brand("ItemId")))
  }),
  Schema.Struct({
    _tag: Schema.Literal("UseItem"),
    item: Schema.String.pipe(Schema.brand("ItemId")),
    target: Schema.optional(Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }))
  }),
  Schema.Struct({
    _tag: Schema.Literal("Attack"),
    target: Schema.String.pipe(Schema.brand("EntityId")),
    weapon: Schema.optional(Schema.String.pipe(Schema.brand("ItemId")))
  }),
  Schema.Struct({
    _tag: Schema.Literal("Interact"),
    target: Schema.Union(
      Schema.Struct({
        type: Schema.Literal("block"),
        position: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number })
      }),
      Schema.Struct({
        type: Schema.Literal("entity"),
        entityId: Schema.String.pipe(Schema.brand("EntityId"))
      })
    )
  })
)

export const ActionResult = Schema.Struct({
  success: Schema.Boolean,
  timestamp: Schema.Number,
  result: Schema.optional(Schema.Unknown),
  sideEffects: Schema.optional(Schema.Array(Schema.Struct({
    type: Schema.String,
    description: Schema.String,
    data: Schema.Unknown
  })))
})
```

### IPlayerHealthSystem - 体力・空腹度管理

```typescript
// 体力システムインターフェース
export interface IPlayerHealthSystem {
  readonly damage: (params: Schema.Schema.Type<typeof DamageParams>) => Effect.Effect<Player, PlayerDeathError>
  readonly heal: (params: Schema.Schema.Type<typeof HealParams>) => Effect.Effect<Player, never>
  readonly feed: (params: Schema.Schema.Type<typeof FeedParams>) => Effect.Effect<Player, never>
  readonly updateHunger: (playerId: PlayerId, deltaTime: number) => Effect.Effect<Player, never>
  readonly regenerate: (playerId: PlayerId, deltaTime: number) => Effect.Effect<Player, never>
  readonly applyStatusEffect: (params: Schema.Schema.Type<typeof StatusEffectParams>) => Effect.Effect<Player, InvalidEffectError>
}

export const PlayerHealthSystem = Context.GenericTag<IPlayerHealthSystem>("@app/PlayerHealthSystem")

// 体力関連パラメータ
export const DamageParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  amount: Schema.Number.pipe(Schema.nonnegative()),
  source: Schema.Union(
    Schema.Literal("fall"),
    Schema.Literal("fire"),
    Schema.Literal("drowning"),
    Schema.Literal("suffocation"),
    Schema.Literal("mob"),
    Schema.Literal("player"),
    Schema.Literal("environment"),
    Schema.Literal("void")
  ),
  damageType: Schema.Union(
    Schema.Literal("direct"),
    Schema.Literal("magic"),
    Schema.Literal("projectile"),
    Schema.Literal("explosion")
  )
})

export const HealParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  amount: Schema.Number.pipe(Schema.positive()),
  source: Schema.Union(
    Schema.Literal("food"),
    Schema.Literal("potion"),
    Schema.Literal("regeneration"),
    Schema.Literal("command")
  )
})

export const FeedParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  hunger: Schema.Number.pipe(Schema.between(0, 20)),
  saturation: Schema.Number.pipe(Schema.between(0, 20))
})

export const StatusEffectParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  effect: Schema.Struct({
    type: Schema.Union(
      Schema.Literal("speed"),
      Schema.Literal("slowness"),
      Schema.Literal("jump_boost"),
      Schema.Literal("regeneration"),
      Schema.Literal("poison"),
      Schema.Literal("night_vision"),
      Schema.Literal("invisibility")
    ),
    amplifier: Schema.Number.pipe(Schema.int(), Schema.between(0, 255)),
    duration: Schema.Number.pipe(Schema.positive()) // ティック数
  })
})
```

## メソッド詳細

### プレイヤー作成・管理

#### createPlayer
```typescript
// プレイヤーの新規作成
const createPlayer = (params: CreatePlayerParams) => Effect.gen(function* () {
  // パラメータバリデーション
  const validated = yield* Schema.decodeUnknownSync(CreatePlayerParams)(params)

  // 名前重複チェック
  const existing = yield* PlayerRepository.pipe(
    Effect.flatMap(repo => repo.findByName(validated.name)),
    Effect.option
  )

  if (Option.isSome(existing)) {
    return yield* Effect.fail(PlayerCreationError({
      message: "Player name already exists",
      playerName: validated.name
    }))
  }

  // プレイヤー作成
  const player = {
    id: validated.id,
    name: validated.name,
    position: validated.position,
    rotation: { yaw: 0, pitch: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    stats: {
      health: 20,
      hunger: 20,
      saturation: 5,
      experience: 0,
      level: 0,
      armor: 0
    },
    inventory: createEmptyInventory(),
    equipment: createEmptyEquipment(),
    gameMode: validated.gameMode,
    abilities: determineAbilities(validated.gameMode)
  }

  // 保存
  yield* PlayerRepository.pipe(
    Effect.flatMap(repo => repo.save(player))
  )

  // イベント発行
  yield* EventBus.pipe(
    Effect.flatMap(bus => bus.publish({
      _tag: "PlayerCreated",
      playerId: player.id,
      position: player.position
    }))
  )

  return player
})

// 使用例
const result = yield* PlayerService.pipe(
  Effect.flatMap(service => service.create({
    id: "player-123",
    name: "Steve",
    position: { x: 0, y: 64, z: 0 },
    gameMode: "survival"
  }))
)
```

#### updatePlayerPosition
```typescript
// プレイヤー位置更新
const updatePlayerPosition = (params: UpdatePositionParams) => Effect.gen(function* () {
  const validated = yield* Schema.decodeUnknownSync(UpdatePositionParams)(params)

  const player = yield* PlayerRepository.pipe(
    Effect.flatMap(repo => repo.findById(validated.playerId))
  )

  // 移動距離チェック
  const distance = calculateDistance(player.position, validated.position)
  const maxDistance = player.gameMode === "creative" ? 100 : 10

  if (distance > maxDistance) {
    return yield* Effect.fail(InvalidMovementError({
      message: "Movement distance too large",
      playerId: validated.playerId,
      actualDistance: distance,
      maxAllowed: maxDistance
    }))
  }

  // 衝突チェック
  const collision = yield* PlayerMovementService.pipe(
    Effect.flatMap(service => service.checkCollision(validated.playerId, validated.position))
  )

  const finalPosition = collision.hasCollision
    ? collision.resolvedPosition ?? player.position
    : validated.position

  // 更新
  const updatedPlayer = {
    ...player,
    position: finalPosition,
    rotation: validated.rotation
  }

  yield* PlayerRepository.pipe(
    Effect.flatMap(repo => repo.update(updatedPlayer))
  )

  return updatedPlayer
})
```

### プレイヤー移動と物理演算

#### movePlayer
```typescript
// プレイヤー移動処理
const movePlayer = (params: MovePlayerParams) => Effect.gen(function* () {
  const validated = yield* Schema.decodeUnknownSync(MovePlayerParams)(params)

  const player = yield* PlayerRepository.pipe(
    Effect.flatMap(repo => repo.findById(validated.playerId))
  )

  // 移動速度計算
  const baseSpeed = player.gameMode === "creative" && player.abilities.isFlying
    ? player.abilities.flySpeed
    : player.abilities.walkSpeed

  const sprintMultiplier = validated.direction.sprint && player.stats.hunger > 6 ? 1.3 : 1.0
  const finalSpeed = baseSpeed * sprintMultiplier

  // 移動ベクトル計算
  const moveVector = calculateMovementVector(
    validated.direction,
    player.rotation,
    finalSpeed,
    validated.deltaTime
  )

  // 新しい位置計算
  const newPosition = {
    x: player.position.x + moveVector.x,
    y: player.position.y + moveVector.y,
    z: player.position.z + moveVector.z
  }

  // 物理演算適用
  const physicsResult = yield* PlayerMovementService.pipe(
    Effect.flatMap(service => service.applyPhysics(validated.playerId, validated.deltaTime))
  )

  // 空腹度減少（スプリント時）
  const updatedStats = validated.direction.sprint
    ? { ...player.stats, hunger: Math.max(0, player.stats.hunger - 0.1 * validated.deltaTime) }
    : player.stats

  const updatedPlayer = {
    ...physicsResult,
    position: newPosition,
    stats: updatedStats
  }

  yield* PlayerRepository.pipe(
    Effect.flatMap(repo => repo.update(updatedPlayer))
  )

  return newPosition
})

// 使用例
const newPosition = yield* PlayerMovementService.pipe(
  Effect.flatMap(service => service.move({
    playerId: "player-123",
    direction: {
      forward: true,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sneak: false,
      sprint: true
    },
    deltaTime: 0.016, // 60 FPS
    inputVector: { x: 0, z: 1 }
  }))
)
```

#### jumpPlayer
```typescript
// プレイヤージャンプ処理
const jumpPlayer = (playerId: PlayerId) => Effect.gen(function* () {
  const player = yield* PlayerRepository.pipe(
    Effect.flatMap(repo => repo.findById(playerId))
  )

  // 地面判定
  const collision = yield* PlayerMovementService.pipe(
    Effect.flatMap(service => service.checkCollision(playerId, player.position))
  )

  if (!collision.isOnGround && player.gameMode !== "creative") {
    return yield* Effect.fail(JumpError({
      message: "Player is not on ground",
      playerId
    }))
  }

  // ジャンプ力計算
  const jumpVelocity = player.gameMode === "creative" ? 0.5 : 0.42

  // ジャンプブーストエフェクト考慮
  const jumpBoost = getActiveStatusEffect(player, "jump_boost")
  const finalJumpVelocity = jumpBoost
    ? jumpVelocity * (1 + jumpBoost.amplifier * 0.1)
    : jumpVelocity

  // 空腹度消費
  const newHunger = Math.max(0, player.stats.hunger - 0.05)

  const updatedPlayer = {
    ...player,
    velocity: {
      ...player.velocity,
      y: finalJumpVelocity
    },
    stats: {
      ...player.stats,
      hunger: newHunger
    }
  }

  yield* PlayerRepository.pipe(
    Effect.flatMap(repo => repo.update(updatedPlayer))
  )

  return updatedPlayer
})
```

### インベントリ操作

#### addItemToInventory
```typescript
// アイテムをインベントリに追加
const addItemToInventory = (params: AddItemParams) => Effect.gen(function* () {
  const validated = yield* Schema.decodeUnknownSync(AddItemParams)(params)

  const player = yield* PlayerRepository.pipe(
    Effect.flatMap(repo => repo.findById(validated.playerId))
  )

  // スタック可能チェック
  const stackableSlot = findStackableSlot(player.inventory, validated.item)

  return yield* Match.value(stackableSlot).pipe(
    Match.when(Option.isSome, ({ value: slot }) => Effect.gen(function* () {
      // 既存スタックに追加
      const maxStack = getMaxStackSize(validated.item.itemId)
      const canAdd = Math.min(
        validated.item.count,
        maxStack - slot.item.count
      )

      if (canAdd === 0) {
        return yield* Effect.fail(InventoryFullError({
          message: "Cannot stack more items",
          playerId: validated.playerId
        }))
      }

      const updatedStack = {
        ...slot.item,
        count: slot.item.count + canAdd
      }

      const updatedSlots = [...player.inventory.slots]
      updatedSlots[slot.index] = updatedStack

      const updatedPlayer = {
        ...player,
        inventory: {
          ...player.inventory,
          slots: updatedSlots
        }
      }

      yield* PlayerRepository.pipe(
        Effect.flatMap(repo => repo.update(updatedPlayer))
      )

      // 残りアイテムがあれば再帰的に追加
      if (canAdd < validated.item.count) {
        const remainingItem = {
          ...validated.item,
          count: validated.item.count - canAdd
        }
        return yield* addItemToInventory({
          playerId: validated.playerId,
          item: remainingItem
        })
      }

      return updatedPlayer
    })),
    Match.orElse(() => Effect.gen(function* () {
      // 空きスロットを探す
      const emptySlot = findEmptySlot(player.inventory)

      if (Option.isNone(emptySlot)) {
        return yield* Effect.fail(InventoryFullError({
          message: "No empty slots available",
          playerId: validated.playerId
        }))
      }

      const updatedSlots = [...player.inventory.slots]
      updatedSlots[emptySlot.value] = validated.item

      const updatedPlayer = {
        ...player,
        inventory: {
          ...player.inventory,
          slots: updatedSlots
        }
      }

      yield* PlayerRepository.pipe(
        Effect.flatMap(repo => repo.update(updatedPlayer))
      )

      return updatedPlayer
    }))
  )
})

// 使用例
const result = yield* PlayerInventoryService.pipe(
  Effect.flatMap(service => service.addItem({
    playerId: "player-123",
    item: {
      itemId: "minecraft:stone",
      count: 32,
      durability: 1.0
    }
  }))
)
```

### 体力・空腹度システム

#### damagePlayer
```typescript
// プレイヤーダメージ処理
const damagePlayer = (params: DamageParams) => Effect.gen(function* () {
  const validated = yield* Schema.decodeUnknownSync(DamageParams)(params)

  const player = yield* PlayerRepository.pipe(
    Effect.flatMap(repo => repo.findById(validated.playerId))
  )

  // 無敵判定
  if (player.abilities.invulnerable) {
    return player
  }

  // アーマー計算
  const armorReduction = calculateArmorReduction(
    player.stats.armor,
    validated.damageType
  )

  const finalDamage = Math.max(0, validated.amount - armorReduction)
  const newHealth = Math.max(0, player.stats.health - finalDamage)

  // 死亡判定
  if (newHealth === 0) {
    yield* handlePlayerDeath(player, validated.source)
    return yield* Effect.fail(PlayerDeathError({
      message: "Player died",
      playerId: validated.playerId,
      cause: validated.source
    }))
  }

  const updatedPlayer = {
    ...player,
    stats: {
      ...player.stats,
      health: newHealth
    }
  }

  yield* PlayerRepository.pipe(
    Effect.flatMap(repo => repo.update(updatedPlayer))
  )

  // ダメージイベント発行
  yield* EventBus.pipe(
    Effect.flatMap(bus => bus.publish({
      _tag: "PlayerDamaged",
      playerId: validated.playerId,
      damage: finalDamage,
      source: validated.source,
      newHealth
    }))
  )

  return updatedPlayer
})

// 使用例
const result = yield* PlayerHealthSystem.pipe(
  Effect.flatMap(service => service.damage({
    playerId: "player-123",
    amount: 5,
    source: "fall",
    damageType: "direct"
  }))
)
```

## プレイヤー状態管理

### プレイヤー状態定義

```typescript
// プレイヤーエンティティ完全定義
export const Player = Schema.Struct({
  // 基本情報
  id: Schema.String.pipe(Schema.brand("PlayerId")),
  name: Schema.String.pipe(Schema.brand("PlayerName")),

  // 位置・回転
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  rotation: Schema.Struct({
    yaw: Schema.Number.pipe(Schema.between(-180, 180)),
    pitch: Schema.Number.pipe(Schema.between(-90, 90))
  }),
  velocity: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),

  // ステータス
  stats: Schema.Struct({
    health: Schema.Number.pipe(Schema.between(0, 20)),
    hunger: Schema.Number.pipe(Schema.between(0, 20)),
    saturation: Schema.Number.pipe(Schema.between(0, 20)),
    experience: Schema.Number.pipe(Schema.nonNegative()),
    level: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
    armor: Schema.Number.pipe(Schema.between(0, 20))
  }),

  // インベントリ・装備
  inventory: Schema.Struct({
    slots: Schema.Array(
      Schema.Union(
        Schema.Struct({
          itemId: Schema.String.pipe(Schema.brand("ItemId")),
          count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
          durability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
          enchantments: Schema.optional(Schema.Array(Schema.Struct({
            id: Schema.String,
            level: Schema.Number
          }))),
          metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
        }),
        Schema.Null
      )
    ).pipe(Schema.itemsCount(36)), // 9x4 グリッド
    hotbar: Schema.Array(
      Schema.Union(
        Schema.Struct({
          itemId: Schema.String.pipe(Schema.brand("ItemId")),
          count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
          durability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1)))
        }),
        Schema.Null
      )
    ).pipe(Schema.itemsCount(9)),
    selectedSlot: Schema.Number.pipe(Schema.int(), Schema.between(0, 8))
  }),

  equipment: Schema.Struct({
    helmet: Schema.Union(ItemStackSchema, Schema.Null),
    chestplate: Schema.Union(ItemStackSchema, Schema.Null),
    leggings: Schema.Union(ItemStackSchema, Schema.Null),
    boots: Schema.Union(ItemStackSchema, Schema.Null),
    mainHand: Schema.Union(ItemStackSchema, Schema.Null),
    offHand: Schema.Union(ItemStackSchema, Schema.Null)
  }),

  // ゲーム設定
  gameMode: Schema.Union(
    Schema.Literal("survival"),
    Schema.Literal("creative"),
    Schema.Literal("adventure"),
    Schema.Literal("spectator")
  ),

  abilities: Schema.Struct({
    canFly: Schema.Boolean,
    isFlying: Schema.Boolean,
    canBreakBlocks: Schema.Boolean,
    canPlaceBlocks: Schema.Boolean,
    invulnerable: Schema.Boolean,
    walkSpeed: Schema.Number.pipe(Schema.positive()),
    flySpeed: Schema.Number.pipe(Schema.positive())
  }),

  // ステータスエフェクト
  statusEffects: Schema.Array(Schema.Struct({
    type: Schema.String,
    amplifier: Schema.Number.pipe(Schema.int(), Schema.between(0, 255)),
    duration: Schema.Number.pipe(Schema.positive()),
    showParticles: Schema.Boolean,
    showIcon: Schema.Boolean
  })),

  // メタデータ
  metadata: Schema.Struct({
    lastLogin: Schema.Number,
    playtime: Schema.Number,
    worldId: Schema.String.pipe(Schema.brand("WorldId")),
    bedPosition: Schema.optional(Schema.Struct({
      x: Schema.Number,
      y: Schema.Number,
      z: Schema.Number
    }))
  })
})

export type Player = Schema.Schema.Type<typeof Player>
```

### 状態更新パターン

```typescript
// 状態更新の型安全なパターン
export const PlayerStateUpdates = {
  // 部分更新（不変性保持）
  updatePosition: (player: Player, newPosition: Position3D): Player => ({
    ...player,
    position: newPosition
  }),

  updateStats: (player: Player, statsUpdate: Partial<PlayerStats>): Player => ({
    ...player,
    stats: { ...player.stats, ...statsUpdate }
  }),

  addStatusEffect: (player: Player, effect: StatusEffect): Player => ({
    ...player,
    statusEffects: [...player.statusEffects, effect]
  }),

  removeStatusEffect: (player: Player, effectType: string): Player => ({
    ...player,
    statusEffects: player.statusEffects.filter(e => e.type !== effectType)
  })
}
```

## イベントシステム

### プレイヤーイベント定義

```typescript
// プレイヤー関連イベント
export const PlayerEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("PlayerCreated"),
    playerId: Schema.String.pipe(Schema.brand("PlayerId")),
    position: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("PlayerMoved"),
    playerId: Schema.String.pipe(Schema.brand("PlayerId")),
    from: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    to: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    distance: Schema.Number,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("PlayerJumped"),
    playerId: Schema.String.pipe(Schema.brand("PlayerId")),
    position: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    jumpHeight: Schema.Number,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("PlayerDamaged"),
    playerId: Schema.String.pipe(Schema.brand("PlayerId")),
    damage: Schema.Number,
    source: Schema.String,
    newHealth: Schema.Number,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("PlayerHealed"),
    playerId: Schema.String.pipe(Schema.brand("PlayerId")),
    amount: Schema.Number,
    newHealth: Schema.Number,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("PlayerDied"),
    playerId: Schema.String.pipe(Schema.brand("PlayerId")),
    cause: Schema.String,
    position: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("PlayerInventoryChanged"),
    playerId: Schema.String.pipe(Schema.brand("PlayerId")),
    slotIndex: Schema.Number,
    oldItem: Schema.Union(ItemStackSchema, Schema.Null),
    newItem: Schema.Union(ItemStackSchema, Schema.Null),
    timestamp: Schema.Number
  })
)

export type PlayerEvent = Schema.Schema.Type<typeof PlayerEvent>

// イベントハンドラー例
export const PlayerEventHandlers = {
  onPlayerMoved: (event: Extract<PlayerEvent, { _tag: "PlayerMoved" }>) =>
    Effect.gen(function* () {
      // チャンク境界チェック
      const oldChunk = positionToChunk(event.from)
      const newChunk = positionToChunk(event.to)

      if (!chunkPositionEquals(oldChunk, newChunk)) {
        yield* ChunkLoader.pipe(
          Effect.flatMap(loader => loader.loadChunk(newChunk))
        )
      }

      // 近くのプレイヤーに同期
      yield* PlayerSyncService.pipe(
        Effect.flatMap(sync => sync.broadcastPlayerPosition(event.playerId, event.to))
      )
    }),

  onPlayerDamaged: (event: Extract<PlayerEvent, { _tag: "PlayerDamaged" }>) =>
    Effect.gen(function* () {
      // ダメージエフェクト表示
      yield* EffectRenderer.pipe(
        Effect.flatMap(renderer => renderer.showDamageEffect(event.playerId, event.damage))
      )

      // 低体力警告
      if (event.newHealth <= 4) {
        yield* NotificationService.pipe(
          Effect.flatMap(service => service.showWarning(event.playerId, "体力が少なくなっています！"))
        )
      }
    })
}
```

## マルチプレイヤー対応

### プレイヤー同期サービス

```typescript
// マルチプレイヤー同期
export interface IPlayerSyncService {
  readonly sendPlayerUpdate: (playerId: PlayerId) => Effect.Effect<void, NetworkError>
  readonly receivePlayerUpdates: () => Effect.Effect<ReadonlyArray<PlayerSyncData>, NetworkError>
  readonly interpolatePlayerPosition: (playerId: PlayerId, timestamp: number) => Effect.Effect<Option.Option<Position3D>, never>
  readonly predictPlayerMovement: (playerId: PlayerId, input: InputState, deltaTime: number) => Effect.Effect<Player, never>
}

export const PlayerSyncService = Context.GenericTag<IPlayerSyncService>("@app/PlayerSyncService")

// 同期データ定義
export const PlayerSyncData = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  position: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
  rotation: Schema.Struct({ yaw: Schema.Number, pitch: Schema.Number }),
  velocity: Schema.Struct({ x: Schema.Number, y: Schema.Number, z: Schema.Number }),
  animationState: Schema.String,
  timestamp: Schema.Number,
  sequenceNumber: Schema.Number
})

// クライアント側予測
const predictPlayerMovement = (playerId: PlayerId, input: InputState, deltaTime: number) =>
  Effect.gen(function* () {
    const player = yield* PlayerRepository.pipe(
      Effect.flatMap(repo => repo.findById(playerId))
    )

    // ローカル予測実行
    const movement = determineMovementFromInput(input)
    const predictedPlayer = yield* PlayerMovementService.pipe(
      Effect.flatMap(service => service.move({
        playerId,
        direction: movement,
        deltaTime,
        inputVector: input.movementVector
      }))
    )

    // 予測結果をサーバーに送信
    yield* PlayerSyncService.pipe(
      Effect.flatMap(sync => sync.sendPlayerUpdate(playerId))
    )

    return predictedPlayer
  })

// サーバー権威調整
const reconcileServerUpdate = (playerId: PlayerId, serverData: PlayerSyncData) =>
  Effect.gen(function* () {
    const localPlayer = yield* PlayerRepository.pipe(
      Effect.flatMap(repo => repo.findById(playerId))
    )

    // 位置差分チェック
    const positionDiff = calculateDistance(localPlayer.position, serverData.position)

    // 閾値を超えている場合はサーバー位置を採用
    if (positionDiff > POSITION_SYNC_THRESHOLD) {
      const correctedPlayer = {
        ...localPlayer,
        position: serverData.position,
        rotation: serverData.rotation
      }

      yield* PlayerRepository.pipe(
        Effect.flatMap(repo => repo.update(correctedPlayer))
      )

      return correctedPlayer
    }

    return localPlayer
  })
```

## 使用例とベストプラクティス

### プレイヤーAPIテストパターン

#### 単体テスト例（@effect/vitest統合）

```typescript
import { Effect, TestContext, Layer } from "effect"
import { describe, it, expect } from "@effect/vitest"

// テスト専用Layerの作成
const TestPlayerServiceLayer = Layer.succeed(
  PlayerService,
  PlayerService.of({
    create: (params) => Effect.succeed(mockPlayer(params)),
    findById: (id) => Effect.succeed(mockPlayer({ id })),
    updatePosition: () => Effect.succeed(mockPlayer()),
    updateStats: () => Effect.succeed(mockPlayer()),
    delete: () => Effect.unit
  })
)

describe("Player API", () => {
  it("should create player successfully", () =>
    Effect.gen(function* () {
      const service = yield* PlayerService
      const result = yield* service.create({
        id: "test-player",
        name: "TestSteve",
        position: { x: 0, y: 64, z: 0 },
        gameMode: "creative"
      })

      expect(result.id).toBe("test-player")
      expect(result.name).toBe("TestSteve")
      expect(result.gameMode).toBe("creative")
    }).pipe(Effect.provide(TestPlayerServiceLayer))
  )

  it("should handle player not found error", () =>
    Effect.gen(function* () {
      const service = yield* PlayerService
      const result = yield* service.findById("nonexistent").pipe(
        Effect.exit
      )

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        expect(result.cause._tag).toBe("PlayerNotFoundError")
      }
    }).pipe(Effect.provide(TestPlayerServiceLayer))
  )
})

// Property-based testing with fast-check
import * as fc from "fast-check"

const PlayerIdArb = fc.string({ minLength: 5, maxLength: 20 })
const PositionArb = fc.record({
  x: fc.double({ min: -1000, max: 1000 }),
  y: fc.double({ min: -256, max: 320 }),
  z: fc.double({ min: -1000, max: 1000 })
})

const CreatePlayerParamsArb = fc.record({
  id: PlayerIdArb,
  name: fc.string({ minLength: 3, maxLength: 16 }).filter(s => /^[a-zA-Z0-9_]+$/.test(s)),
  position: PositionArb,
  gameMode: fc.constantFrom("survival", "creative", "adventure", "spectator")
})

describe("Player Creation Property Tests", () => {
  it("should always create valid players from valid params", () =>
    fc.assert(fc.asyncProperty(
      CreatePlayerParamsArb,
      async (params) => {
        const result = await Effect.runPromise(
          Effect.gen(function* () {
            const service = yield* PlayerService
            const player = yield* service.create(params)

            return {
              hasValidId: typeof player.id === 'string' && player.id.length > 0,
              hasValidName: typeof player.name === 'string' && player.name === params.name,
              hasValidPosition: player.position.x === params.position.x,
              hasValidGameMode: player.gameMode === params.gameMode
            }
          }).pipe(Effect.provide(TestPlayerServiceLayer))
        )

        expect(result.hasValidId).toBe(true)
        expect(result.hasValidName).toBe(true)
        expect(result.hasValidPosition).toBe(true)
        expect(result.hasValidGameMode).toBe(true)
      }
    ))
  )
})
```

#### 統合テスト例（リアルデータベース使用）

```typescript
import { PgClient, SqlSchema } from "@effect/sql"
import { TestContainer } from "testcontainers"

const TestDatabaseLayer = Layer.scoped(
  PgClient.PgClient,
  Effect.gen(function* () {
    // テスト用PostgreSQLコンテナ起動
    const container = yield* Effect.promise(() =>
      new TestContainer("postgres:15")
        .withEnvironment({
          POSTGRES_DB: "minecraft_test",
          POSTGRES_USER: "test",
          POSTGRES_PASSWORD: "test"
        })
        .start()
    )

    const client = yield* PgClient.make({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: "test",
      password: "test",
      database: "minecraft_test"
    })

    // テーブル作成
    yield* SqlSchema.make({
      client,
      migrations: [
        `CREATE TABLE players (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          position_x REAL NOT NULL,
          position_y REAL NOT NULL,
          position_z REAL NOT NULL,
          game_mode TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )`
      ]
    })

    return client
  })
)

describe("Player Integration Tests", () => {
  it("should persist player to database", () =>
    Effect.gen(function* () {
      const service = yield* PlayerService

      const created = yield* service.create({
        id: "integration-test-player",
        name: "IntegrationSteve",
        position: { x: 100, y: 64, z: 200 },
        gameMode: "survival"
      })

      const retrieved = yield* service.findById(created.id)

      expect(retrieved.id).toBe(created.id)
      expect(retrieved.name).toBe(created.name)
      expect(retrieved.position).toEqual(created.position)
    }).pipe(
      Effect.provide(Layer.merge(PlayerSystemLayer, TestDatabaseLayer))
    )
  )
})
```

### 基本的なプレイヤー操作

```typescript
// プレイヤー作成からログアウトまでの完全な流れ
const playerLifecycle = Effect.gen(function* () {
  // 1. プレイヤー作成
  const player = yield* PlayerService.pipe(
    Effect.flatMap(service => service.create({
      id: generatePlayerId(),
      name: "Steve",
      position: { x: 0, y: 64, z: 0 },
      gameMode: "survival"
    }))
  )

  // 2. 初期装備配布
  yield* PlayerInventoryService.pipe(
    Effect.flatMap(service => service.addItem({
      playerId: player.id,
      item: {
        itemId: "minecraft:wooden_sword",
        count: 1,
        durability: 1.0
      }
    }))
  )

  // 3. ゲームループ（移動・アクション処理）
  yield* Effect.repeat(
    Effect.gen(function* () {
      // 入力処理
      const input = yield* InputService.pipe(
        Effect.flatMap(service => service.getCurrentInput())
      )

      // プレイヤーアクション処理
      const actions = yield* InputService.pipe(
        Effect.flatMap(service => service.inputToActions(input))
      )

      // アクション実行
      yield* Effect.forEach(
        actions,
        action => PlayerActionProcessor.pipe(
          Effect.flatMap(processor => processor.process(player.id, action))
        ),
        { concurrency: 1 }
      )

      // 物理更新
      yield* PlayerMovementService.pipe(
        Effect.flatMap(service => service.applyPhysics(player.id, 0.016))
      )

      // 体力システム更新
      yield* PlayerHealthSystem.pipe(
        Effect.flatMap(system => system.updateHunger(player.id, 0.016))
      )
    }),
    Schedule.spaced("16 millis") // 60 FPS
  )
})

// エラーハンドリング付きの安全な実行
const safePlayerOperation = playerLifecycle.pipe(
  Effect.catchTags({
    "PlayerCreationError": (error) => Effect.logError(`プレイヤー作成失敗: ${error.message}`),
    "MovementError": (error) => Effect.logWarning(`移動エラー: ${error.message}`),
    "InventoryError": (error) => Effect.logInfo(`インベントリエラー: ${error.message}`)
  }),
  Effect.retry(Schedule.exponential("100 millis").pipe(Schedule.recurs(3)))
)
```

### パフォーマンス最適化

```typescript
// バッチ処理によるパフォーマンス最適化
const batchPlayerUpdates = (playerIds: ReadonlyArray<PlayerId>, deltaTime: number) =>
  Effect.gen(function* () {
    // 並列処理でプレイヤー更新
    const results = yield* Effect.all(
      playerIds.map(playerId =>
        Effect.all([
          PlayerMovementService.pipe(
            Effect.flatMap(service => service.applyPhysics(playerId, deltaTime))
          ),
          PlayerHealthSystem.pipe(
            Effect.flatMap(system => system.updateHunger(playerId, deltaTime))
          ),
          PlayerHealthSystem.pipe(
            Effect.flatMap(system => system.regenerate(playerId, deltaTime))
          )
        ], { concurrency: 3 })
      ),
      { concurrency: 8, batching: true } // バッチサイズ制限
    )

    // 結果統合
    return results.map(([movement, hunger, regen]) => ({
      movement,
      hunger,
      regen
    }))
  })

// メモリ効率的なプレイヤーキャッシュ
const PlayerCache = Effect.gen(function* () {
  const cache = yield* Cache.make({
    capacity: 1000,
    timeToLive: "5 minutes",
    lookup: (playerId: PlayerId) => PlayerRepository.pipe(
      Effect.flatMap(repo => repo.findById(playerId))
    )
  })

  return {
    getPlayer: (playerId: PlayerId) => Cache.get(cache, playerId),
    invalidatePlayer: (playerId: PlayerId) => Cache.invalidate(cache, playerId),
    refreshPlayer: (playerId: PlayerId) => Cache.refresh(cache, playerId)
  }
})
```

## エラーハンドリング

### プレイヤーシステムエラー

```typescript
// プレイヤーシステム固有エラー
export namespace PlayerSystemErrors {
  export const PlayerNotFoundError = Schema.TaggedError("PlayerSystem.PlayerNotFoundError")<{
    readonly playerId: string
    readonly searchContext: string
    readonly timestamp: number
  }>

  export const InvalidMovementError = Schema.TaggedError("PlayerSystem.InvalidMovementError")<{
    readonly playerId: string
    readonly currentPosition: Position3D
    readonly targetPosition: Position3D
    readonly reason: string
    readonly maxAllowedDistance: number
    readonly actualDistance: number
    readonly timestamp: number
  }>

  export const InventoryFullError = Schema.TaggedError("PlayerSystem.InventoryFullError")<{
    readonly playerId: string
    readonly inventoryId: string
    readonly attemptedItem: string
    readonly availableSlots: number
    readonly timestamp: number
  }>

  export const PlayerDeathError = Schema.TaggedError("PlayerSystem.PlayerDeathError")<{
    readonly playerId: string
    readonly cause: string
    readonly position: Position3D
    readonly timestamp: number
  }>
}

// エラーハンドリングパターン
export const handlePlayerError = <A>(
  effect: Effect.Effect<A, PlayerSystemErrors.PlayerNotFoundError | PlayerSystemErrors.InvalidMovementError>
): Effect.Effect<A | null, never> =>
  effect.pipe(
    Effect.catchTags({
      "PlayerSystem.PlayerNotFoundError": (error) =>
        Effect.gen(function* () {
          yield* Effect.logError(`プレイヤーが見つかりません: ${error.playerId}`)
          yield* NotificationService.pipe(
            Effect.flatMap(service => service.showError("プレイヤーが見つかりません"))
          )
          return null
        }),
      "PlayerSystem.InvalidMovementError": (error) =>
        Effect.gen(function* () {
          yield* Effect.logWarning(`不正な移動: ${error.reason}`)
          // プレイヤーを前の位置に戻す
          yield* PlayerService.pipe(
            Effect.flatMap(service => service.updatePosition({
              playerId: error.playerId,
              position: error.currentPosition,
              rotation: { yaw: 0, pitch: 0 }
            }))
          )
          return null
        })
    })
  )
```

## サービス統合

### Layer定義

```typescript
// プレイヤーシステム全体のLayer構成
export const PlayerSystemLayer = Layer.mergeAll(
  PlayerServiceLive,
  PlayerMovementServiceLive,
  PlayerInventoryServiceLive,
  PlayerActionProcessorLive,
  PlayerHealthSystemLive,
  PlayerSyncServiceLive
).pipe(
  Layer.provide(Layer.mergeAll(
    PlayerRepositoryLive,
    EventBusServiceLive,
    PhysicsServiceLive,
    CollisionServiceLive,
    NetworkServiceLive
  ))
)

// アプリケーション全体での使用
export const MinecraftApp = Effect.gen(function* () {
  // プレイヤーシステム初期化
  const playerService = yield* PlayerService
  const movementService = yield* PlayerMovementService

  // メインゲームループ
  yield* gameLoop
}).pipe(
  Effect.provide(PlayerSystemLayer)
)
```

## 関連ドキュメント

**Core Systems**:
- [Player System Specification](../02-specifications/00-core-features/02-player-system.md) - プレイヤーシステム詳細仕様
- [Inventory System](../02-specifications/00-core-features/01-inventory-system.md) - インベントリシステム仕様
- [Health & Hunger System](../02-specifications/00-core-features/12-health-hunger-system.md) - 体力・空腹度システム

**API Design**:
- [Domain & Application APIs](../02-specifications/02-api-design/00-domain-application-apis.md) - ドメイン・アプリケーション層API
- [Event Bus Specification](../02-specifications/02-api-design/02-event-bus-specification.md) - イベントバス仕様

**Architecture**:
- [Effect-TS Patterns](../01-architecture/06-effect-ts-patterns.md) - Effect-TSパターン詳細
- [ECS Integration](../01-architecture/05-ecs-integration.md) - ECS統合アーキテクチャ

**Reference**:
- [Effect-TS Schema API](./effect-ts-schema-api.md) - Schema API詳細
- [Game World API](./game-world-api.md) - ワールド管理API

## 用語集

- **Aggregate (アグリゲート)**: DDDにおけるビジネスルール管理単位 ([詳細](../04-appendix/00-glossary.md#aggregate))
- **Effect (エフェクト)**: Effect-TSの副作用管理型 ([詳細](../04-appendix/00-glossary.md#effect))
- **Entity Component System (ECS)**: ゲーム開発アーキテクチャ ([詳細](../04-appendix/00-glossary.md#ecs))
- **Schema (スキーマ)**: Effect-TSの型安全なデータ定義 ([詳細](../04-appendix/00-glossary.md#schema))
- **Service (サービス)**: ビジネスロジックを含むオブジェクト ([詳細](../04-appendix/00-glossary.md#service))

このAPIリファレンスにより、TypeScript Minecraftクローンの実装者は型安全で保守性の高いプレイヤー管理システムを構築できます。