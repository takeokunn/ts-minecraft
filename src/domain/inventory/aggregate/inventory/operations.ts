/**
 * @fileoverview Inventory集約のドメイン操作
 * Effect-TSによる型安全なビジネスロジックを提供
 */

import { Effect, Option, pipe } from 'effect'
import type { ItemId } from '../../types.js'
import type { ItemStackEntity as ItemStack } from '../item_stack/types.js'
import { addUncommittedEvent, incrementVersion } from './factory.js'
import type {
  HotbarChangedEvent,
  HotbarSlot,
  InventoryAggregate,
  InventorySlot,
  ItemAddedEvent,
  ItemRemovedEvent,
  ItemsSwappedEvent,
  SlotIndex,
} from './types.js'
import { INVENTORY_CONSTANTS, InventoryAggregateError } from './types.js'

// =============================================================================
// Core Operations
// =============================================================================

export const addItem = (
  aggregate: InventoryAggregate,
  itemStack: ItemStack
): Effect.Effect<InventoryAggregate, InventoryAggregateError> =>
  Effect.gen(function* () {
    const stackableSlot = findStackableSlot(aggregate, itemStack.itemId)
    if (Option.isSome(stackableSlot)) {
      return yield* addToExistingStack(aggregate, stackableSlot.value, itemStack)
    }

    const emptySlot = findEmptySlot(aggregate)
    if (Option.isNone(emptySlot)) {
      yield* Effect.fail(InventoryAggregateError.slotOccupied(-1 as SlotIndex, itemStack.itemId))
    }

    return yield* addToEmptySlot(aggregate, emptySlot.value, itemStack)
  })

export const removeItem = (
  aggregate: InventoryAggregate,
  slotIndex: SlotIndex,
  quantity: number
): Effect.Effect<InventoryAggregate, InventoryAggregateError> =>
  Effect.gen(function* () {
    const slot = aggregate.slots[slotIndex]

    if (!slot?.itemStack) {
      yield* Effect.fail(InventoryAggregateError.slotEmpty(slotIndex))
    }

    if (slot.itemStack.count < quantity) {
      yield* Effect.fail(
        InventoryAggregateError.insufficientQuantity(slot.itemStack.itemId, quantity, slot.itemStack.count)
      )
    }

    const event: ItemRemovedEvent = {
      type: 'ItemRemoved',
      aggregateId: aggregate.id,
      playerId: aggregate.playerId,
      itemId: slot.itemStack.itemId,
      quantity,
      slotIndex,
      timestamp: new Date().toISOString() as any,
      reason: 'consumed',
    }

    const updatedSlots = [...aggregate.slots]

    if (slot.itemStack.count === quantity) {
      updatedSlots[slotIndex] = null
    } else {
      updatedSlots[slotIndex] = {
        ...slot,
        itemStack: {
          ...slot.itemStack,
          count: slot.itemStack.count - quantity,
          lastModified: new Date().toISOString() as any,
          version: slot.itemStack.version + 1,
        },
      }
    }

    return pipe({ ...aggregate, slots: updatedSlots }, incrementVersion, (agg) => addUncommittedEvent(agg, event))
  })

export const swapItems = (
  aggregate: InventoryAggregate,
  fromSlot: SlotIndex,
  toSlot: SlotIndex
): Effect.Effect<InventoryAggregate, InventoryAggregateError> =>
  Effect.gen(function* () {
    if (fromSlot === toSlot) {
      return aggregate
    }

    const updatedSlots = [...aggregate.slots]
    const fromItem = updatedSlots[fromSlot]
    updatedSlots[fromSlot] = updatedSlots[toSlot] ?? null
    updatedSlots[toSlot] = fromItem ?? null

    const event: ItemsSwappedEvent = {
      type: 'ItemsSwapped',
      aggregateId: aggregate.id,
      playerId: aggregate.playerId,
      fromSlot,
      toSlot,
      timestamp: new Date().toISOString() as any,
    }

    return pipe({ ...aggregate, slots: updatedSlots }, incrementVersion, (agg) => addUncommittedEvent(agg, event))
  })

export const changeSelectedHotbarSlot = (
  aggregate: InventoryAggregate,
  newSlot: HotbarSlot
): Effect.Effect<InventoryAggregate, InventoryAggregateError> =>
  Effect.gen(function* () {
    if (aggregate.selectedSlot === newSlot) {
      return aggregate
    }

    const event: HotbarChangedEvent = {
      type: 'HotbarChanged',
      aggregateId: aggregate.id,
      playerId: aggregate.playerId,
      previousSlot: aggregate.selectedSlot,
      newSlot,
      timestamp: new Date().toISOString() as any,
    }

    return pipe({ ...aggregate, selectedSlot: newSlot }, incrementVersion, (agg) => addUncommittedEvent(agg, event))
  })

export const getItemCount = (aggregate: InventoryAggregate, itemId: ItemId): number =>
  aggregate.slots.reduce(
    (total, slot) => (slot?.itemStack?.itemId === itemId ? total + slot.itemStack.count : total),
    0
  )

