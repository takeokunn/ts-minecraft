import { InventoryService, InventoryServiceLive, ItemRegistry } from '@domain/inventory/service'
import { describe, expect, it } from '@effect/vitest'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as fc from 'effect/FastCheck'
import * as Layer from 'effect/Layer'
import { InventoryState, ItemId, ItemStack, PlayerId, createEmptyInventory } from '../inventory-types'

const run = <A>(body: (service: InventoryService) => Effect.Effect<A>) =>
  Effect.scoped(
    Effect.gen(function* () {
      const layer = Layer.provideMerge(ItemRegistry.Default)(InventoryServiceLive)
      const context = yield* Layer.build(layer)
      const service = Context.unsafeGet(context, InventoryService)
      return yield* body(service)
    })
  )

const testPlayer = PlayerId('player-test-0001')
const otherPlayer = PlayerId('player-test-0002')
const dirt = ItemId('minecraft:dirt')
const stone = ItemId('minecraft:stone')
const sword = ItemId('minecraft:iron_sword')
const shield = ItemId('minecraft:shield')
const helmet = ItemId('minecraft:iron_helmet')

const makeStack = (itemId: ItemId, count: number): ItemStack => ({ itemId, count })

const propertyConfig: fc.Parameters = { numRuns: 32 }
const inventoryItems = [dirt, stone, sword, shield, helmet] as const

