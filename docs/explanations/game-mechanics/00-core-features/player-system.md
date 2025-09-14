---
title: "プレイヤーシステム仕様 - エンティティ管理・状態制御・物理演算"
description: "プレイヤーエンティティの移動、状態管理、インベントリ統合の完全仕様。Effect-TSによるアグリゲートパターンと純粋関数型実装。"
category: "specification"
difficulty: "intermediate"
tags: ["player-system", "entity-management", "state-management", "physics", "inventory-integration", "ddd-aggregate"]
prerequisites: ["effect-ts-fundamentals", "schema-basics", "ddd-concepts"]
estimated_reading_time: "15分"
related_patterns: ["data-modeling-patterns", "service-patterns", "error-handling-patterns"]
related_docs: ["./01-inventory-system.md", "./04-entity-system.md", "../../01-architecture/05-ecs-integration.md"]
---

# プレイヤーシステム - プレイヤー管理システム

## 概要

プレイヤーシステムは、TypeScript Minecraftクローンにおけるプレイヤーの全操作と状態を管理する中核システムです。Effect-TS 3.17+の最新パターン（Schema.Struct、Context.GenericTag、Match.value）とDDDの集約パターンを使用し、純粋関数型プログラミングでプレイヤーの複雑な状態管理を実現します。

### 責務と機能範囲

**主要責務**:
- **エンティティ管理**: プレイヤーエンティティの作成・更新・削除
- **状態管理**: 位置、体力、インベントリ、装備の統合管理
- **物理演算**: 移動、ジャンプ、衝突検出の処理
- **アクション処理**: プレイヤーの全行動の統一インターフェース
- **権限制御**: ゲームモード別の能力制限

**提供機能**:
- **3D移動システム**: 物理法則準拠の移動・ジャンプ・飛行
- **インベントリ管理**: 45スロット（36+9）の完全管理
- **装備システム**: 6部位の装備管理と効果適用
- **生存メカニクス**: 体力・空腹度・経験値管理
- **入力ハンドリング**: キーボード・マウス操作の統合処理
- **マルチプレイヤー対応**: 同期・競合状態の解決

### アーキテクチャ原則

1. **不変性**: 全ての状態変更は新しいインスタンス生成
2. **型安全性**: Schema.Structによる実行時型検証
3. **エラーハンドリング**: Tagged Unionによる明示的エラー管理
4. **単一責務**: 機能ごとのサービス分離
5. **テスタビリティ**: 純粋関数による決定的動作

## ドメインモデル

### プレイヤーアグリゲート

```typescript
import { Effect, Layer, Context, Schema, pipe, Match, STM, Ref, Stream } from "effect"
import { Brand, Option } from "effect"

// 値オブジェクト - 最新のEffect-TSパターン (Schema.Struct使用)
export const PlayerId = Schema.String.pipe(
  Schema.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  Schema.brand("PlayerId")
)
export type PlayerId = Schema.Schema.Type<typeof PlayerId>

export const PlayerName = Schema.String.pipe(
  Schema.minLength(3),
  Schema.maxLength(16),
  Schema.pattern(/^[a-zA-Z0-9_]+$/),
  Schema.brand("PlayerName")
)
export type PlayerName = Schema.Schema.Type<typeof PlayerName>

export const Experience = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.brand("Experience")
)
export type Experience = Schema.Schema.Type<typeof Experience>

// 座標系の値オブジェクト
export const Position3D = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})
export type Position3D = Schema.Schema.Type<typeof Position3D>

export const Rotation = Schema.Struct({
  yaw: Schema.Number.pipe(Schema.between(-180, 180)),
  pitch: Schema.Number.pipe(Schema.between(-90, 90))
})
export type Rotation = Schema.Schema.Type<typeof Rotation>

export const Velocity3D = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number
})
export type Velocity3D = Schema.Schema.Type<typeof Velocity3D>

// プレイヤーステータス - Schema.Structによる型安全な定義
export const PlayerStats = Schema.Struct({
  health: pipe(
    Schema.Number,
    Schema.between(0, 20),
    Schema.brand("Health")
  ),
  hunger: pipe(
    Schema.Number,
    Schema.between(0, 20),
    Schema.brand("Hunger")
  ),
  saturation: pipe(
    Schema.Number,
    Schema.between(0, 20),
    Schema.brand("Saturation")
  ),
  experience: Experience,
  level: pipe(
    Schema.Number,
    Schema.int(),
    Schema.nonNegative(),
    Schema.brand("Level")
  ),
  armor: pipe(
    Schema.Number,
    Schema.between(0, 20),
    Schema.brand("Armor")
  )
})
export type PlayerStats = Schema.Schema.Type<typeof PlayerStats>

// インベントリ
export const ItemStack = Schema.Struct({
  itemId: Schema.String.pipe(Schema.brand("ItemId")),
  count: pipe(Schema.Number, Schema.int(), Schema.between(1, 64)),
  damage: pipe(Schema.Number, Schema.int(), Schema.between(0, 1000)),
  enchantments: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      level: pipe(Schema.Number, Schema.int(), Schema.between(1, 5))
    })
  ),
  nbt: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
})

export type ItemStack = Schema.Schema.Type<typeof ItemStack>

export const Inventory = Schema.Struct({
  slots: Schema.Array(
    Schema.Union(ItemStack, Schema.Null)
  ).pipe(Schema.itemsCount(36)), // 9x4 インベントリスロット
  hotbar: Schema.Array(
    Schema.Union(ItemStack, Schema.Null)
  ).pipe(Schema.itemsCount(9)),
  selectedSlot: pipe(Schema.Number, Schema.int(), Schema.between(0, 8))
})

// 装備
export const Equipment = Schema.Struct({
  helmet: Schema.Union(ItemStack, Schema.Null),
  chestplate: Schema.Union(ItemStack, Schema.Null),
  leggings: Schema.Union(ItemStack, Schema.Null),
  boots: Schema.Union(ItemStack, Schema.Null),
  mainHand: Schema.Union(ItemStack, Schema.Null),
  offHand: Schema.Union(ItemStack, Schema.Null)
})

// プレイヤーアグリゲートルート
export const Player = Schema.Struct({
  id: PlayerId,
  name: PlayerName,
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  rotation: Schema.Struct({
    yaw: pipe(Schema.Number, Schema.between(-180, 180)),
    pitch: pipe(Schema.Number, Schema.between(-90, 90))
  }),
  velocity: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  stats: PlayerStats,
  inventory: Inventory,
  equipment: Equipment,
  gameMode: Schema.Literal("survival", "creative", "adventure", "spectator"),
  abilities: Schema.Struct({
    canFly: Schema.Boolean,
    isFlying: Schema.Boolean,
    canBreakBlocks: Schema.Boolean,
    canPlaceBlocks: Schema.Boolean,
    invulnerable: Schema.Boolean,
    walkSpeed: Schema.Number,
    flySpeed: Schema.Number
  })
})

export type Player = Schema.Schema.Type<typeof Player>
```

