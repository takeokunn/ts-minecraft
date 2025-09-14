---
title: "Game Inventory API Reference"
description: "TypeScript Minecraft Clone インベントリ管理システムの完全APIリファレンス。Effect-TS 3.17+による型安全なアイテム管理の実装者向けガイド。"
category: "reference"
difficulty: "intermediate"
tags: ["api-reference", "inventory-management", "effect-ts", "domain-api", "game-inventory"]
prerequisites: ["effect-ts-basics", "schema-fundamentals", "typescript-advanced"]
estimated_reading_time: "20分"
related_patterns: ["service-patterns", "data-modeling-patterns", "validation-patterns"]
related_docs: ["../../explanations/game-mechanics/core-features/inventory-system.md", "./game-player-api.md", "./core-apis.md"]
search_keywords:
  primary: ["inventory-api", "minecraft-inventory", "item-management", "game-api"]
  secondary: ["item-stack", "slot-management", "inventory-operations"]
  context: ["minecraft-development", "game-programming", "api-reference"]
---

# Game Inventory API Reference

TypeScript Minecraft Clone インベントリ管理システムの完全APIリファレンスです。Effect-TS 3.17+による型安全なアイテム管理、スロット操作、装備管理の実装方法を詳解します。

## 📋 概要

インベントリ管理システムは以下の主要な責務を持ちます：

- **アイテム管理**: アイテムスタックの作成、変更、削除、結合
- **スロット操作**: インベントリ内でのアイテムの配置、移動、交換
- **装備管理**: 防具と主要装備の着脱、効果計算
- **アイテム転送**: コンテナ間での安全なアイテム移動
- **永続化**: インベントリデータの効率的なセーブ・ロード
- **検証**: アイテム操作の整合性チェックとエラーハンドリング

## 🏗️ 主要インターフェース

### InventoryService - コアインベントリ操作

```typescript
import { Effect, Context, Schema } from "effect"

export interface InventoryService {
  readonly addItem: (params: Schema.Schema.Type<typeof AddItemParams>) => Effect.Effect<boolean, InventoryError>
  readonly removeItem: (params: Schema.Schema.Type<typeof RemoveItemParams>) => Effect.Effect<ItemStack | null, InventoryError>
  readonly moveItem: (params: Schema.Schema.Type<typeof MoveItemParams>) => Effect.Effect<void, InventoryError>
  readonly swapItems: (params: Schema.Schema.Type<typeof SwapItemsParams>) => Effect.Effect<void, InventoryError>
  readonly mergeStacks: (params: Schema.Schema.Type<typeof MergeStacksParams>) => Effect.Effect<boolean, InventoryError>
  readonly splitStack: (params: Schema.Schema.Type<typeof SplitStackParams>) => Effect.Effect<ItemStack, InventoryError>
  readonly clearSlot: (params: Schema.Schema.Type<typeof ClearSlotParams>) => Effect.Effect<ItemStack | null, never>
  readonly getSlotItem: (params: Schema.Schema.Type<typeof GetSlotParams>) => Effect.Effect<ItemStack | null, InventoryNotFoundError>
  readonly validateInventory: (inventory: Inventory) => Effect.Effect<boolean, ValidationError>
}

export const InventoryService = Context.GenericTag<InventoryService>("@app/InventoryService")
```

### EquipmentService - 装備管理

```typescript
export interface EquipmentService {
  readonly equipItem: (params: Schema.Schema.Type<typeof EquipItemParams>) => Effect.Effect<Equipment, EquipmentError>
  readonly unequipItem: (params: Schema.Schema.Type<typeof UnequipItemParams>) => Effect.Effect<Equipment, EquipmentError>
  readonly getEquippedItem: (params: Schema.Schema.Type<typeof GetEquippedParams>) => Effect.Effect<ItemStack | null, never>
  readonly calculateArmorValue: (equipment: Equipment) => Effect.Effect<number, never>
  readonly calculateDamageReduction: (params: Schema.Schema.Type<typeof DamageReductionParams>) => Effect.Effect<number, never>
  readonly applyEquipmentEffects: (equipment: Equipment) => Effect.Effect<ReadonlyArray<StatusEffect>, never>
}

export const EquipmentService = Context.GenericTag<EquipmentService>("@app/EquipmentService")
```