describe('InventoryServiceLive', () => {
  it.effect('creates a fresh inventory with expected defaults', () =>
    run((service) =>
      Effect.gen(function* () {
        const inventory = yield* service.createInventory(testPlayer)
        expect(inventory.slots).toHaveLength(36)
        expect(inventory.slots.every((slot) => slot === null)).toBe(true)
        expect(inventory.hotbar).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
        expect(inventory.selectedSlot).toBe(0)
        expect(inventory.metadata.checksum).toBeTruthy()
      })
    )
  )

  it.effect('adds stackable items into empty inventory (success)', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        const result = yield* service.addItem(testPlayer, makeStack(dirt, 32))
        expect(result._tag).toBe('success')
        expect(result.addedItems).toBe(32)
        expect(result.remainingItems).toBe(0)
        const inventory = yield* service.getInventory(testPlayer)
        expect(inventory.slots[0]?.count).toBe(32)
      })
    )
  )

  it.effect('returns partial when space is limited', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        // Fill 35 slots fully with stone stacks
        for (let i = 0; i < 35; i += 1) {
          yield* service.setSlotItem(testPlayer, i, makeStack(stone, 64))
        }
        const result = yield* service.addItem(testPlayer, makeStack(dirt, 100))
        expect(result._tag).toBe('partial')
        expect(result.addedItems).toBeGreaterThan(0)
        expect(result.remainingItems).toBeGreaterThan(0)
      })
    )
  )

  it.effect('returns full when inventory already full', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        for (let i = 0; i < 36; i += 1) {
          yield* service.setSlotItem(testPlayer, i, makeStack(stone, 64))
        }
        const result = yield* service.addItem(testPlayer, makeStack(dirt, 1))
        expect(result._tag).toBe('full')
        expect(result.addedItems).toBe(0)
        expect(result.remainingItems).toBe(1)
      })
    )
  )

  it.effect('removes items and returns removed stack', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        yield* service.setSlotItem(testPlayer, 0, makeStack(dirt, 20))
        const removed = yield* service.removeItem(testPlayer, 0, 12)
        expect(removed?.count).toBe(12)
        const inventory = yield* service.getInventory(testPlayer)
        expect(inventory.slots[0]?.count).toBe(8)
      })
    )
  )

  it.effect('moves items between slots and merges compatible stacks', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        yield* service.setSlotItem(testPlayer, 0, makeStack(dirt, 40))
        yield* service.setSlotItem(testPlayer, 5, makeStack(dirt, 10))
        yield* service.moveItem(testPlayer, 0, 5, 24)
        const inventory = yield* service.getInventory(testPlayer)
        expect(inventory.slots[0]?.count).toBe(16)
        expect(inventory.slots[5]?.count).toBe(34)
      })
    )
  )

  it.effect('swaps two slots', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        yield* service.setSlotItem(testPlayer, 2, makeStack(dirt, 12))
        yield* service.setSlotItem(testPlayer, 3, makeStack(stone, 28))
        yield* service.swapItems(testPlayer, 2, 3)
        const inventory = yield* service.getInventory(testPlayer)
        expect(inventory.slots[2]?.itemId).toBe(stone)
        expect(inventory.slots[3]?.itemId).toBe(dirt)
      })
    )
  )

  it.effect('splits and merges stacks correctly', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        yield* service.setSlotItem(testPlayer, 0, makeStack(dirt, 40))
        yield* service.splitStack(testPlayer, 0, 1, 15)
        let inventory = yield* service.getInventory(testPlayer)
        expect(inventory.slots[0]?.count).toBe(25)
        expect(inventory.slots[1]?.count).toBe(15)

        yield* service.mergeStacks(testPlayer, 1, 0)
        inventory = yield* service.getInventory(testPlayer)
        expect(inventory.slots[0]?.count).toBe(40)
        expect(inventory.slots[1]).toBeNull()
      })
    )
  )

  it.effect('manages selected hotbar slot and retrieval', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        yield* service.setSlotItem(testPlayer, 5, makeStack(dirt, 3))
        yield* service.transferToHotbar(testPlayer, 5, 2)
        yield* service.setSelectedSlot(testPlayer, 2)
        const selected = yield* service.getSelectedItem(testPlayer)
        expect(selected?.count).toBe(3)
      })
    )
  )

  it.effect('equips armor and returns previous item', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        const previous = yield* service.equipArmor(testPlayer, 'helmet', makeStack(helmet, 1))
        expect(previous).toBeNull()
        const replaced = yield* service.equipArmor(testPlayer, 'helmet', makeStack(helmet, 1))
        expect(replaced?.itemId).toBe(helmet)
      })
    )
  )

  it.effect('sets and retrieves offhand item', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        yield* service.setOffhandItem(testPlayer, makeStack(shield, 1))
        const offhand = yield* service.getOffhandItem(testPlayer)
        expect(offhand?.itemId).toBe(shield)
      })
    )
  )

  it.effect('drops a specific amount from slot', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        yield* service.setSlotItem(testPlayer, 4, makeStack(dirt, 9))
        const dropped = yield* service.dropItem(testPlayer, 4, 4)
        expect(dropped?.count).toBe(4)
        const inventory = yield* service.getInventory(testPlayer)
        expect(inventory.slots[4]?.count).toBe(5)
      })
    )
  )

  it.effect('drops all items including armor and offhand', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        yield* service.setSlotItem(testPlayer, 0, makeStack(dirt, 10))
        yield* service.setSlotItem(testPlayer, 1, makeStack(stone, 5))
        yield* service.equipArmor(testPlayer, 'helmet', makeStack(helmet, 1))
        yield* service.setOffhandItem(testPlayer, makeStack(shield, 1))
        const dropped = yield* service.dropAllItems(testPlayer)
        expect(dropped).toHaveLength(4)
        const inventory = yield* service.getInventory(testPlayer)
        expect(inventory.slots.every((slot) => slot === null)).toBe(true)
        expect(inventory.armor.helmet).toBeNull()
        expect(inventory.offhand).toBeNull()
      })
    )
  )

  it.effect('clears inventory state', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        yield* service.setSlotItem(testPlayer, 0, makeStack(dirt, 8))
        yield* service.clearInventory(testPlayer)
        const inventory = yield* service.getInventory(testPlayer)
        expect(inventory.slots.every((slot) => slot === null)).toBe(true)
      })
    )
  )

  it.effect('loads inventory state via schema decoding', () =>
    run((service) =>
      Effect.gen(function* () {
        const empty = createEmptyInventory(otherPlayer)
        const state: InventoryState = {
          inventory: empty,
          persistedAt: Date.now(),
        }
        yield* service.loadInventoryState(state)
        const restored = yield* service.getInventory(otherPlayer)
        expect(restored.slots).toHaveLength(36)
        expect(restored.playerId).toBe(otherPlayer)
      })
    )
  )

  it.effect('counts and locates items correctly', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        yield* service.setSlotItem(testPlayer, 0, makeStack(dirt, 5))
        yield* service.setSlotItem(testPlayer, 10, makeStack(dirt, 7))
        yield* service.setSlotItem(testPlayer, 15, makeStack(stone, 3))
        const locations = yield* service.findItemSlots(testPlayer, dirt)
        const total = yield* service.countItem(testPlayer, dirt)
        expect(locations).toEqual([0, 10])
        expect(total).toBe(12)
      })
    )
  )

  it.effect('sorts and compacts inventory', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        yield* service.setSlotItem(testPlayer, 5, makeStack(stone, 16))
        yield* service.setSlotItem(testPlayer, 0, makeStack(dirt, 32))
        yield* service.setSlotItem(testPlayer, 10, makeStack(dirt, 8))
        yield* service.sortInventory(testPlayer)
        let inventory = yield* service.getInventory(testPlayer)
        expect(inventory.slots[0]?.itemId).toBe(dirt)
        expect(inventory.slots[1]?.itemId).toBe(dirt)
        expect(inventory.slots[2]?.itemId).toBe(stone)

        yield* service.compactInventory(testPlayer)
        inventory = yield* service.getInventory(testPlayer)
        expect(inventory.slots.slice(3).every((slot) => slot === null)).toBe(true)
      })
    )
  )

  it.effect('answers hasSpaceForItem correctly for stackable items', () =>
    run((service) =>
      Effect.gen(function* () {
        yield* service.createInventory(testPlayer)
        const yes = yield* service.hasSpaceForItem(testPlayer, makeStack(dirt, 64))
        expect(yes).toBe(true)
        for (let i = 0; i < 36; i += 1) {
          yield* service.setSlotItem(testPlayer, i, makeStack(dirt, 64))
        }
        const no = yield* service.hasSpaceForItem(testPlayer, makeStack(dirt, 1))
        expect(no).toBe(false)
      })
    )
  )

  it('addItem preserves quantity accounting across arbitrary counts (PBT)', async () => {
    const prefillArbitrary = fc.array(
      fc.record({
        itemId: fc.constantFrom(...inventoryItems),
        count: fc.integer({ min: 1, max: 64 }),
      }),
      { maxLength: 12 }
    )

    const additionArbitrary = fc.record({
      itemId: fc.constantFrom(...inventoryItems),
      count: fc.integer({ min: 1, max: 64 }),
    })

    await fc.assert(
      fc.asyncProperty(prefillArbitrary, additionArbitrary, async (prefill, addition) => {
        await Effect.runPromise(
          run((service) =>
            Effect.gen(function* () {
              yield* service.createInventory(testPlayer)

              for (const entry of prefill) {
                yield* service.addItem(testPlayer, makeStack(entry.itemId, entry.count))
              }

              const before = yield* service.countItem(testPlayer, addition.itemId)
              const result = yield* service.addItem(testPlayer, makeStack(addition.itemId, addition.count))
              const after = yield* service.countItem(testPlayer, addition.itemId)

              expect(result.addedItems + result.remainingItems).toBe(addition.count)
              expect(after - before).toBe(result.addedItems)
            })
          )
        )
      }),
      propertyConfig
    )
  })
})