export const removeAllItems = (
  aggregate: InventoryAggregate,
  itemId: ItemId
): Effect.Effect<InventoryAggregate, InventoryAggregateError> =>
  Effect.gen(function* () {
    let current = aggregate
    for (let i = 0; i < aggregate.slots.length; i++) {
      const slot = current.slots[i]
      if (slot?.itemStack?.itemId === itemId) {
        current = yield* removeItem(current, i as SlotIndex, slot.itemStack.count)
      }
    }
    return current
  })

export const findItemSlots = (aggregate: InventoryAggregate, itemId: ItemId): ReadonlyArray<SlotIndex> =>
  aggregate.slots.reduce<SlotIndex[]>((acc, slot, index) => {
    if (slot?.itemStack?.itemId === itemId) {
      acc.push(index as SlotIndex)
    }
    return acc
  }, [])

export const isFull = (aggregate: InventoryAggregate): boolean => aggregate.slots.every((slot) => slot !== null)

export const isEmpty = (aggregate: InventoryAggregate): boolean => aggregate.slots.every((slot) => slot === null)

export const getEmptySlotCount = (aggregate: InventoryAggregate): number =>
  aggregate.slots.filter((slot) => slot === null).length

export const getSelectedHotbarItem = (aggregate: InventoryAggregate): Option.Option<ItemStack> => {
  const hotbarSlotIndex = aggregate.hotbar[aggregate.selectedSlot]
  const slot = aggregate.slots[hotbarSlotIndex]
  return slot?.itemStack ? Option.some(slot.itemStack) : Option.none()
}

// =============================================================================
// Internal Helpers
// =============================================================================

const findStackableSlot = (aggregate: InventoryAggregate, itemId: ItemId): Option.Option<SlotIndex> => {
  for (let i = 0; i < aggregate.slots.length; i++) {
    const slot = aggregate.slots[i]
    if (
      slot?.itemStack &&
      slot.itemStack.itemId === itemId &&
      slot.itemStack.count < INVENTORY_CONSTANTS.MAX_STACK_SIZE
    ) {
      return Option.some(i as SlotIndex)
    }
  }
  return Option.none()
}

const findEmptySlot = (aggregate: InventoryAggregate): Option.Option<SlotIndex> => {
  for (let i = 0; i < aggregate.slots.length; i++) {
    if (aggregate.slots[i] === null) {
      return Option.some(i as SlotIndex)
    }
  }
  return Option.none()
}

const addToExistingStack = (
  aggregate: InventoryAggregate,
  slotIndex: SlotIndex,
  itemStack: ItemStack
): Effect.Effect<InventoryAggregate, InventoryAggregateError> =>
  Effect.gen(function* () {
    const slot = aggregate.slots[slotIndex]
    if (!slot?.itemStack) {
      yield* Effect.fail(InventoryAggregateError.slotEmpty(slotIndex))
    }

    const newCount = slot.itemStack.count + itemStack.count
    if (newCount > INVENTORY_CONSTANTS.MAX_STACK_SIZE) {
      yield* Effect.fail(
        InventoryAggregateError.stackSizeExceeded(itemStack.itemId, newCount, INVENTORY_CONSTANTS.MAX_STACK_SIZE)
      )
    }

    const updatedSlots = [...aggregate.slots]
    updatedSlots[slotIndex] = {
      ...slot,
      itemStack: {
        ...slot.itemStack,
        count: newCount,
        lastModified: new Date().toISOString() as any,
        version: slot.itemStack.version + 1,
      },
    }

    const event: ItemAddedEvent = {
      type: 'ItemAdded',
      aggregateId: aggregate.id,
      playerId: aggregate.playerId,
      itemId: itemStack.itemId,
      quantity: itemStack.count,
      slotIndex,
      timestamp: new Date().toISOString() as any,
    }

    return pipe({ ...aggregate, slots: updatedSlots }, incrementVersion, (agg) => addUncommittedEvent(agg, event))
  })

const addToEmptySlot = (
  aggregate: InventoryAggregate,
  slotIndex: SlotIndex,
  itemStack: ItemStack
): Effect.Effect<InventoryAggregate, InventoryAggregateError> =>
  Effect.gen(function* () {
    if (aggregate.slots[slotIndex]) {
      yield* Effect.fail(InventoryAggregateError.slotOccupied(slotIndex, itemStack.itemId))
    }

    const newSlot: InventorySlot = {
      itemStack: {
        ...itemStack,
        lastModified: new Date().toISOString() as any,
        version: itemStack.version ?? 1,
      },
      metadata: {},
    }

    const updatedSlots = [...aggregate.slots]
    updatedSlots[slotIndex] = newSlot

    const event: ItemAddedEvent = {
      type: 'ItemAdded',
      aggregateId: aggregate.id,
      playerId: aggregate.playerId,
      itemId: itemStack.itemId,
      quantity: itemStack.count,
      slotIndex,
      timestamp: new Date().toISOString() as any,
    }

    return pipe({ ...aggregate, slots: updatedSlots }, incrementVersion, (agg) => addUncommittedEvent(agg, event))
  })
