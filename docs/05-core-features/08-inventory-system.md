# Inventory System - インベントリシステム

## 概要

Inventory Systemは、Minecraftのアイテム管理の中核となるシステムです。アイテム管理、ホットバー機能、アイテムスタッキング、アイテム転送、クラフトグリッド統合、コンテナ相互作用などを担当し、直感的で効率的なアイテム管理体験を提供します。

## アーキテクチャ

### Domain Model（Effect-TS + DDD）

```typescript
import { Effect, Layer, Context, Schema, pipe } from "effect"
import { Brand } from "effect"

// Value Objects
export const ItemId = Schema.String.pipe(Schema.brand("ItemId"))
export const ItemCount = pipe(Schema.Number, Schema.int(), Schema.between(1, 64))
export const SlotIndex = pipe(Schema.Number, Schema.int(), Schema.between(0, 63))

export const ItemStack = Schema.Struct({
  itemId: ItemId,
  count: ItemCount,
  metadata: Schema.Optional(Schema.Record(Schema.String, Schema.Unknown)),
  durability: Schema.Optional(pipe(Schema.Number, Schema.int(), Schema.between(0, 1000))),
  enchantments: Schema.Optional(Schema.Array(Schema.Struct({
    enchantmentId: Schema.String,
    level: pipe(Schema.Number, Schema.int(), Schema.between(1, 10))
  }))),
  nbt: Schema.Optional(Schema.Record(Schema.String, Schema.Unknown)),
  timestamp: Schema.DateTimeUtc
})

export type ItemStack = Schema.Schema.Type<typeof ItemStack>

export const InventorySlot = Schema.Struct({
  index: SlotIndex,
  itemStack: Schema.Optional(ItemStack),
  isLocked: Schema.Boolean,
  restrictions: Schema.Optional(Schema.Array(Schema.String)), // アイテム種別制限
  lastModified: Schema.DateTimeUtc
})

export type InventorySlot = Schema.Schema.Type<typeof InventorySlot>

// Entities
export const PlayerInventory = Schema.Struct({
  playerId: Schema.String.pipe(Schema.brand("PlayerId")),
  slots: Schema.Array(InventorySlot), // 36スロット
  hotbarSlots: Schema.Array(InventorySlot), // 9スロット
  armorSlots: Schema.Array(InventorySlot), // 4スロット（頭、胸、脚、足）
  offhandSlot: InventorySlot, // オフハンドスロット
  selectedHotbarIndex: pipe(Schema.Number, Schema.int(), Schema.between(0, 8)),
  totalWeight: Schema.Number,
  maxWeight: Schema.Number,
  lastAccessed: Schema.DateTimeUtc
})

export type PlayerInventory = Schema.Schema.Type<typeof PlayerInventory>

export const ContainerInventory = Schema.Struct({
  containerId: Schema.String.pipe(Schema.brand("ContainerId")),
  containerType: Schema.Literal("chest", "furnace", "crafting_table", "brewing_stand", "anvil", "enchanting_table"),
  slots: Schema.Array(InventorySlot),
  position: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number
  }),
  isOpen: Schema.Boolean,
  accessingPlayers: Schema.Array(Schema.String.pipe(Schema.brand("PlayerId"))),
  permissions: Schema.Struct({
    canInsert: Schema.Boolean,
    canExtract: Schema.Boolean,
    canView: Schema.Boolean
  }),
  lastModified: Schema.DateTimeUtc
})

export type ContainerInventory = Schema.Schema.Type<typeof ContainerInventory>

export const ItemTransfer = Schema.Struct({
  id: Schema.String.pipe(Schema.brand("TransferId")),
  sourceType: Schema.Literal("player", "container", "ground"),
  sourceId: Schema.String,
  sourceSlot: Schema.Optional(SlotIndex),
  targetType: Schema.Literal("player", "container", "ground"),
  targetId: Schema.String,
  targetSlot: Schema.Optional(SlotIndex),
  itemStack: ItemStack,
  transferType: Schema.Literal("move", "swap", "split", "merge"),
  timestamp: Schema.DateTimeUtc
})

export type ItemTransfer = Schema.Schema.Type<typeof ItemTransfer>

// Constants
export const PLAYER_INVENTORY_SIZE = 36
export const HOTBAR_SIZE = 9
export const ARMOR_SLOTS = 4
export const CHEST_SIZE = 27
export const DOUBLE_CHEST_SIZE = 54
export const FURNACE_SIZE = 3
export const MAX_STACK_SIZE = 64
```

## アイテム管理システム

### Item Management Service

```typescript
// IMPORTANT: Context7でEffect-TSの最新パターンを確認して実装

// ItemManagerサービスインターフェース
interface ItemManagerInterface {
  readonly createItemStack: (itemId: ItemId, count: number, metadata?: Record<string, unknown>) => Effect.Effect<ItemStack, ItemCreationError>
  readonly stackItems: (stack1: ItemStack, stack2: ItemStack) => Effect.Effect<readonly [ItemStack, ItemStack | null], ItemStackError>
  readonly splitItemStack: (stack: ItemStack, count: number) => Effect.Effect<readonly [ItemStack, ItemStack], ItemStackError>
  readonly getItemInfo: (itemId: ItemId) => Effect.Effect<ItemInfo, ItemNotFoundError>
  readonly validateItemStack: (stack: ItemStack) => Effect.Effect<boolean, never>
  readonly calculateItemWeight: (stack: ItemStack) => Effect.Effect<number, never>
}

// Context Tag
export const ItemManager = Context.GenericTag<ItemManagerInterface>("@app/ItemManager")

// Live実装の作成関数
const makeItemManager = Effect.gen(function* () {
  const itemRegistry = yield* ItemRegistry

  const createItemStack = (itemId: ItemId, count: number, metadata?: Record<string, unknown>) =>
    Effect.gen(function* () {
      const itemInfo = yield* itemRegistry.getItemInfo(itemId)

      if (count <= 0 || count > itemInfo.maxStackSize) {
        return yield* Effect.fail(new ItemCreationError(`Invalid count: ${count}`))
      }

      return {
        itemId,
        count,
        metadata: metadata || {},
        durability: itemInfo.hasDurability ? itemInfo.maxDurability : undefined,
        enchantments: [],
        nbt: {},
        timestamp: new Date()
      } as ItemStack
    })

  const stackItems = (stack1: ItemStack, stack2: ItemStack) =>
    Effect.gen(function* () {
      // 同じアイテムかチェック
      if (!canStackTogether(stack1, stack2)) {
        return [stack1, stack2] as const
      }

      const itemInfo = yield* itemRegistry.getItemInfo(stack1.itemId)
      const totalCount = stack1.count + stack2.count

      if (totalCount <= itemInfo.maxStackSize) {
        // 完全にスタック可能
        const combinedStack = {
          ...stack1,
          count: totalCount,
          timestamp: new Date()
        }
        return [combinedStack, null] as const
      } else {
        // 部分的にスタック
        const remainingStack1 = {
          ...stack1,
          count: itemInfo.maxStackSize,
          timestamp: new Date()
        }
        const remainingStack2 = {
          ...stack2,
          count: totalCount - itemInfo.maxStackSize,
          timestamp: new Date()
        }
        return [remainingStack1, remainingStack2] as const
      }
    })

  const splitItemStack = (stack: ItemStack, count: number) =>
    Effect.gen(function* () {
      if (count <= 0 || count >= stack.count) {
        return yield* Effect.fail(new ItemStackError(`Invalid split count: ${count}`))
      }

      const splitStack = {
        ...stack,
        count,
        timestamp: new Date()
      }

      const remainingStack = {
        ...stack,
        count: stack.count - count,
        timestamp: new Date()
      }

      return [remainingStack, splitStack] as const
    })

  const getItemInfo = (itemId: ItemId) =>
    Effect.gen(function* () {
      return yield* itemRegistry.getItemInfo(itemId)
    })

  const validateItemStack = (stack: ItemStack) =>
    Effect.gen(function* () {
      const itemInfo = yield* itemRegistry.getItemInfo(stack.itemId).pipe(
        Effect.catchAll(() => Effect.succeed(null))
      )

      if (!itemInfo) return false
      if (stack.count <= 0 || stack.count > itemInfo.maxStackSize) return false

      // 耐久度チェック
      if (itemInfo.hasDurability) {
        if (!stack.durability || stack.durability < 0 || stack.durability > itemInfo.maxDurability) {
          return false
        }
      }

      // エンチャントチェック
      if (stack.enchantments) {
        for (const enchant of stack.enchantments) {
          if (enchant.level < 1 || enchant.level > 10) return false
        }
      }

      return true
    })

  const calculateItemWeight = (stack: ItemStack) =>
    Effect.gen(function* () {
      const itemInfo = yield* itemRegistry.getItemInfo(stack.itemId)
      const baseWeight = itemInfo.weight || 1.0
      const enchantmentWeight = (stack.enchantments?.length || 0) * 0.1

      return (baseWeight * stack.count) + enchantmentWeight
    })

  return ItemManager.of({
    createItemStack,
    stackItems,
    splitItemStack,
    getItemInfo,
    validateItemStack,
    calculateItemWeight
  })
})

// Live Layer
export const ItemManagerLive = Layer.effect(
  ItemManager,
  makeItemManager
).pipe(
  Layer.provide(ItemRegistryLive)
)

// ヘルパー関数
const canStackTogether = (stack1: ItemStack, stack2: ItemStack): boolean => {
  if (stack1.itemId !== stack2.itemId) return false
  if (stack1.durability !== stack2.durability) return false

  // エンチャントの比較
  if (stack1.enchantments?.length !== stack2.enchantments?.length) return false
  if (stack1.enchantments) {
    for (let i = 0; i < stack1.enchantments.length; i++) {
      const e1 = stack1.enchantments[i]
      const e2 = stack2.enchantments?.[i]
      if (!e2 || e1.enchantmentId !== e2.enchantmentId || e1.level !== e2.level) {
        return false
      }
    }
  }

  // NBTデータの比較（簡略化）
  return JSON.stringify(stack1.nbt) === JSON.stringify(stack2.nbt)
}

// 型定義
interface ItemInfo {
  readonly itemId: ItemId
  readonly displayName: string
  readonly description: string
  readonly maxStackSize: number
  readonly weight: number
  readonly hasDurability: boolean
  readonly maxDurability?: number
  readonly category: string
  readonly rarity: "common" | "uncommon" | "rare" | "epic" | "legendary"
  readonly isConsumable: boolean
  readonly isTool: boolean
  readonly isArmor: boolean
  readonly isBlock: boolean
}

class ItemCreationError {
  readonly _tag = "ItemCreationError"
  constructor(public readonly message: string) {}
}

class ItemStackError {
  readonly _tag = "ItemStackError"
  constructor(public readonly message: string) {}
}

class ItemNotFoundError {
  readonly _tag = "ItemNotFoundError"
  constructor(public readonly itemId: ItemId) {}
}
```

## プレイヤーインベントリシステム

### Player Inventory Manager

```typescript
// PlayerInventoryManagerサービスインターフェース
interface PlayerInventoryManagerInterface {
  readonly getPlayerInventory: (playerId: PlayerId) => Effect.Effect<PlayerInventory, InventoryNotFoundError>
  readonly addItem: (playerId: PlayerId, itemStack: ItemStack) => Effect.Effect<ItemAddResult, InventoryError>
  readonly removeItem: (playerId: PlayerId, itemId: ItemId, count: number) => Effect.Effect<ItemRemoveResult, InventoryError>
  readonly moveItem: (playerId: PlayerId, fromSlot: SlotIndex, toSlot: SlotIndex) => Effect.Effect<void, InventoryError>
  readonly setHotbarSelection: (playerId: PlayerId, index: number) => Effect.Effect<void, InventoryError>
  readonly getSelectedItem: (playerId: PlayerId) => Effect.Effect<ItemStack | null, never>
  readonly hasSpace: (playerId: PlayerId, itemStack: ItemStack) => Effect.Effect<boolean, never>
  readonly countItems: (playerId: PlayerId, itemId: ItemId) => Effect.Effect<number, never>
}

// Context Tag
export const PlayerInventoryManager = Context.GenericTag<PlayerInventoryManagerInterface>("@app/PlayerInventoryManager")

// Live実装の作成関数
const makePlayerInventoryManager = Effect.gen(function* () {
  const itemManager = yield* ItemManager
  const inventoryStorage = yield* InventoryStorageService

  const inventoryCache = yield* Effect.sync(() => new Map<PlayerId, PlayerInventory>())

  const getPlayerInventory = (playerId: PlayerId) =>
    Effect.gen(function* () {
      // キャッシュチェック
      const cached = inventoryCache.get(playerId)
      if (cached) {
        return { ...cached, lastAccessed: new Date() }
      }

      // ストレージから読み込み
      const inventory = yield* inventoryStorage.loadPlayerInventory(playerId).pipe(
        Effect.catchTag("InventoryNotFoundError", () =>
          // 新規プレイヤーの場合、デフォルトインベントリを作成
          createDefaultPlayerInventory(playerId)
        )
      )

      inventoryCache.set(playerId, inventory)
      return inventory
    })

  const addItem = (playerId: PlayerId, itemStack: ItemStack) =>
    Effect.gen(function* () {
      const inventory = yield* getPlayerInventory(playerId)
      let remainingStack = itemStack
      const addedStacks: ItemStack[] = []

      // まず、既存のスタックに追加を試行
      for (let i = 0; i < inventory.slots.length && remainingStack; i++) {
        const slot = inventory.slots[i]
        if (slot.itemStack && canStackTogether(slot.itemStack, remainingStack)) {
          const [combinedStack, remaining] = yield* itemManager.stackItems(slot.itemStack, remainingStack)

          slot.itemStack = combinedStack
          slot.lastModified = new Date()

          if (remaining) {
            remainingStack = remaining
          } else {
            addedStacks.push(combinedStack)
            remainingStack = null
            break
          }
        }
      }

      // 新しいスロットに配置
      if (remainingStack) {
        for (let i = 0; i < inventory.slots.length; i++) {
          const slot = inventory.slots[i]
          if (!slot.itemStack) {
            slot.itemStack = remainingStack
            slot.lastModified = new Date()
            addedStacks.push(remainingStack)
            remainingStack = null
            break
          }
        }
      }

      // インベントリの更新
      const updatedInventory = yield* updateInventoryWeight(inventory)
      inventoryCache.set(playerId, updatedInventory)
      yield* inventoryStorage.savePlayerInventory(updatedInventory)

      return {
        success: !remainingStack,
        addedStacks,
        remainingStack,
        totalAdded: itemStack.count - (remainingStack?.count || 0)
      } as ItemAddResult
    })

  const removeItem = (playerId: PlayerId, itemId: ItemId, count: number) =>
    Effect.gen(function* () {
      const inventory = yield* getPlayerInventory(playerId)
      let remainingToRemove = count
      const removedStacks: ItemStack[] = []

      // 指定されたアイテムを検索して削除
      for (let i = inventory.slots.length - 1; i >= 0 && remainingToRemove > 0; i--) {
        const slot = inventory.slots[i]
        if (slot.itemStack && slot.itemStack.itemId === itemId) {
          if (slot.itemStack.count <= remainingToRemove) {
            // スロット全体を削除
            removedStacks.push(slot.itemStack)
            remainingToRemove -= slot.itemStack.count
            slot.itemStack = undefined
            slot.lastModified = new Date()
          } else {
            // 部分的に削除
            const removedStack = {
              ...slot.itemStack,
              count: remainingToRemove
            }
            removedStacks.push(removedStack)

            slot.itemStack = {
              ...slot.itemStack,
              count: slot.itemStack.count - remainingToRemove,
              timestamp: new Date()
            }
            slot.lastModified = new Date()
            remainingToRemove = 0
          }
        }
      }

      // インベントリの更新
      const updatedInventory = yield* updateInventoryWeight(inventory)
      inventoryCache.set(playerId, updatedInventory)
      yield* inventoryStorage.savePlayerInventory(updatedInventory)

      return {
        success: remainingToRemove === 0,
        removedStacks,
        totalRemoved: count - remainingToRemove,
        remainingToRemove
      } as ItemRemoveResult
    })

  const moveItem = (playerId: PlayerId, fromSlot: SlotIndex, toSlot: SlotIndex) =>
    Effect.gen(function* () {
      const inventory = yield* getPlayerInventory(playerId)

      if (fromSlot < 0 || fromSlot >= inventory.slots.length ||
          toSlot < 0 || toSlot >= inventory.slots.length) {
        return yield* Effect.fail(new InventoryError("Invalid slot index"))
      }

      const fromSlotObj = inventory.slots[fromSlot]
      const toSlotObj = inventory.slots[toSlot]

      // スロット制限チェック
      if (fromSlotObj.isLocked || toSlotObj.isLocked) {
        return yield* Effect.fail(new InventoryError("Slot is locked"))
      }

      // アイテム制限チェック
      if (fromSlotObj.itemStack && toSlotObj.restrictions) {
        const itemInfo = yield* itemManager.getItemInfo(fromSlotObj.itemStack.itemId)
        if (!toSlotObj.restrictions.includes(itemInfo.category)) {
          return yield* Effect.fail(new InventoryError("Item not allowed in target slot"))
        }
      }

      // Match.valueでアイテム移動パターンを分岐
      const shouldStack = fromSlotObj.itemStack && toSlotObj.itemStack &&
        canStackTogether(fromSlotObj.itemStack, toSlotObj.itemStack)

      yield* Match.value({
        hasTargetItem: !!toSlotObj.itemStack,
        canStack: shouldStack
      }).pipe(
        Match.when({ hasTargetItem: false, canStack: false }, () => Effect.sync(() => {
          // 空のスロットに移動
          toSlotObj.itemStack = fromSlotObj.itemStack
          fromSlotObj.itemStack = undefined
        })),
        Match.when({ hasTargetItem: true, canStack: true }, () => Effect.gen(function* () {
          // スタック可能な場合
          const [combinedStack, remaining] = yield* itemManager.stackItems(
            toSlotObj.itemStack!,
            fromSlotObj.itemStack!
          )
          toSlotObj.itemStack = combinedStack
          fromSlotObj.itemStack = remaining || undefined
        })),
        Match.orElse(() => Effect.sync(() => {
          // スワップ
          const temp = fromSlotObj.itemStack
          fromSlotObj.itemStack = toSlotObj.itemStack
          toSlotObj.itemStack = temp
        }))
      )

      fromSlotObj.lastModified = new Date()
      toSlotObj.lastModified = new Date()

      const updatedInventory = yield* updateInventoryWeight(inventory)
      inventoryCache.set(playerId, updatedInventory)
      yield* inventoryStorage.savePlayerInventory(updatedInventory)
    })

  const setHotbarSelection = (playerId: PlayerId, index: number) =>
    Effect.gen(function* () {
      if (index < 0 || index >= HOTBAR_SIZE) {
        return yield* Effect.fail(new InventoryError(`Invalid hotbar index: ${index}`))
      }

      const inventory = yield* getPlayerInventory(playerId)
      inventory.selectedHotbarIndex = index

      inventoryCache.set(playerId, inventory)
      yield* inventoryStorage.savePlayerInventory(inventory)
    })

  const getSelectedItem = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const inventory = yield* getPlayerInventory(playerId)
      const selectedSlot = inventory.hotbarSlots[inventory.selectedHotbarIndex]
      return selectedSlot.itemStack || null
    })

  const hasSpace = (playerId: PlayerId, itemStack: ItemStack) =>
    Effect.gen(function* () {
      const inventory = yield* getPlayerInventory(playerId)
      let remainingCount = itemStack.count

      // 既存のスタックに追加可能かチェック
      for (const slot of inventory.slots) {
        if (slot.itemStack && canStackTogether(slot.itemStack, itemStack)) {
          const itemInfo = yield* itemManager.getItemInfo(itemStack.itemId)
          const availableSpace = itemInfo.maxStackSize - slot.itemStack.count
          remainingCount -= Math.min(remainingCount, availableSpace)

          if (remainingCount <= 0) return true
        }
      }

      // 空のスロットをチェック
      const emptySlots = inventory.slots.filter(slot => !slot.itemStack).length
      const itemInfo = yield* itemManager.getItemInfo(itemStack.itemId)
      const stacksNeeded = Math.ceil(remainingCount / itemInfo.maxStackSize)

      return emptySlots >= stacksNeeded
    })

  const countItems = (playerId: PlayerId, itemId: ItemId) =>
    Effect.gen(function* () {
      const inventory = yield* getPlayerInventory(playerId)
      let totalCount = 0

      for (const slot of inventory.slots) {
        if (slot.itemStack && slot.itemStack.itemId === itemId) {
          totalCount += slot.itemStack.count
        }
      }

      for (const slot of inventory.hotbarSlots) {
        if (slot.itemStack && slot.itemStack.itemId === itemId) {
          totalCount += slot.itemStack.count
        }
      }

      return totalCount
    })

  const updateInventoryWeight = (inventory: PlayerInventory) =>
    Effect.gen(function* () {
      let totalWeight = 0

      const allSlots = [
        ...inventory.slots,
        ...inventory.hotbarSlots,
        ...inventory.armorSlots,
        inventory.offhandSlot
      ]

      for (const slot of allSlots) {
        if (slot.itemStack) {
          const weight = yield* itemManager.calculateItemWeight(slot.itemStack)
          totalWeight += weight
        }
      }

      return {
        ...inventory,
        totalWeight,
        lastAccessed: new Date()
      }
    })

  const createDefaultPlayerInventory = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const createEmptySlot = (index: number): InventorySlot => ({
        index,
        isLocked: false,
        lastModified: new Date()
      })

      return {
        playerId,
        slots: Array.from({ length: PLAYER_INVENTORY_SIZE }, (_, i) => createEmptySlot(i)),
        hotbarSlots: Array.from({ length: HOTBAR_SIZE }, (_, i) => createEmptySlot(i)),
        armorSlots: Array.from({ length: ARMOR_SLOTS }, (_, i) => createEmptySlot(i)),
        offhandSlot: createEmptySlot(0),
        selectedHotbarIndex: 0,
        totalWeight: 0,
        maxWeight: 100, // デフォルト最大重量
        lastAccessed: new Date()
      } as PlayerInventory
    })

  return PlayerInventoryManager.of({
    getPlayerInventory,
    addItem,
    removeItem,
    moveItem,
    setHotbarSelection,
    getSelectedItem,
    hasSpace,
    countItems
  })
})

// Live Layer
export const PlayerInventoryManagerLive = Layer.effect(
  PlayerInventoryManager,
  makePlayerInventoryManager
).pipe(
  Layer.provide(ItemManagerLive),
  Layer.provide(InventoryStorageServiceLive)
)

// 型定義
interface ItemAddResult {
  readonly success: boolean
  readonly addedStacks: ReadonlyArray<ItemStack>
  readonly remainingStack: ItemStack | null
  readonly totalAdded: number
}

interface ItemRemoveResult {
  readonly success: boolean
  readonly removedStacks: ReadonlyArray<ItemStack>
  readonly totalRemoved: number
  readonly remainingToRemove: number
}

type PlayerId = string & Brand.Brand<"PlayerId">

class InventoryNotFoundError {
  readonly _tag = "InventoryNotFoundError"
  constructor(public readonly playerId: PlayerId) {}
}

class InventoryError {
  readonly _tag = "InventoryError"
  constructor(public readonly message: string) {}
}
```

