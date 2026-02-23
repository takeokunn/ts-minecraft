---
title: 'インベントリシステム仕様 - アイテム管理・UI・持続化'
description: 'プレイヤーインベントリ、チェスト、アイテム転送システムの完全仕様。Effect-TSによる型安全な実装パターンとDDD境界づけられたコンテキスト設計。'
category: 'specification'
difficulty: 'intermediate'
tags: ['inventory-system', 'item-management', 'player-system', 'ui-system', 'persistence', 'ddd-context']
prerequisites: ['effect-ts-fundamentals', 'schema-basics', 'ddd-concepts']
estimated_reading_time: '12分'
related_patterns: ['data-modeling-patterns', 'service-patterns', 'validation-patterns']
related_docs:
  [
    './player-system.md',
    '../enhanced-features/villager-trading.md',
    '../explanations/architecture/05-ecs-integration.md',
  ]
---

# インベントリシステム

## 1. 概要

Minecraftクローンのインベントリシステムは、アイテムの保管、管理、転送を担当します。DDDの境界づけられたコンテキストとして設計され、ECSアーキテクチャと統合されています。

> **🔗 完全なAPI仕様**: インベントリシステムの詳細な型定義、インターフェース、実装パターンは [Game Inventory API Reference](../../../reference/game-systems/game-inventory-api.md) を参照してください。

## 2. ドメインモデル

### 2.1 アイテム定義

```typescript
import { Schema, Brand, Effect, Option, Match, Data } from 'effect'

// ブランド型定義（Schema.brand使用）
type ItemId = string & Brand.Brand<'ItemId'>
type SlotIndex = number & Brand.Brand<'SlotIndex'>

export const ItemIdBrand = Brand.nominal<ItemId>()
export const SlotIndexBrand = Brand.refined<SlotIndex>(
  (n): n is SlotIndex => Number.isInteger(n) && n >= 0,
  (n) => Brand.error(`SlotIndex must be non-negative integer, got ${n}`)
)

export const ItemId = Schema.String.pipe(Schema.brand('ItemId'), Schema.annotations({ description: 'アイテム識別子' }))
export const SlotIndex = Schema.Number.pipe(
  Schema.int(),
  Schema.greaterThanOrEqualTo(0),
  Schema.brand('SlotIndex'),
  Schema.annotations({ description: 'スロットインデックス' })
)

// アイテムカテゴリ用Schema
export const ItemCategory = Schema.Literal('block', 'tool', 'weapon', 'armor', 'food', 'material').pipe(
  Schema.annotations({ description: 'アイテムカテゴリ' })
)

// アイテムメタデータスキーマ（バリデーション強化）
export const ItemMetadata = Schema.Struct({
  durability: Schema.optionalWith(
    Schema.Number.pipe(Schema.between(0, 1), Schema.annotations({ description: 'アイテムの耐久度(0-1)' })),
    { default: () => 1.0 }
  ),
  enchantments: Schema.optionalWith(
    Schema.Array(Schema.String).pipe(
      Schema.maxItems(10),
      Schema.filter((enchants) => enchants.every((e) => e.length > 0), {
        message: () => 'エンチャント名は空文字列にできません',
      }),
      Schema.annotations({ description: 'エンチャント一覧' })
    ),
    { default: () => [] }
  ),
  customName: Schema.optionalWith(
    Schema.String.pipe(Schema.maxLength(64), Schema.minLength(1), Schema.annotations({ description: 'カスタム名' })),
    { default: () => undefined }
  ),
  lore: Schema.optionalWith(
    Schema.Array(Schema.String).pipe(Schema.maxItems(20), Schema.annotations({ description: '説明文' })),
    { default: () => [] }
  ),
}).pipe(
  Schema.annotations({
    identifier: 'ItemMetadata',
    description: 'アイテムのメタデータ情報',
  })
)

// アイテムスタックスキーマ（厳密なバリデーション）
export const ItemStack = Schema.Struct({
  itemId: ItemId,
  count: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 64),
    Schema.annotations({ description: 'アイテム数量(1-64)' })
  ),
  metadata: Schema.optionalWith(ItemMetadata, { default: () => ({}) }),
}).pipe(
  Schema.filter((stack) => stack.count > 0, { message: () => 'アイテム数量は1以上である必要があります' }),
  Schema.annotations({
    identifier: 'ItemStack',
    description: 'インベントリ内のアイテムスタック',
  })
)

export type ItemStack = Schema.Schema.Type<typeof ItemStack>

// アイテム定義スキーマ（検証ルール追加）
export const ItemDefinition = Schema.Struct({
  id: ItemId,
  name: Schema.String.pipe(
    Schema.maxLength(64),
    Schema.minLength(1),
    Schema.annotations({ description: 'アイテム表示名' })
  ),
  maxStackSize: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 64),
    Schema.annotations({ description: '最大スタック数' })
  ),
  category: ItemCategory,
  properties: Schema.Record({
    key: Schema.String,
    value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
  }).pipe(Schema.annotations({ description: 'アイテム固有プロパティ' })),
}).pipe(
  Schema.annotations({
    identifier: 'ItemDefinition',
    description: 'アイテムの定義情報',
  })
)

export type ItemDefinition = Schema.Schema.Type<typeof ItemDefinition>

// エラー型定義（タグ付きエラー - 関数形式）
export const CannotMergeStacksError = Schema.TaggedError('CannotMergeStacks', {
  reason: Schema.String,
  stack1: ItemStack,
  stack2: ItemStack,
})

export const StackOverflowError = Schema.TaggedError('StackOverflow', {
  attempted: Schema.Number,
  maxAllowed: Schema.Number,
})

export const InvalidSplitAmountError = Schema.TaggedError('InvalidSplitAmount', {
  amount: Schema.Number,
  available: Schema.Number,
})

export type CannotMergeStacksError = Schema.Schema.Type<typeof CannotMergeStacksError>
export type StackOverflowError = Schema.Schema.Type<typeof StackOverflowError>
export type InvalidSplitAmountError = Schema.Schema.Type<typeof InvalidSplitAmountError>

// アイテムスタック操作（Effect-based）
export const ItemStackOperations = {
  // スタック結合可能性チェック（純粋関数）
  canMerge: (stack1: ItemStack, stack2: ItemStack): boolean =>
    stack1.itemId === stack2.itemId && JSON.stringify(stack1.metadata) === JSON.stringify(stack2.metadata),

  // スタック結合検証
  validateMerge: (stack1: ItemStack, stack2: ItemStack): Effect.Effect<void, CannotMergeStacksError> =>
    ItemStackOperations.canMerge(stack1, stack2)
      ? Effect.void
      : Effect.fail(
          CannotMergeStacksError({
            reason: 'アイテムIDまたはメタデータが異なります',
            stack1,
            stack2,
          })
        ),

  // スタック結合（Early Return + Match使用）
  merge: (
    stack1: ItemStack,
    stack2: ItemStack,
    maxStack: number
  ): Effect.Effect<[ItemStack, Option.Option<ItemStack>], CannotMergeStacksError | StackOverflowError> =>
    Effect.gen(function* () {
      // 早期バリデーション
      yield* ItemStackOperations.validateMerge(stack1, stack2)

      const totalCount = stack1.count + stack2.count

      // Match.value を使用してパターンマッチング
      return yield* Match.value(totalCount).pipe(
        Match.when(
          (count) => count <= maxStack,
          (count) => Effect.succeed([{ ...stack1, count }, Option.none<ItemStack>()] as const)
        ),
        Match.when(
          (count) => count > maxStack,
          (count) =>
            Effect.succeed([
              { ...stack1, count: maxStack },
              Option.some({ ...stack2, count: count - maxStack }),
            ] as const)
        ),
        Match.exhaustive
      )
    }),

  // スタック分割（バリデーション強化）
  split: (stack: ItemStack, amount: number): Effect.Effect<[ItemStack, ItemStack], InvalidSplitAmountError> =>
    Effect.gen(function* () {
      // 入力値検証（早期リターン）
      if (amount <= 0) {
        return yield* Effect.fail(
          InvalidSplitAmountError({
            amount,
            available: stack.count,
          })
        )
      }

      if (amount >= stack.count) {
        return yield* Effect.fail(
          InvalidSplitAmountError({
            amount,
            available: stack.count,
          })
        )
      }

      const splitStack = { ...stack, count: amount }
      const remainingStack = { ...stack, count: stack.count - amount }

      // Schema検証
      const validatedSplit = yield* Schema.decode(ItemStack)(splitStack)
      const validatedRemaining = yield* Schema.decode(ItemStack)(remainingStack)

      return [validatedSplit, validatedRemaining]
    }),

  // アイテムスタック作成（ファクトリー関数）
  create: (
    itemId: ItemId,
    count: number,
    metadata?: Partial<Schema.Schema.Type<typeof ItemMetadata>>
  ): Effect.Effect<ItemStack, Schema.ParseResult.ParseError> =>
    Schema.decode(ItemStack)({
      itemId,
      count,
      metadata: metadata ?? {},
    }),

  // スタック統計情報
  getStackInfo: (stack: ItemStack) => ({
    isEmpty: stack.count === 0,
    isFull: (maxSize: number) => stack.count >= maxSize,
    remainingCapacity: (maxSize: number) => Math.max(0, maxSize - stack.count),
    canAccept: (amount: number, maxSize: number) => stack.count + amount <= maxSize,
  }),
}
```

### 2.2 インベントリ構造