## プレイヤー移動システム

### 移動サービス

```typescript
// プレイヤー移動サービスインターフェース
interface PlayerMovementServiceInterface {
  readonly move: (
    player: Player,
    direction: Direction,
    deltaTime: number
  ) => Effect.Effect<Player, MovementError>

  readonly jump: (player: Player) => Effect.Effect<Player, JumpError>

  readonly applyPhysics: (
    player: Player,
    deltaTime: number
  ) => Effect.Effect<Player, never>

  readonly checkCollisions: (
    player: Player,
    world: World
  ) => Effect.Effect<CollisionResult, never>
}

// Context Tag（最新パターン）
const PlayerMovementService = Context.GenericTag<PlayerMovementServiceInterface>("@app/PlayerMovementService")

// Live実装作成関数 - STMとRefを使った並行状態管理
const makePlayerMovementService = Effect.gen(function* () {
  const physics = yield* PhysicsService
  const collision = yield* CollisionService
  const playerStateRef = yield* Ref.make(new Map<PlayerId, Player>())

    const move = (player: Player, direction: Direction, deltaTime: number) =>
      Effect.gen(function* () {
        // STMによる安全な状態更新
        return yield* STM.atomically(
          STM.gen(function* () {
            // 早期リターン: 移動不可条件をチェック
            if (player.gameMode === "spectator") {
              return player
            }

            // ゲームモードによる移動速度調整
            const speed = player.gameMode === "creative" && player.abilities.isFlying
              ? player.abilities.flySpeed
              : player.abilities.walkSpeed

            // 移動ベクトル計算
            const moveVector = calculateMoveVector(
              direction,
              player.rotation,
              speed,
              deltaTime
            )

            // スプリント判定
            const isSprinting = direction.sprint && player.stats.hunger > 6
            const finalSpeed = isSprinting ? speed * 1.3 : speed

            // 新しい位置計算
            const newPosition = {
              x: player.position.x + moveVector.x * finalSpeed,
              y: player.position.y + moveVector.y,
              z: player.position.z + moveVector.z * finalSpeed
            }

            // Match パターンで移動結果を決定
            return Match.value({ isSprinting, player, newPosition, deltaTime }).pipe(
              Match.when(
                ({ isSprinting }) => isSprinting,
                ({ player, newPosition, deltaTime }) => {
                  const newHunger = Math.max(0, player.stats.hunger - 0.1 * deltaTime)
                  return {
                    ...player,
                    position: newPosition,
                    stats: { ...player.stats, hunger: newHunger }
                  }
                }
              ),
              Match.orElse(({ player, newPosition }) => ({ ...player, position: newPosition }))
            )
          })
        )
      })

    const jump = (player: Player) =>
      Effect.gen(function* () {
        // 地面判定
        const isOnGround = yield* physics.isOnGround(player)

        // 早期リターン: ジャンプ不可条件をチェック
        if (!isOnGround && player.gameMode !== "creative") {
          return yield* Effect.fail(new NotOnGroundError())
        }

        // ジャンプ力計算
        const jumpVelocity = player.gameMode === "creative"
          ? 0.5
          : 0.42 // バニラMinecraftのジャンプ力

        // ジャンプブーストエフェクト考慮
        const jumpBoost = yield* getJumpBoostLevel(player)
        const finalJumpVelocity = jumpVelocity * (1 + jumpBoost * 0.1)

        // 空腹度消費
        const newHunger = Math.max(0, player.stats.hunger - 0.05)

        return {
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
      })

    const applyPhysics = (player: Player, deltaTime: number) =>
      Effect.gen(function* () {
        // 重力適用
        const gravity = player.gameMode === "creative" && player.abilities.isFlying
          ? 0
          : -9.81 * 2 // Minecraftの重力は現実の約2倍

        // 速度更新
        const newVelocity = {
          x: player.velocity.x * 0.98, // 空気抵抗
          y: player.velocity.y + gravity * deltaTime,
          z: player.velocity.z * 0.98
        }

        // 位置更新
        const newPosition = {
          x: player.position.x + newVelocity.x * deltaTime,
          y: player.position.y + newVelocity.y * deltaTime,
          z: player.position.z + newVelocity.z * deltaTime
        }

        // 衝突検出と解決
        const collisionResult = yield* collision.checkPlayerCollision(
          player,
          newPosition
        )

        if (collisionResult.hasCollision) {
          // 衝突時の速度リセット
          if (collisionResult.axis === "y" && newVelocity.y < 0) {
            // 落下ダメージ計算
            const fallDistance = Math.abs(newVelocity.y) * deltaTime
            if (fallDistance > 3 && player.gameMode === "survival") {
              const damage = Math.floor(fallDistance - 3)
              yield* applyFallDamage(player, damage)
            }
            newVelocity.y = 0
          }
        }

        return {
          ...player,
          position: collisionResult.resolvedPosition ?? newPosition,
          velocity: newVelocity
        }
      })

    // 権限チェック関数群
    const checkMovePermission = (player: Player, direction: Direction) =>
      Effect.succeed(
        player.gameMode !== "spectator" || player.abilities.canFly
      )

    const checkJumpPermission = (player: Player) =>
      Effect.succeed(
        player.gameMode !== "spectator"
      )

    return PlayerMovementService.of({
      move,
      jump,
      applyPhysics,
      checkCollisions: collision.checkPlayerCollision,
      checkMovePermission,
      checkJumpPermission
    })
  })

// Live Layer
export const PlayerMovementServiceLive = Layer.effect(
  PlayerMovementService,
  makePlayerMovementService
)
```

## インベントリ管理

### インベントリサービス