## ホットバー機能

### Hotbar Management System

```typescript
// HotbarManagerサービスインターフェース
interface HotbarManagerInterface {
  readonly selectSlot: (playerId: PlayerId, slotIndex: number) => Effect.Effect<void, HotbarError>
  readonly scrollSelection: (playerId: PlayerId, direction: "up" | "down") => Effect.Effect<void, never>
  readonly swapWithInventory: (playerId: PlayerId, hotbarSlot: number, inventorySlot: number) => Effect.Effect<void, InventoryError>
  readonly useSelectedItem: (playerId: PlayerId) => Effect.Effect<ItemUseResult, ItemUseError>
  readonly dropSelectedItem: (playerId: PlayerId, count?: number) => Effect.Effect<ItemStack | null, InventoryError>
  readonly getHotbarItems: (playerId: PlayerId) => Effect.Effect<ReadonlyArray<ItemStack | null>, never>
}

// Context Tag
export const HotbarManager = Context.GenericTag<HotbarManagerInterface>("HotbarManager")

// Live実装の作成関数
const makeHotbarManager = Effect.gen(function* () {
  const playerInventory = yield* PlayerInventoryManager
  const itemManager = yield* ItemManager
  const eventBus = yield* EventBus

  const selectSlot = (playerId: PlayerId, slotIndex: number) =>
    Effect.gen(function* () {
      if (slotIndex < 0 || slotIndex >= HOTBAR_SIZE) {
        return yield* Effect.fail(new HotbarError(`Invalid hotbar slot: ${slotIndex}`))
      }

      yield* playerInventory.setHotbarSelection(playerId, slotIndex)

      // ホットバー選択イベントの発行
      yield* eventBus.publish(new HotbarSelectionEvent({
        playerId,
        previousSlot: yield* getPreviousSelection(playerId),
        newSlot: slotIndex,
        timestamp: new Date()
      }))
    })

  const scrollSelection = (playerId: PlayerId, direction: "up" | "down") =>
    Effect.gen(function* () {
      const inventory = yield* playerInventory.getPlayerInventory(playerId)
      const currentIndex = inventory.selectedHotbarIndex

      let newIndex: number
      if (direction === "up") {
        newIndex = currentIndex === 0 ? HOTBAR_SIZE - 1 : currentIndex - 1
      } else {
        newIndex = currentIndex === HOTBAR_SIZE - 1 ? 0 : currentIndex + 1
      }

      yield* selectSlot(playerId, newIndex)
    })

  const swapWithInventory = (playerId: PlayerId, hotbarSlot: number, inventorySlot: number) =>
    Effect.gen(function* () {
      if (hotbarSlot < 0 || hotbarSlot >= HOTBAR_SIZE) {
        return yield* Effect.fail(new InventoryError("Invalid hotbar slot"))
      }

      const inventory = yield* playerInventory.getPlayerInventory(playerId)
      const hotbarSlotObj = inventory.hotbarSlots[hotbarSlot]
      const inventorySlotObj = inventory.slots[inventorySlot]

      // アイテムをスワップ
      const temp = hotbarSlotObj.itemStack
      hotbarSlotObj.itemStack = inventorySlotObj.itemStack
      inventorySlotObj.itemStack = temp

      hotbarSlotObj.lastModified = new Date()
      inventorySlotObj.lastModified = new Date()

      // イベント発行
      yield* eventBus.publish(new InventorySwapEvent({
        playerId,
        fromType: "hotbar",
        fromSlot: hotbarSlot,
        toType: "inventory",
        toSlot: inventorySlot,
        timestamp: new Date()
      }))
    })

  const useSelectedItem = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const selectedItem = yield* playerInventory.getSelectedItem(playerId)

      if (!selectedItem) {
        return { success: false, message: "No item selected" } as ItemUseResult
      }

      const itemInfo = yield* itemManager.getItemInfo(selectedItem.itemId)

      // アイテム使用処理
      const useResult = yield* processItemUse(playerId, selectedItem, itemInfo)

      // 消耗品の場合、アイテムを減らす
      if (useResult.consumeItem && itemInfo.isConsumable) {
        yield* playerInventory.removeItem(playerId, selectedItem.itemId, 1)
      }

      // 耐久度減少処理
      if (useResult.damageItem && itemInfo.hasDurability && selectedItem.durability) {
        const newDurability = selectedItem.durability - 1
        if (newDurability <= 0) {
          // アイテム破壊
          yield* playerInventory.removeItem(playerId, selectedItem.itemId, 1)
          yield* eventBus.publish(new ItemBrokenEvent({
            playerId,
            itemStack: selectedItem,
            timestamp: new Date()
          }))
        } else {
          // 耐久度更新
          selectedItem.durability = newDurability
        }
      }

      yield* eventBus.publish(new ItemUseEvent({
        playerId,
        itemStack: selectedItem,
        useResult,
        timestamp: new Date()
      }))

      return useResult
    })

  const dropSelectedItem = (playerId: PlayerId, count?: number) =>
    Effect.gen(function* () {
      const selectedItem = yield* playerInventory.getSelectedItem(playerId)

      if (!selectedItem) return null

      const dropCount = count || selectedItem.count
      const removeResult = yield* playerInventory.removeItem(playerId, selectedItem.itemId, dropCount)

      if (removeResult.success && removeResult.removedStacks.length > 0) {
        const droppedStack = removeResult.removedStacks[0]

        yield* eventBus.publish(new ItemDropEvent({
          playerId,
          itemStack: droppedStack,
          timestamp: new Date()
        }))

        return droppedStack
      }

      return null
    })

  const getHotbarItems = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const inventory = yield* playerInventory.getPlayerInventory(playerId)
      return inventory.hotbarSlots.map(slot => slot.itemStack || null)
    })

  const processItemUse = (playerId: PlayerId, itemStack: ItemStack, itemInfo: ItemInfo) =>
    Effect.gen(function* () {
      // Match.valueパターンでアイテムタイプ処理を分岐
      return yield* Match.value(itemInfo.category).pipe(
        Match.when("food", () => processFoodConsumption(playerId, itemStack, itemInfo)),
        Match.when("tool", () => processToolUse(playerId, itemStack, itemInfo)),
        Match.when("weapon", () => processWeaponUse(playerId, itemStack, itemInfo)),
        Match.when("block", () => processBlockPlacement(playerId, itemStack, itemInfo)),
        Match.orElse(() => Effect.succeed({
          success: true,
          message: `Used ${itemInfo.displayName}`,
          consumeItem: false,
          damageItem: false
        } as ItemUseResult))
      )
    })

  const processFoodConsumption = (playerId: PlayerId, itemStack: ItemStack, itemInfo: ItemInfo) =>
    Effect.gen(function* () {
      // 食べ物の効果処理
      const nutrition = itemInfo.metadata?.nutrition || 2
      const saturation = itemInfo.metadata?.saturation || 1.2

      yield* eventBus.publish(new PlayerFeedEvent({
        playerId,
        nutrition,
        saturation,
        timestamp: new Date()
      }))

      return {
        success: true,
        message: `Ate ${itemInfo.displayName}`,
        consumeItem: true,
        damageItem: false,
        effects: {
          nutrition,
          saturation
        }
      } as ItemUseResult
    })

  const processToolUse = (playerId: PlayerId, itemStack: ItemStack, itemInfo: ItemInfo) =>
    Effect.gen(function* () {
      // ツール使用処理
      const efficiency = itemInfo.metadata?.efficiency || 1
      const damage = itemInfo.metadata?.damage || 1

      return {
        success: true,
        message: `Used ${itemInfo.displayName}`,
        consumeItem: false,
        damageItem: true,
        effects: {
          efficiency,
          damage
        }
      } as ItemUseResult
    })

  const processWeaponUse = (playerId: PlayerId, itemStack: ItemStack, itemInfo: ItemInfo) =>
    Effect.gen(function* () {
      // 武器使用処理
      const attackDamage = itemInfo.metadata?.attackDamage || 1
      const attackSpeed = itemInfo.metadata?.attackSpeed || 1.6

      return {
        success: true,
        message: `Used ${itemInfo.displayName}`,
        consumeItem: false,
        damageItem: true,
        effects: {
          attackDamage,
          attackSpeed
        }
      } as ItemUseResult
    })

  const processBlockPlacement = (playerId: PlayerId, itemStack: ItemStack, itemInfo: ItemInfo) =>
    Effect.gen(function* () {
      // ブロック配置処理
      return {
        success: true,
        message: `Placed ${itemInfo.displayName}`,
        consumeItem: true,
        damageItem: false
      } as ItemUseResult
    })

  const getPreviousSelection = (playerId: PlayerId) =>
    Effect.gen(function* () {
      // 前回の選択を記録から取得（実装は省略）
      return 0
    })

  return HotbarManager.of({
    selectSlot,
    scrollSelection,
    swapWithInventory,
    useSelectedItem,
    dropSelectedItem,
    getHotbarItems
  })
})

// Live Layer
export const HotbarManagerLive = Layer.effect(
  HotbarManager,
  makeHotbarManager
).pipe(
  Layer.provide(PlayerInventoryManagerLive),
  Layer.provide(ItemManagerLive),
  Layer.provide(EventBusLive)
)

// 型定義とイベント
interface ItemUseResult {
  readonly success: boolean
  readonly message: string
  readonly consumeItem: boolean
  readonly damageItem: boolean
  readonly effects?: Record<string, unknown>
}

class HotbarError {
  readonly _tag = "HotbarError"
  constructor(public readonly message: string) {}
}

class ItemUseError {
  readonly _tag = "ItemUseError"
  constructor(public readonly message: string) {}
}

class HotbarSelectionEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      previousSlot: number
      newSlot: number
      timestamp: Date
    }
  ) {}
}

class InventorySwapEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      fromType: "hotbar" | "inventory" | "armor"
      fromSlot: number
      toType: "hotbar" | "inventory" | "armor"
      toSlot: number
      timestamp: Date
    }
  ) {}
}

class ItemUseEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      itemStack: ItemStack
      useResult: ItemUseResult
      timestamp: Date
    }
  ) {}
}

class ItemDropEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      itemStack: ItemStack
      timestamp: Date
    }
  ) {}
}

class ItemBrokenEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      itemStack: ItemStack
      timestamp: Date
    }
  ) {}
}

class PlayerFeedEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      nutrition: number
      saturation: number
      timestamp: Date
    }
  ) {}
}
```

## アイテムスタッキング

### Advanced Item Stacking System