```typescript
import { Effect, Option, ReadonlyArray, Ref, STM, TRef, Match, HashMap, Chunk, Stream, Context, Data } from 'effect'

// ブランド型定義（インベントリID）
type InventoryId = string & Brand.Brand<'InventoryId'>
export const InventoryIdBrand = Brand.refined<InventoryId>(
  (id): id is InventoryId => typeof id === 'string' && id.length > 0,
  (id) => Brand.error(`InventoryId must be non-empty string, got "${id}"`)
)

export const InventoryId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('InventoryId'),
  Schema.annotations({ description: 'インベントリ識別子' })
)

// アイテムフィルター関数型
export const ItemFilter = Schema.Function.pipe(
  Schema.annotations({
    description: 'アイテム受け入れフィルタ関数',
  })
)

// インベントリスロット（Schema定義・検証強化）
export const InventorySlot = Schema.Struct({
  index: SlotIndex,
  item: Schema.optionalWith(ItemStack, { default: () => Option.none() }),
  locked: Schema.Boolean.pipe(Schema.annotations({ description: 'スロットのロック状態' })),
  acceptFilter: Schema.optionalWith(ItemFilter, { default: () => undefined }),
  lastUpdated: Schema.optionalWith(Schema.Number.pipe(Schema.int(), Schema.positive()), { default: () => Date.now() }),
}).pipe(
  Schema.filter((slot) => slot.index >= 0, { message: () => 'スロットインデックスは0以上である必要があります' }),
  Schema.annotations({
    identifier: 'InventorySlot',
    description: 'インベントリの単一スロット',
  })
)

export type InventorySlot = Schema.Schema.Type<typeof InventorySlot>

// インベントリタイプ（拡張）
export const InventoryType = Schema.Literal(
  'player',
  'chest',
  'furnace',
  'crafting',
  'enchanting',
  'hopper',
  'dispenser',
  'ender_chest',
  'shulker_box'
).pipe(Schema.annotations({ description: 'インベントリの種類' }))

export type InventoryType = Schema.Schema.Type<typeof InventoryType>

// インベントリ制約（詳細化）
export const InventoryConstraints = Schema.Struct({
  maxSlots: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 256),
    Schema.annotations({ description: '最大スロット数' })
  ),
  allowedItems: Schema.optionalWith(
    Schema.Array(ItemId).pipe(Schema.maxItems(1000), Schema.annotations({ description: '許可されたアイテムID一覧' })),
    { default: () => Option.none() }
  ),
  forbiddenItems: Schema.optionalWith(
    Schema.Array(ItemId).pipe(Schema.maxItems(1000), Schema.annotations({ description: '禁止されたアイテムID一覧' })),
    { default: () => Option.none() }
  ),
  maxStackSize: Schema.optionalWith(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(1, 64),
      Schema.annotations({ description: '最大スタック数の上書き' })
    ),
    { default: () => Option.none() }
  ),
  slotRestrictions: Schema.optionalWith(
    Schema.Record({
      key: SlotIndex,
      value: Schema.Array(ItemCategory),
    }).pipe(Schema.annotations({ description: 'スロット別アイテム制限' })),
    { default: () => {} }
  ),
}).pipe(
  Schema.annotations({
    identifier: 'InventoryConstraints',
    description: 'インベントリの制約定義',
  })
)

export type InventoryConstraints = Schema.Schema.Type<typeof InventoryConstraints>

// インベントリ状態（STM用・バージョン管理）
export const InventoryState = Schema.Struct({
  id: InventoryId,
  type: InventoryType,
  slots: Schema.Array(InventorySlot).pipe(
    Schema.maxItems(256),
    Schema.filter((slots) => slots.every((slot, index) => slot.index === index), {
      message: () => 'スロットのインデックスが順序通りでありません',
    })
  ),
  constraints: InventoryConstraints,
  version: Schema.Number.pipe(
    Schema.int(),
    Schema.greaterThanOrEqualTo(0),
    Schema.annotations({ description: 'バージョン番号（楽観的ロック用）' })
  ),
  createdAt: Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.annotations({ description: '作成時刻' })),
  lastModified: Schema.Number.pipe(
    Schema.int(),
    Schema.positive(),
    Schema.annotations({ description: '最終更新時刻' })
  ),
}).pipe(
  Schema.filter((state) => state.slots.length <= state.constraints.maxSlots, {
    message: () => 'スロット数が制約を超過しています',
  }),
  Schema.annotations({
    identifier: 'InventoryState',
    description: 'インベントリの状態情報',
  })
)

export type InventoryState = Schema.Schema.Type<typeof InventoryState>

// インベントリイベント定義（詳細化）
export const InventoryEvent = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('ItemAdded'),
    inventoryId: InventoryId,
    slotIndex: SlotIndex,
    item: ItemStack,
    timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
    source: Schema.optionalWith(Schema.Literal('pickup', 'craft', 'trade', 'admin'), { default: () => 'pickup' }),
  }),
  Schema.Struct({
    _tag: Schema.Literal('ItemRemoved'),
    inventoryId: InventoryId,
    slotIndex: SlotIndex,
    item: ItemStack,
    timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
    reason: Schema.optionalWith(Schema.Literal('consume', 'drop', 'craft', 'transfer'), { default: () => 'consume' }),
  }),
  Schema.Struct({
    _tag: Schema.Literal('ItemMoved'),
    fromInventoryId: InventoryId,
    toInventoryId: InventoryId,
    fromSlot: SlotIndex,
    toSlot: SlotIndex,
    item: ItemStack,
    timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
    isSwap: Schema.Boolean.pipe(Schema.annotations({ description: 'アイテム交換かどうか' })),
  }),
  Schema.Struct({
    _tag: Schema.Literal('InventoryCleared'),
    inventoryId: InventoryId,
    timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
    reason: Schema.optionalWith(Schema.Literal('death', 'admin', 'reset'), { default: () => 'admin' }),
  }),
  Schema.Struct({
    _tag: Schema.Literal('SlotLocked'),
    inventoryId: InventoryId,
    slotIndex: SlotIndex,
    timestamp: Schema.Number.pipe(Schema.int(), Schema.positive()),
    reason: Schema.String,
  })
).pipe(
  Schema.annotations({
    identifier: 'InventoryEvent',
    description: 'インベントリ操作イベント',
  })
)

export type InventoryEvent = Schema.Schema.Type<typeof InventoryEvent>

// インベントリエラー定義（関数形式）
export const InventoryNotFoundError = Schema.TaggedError('InventoryNotFound', {
  inventoryId: InventoryId,
  context: Schema.optionalWith(Schema.String, { default: () => undefined }),
})

export const InventoryFullError = Schema.TaggedError('InventoryFull', {
  inventoryId: InventoryId,
  attemptedItem: ItemStack,
  availableSlots: Schema.Number,
})

export const SlotEmptyError = Schema.TaggedError('SlotEmpty', {
  inventoryId: InventoryId,
  slotIndex: SlotIndex,
})

export const ItemTransferFailedError = Schema.TaggedError('ItemTransferFailed', {
  reason: Schema.String,
  fromInventoryId: InventoryId,
  toInventoryId: InventoryId,
  item: ItemStack,
})

export type InventoryNotFoundError = Schema.Schema.Type<typeof InventoryNotFoundError>
export type InventoryFullError = Schema.Schema.Type<typeof InventoryFullError>
export type SlotEmptyError = Schema.Schema.Type<typeof SlotEmptyError>
export type ItemTransferFailedError = Schema.Schema.Type<typeof ItemTransferFailedError>

// インベントリサービス定義（Effect-based）
export interface InventoryService {
  readonly create: (type: InventoryType, constraints: InventoryConstraints) => Effect.Effect<InventoryId, never, never>

  readonly get: (id: InventoryId) => Effect.Effect<InventoryState, InventoryNotFoundError, never>

  readonly addItem: (
    id: InventoryId,
    item: ItemStack
  ) => Effect.Effect<SlotIndex, InventoryFullError | InventoryNotFoundError, never>

  readonly removeItem: (
    id: InventoryId,
    slotIndex: SlotIndex
  ) => Effect.Effect<ItemStack, InventoryNotFoundError | SlotEmptyError, never>

  readonly moveItem: (
    fromId: InventoryId,
    toId: InventoryId,
    fromSlot: SlotIndex,
    toSlot: SlotIndex,
    amount?: number
  ) => Effect.Effect<void, ItemTransferFailedError, never>

  readonly subscribe: (id: InventoryId) => Stream.Stream<InventoryEvent, InventoryNotFoundError, never>

  readonly validateConstraints: (
    inventoryId: InventoryId,
    item: ItemStack,
    targetSlot?: SlotIndex
  ) => Effect.Effect<void, string, never>
}

export const InventoryService = Context.GenericTag<InventoryService>('@minecraft/InventoryService')

// STMベースのインベントリ操作（Effect-TS最適化）
export const InventoryOperations = {
  // アイテム追加（STMによる原子的操作・早期リターン）
  addItemSTM: (
    inventoryRef: TRef.TRef<InventoryState>,
    item: ItemStack,
    itemDefinitions: ReadonlyArray<ItemDefinition>
  ): STM.STM<SlotIndex, InventoryFullError | Schema.TaggedError<'InvalidItem'>> =>
    STM.gen(function* () {
      // 入力バリデーション（早期リターン）
      const itemDef = yield* STM.fromEffect(
        Effect.gen(function* () {
          const found = ReadonlyArray.findFirst(itemDefinitions, (def) => def.id === item.itemId)
          return Option.isSome(found)
            ? Effect.succeed(found.value)
            : Effect.fail(
                new Schema.TaggedError('InvalidItem')({
                  itemId: item.itemId,
                })
              )
        })
      )

      const inventory = yield* TRef.get(inventoryRef)

      // 制約チェック
      yield* STM.fromEffect(InventoryOperations.validateItemPlacement(inventory, item, itemDef))

      // 既存スタック検索とマージ（Match使用）
      const existingSlotResult = yield* InventoryOperations.findMergableSlotSTM(inventory, item, itemDef.maxStackSize)

      return yield* Match.value(existingSlotResult).pipe(
        Match.when(Option.isSome, ({ value: slotIndex }) =>
          InventoryOperations.mergeToExistingSlotSTM(
            inventoryRef,
            slotIndex,
            item,
            itemDef.maxStackSize,
            itemDefinitions
          )
        ),
        Match.when(Option.isNone, () => InventoryOperations.addToEmptySlotSTM(inventoryRef, item)),
        Match.exhaustive
      )
    }),

  // マージ可能スロット検索（STM内関数）
  findMergableSlotSTM: (
    inventory: InventoryState,
    item: ItemStack,
    maxStackSize: number
  ): STM.STM<Option.Option<number>, never> =>
    STM.succeed(
      ReadonlyArray.findFirstIndex(
        inventory.slots,
        (slot, index) =>
          Option.isSome(slot.item) &&
          !slot.locked &&
          ItemStackOperations.canMerge(slot.item.value, item) &&
          slot.item.value.count < maxStackSize
      )
    ),

  // 既存スロットへのマージ（再帰処理）
  mergeToExistingSlotSTM: (
    inventoryRef: TRef.TRef<InventoryState>,
    slotIndex: number,
    item: ItemStack,
    maxStackSize: number,
    itemDefinitions: ReadonlyArray<ItemDefinition>
  ): STM.STM<SlotIndex, InventoryFullError> =>
    STM.gen(function* () {
      const inventory = yield* TRef.get(inventoryRef)
      const slot = inventory.slots[slotIndex]
      const existingItem = slot.item.value! // 既に検証済み

      // スタックマージ
      const mergeResult = yield* STM.fromEffect(ItemStackOperations.merge(existingItem, item, maxStackSize))

      const [mergedStack, remaining] = mergeResult
      const now = Date.now()

      // スロット更新
      const updatedSlots = ReadonlyArray.modify(inventory.slots, slotIndex, (s) => ({
        ...s,
        item: Option.some(mergedStack),
        lastUpdated: now,
      }))

      yield* TRef.set(inventoryRef, {
        ...inventory,
        slots: updatedSlots,
        version: inventory.version + 1,
        lastModified: now,
      })

      // 残りアイテムがある場合は再帰的に処理
      if (Option.isSome(remaining)) {
        return yield* InventoryOperations.addItemSTM(inventoryRef, remaining.value, itemDefinitions)
      }

      return SlotIndexBrand(slotIndex)
    }),

  // 空きスロットへの追加
  addToEmptySlotSTM: (
    inventoryRef: TRef.TRef<InventoryState>,
    item: ItemStack
  ): STM.STM<SlotIndex, InventoryFullError> =>
    STM.gen(function* () {
      const inventory = yield* TRef.get(inventoryRef)

      const emptySlotIndex = ReadonlyArray.findFirstIndex(
        inventory.slots,
        (slot) => Option.isNone(slot.item) && !slot.locked
      )

      if (Option.isNone(emptySlotIndex)) {
        return yield* STM.fail(
          new InventoryFullError({
            inventoryId: inventory.id,
            attemptedItem: item,
            availableSlots: 0,
          })
        )
      }

      const slotIndex = emptySlotIndex.value
      const now = Date.now()

      const updatedSlots = ReadonlyArray.modify(inventory.slots, slotIndex, (s) => ({
        ...s,
        item: Option.some(item),
        lastUpdated: now,
      }))

      yield* TRef.set(inventoryRef, {
        ...inventory,
        slots: updatedSlots,
        version: inventory.version + 1,
        lastModified: now,
      })

      return SlotIndexBrand(slotIndex)
    }),

  // アイテム移動（STMによる原子的操作・検証強化）
  moveItemSTM: (
    fromRef: TRef.TRef<InventoryState>,
    toRef: TRef.TRef<InventoryState>,
    fromSlot: SlotIndex,
    toSlot: SlotIndex,
    amount?: number
  ): STM.STM<void, SlotEmptyError | ItemTransferFailedError> =>
    STM.gen(function* () {
      const fromInventory = yield* TRef.get(fromRef)
      const toInventory = yield* TRef.get(toRef)

      // 入力検証（早期リターン）
      const sourceSlot = fromInventory.slots[fromSlot]

      if (Option.isNone(sourceSlot.item)) {
        return yield* STM.fail(
          new SlotEmptyError({
            inventoryId: fromInventory.id,
            slotIndex: fromSlot,
          })
        )
      }

      if (sourceSlot.locked) {
        return yield* STM.fail(
          new ItemTransferFailedError({
            reason: '送信元スロットがロックされています',
            fromInventoryId: fromInventory.id,
            toInventoryId: toInventory.id,
            item: sourceSlot.item.value,
          })
        )
      }

      const sourceItem = sourceSlot.item.value
      const transferAmount = amount ?? sourceItem.count

      // 転送量検証
      if (transferAmount <= 0 || transferAmount > sourceItem.count) {
        return yield* STM.fail(
          new ItemTransferFailedError({
            reason: `無効な転送量: ${transferAmount}`,
            fromInventoryId: fromInventory.id,
            toInventoryId: toInventory.id,
            item: sourceItem,
          })
        )
      }

      const targetSlot = toInventory.slots[toSlot]

      // ターゲットスロット検証
      if (targetSlot.locked) {
        return yield* STM.fail(
          new ItemTransferFailedError({
            reason: '送信先スロットがロックされています',
            fromInventoryId: fromInventory.id,
            toInventoryId: toInventory.id,
            item: sourceItem,
          })
        )
      }

      // 転送処理（Match使用）
      return yield* Match.value(targetSlot.item).pipe(
        Match.when(Option.isSome, (existingItem) =>
          InventoryOperations.handleItemMergeSTM(
            fromRef,
            toRef,
            fromSlot,
            toSlot,
            sourceItem,
            existingItem.value,
            transferAmount
          )
        ),
        Match.when(Option.isNone, () =>
          InventoryOperations.handleSimpleTransferSTM(fromRef, toRef, fromSlot, toSlot, sourceItem, transferAmount)
        ),
        Match.exhaustive
      )
    }),

  // アイテムマージ処理
  handleItemMergeSTM: (
    fromRef: TRef.TRef<InventoryState>,
    toRef: TRef.TRef<InventoryState>,
    fromSlot: SlotIndex,
    toSlot: SlotIndex,
    sourceItem: ItemStack,
    targetItem: ItemStack,
    transferAmount: number
  ): STM.STM<void, ItemTransferFailedError> =>
    STM.gen(function* () {
      if (!ItemStackOperations.canMerge(sourceItem, targetItem)) {
        return yield* STM.fail(
          new ItemTransferFailedError({
            reason: 'アイテムをマージできません',
            fromInventoryId: (yield* TRef.get(fromRef)).id,
            toInventoryId: (yield* TRef.get(toRef)).id,
            item: sourceItem,
          })
        )
      }

      const transferredItem = { ...sourceItem, count: transferAmount }
      const mergeResult = yield* STM.fromEffect(
        ItemStackOperations.merge(targetItem, transferredItem, 64) // TODO: 実際のmaxStackSize
      )

      const [mergedStack, overflow] = mergeResult

      if (Option.isSome(overflow)) {
        return yield* STM.fail(
          new ItemTransferFailedError({
            reason: 'ターゲットスロットの容量が不足しています',
            fromInventoryId: (yield* TRef.get(fromRef)).id,
            toInventoryId: (yield* TRef.get(toRef)).id,
            item: sourceItem,
          })
        )
      }

      yield* InventoryOperations.updateBothInventoriesSTM(
        fromRef,
        toRef,
        fromSlot,
        toSlot,
        sourceItem.count - transferAmount,
        mergedStack
      )
    }),

  // シンプル転送処理
  handleSimpleTransferSTM: (
    fromRef: TRef.TRef<InventoryState>,
    toRef: TRef.TRef<InventoryState>,
    fromSlot: SlotIndex,
    toSlot: SlotIndex,
    sourceItem: ItemStack,
    transferAmount: number
  ): STM.STM<void, never> =>
    STM.gen(function* () {
      const transferredItem = { ...sourceItem, count: transferAmount }
      const remainingCount = sourceItem.count - transferAmount

      yield* InventoryOperations.updateBothInventoriesSTM(
        fromRef,
        toRef,
        fromSlot,
        toSlot,
        remainingCount,
        transferredItem
      )
    }),

  // 両インベントリの原子的更新
  updateBothInventoriesSTM: (
    fromRef: TRef.TRef<InventoryState>,
    toRef: TRef.TRef<InventoryState>,
    fromSlot: SlotIndex,
    toSlot: SlotIndex,
    remainingSourceCount: number,
    targetItem: ItemStack
  ): STM.STM<void, never> =>
    STM.gen(function* () {
      const fromInventory = yield* TRef.get(fromRef)
      const toInventory = yield* TRef.get(toRef)
      const now = Date.now()

      // ソース更新
      const updatedFromSlots = ReadonlyArray.modify(fromInventory.slots, fromSlot, (s) => ({
        ...s,
        item:
          remainingSourceCount > 0
            ? Option.some({ ...fromInventory.slots[fromSlot].item.value!, count: remainingSourceCount })
            : Option.none(),
        lastUpdated: now,
      }))

      // ターゲット更新
      const updatedToSlots = ReadonlyArray.modify(toInventory.slots, toSlot, (s) => ({
        ...s,
        item: Option.some(targetItem),
        lastUpdated: now,
      }))

      // 両方を原子的に更新
      yield* STM.all([
        TRef.set(fromRef, {
          ...fromInventory,
          slots: updatedFromSlots,
          version: fromInventory.version + 1,
          lastModified: now,
        }),
        TRef.set(toRef, {
          ...toInventory,
          slots: updatedToSlots,
          version: toInventory.version + 1,
          lastModified: now,
        }),
      ])
    }),

  // アイテム配置検証
  validateItemPlacement: (
    inventory: InventoryState,
    item: ItemStack,
    itemDefinition: ItemDefinition
  ): Effect.Effect<void, ItemTransferFailedError> =>
    Effect.gen(function* () {
      // 許可アイテムチェック
      if (Option.isSome(inventory.constraints.allowedItems)) {
        const allowed = inventory.constraints.allowedItems.value
        if (!ReadonlyArray.contains(allowed, item.itemId)) {
          return yield* Effect.fail(
            new ItemTransferFailedError({
              reason: 'このアイテムは許可されていません',
              fromInventoryId: inventory.id,
              toInventoryId: inventory.id,
              item,
            })
          )
        }
      }

      // 禁止アイテムチェック
      if (Option.isSome(inventory.constraints.forbiddenItems)) {
        const forbidden = inventory.constraints.forbiddenItems.value
        if (ReadonlyArray.contains(forbidden, item.itemId)) {
          return yield* Effect.fail(
            new ItemTransferFailedError({
              reason: 'このアイテムは禁止されています',
              fromInventoryId: inventory.id,
              toInventoryId: inventory.id,
              item,
            })
          )
        }
      }
    }),

  // インベントリ圧縮（同種アイテムの統合・最適化版）
  compactInventorySTM: (
    inventoryRef: TRef.TRef<InventoryState>,
    itemDefinitions: ReadonlyArray<ItemDefinition>
  ): STM.STM<number, never> =>
    STM.gen(function* () {
      const inventory = yield* TRef.get(inventoryRef)

      // アイテムをグループ化（HashMap使用）
      const itemGroups = yield* STM.succeed(
        ReadonlyArray.reduce(
          inventory.slots,
          HashMap.empty<string, Array<{ slot: number; item: ItemStack }>>(),
          (acc, slot, index) => {
            if (Option.isSome(slot.item) && !slot.locked) {
              const itemId = slot.item.value.itemId
              const entry = { slot: index, item: slot.item.value }

              return HashMap.modify(acc, itemId, (existing) =>
                Option.isSome(existing) ? Option.some([...existing.value, entry]) : Option.some([entry])
              )
            }
            return acc
          }
        )
      )

      let compactedCount = 0
      let newSlots = [...inventory.slots]

      // 各グループを圧縮
      for (const [itemId, entries] of itemGroups) {
        if (entries.length <= 1) continue

        const itemDef = ReadonlyArray.findFirst(itemDefinitions, (def) => def.id === itemId)

        if (Option.isNone(itemDef)) continue

        const compactResult = yield* InventoryOperations.compactItemGroupSTM(entries, itemDef.value.maxStackSize)

        // スロット更新
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i]
          newSlots[entry.slot] = {
            ...newSlots[entry.slot],
            item: i < compactResult.length ? Option.some(compactResult[i]) : Option.none(),
            lastUpdated: Date.now(),
          }
        }

        compactedCount += Math.max(0, entries.length - compactResult.length)
      }

      if (compactedCount > 0) {
        yield* TRef.set(inventoryRef, {
          ...inventory,
          slots: newSlots,
          version: inventory.version + 1,
          lastModified: Date.now(),
        })
      }

      return compactedCount
    }),

  // アイテムグループ圧縮処理
  compactItemGroupSTM: (
    entries: Array<{ slot: number; item: ItemStack }>,
    maxStackSize: number
  ): STM.STM<Array<ItemStack>, never> =>
    STM.gen(function* () {
      let totalCount = entries.reduce((sum, entry) => sum + entry.item.count, 0)
      const baseItem = entries[0].item
      const result: Array<ItemStack> = []

      while (totalCount > 0) {
        const stackSize = Math.min(totalCount, maxStackSize)
        result.push({
          ...baseItem,
          count: stackSize,
        })
        totalCount -= stackSize
      }

      return result
    }),
}
```

