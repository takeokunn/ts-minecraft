/**
 * InventoryService Test Suite
 *
 * Comprehensive tests for inventory management functionality
 */

import { describe, expect, it, beforeEach } from 'vitest'
import { Effect, Layer } from 'effect'
import {
  InventoryService,
  InventoryServiceLive,
  ItemRegistry,
  ItemStack,
  PlayerId,
  ItemId,
  createEmptyInventory,
} from './index.js'

describe('InventoryService', () => {
  const testPlayerId = PlayerId('player-test-001')
  const testPlayerId2 = PlayerId('player-test-002')

  const createTestItemStack = (id: string, count: number = 1): ItemStack => ({
    itemId: ItemId(id),
    count,
  })

  const runTest = <A, E>(effect: Effect.Effect<A, E, InventoryService | ItemRegistry>) => {
    const testLayer = Layer.provideMerge(InventoryServiceLive, ItemRegistry.Default)
    return Effect.runPromise(Effect.provide(effect, testLayer))
  }

  describe('Inventory Creation and Management', () => {
    it('should create an empty inventory for a player', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          const inventory = yield* service.createInventory(testPlayerId)
          return inventory
        })
      )

      expect(result.playerId).toBe(testPlayerId)
      expect(result.slots).toHaveLength(36)
      expect(result.slots.every((slot) => slot === null)).toBe(true)
      expect(result.hotbar).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
      expect(result.selectedSlot).toBe(0)
    })

    it('should get or create inventory', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          const inv1 = yield* service.getInventory(testPlayerId)
          const inv2 = yield* service.getInventory(testPlayerId)
          return { inv1, inv2 }
        })
      )

      expect(result.inv1.playerId).toBe(testPlayerId)
      expect(result.inv2.playerId).toBe(testPlayerId)
    })

    it('should manage multiple player inventories independently', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          // Add items to player 1
          yield* service.addItem(testPlayerId, createTestItemStack('minecraft:dirt', 32))

          // Add different items to player 2
          yield* service.addItem(testPlayerId2, createTestItemStack('minecraft:stone', 16))

          const inv1 = yield* service.getInventory(testPlayerId)
          const inv2 = yield* service.getInventory(testPlayerId2)

          return { inv1, inv2 }
        })
      )

      expect(result.inv1.slots[0]?.itemId).toBe(ItemId('minecraft:dirt'))
      expect(result.inv1.slots[0]?.count).toBe(32)
      expect(result.inv2.slots[0]?.itemId).toBe(ItemId('minecraft:stone'))
      expect(result.inv2.slots[0]?.count).toBe(16)
    })
  })

  describe('Item Addition and Stacking', () => {
    it('should add items to empty slots', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          const addResult = yield* service.addItem(testPlayerId, createTestItemStack('minecraft:dirt', 32))
          const inventory = yield* service.getInventory(testPlayerId)
          return { addResult, inventory }
        })
      )

      expect(result.addResult._tag).toBe('success')
      expect(result.inventory.slots[0]?.itemId).toBe(ItemId('minecraft:dirt'))
      expect(result.inventory.slots[0]?.count).toBe(32)
    })

    it('should stack items with existing stacks', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          // Add first stack
          yield* service.addItem(testPlayerId, createTestItemStack('minecraft:dirt', 32))

          // Add second stack (should merge)
          const addResult = yield* service.addItem(testPlayerId, createTestItemStack('minecraft:dirt', 20))

          const inventory = yield* service.getInventory(testPlayerId)
          return { addResult, inventory }
        })
      )

      expect(result.addResult._tag).toBe('success')
      expect(result.inventory.slots[0]?.count).toBe(52)
    })

    it('should split items across multiple slots when exceeding max stack', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          // Add items exceeding max stack size (64)
          const addResult = yield* service.addItem(testPlayerId, createTestItemStack('minecraft:dirt', 100))

          const inventory = yield* service.getInventory(testPlayerId)
          return { addResult, inventory }
        })
      )

      expect(result.addResult._tag).toBe('success')
      expect(result.inventory.slots[0]?.count).toBe(64)
      expect(result.inventory.slots[1]?.count).toBe(36)
    })

    it('should handle non-stackable items correctly', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          // Add two swords (non-stackable)
          yield* service.addItem(testPlayerId, createTestItemStack('minecraft:iron_sword', 1))
          yield* service.addItem(testPlayerId, createTestItemStack('minecraft:iron_sword', 1))

          const inventory = yield* service.getInventory(testPlayerId)
          return inventory
        })
      )

      // Non-stackable items should occupy separate slots
      expect(result.slots[0]?.itemId).toBe(ItemId('minecraft:iron_sword'))
      expect(result.slots[0]?.count).toBe(1)
      expect(result.slots[1]?.itemId).toBe(ItemId('minecraft:iron_sword'))
      expect(result.slots[1]?.count).toBe(1)
    })

    it('should return partial result when inventory is partially full', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          // Fill most slots
          for (let i = 0; i < 35; i++) {
            yield* service.setSlotItem(testPlayerId, i, createTestItemStack('minecraft:stone', 64))
          }

          // Try to add more than can fit
          const addResult = yield* service.addItem(testPlayerId, createTestItemStack('minecraft:dirt', 100))

          return addResult
        })
      )

      expect(result._tag).toBe('partial')
      if (result._tag === 'partial') {
        expect(result.addedItems).toBe(64)
        expect(result.remainingItems).toBe(36)
      }
    })

    it('should return full result when inventory is completely full', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          // Fill all slots
          for (let i = 0; i < 36; i++) {
            yield* service.setSlotItem(testPlayerId, i, createTestItemStack('minecraft:stone', 64))
          }

          // Try to add more
          const addResult = yield* service.addItem(testPlayerId, createTestItemStack('minecraft:dirt', 1))

          return addResult
        })
      )

      expect(result._tag).toBe('full')
    })
  })

  describe('Item Removal and Movement', () => {
    it('should remove items from a slot', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          // Add items
          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 32))

          // Remove some
          const removed = yield* service.removeItem(testPlayerId, 0, 10)
          const inventory = yield* service.getInventory(testPlayerId)

          return { removed, inventory }
        })
      )

      expect(result.removed?.count).toBe(10)
      expect(result.inventory.slots[0]?.count).toBe(22)
    })

    it('should clear slot when removing all items', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 32))

          const removed = yield* service.removeItem(testPlayerId, 0, 32)
          const inventory = yield* service.getInventory(testPlayerId)

          return { removed, inventory }
        })
      )

      expect(result.removed?.count).toBe(32)
      expect(result.inventory.slots[0]).toBeNull()
    })

    it('should move items between slots', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 32))

          yield* service.moveItem(testPlayerId, 0, 5)
          const inventory = yield* service.getInventory(testPlayerId)

          return inventory
        })
      )

      expect(result.slots[0]).toBeNull()
      expect(result.slots[5]?.itemId).toBe(ItemId('minecraft:dirt'))
      expect(result.slots[5]?.count).toBe(32)
    })

    it('should swap items between slots', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 32))
          yield* service.setSlotItem(testPlayerId, 1, createTestItemStack('minecraft:stone', 16))

          yield* service.swapItems(testPlayerId, 0, 1)
          const inventory = yield* service.getInventory(testPlayerId)

          return inventory
        })
      )

      expect(result.slots[0]?.itemId).toBe(ItemId('minecraft:stone'))
      expect(result.slots[1]?.itemId).toBe(ItemId('minecraft:dirt'))
    })

    it('should split stacks', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 32))

          yield* service.splitStack(testPlayerId, 0, 1, 10)
          const inventory = yield* service.getInventory(testPlayerId)

          return inventory
        })
      )

      expect(result.slots[0]?.count).toBe(22)
      expect(result.slots[1]?.count).toBe(10)
    })

    it('should merge stacks', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 32))
          yield* service.setSlotItem(testPlayerId, 1, createTestItemStack('minecraft:dirt', 20))

          yield* service.mergeStacks(testPlayerId, 0, 1)
          const inventory = yield* service.getInventory(testPlayerId)

          return inventory
        })
      )

      expect(result.slots[0]).toBeNull()
      expect(result.slots[1]?.count).toBe(52)
    })
  })

  describe('Hotbar and Selected Slot', () => {
    it('should get and set selected slot', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 32))
          yield* service.setSlotItem(testPlayerId, 1, createTestItemStack('minecraft:stone', 16))

          const item1 = yield* service.getSelectedItem(testPlayerId)
          yield* service.setSelectedSlot(testPlayerId, 1)
          const item2 = yield* service.getSelectedItem(testPlayerId)

          return { item1, item2 }
        })
      )

      expect(result.item1?.itemId).toBe(ItemId('minecraft:dirt'))
      expect(result.item2?.itemId).toBe(ItemId('minecraft:stone'))
    })

    it('should get hotbar items', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          // Set items in first 9 slots (hotbar)
          for (let i = 0; i < 9; i++) {
            yield* service.setSlotItem(testPlayerId, i, createTestItemStack(`minecraft:dirt`, i + 1))
          }

          const hotbarItems = []
          for (let i = 0; i < 9; i++) {
            const item = yield* service.getHotbarItem(testPlayerId, i)
            hotbarItems.push(item)
          }

          return hotbarItems
        })
      )

      expect(result).toHaveLength(9)
      result.forEach((item, index) => {
        expect(item?.count).toBe(index + 1)
      })
    })

    it('should transfer items to hotbar', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          // Place item in slot 20
          yield* service.setSlotItem(testPlayerId, 20, createTestItemStack('minecraft:dirt', 32))

          // Transfer to hotbar slot 3
          yield* service.transferToHotbar(testPlayerId, 20, 3)
          const hotbarItem = yield* service.getHotbarItem(testPlayerId, 3)

          return hotbarItem
        })
      )

      expect(result?.itemId).toBe(ItemId('minecraft:dirt'))
    })
  })

  describe('Armor and Offhand', () => {
    it('should equip and get armor', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          const helmet = createTestItemStack('minecraft:iron_helmet', 1)
          const chestplate = createTestItemStack('minecraft:iron_chestplate', 1)

          yield* service.equipArmor(testPlayerId, 'helmet', helmet)
          yield* service.equipArmor(testPlayerId, 'chestplate', chestplate)

          const equippedHelmet = yield* service.getArmor(testPlayerId, 'helmet')
          const equippedChestplate = yield* service.getArmor(testPlayerId, 'chestplate')

          return { equippedHelmet, equippedChestplate }
        })
      )

      expect(result.equippedHelmet?.itemId).toBe(ItemId('minecraft:iron_helmet'))
      expect(result.equippedChestplate?.itemId).toBe(ItemId('minecraft:iron_chestplate'))
    })

    it('should replace equipped armor', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          const ironHelmet = createTestItemStack('minecraft:iron_helmet', 1)
          const diamondHelmet = createTestItemStack('minecraft:diamond_helmet', 1)

          yield* service.equipArmor(testPlayerId, 'helmet', ironHelmet)
          const previous = yield* service.equipArmor(testPlayerId, 'helmet', diamondHelmet)
          const current = yield* service.getArmor(testPlayerId, 'helmet')

          return { previous, current }
        })
      )

      expect(result.previous?.itemId).toBe(ItemId('minecraft:iron_helmet'))
      expect(result.current?.itemId).toBe(ItemId('minecraft:diamond_helmet'))
    })

    it('should set and get offhand item', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          const shield = createTestItemStack('minecraft:shield', 1)
          yield* service.setOffhandItem(testPlayerId, shield)
          const offhand = yield* service.getOffhandItem(testPlayerId)

          return offhand
        })
      )

      expect(result?.itemId).toBe(ItemId('minecraft:shield'))
    })
  })

  describe('Inventory Utilities', () => {
    it('should count empty and used slots', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 32))
          yield* service.setSlotItem(testPlayerId, 1, createTestItemStack('minecraft:stone', 16))

          const emptyCount = yield* service.getEmptySlotCount(testPlayerId)
          const usedCount = yield* service.getUsedSlotCount(testPlayerId)

          return { emptyCount, usedCount }
        })
      )

      expect(result.emptyCount).toBe(34)
      expect(result.usedCount).toBe(2)
    })

    it('should find item slots', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 32))
          yield* service.setSlotItem(testPlayerId, 5, createTestItemStack('minecraft:dirt', 16))
          yield* service.setSlotItem(testPlayerId, 10, createTestItemStack('minecraft:stone', 8))

          const dirtSlots = yield* service.findItemSlots(testPlayerId, 'minecraft:dirt')

          return dirtSlots
        })
      )

      expect(result).toEqual([0, 5])
    })

    it('should count items', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 32))
          yield* service.setSlotItem(testPlayerId, 1, createTestItemStack('minecraft:dirt', 16))
          yield* service.setSlotItem(testPlayerId, 2, createTestItemStack('minecraft:stone', 8))

          const dirtCount = yield* service.countItem(testPlayerId, 'minecraft:dirt')
          const stoneCount = yield* service.countItem(testPlayerId, 'minecraft:stone')

          return { dirtCount, stoneCount }
        })
      )

      expect(result.dirtCount).toBe(48)
      expect(result.stoneCount).toBe(8)
    })

    it('should check space for items', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          // Fill most of inventory
          for (let i = 0; i < 35; i++) {
            yield* service.setSlotItem(testPlayerId, i, createTestItemStack('minecraft:stone', 64))
          }

          const hasSpace64 = yield* service.hasSpaceForItem(testPlayerId, createTestItemStack('minecraft:dirt', 64))
          const hasSpace128 = yield* service.hasSpaceForItem(testPlayerId, createTestItemStack('minecraft:dirt', 128))

          return { hasSpace64, hasSpace128 }
        })
      )

      expect(result.hasSpace64).toBe(true)
      expect(result.hasSpace128).toBe(false)
    })

    it('should sort inventory', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          yield* service.setSlotItem(testPlayerId, 5, createTestItemStack('minecraft:stone', 32))
          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 16))
          yield* service.setSlotItem(testPlayerId, 10, createTestItemStack('minecraft:dirt', 48))

          yield* service.sortInventory(testPlayerId)
          const inventory = yield* service.getInventory(testPlayerId)

          return inventory
        })
      )

      // Items should be sorted by ID, then by count
      expect(result.slots[0]?.itemId).toBe(ItemId('minecraft:dirt'))
      expect(result.slots[0]?.count).toBe(48)
      expect(result.slots[1]?.itemId).toBe(ItemId('minecraft:dirt'))
      expect(result.slots[1]?.count).toBe(16)
      expect(result.slots[2]?.itemId).toBe(ItemId('minecraft:stone'))
    })

    it('should compact inventory', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 32))
          yield* service.setSlotItem(testPlayerId, 5, createTestItemStack('minecraft:stone', 16))
          yield* service.setSlotItem(testPlayerId, 10, createTestItemStack('minecraft:grass_block', 8))

          yield* service.compactInventory(testPlayerId)
          const inventory = yield* service.getInventory(testPlayerId)

          return inventory
        })
      )

      // Items should be moved to fill gaps
      expect(result.slots[0]).not.toBeNull()
      expect(result.slots[1]).not.toBeNull()
      expect(result.slots[2]).not.toBeNull()
      expect(result.slots[3]).toBeNull()
    })
  })

  describe('Drop Operations', () => {
    it('should drop single item', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 32))

          const dropped = yield* service.dropItem(testPlayerId, 0, 10)
          const inventory = yield* service.getInventory(testPlayerId)

          return { dropped, inventory }
        })
      )

      expect(result.dropped?.count).toBe(10)
      expect(result.inventory.slots[0]?.count).toBe(22)
    })

    it('should drop all items', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 32))
          yield* service.setSlotItem(testPlayerId, 1, createTestItemStack('minecraft:stone', 16))
          yield* service.equipArmor(testPlayerId, 'helmet', createTestItemStack('minecraft:iron_helmet', 1))
          yield* service.setOffhandItem(testPlayerId, createTestItemStack('minecraft:shield', 1))

          const droppedItems = yield* service.dropAllItems(testPlayerId)
          const inventory = yield* service.getInventory(testPlayerId)

          return { droppedItems, inventory }
        })
      )

      expect(result.droppedItems).toHaveLength(4)
      expect(result.inventory.slots.every((slot) => slot === null)).toBe(true)
      expect(result.inventory.armor.helmet).toBeNull()
      expect(result.inventory.offhand).toBeNull()
    })
  })

  describe('Inventory Persistence', () => {
    it('should save and load inventory state', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          // Setup initial inventory
          yield* service.setSlotItem(testPlayerId, 0, createTestItemStack('minecraft:dirt', 32))
          yield* service.equipArmor(testPlayerId, 'helmet', createTestItemStack('minecraft:iron_helmet', 1))

          // Save state
          const state = yield* service.getInventoryState(testPlayerId)

          // Clear inventory
          yield* service.clearInventory(testPlayerId)

          // Load state back
          yield* service.loadInventoryState(state)

          const loadedInventory = yield* service.getInventory(testPlayerId)

          return loadedInventory
        })
      )

      expect(result.slots[0]?.itemId).toBe(ItemId('minecraft:dirt'))
      expect(result.armor.helmet?.itemId).toBe(ItemId('minecraft:iron_helmet'))
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid slot index', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          return yield* Effect.either(service.getSlotItem(testPlayerId, 100))
        })
      )

      expect(result._tag).toBe('Left')
    })

    it('should handle removing from empty slot', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          const removed = yield* service.removeItem(testPlayerId, 0, 10)
          return removed
        })
      )

      expect(result).toBeNull()
    })

    it('should handle moving from empty slot', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          return yield* Effect.either(service.moveItem(testPlayerId, 0, 1))
        })
      )

      expect(result._tag).toBe('Left')
    })

    it('should clear inventory completely', async () => {
      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService

          // Add various items
          yield* service.addItem(testPlayerId, createTestItemStack('minecraft:dirt', 64))
          yield* service.equipArmor(testPlayerId, 'helmet', createTestItemStack('minecraft:iron_helmet', 1))
          yield* service.setOffhandItem(testPlayerId, createTestItemStack('minecraft:shield', 1))

          yield* service.clearInventory(testPlayerId)
          const inventory = yield* service.getInventory(testPlayerId)

          return inventory
        })
      )

      expect(result.slots.every((slot) => slot === null)).toBe(true)
      expect(result.armor.helmet).toBeNull()
      expect(result.offhand).toBeNull()
    })
  })
})
