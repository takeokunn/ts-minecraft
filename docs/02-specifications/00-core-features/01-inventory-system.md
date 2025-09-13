---
title: "01 Inventory System"
description: "01 Inventory Systemに関する詳細な説明とガイド。"
category: "specification"
difficulty: "intermediate"
tags: ['typescript', 'minecraft', 'specification']
prerequisites: ['basic-typescript']
estimated_reading_time: "10分"
last_updated: "2025-09-14"
version: "1.0.0"
---

# インベントリシステム

## 1. 概要

Minecraftクローンのインベントリシステムは、アイテムの保管、管理、転送を担当します。DDDの境界づけられたコンテキストとして設計され、ECSアーキテクチャと統合されています。

## 2. ドメインモデル

### 2.1 アイテム定義

```typescript
import { Schema, Brand, Effect, Option } from "effect"

// ブランド型定義
type ItemId = string & Brand.Brand<"ItemId">
type SlotIndex = number & Brand.Brand<"SlotIndex">

export const ItemId = Schema.String.pipe(Schema.brand("ItemId"))
export const SlotIndex = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand("SlotIndex")
)

// アイテムメタデータスキーマ
export const ItemMetadata = Schema.Struct({
  durability: Schema.optional(
    Schema.Number.pipe(
      Schema.between(0, 1),
      Schema.annotations({ description: "アイテムの耐久度(0-1)" })
    )
  ),
  enchantments: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.maxItems(10),
      Schema.annotations({ description: "エンチャント一覧" })
    )
  ),
  customName: Schema.optional(
    Schema.String.pipe(
      Schema.maxLength(64),
      Schema.annotations({ description: "カスタム名" })
    )
  ),
  lore: Schema.optional(
    Schema.Array(Schema.String).pipe(
      Schema.maxItems(20),
      Schema.annotations({ description: "説明文" })
    )
  )
})

// アイテムスタックスキーマ
export const ItemStack = Schema.Struct({
  itemId: ItemId,
  count: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 64),
    Schema.annotations({ description: "アイテム数量" })
  ),
  metadata: Schema.optional(ItemMetadata)
}).pipe(
  Schema.annotations({
    identifier: "ItemStack",
    description: "インベントリ内のアイテムスタック"
  })
)

export type ItemStack = Schema.Schema.Type<typeof ItemStack>

// アイテム定義スキーマ
export const ItemDefinition = Schema.Struct({
  id: ItemId,
  name: Schema.String.pipe(
    Schema.maxLength(64),
    Schema.annotations({ description: "アイテム表示名" })
  ),
  maxStackSize: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 64),
    Schema.annotations({ description: "最大スタック数" })
  ),
  category: Schema.Literal(
    "block", "tool", "weapon", "armor", "food", "material"
  ).pipe(Schema.annotations({ description: "アイテムカテゴリ" })),
  properties: Schema.Record({
    key: Schema.String,
    value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean)
  }).pipe(Schema.annotations({ description: "アイテム固有プロパティ" }))
}).pipe(
  Schema.annotations({
    identifier: "ItemDefinition",
    description: "アイテムの定義情報"
  })
)

export type ItemDefinition = Schema.Schema.Type<typeof ItemDefinition>

// アイテムスタック操作用の関数
export const ItemStackOperations = {
  // スタック結合可能性チェック
  canMerge: (stack1: ItemStack, stack2: ItemStack): boolean =>
    stack1.itemId === stack2.itemId &&
    JSON.stringify(stack1.metadata) === JSON.stringify(stack2.metadata),

  // スタック結合
  merge: (stack1: ItemStack, stack2: ItemStack, maxStack: number): Effect.Effect<
    [ItemStack, Option.Option<ItemStack>],
    "CannotMergeStacks" | "StackOverflow"
  > =>
    Effect.gen(function* () {
      if (!ItemStackOperations.canMerge(stack1, stack2)) {
        return yield* Effect.fail("CannotMergeStacks" as const)
      }

      const totalCount = stack1.count + stack2.count
      if (totalCount <= maxStack) {
        return [
          { ...stack1, count: totalCount },
          Option.none<ItemStack>()
        ]
      }

      return [
        { ...stack1, count: maxStack },
        Option.some({ ...stack2, count: totalCount - maxStack })
      ]
    }),

  // スタック分割
  split: (stack: ItemStack, amount: number): Effect.Effect<
    [ItemStack, ItemStack],
    "InvalidSplitAmount"
  > =>
    Effect.gen(function* () {
      if (amount <= 0 || amount >= stack.count) {
        return yield* Effect.fail("InvalidSplitAmount" as const)
      }

      return [
        { ...stack, count: amount },
        { ...stack, count: stack.count - amount }
      ]
    })
}
```

### 2.2 インベントリ構造