## 3. ECS統合

### 3.1 インベントリコンポーネント

```typescript
import { Context, Layer, Service, Ref, Queue, Schedule, Duration } from 'effect'

// エンティティID定義
type EntityId = string & Brand.Brand<'EntityId'>
export const EntityId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('EntityId'),
  Schema.annotations({ description: 'エンティティ識別子' })
)

// ECSコンポーネント定義（Effect統合・型安全性強化）
export const InventoryComponent = Schema.Struct({
  inventoryId: InventoryId,
  inventoryRef: Schema.Unknown.pipe(
    Schema.annotations({
      description: 'TRef<InventoryState>への参照（型安全のため抽象化）',
    })
  ),
  eventStream: Schema.Unknown.pipe(
    Schema.annotations({
      description: 'Stream<InventoryEvent>への参照（型安全のため抽象化）',
    })
  ),
  lastSync: Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.annotations({ description: '最終同期時刻' })),
  isDirty: Schema.Boolean.pipe(Schema.annotations({ description: '変更フラグ' })),
  metadata: Schema.Record({
    key: Schema.String,
    value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
  }).pipe(Schema.annotations({ description: 'コンポーネント固有メタデータ' })),
}).pipe(
  Schema.annotations({
    identifier: 'InventoryComponent',
    description: 'ECSインベントリコンポーネント',
  })
)

export type InventoryComponent = Schema.Schema.Type<typeof InventoryComponent>

// コンポーネントファクトリー（Effect-based）
export const makeInventoryComponent = (
  inventoryId: InventoryId,
  inventoryRef: TRef.TRef<InventoryState>,
  eventStream: Stream.Stream<InventoryEvent, never, never>
): Effect.Effect<InventoryComponent, never, never> =>
  Effect.gen(function* () {
    const now = Date.now()

    // Schema検証を経由してコンポーネント作成
    return yield* Schema.decode(InventoryComponent)({
      inventoryId,
      inventoryRef: inventoryRef as unknown,
      eventStream: eventStream as unknown,
      lastSync: now,
      isDirty: false,
      metadata: {},
    })
  })

// ECSインベントリサービスエラー (関数型パターン)
export const ComponentCreationFailedError = Schema.TaggedError('ComponentCreationFailed')({
  entityId: Schema.String.pipe(Schema.brand('EntityId')),
  reason: Schema.String,
})

export const ComponentNotFoundError = Schema.TaggedError('ComponentNotFound')({
  entityId: Schema.String.pipe(Schema.brand('EntityId')),
})

export const ComponentUpdateFailedError = Schema.TaggedError('ComponentUpdateFailed')({
  entityId: Schema.String.pipe(Schema.brand('EntityId')),
  reason: Schema.String,
})

// ECSインベントリサービス定義（Effect-based）
export interface ECSInventoryService {
  readonly createComponent: (
    entityId: EntityId,
    type: InventoryType,
    constraints: InventoryConstraints
  ) => Effect.Effect<InventoryComponent, ComponentCreationFailedError, never>

  readonly getComponent: (entityId: EntityId) => Effect.Effect<InventoryComponent, ComponentNotFoundError, never>

  readonly updateComponent: (
    entityId: EntityId,
    update: (component: InventoryComponent) => InventoryComponent
  ) => Effect.Effect<void, ComponentUpdateFailedError, never>

  readonly removeComponent: (entityId: EntityId) => Effect.Effect<void, ComponentNotFoundError, never>

  readonly getAllComponents: () => Effect.Effect<
    ReadonlyArray<{ entityId: EntityId; component: InventoryComponent }>,
    never,
    never
  >

  readonly subscribeToChanges: (entityId: EntityId) => Stream.Stream<InventoryComponent, ComponentNotFoundError, never>
}

export const ECSInventoryService = Context.GenericTag<ECSInventoryService>('@minecraft/ECSInventoryService')

// ECSインベントリサービス実装
export const makeECSInventoryService = (): Effect.Effect<ECSInventoryService, never, InventoryService> =>
  Effect.gen(function* () {
    const inventoryService = yield* InventoryService

    // コンポーネントストレージ（Ref + Map）
    const components = yield* Ref.make(new Map<EntityId, InventoryComponent>())

    // 変更通知キュー
    const changeQueue = yield* Queue.unbounded<{
      entityId: EntityId
      component: InventoryComponent
    }>()

    return {
      createComponent: (entityId, type, constraints) =>
        Effect.gen(function* () {
          // インベントリ作成
          const inventoryId = yield* inventoryService.create(type, constraints)

          // インベントリ状態の取得とSTM準備
          const inventoryState = yield* inventoryService.get(inventoryId)
          const inventoryRef = yield* STM.commit(TRef.make(inventoryState))

          // イベントストリーム作成
          const eventStream = yield* inventoryService.subscribe(inventoryId)

          // コンポーネント作成
          const component = yield* makeInventoryComponent(inventoryId, inventoryRef, eventStream)

          // コンポーネント登録
          yield* Ref.update(components, (map) => {
            map.set(entityId, component)
            return map
          })

          // 変更通知
          yield* Queue.offer(changeQueue, { entityId, component })

          return component
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ComponentCreationFailedError({
                entityId,
                reason: String(error),
              })
            )
          )
        ),

      getComponent: (entityId) =>
        Effect.gen(function* () {
          const componentMap = yield* Ref.get(components)
          const component = componentMap.get(entityId)

          if (!component) {
            return yield* Effect.fail(new ComponentNotFoundError({ entityId }))
          }

          return component
        }),

      updateComponent: (entityId, update) =>
        Effect.gen(function* () {
          const componentMap = yield* Ref.get(components)
          const existingComponent = componentMap.get(entityId)

          if (!existingComponent) {
            return yield* Effect.fail(
              new ComponentUpdateFailedError({
                entityId,
                reason: 'Component not found',
              })
            )
          }

          // 更新実行（Schema検証）
          const updatedComponent = update(existingComponent)
          const validatedComponent = yield* Schema.decode(InventoryComponent)(updatedComponent)

          // コンポーネント更新
          yield* Ref.update(components, (map) => {
            map.set(entityId, validatedComponent)
            return map
          })

          // 変更通知
          yield* Queue.offer(changeQueue, {
            entityId,
            component: validatedComponent,
          })
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              new ComponentUpdateFailedError({
                entityId,
                reason: String(error),
              })
            )
          )
        ),

      removeComponent: (entityId) =>
        Effect.gen(function* () {
          const componentMap = yield* Ref.get(components)

          if (!componentMap.has(entityId)) {
            return yield* Effect.fail(new ComponentNotFoundError({ entityId }))
          }

          yield* Ref.update(components, (map) => {
            map.delete(entityId)
            return map
          })
        }),

      getAllComponents: () =>
        Effect.gen(function* () {
          const componentMap = yield* Ref.get(components)
          return ReadonlyArray.fromIterable(
            Array.from(componentMap.entries()).map(([entityId, component]) => ({
              entityId,
              component,
            }))
          )
        }),

      subscribeToChanges: (entityId) =>
        Stream.fromQueue(changeQueue).pipe(
          Stream.filter(({ entityId: id }) => id === entityId),
          Stream.map(({ component }) => component),
          Stream.catchAll((error) => Stream.fail(new ComponentNotFoundError({ entityId })))
        ),
    }
  })

// ECSインベントリサービスレイヤー
export const ECSInventoryServiceLayer = Layer.effect(ECSInventoryService, makeECSInventoryService())
```

