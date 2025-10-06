/**
 * @fileoverview Container集約のテストスイート
 * DDD原則に基づく集約のビジネスロジックテスト
 */

import { Effect, Option } from 'effect'
import { describe, expect, it } from 'vitest'
import type { ItemId, PlayerId } from '../../types'
import {
  ContainerFactory,
  ContainerFactoryLive,
  createChest,
  createFurnace,
  createHopper,
} from '../container/factory'
import {
  closeContainer,
  findItemSlots,
  getEmptySlotCount,
  getItemCount,
  grantPermission,
  isContainerEmpty,
  isContainerFull,
  isPlayerViewing,
  openContainer,
  placeItemInContainer,
  removeItemFromContainer,
  sortContainer,
} from '../container/operations'
import type { ContainerAggregate, ContainerPermission, ContainerSlotIndex, WorldPosition } from '../container/types'
import { ItemStackFactoryLive, createSimpleItemStack } from '../item_stack/factory'

const testPlayerId = 'player_test_123' as PlayerId
const testPlayerId2 = 'player_test_456' as PlayerId
const testItemId = 'minecraft:stone' as ItemId
const testItemId2 = 'minecraft:wood' as ItemId
const testPosition: WorldPosition = {
  x: 100,
  y: 64,
  z: 200,
  dimension: 'minecraft:overworld',
}

const testLayer = ContainerFactoryLive.pipe(Effect.provide(ItemStackFactoryLive))

