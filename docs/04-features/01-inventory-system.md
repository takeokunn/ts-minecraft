# インベントリシステム

## 1. 概要

Minecraft クローンのインベントリシステムは、アイテムの保管、管理、転送を担当します。DDD の境界づけられたコンテキストとして設計され、ECS アーキテクチャと統合されています。

## 2. ドメインモデル

### 2.1 アイテム定義

```typescript
import { Schema } from "effect"

// アイテムスキーマ（最新のSchemaパターン）
export const ItemStack = Schema.Struct({
  _tag: Schema.Literal("ItemStack"),
  itemId: Schema.String.pipe(Schema.brand("ItemId")),
  count: Schema.Number.pipe(Schema.between(1, 64)),
  metadata: Schema.optional(
    Schema.Struct({
      durability: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
      enchantments: Schema.optional(Schema.Array(Schema.String)),
      customName: Schema.optional(Schema.String)
    })
  )
})

export type ItemStack = Schema.Schema.Type<typeof ItemStack>

// アイテム定義（型安全性強化）
export const ItemDefinition = Schema.Struct({
  _tag: Schema.Literal("ItemDefinition"),
  id: Schema.String.pipe(Schema.brand("ItemId")),
  name: Schema.String,
  maxStackSize: Schema.Number.pipe(Schema.between(1, 64)),
  category: Schema.Literal("block", "tool", "weapon", "armor", "food", "material"),
  properties: Schema.Record(Schema.String, Schema.Unknown)
})

export type ItemDefinition = Schema.Schema.Type<typeof ItemDefinition>
```

### 2.2 インベントリ構造

```typescript
import { Effect, Option, ReadonlyArray } from "effect"

// インベントリスロット（Schema定義）
const InventorySlot = Schema.Struct({
  _tag: Schema.Literal("InventorySlot"),
  index: Schema.Number,
  item: Schema.Option(ItemStack),
  acceptFilter: Schema.optional(Schema.Function)
})
type InventorySlot = Schema.Schema.Type<typeof InventorySlot>

// インベントリタイプ
const InventoryType = Schema.Literal(
  "player",
  "chest",
  "furnace",
  "crafting",
  "enchanting"
)
type InventoryType = Schema.Schema.Type<typeof InventoryType>

// インベントリインターフェース（Schema定義）
const Inventory = Schema.Struct({
  _tag: Schema.Literal("Inventory"),
  id: Schema.String.pipe(Schema.brand("InventoryId")),
  type: InventoryType,
  slots: Schema.Array(InventorySlot),
  size: Schema.Number
})
type Inventory = Schema.Schema.Type<typeof Inventory>

// インベントリ操作
export const InventoryOperations = {
  // アイテム追加（早期リターン最適化）
  addItem: (
    inventory: Inventory,
    item: ItemStack
  ): Effect.Effect<Inventory, InventoryFullError> =>
    Effect.gen(function* () {
      // Match.valueでOption処理を型安全に
      const emptySlot = ReadonlyArray.findFirst(
        inventory.slots,
        slot => Option.isNone(slot.item)
      )

      return Match.value(emptySlot).pipe(
        Match.when(Option.isNone, () =>
          Effect.fail(InventoryFullError.create(inventory.id))
        ),
        Match.when(Option.isSome, ({ value: slot }) => {
          const updatedSlots = ReadonlyArray.modify(
            inventory.slots,
            slot.index,
            s => ({ ...s, item: Option.some(item) })
          )
          return Effect.succeed({ ...inventory, slots: updatedSlots })
        }),
        Match.exhaustive
      ).pipe(Effect.flatten)
    }),

  // アイテム移動
  moveItem: (
    from: Inventory,
    to: Inventory,
    fromSlot: number,
    toSlot: number,
    amount?: number
  ): Effect.Effect<[Inventory, Inventory], ItemTransferError> =>
    Effect.gen(function* () {
      const sourceSlot = from.slots[fromSlot]

      if (Option.isNone(sourceSlot.item)) {
        return yield* Effect.fail(ItemTransferError.create("Source slot empty"))
      }

      const item = sourceSlot.item.value
      const transferAmount = amount ?? item.count

      // 転送ロジック
      const remainingInSource = item.count - transferAmount
      const updatedFrom = updateSlot(from, fromSlot,
        remainingInSource > 0
          ? Option.some({ ...item, count: remainingInSource })
          : Option.none()
      )

      const targetSlot = to.slots[toSlot]
      const updatedTo = updateSlot(to, toSlot,
        Option.some(
          Option.isSome(targetSlot.item)
            ? mergeStacks(targetSlot.item.value, { ...item, count: transferAmount })
            : { ...item, count: transferAmount }
        )
      )

      return [updatedFrom, updatedTo]
    }),

  // スタック結合
  mergeStacks: (
    inventory: Inventory
  ): Inventory => {
    // 同じアイテムのスタックを結合
    const merged = consolidateStacks(inventory.slots)
    return { ...inventory, slots: merged }
  }
}
```