### 3.2 インベントリシステム

```typescript
// インベントリシステム実装（Effect統合）
export interface InventorySystem {
  readonly name: 'InventorySystem'
  readonly update: (entities: ReadonlyArray<EntityId>, deltaTime: number) => Effect.Effect<void, 'SystemUpdateError'>
}

export const makeInventorySystem = (): Effect.Effect<
  InventorySystem,
  never,
  ECSInventoryService | InventoryService | TransformService
> =>
  Effect.gen(function* () {
    const inventoryService = yield* InventoryService
    const ecsInventoryService = yield* ECSInventoryService
    const transformService = yield* TransformService

    return {
      name: 'InventorySystem',

      update: (entities: ReadonlyArray<EntityId>, deltaTime: number) =>
        Effect.gen(function* () {
          // 全エンティティを並列処理
          yield* Effect.forEach(entities, (entityId) => processEntityInventory(entityId, deltaTime), {
            concurrency: 'unbounded',
          })
        }),
    }

    function processEntityInventory(
      entityId: EntityId,
      deltaTime: number
    ): Effect.Effect<void, 'EntityProcessingError'> {
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
        if (inventory.version % 100 === 0) {
          // 100更新ごとに整理
          yield* STM.commit(InventoryOperations.compactInventorySTM(inventoryRef, yield* getItemDefinitions()))
        }
      }).pipe(
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Effect.logError(`エンティティ ${entityId} のインベントリ処理でエラー`, error)
            return yield* Effect.fail('EntityProcessingError' as const)
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

        return ReadonlyArray.filter(allDroppedItems, (item) => calculateDistance(item.position, position) <= radius)
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
            InventoryOperations.addItemSTM(inventoryRef, droppedItem.itemStack, itemDefinitions)
          ).pipe(
            Effect.catchAll(() => Effect.succeed(Option.none<SlotIndex>())),
            Effect.map((slotIndex) => Option.some(slotIndex))
          )

          if (Option.isSome(pickupResult)) {
            // アイテムが正常にピックアップされた場合、ドロップアイテムを削除
            yield* removeDroppedItem(droppedItem.id)

            // ピックアップイベント発生
            yield* broadcastInventoryEvent({
              _tag: 'ItemAdded' as const,
              inventoryId: (yield* STM.commit(TRef.get(inventoryRef))).id,
              slotIndex: pickupResult.value,
              item: droppedItem.itemStack,
              timestamp: Date.now(),
            })
          }
        }
      })
    }
  })

// インベントリシステムのLayer定義
export const InventorySystemLayer = Layer.effect(
  Context.GenericTag<InventorySystem>('@minecraft/InventorySystem'),
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
      yield* Effect.forEach(yield* getAllInventoryIds(), (inventoryId) => inventoryService.subscribe(inventoryId)),
      { concurrency: 'unbounded' }
    )

    // イベントストリーム処理
    yield* allInventoryEvents.pipe(
      Stream.tap((event) =>
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
export const makeBatchInventorySync = (): Effect.Effect<void, never, InventoryService | NetworkService> =>
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
      Schedule.fixed('5 seconds')
    ).pipe(Effect.fork)
  })
```