```typescript
import { Effect, Option, ReadonlyArray, Ref, STM, TRef, Match, HashMap, Chunk, Stream } from "effect"

// ブランド型定義
type InventoryId = string & Brand.Brand<"InventoryId">
export const InventoryId = Schema.String.pipe(Schema.brand("InventoryId"))

// インベントリスロット（Schema定義）
export const InventorySlot = Schema.Struct({
  index: SlotIndex,
  item: Schema.Option(ItemStack),
  locked: Schema.Boolean.pipe(
    Schema.annotations({ description: "スロットのロック状態" })
  ),
  acceptFilter: Schema.optional(
    Schema.Function.pipe(
      Schema.annotations({ description: "アイテム受け入れフィルタ" })
    )
  )
}).pipe(
  Schema.annotations({
    identifier: "InventorySlot",
    description: "インベントリの単一スロット"
  })
)

export type InventorySlot = Schema.Schema.Type<typeof InventorySlot>

// インベントリタイプ
export const InventoryType = Schema.Literal(
  "player",
  "chest",
  "furnace",
  "crafting",
  "enchanting",
  "hopper",
  "dispenser"
).pipe(Schema.annotations({ description: "インベントリの種類" }))

export type InventoryType = Schema.Schema.Type<typeof InventoryType>

// インベントリ制約
export const InventoryConstraints = Schema.Struct({
  maxSlots: Schema.Number.pipe(Schema.int(), Schema.between(1, 256)),
  allowedItems: Schema.optional(Schema.Array(ItemId)),
  forbiddenItems: Schema.optional(Schema.Array(ItemId)),
  maxStackSize: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(1, 64)))
}).pipe(
  Schema.annotations({
    description: "インベントリの制約定義"
  })
)

export type InventoryConstraints = Schema.Schema.Type<typeof InventoryConstraints>

// インベントリ状態（STMで管理）
export const InventoryState = Schema.Struct({
  id: InventoryId,
  type: InventoryType,
  slots: Schema.Array(InventorySlot),
  constraints: InventoryConstraints,
  version: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))
}).pipe(
  Schema.annotations({
    identifier: "InventoryState",
    description: "インベントリの状態情報"
  })
)

export type InventoryState = Schema.Schema.Type<typeof InventoryState>

// インベントリイベント定義
export const InventoryEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("ItemAdded"),
    inventoryId: InventoryId,
    slotIndex: SlotIndex,
    item: ItemStack,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("ItemRemoved"),
    inventoryId: InventoryId,
    slotIndex: SlotIndex,
    item: ItemStack,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("ItemMoved"),
    fromInventoryId: InventoryId,
    toInventoryId: InventoryId,
    fromSlot: SlotIndex,
    toSlot: SlotIndex,
    item: ItemStack,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("InventoryCleared"),
    inventoryId: InventoryId,
    timestamp: Schema.Number
  })
).pipe(
  Schema.annotations({
    identifier: "InventoryEvent",
    description: "インベントリ操作イベント"
  })
)

export type InventoryEvent = Schema.Schema.Type<typeof InventoryEvent>

// インベントリサービス定義
export interface InventoryService {
  readonly create: (type: InventoryType, constraints: InventoryConstraints) => Effect.Effect<InventoryId>
  readonly get: (id: InventoryId) => Effect.Effect<Option.Option<InventoryState>, "InventoryNotFound">
  readonly addItem: (id: InventoryId, item: ItemStack) => Effect.Effect<SlotIndex, "InventoryFull" | "InventoryNotFound">
  readonly removeItem: (id: InventoryId, slotIndex: SlotIndex) => Effect.Effect<Option.Option<ItemStack>, "InventoryNotFound" | "SlotEmpty">
  readonly moveItem: (fromId: InventoryId, toId: InventoryId, fromSlot: SlotIndex, toSlot: SlotIndex, amount?: number) => Effect.Effect<void, "ItemTransferFailed">
  readonly subscribe: (id: InventoryId) => Stream.Stream<InventoryEvent>
}

// STMベースのインベントリ操作
export const InventoryOperations = {
  // アイテム追加（STMによる原子的操作）
  addItemSTM: (
    inventoryRef: TRef.TRef<InventoryState>,
    item: ItemStack,
    itemDefinitions: ReadonlyArray<ItemDefinition>
  ): STM.STM<SlotIndex, "InventoryFull" | "InvalidItem"> =>
    STM.gen(function* () {
      const inventory = yield* TRef.get(inventoryRef)
      const itemDef = ReadonlyArray.findFirst(
        itemDefinitions,
        def => def.id === item.itemId
      )

      if (Option.isNone(itemDef)) {
        return yield* STM.fail("InvalidItem" as const)
      }

      // 同じアイテムの既存スタックを検索
      const existingSlotIndex = ReadonlyArray.findFirstIndex(
        inventory.slots,
        slot => Option.isSome(slot.item) &&
                 ItemStackOperations.canMerge(slot.item.value, item) &&
                 slot.item.value.count < itemDef.value.maxStackSize
      )

      return yield* Match.value(existingSlotIndex).pipe(
        Match.when(Option.isSome, ({ value: slotIndex }) =>
          // 既存スタックにマージ
          STM.gen(function* () {
            const slot = inventory.slots[slotIndex]
            const existingItem = slot.item.value! // Option.isSomeでチェック済み
            const maxStack = itemDef.value.maxStackSize
            const [mergedStack, remaining] = yield* ItemStackOperations.merge(existingItem, item, maxStack)

            const updatedSlots = ReadonlyArray.modify(
              inventory.slots,
              slotIndex,
              s => ({ ...s, item: Option.some(mergedStack) })
            )

            yield* TRef.set(inventoryRef, {
              ...inventory,
              slots: updatedSlots,
              version: inventory.version + 1
            })

            // 残りがある場合は再帰的に追加
            if (Option.isSome(remaining)) {
              return yield* InventoryOperations.addItemSTM(inventoryRef, remaining.value, itemDefinitions)
            }

            return slotIndex as SlotIndex
          })
        ),
        Match.when(Option.isNone, () =>
          // 空きスロットを検索
          STM.gen(function* () {
            const emptySlotIndex = ReadonlyArray.findFirstIndex(
              inventory.slots,
              slot => Option.isNone(slot.item) && !slot.locked
            )

            if (Option.isNone(emptySlotIndex)) {
              return yield* STM.fail("InventoryFull" as const)
            }

            const slotIndex = emptySlotIndex.value
            const updatedSlots = ReadonlyArray.modify(
              inventory.slots,
              slotIndex,
              s => ({ ...s, item: Option.some(item) })
            )

            yield* TRef.set(inventoryRef, {
              ...inventory,
              slots: updatedSlots,
              version: inventory.version + 1
            })

            return slotIndex as SlotIndex
          })
        ),
        Match.exhaustive
      ).pipe(STM.flatten)
    }),

  // アイテム移動（STMによる原子的操作）
  moveItemSTM: (
    fromRef: TRef.TRef<InventoryState>,
    toRef: TRef.TRef<InventoryState>,
    fromSlot: SlotIndex,
    toSlot: SlotIndex,
    amount?: number
  ): STM.STM<void, "SlotEmpty" | "InvalidTransfer"> =>
    STM.gen(function* () {
      const fromInventory = yield* TRef.get(fromRef)
      const toInventory = yield* TRef.get(toRef)

      const sourceSlot = fromInventory.slots[fromSlot]

      if (Option.isNone(sourceSlot.item)) {
        return yield* STM.fail("SlotEmpty" as const)
      }

      const sourceItem = sourceSlot.item.value
      const transferAmount = amount ?? sourceItem.count

      if (transferAmount <= 0 || transferAmount > sourceItem.count) {
        return yield* STM.fail("InvalidTransfer" as const)
      }

      const targetSlot = toInventory.slots[toSlot]

      // 転送後のアイテム計算
      const remainingSource = sourceItem.count - transferAmount
      const transferredItem = { ...sourceItem, count: transferAmount }

      // ソースの更新
      const updatedFromSlots = ReadonlyArray.modify(
        fromInventory.slots,
        fromSlot,
        s => ({
          ...s,
          item: remainingSource > 0
            ? Option.some({ ...sourceItem, count: remainingSource })
            : Option.none()
        })
      )

      // ターゲットの更新
      const updatedToSlots = ReadonlyArray.modify(
        toInventory.slots,
        toSlot,
        s => ({
          ...s,
          item: Option.isSome(targetSlot.item) && ItemStackOperations.canMerge(targetSlot.item.value, transferredItem)
            ? Option.some({ ...targetSlot.item.value, count: targetSlot.item.value.count + transferAmount })
            : Option.some(transferredItem)
        })
      )

      // 両方のインベントリを原子的に更新
      yield* TRef.set(fromRef, {
        ...fromInventory,
        slots: updatedFromSlots,
        version: fromInventory.version + 1
      })

      yield* TRef.set(toRef, {
        ...toInventory,
        slots: updatedToSlots,
        version: toInventory.version + 1
      })
    }),

  // インベントリ圧縮（同種アイテムの統合）
  compactInventorySTM: (
    inventoryRef: TRef.TRef<InventoryState>,
    itemDefinitions: ReadonlyArray<ItemDefinition>
  ): STM.STM<number, never> =>
    STM.gen(function* () {
      const inventory = yield* TRef.get(inventoryRef)

      // アイテムIDごとにグループ化
      const itemGroups = HashMap.empty<string, Array<{ slot: number; item: ItemStack }>>()

      for (let i = 0; i < inventory.slots.length; i++) {
        const slot = inventory.slots[i]
        if (Option.isSome(slot.item) && !slot.locked) {
          const itemId = slot.item.value.itemId
          const existing = HashMap.get(itemGroups, itemId)
          const entry = { slot: i, item: slot.item.value }

          if (Option.isSome(existing)) {
            existing.value.push(entry)
          } else {
            HashMap.set(itemGroups, itemId, [entry])
          }
        }
      }

      let compactedCount = 0
      let newSlots = [...inventory.slots]

      // 各アイテムグループを圧縮
      for (const [itemId, entries] of itemGroups) {
        if (entries.length <= 1) continue

        const itemDef = ReadonlyArray.findFirst(
          itemDefinitions,
          def => def.id === itemId
        )

        if (Option.isNone(itemDef)) continue

        const maxStack = itemDef.value.maxStackSize
        let totalCount = entries.reduce((sum, entry) => sum + entry.item.count, 0)

        // 全スロットをクリア
        for (const entry of entries) {
          newSlots[entry.slot] = { ...newSlots[entry.slot], item: Option.none() }
        }

        // 圧縮後のスタックを配置
        let entryIndex = 0
        while (totalCount > 0 && entryIndex < entries.length) {
          const stackSize = Math.min(totalCount, maxStack)
          const baseItem = entries[0].item

          newSlots[entries[entryIndex].slot] = {
            ...newSlots[entries[entryIndex].slot],
            item: Option.some({
              ...baseItem,
              count: stackSize
            })
          }

          totalCount -= stackSize
          entryIndex++
          compactedCount++
        }
      }

      yield* TRef.set(inventoryRef, {
        ...inventory,
        slots: newSlots,
        version: inventory.version + 1
      })

      return compactedCount
    })
}
```