## 📊 データ構造

### コア型定義

```typescript
// ブランド型定義（型安全性確保）
export const ItemId = Schema.String.pipe(
  Schema.pattern(/^[a-z]+:[a-z_]+$/),
  Schema.brand("ItemId")
)
export type ItemId = Schema.Schema.Type<typeof ItemId>

export const SlotIndex = Schema.Number.pipe(
  Schema.int(),
  Schema.between(0, 44), // 45スロット（36メイン + 9ホットバー）
  Schema.brand("SlotIndex")
)
export type SlotIndex = Schema.Schema.Type<typeof SlotIndex>

export const ItemQuantity = Schema.Number.pipe(
  Schema.int(),
  Schema.between(1, 64),
  Schema.brand("ItemQuantity")
)
export type ItemQuantity = Schema.Schema.Type<typeof ItemQuantity>

export const DurabilityValue = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand("DurabilityValue")
)
export type DurabilityValue = Schema.Schema.Type<typeof DurabilityValue>
```

### ItemStack - アイテムスタック

```typescript
export const ItemStack = Schema.Struct({
  itemId: ItemId,
  quantity: ItemQuantity,
  durability: Schema.optional(DurabilityValue),
  enchantments: Schema.optional(Schema.Array(Enchantment)),
  metadata: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown
  })),
  nbt: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
}).annotations({
  identifier: "ItemStack",
  description: "アイテムスタック - アイテムの基本単位"
})
export type ItemStack = Schema.Schema.Type<typeof ItemStack>

// エンチャント定義
export const Enchantment = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("EnchantmentId")),
  level: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 10)
  )
}).annotations({
  identifier: "Enchantment"
})
export type Enchantment = Schema.Schema.Type<typeof Enchantment>
```

### Inventory - インベントリ構造

```typescript
export const Inventory = Schema.Struct({
  // メインインベントリ（27スロット）
  main: Schema.Array(Schema.NullOr(ItemStack)).pipe(
    Schema.itemsCount(27)
  ),

  // ホットバー（9スロット）
  hotbar: Schema.Array(Schema.NullOr(ItemStack)).pipe(
    Schema.itemsCount(9)
  ),

  // 選択中スロット（ホットバー内）
  selectedSlot: Schema.Number.pipe(
    Schema.int(),
    Schema.between(0, 8),
    Schema.brand("HotbarSlot")
  ),

  // 装備スロット
  armor: Equipment,

  // オフハンド
  offhand: Schema.NullOr(ItemStack)
}).annotations({
  identifier: "Inventory",
  description: "プレイヤーインベントリ - 45スロット構成"
})
export type Inventory = Schema.Schema.Type<typeof Inventory>
```

### Equipment - 装備システム

```typescript
export const Equipment = Schema.Struct({
  helmet: Schema.NullOr(ItemStack),
  chestplate: Schema.NullOr(ItemStack),
  leggings: Schema.NullOr(ItemStack),
  boots: Schema.NullOr(ItemStack),
  mainhand: Schema.NullOr(ItemStack),
  offhand: Schema.NullOr(ItemStack)
}).annotations({
  identifier: "Equipment",
  description: "プレイヤー装備 - 6部位管理"
})
export type Equipment = Schema.Schema.Type<typeof Equipment>
```

## 🔧 API操作パラメータ

### インベントリ操作パラメータ

```typescript
// アイテム追加
export const AddItemParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  item: ItemStack,
  preferredSlot: Schema.optional(SlotIndex),
  allowPartialAdd: Schema.Boolean.pipe(Schema.withDefault(() => true))
}).annotations({
  identifier: "AddItemParams"
})

// アイテム削除
export const RemoveItemParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  slot: SlotIndex,
  quantity: Schema.optional(ItemQuantity)
}).annotations({
  identifier: "RemoveItemParams"
})

// アイテム移動
export const MoveItemParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  fromSlot: SlotIndex,
  toSlot: SlotIndex,
  quantity: Schema.optional(ItemQuantity)
}).annotations({
  identifier: "MoveItemParams"
})

// アイテム交換
export const SwapItemsParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  slot1: SlotIndex,
  slot2: SlotIndex
}).annotations({
  identifier: "SwapItemsParams"
})
```

### 装備操作パラメータ