## 4. クライアント・サーバー同期

### 4.1 インベントリ同期プロトコル

```typescript
import { Schema, Queue, Duration, Schedule } from 'effect'

// インベントリ同期メッセージスキーマ
export const InventorySyncMessage = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('FullSync'),
    playerId: Schema.String.pipe(Schema.brand('PlayerId')),
    inventoryId: InventoryId,
    state: InventoryState,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('DeltaSync'),
    playerId: Schema.String.pipe(Schema.brand('PlayerId')),
    inventoryId: InventoryId,
    changes: Schema.Array(InventoryEvent),
    fromVersion: Schema.Number,
    toVersion: Schema.Number,
    timestamp: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('SyncRequest'),
    playerId: Schema.String.pipe(Schema.brand('PlayerId')),
    inventoryId: InventoryId,
    clientVersion: Schema.Number,
    timestamp: Schema.Number,
  })
).pipe(
  Schema.annotations({
    identifier: 'InventorySyncMessage',
    description: 'インベントリ同期メッセージ',
  })
)

export type InventorySyncMessage = Schema.Schema.Type<typeof InventorySyncMessage>

// 同期サービス定義
export interface InventorySyncService {
  readonly syncInventory: (
    playerId: string,
    inventoryId: InventoryId,
    forceFullSync?: boolean
  ) => Effect.Effect<void, 'SyncFailed'>

  readonly handleSyncMessage: (message: InventorySyncMessage) => Effect.Effect<void, 'MessageHandlingFailed'>

  readonly requestSync: (playerId: string, inventoryId: InventoryId) => Effect.Effect<void, 'SyncRequestFailed'>
}

export const InventorySyncService = Context.GenericTag<InventorySyncService>('@minecraft/InventorySyncService')

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
      type: 'full' | 'delta'
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
            type: forceFullSync ? 'full' : 'delta',
          })
        }).pipe(Effect.catchAll(() => Effect.fail('SyncFailed' as const))),

      handleSyncMessage: (message) =>
        Match.value(message)
          .pipe(
            Match.when({ _tag: 'FullSync' }, handleFullSync),
            Match.when({ _tag: 'DeltaSync' }, handleDeltaSync),
            Match.when({ _tag: 'SyncRequest' }, handleSyncRequest),
            Match.exhaustive
          )
          .pipe(Effect.catchAll(() => Effect.fail('MessageHandlingFailed' as const))),

      requestSync: (playerId, inventoryId) =>
        Effect.gen(function* () {
          const clientVersion = yield* getClientInventoryVersion(playerId, inventoryId)

          const request: InventorySyncMessage = {
            _tag: 'SyncRequest',
            playerId: playerId as any,
            inventoryId,
            clientVersion,
            timestamp: Date.now(),
          }

          yield* networkService.sendToPlayer(playerId, request)
        }).pipe(Effect.catchAll(() => Effect.fail('SyncRequestFailed' as const))),
    }

    function processSyncQueue(
      queue: Queue.Queue<{
        priority: number
        playerId: string
        inventoryId: InventoryId
        type: 'full' | 'delta'
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

          if (item.type === 'full' || state.version - clientVersion > 10) {
            // フル同期
            const fullSync: InventorySyncMessage = {
              _tag: 'FullSync',
              playerId: item.playerId as any,
              inventoryId: item.inventoryId,
              state,
              timestamp: Date.now(),
            }

            yield* networkService.sendToPlayer(item.playerId, fullSync)
            yield* setClientInventoryVersion(item.playerId, item.inventoryId, state.version)
          } else {
            // デルタ同期
            const changes = yield* getInventoryChangesSince(item.inventoryId, clientVersion)

            if (changes.length > 0) {
              const deltaSync: InventorySyncMessage = {
                _tag: 'DeltaSync',
                playerId: item.playerId as any,
                inventoryId: item.inventoryId,
                changes,
                fromVersion: clientVersion,
                toVersion: state.version,
                timestamp: Date.now(),
              }

              yield* networkService.sendToPlayer(item.playerId, deltaSync)
              yield* setClientInventoryVersion(item.playerId, item.inventoryId, state.version)
            }
          }
        }).pipe(
          Effect.catchAll((error) => Effect.logError(`同期処理エラー: ${item.playerId}/${item.inventoryId}`, error))
        )
      }).pipe(
        Effect.forever,
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            yield* Effect.logError('同期キュー処理エラー', error)
            yield* Effect.sleep(Duration.seconds(1)) // 短時間待機後再試行
          })
        ),
        Effect.forever
      )
    }

    function handleFullSync(message: Extract<InventorySyncMessage, { _tag: 'FullSync' }>): Effect.Effect<void, never> {
      return Effect.gen(function* () {
        // クライアントのインベントリ状態を完全に更新
        yield* persistenceService.saveInventoryState(message.inventoryId, message.state)
        yield* setClientInventoryVersion(message.playerId, message.inventoryId, message.state.version)

        yield* Effect.logInfo(`フル同期完了: ${message.playerId}/${message.inventoryId}`)
      }).pipe(Effect.orElse(() => Effect.unit))
    }

    function handleDeltaSync(
      message: Extract<InventorySyncMessage, { _tag: 'DeltaSync' }>
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
      message: Extract<InventorySyncMessage, { _tag: 'SyncRequest' }>
    ): Effect.Effect<void, never> {
      return Effect.gen(function* () {
        // 同期要求を同期キューに追加
        yield* Queue.offer(syncQueue, {
          priority: 3, // 中優先度
          playerId: message.playerId,
          inventoryId: message.inventoryId,
          type: 'delta',
        })

        yield* Effect.logInfo(`同期要求受信: ${message.playerId}/${message.inventoryId}`)
      }).pipe(Effect.orElse(() => Effect.unit))
    }
  })

// レイヤー定義
export const InventorySyncServiceLayer = Layer.effect(InventorySyncService, makeInventorySyncService())

// 接続維持とハートビート
export const makeInventorySyncHeartbeat = (): Effect.Effect<void, never, InventorySyncService | NetworkService> =>
  Effect.gen(function* () {
    const syncService = yield* InventorySyncService
    const networkService = yield* NetworkService

    // 30秒間隔でハートビート
    yield* Effect.repeat(
      Effect.gen(function* () {
        const connectedPlayers = yield* networkService.getConnectedPlayers()

        yield* Effect.forEach(
          connectedPlayers,
          (playerId) =>
            Effect.gen(function* () {
              const playerInventories = yield* getPlayerInventories(playerId)

              yield* Effect.forEach(
                playerInventories,
                (inventoryId) => syncService.syncInventory(playerId, inventoryId),
                { concurrency: 5 }
              )
            }).pipe(Effect.catchAll(() => Effect.unit)),
          { concurrency: 'unbounded' }
        )
      }),
      Schedule.fixed(Duration.seconds(30))
    ).pipe(Effect.fork)
  })
```