## 3. ECS統合

### 3.1 インベントリコンポーネント

```typescript
import { Context, Layer, Service, Ref } from "effect"

// ECSコンポーネント定義（Effect統合）
export const InventoryComponent = Schema.Struct({
  inventoryId: InventoryId,
  inventoryRef: Schema.Unknown.pipe(
    Schema.annotations({ description: "TRef<InventoryState>への参照" })
  ),
  eventStream: Schema.Unknown.pipe(
    Schema.annotations({ description: "Stream<InventoryEvent>への参照" })
  )
}).pipe(
  Schema.annotations({
    identifier: "InventoryComponent",
    description: "ECSインベントリコンポーネント"
  })
)

export type InventoryComponent = Schema.Schema.Type<typeof InventoryComponent>

// コンポーネント登録（Effect統合）
export const makeInventoryComponent = (
  inventoryId: InventoryId,
  inventoryRef: TRef.TRef<InventoryState>,
  eventStream: Stream.Stream<InventoryEvent>
): InventoryComponent => ({
  inventoryId,
  inventoryRef: inventoryRef as unknown,
  eventStream: eventStream as unknown
})

// ECSインベントリサービス
export interface ECSInventoryService {
  readonly createComponent: (
    entityId: EntityId,
    type: InventoryType,
    constraints: InventoryConstraints
  ) => Effect.Effect<InventoryComponent, "ComponentCreationFailed">

  readonly getComponent: (
    entityId: EntityId
  ) => Effect.Effect<Option.Option<InventoryComponent>, "ComponentNotFound">

  readonly updateComponent: (
    entityId: EntityId,
    update: (component: InventoryComponent) => InventoryComponent
  ) => Effect.Effect<void, "ComponentUpdateFailed">
}

export const ECSInventoryService = Context.GenericTag<ECSInventoryService>("@minecraft/ECSInventoryService")
```

### 3.2 インベントリシステム

```typescript
// インベントリシステム実装（Effect統合）
export interface InventorySystem {
  readonly name: "InventorySystem"
  readonly update: (
    entities: ReadonlyArray<EntityId>,
    deltaTime: number
  ) => Effect.Effect<void, "SystemUpdateError">
}

export const makeInventorySystem = (): Effect.Effect<InventorySystem, never,
  ECSInventoryService | InventoryService | TransformService
> =>
  Effect.gen(function* () {
    const inventoryService = yield* InventoryService
    const ecsInventoryService = yield* ECSInventoryService
    const transformService = yield* TransformService

    return {
      name: "InventorySystem",

      update: (entities: ReadonlyArray<EntityId>, deltaTime: number) =>
        Effect.gen(function* () {
          // 全エンティティを並列処理
          yield* Effect.forEach(
            entities,
            entityId => processEntityInventory(entityId, deltaTime),
            { concurrency: "unbounded" }
          )
        })
    }

    function processEntityInventory(
      entityId: EntityId,
      deltaTime: number
    ): Effect.Effect<void, "EntityProcessingError"> {
      return Effect.gen(function* () {
        const inventoryComponent = yield* ecsInventoryService.getComponent(entityId)

        if (Option.isNone(inventoryComponent)) {
          return // インベントリコンポーネントがないエンティティはスキップ
        }

        const component = inventoryComponent.value
        const inventoryRef = component.inventoryRef as TRef.TRef<InventoryState>

        // 近くのドロップアイテムを検出
        const position = yield* transformService.getPosition(entityId)
        const nearbyItems = yield* detectNearbyDroppedItems(position, 2.0) // 2ブロック半径

        // 自動ピックアップ処理
        if (nearbyItems.length > 0) {
          yield* autoPickupItems(inventoryRef, nearbyItems)
        }

        // インベントリの自動整理（一定時間ごと）
        const inventory = yield* STM.commit(TRef.get(inventoryRef))
        if (inventory.version % 100 === 0) { // 100更新ごとに整理
          yield* STM.commit(
            InventoryOperations.compactInventorySTM(inventoryRef, yield* getItemDefinitions())
          )
        }
      }).pipe(
        Effect.catchAll(error =>
          Effect.gen(function* () {
            yield* Effect.logError(`エンティティ ${entityId} のインベントリ処理でエラー`, error)
            return yield* Effect.fail("EntityProcessingError" as const)
          })
        )
      )
    }

    function detectNearbyDroppedItems(
      position: Vector3,
      radius: number
    ): Effect.Effect<ReadonlyArray<DroppedItemEntity>, never> {
      return Effect.gen(function* () {
        // TODO: 実際の実装では空間インデックスを使用
        const allDroppedItems = yield* getAllDroppedItems()

        return ReadonlyArray.filter(
          allDroppedItems,
          item => calculateDistance(item.position, position) <= radius
        )
      })
    }

    function autoPickupItems(
      inventoryRef: TRef.TRef<InventoryState>,
      items: ReadonlyArray<DroppedItemEntity>
    ): Effect.Effect<void, never> {
      return Effect.gen(function* () {
        const itemDefinitions = yield* getItemDefinitions()

        for (const droppedItem of items) {
          const pickupResult = yield* STM.commit(
            InventoryOperations.addItemSTM(
              inventoryRef,
              droppedItem.itemStack,
              itemDefinitions
            )
          ).pipe(
            Effect.catchAll(() => Effect.succeed(Option.none<SlotIndex>())),
            Effect.map(slotIndex => Option.some(slotIndex))
          )

          if (Option.isSome(pickupResult)) {
            // アイテムが正常にピックアップされた場合、ドロップアイテムを削除
            yield* removeDroppedItem(droppedItem.id)

            // ピックアップイベント発生
            yield* broadcastInventoryEvent({
              _tag: "ItemAdded" as const,
              inventoryId: (yield* STM.commit(TRef.get(inventoryRef))).id,
              slotIndex: pickupResult.value,
              item: droppedItem.itemStack,
              timestamp: Date.now()
            })
          }
        }
      })
    }
  })

// インベントリシステムのLayer定義
export const InventorySystemLayer = Layer.effect(
  Context.GenericTag<InventorySystem>("@minecraft/InventorySystem"),
  makeInventorySystem()
)
```

### 3.3 Stream統合とイベント処理

```typescript
// インベントリイベントストリーム処理
export const makeInventoryEventProcessor = (): Effect.Effect<
  void,
  never,
  InventoryService | NetworkService | UIService
> =>
  Effect.gen(function* () {
    const inventoryService = yield* InventoryService
    const networkService = yield* NetworkService
    const uiService = yield* UIService

    // 全インベントリのイベントストリームを統合
    const allInventoryEvents = Stream.mergeAll(
      yield* Effect.forEach(
        yield* getAllInventoryIds(),
        inventoryId => inventoryService.subscribe(inventoryId)
      ),
      { concurrency: "unbounded" }
    )

    // イベントストリーム処理
    yield* allInventoryEvents.pipe(
      Stream.tap(event =>
        Effect.gen(function* () {
          // ネットワーク同期
          yield* networkService.broadcastInventoryEvent(event)

          // UI更新通知
          yield* uiService.notifyInventoryChange(event)

          // ログ記録
          yield* Effect.logInfo(`インベントリイベント処理: ${event._tag}`)
        })
      ),
      Stream.runDrain,
      Effect.fork // バックグラウンドで実行
    )
  })

// バッチ処理によるインベントリ同期
export const makeBatchInventorySync = (): Effect.Effect<
  void,
  never,
  InventoryService | NetworkService
> =>
  Effect.gen(function* () {
    const inventoryService = yield* InventoryService
    const networkService = yield* NetworkService

    // 5秒間隔でバッチ同期
    yield* Effect.repeat(
      Effect.gen(function* () {
        const dirtyInventories = yield* getDirtyInventories()

        if (dirtyInventories.length > 0) {
          // バッチでネットワーク同期
          yield* networkService.syncInventoriesBatch(dirtyInventories)

          // ダーティフラグクリア
          yield* clearDirtyFlags(dirtyInventories)

          yield* Effect.logInfo(`${dirtyInventories.length} インベントリを同期しました`)
        }
      }),
      Schedule.fixed("5 seconds")
    ).pipe(Effect.fork)
  })
```