```typescript
// StackingManagerサービスインターフェース
interface StackingManagerInterface {
  readonly canStack: (stack1: ItemStack, stack2: ItemStack) => Effect.Effect<boolean, never>
  readonly calculateOptimalStacking: (items: ReadonlyArray<ItemStack>) => Effect.Effect<ReadonlyArray<ItemStack>, never>
  readonly mergeStacks: (stacks: ReadonlyArray<ItemStack>) => Effect.Effect<ReadonlyArray<ItemStack>, StackingError>
  readonly optimizeInventory: (inventory: PlayerInventory) => Effect.Effect<PlayerInventory, never>
  readonly findStackableSlots: (inventory: PlayerInventory, itemStack: ItemStack) => Effect.Effect<ReadonlyArray<SlotIndex>, never>
}

// Context Tag
export const StackingManager = Context.GenericTag<StackingManagerInterface>("StackingManager")

// Live実装の作成関数
const makeStackingManager = Effect.gen(function* () {
  const itemManager = yield* ItemManager

  const canStack = (stack1: ItemStack, stack2: ItemStack) =>
    Effect.gen(function* () {
      // 基本チェック
      if (stack1.itemId !== stack2.itemId) return false

      // 耐久度チェック
      if (stack1.durability !== stack2.durability) return false

      // エンチャントチェック
      if (!enchantmentsEqual(stack1.enchantments, stack2.enchantments)) return false

      // NBTデータチェック
      if (!nbtEqual(stack1.nbt, stack2.nbt)) return false

      // メタデータチェック
      if (!metadataEqual(stack1.metadata, stack2.metadata)) return false

      return true
    })

  const calculateOptimalStacking = (items: ReadonlyArray<ItemStack>) =>
    Effect.gen(function* () {
      const grouped = new Map<string, ItemStack[]>()

      // アイテムをグループ化
      for (const item of items) {
        const key = yield* generateStackingKey(item)
        if (!grouped.has(key)) {
          grouped.set(key, [])
        }
        grouped.get(key)!.push(item)
      }

      const optimizedStacks: ItemStack[] = []

      // 各グループで最適化
      for (const [key, stacks] of grouped.entries()) {
        const merged = yield* mergeStacksOfSameType(stacks)
        optimizedStacks.push(...merged)
      }

      return optimizedStacks
    })

  const mergeStacks = (stacks: ReadonlyArray<ItemStack>) =>
    Effect.gen(function* () {
      if (stacks.length === 0) return []
      if (stacks.length === 1) return [stacks[0]]

      // すべて同じアイテムかチェック
      const firstStack = stacks[0]
      for (let i = 1; i < stacks.length; i++) {
        const canMerge = yield* canStack(firstStack, stacks[i])
        if (!canMerge) {
          return yield* Effect.fail(new StackingError("Cannot merge different item types"))
        }
      }

      return yield* mergeStacksOfSameType(stacks)
    })

  const mergeStacksOfSameType = (stacks: ReadonlyArray<ItemStack>) =>
    Effect.gen(function* () {
      if (stacks.length === 0) return []

      const itemInfo = yield* itemManager.getItemInfo(stacks[0].itemId)
      const maxStackSize = itemInfo.maxStackSize
      let totalCount = stacks.reduce((sum, stack) => sum + stack.count, 0)

      const mergedStacks: ItemStack[] = []
      const template = stacks[0]

      while (totalCount > 0) {
        const stackSize = Math.min(totalCount, maxStackSize)
        mergedStacks.push({
          ...template,
          count: stackSize,
          timestamp: new Date()
        })
        totalCount -= stackSize
      }

      return mergedStacks
    })

  const optimizeInventory = (inventory: PlayerInventory) =>
    Effect.gen(function* () {
      // 全スロットのアイテムを取得
      const allItems: ItemStack[] = []
      const allSlots = [
        ...inventory.slots,
        ...inventory.hotbarSlots,
        ...inventory.armorSlots,
        inventory.offhandSlot
      ]

      for (const slot of allSlots) {
        if (slot.itemStack) {
          allItems.push(slot.itemStack)
        }
      }

      // 最適化されたスタックを生成
      const optimizedStacks = yield* calculateOptimalStacking(allItems)

      // スロットをクリア
      for (const slot of allSlots) {
        slot.itemStack = undefined
        slot.lastModified = new Date()
      }

      // 最適化されたアイテムを再配置
      let stackIndex = 0

      // メインインベントリから配置
      for (let i = 0; i < inventory.slots.length && stackIndex < optimizedStacks.length; i++) {
        inventory.slots[i].itemStack = optimizedStacks[stackIndex]
        inventory.slots[i].lastModified = new Date()
        stackIndex++
      }

      // ホットバーに配置
      for (let i = 0; i < inventory.hotbarSlots.length && stackIndex < optimizedStacks.length; i++) {
        inventory.hotbarSlots[i].itemStack = optimizedStacks[stackIndex]
        inventory.hotbarSlots[i].lastModified = new Date()
        stackIndex++
      }

      return {
        ...inventory,
        lastAccessed: new Date()
      }
    })

  const findStackableSlots = (inventory: PlayerInventory, itemStack: ItemStack) =>
    Effect.gen(function* () {
      const stackableSlots: SlotIndex[] = []

      const allSlots = [
        ...inventory.slots.map((slot, index) => ({ slot, index, type: "inventory" })),
        ...inventory.hotbarSlots.map((slot, index) => ({ slot, index, type: "hotbar" }))
      ]

      for (const { slot, index, type } of allSlots) {
        if (slot.itemStack) {
          const canMerge = yield* canStack(slot.itemStack, itemStack)
          if (canMerge) {
            const itemInfo = yield* itemManager.getItemInfo(itemStack.itemId)
            const availableSpace = itemInfo.maxStackSize - slot.itemStack.count
            if (availableSpace > 0) {
              stackableSlots.push(index)
            }
          }
        }
      }

      return stackableSlots
    })

  const generateStackingKey = (itemStack: ItemStack) =>
    Effect.gen(function* () {
      const parts = [
        itemStack.itemId,
        itemStack.durability?.toString() || "no-durability",
        JSON.stringify(itemStack.enchantments || []),
        JSON.stringify(itemStack.nbt || {}),
        JSON.stringify(itemStack.metadata || {})
      ]
      return parts.join("|")
    })

  return StackingManager.of({
    canStack,
    calculateOptimalStacking,
    mergeStacks,
    optimizeInventory,
    findStackableSlots
  })
})

// Live Layer
export const StackingManagerLive = Layer.effect(
  StackingManager,
  makeStackingManager
).pipe(
  Layer.provide(ItemManagerLive)
)

// ヘルパー関数
const enchantmentsEqual = (
  enchants1: ItemStack["enchantments"],
  enchants2: ItemStack["enchantments"]
): boolean => {
  if (!enchants1 && !enchants2) return true
  if (!enchants1 || !enchants2) return false
  if (enchants1.length !== enchants2.length) return false

  const sorted1 = [...enchants1].sort((a, b) => a.enchantmentId.localeCompare(b.enchantmentId))
  const sorted2 = [...enchants2].sort((a, b) => a.enchantmentId.localeCompare(b.enchantmentId))

  for (let i = 0; i < sorted1.length; i++) {
    if (sorted1[i].enchantmentId !== sorted2[i].enchantmentId ||
        sorted1[i].level !== sorted2[i].level) {
      return false
    }
  }

  return true
}

const nbtEqual = (nbt1: ItemStack["nbt"], nbt2: ItemStack["nbt"]): boolean => {
  return JSON.stringify(nbt1 || {}) === JSON.stringify(nbt2 || {})
}

const metadataEqual = (meta1: ItemStack["metadata"], meta2: ItemStack["metadata"]): boolean => {
  return JSON.stringify(meta1 || {}) === JSON.stringify(meta2 || {})
}

class StackingError {
  readonly _tag = "StackingError"
  constructor(public readonly message: string) {}
}
```

## アイテム転送システム

### Item Transfer Manager

```typescript
// ItemTransferManagerサービスインターフェース
interface ItemTransferManagerInterface {
  readonly transferItem: (transfer: ItemTransferRequest) => Effect.Effect<ItemTransferResult, TransferError>
  readonly bulkTransfer: (transfers: ReadonlyArray<ItemTransferRequest>) => Effect.Effect<ReadonlyArray<ItemTransferResult>, TransferError>
  readonly quickStack: (fromInventory: InventoryId, toInventory: InventoryId) => Effect.Effect<QuickStackResult, TransferError>
  readonly sortInventory: (inventoryId: InventoryId) => Effect.Effect<void, InventoryError>
  readonly autoTransfer: (sourceId: InventoryId, targetId: InventoryId, filter: ItemFilter) => Effect.Effect<AutoTransferResult, TransferError>
}

// Context Tag
export const ItemTransferManager = Context.GenericTag<ItemTransferManagerInterface>("ItemTransferManager")

// Live実装の作成関数
const makeItemTransferManager = Effect.gen(function* () {
  const playerInventory = yield* PlayerInventoryManager
  const containerManager = yield* ContainerManager
  const stackingManager = yield* StackingManager
  const eventBus = yield* EventBus

  const transferItem = (request: ItemTransferRequest) =>
    Effect.gen(function* () {
      // ソースインベントリの検証
      const sourceInventory = yield* getInventory(request.sourceType, request.sourceId)
      const targetInventory = yield* getInventory(request.targetType, request.targetId)

      // 転送権限の確認
      yield* validateTransferPermissions(request, sourceInventory, targetInventory)

      // アイテムの取得
      const sourceItem = yield* getItemFromSlot(sourceInventory, request.sourceSlot)
      if (!sourceItem) {
        return yield* Effect.fail(new TransferError("Source slot is empty"))
      }

      // 転送量の計算
      const transferCount = request.count || sourceItem.count
      if (transferCount > sourceItem.count) {
        return yield* Effect.fail(new TransferError("Insufficient items in source slot"))
      }

      // アイテムの分割（必要な場合）
      let transferStack: ItemStack
      let remainingStack: ItemStack | null = null

      if (transferCount === sourceItem.count) {
        transferStack = sourceItem
      } else {
        const [remaining, transfer] = yield* stackingManager.mergeStacks([{
          ...sourceItem,
          count: sourceItem.count - transferCount
        }, {
          ...sourceItem,
          count: transferCount
        }])
        remainingStack = remaining[0]
        transferStack = remaining[1]
      }

      // ターゲットスロットの処理
      let finalTransferResult: ItemTransferResult

      switch (request.transferType) {
        case "move":
          finalTransferResult = yield* processMoveTransfer(transferStack, request, targetInventory)
          break
        case "swap":
          finalTransferResult = yield* processSwapTransfer(transferStack, request, sourceInventory, targetInventory)
          break
        case "merge":
          finalTransferResult = yield* processMergeTransfer(transferStack, request, targetInventory)
          break
        case "split":
          finalTransferResult = yield* processSplitTransfer(transferStack, request, targetInventory)
          break
        default:
          return yield* Effect.fail(new TransferError(`Unknown transfer type: ${request.transferType}`))
      }

      // ソーススロットの更新
      yield* setItemInSlot(sourceInventory, request.sourceSlot, remainingStack)

      // 転送イベントの発行
      yield* eventBus.publish(new ItemTransferEvent({
        transfer: {
          id: generateTransferId(),
          sourceType: request.sourceType,
          sourceId: request.sourceId,
          sourceSlot: request.sourceSlot,
          targetType: request.targetType,
          targetId: request.targetId,
          targetSlot: request.targetSlot,
          itemStack: transferStack,
          transferType: request.transferType,
          timestamp: new Date()
        },
        result: finalTransferResult
      }))

      return finalTransferResult
    })

  const bulkTransfer = (transfers: ReadonlyArray<ItemTransferRequest>) =>
    Effect.gen(function* () {
      const results: ItemTransferResult[] = []

      // 転送を順次実行（依存関係があるため）
      for (const transfer of transfers) {
        try {
          const result = yield* transferItem(transfer)
          results.push(result)
        } catch (error) {
          // エラーがあっても他の転送は続行
          results.push({
            success: false,
            transferredCount: 0,
            error: error instanceof TransferError ? error.message : "Unknown error"
          })
        }
      }

      return results
    })

  const quickStack = (fromInventoryId: InventoryId, toInventoryId: InventoryId) =>
    Effect.gen(function* () {
      const fromInventory = yield* getInventoryById(fromInventoryId)
      const toInventory = yield* getInventoryById(toInventoryId)

      let totalTransferred = 0
      const transfers: ItemTransfer[] = []

      // 転送可能なアイテムを検索
      for (let fromSlot = 0; fromSlot < fromInventory.slots.length; fromSlot++) {
        const sourceItem = fromInventory.slots[fromSlot].itemStack
        if (!sourceItem) continue

        // ターゲットでスタック可能なスロットを検索
        for (let toSlot = 0; toSlot < toInventory.slots.length; toSlot++) {
          const targetItem = toInventory.slots[toSlot].itemStack

          if (targetItem) {
            const canMerge = yield* stackingManager.canStack(sourceItem, targetItem)
            if (canMerge) {
              const itemInfo = yield* itemManager.getItemInfo(sourceItem.itemId)
              const availableSpace = itemInfo.maxStackSize - targetItem.count
              const transferCount = Math.min(sourceItem.count, availableSpace)

              if (transferCount > 0) {
                const transferResult = yield* transferItem({
                  sourceType: fromInventoryId.type,
                  sourceId: fromInventoryId.id,
                  sourceSlot: fromSlot,
                  targetType: toInventoryId.type,
                  targetId: toInventoryId.id,
                  targetSlot: toSlot,
                  count: transferCount,
                  transferType: "merge"
                })

                if (transferResult.success) {
                  totalTransferred += transferResult.transferredCount
                  transfers.push({
                    id: generateTransferId(),
                    sourceType: fromInventoryId.type,
                    sourceId: fromInventoryId.id,
                    sourceSlot: fromSlot,
                    targetType: toInventoryId.type,
                    targetId: toInventoryId.id,
                    targetSlot: toSlot,
                    itemStack: sourceItem,
                    transferType: "merge",
                    timestamp: new Date()
                  })
                }

                // ソースアイテムがなくなった場合は次のスロットへ
                if (sourceItem.count <= transferCount) break
              }
            }
          }
        }
      }

      return {
        success: totalTransferred > 0,
        totalTransferred,
        transfers
      } as QuickStackResult
    })

  const sortInventory = (inventoryId: InventoryId) =>
    Effect.gen(function* () {
      const inventory = yield* getInventoryById(inventoryId)

      // アイテムを収集
      const items: ItemStack[] = []
      for (const slot of inventory.slots) {
        if (slot.itemStack) {
          items.push(slot.itemStack)
        }
      }

      // アイテムをソート（アイテムID、品質、数量順）
      items.sort((a, b) => {
        if (a.itemId !== b.itemId) return a.itemId.localeCompare(b.itemId)
        if (a.durability !== b.durability) return (b.durability || 0) - (a.durability || 0)
        return b.count - a.count
      })

      // スタッキングを最適化
      const optimizedStacks = yield* stackingManager.calculateOptimalStacking(items)

      // スロットをクリア
      for (const slot of inventory.slots) {
        slot.itemStack = undefined
        slot.lastModified = new Date()
      }

      // ソートされたアイテムを再配置
      for (let i = 0; i < Math.min(optimizedStacks.length, inventory.slots.length); i++) {
        inventory.slots[i].itemStack = optimizedStacks[i]
        inventory.slots[i].lastModified = new Date()
      }

      yield* eventBus.publish(new InventorySortEvent({
        inventoryId,
        itemCount: optimizedStacks.length,
        timestamp: new Date()
      }))
    })

  const autoTransfer = (sourceId: InventoryId, targetId: InventoryId, filter: ItemFilter) =>
    Effect.gen(function* () {
      const sourceInventory = yield* getInventoryById(sourceId)
      const targetInventory = yield* getInventoryById(targetId)

      let totalTransferred = 0
      const transfers: ItemTransfer[] = []

      for (let slotIndex = 0; slotIndex < sourceInventory.slots.length; slotIndex++) {
        const item = sourceInventory.slots[slotIndex].itemStack
        if (!item) continue

        // フィルターチェック
        const shouldTransfer = yield* applyItemFilter(item, filter)
        if (!shouldTransfer) continue

        // 転送実行
        const transferResult = yield* transferItem({
          sourceType: sourceId.type,
          sourceId: sourceId.id,
          sourceSlot: slotIndex,
          targetType: targetId.type,
          targetId: targetId.id,
          transferType: "move"
        })

        if (transferResult.success) {
          totalTransferred += transferResult.transferredCount
          transfers.push({
            id: generateTransferId(),
            sourceType: sourceId.type,
            sourceId: sourceId.id,
            sourceSlot: slotIndex,
            targetType: targetId.type,
            targetId: targetId.id,
            itemStack: item,
            transferType: "move",
            timestamp: new Date()
          })
        }
      }

      return {
        success: totalTransferred > 0,
        totalTransferred,
        transfers,
        filteredItems: transfers.length
      } as AutoTransferResult
    })

  // ヘルパー関数
  const getInventory = (type: string, id: string) =>
    Effect.gen(function* () {
      switch (type) {
        case "player":
          return yield* playerInventory.getPlayerInventory(id as PlayerId)
        case "container":
          return yield* containerManager.getContainer(id as ContainerId)
        default:
          return yield* Effect.fail(new TransferError(`Unknown inventory type: ${type}`))
      }
    })

  return ItemTransferManager.of({
    transferItem,
    bulkTransfer,
    quickStack,
    sortInventory,
    autoTransfer
  })
})

// Live Layer
export const ItemTransferManagerLive = Layer.effect(
  ItemTransferManager,
  makeItemTransferManager
).pipe(
  Layer.provide(PlayerInventoryManagerLive),
  Layer.provide(ContainerManagerLive),
  Layer.provide(StackingManagerLive),
  Layer.provide(EventBusLive)
)

// 型定義
interface ItemTransferRequest {
  readonly sourceType: "player" | "container"
  readonly sourceId: string
  readonly sourceSlot?: SlotIndex
  readonly targetType: "player" | "container"
  readonly targetId: string
  readonly targetSlot?: SlotIndex
  readonly count?: number
  readonly transferType: "move" | "swap" | "merge" | "split"
}

interface ItemTransferResult {
  readonly success: boolean
  readonly transferredCount: number
  readonly error?: string
}

interface QuickStackResult {
  readonly success: boolean
  readonly totalTransferred: number
  readonly transfers: ReadonlyArray<ItemTransfer>
}

interface AutoTransferResult {
  readonly success: boolean
  readonly totalTransferred: number
  readonly transfers: ReadonlyArray<ItemTransfer>
  readonly filteredItems: number
}

interface InventoryId {
  readonly type: "player" | "container"
  readonly id: string
}

interface ItemFilter {
  readonly itemIds?: ReadonlyArray<ItemId>
  readonly categories?: ReadonlyArray<string>
  readonly minDurability?: number
  readonly hasEnchantments?: boolean
  readonly customPredicate?: (item: ItemStack) => boolean
}

type ContainerId = string & Brand.Brand<"ContainerId">

class TransferError {
  readonly _tag = "TransferError"
  constructor(public readonly message: string) {}
}

class ItemTransferEvent {
  constructor(
    public readonly data: {
      transfer: ItemTransfer
      result: ItemTransferResult
    }
  ) {}
}

class InventorySortEvent {
  constructor(
    public readonly data: {
      inventoryId: InventoryId
      itemCount: number
      timestamp: Date
    }
  ) {}
}
```