## 5. UI統合

### 5.1 インベントリUI

```typescript
import { SubscriptionRef, Fiber } from 'effect'

// UI状態定義（Schema化）
export const InventoryUIState = Schema.Struct({
  isOpen: Schema.Boolean,
  selectedSlot: Schema.Option(SlotIndex),
  draggedItem: Schema.Option(ItemStack),
  hoveredSlot: Schema.Option(SlotIndex),
  quickbarSelectedSlot: Schema.Option(SlotIndex),
  filterText: Schema.String.pipe(Schema.maxLength(64)),
  sortMode: Schema.Literal('name', 'count', 'type', 'recent').pipe(Schema.annotations({ description: 'ソート方式' })),
}).pipe(
  Schema.annotations({
    identifier: 'InventoryUIState',
    description: 'インベントリUI状態',
  })
)

export type InventoryUIState = Schema.Schema.Type<typeof InventoryUIState>

// UI操作の結果型
export const InventoryUIResult = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('StateUpdated'),
    newState: InventoryUIState,
    inventoryChanges: Schema.Array(InventoryEvent),
  }),
  Schema.Struct({
    _tag: Schema.Literal('NoChange'),
    reason: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('Error'),
    error: Schema.String,
    code: Schema.String,
  })
).pipe(
  Schema.annotations({
    identifier: 'InventoryUIResult',
    description: 'UI操作結果',
  })
)

export type InventoryUIResult = Schema.Schema.Type<typeof InventoryUIResult>

// UIインタラクション定義
export interface InventoryUIService {
  readonly handleSlotClick: (
    inventoryId: InventoryId,
    slotIndex: SlotIndex,
    button: 'left' | 'right' | 'middle',
    modifiers: {
      shift: boolean
      ctrl: boolean
      alt: boolean
    }
  ) => Effect.Effect<InventoryUIResult, 'UIActionFailed'>

  readonly handleDragStart: (
    inventoryId: InventoryId,
    slotIndex: SlotIndex
  ) => Effect.Effect<InventoryUIResult, 'DragStartFailed'>

  readonly handleDragDrop: (
    fromInventoryId: InventoryId,
    toInventoryId: InventoryId,
    fromSlot: SlotIndex,
    toSlot: SlotIndex,
    modifiers: {
      shift: boolean
      ctrl: boolean
    }
  ) => Effect.Effect<InventoryUIResult, 'DragDropFailed'>

  readonly handleKeyPress: (
    key: string,
    modifiers: {
      shift: boolean
      ctrl: boolean
      alt: boolean
    }
  ) => Effect.Effect<InventoryUIResult, 'KeyPressFailed'>

  readonly subscribe: (inventoryId: InventoryId) => Stream.Stream<InventoryUIState>
}

export const InventoryUIService = Context.GenericTag<InventoryUIService>('@minecraft/InventoryUIService')

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
      filterText: '',
      sortMode: 'name',
    })

    return {
      handleSlotClick: (inventoryId, slotIndex, button, modifiers) =>
        Effect.gen(function* () {
          const currentState = yield* SubscriptionRef.get(uiStateRef)
          const inventory = yield* inventoryService.get(inventoryId)

          if (Option.isNone(inventory)) {
            return {
              _tag: 'Error' as const,
              error: 'インベントリが見つかりません',
              code: 'INVENTORY_NOT_FOUND',
            }
          }

          const inventoryState = inventory.value
          const slot = inventoryState.slots[slotIndex]

          // パターンマッチングによる操作分岐（早期リターン）
          return yield* Match.value({ button, modifiers, currentState, slot })
            .pipe(
              // 左クリック操作
              Match.when(
                ({ button, currentState }) => button === 'left' && Option.isSome(currentState.draggedItem),
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
                          draggedItem: Option.some(slot.item.value),
                        }

                        yield* SubscriptionRef.set(uiStateRef, newState)
                        yield* audioService.playSound('ui.inventory.place')

                        return {
                          _tag: 'StateUpdated' as const,
                          newState,
                          inventoryChanges: result.events,
                        }
                      }
                    } else {
                      // 空スロットに配置
                      const result = yield* placeItemInSlot(inventoryId, slotIndex, draggedItem)

                      if (result) {
                        const newState = {
                          ...currentState,
                          draggedItem: Option.none(),
                        }

                        yield* SubscriptionRef.set(uiStateRef, newState)
                        yield* audioService.playSound('ui.inventory.place')

                        return {
                          _tag: 'StateUpdated' as const,
                          newState,
                          inventoryChanges: result.events,
                        }
                      }
                    }

                    return {
                      _tag: 'NoChange' as const,
                      reason: 'アイテムの配置に失敗しました',
                    }
                  })
              ),

              // 左クリック：アイテムピックアップ
              Match.when(
                ({ button, currentState }) => button === 'left' && Option.isNone(currentState.draggedItem),
                ({ slot, currentState }) =>
                  Effect.gen(function* () {
                    if (Option.isNone(slot.item)) {
                      return {
                        _tag: 'NoChange' as const,
                        reason: '空のスロットです',
                      }
                    }

                    const item = slot.item.value
                    const result = yield* removeItemFromSlot(inventoryId, slotIndex)

                    if (result) {
                      const newState = {
                        ...currentState,
                        draggedItem: Option.some(item),
                      }

                      yield* SubscriptionRef.set(uiStateRef, newState)
                      yield* audioService.playSound('ui.inventory.pickup')

                      return {
                        _tag: 'StateUpdated' as const,
                        newState,
                        inventoryChanges: result.events,
                      }
                    }

                    return {
                      _tag: 'Error' as const,
                      error: 'アイテムの取得に失敗しました',
                      code: 'PICKUP_FAILED',
                    }
                  })
              ),

              // 右クリック：スタック分割
              Match.when(
                ({ button }) => button === 'right',
                ({ slot, currentState }) =>
                  Effect.gen(function* () {
                    if (Option.isNone(slot.item)) {
                      return {
                        _tag: 'NoChange' as const,
                        reason: '空のスロットです',
                      }
                    }

                    const item = slot.item.value

                    if (item.count <= 1) {
                      return {
                        _tag: 'NoChange' as const,
                        reason: '分割できません',
                      }
                    }

                    const splitAmount = Math.ceil(item.count / 2)
                    const remaining = item.count - splitAmount

                    const [splitItem, remainingItem] = yield* ItemStackOperations.split(item, splitAmount)

                    const result = yield* updateSlotItem(inventoryId, slotIndex, remainingItem)

                    if (result) {
                      const newState = {
                        ...currentState,
                        draggedItem: Option.some(splitItem),
                      }

                      yield* SubscriptionRef.set(uiStateRef, newState)
                      yield* audioService.playSound('ui.inventory.split')

                      return {
                        _tag: 'StateUpdated' as const,
                        newState,
                        inventoryChanges: result.events,
                      }
                    }

                    return {
                      _tag: 'Error' as const,
                      error: 'スタックの分割に失敗しました',
                      code: 'SPLIT_FAILED',
                    }
                  })
              ),

              // Shift+左クリック：クイック移動
              Match.when(
                ({ button, modifiers }) => button === 'left' && modifiers.shift,
                ({ slot }) =>
                  Effect.gen(function* () {
                    if (Option.isNone(slot.item)) {
                      return {
                        _tag: 'NoChange' as const,
                        reason: '空のスロットです',
                      }
                    }

                    const item = slot.item.value
                    const targetInventoryId = yield* findBestTargetInventory(inventoryId, item)

                    if (Option.isSome(targetInventoryId)) {
                      const result = yield* quickMoveItem(inventoryId, targetInventoryId.value, slotIndex)

                      if (result) {
                        yield* audioService.playSound('ui.inventory.quick_move')

                        return {
                          _tag: 'StateUpdated' as const,
                          newState: currentState, // 状態変更なし
                          inventoryChanges: result.events,
                        }
                      }
                    }

                    return {
                      _tag: 'NoChange' as const,
                      reason: '移動先が見つかりません',
                    }
                  })
              ),

              // デフォルト：何もしない
              Match.orElse(() =>
                Effect.succeed({
                  _tag: 'NoChange' as const,
                  reason: '対応していない操作です',
                })
              ),

              Match.exhaustive
            )
            .pipe(Effect.flatten)
        }).pipe(
          Effect.catchAll((error) =>
            Effect.succeed({
              _tag: 'Error' as const,
              error: String(error),
              code: 'SLOT_CLICK_FAILED',
            })
          )
        ),

      handleDragStart: (inventoryId, slotIndex) =>
        Effect.gen(function* () {
          const currentState = yield* SubscriptionRef.get(uiStateRef)
          const inventory = yield* inventoryService.get(inventoryId)

          if (Option.isNone(inventory)) {
            return {
              _tag: 'Error' as const,
              error: 'インベントリが見つかりません',
              code: 'INVENTORY_NOT_FOUND',
            }
          }

          const slot = inventory.value.slots[slotIndex]

          if (Option.isNone(slot.item) || slot.locked) {
            return {
              _tag: 'NoChange' as const,
              reason: 'ドラッグできません',
            }
          }

          const newState = {
            ...currentState,
            selectedSlot: Option.some(slotIndex),
          }

          yield* SubscriptionRef.set(uiStateRef, newState)

          return {
            _tag: 'StateUpdated' as const,
            newState,
            inventoryChanges: [],
          }
        }).pipe(
          Effect.catchAll(() =>
            Effect.succeed({
              _tag: 'Error' as const,
              error: 'ドラッグ開始に失敗しました',
              code: 'DRAG_START_FAILED',
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
              _tag: 'Error' as const,
              error: 'インベントリが見つかりません',
              code: 'INVENTORY_NOT_FOUND',
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
              draggedItem: Option.none(),
            }

            yield* SubscriptionRef.set(uiStateRef, newState)
            yield* audioService.playSound('ui.inventory.drop')

            return {
              _tag: 'StateUpdated' as const,
              newState,
              inventoryChanges: [
                {
                  _tag: 'ItemMoved' as const,
                  fromInventoryId,
                  toInventoryId,
                  fromSlot,
                  toSlot,
                  item: (yield* STM.commit(TRef.get(toRef))).slots[toSlot].item.value!,
                  timestamp: Date.now(),
                },
              ],
            }
          }

          return {
            _tag: 'Error' as const,
            error: 'アイテム移動に失敗しました',
            code: 'MOVE_FAILED',
          }
        }).pipe(
          Effect.catchAll(() =>
            Effect.succeed({
              _tag: 'Error' as const,
              error: 'ドラッグ&ドロップに失敗しました',
              code: 'DRAG_DROP_FAILED',
            })
          )
        ),

      handleKeyPress: (key, modifiers) =>
        Effect.gen(function* () {
          const currentState = yield* SubscriptionRef.get(uiStateRef)

          return yield* Match.value(key)
            .pipe(
              Match.when('Escape', () =>
                Effect.gen(function* () {
                  if (currentState.isOpen) {
                    const newState = {
                      ...currentState,
                      isOpen: false,
                      draggedItem: Option.none(),
                    }

                    yield* SubscriptionRef.set(uiStateRef, newState)

                    return {
                      _tag: 'StateUpdated' as const,
                      newState,
                      inventoryChanges: [],
                    }
                  }

                  return {
                    _tag: 'NoChange' as const,
                    reason: 'インベントリは既に閉じています',
                  }
                })
              ),

              Match.when('Tab', () =>
                Effect.gen(function* () {
                  const newState = {
                    ...currentState,
                    isOpen: !currentState.isOpen,
                  }

                  yield* SubscriptionRef.set(uiStateRef, newState)

                  return {
                    _tag: 'StateUpdated' as const,
                    newState,
                    inventoryChanges: [],
                  }
                })
              ),

              Match.orElse(() =>
                Effect.succeed({
                  _tag: 'NoChange' as const,
                  reason: '未対応のキーです',
                })
              ),

              Match.exhaustive
            )
            .pipe(Effect.flatten)
        }).pipe(
          Effect.catchAll(() =>
            Effect.succeed({
              _tag: 'Error' as const,
              error: 'キー処理に失敗しました',
              code: 'KEY_PRESS_FAILED',
            })
          )
        ),

      subscribe: (inventoryId) =>
        SubscriptionRef.changes(uiStateRef).pipe(
          Stream.filter((state) => state.isOpen) // 開いている場合のみ
        ),
    }
  })

// UIサービスレイヤー
export const InventoryUIServiceLayer = Layer.effect(InventoryUIService, makeInventoryUIService())
```