```typescript
// 装備着用
export const EquipItemParams = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  slot: SlotIndex,
  equipmentSlot: Schema.Literal(
    "helmet", "chestplate", "leggings", "boots", "mainhand", "offhand"
  )
}).annotations({
  identifier: "EquipItemParams"
})

// ダメージ軽減計算
export const DamageReductionParams = Schema.Struct({
  equipment: Equipment,
  damageAmount: Schema.Number.pipe(Schema.nonNegative()),
  damageType: Schema.Literal(
    "physical", "fire", "explosion", "projectile", "magic", "fall"
  )
}).annotations({
  identifier: "DamageReductionParams"
})
```

## ⚠️ エラー型定義

```typescript
// インベントリエラー
export const InventoryError = Schema.TaggedUnion("_tag", {
  InventoryFull: Schema.Struct({
    _tag: Schema.Literal("InventoryFull"),
    availableSpace: Schema.Number,
    requiredSpace: Schema.Number
  }),

  InvalidSlot: Schema.Struct({
    _tag: Schema.Literal("InvalidSlot"),
    slot: Schema.Number,
    maxSlot: Schema.Number
  }),

  InsufficientItems: Schema.Struct({
    _tag: Schema.Literal("InsufficientItems"),
    requested: Schema.Number,
    available: Schema.Number
  }),

  ItemNotStackable: Schema.Struct({
    _tag: Schema.Literal("ItemNotStackable"),
    itemId: ItemId
  }),

  StackSizeExceeded: Schema.Struct({
    _tag: Schema.Literal("StackSizeExceeded"),
    current: Schema.Number,
    maximum: Schema.Number
  })
})
export type InventoryError = Schema.Schema.Type<typeof InventoryError>

// 装備エラー
export const EquipmentError = Schema.TaggedUnion("_tag", {
  InvalidEquipmentSlot: Schema.Struct({
    _tag: Schema.Literal("InvalidEquipmentSlot"),
    itemType: Schema.String,
    attemptedSlot: Schema.String
  }),

  EquipmentSlotOccupied: Schema.Struct({
    _tag: Schema.Literal("EquipmentSlotOccupied"),
    slot: Schema.String,
    occupiedBy: ItemId
  }),

  DurabilityTooLow: Schema.Struct({
    _tag: Schema.Literal("DurabilityTooLow"),
    current: Schema.Number,
    required: Schema.Number
  })
})
export type EquipmentError = Schema.Schema.Type<typeof EquipmentError>
```

## 🎯 実装例

### InventoryService実装

```typescript
export const InventoryServiceLive = Layer.effect(
  InventoryService,
  Effect.gen(function* () {
    const playerService = yield* PlayerService
    const itemRegistry = yield* ItemRegistry

    const addItem = (params: Schema.Schema.Type<typeof AddItemParams>) =>
      Effect.gen(function* () {
        const validated = yield* Schema.decodeUnknown(AddItemParams)(params)
        const player = yield* playerService.findById(validated.playerId)

        // 既存スタックへの追加を試みる
        const existingSlotResult = yield* findMatchingStack(
          player.inventory,
          validated.item
        )

        if (Option.isSome(existingSlotResult)) {
          return yield* addToExistingStack(
            player,
            existingSlotResult.value,
            validated.item
          )
        }

        // 空きスロットに新規配置
        const emptySlot = yield* findEmptySlot(player.inventory, validated.preferredSlot)
        if (Option.isSome(emptySlot)) {
          return yield* placeInEmptySlot(player, emptySlot.value, validated.item)
        }

        // インベントリ満杯
        return yield* Effect.fail(
          InventoryError.InventoryFull({
            availableSpace: 0,
            requiredSpace: validated.item.quantity
          })
        )
      })

    const removeItem = (params: Schema.Schema.Type<typeof RemoveItemParams>) =>
      Effect.gen(function* () {
        const validated = yield* Schema.decodeUnknown(RemoveItemParams)(params)
        const player = yield* playerService.findById(validated.playerId)

        const slot = getInventorySlot(player.inventory, validated.slot)
        if (!slot) {
          return null
        }

        const removeQuantity = validated.quantity ?? slot.quantity
        if (removeQuantity > slot.quantity) {
          return yield* Effect.fail(
            InventoryError.InsufficientItems({
              requested: removeQuantity,
              available: slot.quantity
            })
          )
        }

        const remainingQuantity = slot.quantity - removeQuantity
        const removedItem: ItemStack = { ...slot, quantity: removeQuantity }

        if (remainingQuantity > 0) {
          const updatedSlot = { ...slot, quantity: remainingQuantity }
          yield* updateInventorySlot(player, validated.slot, updatedSlot)
        } else {
          yield* clearInventorySlot(player, validated.slot)
        }

        return removedItem
      })

    return InventoryService.of({
      addItem,
      removeItem,
      moveItem: implementMoveItem,
      swapItems: implementSwapItems,
      mergeStacks: implementMergeStacks,
      splitStack: implementSplitStack,
      clearSlot: implementClearSlot,
      getSlotItem: implementGetSlotItem,
      validateInventory: implementValidateInventory
    })
  })
)
```