```typescript
// インベントリサービスインターフェース
interface InventoryServiceInterface {
  readonly addItem: (
    player: Player,
    item: ItemStack
  ) => Effect.Effect<Player, InventoryFullError>

  readonly removeItem: (
    player: Player,
    slotIndex: number,
    count: number
  ) => Effect.Effect<Player, ItemNotFoundError>

  readonly moveItem: (
    player: Player,
    fromSlot: number,
    toSlot: number
  ) => Effect.Effect<Player, InvalidSlotError>

  readonly equipItem: (
    player: Player,
    slotIndex: number
  ) => Effect.Effect<Player, EquipError>

  readonly craftItem: (
    player: Player,
    recipe: CraftingRecipe
  ) => Effect.Effect<Player, CraftingError>
}

// Context Tag（最新パターン）
const InventoryService = Context.GenericTag<InventoryServiceInterface>("@app/InventoryService")

// Live実装
export const InventoryServiceLive = Layer.succeed(
  InventoryService,
  InventoryService.of({
    addItem: (player, item) =>
      Effect.gen(function* () {
        // 既存スタックへの追加を試みる
        const inventory = player.inventory
        const maxStackSize = getMaxStackSize(item.itemId)

        // 同じアイテムのスタックを探す
        for (let i = 0; i < inventory.slots.length; i++) {
          const slot = inventory.slots[i]

          // 早期リターン: スタック可能チェック
          if (!slot || slot.itemId !== item.itemId || slot.count >= maxStackSize) {
            continue
          }

          const addAmount = Math.min(maxStackSize - slot.count, item.count)
          const newSlot = { ...slot, count: slot.count + addAmount }
          const remainingCount = item.count - addAmount

          const updatedInventory = {
            ...inventory,
            slots: inventory.slots.map((s, idx) => idx === i ? newSlot : s)
          }

          // 残りがあれば再帰的に追加
          if (remainingCount > 0) {
            return yield* addItem(
              { ...player, inventory: updatedInventory },
              { ...item, count: remainingCount }
            )
          }

          return { ...player, inventory: updatedInventory }
        }

        // 早期リターン: 空きスロットチェック
        const emptySlotIndex = inventory.slots.findIndex(s => s === null)
        if (emptySlotIndex === -1) {
          return yield* Effect.fail(new InventoryFullError())
        }

        const updatedInventory = {
          ...inventory,
          slots: inventory.slots.map((s, idx) =>
            idx === emptySlotIndex ? item : s
          )
        }

        return { ...player, inventory: updatedInventory }
      }),

    removeItem: (player, slotIndex, count) =>
      Effect.gen(function* () {
        const slot = player.inventory.slots[slotIndex]

        // 早期リターン: アイテムが存在しない場合
        if (!slot) {
          return yield* Effect.fail(new ItemNotFoundError(slotIndex))
        }

        // 早期リターン: アイテム数不足の場合
        if (slot.count < count) {
          return yield* Effect.fail(
            new InsufficientItemsError(slot.count, count)
          )
        }

        const newCount = slot.count - count
        const updatedSlot = newCount > 0 ? { ...slot, count: newCount } : null

        return {
          ...player,
          inventory: {
            ...player.inventory,
            slots: player.inventory.slots.map((s, idx) =>
              idx === slotIndex ? updatedSlot : s
            )
          }
        }
      }),

    equipItem: (player, slotIndex) =>
      Effect.gen(function* () {
        const item = player.inventory.slots[slotIndex]

        // 早期リターン: アイテムが存在しない場合
        if (!item) {
          return yield* Effect.fail(new ItemNotFoundError(slotIndex))
        }

        const equipmentSlot = getEquipmentSlot(item.itemId)

        // 早期リターン: 装備不可アイテムの場合
        if (!equipmentSlot) {
          return yield* Effect.fail(new NotEquipableError(item.itemId))
        }

        // 現在の装備と入れ替え
        const currentEquipment = player.equipment[equipmentSlot]

        return {
          ...player,
          inventory: {
            ...player.inventory,
            slots: player.inventory.slots.map((s, idx) =>
              idx === slotIndex ? currentEquipment : s
            )
          },
          equipment: {
            ...player.equipment,
            [equipmentSlot]: item
          }
        }
      }),

    craftItem: (player, recipe) =>
      Effect.gen(function* () {
        // レシピ材料チェック
        const hasIngredients = yield* checkIngredients(
          player.inventory,
          recipe.ingredients
        )

        if (!hasIngredients) {
          return yield* Effect.fail(new MissingIngredientsError())
        }

        // 材料消費
        const inventoryAfterConsume = yield* consumeIngredients(
          player.inventory,
          recipe.ingredients
        )

        // 結果アイテム追加
        const playerWithConsumed = {
          ...player,
          inventory: inventoryAfterConsume
        }

        return yield* addItem(playerWithConsumed, recipe.result)
      })
  })
)
```

## プレイヤーアクション

### アクション処理