## コンテナ相互作用

### Container Management System

```typescript
// ContainerManagerサービスインターフェース
interface ContainerManagerInterface {
  readonly openContainer: (playerId: PlayerId, containerId: ContainerId) => Effect.Effect<ContainerInventory, ContainerError>
  readonly closeContainer: (playerId: PlayerId, containerId: ContainerId) => Effect.Effect<void, never>
  readonly getContainer: (containerId: ContainerId) => Effect.Effect<ContainerInventory, ContainerNotFoundError>
  readonly createContainer: (position: Vector3D, containerType: ContainerType) => Effect.Effect<ContainerInventory, ContainerCreationError>
  readonly destroyContainer: (containerId: ContainerId) => Effect.Effect<ReadonlyArray<ItemStack>, ContainerError>
  readonly getAccessibleContainers: (playerId: PlayerId, radius: number) => Effect.Effect<ReadonlyArray<ContainerInventory>, never>
}

// Context Tag
export const ContainerManager = Context.GenericTag<ContainerManagerInterface>("ContainerManager")

// Live実装の作成関数
const makeContainerManager = Effect.gen(function* () {
  const worldService = yield* WorldService
  const itemManager = yield* ItemManager
  const eventBus = yield* EventBus

  const containers = yield* Effect.sync(() => new Map<ContainerId, ContainerInventory>())

  const openContainer = (playerId: PlayerId, containerId: ContainerId) =>
    Effect.gen(function* () {
      const container = containers.get(containerId)
      if (!container) {
        return yield* Effect.fail(new ContainerError(`Container not found: ${containerId}`))
      }

      // アクセス権限チェック
      if (!container.permissions.canView) {
        return yield* Effect.fail(new ContainerError("No permission to view container"))
      }

      // 距離チェック
      const playerPosition = yield* getPlayerPosition(playerId)
      const distance = calculateDistance(playerPosition, container.position)
      const maxDistance = getContainerInteractionDistance(container.containerType)

      if (distance > maxDistance) {
        return yield* Effect.fail(new ContainerError("Container is too far away"))
      }

      // コンテナを開く
      const updatedContainer = {
        ...container,
        isOpen: true,
        accessingPlayers: [...container.accessingPlayers, playerId]
      }

      containers.set(containerId, updatedContainer)

      yield* eventBus.publish(new ContainerOpenEvent({
        playerId,
        containerId,
        containerType: container.containerType,
        timestamp: new Date()
      }))

      return updatedContainer
    })

  const closeContainer = (playerId: PlayerId, containerId: ContainerId) =>
    Effect.gen(function* () {
      const container = containers.get(containerId)
      if (!container) return

      const updatedContainer = {
        ...container,
        accessingPlayers: container.accessingPlayers.filter(pid => pid !== playerId),
        isOpen: container.accessingPlayers.filter(pid => pid !== playerId).length > 0
      }

      containers.set(containerId, updatedContainer)

      yield* eventBus.publish(new ContainerCloseEvent({
        playerId,
        containerId,
        timestamp: new Date()
      }))
    })

  const getContainer = (containerId: ContainerId) =>
    Effect.gen(function* () {
      const container = containers.get(containerId)
      if (!container) {
        return yield* Effect.fail(new ContainerNotFoundError(containerId))
      }
      return container
    })

  const createContainer = (position: Vector3D, containerType: ContainerType) =>
    Effect.gen(function* () {
      const containerId = generateContainerId()
      const slotCount = getContainerSlotCount(containerType)

      const container: ContainerInventory = {
        containerId,
        containerType,
        slots: Array.from({ length: slotCount }, (_, index) => ({
          index,
          isLocked: false,
          lastModified: new Date()
        })),
        position,
        isOpen: false,
        accessingPlayers: [],
        permissions: {
          canInsert: true,
          canExtract: true,
          canView: true
        },
        lastModified: new Date()
      }

      containers.set(containerId, container)

      // ワールドにコンテナブロックを配置
      yield* worldService.setBlock(position, getContainerBlockType(containerType))

      yield* eventBus.publish(new ContainerCreatedEvent({
        containerId,
        containerType,
        position,
        timestamp: new Date()
      }))

      return container
    })

  const destroyContainer = (containerId: ContainerId) =>
    Effect.gen(function* () {
      const container = containers.get(containerId)
      if (!container) {
        return yield* Effect.fail(new ContainerError(`Container not found: ${containerId}`))
      }

      // アクセス中のプレイヤーを強制退出
      for (const playerId of container.accessingPlayers) {
        yield* closeContainer(playerId, containerId)
      }

      // アイテムをドロップ
      const droppedItems: ItemStack[] = []
      for (const slot of container.slots) {
        if (slot.itemStack) {
          droppedItems.push(slot.itemStack)
        }
      }

      // ワールドからコンテナブロックを削除
      yield* worldService.setBlock(container.position, BlockType.Air)

      // コンテナを削除
      containers.delete(containerId)

      yield* eventBus.publish(new ContainerDestroyedEvent({
        containerId,
        position: container.position,
        droppedItems,
        timestamp: new Date()
      }))

      return droppedItems
    })

  const getAccessibleContainers = (playerId: PlayerId, radius: number) =>
    Effect.gen(function* () {
      const playerPosition = yield* getPlayerPosition(playerId)
      const accessibleContainers: ContainerInventory[] = []

      for (const container of containers.values()) {
        const distance = calculateDistance(playerPosition, container.position)
        if (distance <= radius && container.permissions.canView) {
          accessibleContainers.push(container)
        }
      }

      return accessibleContainers.sort((a, b) => {
        const distA = calculateDistance(playerPosition, a.position)
        const distB = calculateDistance(playerPosition, b.position)
        return distA - distB
      })
    })

  // 特別なコンテナタイプの処理
  const createSpecializedContainer = (containerType: ContainerType, position: Vector3D) =>
    Effect.gen(function* () {
      const baseContainer = yield* createContainer(position, containerType)

      switch (containerType) {
        case "furnace":
          return yield* createFurnaceContainer(baseContainer)
        case "crafting_table":
          return yield* createCraftingTableContainer(baseContainer)
        case "brewing_stand":
          return yield* createBrewingStandContainer(baseContainer)
        case "anvil":
          return yield* createAnvilContainer(baseContainer)
        case "enchanting_table":
          return yield* createEnchantingTableContainer(baseContainer)
        default:
          return baseContainer
      }
    })

  const createFurnaceContainer = (baseContainer: ContainerInventory) =>
    Effect.gen(function* () {
      // かまどの場合、スロット制限を設定
      const furnaceContainer = {
        ...baseContainer,
        slots: [
          { ...baseContainer.slots[0], restrictions: ["fuel"] }, // 燃料スロット
          { ...baseContainer.slots[1], restrictions: ["cookable"] }, // 原料スロット
          { ...baseContainer.slots[2], restrictions: [], isLocked: true } // 結果スロット（取り出しのみ）
        ]
      }

      return furnaceContainer
    })

  const createCraftingTableContainer = (baseContainer: ContainerInventory) =>
    Effect.gen(function* () {
      // クラフトテーブルの場合、3x3のクラフトグリッド + 結果スロット
      const craftingContainer = {
        ...baseContainer,
        slots: [
          ...Array.from({ length: 9 }, (_, i) => ({ // クラフトグリッド
            index: i,
            isLocked: false,
            lastModified: new Date()
          })),
          { // 結果スロット
            index: 9,
            isLocked: true,
            restrictions: [],
            lastModified: new Date()
          }
        ]
      }

      return craftingContainer
    })

  return ContainerManager.of({
    openContainer,
    closeContainer,
    getContainer,
    createContainer,
    destroyContainer,
    getAccessibleContainers
  })
})

// Live Layer
export const ContainerManagerLive = Layer.effect(
  ContainerManager,
  makeContainerManager
).pipe(
  Layer.provide(WorldServiceLive),
  Layer.provide(ItemManagerLive),
  Layer.provide(EventBusLive)
)

// ヘルパー関数
type ContainerType = "chest" | "furnace" | "crafting_table" | "brewing_stand" | "anvil" | "enchanting_table"

const getContainerSlotCount = (containerType: ContainerType): number => {
  switch (containerType) {
    case "chest": return CHEST_SIZE
    case "furnace": return FURNACE_SIZE
    case "crafting_table": return 10 // 9 + 1 result
    case "brewing_stand": return 4 // 3 potions + 1 ingredient
    case "anvil": return 3 // 2 input + 1 output
    case "enchanting_table": return 2 // 1 item + 1 lapis
    default: return CHEST_SIZE
  }
}

const getContainerInteractionDistance = (containerType: ContainerType): number => {
  switch (containerType) {
    case "chest": return 6
    case "furnace": return 6
    case "crafting_table": return 6
    case "brewing_stand": return 6
    case "anvil": return 6
    case "enchanting_table": return 6
    default: return 6
  }
}

const getContainerBlockType = (containerType: ContainerType): BlockType => {
  switch (containerType) {
    case "chest": return BlockType.Chest
    case "furnace": return BlockType.Furnace
    case "crafting_table": return BlockType.CraftingTable
    case "brewing_stand": return BlockType.BrewingStand
    case "anvil": return BlockType.Anvil
    case "enchanting_table": return BlockType.EnchantingTable
    default: return BlockType.Chest
  }
}

const calculateDistance = (pos1: Vector3D, pos2: Vector3D): number => {
  return Math.sqrt(
    Math.pow(pos1.x - pos2.x, 2) +
    Math.pow(pos1.y - pos2.y, 2) +
    Math.pow(pos1.z - pos2.z, 2)
  )
}

const generateContainerId = (): ContainerId => {
  return `container_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` as ContainerId
}

const generateTransferId = (): string => {
  return `transfer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// 型定義とイベント
class ContainerError {
  readonly _tag = "ContainerError"
  constructor(public readonly message: string) {}
}

class ContainerNotFoundError {
  readonly _tag = "ContainerNotFoundError"
  constructor(public readonly containerId: ContainerId) {}
}

class ContainerCreationError {
  readonly _tag = "ContainerCreationError"
  constructor(public readonly message: string) {}
}

class ContainerOpenEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      containerId: ContainerId
      containerType: ContainerType
      timestamp: Date
    }
  ) {}
}

class ContainerCloseEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      containerId: ContainerId
      timestamp: Date
    }
  ) {}
}

class ContainerCreatedEvent {
  constructor(
    public readonly data: {
      containerId: ContainerId
      containerType: ContainerType
      position: Vector3D
      timestamp: Date
    }
  ) {}
}

class ContainerDestroyedEvent {
  constructor(
    public readonly data: {
      containerId: ContainerId
      position: Vector3D
      droppedItems: ReadonlyArray<ItemStack>
      timestamp: Date
    }
  ) {}
}
```

## インテグレーション

### Inventory System Integration

```typescript
export class InventorySystemService extends Context.Tag("InventorySystemService")<
  InventorySystemService,
  {
    readonly initializePlayerInventory: (playerId: PlayerId) => Effect.Effect<PlayerInventory, InventoryError>
    readonly processPlayerAction: (playerId: PlayerId, action: InventoryAction) => Effect.Effect<InventoryActionResult, InventoryError>
    readonly syncInventory: (playerId: PlayerId) => Effect.Effect<void, never>
    readonly getInventoryState: (playerId: PlayerId) => Effect.Effect<InventoryState, never>
  }
>() {}

export const InventorySystemServiceLive = Layer.effect(
  InventorySystemService,
  Effect.gen(function* () {
    const playerInventory = yield* PlayerInventoryManager
    const hotbarManager = yield* HotbarManager
    const transferManager = yield* ItemTransferManager
    const containerManager = yield* ContainerManager

    const initializePlayerInventory = (playerId: PlayerId) =>
      Effect.gen(function* () {
        return yield* playerInventory.getPlayerInventory(playerId)
      })

    const processPlayerAction = (playerId: PlayerId, action: InventoryAction) =>
      Effect.gen(function* () {
        switch (action.type) {
          case "select_hotbar_slot":
            yield* hotbarManager.selectSlot(playerId, action.slotIndex)
            return { success: true, message: "Hotbar slot selected" }

          case "use_item":
            const useResult = yield* hotbarManager.useSelectedItem(playerId)
            return { success: useResult.success, message: useResult.message }

          case "drop_item":
            const dropped = yield* hotbarManager.dropSelectedItem(playerId, action.count)
            return {
              success: dropped !== null,
              message: dropped ? "Item dropped" : "No item to drop"
            }

          case "move_item":
            yield* playerInventory.moveItem(playerId, action.fromSlot, action.toSlot)
            return { success: true, message: "Item moved" }

          case "transfer_item":
            const transferResult = yield* transferManager.transferItem(action.transferRequest)
            return {
              success: transferResult.success,
              message: transferResult.error || "Item transferred"
            }

          case "open_container":
            const container = yield* containerManager.openContainer(playerId, action.containerId)
            return { success: true, message: "Container opened", data: container }

          case "close_container":
            yield* containerManager.closeContainer(playerId, action.containerId)
            return { success: true, message: "Container closed" }

          default:
            return yield* Effect.fail(new InventoryError(`Unknown action type: ${action.type}`))
        }
      })

    const syncInventory = (playerId: PlayerId) =>
      Effect.gen(function* () {
        // クライアントとサーバー間でインベントリ状態を同期
        const inventory = yield* playerInventory.getPlayerInventory(playerId)
        yield* sendInventoryUpdate(playerId, inventory)
      })

    const getInventoryState = (playerId: PlayerId) =>
      Effect.gen(function* () {
        const inventory = yield* playerInventory.getPlayerInventory(playerId)
        const hotbarItems = yield* hotbarManager.getHotbarItems(playerId)
        const accessibleContainers = yield* containerManager.getAccessibleContainers(playerId, 10)

        return {
          inventory,
          hotbarItems,
          selectedHotbarIndex: inventory.selectedHotbarIndex,
          accessibleContainers,
          totalWeight: inventory.totalWeight,
          maxWeight: inventory.maxWeight
        } as InventoryState
      })

    return InventorySystemService.of({
      initializePlayerInventory,
      processPlayerAction,
      syncInventory,
      getInventoryState
    })
  })
).pipe(
  Layer.provide(PlayerInventoryManagerLive),
  Layer.provide(HotbarManagerLive),
  Layer.provide(ItemTransferManagerLive),
  Layer.provide(ContainerManagerLive)
)

// 型定義
interface InventoryAction {
  readonly type: "select_hotbar_slot" | "use_item" | "drop_item" | "move_item" | "transfer_item" | "open_container" | "close_container"
  readonly slotIndex?: number
  readonly fromSlot?: SlotIndex
  readonly toSlot?: SlotIndex
  readonly count?: number
  readonly transferRequest?: ItemTransferRequest
  readonly containerId?: ContainerId
}

interface InventoryActionResult {
  readonly success: boolean
  readonly message: string
  readonly data?: unknown
}

interface InventoryState {
  readonly inventory: PlayerInventory
  readonly hotbarItems: ReadonlyArray<ItemStack | null>
  readonly selectedHotbarIndex: number
  readonly accessibleContainers: ReadonlyArray<ContainerInventory>
  readonly totalWeight: number
  readonly maxWeight: number
}
```

## テスト

```typescript
import { Effect, TestContext, TestClock } from "effect"