## 3. ECS統合

### 3.1 インベントリコンポーネント

```typescript
// ECSコンポーネント定義
export interface InventoryComponent {
  readonly inventoryId: InventoryId
  readonly slots: number
  readonly items: ReadonlyArray<Option.Option<ItemStack>>
}

// コンポーネント登録
export const registerInventoryComponent = (): ComponentType => ({
  name: "Inventory",
  schema: Schema.Struct({
    inventoryId: Schema.String,
    slots: Schema.Number,
    items: Schema.Array(Schema.optional(ItemStack))
  })
})
```

### 3.2 インベントリシステム

```typescript
export const InventorySystem = {
  name: "InventorySystem",
  requiredComponents: ["Inventory", "Transform"],

  update: (
    entities: ReadonlyArray<EntityId>,
    components: {
      inventory: ComponentStore<InventoryComponent>,
      transform: ComponentStore<TransformComponent>
    }
  ): Effect.Effect<void, SystemError> =>
    Effect.gen(function* () {
      for (const entityId of entities) {
        const inv = yield* components.inventory.get(entityId)

        // ドロップアイテムの検出
        const nearbyItems = yield* detectNearbyItems(entityId)

        // 自動ピックアップ
        if (nearbyItems.length > 0) {
          yield* autoPickup(inv, nearbyItems)
        }
      }
    })
}
```

## 4. クライアント・サーバー同期

### 4.1 インベントリ同期プロトコル

```typescript
import { Schema } from "effect"

// インベントリ更新メッセージ
export const InventoryUpdateMessage = Schema.Struct({
  type: Schema.Literal("inventory_update"),
  playerId: Schema.String,
  inventoryId: Schema.String,
  slots: Schema.Array(
    Schema.Struct({
      index: Schema.Number,
      item: Schema.optional(ItemStack)
    })
  ),
  timestamp: Schema.Number
})

// 同期サービス
export const InventorySyncService = Layer.effect(
  InventorySyncService,
  Effect.gen(function* () {
    const network = yield* NetworkService

    return {
      syncInventory: (inventory: Inventory) =>
        Effect.gen(function* () {
          const message = createUpdateMessage(inventory)
          yield* network.broadcast(message)
        }),

      handleUpdate: (message: InventoryUpdateMessage) =>
        Effect.gen(function* () {
          const inventory = yield* getInventory(message.inventoryId)
          const updated = applyUpdate(inventory, message)
          yield* saveInventory(updated)
        })
    }
  })
)
```

## 5. UI統合

### 5.1 インベントリUI

```typescript
export interface InventoryUI {
  readonly isOpen: boolean
  readonly selectedSlot: Option.Option<number>
  readonly draggedItem: Option.Option<ItemStack>
  readonly hoveredSlot: Option.Option<number>
}

export const InventoryUIOperations = {
  // スロットクリック
  handleSlotClick: (
    ui: InventoryUI,
    inventory: Inventory,
    slotIndex: number,
    button: "left" | "right"
  ): Effect.Effect<[InventoryUI, Inventory], UIError> =>
    Effect.gen(function* () {
      const slot = inventory.slots[slotIndex]

      if (button === "left") {
        // 左クリック: アイテムピックアップ/配置
        if (Option.isSome(ui.draggedItem)) {
          // アイテム配置
          const updated = yield* placeItem(inventory, slotIndex, ui.draggedItem.value)
          return [{ ...ui, draggedItem: Option.none() }, updated]
        } else if (Option.isSome(slot.item)) {
          // アイテムピックアップ
          return [{ ...ui, draggedItem: slot.item },
                  updateSlot(inventory, slotIndex, Option.none())]
        }
      } else {
        // 右クリック: 半分分割
        if (Option.isSome(slot.item) && slot.item.value.count > 1) {
          const half = Math.floor(slot.item.value.count / 2)
          const remaining = slot.item.value.count - half

          const draggedItem = { ...slot.item.value, count: half }
          const remainingItem = { ...slot.item.value, count: remaining }

          return [
            { ...ui, draggedItem: Option.some(draggedItem) },
            updateSlot(inventory, slotIndex, Option.some(remainingItem))
          ]
        }
      }

      return [ui, inventory]
    }),

  // ドラッグ&ドロップ
  handleDragDrop: (
    ui: InventoryUI,
    fromInventory: Inventory,
    toInventory: Inventory,
    fromSlot: number,
    toSlot: number
  ): Effect.Effect<[Inventory, Inventory], DragDropError> =>
    InventoryOperations.moveItem(fromInventory, toInventory, fromSlot, toSlot)
}
```