```typescript
// PlayerActionをtagged unionで定義
export type PlayerAction =
  | { readonly _tag: "Move"; readonly direction: Direction }
  | { readonly _tag: "Jump" }
  | { readonly _tag: "Attack"; readonly target: EntityId }
  | { readonly _tag: "UseItem"; readonly item: ItemStack; readonly target?: Position }
  | { readonly _tag: "PlaceBlock"; readonly position: Position; readonly face: BlockFace }
  | { readonly _tag: "BreakBlock"; readonly position: Position }
  | { readonly _tag: "OpenContainer"; readonly position: Position }
  | { readonly _tag: "DropItem"; readonly slotIndex: number; readonly count: number }

// PlayerActionProcessorインターフェース
interface PlayerActionProcessorInterface {
  readonly process: (
    player: Player,
    action: PlayerAction
  ) => Effect.Effect<Player, ActionError>
}

// Context Tag（最新パターン）
const PlayerActionProcessor = Context.GenericTag<PlayerActionProcessorInterface>("@app/PlayerActionProcessor")

// Live実装作成関数
const makePlayerActionProcessor = Effect.gen(function* () {
  const movement = yield* PlayerMovementService
  const inventory = yield* InventoryService
  const world = yield* WorldService
  const combat = yield* CombatService

    const process = (player: Player, action: PlayerAction) =>
      Match.value(action).pipe(
        Match.tag("Move", ({ direction }) =>
          Effect.gen(function* () {
            // 権限チェック
            const canMove = yield* checkMovePermission(player, direction)
            if (!canMove) {
              return yield* Effect.fail(new PermissionDeniedError("Movement not allowed"))
            }
            return yield* movement.move(player, direction, 0.05)
          })
        ),
        Match.tag("Jump", () =>
          Effect.gen(function* () {
            // 権限チェック
            const canJump = yield* checkJumpPermission(player)
            if (!canJump) {
              return yield* Effect.fail(new PermissionDeniedError("Jump not allowed"))
            }
            return yield* movement.jump(player)
          })
        ),
        Match.tag("Attack", ({ target }) =>
          Effect.gen(function* () {
            // 権限チェック
            const canAttack = yield* checkAttackPermission(player, target)
            if (!canAttack) {
              return yield* Effect.fail(new PermissionDeniedError("Attack not allowed"))
            }

            const damage = yield* calculateAttackDamage(player)
            yield* combat.dealDamage(target, damage, player.id)
            return player
          })
        ),
        Match.tag("PlaceBlock", ({ position, face }) =>
          Effect.gen(function* () {
            // 早期リターン: 権限チェック
            const canPlace = yield* checkPlaceBlockPermission(player, position)
            if (!canPlace) {
              return yield* Effect.fail(new PermissionDeniedError("Block placement not allowed"))
            }

            // レイキャスト判定
            const canReach = yield* checkReach(
              player.position,
              position,
              player.gameMode === "creative" ? 5 : 4.5
            )

            if (!canReach) {
              return yield* Effect.fail(new OutOfReachError())
            }

            // ブロック設置
            const blockItem = player.inventory.hotbar[player.inventory.selectedSlot]
            if (!blockItem || !isBlockItem(blockItem.itemId)) {
              return yield* Effect.fail(new InvalidBlockError())
            }

            yield* world.setBlock(position, blockItem.itemId)

            // サバイバルモードでアイテム消費
            if (player.gameMode === "survival") {
              return yield* inventory.removeItem(
                player,
                player.inventory.selectedSlot,
                1
              )
            }

            return player
          })
        ),
        Match.tag("BreakBlock", ({ position }) =>
          Effect.gen(function* () {
            // 早期リターン: 権限チェック
            const canBreak = yield* checkBreakBlockPermission(player, position)
            if (!canBreak) {
              return yield* Effect.fail(new PermissionDeniedError("Block breaking not allowed"))
            }

            const canReach = yield* checkReach(
              player.position,
              position,
              player.gameMode === "creative" ? 5 : 4.5
            )

            if (!canReach) {
              return yield* Effect.fail(new OutOfReachError())
            }

            // ブロック破壊
            const block = yield* world.getBlock(position)
            yield* world.breakBlock(position)

            // アイテムドロップ（サバイバルモード）
            if (player.gameMode === "survival") {
              const drops = yield* calculateBlockDrops(block, player.equipment.mainHand)
              for (const drop of drops) {
                yield* spawnItemEntity(position, drop)
              }
            }

            return player
          })
        ),
        Match.tag("UseItem", ({ item, target }) =>
          Effect.gen(function* () {
            // 早期リターン: 権限チェック
            const canUseItem = yield* checkUseItemPermission(player, item)
            if (!canUseItem) {
              return yield* Effect.fail(new PermissionDeniedError("Item use not allowed"))
            }

            const currentItem = player.inventory.hotbar[player.inventory.selectedSlot]
            if (!currentItem) {
              return yield* Effect.fail(new NoItemError())
            }

            const useResult = yield* useItem(currentItem, player, target)

            if (useResult.consumed && player.gameMode === "survival") {
              return yield* inventory.removeItem(
                player,
                player.inventory.selectedSlot,
                1
              )
            }

            return useResult.player
          })
        ),
        Match.orElse(() => Effect.succeed(player))
      )

    // 権限チェック関数群の実装
    const checkAttackPermission = (player: Player, target: EntityId) =>
      Effect.succeed(
        player.gameMode !== "spectator" && player.abilities.canBreakBlocks
      )

    const checkPlaceBlockPermission = (player: Player, position: Position3D) =>
      Effect.succeed(
        player.gameMode !== "spectator" && player.abilities.canPlaceBlocks
      )

    const checkBreakBlockPermission = (player: Player, position: Position3D) =>
      Effect.succeed(
        player.gameMode !== "spectator" && player.abilities.canBreakBlocks
      )

    const checkUseItemPermission = (player: Player, item: ItemStack) =>
      Effect.succeed(
        player.gameMode !== "spectator"
      )

    return PlayerActionProcessor.of({
      process,
      checkAttackPermission,
      checkPlaceBlockPermission,
      checkBreakBlockPermission,
      checkUseItemPermission
    })
  })

// Live Layer
export const PlayerActionProcessorLive = Layer.effect(
  PlayerActionProcessor,
  makePlayerActionProcessor
)
```

## 体力 & 空腹システム

### 体力管理

```typescript
// HealthSystemインターフェース
interface HealthSystemInterface {
  readonly damage: (
    player: Player,
    amount: number,
    source: DamageSource
  ) => Effect.Effect<Player, PlayerDeathError>

  readonly heal: (
    player: Player,
    amount: number
  ) => Effect.Effect<Player, never>

  readonly updateHunger: (
    player: Player,
    deltaTime: number
  ) => Effect.Effect<Player, never>

  readonly regenerate: (
    player: Player,
    deltaTime: number
  ) => Effect.Effect<Player, never>
}

// Context Tag（最新パターン）
const HealthSystem = Context.GenericTag<HealthSystemInterface>("@app/HealthSystem")

export const HealthSystemLive = Layer.succeed(
  HealthSystem,
  HealthSystem.of({
    damage: (player, amount, source) =>
      Effect.gen(function* () {
        if (player.abilities.invulnerable) {
          return player
        }

        // アーマー計算
        const finalDamage = calculateDamageWithArmor(
          amount,
          player.stats.armor,
          source
        )

        const newHealth = Math.max(0, player.stats.health - finalDamage)

        if (newHealth === 0) {
          yield* handlePlayerDeath(player, source)
          return yield* Effect.fail(new PlayerDeathError(player.id, source))
        }

        return {
          ...player,
          stats: { ...player.stats, health: newHealth }
        }
      }),

    heal: (player, amount) =>
      Effect.succeed({
        ...player,
        stats: {
          ...player.stats,
          health: Math.min(20, player.stats.health + amount)
        }
      }),

    updateHunger: (player, deltaTime) =>
      Effect.gen(function* () {
        if (player.gameMode === "creative") {
          return player
        }

        // 空腹度減少
        const hungerDecrease = 0.005 * deltaTime
        const newHunger = Math.max(0, player.stats.hunger - hungerDecrease)

        // 飽和度減少
        const saturationDecrease = newHunger < 20 ? 0.01 * deltaTime : 0
        const newSaturation = Math.max(
          0,
          player.stats.saturation - saturationDecrease
        )

        return {
          ...player,
          stats: {
            ...player.stats,
            hunger: newHunger,
            saturation: newSaturation
          }
        }
      }),

    regenerate: (player, deltaTime) =>
      Effect.gen(function* () {
        // 自然回復条件
        if (player.stats.hunger >= 18 && player.stats.health < 20) {
          const healAmount = 0.5 * deltaTime
          const newHealth = Math.min(20, player.stats.health + healAmount)

          // 飽和度消費
          const saturationCost = 0.6 * deltaTime
          const newSaturation = Math.max(
            0,
            player.stats.saturation - saturationCost
          )

          return {
            ...player,
            stats: {
              ...player.stats,
              health: newHealth,
              saturation: newSaturation
            }
          }
        }

        return player
      })
  })
)
```

## 完全なプレイヤーレイヤー

```typescript
// 完全なプレイヤーシステムレイヤー - 最新のLayer.merge パターン
export const PlayerSystemLayer = Layer.mergeAll(
  PlayerMovementServiceLive,
  InventoryServiceLive,
  PlayerActionProcessorLive,
  HealthSystemLive,
  PlayerECSSystemLive,
  InputServiceLive,
  PlayerSyncServiceLive
).pipe(
  Layer.provide(PhysicsServiceLive),
  Layer.provide(CollisionServiceLive),
  Layer.provide(WorldServiceLive),
  Layer.provide(CombatServiceLive),
  Layer.provide(NetworkServiceLive)
)
```

## ECS統合パターン

### Structure of Arrays (SoA) ECS実装