describe("Inventory System", () => {
  const TestInventoryLayer = Layer.mergeAll(
    ItemManagerLive,
    PlayerInventoryManagerLive,
    HotbarManagerLive,
    StackingManagerLive,
    ItemTransferManagerLive,
    ContainerManagerLive,
    InventorySystemServiceLive
  ).pipe(
    Layer.provide(TestContext.TestContext),
    Layer.provide(TestClock.TestClock)
  )

  it("should create and manage item stacks", () =>
    Effect.gen(function* () {
      const itemManager = yield* ItemManager

      const stack = yield* itemManager.createItemStack("diamond" as ItemId, 10)
      expect(stack.itemId).toBe("diamond")
      expect(stack.count).toBe(10)

      const isValid = yield* itemManager.validateItemStack(stack)
      expect(isValid).toBe(true)
    }).pipe(
      Effect.provide(TestInventoryLayer),
      Effect.runPromise
    ))

  it("should add items to player inventory", () =>
    Effect.gen(function* () {
      const playerInventory = yield* PlayerInventoryManager
      const playerId = "player1" as PlayerId

      const itemStack = {
        itemId: "stone" as ItemId,
        count: 32,
        timestamp: new Date()
      } as ItemStack

      const result = yield* playerInventory.addItem(playerId, itemStack)
      expect(result.success).toBe(true)
      expect(result.totalAdded).toBe(32)

      const count = yield* playerInventory.countItems(playerId, "stone" as ItemId)
      expect(count).toBe(32)
    }).pipe(
      Effect.provide(TestInventoryLayer),
      Effect.runPromise
    ))

  it("should manage hotbar selection", () =>
    Effect.gen(function* () {
      const hotbarManager = yield* HotbarManager
      const playerId = "player1" as PlayerId

      yield* hotbarManager.selectSlot(playerId, 3)

      const hotbarItems = yield* hotbarManager.getHotbarItems(playerId)
      expect(hotbarItems).toHaveLength(HOTBAR_SIZE)
    }).pipe(
      Effect.provide(TestInventoryLayer),
      Effect.runPromise
    ))

  it("should stack compatible items", () =>
    Effect.gen(function* () {
      const stackingManager = yield* StackingManager
      const itemManager = yield* ItemManager

      const stack1 = yield* itemManager.createItemStack("iron_ingot" as ItemId, 32)
      const stack2 = yield* itemManager.createItemStack("iron_ingot" as ItemId, 16)

      const canStack = yield* stackingManager.canStack(stack1, stack2)
      expect(canStack).toBe(true)

      const [combined, remaining] = yield* stackingManager.mergeStacks([stack1, stack2])
      expect(combined[0].count).toBe(48)
      expect(remaining).toBeNull()
    }).pipe(
      Effect.provide(TestInventoryLayer),
      Effect.runPromise
    ))

  it("should transfer items between inventories", () =>
    Effect.gen(function* () {
      const transferManager = yield* ItemTransferManager
      const playerInventory = yield* PlayerInventoryManager
      const containerManager = yield* ContainerManager

      const playerId = "player1" as PlayerId
      const container = yield* containerManager.createContainer(
        { x: 0, y: 0, z: 0 },
        "chest"
      )

      // プレイヤーにアイテムを追加
      const itemStack = {
        itemId: "coal" as ItemId,
        count: 20,
        timestamp: new Date()
      } as ItemStack

      yield* playerInventory.addItem(playerId, itemStack)

      // コンテナに転送
      const transferResult = yield* transferManager.transferItem({
        sourceType: "player",
        sourceId: playerId,
        sourceSlot: 0,
        targetType: "container",
        targetId: container.containerId,
        targetSlot: 0,
        count: 10,
        transferType: "move"
      })

      expect(transferResult.success).toBe(true)
      expect(transferResult.transferredCount).toBe(10)
    }).pipe(
      Effect.provide(TestInventoryLayer),
      Effect.runPromise
    ))

  it("should create and manage containers", () =>
    Effect.gen(function* () {
      const containerManager = yield* ContainerManager
      const playerId = "player1" as PlayerId

      const container = yield* containerManager.createContainer(
        { x: 10, y: 64, z: 10 },
        "furnace"
      )

      expect(container.containerType).toBe("furnace")
      expect(container.slots).toHaveLength(FURNACE_SIZE)

      const openedContainer = yield* containerManager.openContainer(playerId, container.containerId)
      expect(openedContainer.isOpen).toBe(true)
      expect(openedContainer.accessingPlayers).toContain(playerId)

      yield* containerManager.closeContainer(playerId, container.containerId)
      const closedContainer = yield* containerManager.getContainer(container.containerId)
      expect(closedContainer.isOpen).toBe(false)
    }).pipe(
      Effect.provide(TestInventoryLayer),
      Effect.runPromise
    ))
})
```

## 装備システム

### Equipment Manager

```typescript
// EquipmentManagerサービスインターフェース
interface EquipmentManagerInterface {
  readonly equipItem: (playerId: PlayerId, itemStack: ItemStack, slot: EquipmentSlot) => Effect.Effect<EquipmentResult, EquipmentError>
  readonly unequipItem: (playerId: PlayerId, slot: EquipmentSlot) => Effect.Effect<ItemStack | null, EquipmentError>
  readonly getEquippedItems: (playerId: PlayerId) => Effect.Effect<EquippedItems, never>
  readonly canEquipInSlot: (itemStack: ItemStack, slot: EquipmentSlot) => Effect.Effect<boolean, never>
  readonly calculateEquipmentStats: (playerId: PlayerId) => Effect.Effect<EquipmentStats, never>
  readonly applyEquipmentEffects: (playerId: PlayerId) => Effect.Effect<void, never>
}

// Context Tag
export const EquipmentManager = Context.GenericTag<EquipmentManagerInterface>("EquipmentManager")

// Live実装の作成関数
const makeEquipmentManager = Effect.gen(function* () {
  const playerInventory = yield* PlayerInventoryManager
  const itemManager = yield* ItemManager
  const eventBus = yield* EventBus

  const equipItem = (playerId: PlayerId, itemStack: ItemStack, slot: EquipmentSlot) =>
    Effect.gen(function* () {
      const inventory = yield* playerInventory.getPlayerInventory(playerId)
      const itemInfo = yield* itemManager.getItemInfo(itemStack.itemId)

      // 装備可能かチェック
      const canEquip = yield* canEquipInSlot(itemStack, slot)
      if (!canEquip) {
        return yield* Effect.fail(new EquipmentError(`Cannot equip ${itemInfo.displayName} in ${slot} slot`))
      }

      // スロットの取得
      const equipmentSlot = getEquipmentSlotFromInventory(inventory, slot)
      const previousItem = equipmentSlot.itemStack

      // 既存アイテムがある場合は取り外し
      if (previousItem) {
        // メインインベントリに戻す
        const addResult = yield* playerInventory.addItem(playerId, previousItem)
        if (!addResult.success) {
          return yield* Effect.fail(new EquipmentError("Inventory full, cannot unequip existing item"))
        }
      }

      // 新しいアイテムを装備
      equipmentSlot.itemStack = itemStack
      equipmentSlot.lastModified = new Date()

      // 装備効果を適用
      yield* applyEquipmentEffects(playerId)

      // イベント発行
      yield* eventBus.publish(new ItemEquippedEvent({
        playerId,
        itemStack,
        slot,
        previousItem,
        timestamp: new Date()
      }))

      return {
        success: true,
        equippedItem: itemStack,
        previousItem,
        slot
      } as EquipmentResult
    })

  const unequipItem = (playerId: PlayerId, slot: EquipmentSlot) =>
    Effect.gen(function* () {
      const inventory = yield* playerInventory.getPlayerInventory(playerId)
      const equipmentSlot = getEquipmentSlotFromInventory(inventory, slot)

      if (!equipmentSlot.itemStack) return null

      const unequippedItem = equipmentSlot.itemStack
      equipmentSlot.itemStack = undefined
      equipmentSlot.lastModified = new Date()

      // 装備効果を再計算
      yield* applyEquipmentEffects(playerId)

      yield* eventBus.publish(new ItemUnequippedEvent({
        playerId,
        itemStack: unequippedItem,
        slot,
        timestamp: new Date()
      }))

      return unequippedItem
    })

  const getEquippedItems = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const inventory = yield* playerInventory.getPlayerInventory(playerId)

      return {
        helmet: inventory.armorSlots[0].itemStack || null,
        chestplate: inventory.armorSlots[1].itemStack || null,
        leggings: inventory.armorSlots[2].itemStack || null,
        boots: inventory.armorSlots[3].itemStack || null,
        mainHand: yield* playerInventory.getSelectedItem(playerId),
        offHand: inventory.offhandSlot.itemStack || null
      } as EquippedItems
    })

  const canEquipInSlot = (itemStack: ItemStack, slot: EquipmentSlot) =>
    Effect.gen(function* () {
      const itemInfo = yield* itemManager.getItemInfo(itemStack.itemId)

      switch (slot) {
        case "helmet":
          return itemInfo.category === "helmet" || itemInfo.category === "head_armor"
        case "chestplate":
          return itemInfo.category === "chestplate" || itemInfo.category === "chest_armor"
        case "leggings":
          return itemInfo.category === "leggings" || itemInfo.category === "leg_armor"
        case "boots":
          return itemInfo.category === "boots" || itemInfo.category === "foot_armor"
        case "mainHand":
          return itemInfo.isTool || itemInfo.category === "weapon" || itemInfo.isBlock
        case "offHand":
          return itemInfo.category === "shield" || itemInfo.category === "arrow" ||
                 itemInfo.category === "totem" || itemInfo.isBlock
        default:
          return false
      }
    })

  const calculateEquipmentStats = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const equipped = yield* getEquippedItems(playerId)
      let stats: EquipmentStats = {
        armorPoints: 0,
        armorToughness: 0,
        attackDamage: 1, // 基本攻撃力
        attackSpeed: 4, // 基本攻撃速度
        knockbackResistance: 0,
        enchantments: [],
        durabilityWarnings: []
      }

      const items = [
        equipped.helmet,
        equipped.chestplate,
        equipped.leggings,
        equipped.boots,
        equipped.mainHand,
        equipped.offHand
      ].filter(Boolean)

      for (const item of items) {
        if (!item) continue

        const itemInfo = yield* itemManager.getItemInfo(item.itemId)

        // 防具値計算
        if (itemInfo.metadata?.armorPoints) {
          stats.armorPoints += itemInfo.metadata.armorPoints
        }
        if (itemInfo.metadata?.armorToughness) {
          stats.armorToughness += itemInfo.metadata.armorToughness
        }

        // 攻撃力・速度計算
        if (itemInfo.metadata?.attackDamage) {
          stats.attackDamage = itemInfo.metadata.attackDamage
        }
        if (itemInfo.metadata?.attackSpeed) {
          stats.attackSpeed = itemInfo.metadata.attackSpeed
        }

        // ノックバック耐性
        if (itemInfo.metadata?.knockbackResistance) {
          stats.knockbackResistance = Math.min(1, stats.knockbackResistance + itemInfo.metadata.knockbackResistance)
        }

        // エンチャント効果
        if (item.enchantments) {
          for (const enchantment of item.enchantments) {
            const existingEnchant = stats.enchantments.find(e => e.enchantmentId === enchantment.enchantmentId)
            if (existingEnchant) {
              existingEnchant.level = Math.max(existingEnchant.level, enchantment.level)
            } else {
              stats.enchantments.push({ ...enchantment })
            }
          }
        }

        // 耐久度警告
        if (itemInfo.hasDurability && item.durability !== undefined) {
          const durabilityPercent = (item.durability / (itemInfo.maxDurability || 1)) * 100
          if (durabilityPercent < 10) {
            stats.durabilityWarnings.push({
              itemId: item.itemId,
              durability: item.durability,
              maxDurability: itemInfo.maxDurability || 1
            })
          }
        }
      }

      return stats
    })

  const applyEquipmentEffects = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const stats = yield* calculateEquipmentStats(playerId)

      // プレイヤーの能力値を更新
      yield* eventBus.publish(new PlayerStatsUpdateEvent({
        playerId,
        stats,
        timestamp: new Date()
      }))

      // セット効果の処理
      yield* processArmorSetBonuses(playerId, stats)

      // エンチャント効果の適用
      yield* processEnchantmentEffects(playerId, stats.enchantments)
    })

  const processArmorSetBonuses = (playerId: PlayerId, stats: EquipmentStats) =>
    Effect.gen(function* () {
      const equipped = yield* getEquippedItems(playerId)
      const armorPieces = [equipped.helmet, equipped.chestplate, equipped.leggings, equipped.boots]
        .filter(Boolean)

      // 同じ素材のセット効果をチェック
      const materialCounts = new Map<string, number>()
      for (const piece of armorPieces) {
        if (!piece) continue
        const itemInfo = yield* itemManager.getItemInfo(piece.itemId)
        const material = itemInfo.metadata?.material || "unknown"
        materialCounts.set(material, (materialCounts.get(material) || 0) + 1)
      }

      // セット効果の適用
      for (const [material, count] of materialCounts.entries()) {
        if (count >= 2) {
          yield* applySetBonus(playerId, material, count)
        }
      }
    })

  const processEnchantmentEffects = (playerId: PlayerId, enchantments: Array<{ enchantmentId: string, level: number }>) =>
    Effect.gen(function* () {
      for (const enchant of enchantments) {
        switch (enchant.enchantmentId) {
          case "protection":
            yield* applyProtectionEffect(playerId, enchant.level)
            break
          case "fire_protection":
            yield* applyFireProtectionEffect(playerId, enchant.level)
            break
          case "blast_protection":
            yield* applyBlastProtectionEffect(playerId, enchant.level)
            break
          case "projectile_protection":
            yield* applyProjectileProtectionEffect(playerId, enchant.level)
            break
          case "respiration":
            yield* applyRespirationEffect(playerId, enchant.level)
            break
          case "aqua_affinity":
            yield* applyAquaAffinityEffect(playerId)
            break
          case "thorns":
            yield* applyThornsEffect(playerId, enchant.level)
            break
          case "depth_strider":
            yield* applyDepthStriderEffect(playerId, enchant.level)
            break
          case "frost_walker":
            yield* applyFrostWalkerEffect(playerId, enchant.level)
            break
          case "soul_speed":
            yield* applySoulSpeedEffect(playerId, enchant.level)
            break
        }
      }
    })

  const getEquipmentSlotFromInventory = (inventory: PlayerInventory, slot: EquipmentSlot): InventorySlot => {
    switch (slot) {
      case "helmet": return inventory.armorSlots[0]
      case "chestplate": return inventory.armorSlots[1]
      case "leggings": return inventory.armorSlots[2]
      case "boots": return inventory.armorSlots[3]
      case "offHand": return inventory.offhandSlot
      default: throw new Error(`Invalid equipment slot: ${slot}`)
    }
  }

  return EquipmentManager.of({
    equipItem,
    unequipItem,
    getEquippedItems,
    canEquipInSlot,
    calculateEquipmentStats,
    applyEquipmentEffects
  })
})

// Live Layer
export const EquipmentManagerLive = Layer.effect(
  EquipmentManager,
  makeEquipmentManager
).pipe(
  Layer.provide(PlayerInventoryManagerLive),
  Layer.provide(ItemManagerLive),
  Layer.provide(EventBusLive)
)

// 型定義
type EquipmentSlot = "helmet" | "chestplate" | "leggings" | "boots" | "mainHand" | "offHand"

interface EquippedItems {
  readonly helmet: ItemStack | null
  readonly chestplate: ItemStack | null
  readonly leggings: ItemStack | null
  readonly boots: ItemStack | null
  readonly mainHand: ItemStack | null
  readonly offHand: ItemStack | null
}

interface EquipmentStats {
  readonly armorPoints: number
  readonly armorToughness: number
  readonly attackDamage: number
  readonly attackSpeed: number
  readonly knockbackResistance: number
  readonly enchantments: Array<{ enchantmentId: string, level: number }>
  readonly durabilityWarnings: Array<{ itemId: ItemId, durability: number, maxDurability: number }>
}

interface EquipmentResult {
  readonly success: boolean
  readonly equippedItem: ItemStack
  readonly previousItem: ItemStack | null
  readonly slot: EquipmentSlot
}

class EquipmentError {
  readonly _tag = "EquipmentError"
  constructor(public readonly message: string) {}
}

class ItemEquippedEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      itemStack: ItemStack
      slot: EquipmentSlot
      previousItem: ItemStack | null
      timestamp: Date
    }
  ) {}
}

class ItemUnequippedEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      itemStack: ItemStack
      slot: EquipmentSlot
      timestamp: Date
    }
  ) {}
}

class PlayerStatsUpdateEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      stats: EquipmentStats
      timestamp: Date
    }
  ) {}
}
```

## ネットワーク同期システム

### Inventory Synchronization Manager

```typescript
// InventorySyncManagerサービスインターフェース
interface InventorySyncManagerInterface {
  readonly syncFullInventory: (playerId: PlayerId) => Effect.Effect<void, SyncError>
  readonly syncInventorySlot: (playerId: PlayerId, slotIndex: SlotIndex, slotType: SlotType) => Effect.Effect<void, SyncError>
  readonly handleClientInventoryAction: (playerId: PlayerId, action: ClientInventoryAction) => Effect.Effect<SyncResult, SyncError>
  readonly validateInventoryState: (playerId: PlayerId, clientChecksum: string) => Effect.Effect<boolean, never>
  readonly generateInventoryChecksum: (inventory: PlayerInventory) => Effect.Effect<string, never>
  readonly batchSyncUpdates: (playerId: PlayerId) => Effect.Effect<void, never>
}

// Context Tag
export const InventorySyncManager = Context.GenericTag<InventorySyncManagerInterface>("InventorySyncManager")

