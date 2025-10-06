/**
 * @fileoverview Inventory集約のドメイン操作
 * Effect-TSによる型安全なビジネスロジックを提供
 */

import { Clock, Effect, Match, Option, pipe, ReadonlyArray } from 'effect'
import type { ItemId } from '../../types'
import type { ItemStackEntity as ItemStack } from '../item_stack'
import { addUncommittedEvent, incrementVersion } from './factory'
import type {
  HotbarChangedEvent,
  HotbarSlot,
  InventoryAggregate,
  InventorySlot,
  ItemAddedEvent,
  ItemRemovedEvent,
  ItemsSwappedEvent,
  SlotIndex,
} from './types'
import { INVENTORY_CONSTANTS, InventoryAggregateError } from './types'

// =============================================================================
// Core Operations
// =============================================================================

export const addItem = (
  aggregate: InventoryAggregate,
  itemStack: ItemStack
): Effect.Effect<InventoryAggregate, InventoryAggregateError> =>
  Effect.gen(function* () {
    const stackableSlot = findStackableSlot(aggregate, itemStack.itemId)

    // stackableSlotが存在する場合は既存スタックに追加
    const resultFromStackable = yield* pipe(
      stackableSlot,
      Option.match({
        onNone: () => Effect.succeed(Option.none<InventoryAggregate>()),
        onSome: (slotIndex) =>
          Effect.map(addToExistingStack(aggregate, slotIndex, itemStack), (result) => Option.some(result)),
      })
    )

    if (Option.isSome(resultFromStackable)) {
      return resultFromStackable.value
    }

    // 空きスロットを探す
    const emptySlot = findEmptySlot(aggregate)
    return yield* pipe(
      emptySlot,
      Option.match({
        onNone: () => Effect.fail(InventoryAggregateError.slotOccupied(-1 as SlotIndex, itemStack.itemId)),
        onSome: (slotIndex) => addToEmptySlot(aggregate, slotIndex, itemStack),
      })
    )
  })

export const removeItem = (
  aggregate: InventoryAggregate,
  slotIndex: SlotIndex,
  quantity: number
): Effect.Effect<InventoryAggregate, InventoryAggregateError> =>
  Effect.gen(function* () {
    const slot = aggregate.slots[slotIndex]

    // スロットが空の場合はエラー
    const validatedSlot = yield* pipe(
      Option.fromNullable(slot?.itemStack),
      Option.match({
        onNone: () => Effect.fail(InventoryAggregateError.slotEmpty(slotIndex)),
        onSome: (itemStack) => Effect.succeed({ slot, itemStack }),
      })
    )

    // 数量不足チェック
    yield* pipe(
      Match.value(validatedSlot.itemStack.count < quantity),
      Match.when(true, () =>
        Effect.fail(
          InventoryAggregateError.insufficientQuantity(
            validatedSlot.itemStack.itemId,
            quantity,
            validatedSlot.itemStack.count
          )
        )
      ),
      Match.orElse(() => Effect.succeed(undefined))
    )

    const timestamp = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())
    const event: ItemRemovedEvent = {
      type: 'ItemRemoved',
      aggregateId: aggregate.id,
      playerId: aggregate.playerId,
      itemId: validatedSlot.itemStack.itemId,
      quantity,
      slotIndex,
      timestamp: timestamp as any,
      reason: 'consumed',
    }

    const updatedSlots = [...aggregate.slots]

    // 全量削除か一部削除かを判定
    updatedSlots[slotIndex] = yield* pipe(
      Match.value(validatedSlot.itemStack.count === quantity),
      Match.when(true, () => Effect.succeed(null)),
      Match.orElse(() =>
        Effect.succeed({
          ...validatedSlot.slot,
          itemStack: {
            ...validatedSlot.itemStack,
            count: validatedSlot.itemStack.count - quantity,
            lastModified: timestamp as any,
            version: validatedSlot.itemStack.version + 1,
          },
        })
      )
    )

    const aggregateWithUpdatedSlots = { ...aggregate, slots: updatedSlots }
    const aggregateWithVersion = yield* incrementVersion(aggregateWithUpdatedSlots)
    return addUncommittedEvent(aggregateWithVersion, event)
  })

export const swapItems = (
  aggregate: InventoryAggregate,
  fromSlot: SlotIndex,
  toSlot: SlotIndex
): Effect.Effect<InventoryAggregate, InventoryAggregateError> =>
  Effect.gen(function* () {
    // 同一スロット指定時は何もしない
    return yield* pipe(
      Match.value(fromSlot === toSlot),
      Match.when(true, () => Effect.succeed(aggregate)),
      Match.orElse(() =>
        Effect.gen(function* () {
          const updatedSlots = [...aggregate.slots]
          const fromItem = updatedSlots[fromSlot]
          updatedSlots[fromSlot] = updatedSlots[toSlot] ?? null
          updatedSlots[toSlot] = fromItem ?? null

          const timestamp = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())
          const event: ItemsSwappedEvent = {
            type: 'ItemsSwapped',
            aggregateId: aggregate.id,
            playerId: aggregate.playerId,
            fromSlot,
            toSlot,
            timestamp: timestamp as any,
          }

          const aggregateWithUpdatedSlots = { ...aggregate, slots: updatedSlots }
          const aggregateWithVersion = yield* incrementVersion(aggregateWithUpdatedSlots)
          return addUncommittedEvent(aggregateWithVersion, event)
        })
      )
    )
  })