プレイヤーシステムはECSアーキテクチャと密接に統合され、高性能な処理を実現します。

```typescript
// ECSコンポーネント定義
export const PlayerComponent = Schema.Struct({
  id: PlayerId,
  name: PlayerName
})

export const TransformComponent = Schema.Struct({
  position: Position3D,
  rotation: Rotation,
  scale: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  })
})

export const PhysicsComponent = Schema.Struct({
  velocity: Velocity3D,
  acceleration: Velocity3D,
  mass: Schema.Number.pipe(Schema.positive()),
  friction: Schema.Number.pipe(Schema.between(0, 1)),
  restitution: Schema.Number.pipe(Schema.between(0, 1)),
  isOnGround: Schema.Boolean,
  isCollidingX: Schema.Boolean,
  isCollidingY: Schema.Boolean,
  isCollidingZ: Schema.Boolean
})

export const StatsComponent = Schema.Struct({
  ...PlayerStats.fields,
  lastDamageTime: Schema.Number,
  lastHealTime: Schema.Number,
  lastHungerUpdate: Schema.Number
})

// ECS World定義
export interface PlayerWorld {
  readonly entities: ReadonlyArray<EntityId>
  readonly components: {
    readonly player: Map<EntityId, PlayerComponent>
    readonly transform: Map<EntityId, TransformComponent>
    readonly physics: Map<EntityId, PhysicsComponent>
    readonly stats: Map<EntityId, StatsComponent>
    readonly inventory: Map<EntityId, Inventory>
    readonly equipment: Map<EntityId, Equipment>
  }
}

// ECS System Interface
interface PlayerECSSystemInterface {
  readonly createPlayerEntity: (
    player: Player
  ) => Effect.Effect<EntityId, EntityCreationError>

  readonly updatePlayerMovement: (
    world: PlayerWorld,
    deltaTime: number
  ) => Effect.Effect<PlayerWorld, never>

  readonly updatePlayerStats: (
    world: PlayerWorld,
    deltaTime: number
  ) => Effect.Effect<PlayerWorld, never>

  readonly queryPlayersByPosition: (
    world: PlayerWorld,
    center: Position3D,
    radius: number
  ) => Effect.Effect<ReadonlyArray<EntityId>, never>
}

// Context Tag（最新パターン）
const PlayerECSSystem = Context.GenericTag<PlayerECSSystemInterface>("@app/PlayerECSSystem")

// アーキタイプベースクエリ
const makePlayerECSSystem = Effect.gen(function* () {
  // アーキタイプマップ（高速検索用）
  const playerArchetype = new Set<EntityId>()
  const movingPlayersArchetype = new Set<EntityId>()

  const createPlayerEntity = (player: Player) =>
    Effect.gen(function* () {
      const entityId = yield* generateEntityId()

      // コンポーネント追加
      world.components.player.set(entityId, {
        id: player.id,
        name: player.name
      })

      world.components.transform.set(entityId, {
        position: player.position,
        rotation: player.rotation,
        scale: { x: 1, y: 1, z: 1 }
      })

      world.components.physics.set(entityId, {
        velocity: player.velocity,
        acceleration: { x: 0, y: 0, z: 0 },
        mass: 70, // プレイヤーの標準質量（kg）
        friction: 0.8,
        restitution: 0.1,
        isOnGround: false,
        isCollidingX: false,
        isCollidingY: false,
        isCollidingZ: false
      })

      // アーキタイプ登録
      playerArchetype.add(entityId)
      if (player.velocity.x !== 0 || player.velocity.y !== 0 || player.velocity.z !== 0) {
        movingPlayersArchetype.add(entityId)
      }

      return entityId
    })

  // SIMD最適化対応バッチ処理
  const updatePlayerMovement = (world: PlayerWorld, deltaTime: number) =>
    Effect.gen(function* () {
      // 移動中プレイヤーのバッチ処理
      const movingEntities = Array.from(movingPlayersArchetype)

      // TypedArrayでSIMD最適化
      const positions = new Float32Array(movingEntities.length * 3)
      const velocities = new Float32Array(movingEntities.length * 3)

      // データを平坦化配列に変換
      movingEntities.forEach((entityId, index) => {
        const transform = world.components.transform.get(entityId)!
        const physics = world.components.physics.get(entityId)!

        positions[index * 3] = transform.position.x
        positions[index * 3 + 1] = transform.position.y
        positions[index * 3 + 2] = transform.position.z

        velocities[index * 3] = physics.velocity.x
        velocities[index * 3 + 1] = physics.velocity.y
        velocities[index * 3 + 2] = physics.velocity.z
      })

      // バッチ物理計算（WebWorkerで並列化可能）
      yield* Effect.forEach(
        movingEntities,
        (entityId, index) => Effect.gen(function* () {
          const newX = positions[index * 3] + velocities[index * 3] * deltaTime
          const newY = positions[index * 3 + 1] + velocities[index * 3 + 1] * deltaTime
          const newZ = positions[index * 3 + 2] + velocities[index * 3 + 2] * deltaTime

          // コンポーネント更新
          const transform = world.components.transform.get(entityId)!
          world.components.transform.set(entityId, {
            ...transform,
            position: { x: newX, y: newY, z: newZ }
          })
        }),
        { concurrency: "unbounded" } // 並列実行
      )

      return world
    })

  return PlayerECSSystem.of({
    createPlayerEntity,
    updatePlayerMovement,
    updatePlayerStats: updatePlayerStatsSystem,
    queryPlayersByPosition: spatialQuery
  })
})

export const PlayerECSSystemLive = Layer.effect(PlayerECSSystem, makePlayerECSSystem)
```

## 入力ハンドリング

### 入力サービス