// Live実装の作成関数
const makeInventorySyncManager = Effect.gen(function* () {
  const playerInventory = yield* PlayerInventoryManager
  const networkService = yield* NetworkService
  const eventBus = yield* EventBus

  // 同期待機キュー
  const syncQueue = yield* Effect.sync(() => new Map<PlayerId, SyncQueueItem[]>())
  const syncBatchSize = 10
  const syncInterval = 50 // 50ms

  const syncFullInventory = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const inventory = yield* playerInventory.getPlayerInventory(playerId)
      const checksum = yield* generateInventoryChecksum(inventory)

      const syncData: FullInventorySync = {
        type: "full_inventory_sync",
        playerId,
        inventory: {
          slots: inventory.slots.map(serializeSlot),
          hotbarSlots: inventory.hotbarSlots.map(serializeSlot),
          armorSlots: inventory.armorSlots.map(serializeSlot),
          offhandSlot: serializeSlot(inventory.offhandSlot),
          selectedHotbarIndex: inventory.selectedHotbarIndex,
          totalWeight: inventory.totalWeight,
          maxWeight: inventory.maxWeight
        },
        checksum,
        timestamp: Date.now()
      }

      yield* networkService.sendToPlayer(playerId, syncData)

      yield* eventBus.publish(new InventorySyncEvent({
        playerId,
        syncType: "full",
        timestamp: new Date()
      }))
    })

  const syncInventorySlot = (playerId: PlayerId, slotIndex: SlotIndex, slotType: SlotType) =>
    Effect.gen(function* () {
      const inventory = yield* playerInventory.getPlayerInventory(playerId)
      const slot = getSlotFromInventory(inventory, slotIndex, slotType)

      const syncData: SlotSync = {
        type: "slot_sync",
        playerId,
        slotIndex,
        slotType,
        slot: serializeSlot(slot),
        timestamp: Date.now()
      }

      yield* networkService.sendToPlayer(playerId, syncData)
      yield* addToSyncQueue(playerId, syncData)
    })

  const handleClientInventoryAction = (playerId: PlayerId, action: ClientInventoryAction) =>
    Effect.gen(function* () {
      // クライアント側のアクションを検証
      const validationResult = yield* validateClientAction(playerId, action)
      if (!validationResult.isValid) {
        // 無効なアクションの場合、サーバー状態で上書き
        yield* syncFullInventory(playerId)
        return {
          success: false,
          reason: validationResult.reason,
          requiresFullSync: true
        } as SyncResult
      }

      // サーバー側でアクションを実行
      const serverResult = yield* executeServerAction(playerId, action)
      if (!serverResult.success) {
        yield* syncFullInventory(playerId)
        return {
          success: false,
          reason: serverResult.error,
          requiresFullSync: true
        } as SyncResult
      }

      // 変更されたスロットを同期
      for (const changedSlot of serverResult.changedSlots) {
        yield* syncInventorySlot(playerId, changedSlot.index, changedSlot.type)
      }

      return {
        success: true,
        changedSlots: serverResult.changedSlots
      } as SyncResult
    })

  const validateInventoryState = (playerId: PlayerId, clientChecksum: string) =>
    Effect.gen(function* () {
      const inventory = yield* playerInventory.getPlayerInventory(playerId)
      const serverChecksum = yield* generateInventoryChecksum(inventory)
      return serverChecksum === clientChecksum
    })

  const generateInventoryChecksum = (inventory: PlayerInventory) =>
    Effect.gen(function* () {
      const allSlots = [
        ...inventory.slots,
        ...inventory.hotbarSlots,
        ...inventory.armorSlots,
        inventory.offhandSlot
      ]

      const slotHashes = allSlots.map(slot => {
        if (!slot.itemStack) return "empty"
        return `${slot.itemStack.itemId}:${slot.itemStack.count}:${slot.itemStack.durability || 0}`
      })

      const combinedString = slotHashes.join("|") + `|${inventory.selectedHotbarIndex}`
      return yield* Effect.sync(() => calculateHash(combinedString))
    })

  const batchSyncUpdates = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const queue = syncQueue.get(playerId) || []
      if (queue.length === 0) return

      // バッチサイズでグループ化
      const batches = []
      for (let i = 0; i < queue.length; i += syncBatchSize) {
        batches.push(queue.slice(i, i + syncBatchSize))
      }

      for (const batch of batches) {
        const batchSync: BatchSync = {
          type: "batch_sync",
          playerId,
          updates: batch,
          timestamp: Date.now()
        }

        yield* networkService.sendToPlayer(playerId, batchSync)
        yield* Effect.sleep(syncInterval) // レート制限
      }

      // キューをクリア
      syncQueue.set(playerId, [])
    })

  const validateClientAction = (playerId: PlayerId, action: ClientInventoryAction) =>
    Effect.gen(function* () {
      const inventory = yield* playerInventory.getPlayerInventory(playerId)

      switch (action.type) {
        case "move_item":
          return yield* validateMoveAction(inventory, action)
        case "split_stack":
          return yield* validateSplitAction(inventory, action)
        case "merge_stacks":
          return yield* validateMergeAction(inventory, action)
        case "drop_item":
          return yield* validateDropAction(inventory, action)
        default:
          return { isValid: false, reason: "Unknown action type" }
      }
    })

  const validateMoveAction = (inventory: PlayerInventory, action: ClientInventoryAction) =>
    Effect.gen(function* () {
      if (action.sourceSlot === undefined || action.targetSlot === undefined) {
        return { isValid: false, reason: "Missing slot indices" }
      }

      const sourceSlot = getSlotFromInventory(inventory, action.sourceSlot, action.sourceSlotType!)
      const targetSlot = getSlotFromInventory(inventory, action.targetSlot, action.targetSlotType!)

      if (!sourceSlot.itemStack) {
        return { isValid: false, reason: "Source slot is empty" }
      }

      if (sourceSlot.isLocked || targetSlot.isLocked) {
        return { isValid: false, reason: "Slot is locked" }
      }

      return { isValid: true }
    })

  const executeServerAction = (playerId: PlayerId, action: ClientInventoryAction) =>
    Effect.gen(function* () {
      const changedSlots: Array<{ index: SlotIndex, type: SlotType }> = []

      switch (action.type) {
        case "move_item":
          yield* playerInventory.moveItem(playerId, action.sourceSlot!, action.targetSlot!)
          changedSlots.push(
            { index: action.sourceSlot!, type: action.sourceSlotType! },
            { index: action.targetSlot!, type: action.targetSlotType! }
          )
          break

        case "drop_item":
          const hotbarManager = yield* HotbarManager
          yield* hotbarManager.dropSelectedItem(playerId, action.count)
          const inventory = yield* playerInventory.getPlayerInventory(playerId)
          changedSlots.push({
            index: inventory.selectedHotbarIndex,
            type: "hotbar"
          })
          break

        // 他のアクションタイプも同様に実装
      }

      return {
        success: true,
        changedSlots
      }
    })

  const addToSyncQueue = (playerId: PlayerId, syncItem: SyncQueueItem) =>
    Effect.gen(function* () {
      const queue = syncQueue.get(playerId) || []
      queue.push(syncItem)
      syncQueue.set(playerId, queue)

      // キューが一定サイズに達したら即座にバッチ送信
      if (queue.length >= syncBatchSize) {
        yield* batchSyncUpdates(playerId)
      }
    })

  const serializeSlot = (slot: InventorySlot): SerializedSlot => ({
    index: slot.index,
    itemStack: slot.itemStack ? {
      itemId: slot.itemStack.itemId,
      count: slot.itemStack.count,
      durability: slot.itemStack.durability,
      enchantments: slot.itemStack.enchantments,
      metadata: slot.itemStack.metadata,
      nbt: slot.itemStack.nbt
    } : null,
    isLocked: slot.isLocked,
    restrictions: slot.restrictions,
    lastModified: slot.lastModified.getTime()
  })

  const getSlotFromInventory = (inventory: PlayerInventory, index: SlotIndex, type: SlotType): InventorySlot => {
    switch (type) {
      case "inventory": return inventory.slots[index]
      case "hotbar": return inventory.hotbarSlots[index]
      case "armor": return inventory.armorSlots[index]
      case "offhand": return inventory.offhandSlot
      default: throw new Error(`Invalid slot type: ${type}`)
    }
  }

  const calculateHash = (input: string): string => {
    // 簡単なハッシュ関数（実際の実装ではcryptoライブラリを使用）
    let hash = 0
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 32bit整数に変換
    }
    return Math.abs(hash).toString(36)
  }

  // 定期的なバッチ同期の開始
  const startPeriodicSync = Effect.gen(function* () {
    yield* Effect.forever(
      Effect.gen(function* () {
        yield* Effect.sleep(syncInterval * 2)
        for (const playerId of syncQueue.keys()) {
          yield* batchSyncUpdates(playerId)
        }
      })
    )
  }).pipe(Effect.fork)

  yield* startPeriodicSync

  return InventorySyncManager.of({
    syncFullInventory,
    syncInventorySlot,
    handleClientInventoryAction,
    validateInventoryState,
    generateInventoryChecksum,
    batchSyncUpdates
  })
})

// Live Layer
export const InventorySyncManagerLive = Layer.effect(
  InventorySyncManager,
  makeInventorySyncManager
).pipe(
  Layer.provide(PlayerInventoryManagerLive),
  Layer.provide(NetworkServiceLive),
  Layer.provide(EventBusLive)
)

// 型定義
type SlotType = "inventory" | "hotbar" | "armor" | "offhand"

interface ClientInventoryAction {
  readonly type: "move_item" | "split_stack" | "merge_stacks" | "drop_item"
  readonly sourceSlot?: SlotIndex
  readonly sourceSlotType?: SlotType
  readonly targetSlot?: SlotIndex
  readonly targetSlotType?: SlotType
  readonly count?: number
  readonly timestamp: number
}

interface SyncResult {
  readonly success: boolean
  readonly reason?: string
  readonly requiresFullSync?: boolean
  readonly changedSlots?: Array<{ index: SlotIndex, type: SlotType }>
}

interface SerializedSlot {
  readonly index: number
  readonly itemStack: SerializedItemStack | null
  readonly isLocked: boolean
  readonly restrictions?: ReadonlyArray<string>
  readonly lastModified: number
}

interface SerializedItemStack {
  readonly itemId: ItemId
  readonly count: number
  readonly durability?: number
  readonly enchantments?: ReadonlyArray<{ enchantmentId: string, level: number }>
  readonly metadata?: Record<string, unknown>
  readonly nbt?: Record<string, unknown>
}

interface FullInventorySync {
  readonly type: "full_inventory_sync"
  readonly playerId: PlayerId
  readonly inventory: {
    readonly slots: ReadonlyArray<SerializedSlot>
    readonly hotbarSlots: ReadonlyArray<SerializedSlot>
    readonly armorSlots: ReadonlyArray<SerializedSlot>
    readonly offhandSlot: SerializedSlot
    readonly selectedHotbarIndex: number
    readonly totalWeight: number
    readonly maxWeight: number
  }
  readonly checksum: string
  readonly timestamp: number
}

interface SlotSync {
  readonly type: "slot_sync"
  readonly playerId: PlayerId
  readonly slotIndex: SlotIndex
  readonly slotType: SlotType
  readonly slot: SerializedSlot
  readonly timestamp: number
}

interface BatchSync {
  readonly type: "batch_sync"
  readonly playerId: PlayerId
  readonly updates: ReadonlyArray<SyncQueueItem>
  readonly timestamp: number
}

type SyncQueueItem = SlotSync | { type: "custom", data: unknown }

class SyncError {
  readonly _tag = "SyncError"
  constructor(public readonly message: string) {}
}

class InventorySyncEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      syncType: "full" | "slot" | "batch"
      timestamp: Date
    }
  ) {}
}
```

## UIインタラクション

### Drag and Drop System

```typescript
// DragDropManagerサービスインターフェース
interface DragDropManagerInterface {
  readonly startDrag: (playerId: PlayerId, dragData: DragData) => Effect.Effect<DragSession, DragError>
  readonly updateDrag: (playerId: PlayerId, position: Vector2D) => Effect.Effect<void, DragError>
  readonly endDrag: (playerId: PlayerId, dropTarget: DropTarget) => Effect.Effect<DragResult, DragError>
  readonly cancelDrag: (playerId: PlayerId) => Effect.Effect<void, never>
  readonly getValidDropTargets: (playerId: PlayerId, dragData: DragData) => Effect.Effect<ReadonlyArray<DropTarget>, never>
  readonly previewDrop: (playerId: PlayerId, dragData: DragData, target: DropTarget) => Effect.Effect<DropPreview, never>
}

// Context Tag
export const DragDropManager = Context.GenericTag<DragDropManagerInterface>("DragDropManager")

// Live実装の作成関数
const makeDragDropManager = Effect.gen(function* () {
  const playerInventory = yield* PlayerInventoryManager
  const itemTransfer = yield* ItemTransferManager
  const eventBus = yield* EventBus

  // アクティブなドラッグセッション
  const dragSessions = yield* Effect.sync(() => new Map<PlayerId, DragSession>())

  const startDrag = (playerId: PlayerId, dragData: DragData) =>
    Effect.gen(function* () {
      // 既存のドラッグセッションをキャンセル
      yield* cancelDrag(playerId)

      // ドラッグするアイテムの検証
      const inventory = yield* playerInventory.getPlayerInventory(playerId)
      const sourceSlot = getSlotFromDragData(inventory, dragData)

      if (!sourceSlot.itemStack) {
        return yield* Effect.fail(new DragError("No item to drag"))
      }

      if (sourceSlot.isLocked) {
        return yield* Effect.fail(new DragError("Slot is locked"))
      }

      const dragSession: DragSession = {
        playerId,
        dragData,
        startTime: new Date(),
        currentPosition: dragData.startPosition,
        originalItem: sourceSlot.itemStack,
        draggedAmount: dragData.count || sourceSlot.itemStack.count,
        validDropTargets: yield* getValidDropTargets(playerId, dragData)
      }

      dragSessions.set(playerId, dragSession)

      yield* eventBus.publish(new DragStartEvent({
        playerId,
        dragData,
        timestamp: new Date()
      }))

      return dragSession
    })

  const updateDrag = (playerId: PlayerId, position: Vector2D) =>
    Effect.gen(function* () {
      const session = dragSessions.get(playerId)
      if (!session) {
        return yield* Effect.fail(new DragError("No active drag session"))
      }

      const updatedSession = {
        ...session,
        currentPosition: position
      }

      dragSessions.set(playerId, updatedSession)

      yield* eventBus.publish(new DragUpdateEvent({
        playerId,
        position,
        timestamp: new Date()
      }))
    })

  const endDrag = (playerId: PlayerId, dropTarget: DropTarget) =>
    Effect.gen(function* () {
      const session = dragSessions.get(playerId)
      if (!session) {
        return yield* Effect.fail(new DragError("No active drag session"))
      }

      // ドロップターゲットの検証
      const isValidTarget = session.validDropTargets.some(target =>
        target.type === dropTarget.type &&
        target.slotIndex === dropTarget.slotIndex &&
        target.containerId === dropTarget.containerId
      )

      if (!isValidTarget) {
        yield* cancelDrag(playerId)
        return yield* Effect.fail(new DragError("Invalid drop target"))
      }

      // アイテム転送の実行
      const transferResult = yield* executeTransferFromDrag(session, dropTarget)

      // ドラッグセッションを終了
      dragSessions.delete(playerId)

      yield* eventBus.publish(new DragEndEvent({
        playerId,
        dropTarget,
        transferResult,
        timestamp: new Date()
      }))

      return transferResult
    })

  const cancelDrag = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const session = dragSessions.get(playerId)
      if (session) {
        dragSessions.delete(playerId)

        yield* eventBus.publish(new DragCancelEvent({
          playerId,
          timestamp: new Date()
        }))
      }
    })

  const getValidDropTargets = (playerId: PlayerId, dragData: DragData) =>
    Effect.gen(function* () {
      const inventory = yield* playerInventory.getPlayerInventory(playerId)
      const sourceSlot = getSlotFromDragData(inventory, dragData)
      const dropTargets: DropTarget[] = []

      if (!sourceSlot.itemStack) return dropTargets

      // インベントリスロット
      for (let i = 0; i < inventory.slots.length; i++) {
        const slot = inventory.slots[i]
        const isValid = yield* isValidDropTarget(sourceSlot.itemStack, slot, "inventory", i)
        if (isValid) {
          dropTargets.push({
            type: "inventory",
            slotIndex: i,
            canStack: slot.itemStack ? yield* canStackItems(sourceSlot.itemStack, slot.itemStack) : false,
            canSwap: !slot.itemStack || slot.itemStack.itemId !== sourceSlot.itemStack.itemId
          })
        }
      }

      // ホットバースロット
      for (let i = 0; i < inventory.hotbarSlots.length; i++) {
        const slot = inventory.hotbarSlots[i]
        const isValid = yield* isValidDropTarget(sourceSlot.itemStack, slot, "hotbar", i)
        if (isValid) {
          dropTargets.push({
            type: "hotbar",
            slotIndex: i,
            canStack: slot.itemStack ? yield* canStackItems(sourceSlot.itemStack, slot.itemStack) : false,
            canSwap: !slot.itemStack || slot.itemStack.itemId !== sourceSlot.itemStack.itemId
          })
        }
      }

      // アーマースロット
      for (let i = 0; i < inventory.armorSlots.length; i++) {
        const slot = inventory.armorSlots[i]
        const isValid = yield* isValidDropTarget(sourceSlot.itemStack, slot, "armor", i)
        if (isValid) {
          dropTargets.push({
            type: "armor",
            slotIndex: i,
            canStack: false, // アーマーはスタックしない
            canSwap: true
          })
        }
      }

      // ワールドドロップ
      dropTargets.push({
        type: "world",
        canStack: false,
        canSwap: false
      })

      return dropTargets
    })

  const previewDrop = (playerId: PlayerId, dragData: DragData, target: DropTarget) =>
    Effect.gen(function* () {
      const inventory = yield* playerInventory.getPlayerInventory(playerId)
      const sourceSlot = getSlotFromDragData(inventory, dragData)

      if (!sourceSlot.itemStack) {
        return {
          canDrop: false,
          reason: "No item to drop"
        } as DropPreview
      }

      switch (target.type) {
        case "inventory":
        case "hotbar":
        case "armor":
          const targetSlot = getSlotFromInventoryByType(inventory, target.type, target.slotIndex!)
          return yield* previewSlotDrop(sourceSlot.itemStack, targetSlot, dragData.count)

        case "world":
          return {
            canDrop: true,
            action: "drop",
            preview: `Drop ${dragData.count || sourceSlot.itemStack.count} ${sourceSlot.itemStack.itemId}`
          } as DropPreview

        case "container":
          // コンテナのドロップ処理は省略
          return {
            canDrop: true,
            action: "transfer"
          } as DropPreview

        default:
          return {
            canDrop: false,
            reason: "Invalid drop target"
          } as DropPreview
      }
    })

  const previewSlotDrop = (sourceItem: ItemStack, targetSlot: InventorySlot, dragCount?: number) =>
    Effect.gen(function* () {
      const actualDragCount = dragCount || sourceItem.count

      if (targetSlot.isLocked) {
        return {
          canDrop: false,
          reason: "Slot is locked"
        } as DropPreview
      }

      if (!targetSlot.itemStack) {
        return {
          canDrop: true,
          action: "move",
          preview: `Move ${actualDragCount} ${sourceItem.itemId}`
        } as DropPreview
      }

      const canStack = yield* canStackItems(sourceItem, targetSlot.itemStack)
      if (canStack) {
        const itemManager = yield* ItemManager
        const itemInfo = yield* itemManager.getItemInfo(sourceItem.itemId)
        const availableSpace = itemInfo.maxStackSize - targetSlot.itemStack.count
        const stackAmount = Math.min(actualDragCount, availableSpace)

        return {
          canDrop: stackAmount > 0,
          action: stackAmount === actualDragCount ? "stack" : "partial_stack",
          preview: `Stack ${stackAmount} ${sourceItem.itemId}`,
          stackAmount
        } as DropPreview
      }

      return {
        canDrop: true,
        action: "swap",
        preview: `Swap ${sourceItem.itemId} with ${targetSlot.itemStack.itemId}`
      } as DropPreview
    })

  const executeTransferFromDrag = (session: DragSession, dropTarget: DropTarget) =>
    Effect.gen(function* () {
      const { dragData } = session

      switch (dropTarget.type) {
        case "inventory":
        case "hotbar":
        case "armor":
          return yield* itemTransfer.transferItem({
            sourceType: dragData.sourceType,
            sourceId: dragData.sourceId,
            sourceSlot: dragData.sourceSlot,
            targetType: "player",
            targetId: session.playerId,
            targetSlot: dropTarget.slotIndex,
            count: dragData.count,
            transferType: dropTarget.canStack ? "merge" : "swap"
          })

        case "world":
          const hotbarManager = yield* HotbarManager
          const dropped = yield* hotbarManager.dropSelectedItem(session.playerId, dragData.count)
          return {
            success: dropped !== null,
            transferredCount: dragData.count || session.originalItem.count
          } as DragResult

        default:
          return yield* Effect.fail(new DragError("Unsupported drop target"))
      }
    })

  const isValidDropTarget = (item: ItemStack, slot: InventorySlot, slotType: string, slotIndex: number) =>
    Effect.gen(function* () {
      if (slot.isLocked) return false

      // スロット制限チェック
      if (slot.restrictions && slot.restrictions.length > 0) {
        const itemManager = yield* ItemManager
        const itemInfo = yield* itemManager.getItemInfo(item.itemId)
        return slot.restrictions.includes(itemInfo.category)
      }

      // アーマースロットの特別処理
      if (slotType === "armor") {
        const equipmentManager = yield* EquipmentManager
        const equipmentSlots = ["helmet", "chestplate", "leggings", "boots"] as const
        return yield* equipmentManager.canEquipInSlot(item, equipmentSlots[slotIndex])
      }

      return true
    })

  const canStackItems = (item1: ItemStack, item2: ItemStack) =>
    Effect.gen(function* () {
      const stackingManager = yield* StackingManager
      return yield* stackingManager.canStack(item1, item2)
    })

  const getSlotFromDragData = (inventory: PlayerInventory, dragData: DragData): InventorySlot => {
    return getSlotFromInventoryByType(inventory, dragData.sourceSlotType, dragData.sourceSlot)
  }

  const getSlotFromInventoryByType = (inventory: PlayerInventory, slotType: string, slotIndex: number): InventorySlot => {
    switch (slotType) {
      case "inventory": return inventory.slots[slotIndex]
      case "hotbar": return inventory.hotbarSlots[slotIndex]
      case "armor": return inventory.armorSlots[slotIndex]
      case "offhand": return inventory.offhandSlot
      default: throw new Error(`Invalid slot type: ${slotType}`)
    }
  }

  return DragDropManager.of({
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    getValidDropTargets,
    previewDrop
  })
})