### EquipmentService実装

```typescript
export const EquipmentServiceLive = Layer.effect(
  EquipmentService,
  Effect.gen(function* () {
    const playerService = yield* PlayerService
    const itemRegistry = yield* ItemRegistry

    const equipItem = (params: Schema.Schema.Type<typeof EquipItemParams>) =>
      Effect.gen(function* () {
        const validated = yield* Schema.decodeUnknown(EquipItemParams)(params)
        const player = yield* playerService.findById(validated.playerId)

        const item = getInventorySlot(player.inventory, validated.slot)
        if (!item) {
          return yield* Effect.fail(
            InventoryError.InvalidSlot({
              slot: validated.slot,
              maxSlot: 44
            })
          )
        }

        // アイテムタイプが装備スロットと適合するかチェック
        const isValidForSlot = yield* itemRegistry.canEquipToSlot(
          item.itemId,
          validated.equipmentSlot
        )

        if (!isValidForSlot) {
          return yield* Effect.fail(
            EquipmentError.InvalidEquipmentSlot({
              itemType: item.itemId,
              attemptedSlot: validated.equipmentSlot
            })
          )
        }

        // 現在の装備を外してインベントリに戻す
        const currentEquipment = player.equipment[validated.equipmentSlot]
        if (currentEquipment) {
          yield* inventoryService.addItem({
            playerId: validated.playerId,
            item: currentEquipment,
            allowPartialAdd: false
          })
        }

        // 新しい装備を着用
        const updatedEquipment = {
          ...player.equipment,
          [validated.equipmentSlot]: item
        }

        // インベントリから削除
        yield* inventoryService.clearSlot({
          playerId: validated.playerId,
          slot: validated.slot
        })

        yield* playerService.updateEquipment(validated.playerId, updatedEquipment)

        return updatedEquipment
      })

    const calculateArmorValue = (equipment: Equipment) =>
      Effect.gen(function* () {
        let totalArmor = 0

        const armorPieces = [
          equipment.helmet,
          equipment.chestplate,
          equipment.leggings,
          equipment.boots
        ]

        for (const piece of armorPieces) {
          if (piece) {
            const armorValue = yield* itemRegistry.getArmorValue(piece.itemId)
            totalArmor += armorValue
          }
        }

        return Math.min(totalArmor, 20) // 最大20ポイント
      })

    return EquipmentService.of({
      equipItem,
      unequipItem: implementUnequipItem,
      getEquippedItem: implementGetEquippedItem,
      calculateArmorValue,
      calculateDamageReduction: implementDamageReduction,
      applyEquipmentEffects: implementEquipmentEffects
    })
  })
)
```

## 🚀 使用例

### 基本的なインベントリ操作