```typescript
// 入力イベントのSchema定義
export const InputEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("KeyDown"),
    key: Schema.String,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("KeyUp"),
    key: Schema.String,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("MouseMove"),
    deltaX: Schema.Number,
    deltaY: Schema.Number,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("MouseDown"),
    button: Schema.Union(
      Schema.Literal("left"),
      Schema.Literal("right"),
      Schema.Literal("middle")
    ),
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("MouseUp"),
    button: Schema.Union(
      Schema.Literal("left"),
      Schema.Literal("right"),
      Schema.Literal("middle")
    ),
    timestamp: Schema.Number
  })
)
export type InputEvent = Schema.Schema.Type<typeof InputEvent>

// 入力状態管理 - Schema.Structによる型安全な定義
export const InputState = Schema.Struct({
  keys: Schema.Record(Schema.String, Schema.Boolean),
  mouseButtons: Schema.Struct({
    left: Schema.Boolean,
    right: Schema.Boolean,
    middle: Schema.Boolean
  }),
  mouseDelta: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number
  }),
  lastUpdateTime: Schema.Number
})
export type InputState = Schema.Schema.Type<typeof InputState>

interface InputServiceInterface {
  readonly processInput: (
    events: ReadonlyArray<InputEvent>
  ) => Effect.Effect<InputState, never>

  readonly getMovementDirection: (
    state: InputState
  ) => Effect.Effect<Direction, never>

  readonly getMouseLook: (
    state: InputState,
    sensitivity: number
  ) => Effect.Effect<{ deltaYaw: number; deltaPitch: number }, never>
}

// Context Tag（最新パターン）
const InputService = Context.GenericTag<InputServiceInterface>("@app/InputService")

const makeInputService = Effect.gen(function* () {
  const inputState = yield* Ref.make<InputState>({
    keys: {},
    mouseButtons: { left: false, right: false, middle: false },
    mouseDelta: { x: 0, y: 0 },
    lastUpdateTime: Date.now()
  })

  // Streamによる入力イベントハンドリング
  const inputEventStream = yield* Stream.fromEventEmitter(
    () => globalInputEventEmitter,
    (error) => new InputProcessingError(error)
  )

  const processInput = (events: ReadonlyArray<InputEvent>) =>
    Effect.gen(function* () {
      // STMによる安全な状態更新
      return yield* STM.atomically(
        STM.gen(function* () {
          const currentState = yield* STM.fromRef(inputState)
          let newState = currentState

          // Streamを使った効率的なイベント処理
          const processedEvents = yield* Stream.fromIterable(events).pipe(
            Stream.map(event =>
              Match.value(event).pipe(
                Match.tag("KeyDown", ({ key }) => ({
                  ...newState,
                  keys: { ...newState.keys, [key]: true }
                })),
                Match.tag("KeyUp", ({ key }) => ({
                  ...newState,
                  keys: { ...newState.keys, [key]: false }
                })),
                Match.tag("MouseMove", ({ deltaX, deltaY }) => ({
                  ...newState,
                  mouseDelta: { x: deltaX, y: deltaY }
                })),
                Match.tag("MouseDown", ({ button }) => ({
                  ...newState,
                  mouseButtons: { ...newState.mouseButtons, [button]: true }
                })),
                Match.tag("MouseUp", ({ button }) => ({
                  ...newState,
                  mouseButtons: { ...newState.mouseButtons, [button]: false }
                }))
              )
            ),
            Stream.runLast
          )

          const finalState = {
            ...processedEvents.pipe(Option.getOrElse(() => newState)),
            lastUpdateTime: Date.now()
          }

          yield* STM.updateRef(inputState, () => finalState)
          return finalState
        })
      )
    })

  const getMovementDirection = (state: InputState) =>
    Effect.succeed({
      forward: state.keys["KeyW"] || state.keys["ArrowUp"] || false,
      backward: state.keys["KeyS"] || state.keys["ArrowDown"] || false,
      left: state.keys["KeyA"] || state.keys["ArrowLeft"] || false,
      right: state.keys["KeyD"] || state.keys["ArrowRight"] || false,
      jump: state.keys["Space"] || false,
      sneak: state.keys["ShiftLeft"] || false,
      sprint: state.keys["ControlLeft"] || false
    })

  const getMouseLook = (state: InputState, sensitivity: number) =>
    Effect.succeed({
      deltaYaw: state.mouseDelta.x * sensitivity * 0.1,
      deltaPitch: -state.mouseDelta.y * sensitivity * 0.1 // Y軸反転
    })

  return InputService.of({
    processInput,
    getMovementDirection,
    getMouseLook
  })
})

export const InputServiceLive = Layer.effect(InputService, makeInputService)
```

## マルチプレイヤー対応設計

### プレイヤー同期サービス

```typescript
// ネットワーク同期用データ構造
export const PlayerSyncData = Schema.Struct({
  playerId: PlayerId,
  position: Position3D,
  rotation: Rotation,
  velocity: Velocity3D,
  animationState: Schema.String,
  timestamp: Schema.Number,
  sequenceNumber: Schema.Number
})
export type PlayerSyncData = Schema.Schema.Type<typeof PlayerSyncData>

export const PlayerSnapshot = Schema.Struct({
  players: Schema.Array(PlayerSyncData),
  serverTime: Schema.Number,
  tickNumber: Schema.Number
})
export type PlayerSnapshot = Schema.Schema.Type<typeof PlayerSnapshot>

interface PlayerSyncServiceInterface {
  readonly sendPlayerUpdate: (
    player: Player
  ) => Effect.Effect<void, NetworkError>

  readonly receivePlayerUpdates: () => Effect.Effect<
    ReadonlyArray<PlayerSyncData>,
    NetworkError
  >

  readonly interpolatePlayerPosition: (
    playerId: PlayerId,
    currentTime: number
  ) => Effect.Effect<Option.Option<Position3D>, never>

  readonly predictPlayerMovement: (
    player: Player,
    input: InputState,
    deltaTime: number
  ) => Effect.Effect<Player, never>
}

// Context Tag（最新パターン）
const PlayerSyncService = Context.GenericTag<PlayerSyncServiceInterface>("@app/PlayerSyncService")

const makePlayerSyncService = Effect.gen(function* () {
  const networkService = yield* NetworkService
  const interpolationBuffer = yield* Ref.make(new Map<PlayerId, PlayerSyncData[]>())

  const sendPlayerUpdate = (player: Player) =>
    Effect.gen(function* () {
      const syncData: PlayerSyncData = {
        playerId: player.id,
        position: player.position,
        rotation: player.rotation,
        velocity: player.velocity,
        animationState: determineAnimationState(player),
        timestamp: Date.now(),
        sequenceNumber: yield* getNextSequenceNumber()
      }

      yield* networkService.send("player_update", syncData)
    })

  const receivePlayerUpdates = () =>
    Effect.gen(function* () {
      const updates = yield* networkService.receive<PlayerSyncData[]>("player_updates")

      // 補間バッファに追加
      yield* Ref.update(interpolationBuffer, buffer => {
        updates.forEach(update => {
          const playerBuffer = buffer.get(update.playerId) || []
          playerBuffer.push(update)

          // 古いデータを削除（1秒以上古い）
          const cutoffTime = Date.now() - 1000
          const filteredBuffer = playerBuffer.filter(
            data => data.timestamp > cutoffTime
          ).slice(-10) // 最新10個のみ保持

          buffer.set(update.playerId, filteredBuffer)
        })

        return buffer
      })

      return updates
    })

  const interpolatePlayerPosition = (playerId: PlayerId, currentTime: number) =>
    Effect.gen(function* () {
      const buffer = yield* Ref.get(interpolationBuffer)
      const playerData = buffer.get(playerId)

      if (!playerData || playerData.length < 2) {
        return Option.none()
      }

      // 線形補間
      const sorted = playerData.sort((a, b) => a.timestamp - b.timestamp)

      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i]
        const next = sorted[i + 1]

        if (currentTime >= current.timestamp && currentTime <= next.timestamp) {
          const t = (currentTime - current.timestamp) /
                   (next.timestamp - current.timestamp)

          return Option.some({
            x: current.position.x + (next.position.x - current.position.x) * t,
            y: current.position.y + (next.position.y - current.position.y) * t,
            z: current.position.z + (next.position.z - current.position.z) * t
          })
        }
      }

      return Option.none()
    })

  // クライアント側予測
  const predictPlayerMovement = (player: Player, input: InputState, deltaTime: number) =>
    Effect.gen(function* () {
      const movementService = yield* PlayerMovementService
      const direction = yield* InputService.pipe(
        Effect.flatMap(service => service.getMovementDirection(input))
      )

      // ローカル予測実行
      const predictedPlayer = yield* movementService.move(player, direction, deltaTime)

      return predictedPlayer
    })

  return PlayerSyncService.of({
    sendPlayerUpdate,
    receivePlayerUpdates,
    interpolatePlayerPosition,
    predictPlayerMovement
  })
})

export const PlayerSyncServiceLive = Layer.effect(PlayerSyncService, makePlayerSyncService)
```