## 4. クライアント・サーバー同期

### 4.1 インベントリ同期プロトコル

```typescript
import { Schema, Queue, Duration, Schedule } from "effect"

// インベントリ同期メッセージスキーマ
export const InventorySyncMessage = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("FullSync"),
    playerId: Schema.String.pipe(Schema.brand("PlayerId")),
    inventoryId: InventoryId,
    state: InventoryState,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("DeltaSync"),
    playerId: Schema.String.pipe(Schema.brand("PlayerId")),
    inventoryId: InventoryId,
    changes: Schema.Array(InventoryEvent),
    fromVersion: Schema.Number,
    toVersion: Schema.Number,
    timestamp: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("SyncRequest"),
    playerId: Schema.String.pipe(Schema.brand("PlayerId")),
    inventoryId: InventoryId,
    clientVersion: Schema.Number,
    timestamp: Schema.Number
  })
).pipe(
  Schema.annotations({
    identifier: "InventorySyncMessage",
    description: "インベントリ同期メッセージ"
  })
)

export type InventorySyncMessage = Schema.Schema.Type<typeof InventorySyncMessage>

// 同期サービス定義
export interface InventorySyncService {
  readonly syncInventory: (
    playerId: string,
    inventoryId: InventoryId,
    forceFullSync?: boolean
  ) => Effect.Effect<void, "SyncFailed">

  readonly handleSyncMessage: (
    message: InventorySyncMessage
  ) => Effect.Effect<void, "MessageHandlingFailed">

  readonly requestSync: (
    playerId: string,
    inventoryId: InventoryId
  ) => Effect.Effect<void, "SyncRequestFailed">
}

export const InventorySyncService = Context.GenericTag<InventorySyncService>("@minecraft/InventorySyncService")

// 同期サービス実装
export const makeInventorySyncService = (): Effect.Effect<
  InventorySyncService,
  never,
  NetworkService | InventoryService | PersistenceService
> =>
  Effect.gen(function* () {
    const networkService = yield* NetworkService
    const inventoryService = yield* InventoryService
    const persistenceService = yield* PersistenceService

    // 同期キュー（優先度付き）
    const syncQueue = yield* Queue.bounded<{
      priority: number
      playerId: string
      inventoryId: InventoryId
      type: "full" | "delta"
    }>(1000)

    // 同期ワーカーを開始
    yield* Effect.fork(processSyncQueue(syncQueue))

    return {
      syncInventory: (playerId, inventoryId, forceFullSync = false) =>
        Effect.gen(function* () {
          const priority = forceFullSync ? 1 : 5 // フル同期は高優先度

          yield* Queue.offer(syncQueue, {
            priority,
            playerId,
            inventoryId,
            type: forceFullSync ? "full" : "delta"
          })
        }).pipe(
          Effect.catchAll(() => Effect.fail("SyncFailed" as const))
        ),

      handleSyncMessage: (message) =>
        Match.value(message).pipe(
          Match.when({ _tag: "FullSync" }, handleFullSync),
          Match.when({ _tag: "DeltaSync" }, handleDeltaSync),
          Match.when({ _tag: "SyncRequest" }, handleSyncRequest),
          Match.exhaustive
        ).pipe(
          Effect.catchAll(() => Effect.fail("MessageHandlingFailed" as const))
        ),

      requestSync: (playerId, inventoryId) =>
        Effect.gen(function* () {
          const clientVersion = yield* getClientInventoryVersion(playerId, inventoryId)

          const request: InventorySyncMessage = {
            _tag: "SyncRequest",
            playerId: playerId as any,
            inventoryId,
            clientVersion,
            timestamp: Date.now()
          }

          yield* networkService.sendToPlayer(playerId, request)
        }).pipe(
          Effect.catchAll(() => Effect.fail("SyncRequestFailed" as const))
        )
    }

    function processSyncQueue(
      queue: Queue.Queue<{
        priority: number
        playerId: string
        inventoryId: InventoryId
        type: "full" | "delta"
      }>
    ): Effect.Effect<void, never> {
      return Effect.gen(function* () {
        const item = yield* Queue.take(queue)

        yield* Effect.gen(function* () {
          const inventory = yield* inventoryService.get(item.inventoryId)

          if (Option.isNone(inventory)) {
            return // インベントリが存在しない
          }

          const state = inventory.value
          const clientVersion = yield* getClientInventoryVersion(item.playerId, item.inventoryId)

          if (item.type === "full" || state.version - clientVersion > 10) {
            // フル同期
            const fullSync: InventorySyncMessage = {
              _tag: "FullSync",
              playerId: item.playerId as any,
              inventoryId: item.inventoryId,
              state,
              timestamp: Date.now()
            }

            yield* networkService.sendToPlayer(item.playerId, fullSync)
            yield* setClientInventoryVersion(item.playerId, item.inventoryId, state.version)
          } else {
            // デルタ同期
            const changes = yield* getInventoryChangesSince(item.inventoryId, clientVersion)

            if (changes.length > 0) {
              const deltaSync: InventorySyncMessage = {
                _tag: "DeltaSync",
                playerId: item.playerId as any,
                inventoryId: item.inventoryId,
                changes,
                fromVersion: clientVersion,
                toVersion: state.version,
                timestamp: Date.now()
              }

              yield* networkService.sendToPlayer(item.playerId, deltaSync)
              yield* setClientInventoryVersion(item.playerId, item.inventoryId, state.version)
            }
          }
        }).pipe(
          Effect.catchAll(error =>
            Effect.logError(`同期処理エラー: ${item.playerId}/${item.inventoryId}`, error)
          )
        )
      }).pipe(
        Effect.forever,
        Effect.catchAll(error =>
          Effect.gen(function* () {
            yield* Effect.logError("同期キュー処理エラー", error)
            yield* Effect.sleep(Duration.seconds(1)) // 短時間待機後再試行
          })
        ),
        Effect.forever
      )
    }

    function handleFullSync(
      message: Extract<InventorySyncMessage, { _tag: "FullSync" }>
    ): Effect.Effect<void, never> {
      return Effect.gen(function* () {
        // クライアントのインベントリ状態を完全に更新
        yield* persistenceService.saveInventoryState(message.inventoryId, message.state)
        yield* setClientInventoryVersion(message.playerId, message.inventoryId, message.state.version)

        yield* Effect.logInfo(`フル同期完了: ${message.playerId}/${message.inventoryId}`)
      }).pipe(Effect.orElse(() => Effect.unit))
    }

    function handleDeltaSync(
      message: Extract<InventorySyncMessage, { _tag: "DeltaSync" }>
    ): Effect.Effect<void, never> {
      return Effect.gen(function* () {
        // 変更を順次適用
        for (const change of message.changes) {
          yield* applyInventoryChange(message.inventoryId, change)
        }

        yield* setClientInventoryVersion(message.playerId, message.inventoryId, message.toVersion)

        yield* Effect.logInfo(
          `デルタ同期完了: ${message.playerId}/${message.inventoryId} (${message.changes.length}件の変更)`
        )
      }).pipe(Effect.orElse(() => Effect.unit))
    }

    function handleSyncRequest(
      message: Extract<InventorySyncMessage, { _tag: "SyncRequest" }>
    ): Effect.Effect<void, never> {
      return Effect.gen(function* () {
        // 同期要求を同期キューに追加
        yield* Queue.offer(syncQueue, {
          priority: 3, // 中優先度
          playerId: message.playerId,
          inventoryId: message.inventoryId,
          type: "delta"
        })

        yield* Effect.logInfo(`同期要求受信: ${message.playerId}/${message.inventoryId}`)
      }).pipe(Effect.orElse(() => Effect.unit))
    }
  })

// レイヤー定義
export const InventorySyncServiceLayer = Layer.effect(
  InventorySyncService,
  makeInventorySyncService()
)

// 接続維持とハートビート
export const makeInventorySyncHeartbeat = (): Effect.Effect<
  void,
  never,
  InventorySyncService | NetworkService
> =>
  Effect.gen(function* () {
    const syncService = yield* InventorySyncService
    const networkService = yield* NetworkService

    // 30秒間隔でハートビート
    yield* Effect.repeat(
      Effect.gen(function* () {
        const connectedPlayers = yield* networkService.getConnectedPlayers()

        yield* Effect.forEach(
          connectedPlayers,
          playerId =>
            Effect.gen(function* () {
              const playerInventories = yield* getPlayerInventories(playerId)

              yield* Effect.forEach(
                playerInventories,
                inventoryId => syncService.syncInventory(playerId, inventoryId),
                { concurrency: 5 }
              )
            }).pipe(Effect.catchAll(() => Effect.unit)),
          { concurrency: "unbounded" }
        )
      }),
      Schedule.fixed(Duration.seconds(30))
    ).pipe(Effect.fork)
  })
```