// Live Layer
export const DragDropManagerLive = Layer.effect(
  DragDropManager,
  makeDragDropManager
).pipe(
  Layer.provide(PlayerInventoryManagerLive),
  Layer.provide(ItemTransferManagerLive),
  Layer.provide(StackingManagerLive),
  Layer.provide(EquipmentManagerLive),
  Layer.provide(HotbarManagerLive),
  Layer.provide(EventBusLive)
)

// 型定義
interface Vector2D {
  readonly x: number
  readonly y: number
}

interface DragData {
  readonly sourceType: "player" | "container"
  readonly sourceId: string
  readonly sourceSlot: number
  readonly sourceSlotType: string
  readonly startPosition: Vector2D
  readonly count?: number
}

interface DragSession {
  readonly playerId: PlayerId
  readonly dragData: DragData
  readonly startTime: Date
  readonly currentPosition: Vector2D
  readonly originalItem: ItemStack
  readonly draggedAmount: number
  readonly validDropTargets: ReadonlyArray<DropTarget>
}

interface DropTarget {
  readonly type: "inventory" | "hotbar" | "armor" | "world" | "container"
  readonly slotIndex?: number
  readonly containerId?: ContainerId
  readonly canStack: boolean
  readonly canSwap: boolean
}

interface DropPreview {
  readonly canDrop: boolean
  readonly reason?: string
  readonly action?: "move" | "stack" | "partial_stack" | "swap" | "drop" | "transfer"
  readonly preview?: string
  readonly stackAmount?: number
}

type DragResult = ItemTransferResult

class DragError {
  readonly _tag = "DragError"
  constructor(public readonly message: string) {}
}

// イベント定義
class DragStartEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      dragData: DragData
      timestamp: Date
    }
  ) {}
}

class DragUpdateEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      position: Vector2D
      timestamp: Date
    }
  ) {}
}

class DragEndEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      dropTarget: DropTarget
      transferResult: DragResult
      timestamp: Date
    }
  ) {}
}

class DragCancelEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      timestamp: Date
    }
  ) {}
}
```

## セキュリティとチート対策

### Anti-Cheat System

```typescript
// AntiCheatManagerサービスインターフェース
interface AntiCheatManagerInterface {
  readonly validateItemAction: (playerId: PlayerId, action: InventoryAction) => Effect.Effect<ValidationResult, never>
  readonly checkInventoryLimits: (playerId: PlayerId) => Effect.Effect<LimitCheckResult, never>
  readonly detectDuplication: (playerId: PlayerId, beforeState: PlayerInventory, afterState: PlayerInventory) => Effect.Effect<DuplicationResult, never>
  readonly validateItemProperties: (itemStack: ItemStack) => Effect.Effect<boolean, never>
  readonly logSuspiciousActivity: (playerId: PlayerId, activity: SuspiciousActivity) => Effect.Effect<void, never>
  readonly enforceRateLimit: (playerId: PlayerId, actionType: string) => Effect.Effect<boolean, never>
}

// Context Tag
export const AntiCheatManager = Context.GenericTag<AntiCheatManagerInterface>("AntiCheatManager")

// Live実装の作成関数
const makeAntiCheatManager = Effect.gen(function* () {
  const playerInventory = yield* PlayerInventoryManager
  const itemManager = yield* ItemManager
  const eventBus = yield* EventBus

  // レート制限トラッキング
  const rateLimits = yield* Effect.sync(() => new Map<PlayerId, Map<string, RateLimitData>>())
  // 不審なアクティビティのログ
  const suspiciousLogs = yield* Effect.sync(() => new Map<PlayerId, SuspiciousActivity[]>())

  const validateItemAction = (playerId: PlayerId, action: InventoryAction) =>
    Effect.gen(function* () {
      const checks: ValidationCheck[] = []

      // レート制限チェック
      const rateLimitPassed = yield* enforceRateLimit(playerId, action.type)
      if (!rateLimitPassed) {
        checks.push({
          type: "rate_limit",
          passed: false,
          reason: "Action rate limit exceeded"
        })
      }

      // インベントリ制限チェック
      const limitCheck = yield* checkInventoryLimits(playerId)
      if (!limitCheck.passed) {
        checks.push({
          type: "inventory_limits",
          passed: false,
          reason: limitCheck.reason
        })
      }

      // アクション固有の検証
      const actionCheck = yield* validateSpecificAction(playerId, action)
      checks.push(actionCheck)

      // 物理法則チェック（距離、時間など）
      const physicsCheck = yield* validatePhysicalConstraints(playerId, action)
      checks.push(physicsCheck)

      const allPassed = checks.every(check => check.passed)
      const failedChecks = checks.filter(check => !check.passed)

      if (!allPassed) {
        yield* logSuspiciousActivity(playerId, {
          type: "invalid_action",
          action,
          failedChecks,
          timestamp: new Date(),
          severity: calculateSeverity(failedChecks)
        })
      }

      return {
        isValid: allPassed,
        checks,
        failedChecks
      } as ValidationResult
    })

  const checkInventoryLimits = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const inventory = yield* playerInventory.getPlayerInventory(playerId)

      // 重量制限チェック
      if (inventory.totalWeight > inventory.maxWeight) {
        return {
          passed: false,
          reason: `Weight limit exceeded: ${inventory.totalWeight}/${inventory.maxWeight}`,
          type: "weight_limit"
        } as LimitCheckResult
      }

      // スロット制限チェック
      const totalSlots = inventory.slots.length + inventory.hotbarSlots.length +
                        inventory.armorSlots.length + 1 // offhand
      const expectedSlots = PLAYER_INVENTORY_SIZE + HOTBAR_SIZE + ARMOR_SLOTS + 1

      if (totalSlots !== expectedSlots) {
        return {
          passed: false,
          reason: `Invalid slot count: ${totalSlots}/${expectedSlots}`,
          type: "slot_count"
        } as LimitCheckResult
      }

      // アイテムカウント制限チェック
      let totalItems = 0
      const allSlots = [...inventory.slots, ...inventory.hotbarSlots,
                       ...inventory.armorSlots, inventory.offhandSlot]

      for (const slot of allSlots) {
        if (slot.itemStack) {
          totalItems += slot.itemStack.count

          // 個別アイテムの最大スタックサイズチェック
          const itemInfo = yield* itemManager.getItemInfo(slot.itemStack.itemId)
          if (slot.itemStack.count > itemInfo.maxStackSize) {
            return {
              passed: false,
              reason: `Stack size exceeded for ${slot.itemStack.itemId}: ${slot.itemStack.count}/${itemInfo.maxStackSize}`,
              type: "stack_size"
            } as LimitCheckResult
          }
        }
      }

      // 合計アイテム数チェック（異常な数のアイテムを持っていないか）
      const maxTotalItems = expectedSlots * 64 // 最大想定アイテム数
      if (totalItems > maxTotalItems) {
        return {
          passed: false,
          reason: `Total item count exceeded: ${totalItems}/${maxTotalItems}`,
          type: "total_items"
        } as LimitCheckResult
      }

      return {
        passed: true,
        type: "all_limits"
      } as LimitCheckResult
    })

  const detectDuplication = (playerId: PlayerId, beforeState: PlayerInventory, afterState: PlayerInventory) =>
    Effect.gen(function* () {
      const beforeItems = yield* countAllItems(beforeState)
      const afterItems = yield* countAllItems(afterState)

      const suspiciousIncreases: Array<{ itemId: ItemId, before: number, after: number, increase: number }> = []

      // アイテム増加の検出
      for (const [itemId, afterCount] of afterItems.entries()) {
        const beforeCount = beforeItems.get(itemId) || 0
        const increase = afterCount - beforeCount

        if (increase > 0) {
          // 正当な増加かどうかをチェック
          const isLegitimate = yield* validateItemIncrease(playerId, itemId, increase)
          if (!isLegitimate) {
            suspiciousIncreases.push({
              itemId,
              before: beforeCount,
              after: afterCount,
              increase
            })
          }
        }
      }

      if (suspiciousIncreases.length > 0) {
        yield* logSuspiciousActivity(playerId, {
          type: "item_duplication",
          suspiciousIncreases,
          timestamp: new Date(),
          severity: "high"
        })
      }

      return {
        detected: suspiciousIncreases.length > 0,
        suspiciousIncreases
      } as DuplicationResult
    })

  const validateItemProperties = (itemStack: ItemStack) =>
    Effect.gen(function* () {
      // アイテムIDの検証
      const itemInfo = yield* itemManager.getItemInfo(itemStack.itemId).pipe(
        Effect.catchAll(() => Effect.succeed(null))
      )

      if (!itemInfo) return false

      // 基本プロパティの検証
      if (itemStack.count <= 0 || itemStack.count > itemInfo.maxStackSize) return false

      // 耐久度の検証
      if (itemInfo.hasDurability) {
        if (itemStack.durability === undefined) return false
        if (itemStack.durability < 0 || itemStack.durability > (itemInfo.maxDurability || 0)) return false
      }

      // エンチャントの検証
      if (itemStack.enchantments) {
        for (const enchant of itemStack.enchantments) {
          // エンチャントレベルの範囲チェック
          if (enchant.level < 1 || enchant.level > getMaxEnchantmentLevel(enchant.enchantmentId)) {
            return false
          }

          // アイテムに適用可能なエンチャントかチェック
          const canApply = yield* canApplyEnchantment(itemInfo, enchant.enchantmentId)
          if (!canApply) return false
        }

        // 競合するエンチャントのチェック
        const hasConflicts = detectEnchantmentConflicts(itemStack.enchantments)
        if (hasConflicts) return false
      }

      // NBTデータの検証（基本的な構造チェック）
      if (itemStack.nbt) {
        const isValidNBT = validateNBTStructure(itemStack.nbt)
        if (!isValidNBT) return false
      }

      return true
    })

  const logSuspiciousActivity = (playerId: PlayerId, activity: SuspiciousActivity) =>
    Effect.gen(function* () {
      const logs = suspiciousLogs.get(playerId) || []
      logs.push(activity)

      // ログの保持期間制限（最大100件）
      if (logs.length > 100) {
        logs.shift()
      }

      suspiciousLogs.set(playerId, logs)

      // 重大度に応じてアクションを実行
      if (activity.severity === "high") {
        yield* eventBus.publish(new HighSeverityCheatDetectedEvent({
          playerId,
          activity,
          timestamp: new Date()
        }))
      }

      yield* eventBus.publish(new SuspiciousActivityEvent({
        playerId,
        activity,
        timestamp: new Date()
      }))
    })

  const enforceRateLimit = (playerId: PlayerId, actionType: string) =>
    Effect.gen(function* () {
      const playerLimits = rateLimits.get(playerId) || new Map()
      const now = Date.now()
      const limitData = playerLimits.get(actionType) || {
        count: 0,
        windowStart: now,
        lastAction: now
      }

      const config = getRateLimitConfig(actionType)
      const windowElapsed = now - limitData.windowStart

      // ウィンドウがリセットされた場合
      if (windowElapsed >= config.windowMs) {
        limitData.count = 1
        limitData.windowStart = now
        limitData.lastAction = now
        playerLimits.set(actionType, limitData)
        rateLimits.set(playerId, playerLimits)
        return true
      }

      // 最小間隔チェック
      if (now - limitData.lastAction < config.minIntervalMs) {
        return false
      }

      // レート制限チェック
      if (limitData.count >= config.maxActions) {
        return false
      }

      // カウント更新
      limitData.count++
      limitData.lastAction = now
      playerLimits.set(actionType, limitData)
      rateLimits.set(playerId, playerLimits)

      return true
    })

  const validateSpecificAction = (playerId: PlayerId, action: InventoryAction) =>
    Effect.gen(function* () {
      switch (action.type) {
        case "move_item":
          return yield* validateMoveAction(playerId, action)
        case "use_item":
          return yield* validateUseAction(playerId, action)
        case "drop_item":
          return yield* validateDropAction(playerId, action)
        default:
          return {
            type: "action_validation",
            passed: true
          } as ValidationCheck
      }
    })

  const validateMoveAction = (playerId: PlayerId, action: InventoryAction) =>
    Effect.gen(function* () {
      if (action.fromSlot === undefined || action.toSlot === undefined) {
        return {
          type: "move_validation",
          passed: false,
          reason: "Missing slot indices"
        } as ValidationCheck
      }

      // スロット範囲チェック
      const maxSlotIndex = PLAYER_INVENTORY_SIZE + HOTBAR_SIZE + ARMOR_SLOTS + 1
      if (action.fromSlot < 0 || action.fromSlot >= maxSlotIndex ||
          action.toSlot < 0 || action.toSlot >= maxSlotIndex) {
        return {
          type: "move_validation",
          passed: false,
          reason: "Invalid slot index"
        } as ValidationCheck
      }

      return {
        type: "move_validation",
        passed: true
      } as ValidationCheck
    })

  const validatePhysicalConstraints = (playerId: PlayerId, action: InventoryAction) =>
    Effect.gen(function* () {
      // 時間制約チェック（アクション間の最小間隔）
      const lastActionTime = getLastActionTime(playerId)
      const now = Date.now()
      const minInterval = getMinActionInterval(action.type)

      if (now - lastActionTime < minInterval) {
        return {
          type: "physics_validation",
          passed: false,
          reason: "Action too frequent"
        } as ValidationCheck
      }

      // 距離制約チェック（コンテナアクセスの場合）
      if (action.type === "open_container" && action.containerId) {
        const container = yield* ContainerManager.pipe(
          Effect.andThen(manager => manager.getContainer(action.containerId!)),
          Effect.catchAll(() => Effect.succeed(null))
        )

        if (container) {
          const playerPosition = yield* getPlayerPosition(playerId)
          const distance = calculateDistance(playerPosition, container.position)
          const maxDistance = getContainerInteractionDistance(container.containerType)

          if (distance > maxDistance) {
            return {
              type: "physics_validation",
              passed: false,
              reason: "Container too far away"
            } as ValidationCheck
          }
        }
      }

      return {
        type: "physics_validation",
        passed: true
      } as ValidationCheck
    })

  // ヘルパー関数
  const countAllItems = (inventory: PlayerInventory) =>
    Effect.gen(function* () {
      const itemCounts = new Map<ItemId, number>()
      const allSlots = [...inventory.slots, ...inventory.hotbarSlots,
                       ...inventory.armorSlots, inventory.offhandSlot]

      for (const slot of allSlots) {
        if (slot.itemStack) {
          const currentCount = itemCounts.get(slot.itemStack.itemId) || 0
          itemCounts.set(slot.itemStack.itemId, currentCount + slot.itemStack.count)
        }
      }

      return itemCounts
    })

  const getRateLimitConfig = (actionType: string): RateLimitConfig => {
    const configs: Record<string, RateLimitConfig> = {
      "move_item": { maxActions: 20, windowMs: 1000, minIntervalMs: 50 },
      "use_item": { maxActions: 10, windowMs: 1000, minIntervalMs: 100 },
      "drop_item": { maxActions: 5, windowMs: 1000, minIntervalMs: 200 },
      "open_container": { maxActions: 3, windowMs: 1000, minIntervalMs: 333 }
    }
    return configs[actionType] || { maxActions: 10, windowMs: 1000, minIntervalMs: 100 }
  }

  const calculateSeverity = (failedChecks: ValidationCheck[]): "low" | "medium" | "high" => {
    if (failedChecks.some(check => check.type === "inventory_limits" || check.type === "physics_validation")) {
      return "high"
    }
    if (failedChecks.length > 2) {
      return "medium"
    }
    return "low"
  }

  return AntiCheatManager.of({
    validateItemAction,
    checkInventoryLimits,
    detectDuplication,
    validateItemProperties,
    logSuspiciousActivity,
    enforceRateLimit
  })
})