## テスト戦略とパフォーマンス考慮

### Property-Based Testing

```typescript
import * as fc from "fast-check"
import { Schema } from "effect"

// プロパティベーステストの設定
describe("プレイヤーシステムのプロパティテスト", () => {
  // 位置計算の性質テスト
  test("移動は決定的であるべき", () => {
    fc.assert(fc.property(
      fc.record({
        x: fc.float({ min: -1000, max: 1000 }),
        y: fc.float({ min: -1000, max: 1000 }),
        z: fc.float({ min: -1000, max: 1000 })
      }),
      fc.record({
        x: fc.float({ min: -10, max: 10 }),
        y: fc.float({ min: -10, max: 10 }),
        z: fc.float({ min: -10, max: 10 })
      }),
      fc.float({ min: 0.001, max: 0.1 }),
      (position, velocity, deltaTime) => {
        const player = createTestPlayer({ position, velocity })
        const direction = { forward: true, backward: false, left: false, right: false, jump: false, sneak: false, sprint: false }

        // 同じ入力は同じ結果を生成する
        const result1 = runMovement(player, direction, deltaTime)
        const result2 = runMovement(player, direction, deltaTime)

        expect(result1.position).toEqual(result2.position)
      }
    ))
  })

  // インベントリ整合性テスト
  test("インベントリ操作は一貫性を保つべき", () => {
    fc.assert(fc.property(
      generateValidPlayer(),
      generateValidItemStack(),
      (player, item) => {
        const result = addItemToInventory(player, item)

        // アイテム追加後、総アイテム数は増加するか同じ
        const originalCount = countTotalItems(player.inventory)
        const newCount = countTotalItems(result.inventory)

        expect(newCount).toBeGreaterThanOrEqual(originalCount)
      }
    ))
  })
})

// パフォーマンステスト
describe("パフォーマンステスト", () => {
  test("1000人のプレイヤーを効率的に処理すべき", () => {
    const players = Array.from({ length: 1000 }, () => createTestPlayer())

    const startTime = performance.now()

    // バッチ処理実行
    const updatedPlayers = updateAllPlayers(players, 0.016) // 60 FPS

    const endTime = performance.now()
    const duration = endTime - startTime

    // 16ms以内で完了する必要がある（60 FPS維持）
    expect(duration).toBeLessThan(16)
  })

  test("ECSクエリのパフォーマンス", () => {
    const world = createTestWorld(10000) // 10k entities

    const startTime = performance.now()

    // 空間クエリ実行
    const nearbyPlayers = queryPlayersByPosition(
      world,
      { x: 0, y: 0, z: 0 },
      100 // 半径100ブロック
    )

    const endTime = performance.now()
    const duration = endTime - startTime

    // 空間クエリは1ms以内で完了
    expect(duration).toBeLessThan(1)
  })
})

// メモリ使用量テスト
describe("メモリ使用量テスト", () => {
  test("継続的なプレイ中にメモリリークしないべき", () => {
    const initialMemory = getMemoryUsage()

    // 1000フレーム分のシミュレーション
    for (let i = 0; i < 1000; i++) {
      const players = Array.from({ length: 100 }, () => createTestPlayer())
      updateAllPlayers(players, 0.016)

      // ガベージコレクション強制実行
      if (global.gc) global.gc()
    }

    const finalMemory = getMemoryUsage()
    const memoryIncrease = finalMemory - initialMemory

    // メモリ増加は10MB以下
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
  })
})

// 統合テスト - 最新のLayer.merge パターン
export const PlayerSystemTestLayer = Layer.mergeAll(
  PlayerSystemLayer,
  TestInputServiceLive,
  TestNetworkServiceLive,
  TestWorldServiceLive,
  TestPhysicsServiceLive,
  TestCollisionServiceLive
)

// テスト用ヘルパー関数
export const runPlayerSystemTest = <A, E>(effect: Effect.Effect<A, E, PlayerSystemTestLayer>) =>
  effect.pipe(
    Effect.provide(PlayerSystemTestLayer),
    Effect.runPromise
  )
```

### パフォーマンス最適化戦略