describe('Container Aggregate', () => {
  describe('Factory', () => {
    it('should create chest container', async () => {
      const program = Effect.gen(function* () {
        const chest = yield* createChest(testPlayerId, testPosition, 'private')

        expect(chest.type).toBe('chest')
        expect(chest.ownerId).toBe(testPlayerId)
        expect(chest.configuration.maxSlots).toBe(27)
        expect(chest.slots).toHaveLength(27)
        expect(chest.slots.every((slot) => slot === null)).toBe(true)
        expect(chest.accessLevel).toBe('private')
        expect(chest.isOpen).toBe(false)
        expect(chest.currentViewers).toHaveLength(0)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should create furnace container with special slots', async () => {
      const program = Effect.gen(function* () {
        const furnace = yield* createFurnace(testPlayerId, testPosition)

        expect(furnace.type).toBe('furnace')
        expect(furnace.configuration.maxSlots).toBe(3)
        expect(furnace.configuration.slotFilters?.[1]).toBeDefined() // 燃料スロット
        expect(furnace.configuration.hopperInteraction).toBe(true)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should create hopper with automation settings', async () => {
      const program = Effect.gen(function* () {
        const hopper = yield* createHopper(testPlayerId, testPosition)

        expect(hopper.type).toBe('hopper')
        expect(hopper.configuration.maxSlots).toBe(5)
        expect(hopper.configuration.hopperInteraction).toBe(true)
        expect(hopper.configuration.redstoneControlled).toBe(true)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should use builder pattern for custom configuration', async () => {
      const program = Effect.gen(function* () {
        const factory = yield* ContainerFactory
        const container = yield* factory
          .builder()
          .setType('chest')
          .setOwnerId(testPlayerId)
          .setPosition(testPosition)
          .setAccessLevel('public')
          .build()

        expect(container.accessLevel).toBe('public')
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })
  })

  describe('Access Control', () => {
    let testContainer: ContainerAggregate

    const setupContainer = async () => {
      const program = Effect.gen(function* () {
        return yield* createChest(testPlayerId, testPosition, 'private')
      })

      return await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
    }

    it('should open container for owner', async () => {
      testContainer = await setupContainer()

      const program = Effect.gen(function* () {
        const updatedContainer = yield* openContainer(testContainer, testPlayerId)

        expect(updatedContainer.isOpen).toBe(true)
        expect(updatedContainer.currentViewers).toContain(testPlayerId)
        expect(updatedContainer.lastAccessed).toBeDefined()
        expect(updatedContainer.uncommittedEvents).toHaveLength(1)
        expect(updatedContainer.uncommittedEvents[0].type).toBe('ContainerOpened')
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should deny access to non-owner without permission', async () => {
      testContainer = await setupContainer()

      const program = Effect.gen(function* () {
        return yield* openContainer(testContainer, testPlayerId2)
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        expect(result.cause._tag).toBe('Fail')
        expect(result.cause.error.reason).toBe('ACCESS_DENIED')
      }
    })

    it('should close container and remove viewer', async () => {
      testContainer = await setupContainer()

      const program = Effect.gen(function* () {
        const openedContainer = yield* openContainer(testContainer, testPlayerId)
        const sessionStart = new Date()

        const closedContainer = yield* closeContainer(openedContainer, testPlayerId, sessionStart)

        expect(closedContainer.isOpen).toBe(false)
        expect(closedContainer.currentViewers).not.toContain(testPlayerId)
        expect(closedContainer.uncommittedEvents).toHaveLength(2) // Open + Close
        expect(closedContainer.uncommittedEvents[1].type).toBe('ContainerClosed')
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should grant and use permissions', async () => {
      testContainer = await setupContainer()

      const permission: Omit<ContainerPermission, 'playerId'> = {
        canView: true,
        canInsert: true,
        canExtract: false,
        canModify: false,
      }

      const program = Effect.gen(function* () {
        // 権限を付与
        const containerWithPermission = yield* grantPermission(testContainer, testPlayerId, testPlayerId2, permission)

        // 権限を持つプレイヤーがアクセス
        const openedContainer = yield* openContainer(containerWithPermission, testPlayerId2)

        expect(openedContainer.isOpen).toBe(true)
        expect(openedContainer.currentViewers).toContain(testPlayerId2)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })
  })

  describe('Item Management', () => {
    let testContainer: ContainerAggregate

    const setupContainer = async () => {
      const program = Effect.gen(function* () {
        const container = yield* createChest(testPlayerId, testPosition, 'private')
        return yield* openContainer(container, testPlayerId)
      })

      return await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
    }

    it('should place item in container', async () => {
      testContainer = await setupContainer()

      const program = Effect.gen(function* () {
        const itemStack = yield* createSimpleItemStack(testItemId, 10)

        const updatedContainer = yield* placeItemInContainer(
          testContainer,
          testPlayerId,
          0 as ContainerSlotIndex,
          itemStack
        )

        expect(updatedContainer.slots[0]).not.toBeNull()
        expect(updatedContainer.slots[0]!.itemStack!.itemId).toBe(testItemId)
        expect(updatedContainer.slots[0]!.itemStack!.count).toBe(10)
        expect(updatedContainer.uncommittedEvents[1].type).toBe('ItemPlacedInContainer')
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should remove item from container', async () => {
      testContainer = await setupContainer()

      const program = Effect.gen(function* () {
        const itemStack = yield* createSimpleItemStack(testItemId, 10)

        // アイテムを配置
        const containerWithItem = yield* placeItemInContainer(
          testContainer,
          testPlayerId,
          0 as ContainerSlotIndex,
          itemStack
        )

        // アイテムを取り出し
        const { updatedAggregate, removedItemStack } = yield* removeItemFromContainer(
          containerWithItem,
          testPlayerId,
          0 as ContainerSlotIndex,
          5
        )

        expect(updatedAggregate.slots[0]!.itemStack!.count).toBe(5)
        expect(Option.isSome(removedItemStack)).toBe(true)
        if (Option.isSome(removedItemStack)) {
          expect(removedItemStack.value.count).toBe(5)
        }
        expect(updatedAggregate.uncommittedEvents[2].type).toBe('ItemRemovedFromContainer')
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should remove entire stack when quantity matches', async () => {
      testContainer = await setupContainer()

      const program = Effect.gen(function* () {
        const itemStack = yield* createSimpleItemStack(testItemId, 10)

        const containerWithItem = yield* placeItemInContainer(
          testContainer,
          testPlayerId,
          0 as ContainerSlotIndex,
          itemStack
        )

        const { updatedAggregate, removedItemStack } = yield* removeItemFromContainer(
          containerWithItem,
          testPlayerId,
          0 as ContainerSlotIndex,
          10
        )

        expect(updatedAggregate.slots[0]).toBeNull()
        expect(Option.isSome(removedItemStack)).toBe(true)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should fail to place item in occupied slot', async () => {
      testContainer = await setupContainer()

      const program = Effect.gen(function* () {
        const itemStack1 = yield* createSimpleItemStack(testItemId, 10)
        const itemStack2 = yield* createSimpleItemStack(testItemId2, 5)

        // 最初のアイテムを配置
        const containerWithItem = yield* placeItemInContainer(
          testContainer,
          testPlayerId,
          0 as ContainerSlotIndex,
          itemStack1
        )

        // 同じスロットに別のアイテムを配置しようとする
        return yield* placeItemInContainer(containerWithItem, testPlayerId, 0 as ContainerSlotIndex, itemStack2)
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        expect(result.cause._tag).toBe('Fail')
        expect(result.cause.error.reason).toBe('SLOT_OCCUPIED')
      }
    })

    it('should fail to remove from empty slot', async () => {
      testContainer = await setupContainer()

      const program = Effect.gen(function* () {
        return yield* removeItemFromContainer(testContainer, testPlayerId, 0 as ContainerSlotIndex)
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        expect(result.cause._tag).toBe('Fail')
        expect(result.cause.error.reason).toBe('SLOT_EMPTY')
      }
    })
  })

  describe('Container Sorting', () => {
    let testContainer: ContainerAggregate

    const setupContainerWithItems = async () => {
      const program = Effect.gen(function* () {
        // 自動ソート有効なコンテナを作成
        const factory = yield* ContainerFactory
        const container = yield* factory.create('chest', testPlayerId, testPosition, {
          configuration: {
            maxSlots: 27,
            autoSort: true,
          },
        })

        const openedContainer = yield* openContainer(container, testPlayerId)

        // 複数のアイテムを追加
        const itemStack1 = yield* createSimpleItemStack('minecraft:stone' as ItemId, 10)
        const itemStack2 = yield* createSimpleItemStack('minecraft:wood' as ItemId, 5)
        const itemStack3 = yield* createSimpleItemStack('minecraft:apple' as ItemId, 3)

        const container1 = yield* placeItemInContainer(
          openedContainer,
          testPlayerId,
          5 as ContainerSlotIndex,
          itemStack1
        )
        const container2 = yield* placeItemInContainer(container1, testPlayerId, 10 as ContainerSlotIndex, itemStack2)
        const container3 = yield* placeItemInContainer(container2, testPlayerId, 15 as ContainerSlotIndex, itemStack3)

        return container3
      })

      return await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
    }

    it('should sort container by type', async () => {
      testContainer = await setupContainerWithItems()

      const program = Effect.gen(function* () {
        const sortedContainer = yield* sortContainer(testContainer, testPlayerId, 'type')

        // アルファベット順になっているはず: apple, stone, wood
        expect(sortedContainer.slots[0]!.itemStack!.itemId).toBe('minecraft:apple')
        expect(sortedContainer.slots[1]!.itemStack!.itemId).toBe('minecraft:stone')
        expect(sortedContainer.slots[2]!.itemStack!.itemId).toBe('minecraft:wood')

        expect(sortedContainer.uncommittedEvents).toHaveLength(5) // Open + 3 Place + Sort
        expect(sortedContainer.uncommittedEvents[4].type).toBe('ContainerSorted')
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should fail to sort when auto-sort is disabled', async () => {
      const program = Effect.gen(function* () {
        const container = yield* createChest(testPlayerId, testPosition, 'private')
        const openedContainer = yield* openContainer(container, testPlayerId)

        return yield* sortContainer(openedContainer, testPlayerId, 'type')
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
      expect(result._tag).toBe('Failure')
    })
  })

  describe('Query Operations', () => {
    let testContainer: ContainerAggregate

    const setupContainerWithItems = async () => {
      const program = Effect.gen(function* () {
        const container = yield* createChest(testPlayerId, testPosition, 'private')
        const openedContainer = yield* openContainer(container, testPlayerId)

        const itemStack1 = yield* createSimpleItemStack(testItemId, 10)
        const itemStack2 = yield* createSimpleItemStack(testItemId, 15)
        const itemStack3 = yield* createSimpleItemStack(testItemId2, 5)

        const container1 = yield* placeItemInContainer(
          openedContainer,
          testPlayerId,
          0 as ContainerSlotIndex,
          itemStack1
        )
        const container2 = yield* placeItemInContainer(container1, testPlayerId, 1 as ContainerSlotIndex, itemStack2)
        const container3 = yield* placeItemInContainer(container2, testPlayerId, 2 as ContainerSlotIndex, itemStack3)

        return container3
      })

      return await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
    }

    it('should get correct item count', async () => {
      testContainer = await setupContainerWithItems()

      const count1 = getItemCount(testContainer, testItemId)
      const count2 = getItemCount(testContainer, testItemId2)

      expect(count1).toBe(25) // 10 + 15
      expect(count2).toBe(5)
    })

    it('should find item slots', async () => {
      testContainer = await setupContainerWithItems()

      const slots1 = findItemSlots(testContainer, testItemId)
      const slots2 = findItemSlots(testContainer, testItemId2)

      expect(slots1).toEqual([0, 1])
      expect(slots2).toEqual([2])
    })

    it('should check container state', async () => {
      testContainer = await setupContainerWithItems()

      expect(isContainerEmpty(testContainer)).toBe(false)
      expect(isContainerFull(testContainer)).toBe(false)
      expect(getEmptySlotCount(testContainer)).toBe(24) // 27 - 3
      expect(isPlayerViewing(testContainer, testPlayerId)).toBe(true)
      expect(isPlayerViewing(testContainer, testPlayerId2)).toBe(false)
    })
  })

  describe('Permission System', () => {
    let testContainer: ContainerAggregate

    const setupContainer = async () => {
      const program = Effect.gen(function* () {
        return yield* createChest(testPlayerId, testPosition, 'private')
      })

      return await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
    }

    it('should grant different permission levels', async () => {
      testContainer = await setupContainer()

      const viewOnlyPermission: Omit<ContainerPermission, 'playerId'> = {
        canView: true,
        canInsert: false,
        canExtract: false,
        canModify: false,
      }

      const program = Effect.gen(function* () {
        const containerWithPermission = yield* grantPermission(
          testContainer,
          testPlayerId,
          testPlayerId2,
          viewOnlyPermission
        )

        expect(containerWithPermission.permissions).toHaveLength(1)
        expect(containerWithPermission.permissions[0].playerId).toBe(testPlayerId2)
        expect(containerWithPermission.permissions[0].canView).toBe(true)
        expect(containerWithPermission.permissions[0].canInsert).toBe(false)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should fail when non-owner tries to grant permission', async () => {
      testContainer = await setupContainer()

      const permission: Omit<ContainerPermission, 'playerId'> = {
        canView: true,
        canInsert: true,
        canExtract: true,
        canModify: true,
      }

      const program = Effect.gen(function* () {
        return yield* grantPermission(
          testContainer,
          testPlayerId2, // 非オーナー
          testPlayerId,
          permission
        )
      })

      const result = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)))
      expect(result._tag).toBe('Failure')
      if (result._tag === 'Failure') {
        expect(result.cause._tag).toBe('Fail')
        expect(result.cause.error.reason).toBe('ACCESS_DENIED')
      }
    })
  })

  describe('Concurrency and Multiple Viewers', () => {
    let testContainer: ContainerAggregate

    const setupContainer = async () => {
      const program = Effect.gen(function* () {
        return yield* createChest(testPlayerId, testPosition, 'public')
      })

      return await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
    }

    it('should handle multiple viewers', async () => {
      testContainer = await setupContainer()

      const program = Effect.gen(function* () {
        const container1 = yield* openContainer(testContainer, testPlayerId)
        const container2 = yield* openContainer(container1, testPlayerId2)

        expect(container2.currentViewers).toHaveLength(2)
        expect(container2.currentViewers).toContain(testPlayerId)
        expect(container2.currentViewers).toContain(testPlayerId2)
        expect(container2.isOpen).toBe(true)
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })

    it('should keep container open when some viewers close', async () => {
      testContainer = await setupContainer()

      const program = Effect.gen(function* () {
        const container1 = yield* openContainer(testContainer, testPlayerId)
        const container2 = yield* openContainer(container1, testPlayerId2)

        // 1人目が閉じる
        const container3 = yield* closeContainer(container2, testPlayerId, new Date())

        expect(container3.currentViewers).toHaveLength(1)
        expect(container3.currentViewers).toContain(testPlayerId2)
        expect(container3.isOpen).toBe(true) // まだ開いている
      })

      const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
      expect(result).toBeUndefined()
    })
  })
})