// Live Layer
export const AntiCheatManagerLive = Layer.effect(
  AntiCheatManager,
  makeAntiCheatManager
).pipe(
  Layer.provide(PlayerInventoryManagerLive),
  Layer.provide(ItemManagerLive),
  Layer.provide(EventBusLive)
)

// 型定義
interface ValidationResult {
  readonly isValid: boolean
  readonly checks: ReadonlyArray<ValidationCheck>
  readonly failedChecks: ReadonlyArray<ValidationCheck>
}

interface ValidationCheck {
  readonly type: string
  readonly passed: boolean
  readonly reason?: string
}

interface LimitCheckResult {
  readonly passed: boolean
  readonly reason?: string
  readonly type: string
}

interface DuplicationResult {
  readonly detected: boolean
  readonly suspiciousIncreases: ReadonlyArray<{
    itemId: ItemId
    before: number
    after: number
    increase: number
  }>
}

interface SuspiciousActivity {
  readonly type: string
  readonly timestamp: Date
  readonly severity: "low" | "medium" | "high"
  readonly [key: string]: unknown
}

interface RateLimitData {
  count: number
  windowStart: number
  lastAction: number
}

interface RateLimitConfig {
  readonly maxActions: number
  readonly windowMs: number
  readonly minIntervalMs: number
}

class HighSeverityCheatDetectedEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      activity: SuspiciousActivity
      timestamp: Date
    }
  ) {}
}

class SuspiciousActivityEvent {
  constructor(
    public readonly data: {
      playerId: PlayerId
      activity: SuspiciousActivity
      timestamp: Date
    }
  ) {}
}
```

## パフォーマンス最適化

### Performance Optimization Strategies

```typescript
// PerformanceManagerサービスインターフェース
interface PerformanceManagerInterface {
  readonly optimizeInventoryOperations: (playerId: PlayerId) => Effect.Effect<OptimizationResult, never>
  readonly batchInventoryUpdates: (updates: ReadonlyArray<InventoryUpdate>) => Effect.Effect<void, never>
  readonly cacheInventoryState: (playerId: PlayerId) => Effect.Effect<void, never>
  readonly preloadInventoryData: (playerIds: ReadonlyArray<PlayerId>) => Effect.Effect<void, never>
  readonly compressInventoryData: (inventory: PlayerInventory) => Effect.Effect<CompressedInventory, never>
  readonly monitorPerformanceMetrics: () => Effect.Effect<PerformanceMetrics, never>
}

// Context Tag
export const PerformanceManager = Context.GenericTag<PerformanceManagerInterface>("PerformanceManager")

// Live実装の作成関数
const makePerformanceManager = Effect.gen(function* () {
  const playerInventory = yield* PlayerInventoryManager

  // キャッシュストレージ
  const inventoryCache = yield* Effect.sync(() => new Map<PlayerId, CachedInventory>())
  const updateQueue = yield* Effect.sync(() => new Map<PlayerId, InventoryUpdate[]>())

  // パフォーマンスメトリクス
  const metrics = yield* Effect.sync(() => ({
    cacheHitRate: 0,
    totalRequests: 0,
    cacheHits: 0,
    averageResponseTime: 0,
    batchUpdateCount: 0,
    compressionRatio: 0
  }))

  const optimizeInventoryOperations = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const startTime = Date.now()

      // 重複するアイテムスタックの統合
      const inventory = yield* playerInventory.getPlayerInventory(playerId)
      const stackingManager = yield* StackingManager
      const optimizedInventory = yield* stackingManager.optimizeInventory(inventory)

      // 空きスロットの整理
      const compactedInventory = yield* compactInventorySlots(optimizedInventory)

      // メタデータのクリーンアップ
      const cleanedInventory = yield* cleanupInventoryMetadata(compactedInventory)

      const endTime = Date.now()
      const operationTime = endTime - startTime

      return {
        success: true,
        operationTime,
        stacksOptimized: inventory.slots.length - cleanedInventory.slots.filter(s => s.itemStack).length,
        spaceFreed: calculateSpaceFreed(inventory, cleanedInventory)
      } as OptimizationResult
    })

  const batchInventoryUpdates = (updates: ReadonlyArray<InventoryUpdate>) =>
    Effect.gen(function* () {
      // プレイヤー別にグループ化
      const groupedUpdates = new Map<PlayerId, InventoryUpdate[]>()
      for (const update of updates) {
        const playerUpdates = groupedUpdates.get(update.playerId) || []
        playerUpdates.push(update)
        groupedUpdates.set(update.playerId, playerUpdates)
      }

      // バッチ処理実行
      const batchPromises = Array.from(groupedUpdates.entries()).map(([playerId, playerUpdates]) =>
        processBatchUpdatesForPlayer(playerId, playerUpdates)
      )

      yield* Effect.all(batchPromises, { concurrency: 5 })

      // メトリクス更新
      metrics.batchUpdateCount += updates.length
    })

  const cacheInventoryState = (playerId: PlayerId) =>
    Effect.gen(function* () {
      const inventory = yield* playerInventory.getPlayerInventory(playerId)
      const compressed = yield* compressInventoryData(inventory)

      const cacheEntry: CachedInventory = {
        playerId,
        inventory,
        compressed,
        lastAccessed: Date.now(),
        accessCount: 0
      }

      inventoryCache.set(playerId, cacheEntry)

      // LRU キャッシュの実装（最大1000エントリ）
      if (inventoryCache.size > 1000) {
        const oldestEntry = Array.from(inventoryCache.entries())
          .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed)[0]
        inventoryCache.delete(oldestEntry[0])
      }
    })

  const preloadInventoryData = (playerIds: ReadonlyArray<PlayerId>) =>
    Effect.gen(function* () {
      const preloadPromises = playerIds.map(playerId =>
        Effect.gen(function* () {
          // すでにキャッシュされていない場合のみ読み込み
          if (!inventoryCache.has(playerId)) {
            yield* cacheInventoryState(playerId)
          }
        }).pipe(
          Effect.catchAll(() => Effect.void) // エラーは無視
        )
      )

      yield* Effect.all(preloadPromises, { concurrency: 10 })
    })

  const compressInventoryData = (inventory: PlayerInventory) =>
    Effect.gen(function* () {
      // アイテムスタックの圧縮
      const compressedSlots = inventory.slots.map(compressSlot)
      const compressedHotbar = inventory.hotbarSlots.map(compressSlot)
      const compressedArmor = inventory.armorSlots.map(compressSlot)
      const compressedOffhand = compressSlot(inventory.offhandSlot)

      const compressed: CompressedInventory = {
        playerId: inventory.playerId,
        slots: compressedSlots,
        hotbarSlots: compressedHotbar,
        armorSlots: compressedArmor,
        offhandSlot: compressedOffhand,
        selectedHotbarIndex: inventory.selectedHotbarIndex,
        totalWeight: inventory.totalWeight,
        maxWeight: inventory.maxWeight,
        checksum: yield* generateInventoryChecksum(inventory)
      }

      // 圧縮率の計算
      const originalSize = JSON.stringify(inventory).length
      const compressedSize = JSON.stringify(compressed).length
      metrics.compressionRatio = compressedSize / originalSize

      return compressed
    })

  const monitorPerformanceMetrics = () =>
    Effect.gen(function* () {
      // キャッシュヒット率の計算
      if (metrics.totalRequests > 0) {
        metrics.cacheHitRate = metrics.cacheHits / metrics.totalRequests
      }

      // メモリ使用量の監視
      const memoryUsage = {
        cacheSize: inventoryCache.size,
        queueSize: Array.from(updateQueue.values()).reduce((sum, queue) => sum + queue.length, 0)
      }

      return {
        ...metrics,
        memoryUsage,
        timestamp: Date.now()
      } as PerformanceMetrics
    })

  // ヘルパー関数
  const compactInventorySlots = (inventory: PlayerInventory) =>
    Effect.gen(function* () {
      // 空きスロットを後ろに移動
      const nonEmptySlots = inventory.slots.filter(slot => slot.itemStack)
      const emptySlots = inventory.slots.filter(slot => !slot.itemStack)

      const compactedSlots = [
        ...nonEmptySlots.map((slot, index) => ({ ...slot, index })),
        ...emptySlots.map((slot, index) => ({ ...slot, index: index + nonEmptySlots.length }))
      ]

      return {
        ...inventory,
        slots: compactedSlots
      }
    })

  const cleanupInventoryMetadata = (inventory: PlayerInventory) =>
    Effect.gen(function* () {
      const cleanSlot = (slot: InventorySlot): InventorySlot => {
        if (!slot.itemStack) return slot

        // 不要なメタデータを削除
        const cleanedMetadata = slot.itemStack.metadata ?
          Object.fromEntries(
            Object.entries(slot.itemStack.metadata)
              .filter(([key, value]) => value !== null && value !== undefined && value !== "")
          ) : undefined

        return {
          ...slot,
          itemStack: {
            ...slot.itemStack,
            metadata: Object.keys(cleanedMetadata || {}).length > 0 ? cleanedMetadata : undefined
          }
        }
      }

      return {
        ...inventory,
        slots: inventory.slots.map(cleanSlot),
        hotbarSlots: inventory.hotbarSlots.map(cleanSlot),
        armorSlots: inventory.armorSlots.map(cleanSlot),
        offhandSlot: cleanSlot(inventory.offhandSlot)
      }
    })

  const processBatchUpdatesForPlayer = (playerId: PlayerId, updates: InventoryUpdate[]) =>
    Effect.gen(function* () {
      // 更新を種類別にグループ化
      const moveUpdates = updates.filter(u => u.type === "move")
      const addUpdates = updates.filter(u => u.type === "add")
      const removeUpdates = updates.filter(u => u.type === "remove")

      // 順序を考慮して実行
      for (const update of removeUpdates) {
        yield* executeInventoryUpdate(update)
      }
      for (const update of addUpdates) {
        yield* executeInventoryUpdate(update)
      }
      for (const update of moveUpdates) {
        yield* executeInventoryUpdate(update)
      }

      // キャッシュを更新
      yield* cacheInventoryState(playerId)
    })

  const executeInventoryUpdate = (update: InventoryUpdate) =>
    Effect.gen(function* () {
      switch (update.type) {
        case "move":
          yield* playerInventory.moveItem(update.playerId, update.fromSlot!, update.toSlot!)
          break
        case "add":
          yield* playerInventory.addItem(update.playerId, update.itemStack!)
          break
        case "remove":
          yield* playerInventory.removeItem(update.playerId, update.itemStack!.itemId, update.count!)
          break
      }
    })

  const compressSlot = (slot: InventorySlot): CompressedSlot => ({
    i: slot.index,
    s: slot.itemStack ? {
      id: slot.itemStack.itemId,
      c: slot.itemStack.count,
      d: slot.itemStack.durability,
      e: slot.itemStack.enchantments,
      m: slot.itemStack.metadata
    } : null,
    l: slot.isLocked,
    r: slot.restrictions
  })

  const calculateSpaceFreed = (before: PlayerInventory, after: PlayerInventory): number => {
    const beforeUsed = before.slots.filter(s => s.itemStack).length
    const afterUsed = after.slots.filter(s => s.itemStack).length
    return beforeUsed - afterUsed
  }

  const generateInventoryChecksum = (inventory: PlayerInventory) =>
    Effect.gen(function* () {
      const inventorySyncManager = yield* InventorySyncManager
      return yield* inventorySyncManager.generateInventoryChecksum(inventory)
    })

  return PerformanceManager.of({
    optimizeInventoryOperations,
    batchInventoryUpdates,
    cacheInventoryState,
    preloadInventoryData,
    compressInventoryData,
    monitorPerformanceMetrics
  })
})

// Live Layer
export const PerformanceManagerLive = Layer.effect(
  PerformanceManager,
  makePerformanceManager
).pipe(
  Layer.provide(PlayerInventoryManagerLive),
  Layer.provide(StackingManagerLive),
  Layer.provide(InventorySyncManagerLive)
)

// 型定義
interface OptimizationResult {
  readonly success: boolean
  readonly operationTime: number
  readonly stacksOptimized: number
  readonly spaceFreed: number
}

interface InventoryUpdate {
  readonly type: "move" | "add" | "remove"
  readonly playerId: PlayerId
  readonly fromSlot?: SlotIndex
  readonly toSlot?: SlotIndex
  readonly itemStack?: ItemStack
  readonly count?: number
  readonly timestamp: number
}

interface CachedInventory {
  readonly playerId: PlayerId
  readonly inventory: PlayerInventory
  readonly compressed: CompressedInventory
  readonly lastAccessed: number
  readonly accessCount: number
}

interface CompressedInventory {
  readonly playerId: PlayerId
  readonly slots: ReadonlyArray<CompressedSlot>
  readonly hotbarSlots: ReadonlyArray<CompressedSlot>
  readonly armorSlots: ReadonlyArray<CompressedSlot>
  readonly offhandSlot: CompressedSlot
  readonly selectedHotbarIndex: number
  readonly totalWeight: number
  readonly maxWeight: number
  readonly checksum: string
}

interface CompressedSlot {
  readonly i: number // index
  readonly s: CompressedItemStack | null // stack
  readonly l: boolean // locked
  readonly r?: ReadonlyArray<string> // restrictions
}

interface CompressedItemStack {
  readonly id: ItemId // itemId
  readonly c: number // count
  readonly d?: number // durability
  readonly e?: ReadonlyArray<{ enchantmentId: string, level: number }> // enchantments
  readonly m?: Record<string, unknown> // metadata
}

interface PerformanceMetrics {
  readonly cacheHitRate: number
  readonly totalRequests: number
  readonly cacheHits: number
  readonly averageResponseTime: number
  readonly batchUpdateCount: number
  readonly compressionRatio: number
  readonly memoryUsage: {
    readonly cacheSize: number
    readonly queueSize: number
  }
  readonly timestamp: number
}
```

## まとめ

Inventory Systemは、Minecraftの直感的で効率的なアイテム管理体験を実現する包括的なシステムです。Effect-TSのLayerパターンを活用し、各インベントリコンポーネントが独立して機能しながら、統合されたアイテム管理体験を提供します。

### 主要な特徴

1. **高度なアイテム管理**: スタッキング、分割、マージの完全サポート
2. **直感的なホットバー**: 滑らかな選択とアイテム使用
3. **効率的な転送システム**: ドラッグ&ドロップと自動転送
4. **多様なコンテナサポート**: チェスト、かまど、クラフトテーブルなど
5. **包括的な装備システム**: 防具、武器、オフハンドアイテムの管理
6. **リアルタイムネットワーク同期**: サーバー・クライアント間の一貫性保証
7. **直感的なUIインタラクション**: ドラッグ&ドロップによる操作
8. **強固なセキュリティ**: チート対策とアンチハック機能
9. **パフォーマンス最適化**: 大量アイテムの効率的処理とキャッシング
10. **包括的なイベント**: アクション追跡と同期

### 技術的な強み

- **型安全性**: Effect-TSとSchema.Structによる完全な型安全性
- **関数型アプローチ**: 副作用を適切に管理した純粋な関数設計
- **スケーラビリティ**: 大規模マルチプレイヤーに対応した効率的アーキテクチャ
- **拡張性**: 新しいアイテムタイプやコンテナの容易な追加
- **テスタビリティ**: 完全に独立したコンポーネントによる高いテスト容易性

このシステムにより、プレイヤーは快適で効率的なアイテム管理を体験でき、Minecraftの魅力的なサバイバル・クラフト体験を実現します。また、開発者にとっても保守性が高く、機能拡張が容易なアーキテクチャを提供します。