export const changeSelectedHotbarSlot = (
  aggregate: InventoryAggregate,
  newSlot: HotbarSlot
): Effect.Effect<InventoryAggregate, InventoryAggregateError> =>
  Effect.gen(function* () {
    // 同じスロット選択時は何もしない
    return yield* pipe(
      Match.value(aggregate.selectedSlot === newSlot),
      Match.when(true, () => Effect.succeed(aggregate)),
      Match.orElse(() =>
        Effect.gen(function* () {
          const timestamp = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())
          const event: HotbarChangedEvent = {
            type: 'HotbarChanged',
            aggregateId: aggregate.id,
            playerId: aggregate.playerId,
            previousSlot: aggregate.selectedSlot,
            newSlot,
            timestamp: timestamp as any,
          }

          const aggregateWithUpdatedSlot = { ...aggregate, selectedSlot: newSlot }
          const aggregateWithVersion = yield* incrementVersion(aggregateWithUpdatedSlot)
          return addUncommittedEvent(aggregateWithVersion, event)
        })
      )
    )
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
    return yield* pipe(
      ReadonlyArray.range(0, aggregate.slots.length - 1),
      Effect.reduce(aggregate, (current, i) =>
        Effect.gen(function* () {
          const slot = current.slots[i]
          if (slot?.itemStack?.itemId === itemId) {
            return yield* removeItem(current, i as SlotIndex, slot.itemStack.count)
          }
          return current
        })
      )
    )
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

const findStackableSlot = (aggregate: InventoryAggregate, itemId: ItemId): Option.Option<SlotIndex> =>
  pipe(
    aggregate.slots,
    ReadonlyArray.findFirstIndex(
      (slot) =>
        slot?.itemStack && slot.itemStack.itemId === itemId && slot.itemStack.count < INVENTORY_CONSTANTS.MAX_STACK_SIZE
    ),
    Option.map((i) => i as SlotIndex)
  )

const findEmptySlot = (aggregate: InventoryAggregate): Option.Option<SlotIndex> =>
  pipe(
    aggregate.slots,
    ReadonlyArray.findFirstIndex((slot) => slot === null),
    Option.map((i) => i as SlotIndex)
  )

const addToExistingStack = (
  aggregate: InventoryAggregate,
  slotIndex: SlotIndex,
  itemStack: ItemStack
): Effect.Effect<InventoryAggregate, InventoryAggregateError> =>
  Effect.gen(function* () {
    const slot = aggregate.slots[slotIndex]

    // スロット検証
    const validatedSlot = yield* pipe(
      Option.fromNullable(slot?.itemStack),
      Option.match({
        onNone: () => Effect.fail(InventoryAggregateError.slotEmpty(slotIndex)),
        onSome: (itemStack) => Effect.succeed({ slot, itemStack }),
      })
    )

    const newCount = validatedSlot.itemStack.count + itemStack.count

    // スタックサイズ超過チェック
    yield* pipe(
      Match.value(newCount > INVENTORY_CONSTANTS.MAX_STACK_SIZE),
      Match.when(true, () =>
        Effect.fail(
          InventoryAggregateError.stackSizeExceeded(itemStack.itemId, newCount, INVENTORY_CONSTANTS.MAX_STACK_SIZE)
        )
      ),
      Match.orElse(() => Effect.succeed(undefined))
    )

    const timestamp = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())
    const updatedSlots = [...aggregate.slots]
    updatedSlots[slotIndex] = {
      ...validatedSlot.slot,
      itemStack: {
        ...validatedSlot.itemStack,
        count: newCount,
        lastModified: timestamp as any,
        version: validatedSlot.itemStack.version + 1,
      },
    }

    const event: ItemAddedEvent = {
      type: 'ItemAdded',
      aggregateId: aggregate.id,
      playerId: aggregate.playerId,
      itemId: itemStack.itemId,
      quantity: itemStack.count,
      slotIndex,
      timestamp: timestamp as any,
    }

    const aggregateWithUpdatedSlots = { ...aggregate, slots: updatedSlots }
    const aggregateWithVersion = yield* incrementVersion(aggregateWithUpdatedSlots)
    return addUncommittedEvent(aggregateWithVersion, event)
  })

const addToEmptySlot = (
  aggregate: InventoryAggregate,
  slotIndex: SlotIndex,
  itemStack: ItemStack
): Effect.Effect<InventoryAggregate, InventoryAggregateError> =>
  Effect.gen(function* () {
    // スロットが空であることを確認
    yield* pipe(
      Match.value(!!aggregate.slots[slotIndex]),
      Match.when(true, () => Effect.fail(InventoryAggregateError.slotOccupied(slotIndex, itemStack.itemId))),
      Match.orElse(() => Effect.succeed(undefined))
    )

    const timestamp = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())
    const newSlot: InventorySlot = {
      itemStack: {
        ...itemStack,
        lastModified: timestamp as any,
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
      timestamp: timestamp as any,
    }

    const aggregateWithUpdatedSlots = { ...aggregate, slots: updatedSlots }
    const aggregateWithVersion = yield* incrementVersion(aggregateWithUpdatedSlots)
    return addUncommittedEvent(aggregateWithVersion, event)
  })