## 5. UI統合

### 5.1 インベントリUI

```typescript
import { SubscriptionRef, Fiber } from "effect"

// UI状態定義（Schema化）
export const InventoryUIState = Schema.Struct({
  isOpen: Schema.Boolean,
  selectedSlot: Schema.Option(SlotIndex),
  draggedItem: Schema.Option(ItemStack),
  hoveredSlot: Schema.Option(SlotIndex),
  quickbarSelectedSlot: Schema.Option(SlotIndex),
  filterText: Schema.String.pipe(Schema.maxLength(64)),
  sortMode: Schema.Literal("name", "count", "type", "recent").pipe(
    Schema.annotations({ description: "ソート方式" })
  )
}).pipe(
  Schema.annotations({
    identifier: "InventoryUIState",
    description: "インベントリUI状態"
  })
)

export type InventoryUIState = Schema.Schema.Type<typeof InventoryUIState>

// UI操作の結果型
export const InventoryUIResult = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("StateUpdated"),
    newState: InventoryUIState,
    inventoryChanges: Schema.Array(InventoryEvent)
  }),
  Schema.Struct({
    _tag: Schema.Literal("NoChange"),
    reason: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal("Error"),
    error: Schema.String,
    code: Schema.String
  })
).pipe(
  Schema.annotations({
    identifier: "InventoryUIResult",
    description: "UI操作結果"
  })
)

export type InventoryUIResult = Schema.Schema.Type<typeof InventoryUIResult>

// UIインタラクション定義
export interface InventoryUIService {
  readonly handleSlotClick: (
    inventoryId: InventoryId,
    slotIndex: SlotIndex,
    button: "left" | "right" | "middle",
    modifiers: {
      shift: boolean
      ctrl: boolean
      alt: boolean
    }
  ) => Effect.Effect<InventoryUIResult, "UIActionFailed">

  readonly handleDragStart: (
    inventoryId: InventoryId,
    slotIndex: SlotIndex
  ) => Effect.Effect<InventoryUIResult, "DragStartFailed">

  readonly handleDragDrop: (
    fromInventoryId: InventoryId,
    toInventoryId: InventoryId,
    fromSlot: SlotIndex,
    toSlot: SlotIndex,
    modifiers: {
      shift: boolean
      ctrl: boolean
    }
  ) => Effect.Effect<InventoryUIResult, "DragDropFailed">

  readonly handleKeyPress: (
    key: string,
    modifiers: {
      shift: boolean
      ctrl: boolean
      alt: boolean
    }
  ) => Effect.Effect<InventoryUIResult, "KeyPressFailed">

  readonly subscribe: (
    inventoryId: InventoryId
  ) => Stream.Stream<InventoryUIState>
}

export const InventoryUIService = Context.GenericTag<InventoryUIService>("@minecraft/InventoryUIService")

// UI操作実装
export const makeInventoryUIService = (): Effect.Effect<
  InventoryUIService,
  never,
  InventoryService | InputService | AudioService
> =>
  Effect.gen(function* () {
    const inventoryService = yield* InventoryService
    const inputService = yield* InputService
    const audioService = yield* AudioService

    // UI状態管理（Refで管理）
    const uiStateRef = yield* SubscriptionRef.make<InventoryUIState>({
      isOpen: false,
      selectedSlot: Option.none(),
      draggedItem: Option.none(),
      hoveredSlot: Option.none(),
      quickbarSelectedSlot: Option.none(),
      filterText: "",
      sortMode: "name"
    })

    return {
      handleSlotClick: (inventoryId, slotIndex, button, modifiers) =>
        Effect.gen(function* () {
          const currentState = yield* SubscriptionRef.get(uiStateRef)
          const inventory = yield* inventoryService.get(inventoryId)

          if (Option.isNone(inventory)) {
            return {
              _tag: "Error" as const,
              error: "インベントリが見つかりません",
              code: "INVENTORY_NOT_FOUND"
            }
          }

          const inventoryState = inventory.value
          const slot = inventoryState.slots[slotIndex]

          // パターンマッチングによる操作分岐（早期リターン）
          return yield* Match.value({ button, modifiers, currentState, slot }).pipe(
            // 左クリック操作
            Match.when(
              ({ button, currentState }) =>
                button === "left" && Option.isSome(currentState.draggedItem),
              ({ currentState, slot }) =>
                // ドラッグ中アイテムの配置
                Effect.gen(function* () {
                  const draggedItem = currentState.draggedItem.value

                  if (Option.isSome(slot.item)) {
                    // 既存アイテムがある場合は交換
                    const result = yield* swapItems(inventoryId, slotIndex, draggedItem, slot.item.value)

                    if (result) {
                      const newState = {
                        ...currentState,
                        draggedItem: Option.some(slot.item.value)
                      }

                      yield* SubscriptionRef.set(uiStateRef, newState)
                      yield* audioService.playSound("ui.inventory.place")

                      return {
                        _tag: "StateUpdated" as const,
                        newState,
                        inventoryChanges: result.events
                      }
                    }
                  } else {
                    // 空スロットに配置
                    const result = yield* placeItemInSlot(inventoryId, slotIndex, draggedItem)

                    if (result) {
                      const newState = {
                        ...currentState,
                        draggedItem: Option.none()
                      }

                      yield* SubscriptionRef.set(uiStateRef, newState)
                      yield* audioService.playSound("ui.inventory.place")

                      return {
                        _tag: "StateUpdated" as const,
                        newState,
                        inventoryChanges: result.events
                      }
                    }
                  }

                  return {
                    _tag: "NoChange" as const,
                    reason: "アイテムの配置に失敗しました"
                  }
                })
            ),

            // 左クリック：アイテムピックアップ
            Match.when(
              ({ button, currentState }) =>
                button === "left" && Option.isNone(currentState.draggedItem),
              ({ slot, currentState }) =>
                Effect.gen(function* () {
                  if (Option.isNone(slot.item)) {
                    return {
                      _tag: "NoChange" as const,
                      reason: "空のスロットです"
                    }
                  }

                  const item = slot.item.value
                  const result = yield* removeItemFromSlot(inventoryId, slotIndex)

                  if (result) {
                    const newState = {
                      ...currentState,
                      draggedItem: Option.some(item)
                    }

                    yield* SubscriptionRef.set(uiStateRef, newState)
                    yield* audioService.playSound("ui.inventory.pickup")

                    return {
                      _tag: "StateUpdated" as const,
                      newState,
                      inventoryChanges: result.events
                    }
                  }

                  return {
                    _tag: "Error" as const,
                    error: "アイテムの取得に失敗しました",
                    code: "PICKUP_FAILED"
                  }
                })
            ),

            // 右クリック：スタック分割
            Match.when(
              ({ button }) => button === "right",
              ({ slot, currentState }) =>
                Effect.gen(function* () {
                  if (Option.isNone(slot.item)) {
                    return {
                      _tag: "NoChange" as const,
                      reason: "空のスロットです"
                    }
                  }

                  const item = slot.item.value

                  if (item.count <= 1) {
                    return {
                      _tag: "NoChange" as const,
                      reason: "分割できません"
                    }
                  }

                  const splitAmount = Math.ceil(item.count / 2)
                  const remaining = item.count - splitAmount

                  const [splitItem, remainingItem] = yield* ItemStackOperations.split(item, splitAmount)

                  const result = yield* updateSlotItem(inventoryId, slotIndex, remainingItem)

                  if (result) {
                    const newState = {
                      ...currentState,
                      draggedItem: Option.some(splitItem)
                    }

                    yield* SubscriptionRef.set(uiStateRef, newState)
                    yield* audioService.playSound("ui.inventory.split")

                    return {
                      _tag: "StateUpdated" as const,
                      newState,
                      inventoryChanges: result.events
                    }
                  }

                  return {
                    _tag: "Error" as const,
                    error: "スタックの分割に失敗しました",
                    code: "SPLIT_FAILED"
                  }
                })
            ),

            // Shift+左クリック：クイック移動
            Match.when(
              ({ button, modifiers }) => button === "left" && modifiers.shift,
              ({ slot }) =>
                Effect.gen(function* () {
                  if (Option.isNone(slot.item)) {
                    return {
                      _tag: "NoChange" as const,
                      reason: "空のスロットです"
                    }
                  }

                  const item = slot.item.value
                  const targetInventoryId = yield* findBestTargetInventory(inventoryId, item)

                  if (Option.isSome(targetInventoryId)) {
                    const result = yield* quickMoveItem(inventoryId, targetInventoryId.value, slotIndex)

                    if (result) {
                      yield* audioService.playSound("ui.inventory.quick_move")

                      return {
                        _tag: "StateUpdated" as const,
                        newState: currentState, // 状態変更なし
                        inventoryChanges: result.events
                      }
                    }
                  }

                  return {
                    _tag: "NoChange" as const,
                    reason: "移動先が見つかりません"
                  }
                })
            ),

            // デフォルト：何もしない
            Match.orElse(() =>
              Effect.succeed({
                _tag: "NoChange" as const,
                reason: "対応していない操作です"
              })
            ),

            Match.exhaustive
          ).pipe(Effect.flatten)
        }).pipe(
          Effect.catchAll(error =>
            Effect.succeed({
              _tag: "Error" as const,
              error: String(error),
              code: "SLOT_CLICK_FAILED"
            })
          )
        ),

      handleDragStart: (inventoryId, slotIndex) =>
        Effect.gen(function* () {
          const currentState = yield* SubscriptionRef.get(uiStateRef)
          const inventory = yield* inventoryService.get(inventoryId)

          if (Option.isNone(inventory)) {
            return {
              _tag: "Error" as const,
              error: "インベントリが見つかりません",
              code: "INVENTORY_NOT_FOUND"
            }
          }

          const slot = inventory.value.slots[slotIndex]

          if (Option.isNone(slot.item) || slot.locked) {
            return {
              _tag: "NoChange" as const,
              reason: "ドラッグできません"
            }
          }

          const newState = {
            ...currentState,
            selectedSlot: Option.some(slotIndex)
          }

          yield* SubscriptionRef.set(uiStateRef, newState)

          return {
            _tag: "StateUpdated" as const,
            newState,
            inventoryChanges: []
          }
        }).pipe(
          Effect.catchAll(() =>
            Effect.succeed({
              _tag: "Error" as const,
              error: "ドラッグ開始に失敗しました",
              code: "DRAG_START_FAILED"
            })
          )
        ),

      handleDragDrop: (fromInventoryId, toInventoryId, fromSlot, toSlot, modifiers) =>
        Effect.gen(function* () {
          const currentState = yield* SubscriptionRef.get(uiStateRef)

          // STMによる原子的な移動操作
          const fromInventory = yield* inventoryService.get(fromInventoryId)
          const toInventory = yield* inventoryService.get(toInventoryId)

          if (Option.isNone(fromInventory) || Option.isNone(toInventory)) {
            return {
              _tag: "Error" as const,
              error: "インベントリが見つかりません",
              code: "INVENTORY_NOT_FOUND"
            }
          }

          const fromRef = fromInventory.value as unknown as TRef.TRef<InventoryState>
          const toRef = toInventory.value as unknown as TRef.TRef<InventoryState>

          const result = yield* STM.commit(
            modifiers.ctrl
              ? InventoryOperations.moveItemSTM(fromRef, toRef, fromSlot, toSlot, 1) // Ctrlで1個だけ
              : InventoryOperations.moveItemSTM(fromRef, toRef, fromSlot, toSlot)
          ).pipe(
            Effect.map(() => true),
            Effect.catchAll(() => Effect.succeed(false))
          )

          if (result) {
            const newState = {
              ...currentState,
              selectedSlot: Option.none(),
              draggedItem: Option.none()
            }

            yield* SubscriptionRef.set(uiStateRef, newState)
            yield* audioService.playSound("ui.inventory.drop")

            return {
              _tag: "StateUpdated" as const,
              newState,
              inventoryChanges: [{
                _tag: "ItemMoved" as const,
                fromInventoryId,
                toInventoryId,
                fromSlot,
                toSlot,
                item: (yield* STM.commit(TRef.get(toRef))).slots[toSlot].item.value!,
                timestamp: Date.now()
              }]
            }
          }

          return {
            _tag: "Error" as const,
            error: "アイテム移動に失敗しました",
            code: "MOVE_FAILED"
          }
        }).pipe(
          Effect.catchAll(() =>
            Effect.succeed({
              _tag: "Error" as const,
              error: "ドラッグ&ドロップに失敗しました",
              code: "DRAG_DROP_FAILED"
            })
          )
        ),

      handleKeyPress: (key, modifiers) =>
        Effect.gen(function* () {
          const currentState = yield* SubscriptionRef.get(uiStateRef)

          return yield* Match.value(key).pipe(
            Match.when("Escape", () =>
              Effect.gen(function* () {
                if (currentState.isOpen) {
                  const newState = {
                    ...currentState,
                    isOpen: false,
                    draggedItem: Option.none()
                  }

                  yield* SubscriptionRef.set(uiStateRef, newState)

                  return {
                    _tag: "StateUpdated" as const,
                    newState,
                    inventoryChanges: []
                  }
                }

                return {
                  _tag: "NoChange" as const,
                  reason: "インベントリは既に閉じています"
                }
              })
            ),

            Match.when("Tab", () =>
              Effect.gen(function* () {
                const newState = {
                  ...currentState,
                  isOpen: !currentState.isOpen
                }

                yield* SubscriptionRef.set(uiStateRef, newState)

                return {
                  _tag: "StateUpdated" as const,
                  newState,
                  inventoryChanges: []
                }
              })
            ),

            Match.orElse(() =>
              Effect.succeed({
                _tag: "NoChange" as const,
                reason: "未対応のキーです"
              })
            ),

            Match.exhaustive
          ).pipe(Effect.flatten)
        }).pipe(
          Effect.catchAll(() =>
            Effect.succeed({
              _tag: "Error" as const,
              error: "キー処理に失敗しました",
              code: "KEY_PRESS_FAILED"
            })
          )
        ),

      subscribe: (inventoryId) =>
        SubscriptionRef.changes(uiStateRef).pipe(
          Stream.filter(state => state.isOpen) // 開いている場合のみ
        )
    }
  })

// UIサービスレイヤー
export const InventoryUIServiceLayer = Layer.effect(
  InventoryUIService,
  makeInventoryUIService()
)
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
import { Data } from "effect"

// Schema駆動エラー定義
export const InventoryError = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal("InventoryNotFound"),
    inventoryId: InventoryId,
    context: Schema.optional(Schema.String)
  }),
  Schema.Struct({
    _tag: Schema.Literal("InventoryFull"),
    inventoryId: InventoryId,
    attemptedItem: ItemStack,
    availableSlots: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("SlotLocked"),
    inventoryId: InventoryId,
    slotIndex: SlotIndex,
    reason: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal("InvalidItemStack"),
    itemId: ItemId,
    count: Schema.Number,
    reason: Schema.String
  }),
  Schema.Struct({
    _tag: Schema.Literal("TransferConstraintViolation"),
    fromInventoryId: InventoryId,
    toInventoryId: InventoryId,
    constraint: Schema.String,
    details: Schema.Record(Schema.String, Schema.Unknown)
  }),
  Schema.Struct({
    _tag: Schema.Literal("ConcurrentModification"),
    inventoryId: InventoryId,
    expectedVersion: Schema.Number,
    actualVersion: Schema.Number
  }),
  Schema.Struct({
    _tag: Schema.Literal("NetworkSyncError"),
    inventoryId: InventoryId,
    playerId: Schema.String,
    errorCode: Schema.String,
    retryCount: Schema.Number
  })
).pipe(
  Schema.annotations({
    identifier: "InventoryError",
    description: "インベントリシステムエラー"
  })
)

export type InventoryError = Schema.Schema.Type<typeof InventoryError>

// Data型エラークラス（Effect推奨パターン）
export class InventoryNotFoundError extends Data.TaggedError("InventoryNotFound")<{
  readonly inventoryId: InventoryId
  readonly context?: string
}> {}

export class InventoryFullError extends Data.TaggedError("InventoryFull")<{
  readonly inventoryId: InventoryId
  readonly attemptedItem: ItemStack
  readonly availableSlots: number
}> {}

export class SlotLockedError extends Data.TaggedError("SlotLocked")<{
  readonly inventoryId: InventoryId
  readonly slotIndex: SlotIndex
  readonly reason: string
}> {}

export class InvalidItemStackError extends Data.TaggedError("InvalidItemStack")<{
  readonly itemId: ItemId
  readonly count: number
  readonly reason: string
}> {}

export class TransferConstraintViolationError extends Data.TaggedError("TransferConstraintViolation")<{
  readonly fromInventoryId: InventoryId
  readonly toInventoryId: InventoryId
  readonly constraint: string
  readonly details: Record<string, unknown>
}> {}

export class ConcurrentModificationError extends Data.TaggedError("ConcurrentModification")<{
  readonly inventoryId: InventoryId
  readonly expectedVersion: number
  readonly actualVersion: number
}> {}

export class NetworkSyncError extends Data.TaggedError("NetworkSyncError")<{
  readonly inventoryId: InventoryId
  readonly playerId: string
  readonly errorCode: string
  readonly retryCount: number
}> {}

// エラーハンドリングサービス
export interface InventoryErrorHandler {
  readonly handleError: <A>(
    effect: Effect.Effect<A, InventoryError>,
    fallback?: A
  ) => Effect.Effect<A>

  readonly retryWithBackoff: <A, E extends InventoryError>(
    effect: Effect.Effect<A, E>,
    maxRetries?: number
  ) => Effect.Effect<A, E>

  readonly logAndRecover: <A>(
    effect: Effect.Effect<A, InventoryError>,
    recovery: (error: InventoryError) => Effect.Effect<A>
  ) => Effect.Effect<A>
}

export const InventoryErrorHandler = Context.GenericTag<InventoryErrorHandler>("@minecraft/InventoryErrorHandler")

// エラーハンドラー実装
export const makeInventoryErrorHandler = (): Effect.Effect<
  InventoryErrorHandler,
  never,
  Logger | NotificationService | MetricsService
> =>
  Effect.gen(function* () {
    const logger = yield* Logger
    const notificationService = yield* NotificationService
    const metricsService = yield* MetricsService

    return {
      handleError: <A>(effect: Effect.Effect<A, InventoryError>, fallback?: A) =>
        effect.pipe(
          Effect.catchTags({
            InventoryNotFound: (error) =>
              Effect.gen(function* () {
                yield* logger.warn(`インベントリが見つかりません: ${error.inventoryId}`, error)
                yield* metricsService.incrementCounter("inventory.errors.not_found")

                if (fallback !== undefined) {
                  return fallback
                }

                return yield* Effect.fail(error)
              }),

            InventoryFull: (error) =>
              Effect.gen(function* () {
                yield* logger.info(`インベントリ満杯: ${error.inventoryId}`, error)
                yield* notificationService.showError("インベントリがいっぱいです！")
                yield* metricsService.incrementCounter("inventory.errors.full")

                if (fallback !== undefined) {
                  return fallback
                }

                return yield* Effect.fail(error)
              }),

            SlotLocked: (error) =>
              Effect.gen(function* () {
                yield* logger.debug(`スロットロック: ${error.inventoryId}[${error.slotIndex}]`, error)
                yield* notificationService.showWarning(`スロットがロックされています: ${error.reason}`)

                if (fallback !== undefined) {
                  return fallback
                }

                return yield* Effect.fail(error)
              }),

            InvalidItemStack: (error) =>
              Effect.gen(function* () {
                yield* logger.error(`無効なアイテムスタック: ${error.itemId}`, error)
                yield* metricsService.incrementCounter("inventory.errors.invalid_stack")

                if (fallback !== undefined) {
                  return fallback
                }

                return yield* Effect.fail(error)
              }),

            TransferConstraintViolation: (error) =>
              Effect.gen(function* () {
                yield* logger.warn(`転送制約違反: ${error.constraint}`, error)
                yield* notificationService.showWarning("アイテム転送が制限されています")

                if (fallback !== undefined) {
                  return fallback
                }

                return yield* Effect.fail(error)
              }),

            ConcurrentModification: (error) =>
              Effect.gen(function* () {
                yield* logger.warn(`同時変更競合: ${error.inventoryId}`, error)
                yield* metricsService.incrementCounter("inventory.errors.concurrent_modification")

                if (fallback !== undefined) {
                  return fallback
                }

                return yield* Effect.fail(error)
              }),

            NetworkSyncError: (error) =>
              Effect.gen(function* () {
                yield* logger.error(`ネットワーク同期エラー: ${error.errorCode}`, error)
                yield* metricsService.incrementCounter("inventory.errors.network_sync")

                if (error.retryCount < 3) {
                  // 3回まで自動リトライ
                  yield* notificationService.showInfo("接続を再試行中...")
                  return yield* Effect.fail(error)
                }

                yield* notificationService.showError("ネットワーク接続に問題があります")

                if (fallback !== undefined) {
                  return fallback
                }

                return yield* Effect.fail(error)
              })
          })
        ),

      retryWithBackoff: <A, E extends InventoryError>(
        effect: Effect.Effect<A, E>,
        maxRetries = 3
      ) =>
        effect.pipe(
          Effect.retry(
            Schedule.exponential(Duration.millis(100)).pipe(
              Schedule.intersect(Schedule.recurs(maxRetries)),
              Schedule.whileInput((error: E) =>
                error._tag === "ConcurrentModification" ||
                error._tag === "NetworkSyncError"
              )
            )
          ),
          Effect.tapError(error =>
            logger.warn(`リトライ後もエラーが継続: ${error._tag}`, error)
          )
        ),

      logAndRecover: <A>(
        effect: Effect.Effect<A, InventoryError>,
        recovery: (error: InventoryError) => Effect.Effect<A>
      ) =>
        effect.pipe(
          Effect.catchAll(error =>
            Effect.gen(function* () {
              yield* logger.error(`インベントリエラーからのリカバリ: ${error._tag}`, error)
              yield* metricsService.incrementCounter("inventory.errors.recovered")

              return yield* recovery(error)
            })
          )
        )
    }
  })

// エラーハンドラーレイヤー
export const InventoryErrorHandlerLayer = Layer.effect(
  InventoryErrorHandler,
  makeInventoryErrorHandler()
)

// よく使用されるエラーハンドリングパターン
export const InventoryErrorPatterns = {
  // ユーザーフレンドリーなエラーメッセージ
  userFriendlyMessage: (error: InventoryError): string =>
    Match.value(error).pipe(
      Match.when({ _tag: "InventoryNotFound" }, () => "インベントリが見つかりません"),
      Match.when({ _tag: "InventoryFull" }, () => "インベントリがいっぱいです"),
      Match.when({ _tag: "SlotLocked" }, (e) => `スロットがロック中: ${e.reason}`),
      Match.when({ _tag: "InvalidItemStack" }, (e) => `無効なアイテム: ${e.reason}`),
      Match.when({ _tag: "TransferConstraintViolation" }, () => "転送が制限されています"),
      Match.when({ _tag: "ConcurrentModification" }, () => "他の操作と競合しました"),
      Match.when({ _tag: "NetworkSyncError" }, () => "ネットワークエラーが発生しました"),
      Match.exhaustive
    ),

  // 自動回復可能かチェック
  isRecoverable: (error: InventoryError): boolean =>
    Match.value(error).pipe(
      Match.when({ _tag: "InventoryNotFound" }, () => false),
      Match.when({ _tag: "InventoryFull" }, () => true), // 空きができれば回復可能
      Match.when({ _tag: "SlotLocked" }, () => true), // ロック解除で回復可能
      Match.when({ _tag: "InvalidItemStack" }, () => false),
      Match.when({ _tag: "TransferConstraintViolation" }, () => false),
      Match.when({ _tag: "ConcurrentModification" }, () => true), // リトライで回復可能
      Match.when({ _tag: "NetworkSyncError" }, () => true), // 再接続で回復可能
      Match.exhaustive
    ),

  // エラーの重要度
  severity: (error: InventoryError): "low" | "medium" | "high" | "critical" =>
    Match.value(error).pipe(
      Match.when({ _tag: "InventoryNotFound" }, () => "medium" as const),
      Match.when({ _tag: "InventoryFull" }, () => "low" as const),
      Match.when({ _tag: "SlotLocked" }, () => "low" as const),
      Match.when({ _tag: "InvalidItemStack" }, () => "high" as const),
      Match.when({ _tag: "TransferConstraintViolation" }, () => "medium" as const),
      Match.when({ _tag: "ConcurrentModification" }, () => "medium" as const),
      Match.when({ _tag: "NetworkSyncError" }, () => "high" as const),
      Match.exhaustive
    )
}

// 回路ブレーカーパターン
export const makeInventoryCircuitBreaker = (
  name: string,
  failureThreshold = 5,
  resetTimeout = Duration.seconds(30)
): Effect.Effect<
  <A>(effect: Effect.Effect<A, InventoryError>) => Effect.Effect<A, InventoryError | "CircuitBreakerOpen">,
  never,
  MetricsService
> =>
  Effect.gen(function* () {
    const metricsService = yield* MetricsService

    const state = yield* Ref.make<{
      failures: number
      lastFailureTime: number
      isOpen: boolean
    }>({
      failures: 0,
      lastFailureTime: 0,
      isOpen: false
    })

    return <A>(effect: Effect.Effect<A, InventoryError>) =>
      Effect.gen(function* () {
        const currentState = yield* Ref.get(state)
        const now = Date.now()

        // 回路が開いている場合
        if (currentState.isOpen) {
          if (now - currentState.lastFailureTime > resetTimeout.pipe(Duration.toMillis)) {
            // タイムアウト後、半開状態にリセット
            yield* Ref.set(state, { failures: 0, lastFailureTime: 0, isOpen: false })
            yield* metricsService.recordValue(`inventory.circuit_breaker.${name}.reset`, 1)
          } else {
            yield* metricsService.incrementCounter(`inventory.circuit_breaker.${name}.rejected`)
            return yield* Effect.fail("CircuitBreakerOpen" as const)
          }
        }

        return yield* effect.pipe(
          Effect.tapSuccess(() =>
            Effect.gen(function* () {
              // 成功時は失敗カウンターをリセット
              yield* Ref.update(state, s => ({ ...s, failures: 0 }))
              yield* metricsService.incrementCounter(`inventory.circuit_breaker.${name}.success`)
            })
          ),
          Effect.tapError((error) =>
            Effect.gen(function* () {
              const newFailures = currentState.failures + 1
              const shouldOpen = newFailures >= failureThreshold

              yield* Ref.set(state, {
                failures: newFailures,
                lastFailureTime: now,
                isOpen: shouldOpen
              })

              yield* metricsService.incrementCounter(`inventory.circuit_breaker.${name}.failure`)

              if (shouldOpen) {
                yield* metricsService.incrementCounter(`inventory.circuit_breaker.${name}.opened`)
              }
            })
          )
        )
      })
  })
```