## 6. 最適化戦略

### 6.1 メモリ効率

```typescript
// スパースインベントリ実装
export interface SparseInventory {
  readonly id: InventoryId
  readonly items: Map<number, ItemStack>  // 空スロットは保存しない
  readonly maxSize: number
}

export const SparseInventoryOperations = {
  toArray: (sparse: SparseInventory): ReadonlyArray<Option.Option<ItemStack>> => {
    const result = new Array(sparse.maxSize).fill(Option.none())
    for (const [index, item] of sparse.items) {
      result[index] = Option.some(item)
    }
    return result
  },

  fromArray: (
    id: InventoryId,
    items: ReadonlyArray<Option.Option<ItemStack>>
  ): SparseInventory => ({
    id,
    items: new Map(
      items
        .map((item, index) => [index, item] as const)
        .filter(([_, item]) => Option.isSome(item))
        .map(([index, item]) => [index, item.value])
    ),
    maxSize: items.length
  })
}
```

### 6.2 バッチ更新

```typescript
export const BatchInventoryUpdates = {
  // 複数の操作をバッチ処理
  batchOperations: <A>(
    inventory: Inventory,
    operations: ReadonlyArray<(inv: Inventory) => Effect.Effect<Inventory, any>>
  ): Effect.Effect<Inventory, BatchError> =>
    Effect.gen(function* () {
      let current = inventory
      const changes: InventoryChange[] = []

      for (const op of operations) {
        const before = current
        current = yield* op(current)
        changes.push(diffInventory(before, current))
      }

      // 一度に全変更を適用
      yield* broadcastChanges(changes)
      return current
    })
}
```

## 7. エラーハンドリング

```typescript
// エラー定義
export interface InventoryFullError {
  readonly _tag: "InventoryFullError"
  readonly inventoryId: string
}

export const InventoryFullError = {
  create: (inventoryId: string): InventoryFullError => ({
    _tag: "InventoryFullError",
    inventoryId
  })
}

export interface ItemTransferError {
  readonly _tag: "ItemTransferError"
  readonly reason: string
}

export const ItemTransferError = {
  create: (reason: string): ItemTransferError => ({
    _tag: "ItemTransferError",
    reason
  })
}

export interface InvalidStackError {
  readonly _tag: "InvalidStackError"
  readonly itemId: string
  readonly requestedCount: number
  readonly maxStack: number
}

export const InvalidStackError = {
  create: (
    itemId: string,
    requestedCount: number,
    maxStack: number
  ): InvalidStackError => ({
    _tag: "InvalidStackError",
    itemId,
    requestedCount,
    maxStack
  })
}

// エラーハンドリング
export const handleInventoryError = <A>(
  effect: Effect.Effect<A, InventoryError>
): Effect.Effect<A | null> =>
  effect.pipe(
    Effect.catchTag("InventoryFullError", (error) =>
      Effect.gen(function* () {
        yield* Effect.log(`Inventory ${error.inventoryId} is full`)
        yield* showNotification("Inventory is full!")
        return null
      })
    ),
    Effect.catchTag("ItemTransferError", (error) =>
      Effect.gen(function* () {
        yield* Effect.log(`Transfer failed: ${error.reason}`)
        return null
      })
    )
  )
```

## 8. まとめ

インベントリシステムは：
- **型安全**: Effect-TS の Schema による完全な型定義
- **不変性**: すべての操作が新しいインベントリを返す
- **ECS統合**: コンポーネントとシステムによる効率的な処理
- **エラー処理**: タグ付きエラーによる型安全なエラーハンドリング
- **最適化**: スパース実装とバッチ処理による効率化