```typescript
import { Effect } from "effect"

// アイテム追加例
const addDiamondSword = Effect.gen(function* () {
  const inventoryService = yield* InventoryService

  const diamondSword: ItemStack = {
    itemId: "minecraft:diamond_sword" as ItemId,
    quantity: 1 as ItemQuantity,
    durability: 1561 as DurabilityValue,
    enchantments: [
      { id: "minecraft:sharpness" as EnchantmentId, level: 5 },
      { id: "minecraft:unbreaking" as EnchantmentId, level: 3 }
    ]
  }

  const success = yield* inventoryService.addItem({
    playerId: "player-123" as PlayerId,
    item: diamondSword,
    allowPartialAdd: false
  })

  if (success) {
    console.log("Diamond sword added to inventory")
  } else {
    console.log("Inventory full, could not add diamond sword")
  }
})

// 装備着用例
const equipArmor = Effect.gen(function* () {
  const equipmentService = yield* EquipmentService

  // ダイヤモンドヘルメットをスロット10から装備
  const newEquipment = yield* equipmentService.equipItem({
    playerId: "player-123" as PlayerId,
    slot: 10 as SlotIndex,
    equipmentSlot: "helmet"
  })

  // 防御力計算
  const armorValue = yield* equipmentService.calculateArmorValue(newEquipment)
  console.log(`New armor value: ${armorValue}`)
})

// エラーハンドリング例
const safeInventoryOperation = Effect.gen(function* () {
  const inventoryService = yield* InventoryService

  return yield* inventoryService.addItem({
    playerId: "player-123" as PlayerId,
    item: someItem,
    allowPartialAdd: true
  }).pipe(
    Effect.catchTag("InventoryFull", (error) =>
      Effect.sync(() => {
        console.log(`Inventory full: need ${error.requiredSpace}, have ${error.availableSpace}`)
        return false
      })
    ),
    Effect.catchTag("InvalidSlot", (error) =>
      Effect.sync(() => {
        console.log(`Invalid slot ${error.slot}, max is ${error.maxSlot}`)
        return false
      })
    )
  )
})
```

### 高度な使用例

```typescript
// バッチ処理による効率的なアイテム管理
const batchProcessItems = Effect.gen(function* () {
  const inventoryService = yield* InventoryService
  const items: ReadonlyArray<ItemStack> = yield* getItemsToProcess()

  // 並列処理でアイテム追加
  const results = yield* Effect.forEach(
    items,
    (item) => inventoryService.addItem({
      playerId: "player-123" as PlayerId,
      item,
      allowPartialAdd: true
    }),
    { concurrency: 5 }
  )

  const successCount = results.filter(Boolean).length
  console.log(`Successfully added ${successCount}/${items.length} items`)
})

// 装備セット一括着用
const equipArmorSet = (armorPieces: ReadonlyArray<{ slot: SlotIndex; equipmentSlot: keyof Equipment }>) =>
  Effect.gen(function* () {
    const equipmentService = yield* EquipmentService

    return yield* Effect.forEach(
      armorPieces,
      ({ slot, equipmentSlot }) => equipmentService.equipItem({
        playerId: "player-123" as PlayerId,
        slot,
        equipmentSlot
      }),
      { concurrency: "unbounded" }
    )
  })
```

## 🔗 関連リソース

### 概念的理解
- **[インベントリシステム設計](../../explanations/game-mechanics/core-features/inventory-system.md)** - システムの設計思想と概念
- **[プレイヤーシステム統合](../../explanations/game-mechanics/core-features/player-system.md)** - プレイヤーとの連携パターン

### 実装ガイド
- **[基本ゲーム開発チュートリアル](../../tutorials/basic-game-development/README.md)** - 段階的実装手順
- **[Effect-TS活用パターン](../../how-to/development/effect-ts-migration-guide.md)** - Effect-TSの効果的な使い方

### API統合
- **[プレイヤーAPI](./game-player-api.md)** - プレイヤーシステムとの連携
- **[コアAPI](../api/core-apis.md)** - 基盤システムとの統合
- **[ドメインAPI](../api/domain-apis.md)** - ドメイン横断的な機能

## 🎯 実装チェックリスト

### 基本機能
- [ ] ItemStack型定義と検証
- [ ] Inventory構造実装
- [ ] Equipment管理システム
- [ ] 基本的なCRUD操作
- [ ] エラーハンドリング

### 高度な機能
- [ ] アイテム結合・分割ロジック
- [ ] 装備効果計算
- [ ] バッチ処理最適化
- [ ] 並行処理対応
- [ ] キャッシュ戦略

### 品質保証
- [ ] Property-based testing
- [ ] パフォーマンステスト
- [ ] メモリリーク検証
- [ ] エラー境界テスト
- [ ] 統合テストスイート

この APIリファレンスにより、TypeScript Minecraft Clone の完全なインベントリシステムを型安全に実装できます。Effect-TS の最新パターンを活用し、高性能でスケーラブルなゲーム体験を提供します。