## 関連ドキュメント

- [プレイヤーシステム](./02-player-system.md) - プレイヤーインベントリの統合
- [クラフトシステム](./02-crafting-system.md) - クラフト材料とインベントリ連携
- [エンティティシステム](./04-entity-system.md) - アイテムドロップとエンティティ
- [マテリアルシステム](./10-material-system.md) - アイテム材料とツール管理
- [ECS統合](../../01-architecture/05-ecs-integration.md) - ECSコンポーネント設計
- [Effect-TSパターン](../../01-architecture/06-effect-ts-patterns.md) - Schema・サービス定義

## 用語集

- **コンポーネント (Component)**: ECSにおけるデータの単位 ([詳細](../../04-appendix/00-glossary.md#component))
- **Effect (エフェクト)**: Effect-TSの副作用管理型 ([詳細](../../04-appendix/00-glossary.md#effect))
- **エンティティコンポーネントシステム (Entity Component System)**: ゲーム開発アーキテクチャ ([詳細](../../04-appendix/00-glossary.md#ecs))
- **不変性 (Immutability)**: オブジェクトの状態が変更されない性質 ([詳細](../../04-appendix/00-glossary.md#immutability))
- **スキーマ (Schema)**: 型安全なデータ定義システム ([詳細](../../04-appendix/00-glossary.md#schema))
- **値オブジェクト (Value Object)**: DDDの戦術パターン ([詳細](../../04-appendix/00-glossary.md#value-object))

## まとめ

インベントリシステムは：
- **型安全**: Effect-TS の Schema による完全な型定義
- **不変性**: すべての操作が新しいインベントリを返す
- **ECS統合**: コンポーネントとシステムによる効率的な処理
- **エラー処理**: タグ付きエラーによる型安全なエラーハンドリング
- **最適化**: スパース実装とバッチ処理による効率化