## 6. 最適化戦略

### 6.1 メモリ効率

```typescript
// スパースインベントリ実装
export interface SparseInventory {
  readonly id: InventoryId
  readonly items: Map<number, ItemStack> // 空スロットは保存しない
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

  fromArray: (id: InventoryId, items: ReadonlyArray<Option.Option<ItemStack>>): SparseInventory => ({
    id,
    items: new Map(
      items
        .map((item, index) => [index, item] as const)
        .filter(([_, item]) => Option.isSome(item))
        .map(([index, item]) => [index, item.value])
    ),
    maxSize: items.length,
  }),
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
    }),
}
```

## 7. エラーハンドリング

```typescript
import { Data } from 'effect'

// Schema駆動エラー定義
export const InventoryError = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('InventoryNotFound'),
    inventoryId: InventoryId,
    context: Schema.optional(Schema.String),
  }),
  Schema.Struct({
    _tag: Schema.Literal('InventoryFull'),
    inventoryId: InventoryId,
    attemptedItem: ItemStack,
    availableSlots: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('SlotLocked'),
    inventoryId: InventoryId,
    slotIndex: SlotIndex,
    reason: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('InvalidItemStack'),
    itemId: ItemId,
    count: Schema.Number,
    reason: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('TransferConstraintViolation'),
    fromInventoryId: InventoryId,
    toInventoryId: InventoryId,
    constraint: Schema.String,
    details: Schema.Record(Schema.String, Schema.Unknown),
  }),
  Schema.Struct({
    _tag: Schema.Literal('ConcurrentModification'),
    inventoryId: InventoryId,
    expectedVersion: Schema.Number,
    actualVersion: Schema.Number,
  }),
  Schema.Struct({
    _tag: Schema.Literal('NetworkSyncError'),
    inventoryId: InventoryId,
    playerId: Schema.String,
    errorCode: Schema.String,
    retryCount: Schema.Number,
  })
).pipe(
  Schema.annotations({
    identifier: 'InventoryError',
    description: 'インベントリシステムエラー',
  })
)

export type InventoryError = Schema.Schema.Type<typeof InventoryError>

// Data型エラー定義（関数型パターン）
export const InventoryNotFoundError = Schema.TaggedError('InventoryNotFound')({
  inventoryId: InventoryId,
  context: Schema.optional(Schema.String),
})

export const InventoryFullError = Schema.TaggedError('InventoryFull')({
  inventoryId: InventoryId,
  attemptedItem: ItemStack,
  availableSlots: Schema.Number,
})

export const SlotLockedError = Schema.TaggedError('SlotLocked')({
  inventoryId: InventoryId,
  slotIndex: SlotIndex,
  reason: Schema.String,
})

export const InvalidItemStackError = Schema.TaggedError('InvalidItemStack')({
  itemId: ItemId,
  count: Schema.Number,
  reason: Schema.String,
})

export const TransferConstraintViolationError = Schema.TaggedError('TransferConstraintViolation')({
  fromInventoryId: InventoryId,
  toInventoryId: InventoryId,
  constraint: Schema.String,
  details: Schema.Record(Schema.String, Schema.Unknown),
})

export const ConcurrentModificationError = Schema.TaggedError('ConcurrentModification')({
  inventoryId: InventoryId,
  expectedVersion: Schema.Number,
  actualVersion: Schema.Number,
})

export const NetworkSyncError = Schema.TaggedError('NetworkSyncError')({
  inventoryId: InventoryId,
  playerId: Schema.String,
  errorCode: Schema.String,
  retryCount: Schema.Number,
})

// エラーハンドリングサービス
export interface InventoryErrorHandler {
  readonly handleError: <A>(effect: Effect.Effect<A, InventoryError>, fallback?: A) => Effect.Effect<A>

  readonly retryWithBackoff: <A, E extends InventoryError>(
    effect: Effect.Effect<A, E>,
    maxRetries?: number
  ) => Effect.Effect<A, E>

  readonly logAndRecover: <A>(
    effect: Effect.Effect<A, InventoryError>,
    recovery: (error: InventoryError) => Effect.Effect<A>
  ) => Effect.Effect<A>
}

export const InventoryErrorHandler = Context.GenericTag<InventoryErrorHandler>('@minecraft/InventoryErrorHandler')

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
                yield* metricsService.incrementCounter('inventory.errors.not_found')

                if (fallback !== undefined) {
                  return fallback
                }

                return yield* Effect.fail(error)
              }),

            InventoryFull: (error) =>
              Effect.gen(function* () {
                yield* logger.info(`インベントリ満杯: ${error.inventoryId}`, error)
                yield* notificationService.showError('インベントリがいっぱいです！')
                yield* metricsService.incrementCounter('inventory.errors.full')

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
                yield* metricsService.incrementCounter('inventory.errors.invalid_stack')

                if (fallback !== undefined) {
                  return fallback
                }

                return yield* Effect.fail(error)
              }),

            TransferConstraintViolation: (error) =>
              Effect.gen(function* () {
                yield* logger.warn(`転送制約違反: ${error.constraint}`, error)
                yield* notificationService.showWarning('アイテム転送が制限されています')

                if (fallback !== undefined) {
                  return fallback
                }

                return yield* Effect.fail(error)
              }),

            ConcurrentModification: (error) =>
              Effect.gen(function* () {
                yield* logger.warn(`同時変更競合: ${error.inventoryId}`, error)
                yield* metricsService.incrementCounter('inventory.errors.concurrent_modification')

                if (fallback !== undefined) {
                  return fallback
                }

                return yield* Effect.fail(error)
              }),

            NetworkSyncError: (error) =>
              Effect.gen(function* () {
                yield* logger.error(`ネットワーク同期エラー: ${error.errorCode}`, error)
                yield* metricsService.incrementCounter('inventory.errors.network_sync')

                if (error.retryCount < 3) {
                  // 3回まで自動リトライ
                  yield* notificationService.showInfo('接続を再試行中...')
                  return yield* Effect.fail(error)
                }

                yield* notificationService.showError('ネットワーク接続に問題があります')

                if (fallback !== undefined) {
                  return fallback
                }

                return yield* Effect.fail(error)
              }),
          })
        ),

      retryWithBackoff: <A, E extends InventoryError>(effect: Effect.Effect<A, E>, maxRetries = 3) =>
        effect.pipe(
          Effect.retry(
            Schedule.exponential(Duration.millis(100)).pipe(
              Schedule.intersect(Schedule.recurs(maxRetries)),
              Schedule.whileInput(
                (error: E) => error._tag === 'ConcurrentModification' || error._tag === 'NetworkSyncError'
              )
            )
          ),
          Effect.tapError((error) => logger.warn(`リトライ後もエラーが継続: ${error._tag}`, error))
        ),

      logAndRecover: <A>(
        effect: Effect.Effect<A, InventoryError>,
        recovery: (error: InventoryError) => Effect.Effect<A>
      ) =>
        effect.pipe(
          Effect.catchAll((error) =>
            Effect.gen(function* () {
              yield* logger.error(`インベントリエラーからのリカバリ: ${error._tag}`, error)
              yield* metricsService.incrementCounter('inventory.errors.recovered')

              return yield* recovery(error)
            })
          )
        ),
    }
  })

// エラーハンドラーレイヤー
export const InventoryErrorHandlerLayer = Layer.effect(InventoryErrorHandler, makeInventoryErrorHandler())

// よく使用されるエラーハンドリングパターン
export const InventoryErrorPatterns = {
  // ユーザーフレンドリーなエラーメッセージ
  userFriendlyMessage: (error: InventoryError): string =>
    Match.value(error).pipe(
      Match.when({ _tag: 'InventoryNotFound' }, () => 'インベントリが見つかりません'),
      Match.when({ _tag: 'InventoryFull' }, () => 'インベントリがいっぱいです'),
      Match.when({ _tag: 'SlotLocked' }, (e) => `スロットがロック中: ${e.reason}`),
      Match.when({ _tag: 'InvalidItemStack' }, (e) => `無効なアイテム: ${e.reason}`),
      Match.when({ _tag: 'TransferConstraintViolation' }, () => '転送が制限されています'),
      Match.when({ _tag: 'ConcurrentModification' }, () => '他の操作と競合しました'),
      Match.when({ _tag: 'NetworkSyncError' }, () => 'ネットワークエラーが発生しました'),
      Match.exhaustive
    ),

  // 自動回復可能かチェック
  isRecoverable: (error: InventoryError): boolean =>
    Match.value(error).pipe(
      Match.when({ _tag: 'InventoryNotFound' }, () => false),
      Match.when({ _tag: 'InventoryFull' }, () => true), // 空きができれば回復可能
      Match.when({ _tag: 'SlotLocked' }, () => true), // ロック解除で回復可能
      Match.when({ _tag: 'InvalidItemStack' }, () => false),
      Match.when({ _tag: 'TransferConstraintViolation' }, () => false),
      Match.when({ _tag: 'ConcurrentModification' }, () => true), // リトライで回復可能
      Match.when({ _tag: 'NetworkSyncError' }, () => true), // 再接続で回復可能
      Match.exhaustive
    ),

  // エラーの重要度
  severity: (error: InventoryError): 'low' | 'medium' | 'high' | 'critical' =>
    Match.value(error).pipe(
      Match.when({ _tag: 'InventoryNotFound' }, () => 'medium' as const),
      Match.when({ _tag: 'InventoryFull' }, () => 'low' as const),
      Match.when({ _tag: 'SlotLocked' }, () => 'low' as const),
      Match.when({ _tag: 'InvalidItemStack' }, () => 'high' as const),
      Match.when({ _tag: 'TransferConstraintViolation' }, () => 'medium' as const),
      Match.when({ _tag: 'ConcurrentModification' }, () => 'medium' as const),
      Match.when({ _tag: 'NetworkSyncError' }, () => 'high' as const),
      Match.exhaustive
    ),
}

// 回路ブレーカーパターン
export const makeInventoryCircuitBreaker = (
  name: string,
  failureThreshold = 5,
  resetTimeout = Duration.seconds(30)
): Effect.Effect<
  <A>(effect: Effect.Effect<A, InventoryError>) => Effect.Effect<A, InventoryError | 'CircuitBreakerOpen'>,
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
      isOpen: false,
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
            return yield* Effect.fail('CircuitBreakerOpen' as const)
          }
        }

        return yield* effect.pipe(
          Effect.tapSuccess(() =>
            Effect.gen(function* () {
              // 成功時は失敗カウンターをリセット
              yield* Ref.update(state, (s) => ({ ...s, failures: 0 }))
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
                isOpen: shouldOpen,
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

- [プレイヤーシステム](./player-system.md) - プレイヤーインベントリの統合
- [クラフトシステム](./crafting-system.md) - クラフト材料とインベントリ連携
- [エンティティシステム](./entity-system.md) - アイテムドロップとエンティティ
- [マテリアルシステム](./material-system.md) - アイテム材料とツール管理
- [ECS統合](../explanations/architecture/05-ecs-integration.md) - ECSコンポーネント設計
- [Effect-TSパターン](../explanations/architecture/06-effect-ts-patterns.md) - Schema・サービス定義

## 用語集

- **コンポーネント (Component)**: ECSにおけるデータの単位 ([詳細](../../reference/glossary.md#component))
- **Effect (エフェクト)**: Effect-TSの副作用管理型 ([詳細](../../reference/glossary.md#effect))
- **エンティティコンポーネントシステム (Entity Component System)**: ゲーム開発アーキテクチャ ([詳細](../../reference/glossary.md#ecs))
- **不変性 (Immutability)**: オブジェクトの状態が変更されない性質 ([詳細](../../reference/glossary.md#immutability))
- **スキーマ (Schema)**: 型安全なデータ定義システム ([詳細](../../reference/glossary.md#schema))
- **値オブジェクト (Value Object)**: DDDの戦術パターン ([詳細](../../reference/glossary.md#value-object))

## まとめ

インベントリシステムは：

- **型安全**: Effect-TS の Schema による完全な型定義
- **不変性**: すべての操作が新しいインベントリを返す
- **ECS統合**: コンポーネントとシステムによる効率的な処理
- **エラー処理**: タグ付きエラーによる型安全なエラーハンドリング
- **最適化**: スパース実装とバッチ処理による効率化
