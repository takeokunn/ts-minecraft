/**
 * InventoryService テスト
 *
 * 基本的なインベントリ操作のテスト
 */

import { describe, it, expect } from 'vitest'
import { Effect, Exit, Layer, pipe } from 'effect'
import { InventoryService, InventoryError } from '../InventoryService.js'
import { InventoryServiceLive } from '../InventoryServiceLive.js'
import { createEmptyInventory, PlayerId, ItemId, ItemStack } from '../InventoryTypes.js'
import { ItemRegistry } from '../ItemRegistry.js'

describe('InventoryService', () => {
  const testLayer = pipe(InventoryServiceLive, Layer.provide(ItemRegistry.Default))

  const runTest = <A>(effect: Effect.Effect<A, any, InventoryService>) =>
    Effect.runPromise(pipe(effect, Effect.provide(testLayer)))

  const runTestExit = <A>(effect: Effect.Effect<A, any, InventoryService>) =>
    Effect.runPromiseExit(pipe(effect, Effect.provide(testLayer)))

  describe('Basic Operations', () => {
    it('should create and get inventory', async () => {
      const playerId = 'player1' as PlayerId

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          const inventory = yield* service.getInventory(playerId)
          return inventory
        })
      )

      expect(result.playerId).toBe(playerId)
      expect(result.slots).toHaveLength(36)
      expect(result.slots.every((slot) => slot === null)).toBe(true)
    })

    it('should update slot', async () => {
      const playerId = 'player1' as PlayerId
      const itemStack: ItemStack = {
        itemId: 'minecraft:stone' as ItemId,
        count: 32,
      }

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.createInventory(playerId)
          yield* service.setSlotItem(playerId, 0, itemStack)
          const inventory = yield* service.getInventory(playerId)
          return inventory
        })
      )

      expect(result.slots[0]).toEqual(itemStack)
    })

    it('should clear slot', async () => {
      const playerId = 'player1' as PlayerId
      const itemStack: ItemStack = {
        itemId: 'minecraft:stone' as ItemId,
        count: 32,
      }

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.createInventory(playerId)
          yield* service.setSlotItem(playerId, 0, itemStack)
          yield* service.setSlotItem(playerId, 0, null)
          const inventory = yield* service.getInventory(playerId)
          return inventory
        })
      )

      expect(result.slots[0]).toBeNull()
    })

    it('should reject invalid slot index', async () => {
      const playerId = 'player1' as PlayerId
      const itemStack: ItemStack = {
        itemId: 'minecraft:stone' as ItemId,
        count: 32,
      }

      const result = await runTestExit(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.createInventory(playerId)
          yield* service.setSlotItem(playerId, 100, itemStack)
        })
      )

      expect(Exit.isFailure(result)).toBe(true)
      if (Exit.isFailure(result)) {
        const error = result.cause as any
        expect(error).toBeDefined()
      }
    })
  })

  describe('Item Operations', () => {
    it('should add item to empty inventory', async () => {
      const playerId = 'player1' as PlayerId
      const itemStack: ItemStack = {
        itemId: 'minecraft:diamond' as ItemId,
        count: 5,
      }

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          const addResult = yield* service.addItem(playerId, itemStack)
          const inventory = yield* service.getInventory(playerId)
          return { addResult, inventory }
        })
      )

      expect(result.addResult._tag).toBe('success')
      expect(result.inventory.slots[0]?.itemId).toBe('minecraft:diamond')
      expect(result.inventory.slots[0]?.count).toBe(5)
    })

    it('should stack items of same type', async () => {
      const playerId = 'player1' as PlayerId
      const firstItem: ItemStack = {
        itemId: 'minecraft:iron_ingot' as ItemId,
        count: 30,
      }
      const secondItem: ItemStack = {
        itemId: 'minecraft:iron_ingot' as ItemId,
        count: 20,
      }

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.addItem(playerId, firstItem)
          yield* service.addItem(playerId, secondItem)
          const inventory = yield* service.getInventory(playerId)
          return inventory
        })
      )

      expect(result.slots[0]?.itemId).toBe('minecraft:iron_ingot')
      expect(result.slots[0]?.count).toBe(50)
      expect(result.slots[1]).toBeNull()
    })

    it('should handle stack overflow', async () => {
      const playerId = 'player1' as PlayerId
      const firstItem: ItemStack = {
        itemId: 'minecraft:cobblestone' as ItemId,
        count: 60,
      }
      const secondItem: ItemStack = {
        itemId: 'minecraft:cobblestone' as ItemId,
        count: 10,
      }

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.addItem(playerId, firstItem)
          const addResult = yield* service.addItem(playerId, secondItem)
          const inventory = yield* service.getInventory(playerId)
          return { addResult, inventory }
        })
      )

      expect(result.inventory.slots[0]?.count).toBe(60) // First slot remains 60
      expect(result.inventory.slots[1]?.count).toBe(10) // Second item added as new stack
      expect(result.addResult._tag).toBe('success')
    })

    it('should remove items', async () => {
      const playerId = 'player1' as PlayerId
      const itemStack: ItemStack = {
        itemId: 'minecraft:gold_ingot' as ItemId,
        count: 50,
      }

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.addItem(playerId, itemStack)
          const removed = yield* service.removeItem(playerId, 0, 30)
          const inventory = yield* service.getInventory(playerId)
          return { removed, inventory }
        })
      )

      expect(result.removed?.count).toBe(30)
      expect(result.inventory.slots[0]?.count).toBe(20)
    })

    it('should remove entire stack', async () => {
      const playerId = 'player1' as PlayerId
      const itemStack: ItemStack = {
        itemId: 'minecraft:emerald' as ItemId,
        count: 10,
      }

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.addItem(playerId, itemStack)
          yield* service.removeItem(playerId, 0, 20) // More than available
          const inventory = yield* service.getInventory(playerId)
          return inventory
        })
      )

      expect(result.slots[0]).toBeNull()
    })
  })

  describe('Move Operations', () => {
    it('should move item to empty slot', async () => {
      const playerId = 'player1' as PlayerId
      const itemStack: ItemStack = {
        itemId: 'minecraft:redstone' as ItemId,
        count: 16,
      }

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.createInventory(playerId)
          yield* service.setSlotItem(playerId, 0, itemStack)
          yield* service.moveItem(playerId, 0, 5)
          const inventory = yield* service.getInventory(playerId)
          return inventory
        })
      )

      expect(result.slots[0]).toBeNull()
      expect(result.slots[5]?.itemId).toBe('minecraft:redstone')
      expect(result.slots[5]?.count).toBe(16)
    })

    it('should swap items', async () => {
      const playerId = 'player1' as PlayerId
      const item1: ItemStack = {
        itemId: 'minecraft:coal' as ItemId,
        count: 32,
      }
      const item2: ItemStack = {
        itemId: 'minecraft:charcoal' as ItemId,
        count: 16,
      }

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.createInventory(playerId)
          yield* service.setSlotItem(playerId, 0, item1)
          yield* service.setSlotItem(playerId, 10, item2)
          yield* service.swapItems(playerId, 0, 10)
          const inventory = yield* service.getInventory(playerId)
          return inventory
        })
      )

      expect(result.slots[0]?.itemId).toBe('minecraft:charcoal')
      expect(result.slots[10]?.itemId).toBe('minecraft:coal')
    })

    it('should merge stackable items on move', async () => {
      const playerId = 'player1' as PlayerId
      const item1: ItemStack = {
        itemId: 'minecraft:arrow' as ItemId,
        count: 30,
      }
      const item2: ItemStack = {
        itemId: 'minecraft:arrow' as ItemId,
        count: 20,
      }

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.createInventory(playerId)
          yield* service.setSlotItem(playerId, 0, item1)
          yield* service.setSlotItem(playerId, 5, item2)
          yield* service.moveItem(playerId, 0, 5)
          const inventory = yield* service.getInventory(playerId)
          return inventory
        })
      )

      expect(result.slots[0]?.count).toBe(20) // Source slot has remaining items
      expect(result.slots[5]?.count).toBe(30) // Target slot contains moved item
    })
  })

  describe('Hotbar Operations', () => {
    it('should update hotbar', async () => {
      const playerId = 'player1' as PlayerId
      const newHotbar = [0, 1, 2, 3, 4, 5, 6, 7, 8]

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.createInventory(playerId)
          // Set hotbar items
          for (let i = 0; i < newHotbar.length; i++) {
            if (i < 9) yield* service.transferToHotbar(playerId, i, i)
          }
          const inventory = yield* service.getInventory(playerId)
          return inventory
        })
      )

      expect(result.hotbar).toEqual(newHotbar)
    })

    it('should select hotbar slot', async () => {
      const playerId = 'player1' as PlayerId

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.createInventory(playerId)
          yield* service.setSelectedSlot(playerId, 5)
          const inventory = yield* service.getInventory(playerId)
          return inventory
        })
      )

      expect(result.selectedSlot).toBe(5)
    })

    it('should get selected item', async () => {
      const playerId = 'player1' as PlayerId
      const itemStack: ItemStack = {
        itemId: 'minecraft:sword' as ItemId,
        count: 1,
      }

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.createInventory(playerId)
          yield* service.setSlotItem(playerId, 0, itemStack) // Set item in slot 0
          yield* service.transferToHotbar(playerId, 0, 0) // Reference slot 0 in hotbar index 0
          yield* service.setSelectedSlot(playerId, 0) // Select hotbar index 0
          const selectedItem = yield* service.getSelectedItem(playerId)
          return selectedItem
        })
      )

      expect(result?.itemId).toBe('minecraft:sword')
    })
  })

  describe('Query Operations', () => {
    it('should count empty slots', async () => {
      const playerId = 'player1' as PlayerId
      const itemStack: ItemStack = {
        itemId: 'minecraft:dirt' as ItemId,
        count: 64,
      }

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.createInventory(playerId)
          yield* service.setSlotItem(playerId, 0, itemStack)
          yield* service.setSlotItem(playerId, 1, itemStack)
          yield* service.setSlotItem(playerId, 2, itemStack)
          const emptyCount = yield* service.getEmptySlotCount(playerId)
          return emptyCount
        })
      )

      expect(result).toBe(33) // 36 - 3
    })

    it('should find items by id', async () => {
      const playerId = 'player1' as PlayerId
      const targetId = 'minecraft:oak_log' as ItemId

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.createInventory(playerId)
          yield* service.setSlotItem(playerId, 0, { itemId: targetId, count: 10 })
          yield* service.setSlotItem(playerId, 5, { itemId: targetId, count: 20 })
          yield* service.setSlotItem(playerId, 10, { itemId: 'minecraft:birch_log' as ItemId, count: 15 })
          const slots = yield* service.findItemSlots(playerId, targetId)
          return slots
        })
      )

      expect(result).toEqual([0, 5])
    })

    it('should count total items', async () => {
      const playerId = 'player1' as PlayerId
      const itemId = 'minecraft:coal' as ItemId

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.createInventory(playerId)
          yield* service.setSlotItem(playerId, 0, { itemId, count: 32 })
          yield* service.setSlotItem(playerId, 5, { itemId, count: 16 })
          yield* service.setSlotItem(playerId, 10, { itemId, count: 8 })
          const total = yield* service.countItem(playerId, itemId)
          return total
        })
      )

      expect(result).toBe(56) // 32 + 16 + 8
    })

    it('should check if has items', async () => {
      const playerId = 'player1' as PlayerId
      const itemId = 'minecraft:diamond' as ItemId

      const result = await runTest(
        Effect.gen(function* () {
          const service = yield* InventoryService
          yield* service.createInventory(playerId)
          yield* service.setSlotItem(playerId, 0, { itemId, count: 5 })
          const count = yield* service.countItem(playerId, itemId)
          const hasEnough = count >= 3
          const hasNotEnough = count >= 10
          return { hasEnough, hasNotEnough }
        })
      )

      expect(result.hasEnough).toBe(true)
      expect(result.hasNotEnough).toBe(false)
    })
  })
})
