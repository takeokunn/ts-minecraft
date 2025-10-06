/**
 * @fileoverview Inventory集約のテストスイート
 * DDD原則に基づく集約のビジネスロジックテスト
 */

import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import type { ItemId, PlayerId } from '../../types'
import { InventoryFactory, InventoryFactoryLive } from '../inventory/factory'
import {
  addItem,
  changeSelectedHotbarSlot,
  getEmptySlotCount,
  getItemCount,
  isEmpty,
  isFull,
  removeItem,
  swapItems,
} from '../inventory/operations'
import {
  CanAddItemSpecification,
  CanRemoveItemSpecification,
  HasSufficientSpaceSpecification,
  InventoryIntegritySpecification,
  validateSpecification,
} from '../inventory/specifications'
import type { HotbarSlot, InventoryAggregate, SlotIndex } from '../inventory/types'
import { ItemStackFactoryLive, createSimpleItemStack } from '../item_stack/factory'

const testPlayerId = 'player_test_123' as PlayerId
const testItemId = 'minecraft:stone' as ItemId
const testItemId2 = 'minecraft:wood' as ItemId

const testLayer = InventoryFactoryLive.pipe(Effect.provide(ItemStackFactoryLive))

describe('Inventory Aggregate', () => {
  describe('Factory', () => {
    it('should create empty inventory', async () => {
      const program = Effect.gen(function* () {
        const factory = yield* InventoryFactory
        const inventory = yield* factory.createEmpty(testPlayerId)

        expect(inventory.playerId).toBe(testPlayerId)
        expect(inventory.slots).toHaveLength(36)
        expect(inventory.slots.every((slot) => slot === null)).toBe(true)
        expect(inventory.hotbar).toHaveLength(9)
        expect(inventory.selectedSlot).toBe(0)
        expect(inventory.version).toBe(1)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should restore inventory from data', async () => {
      const validData = {
        id: 'inv_test_123',
        playerId: testPlayerId,
        slots: Array(36).fill(null),
        hotbar: Array.from({ length: 9 }, (_, i) => i),
        armor: {
          helmet: null,
          chestplate: null,
          leggings: null,
          boots: null,
        },
        offhand: null,
        selectedSlot: 0,
        version: 1,
        lastModified: new Date().toISOString(),
        uncommittedEvents: [],
      }

      const program = Effect.gen(function* () {
        const factory = yield* InventoryFactory
        const inventory = yield* factory.restore(validData)

        expect(inventory.id).toBe('inv_test_123')
        expect(inventory.playerId).toBe(testPlayerId)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should fail to restore invalid data', async () => {
      const invalidData = {
        id: 'invalid',
        playerId: testPlayerId,
        slots: [], // 不正なスロット数
      }

      const program = Effect.gen(function* () {
        const factory = yield* InventoryFactory
        return yield* factory.restore(invalidData)
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
      expect(result._tag).toBe('Failure')
    })
  })

  describe('Operations', () => {
    let testInventory: InventoryAggregate

    const setupInventory = async () => {
      const program = Effect.gen(function* () {
        const factory = yield* InventoryFactory
        return yield* factory.createEmpty(testPlayerId)
      })

      return await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
    }

    it('should add item to empty inventory', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        const itemStack = yield* createSimpleItemStack(testItemId, 10)
        const updatedInventory = yield* addItem(testInventory, itemStack)

        expect(updatedInventory.slots[0]).not.toBeNull()
        expect(updatedInventory.slots[0]!.itemStack!.itemId).toBe(testItemId)
        expect(updatedInventory.slots[0]!.itemStack!.count).toBe(10)
        expect(updatedInventory.version).toBe(testInventory.version + 1)
        expect(updatedInventory.uncommittedEvents).toHaveLength(1)
        expect(updatedInventory.uncommittedEvents[0].type).toBe('ItemAdded')
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should stack compatible items', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        // 最初のアイテムを追加
        const itemStack1 = yield* createSimpleItemStack(testItemId, 10)
        const inventory1 = yield* addItem(testInventory, itemStack1)

        // 同じアイテムを追加（スタックされるべき）
        const itemStack2 = yield* createSimpleItemStack(testItemId, 5)
        const inventory2 = yield* addItem(inventory1, itemStack2)

        expect(inventory2.slots[0]!.itemStack!.count).toBe(15)
        expect(inventory2.slots[1]).toBeNull() // 2番目のスロットは空のまま
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should remove item from inventory', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        // アイテムを追加
        const itemStack = yield* createSimpleItemStack(testItemId, 10)
        const inventory1 = yield* addItem(testInventory, itemStack)

        // 一部を削除
        const inventory2 = yield* removeItem(inventory1, 0 as SlotIndex, 3)

        expect(inventory2.slots[0]!.itemStack!.count).toBe(7)
        expect(inventory2.uncommittedEvents).toHaveLength(2) // Add + Remove
        expect(inventory2.uncommittedEvents[1].type).toBe('ItemRemoved')
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should remove entire stack when quantity matches', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        // アイテムを追加
        const itemStack = yield* createSimpleItemStack(testItemId, 10)
        const inventory1 = yield* addItem(testInventory, itemStack)

        // 全量を削除
        const inventory2 = yield* removeItem(inventory1, 0 as SlotIndex, 10)

        expect(inventory2.slots[0]).toBeNull()
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should swap items between slots', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        // 2つのアイテムを追加
        const itemStack1 = yield* createSimpleItemStack(testItemId, 10)
        const itemStack2 = yield* createSimpleItemStack(testItemId2, 5)

        const inventory1 = yield* addItem(testInventory, itemStack1)
        const inventory2 = yield* addItem(inventory1, itemStack2)

        // アイテムを交換
        const inventory3 = yield* swapItems(inventory2, 0 as SlotIndex, 1 as SlotIndex)

        expect(inventory3.slots[0]!.itemStack!.itemId).toBe(testItemId2)
        expect(inventory3.slots[1]!.itemStack!.itemId).toBe(testItemId)
        expect(inventory3.uncommittedEvents[2].type).toBe('ItemsSwapped')
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should change selected hotbar slot', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        const updatedInventory = yield* changeSelectedHotbarSlot(testInventory, 5 as HotbarSlot)

        expect(updatedInventory.selectedSlot).toBe(5)
        expect(updatedInventory.uncommittedEvents).toHaveLength(1)
        expect(updatedInventory.uncommittedEvents[0].type).toBe('HotbarChanged')
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should get correct item count', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        // 同じアイテムを複数スロットに追加
        const itemStack1 = yield* createSimpleItemStack(testItemId, 10)
        const itemStack2 = yield* createSimpleItemStack(testItemId, 15)

        const inventory1 = yield* addItem(testInventory, itemStack1)
        const inventory2 = yield* addItem(inventory1, itemStack2)

        const count = getItemCount(inventory2, testItemId)
        expect(count).toBe(25)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should detect empty and full inventory states', async () => {
      testInventory = await setupInventory()

      expect(isEmpty(testInventory)).toBe(true)
      expect(isFull(testInventory)).toBe(false)
      expect(getEmptySlotCount(testInventory)).toBe(36)

      // 1つのアイテムを追加
      const program = Effect.gen(function* () {
        const itemStack = yield* createSimpleItemStack(testItemId, 10)
        const inventory1 = yield* addItem(testInventory, itemStack)

        expect(isEmpty(inventory1)).toBe(false)
        expect(isFull(inventory1)).toBe(false)
        expect(getEmptySlotCount(inventory1)).toBe(35)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })
  })

  describe('Specifications', () => {
    let testInventory: InventoryAggregate

    const setupInventory = async () => {
      const program = Effect.gen(function* () {
        const factory = yield* InventoryFactory
        return yield* factory.createEmpty(testPlayerId)
      })

      return await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
    }

    it('should validate CanAddItem specification', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        const itemStack = yield* createSimpleItemStack(testItemId, 10)
        const spec = new CanAddItemSpecification(itemStack)

        const canAdd = yield* spec.isSatisfiedBy(testInventory)
        expect(canAdd).toBe(true)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should validate HasSufficientSpace specification', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        const spec = new HasSufficientSpaceSpecification(testItemId, 100)

        const hasSpace = yield* spec.isSatisfiedBy(testInventory)
        expect(hasSpace).toBe(true)

        // 非現実的な数量をテスト
        const specLarge = new HasSufficientSpaceSpecification(testItemId, 10000)
        const hasSpaceLarge = yield* specLarge.isSatisfiedBy(testInventory)
        expect(hasSpaceLarge).toBe(false)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should validate CanRemoveItem specification', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        // まずアイテムを追加
        const itemStack = yield* createSimpleItemStack(testItemId, 10)
        const inventory1 = yield* addItem(testInventory, itemStack)

        const spec = new CanRemoveItemSpecification(testItemId, 5)
        const canRemove = yield* spec.isSatisfiedBy(inventory1)
        expect(canRemove).toBe(true)

        // 存在しない数量をテスト
        const specTooMuch = new CanRemoveItemSpecification(testItemId, 15)
        const canRemoveTooMuch = yield* specTooMuch.isSatisfiedBy(inventory1)
        expect(canRemoveTooMuch).toBe(false)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should validate InventoryIntegrity specification', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        const spec = new InventoryIntegritySpecification()

        const isValid = yield* spec.isSatisfiedBy(testInventory)
        expect(isValid).toBe(true)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should validate specifications and throw error on failure', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        const itemStack = yield* createSimpleItemStack(testItemId, 10)
        const spec = new CanAddItemSpecification(itemStack)

        // 成功ケース
        yield* validateSpecification(spec, testInventory)

        // 失敗ケースのテスト（数量不足）
        const specRemove = new CanRemoveItemSpecification(testItemId, 100)
        return yield* validateSpecification(specRemove, testInventory)
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
      expect(result._tag).toBe('Failure')
    })
  })

  describe('Error Handling', () => {
    let testInventory: InventoryAggregate

    const setupInventory = async () => {
      const program = Effect.gen(function* () {
        const factory = yield* InventoryFactory
        return yield* factory.createEmpty(testPlayerId)
      })

      return await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
    }

    it('should fail when removing from empty slot', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        return yield* removeItem(testInventory, 0 as SlotIndex, 1)
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        expect(result.cause._tag).toBe('Fail')
        expect(result.cause.error.reason).toBe('SLOT_EMPTY')
      }
    })

    it('should fail when removing more items than available', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        // 10個のアイテムを追加
        const itemStack = yield* createSimpleItemStack(testItemId, 10)
        const inventory1 = yield* addItem(testInventory, itemStack)

        // 15個削除しようとする（失敗するべき）
        return yield* removeItem(inventory1, 0 as SlotIndex, 15)
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        expect(result.cause._tag).toBe('Fail')
        expect(result.cause.error.reason).toBe('INSUFFICIENT_QUANTITY')
      }
    })

    it('should fail when adding items that exceed stack size', async () => {
      testInventory = await setupInventory()

      const program = Effect.gen(function* () {
        // 64個のアイテムを追加（上限）
        const itemStack1 = yield* createSimpleItemStack(testItemId, 64)
        const inventory1 = yield* addItem(testInventory, itemStack1)

        // さらに1個追加しようとする（新しいスロットに入るべき）
        const itemStack2 = yield* createSimpleItemStack(testItemId, 1)
        const inventory2 = yield* addItem(inventory1, itemStack2)

        // 2番目のスロットに追加されているはず
        expect(inventory2.slots[1]!.itemStack!.count).toBe(1)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })
  })
})