```typescript
// WebWorkerベース並列処理
interface PlayerWorkerPoolInterface {
  readonly processPlayerPhysics: (playerData: ReadonlyArray<PlayerPhysicsData>) => Effect.Effect<ReadonlyArray<PlayerPhysicsData>, WorkerError>
  readonly terminate: () => Effect.Effect<void, never>
}

interface WorkerTask {
  readonly data: ReadonlyArray<PlayerPhysicsData>
  readonly deferred: DeferredInterface<ReadonlyArray<PlayerPhysicsData>>
}

// Context Tag（最新パターン）
const PlayerWorkerPool = Context.GenericTag<PlayerWorkerPoolInterface>("@app/PlayerWorkerPool")

// PlayerWorkerPool実装の作成関数
const makePlayerWorkerPool = (poolSize?: number): Effect.Effect<PlayerWorkerPoolInterface, never, never> =>
  Effect.gen(function* () {
    const effectivePoolSize = poolSize ?? (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4) || 4
    const workers = new Array<Worker>()
    const taskQueue = new Array<WorkerTask>()

    // Worker初期化
    const initWorkers = Effect.sync(() => {
      for (let i = 0; i < effectivePoolSize; i++) {
        const worker = new Worker('/player-physics-worker.js')

        worker.onmessage = (event) => {
          const task = taskQueue.shift()
          if (task) {
            task.deferred.resolve(event.data)
          }
        }

        worker.onerror = (error) => {
          const task = taskQueue.shift()
          if (task) {
            task.deferred.reject(new WorkerError({ message: error.message }))
          }
        }

        workers.push(worker)
      }
    })

    yield* initWorkers

    const processPlayerPhysics = (playerData: ReadonlyArray<PlayerPhysicsData>) =>
      Effect.gen(function* () {
        const deferred = makeDeferred<ReadonlyArray<PlayerPhysicsData>>()
        const task: WorkerTask = { data: playerData, deferred }

        taskQueue.push(task)

        // 利用可能なWorkerを見つけて処理を投げる
        const availableWorker = workers.find(w => w.onmessage !== null)
        if (availableWorker) {
          availableWorker.postMessage({
            type: 'PROCESS_PHYSICS',
            data: playerData
          })
        }

        return yield* Effect.fromPromise(() => deferred.promise)
      })

    const terminate = Effect.sync(() => {
      workers.forEach(worker => worker.terminate())
      workers.length = 0
      taskQueue.length = 0
    })

    return {
      processPlayerPhysics,
      terminate
    }
  })

export const PlayerWorkerPoolLive = Layer.effect(PlayerWorkerPool, makePlayerWorkerPool())

// メモリプール実装
interface PlayerObjectPoolInterface {
  readonly getPlayer: () => Effect.Effect<Player, never>
  readonly returnPlayer: (player: Player) => Effect.Effect<void, never>
  readonly getPosition: () => Effect.Effect<Position3D, never>
  readonly returnPosition: (position: Position3D) => Effect.Effect<void, never>
  readonly getVelocity: () => Effect.Effect<Velocity3D, never>
  readonly returnVelocity: (velocity: Velocity3D) => Effect.Effect<void, never>
}

// Context Tag（最新パターン）
const PlayerObjectPool = Context.GenericTag<PlayerObjectPoolInterface>("@app/PlayerObjectPool")

// PlayerObjectPool実装の作成関数
const makePlayerObjectPool = Effect.gen(function* () {
  const playerPool = new Array<Player>()
  const positionPool = new Array<Position3D>()
  const velocityPool = new Array<Velocity3D>()

  const getPlayer = Effect.sync(() =>
    playerPool.pop() ?? createEmptyPlayer()
  )

  const returnPlayer = (player: Player) =>
    Effect.sync(() => {
      resetPlayer(player)
      playerPool.push(player)
    })

  const getPosition = Effect.sync(() =>
    positionPool.pop() ?? { x: 0, y: 0, z: 0 }
  )

  const returnPosition = (position: Position3D) =>
    Effect.sync(() => {
      position.x = 0
      position.y = 0
      position.z = 0
      positionPool.push(position)
    })

  const getVelocity = Effect.sync(() =>
    velocityPool.pop() ?? { x: 0, y: 0, z: 0 }
  )

  const returnVelocity = (velocity: Velocity3D) =>
    Effect.sync(() => {
      velocity.x = 0
      velocity.y = 0
      velocity.z = 0
      velocityPool.push(velocity)
    })

  return {
    getPlayer,
    returnPlayer,
    getPosition,
    returnPosition,
    getVelocity,
    returnVelocity
  }
})

export const PlayerObjectPoolLive = Layer.effect(PlayerObjectPool, makePlayerObjectPool)

// キャッシュ戦略
export const PlayerCache = Effect.gen(function* () {
  const cache = yield* Cache.make({
    capacity: 1000,
    timeToLive: "5 minutes",
    lookup: (playerId: PlayerId) => loadPlayerFromStorage(playerId)
  })

  return {
    getPlayer: (playerId: PlayerId) => Cache.get(cache, playerId),
    invalidatePlayer: (playerId: PlayerId) => Cache.invalidate(cache, playerId),
    refreshPlayer: (playerId: PlayerId) => Cache.refresh(cache, playerId)
  }
})
```

## 実装まとめ

プレイヤーシステムは、Effect-TS 3.17+の最新パターンを活用して実装された高性能な分散システムです。

### 主要特徴

1. **型安全性**: Schema.Structによる実行時型検証
2. **関数型設計**: 純粋関数による副作用の分離
3. **高性能**: ECSアーキテクチャによるデータ指向設計
4. **スケーラビリティ**: マルチプレイヤー対応とクラスタリング
5. **テスタビリティ**: PBTによる網羅的テスト戦略

### 技術スタック

- **Effect-TS 3.17+**: 関数型プログラミング基盤
- **Schema.Struct**: データ構造定義と検証
- **Context.GenericTag クラス**: 型安全な依存性注入
- **Match.value**: パターンマッチング
- **Layer.effect**: サービス組み立て
- **STM**: 並行状態管理
- **Ref**: 可変状態の安全な管理
- **Stream**: 効率的なデータストリーム処理
- **Fiber**: 軽量並列処理
- **Schema.Struct**: データ構造定義と検証
- **Context.GenericTag**: 依存性注入
- **Match.value**: パターンマッチング
- **Layer.effect**: サービス組み立て

## 関連ドキュメント

- [インベントリシステム](./01-inventory-system.md) - プレイヤーインベントリ管理
- [物理システム](./06-physics-system.md) - プレイヤー移動と衝突検知
- [体力 & 空腹システム](./12-health-hunger-system.md) - プレイヤー生存システム
- [入力制御](./18-input-controls.md) - プレイヤー入力処理
- [エンティティシステム](./04-entity-system.md) - プレイヤーエンティティ統合
- [ワールド管理システム](./01-world-management-system.md) - ワールドとの相互作用
- [ECS統合](../../01-architecture/05-ecs-integration.md) - ECSアーキテクチャ詳細

## 用語集

- **アグリゲート (Aggregate)**: DDDにおけるビジネスルール管理単位 ([詳細](../../04-appendix/00-glossary.md#aggregate))
- **コンポーネント (Component)**: ECSのデータ管理単位 ([詳細](../../04-appendix/00-glossary.md#component))
- **Effect (エフェクト)**: Effect-TSの副作用管理 ([詳細](../../04-appendix/00-glossary.md#effect))
- **エンティティ (Entity)**: ECSの識別子とDDDのドメインオブジェクト ([詳細](../../04-appendix/00-glossary.md#entity))
- **スキーマ (Schema)**: Effect-TSの型安全なデータ定義 ([詳細](../../04-appendix/00-glossary.md#schema))
- **システム (System)**: ECSの処理ロジック ([詳細](../../04-appendix/00-glossary.md#system))

この実装により、TypeScript Minecraftクローンは高品質で保守可能なプレイヤーシステムを実現できます。

### 最新Effect-TSパターンの特徴

1. **Context.GenericTag クラス**: より型安全な依存性注入
2. **STM活用**: 並行状態更新の安全性確保
3. **Stream統合**: 効率的なイベント処理
4. **Ref状態管理**: 可変状態の安全な管理
5. **早期リターンパターン**: 効率的な条件分岐
6. **Match.value**: 型安全なパターンマッチング
7. **権限チェック統合**: セキュリティの組み込み
8. **Fiber並列処理**: 高パフォーマンスな非同期処理

これらのパターンにより、スケーラブルで型安全、かつ高パフォーマンスなプレイヤーシステムが実現されています。
