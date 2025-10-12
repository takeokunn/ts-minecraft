/**
 * @fileoverview Inventory集約のビジネス仕様（Specification Pattern）
 * DDD原則に基づいたビジネスルールのカプセル化
 */

import { Effect, Match, pipe, ReadonlyArray } from 'effect'
import type { ItemId } from '../../types'
import type { ItemStackEntity as ItemStack } from '../item_stack'
import type { InventoryAggregate, InventoryBusinessRule, SlotIndex } from './types'
import { INVENTORY_CONSTANTS, InventoryAggregateError } from './types'

export interface InventorySpecification<T = InventoryAggregate> {
  readonly name: string
  readonly description: string
  readonly isSatisfiedBy: (target: T) => Effect.Effect<boolean, InventoryAggregateError>
}

export const CanAddItemSpecification = (itemStack: ItemStack): InventorySpecification => ({
  name: 'CanAddItem',
  description: '指定されたアイテムを追加できるかどうかを判定',
  isSatisfiedBy: (aggregate: InventoryAggregate): Effect.Effect<boolean, InventoryAggregateError> =>
    Effect.gen(function* () {
      const hasStackableSlot = pipe(
        aggregate.slots,
        ReadonlyArray.some(
          (slot) =>
            slot?.itemStack &&
            slot.itemStack.itemId === itemStack.itemId &&
            slot.itemStack.count + itemStack.count <= INVENTORY_CONSTANTS.MAX_STACK_SIZE
        )
      )

      return pipe(
        Match.value(hasStackableSlot),
        Match.when(true, () => true),
        Match.orElse(() => aggregate.slots.some((slot) => slot === null))
      )
    }),
})

export const HasSufficientSpaceSpecification = (itemId: ItemId, requiredQuantity: number): InventorySpecification => ({
  name: 'HasSufficientSpace',
  description: '指定された数のアイテムを格納する十分なスペースがあるかを判定',
  isSatisfiedBy: (aggregate: InventoryAggregate): Effect.Effect<boolean, InventoryAggregateError> =>
    Effect.gen(function* () {
      const stackableSpace = pipe(
        aggregate.slots,
        ReadonlyArray.reduce(0, (acc, slot) => {
          return pipe(
            Match.value(slot?.itemStack?.itemId === itemId),
            Match.when(
              (matches) => matches,
              () => acc + (INVENTORY_CONSTANTS.MAX_STACK_SIZE - (slot?.itemStack?.count ?? 0))
            ),
            Match.orElse(() => acc)
          )
        })
      )

      const emptySlots = aggregate.slots.filter((slot) => slot === null).length
      const availableSpace = stackableSpace + emptySlots * INVENTORY_CONSTANTS.MAX_STACK_SIZE

      return availableSpace >= requiredQuantity
    }),
})

export const CanRemoveItemSpecification = (itemId: ItemId, requiredQuantity: number): InventorySpecification => ({
  name: 'CanRemoveItem',
  description: '指定されたアイテムを削除できるかどうかを判定',
  isSatisfiedBy: (aggregate: InventoryAggregate): Effect.Effect<boolean, InventoryAggregateError> =>
    Effect.gen(function* () {
      const total = aggregate.slots.reduce((acc, slot) => {
        return pipe(
          Match.value(slot?.itemStack?.itemId === itemId),
          Match.when(
            (matches) => matches,
            () => acc + (slot?.itemStack?.count ?? 0)
          ),
          Match.orElse(() => acc)
        )
      }, 0)

      return total >= requiredQuantity
    }),
})

export const ValidSlotIndexSpecification: InventorySpecification<SlotIndex> = {
  name: 'ValidSlotIndex',
  description: 'スロットインデックスが有効範囲内であるかを判定',
  isSatisfiedBy: (slotIndex: SlotIndex): Effect.Effect<boolean, InventoryAggregateError> =>
    Effect.succeed(slotIndex >= 0 && slotIndex < INVENTORY_CONSTANTS.MAIN_INVENTORY_SIZE),
}

export const ValidStackSizeSpecification: InventorySpecification<ItemStack> = {
  name: 'ValidStackSize',
  description: 'アイテムスタックのサイズが有効範囲内にあるかを判定',
  isSatisfiedBy: (itemStack: ItemStack): Effect.Effect<boolean, InventoryAggregateError> =>
    Effect.succeed(
      itemStack.count >= INVENTORY_CONSTANTS.MIN_STACK_SIZE && itemStack.count <= INVENTORY_CONSTANTS.MAX_STACK_SIZE
    ),
}

export const ValidHotbarSlotSpecification: InventorySpecification<number> = {
  name: 'ValidHotbarSlot',
  description: 'ホットバースロットが有効範囲内にあるかを判定',
  isSatisfiedBy: (slotIndex: number): Effect.Effect<boolean, InventoryAggregateError> =>
    Effect.succeed(slotIndex >= 0 && slotIndex < INVENTORY_CONSTANTS.HOTBAR_SIZE),
}

export const InventoryIntegritySpecification: InventorySpecification = {
  name: 'InventoryIntegrity',
  description: 'インベントリ全体の整合性を検証',
  isSatisfiedBy: (aggregate: InventoryAggregate): Effect.Effect<boolean, InventoryAggregateError> =>
    Effect.gen(function* () {
      const baseValidity =
        aggregate.slots.length === INVENTORY_CONSTANTS.MAIN_INVENTORY_SIZE &&
        aggregate.hotbar.length === INVENTORY_CONSTANTS.HOTBAR_SIZE &&
        aggregate.hotbar.every(
          (hotbarIndex) => hotbarIndex >= 0 && hotbarIndex < INVENTORY_CONSTANTS.MAIN_INVENTORY_SIZE
        )

      return yield* pipe(
        Match.value(baseValidity),
        Match.when(false, () => Effect.succeed(false)),
        Match.orElse(() =>
          Effect.gen(function* () {
            const stackChecks = yield* pipe(
              aggregate.slots,
              Effect.forEach(
                (slot) =>
                  slot?.itemStack ? ValidStackSizeSpecification.isSatisfiedBy(slot.itemStack) : Effect.succeed(true),
                { concurrency: 4 }
              )
            )

            const stackValid = stackChecks.every(Boolean)

            return yield* pipe(
              Match.value(stackValid),
              Match.when(false, () => Effect.succeed(false)),
              Match.orElse(() => ValidHotbarSlotSpecification.isSatisfiedBy(aggregate.selectedSlot))
            )
          })
        )
      )
    }),
}

export const INVENTORY_BUSINESS_RULES: ReadonlyArray<InventoryBusinessRule> = []

export const validateSpecification = <T>(
  specification: InventorySpecification<T>,
  target: T
): Effect.Effect<boolean, InventoryAggregateError> => specification.isSatisfiedBy(target)

export const validateMultipleSpecifications = <T>(
  specifications: ReadonlyArray<InventorySpecification<T>>,
  target: T
): Effect.Effect<boolean, InventoryAggregateError> =>
  Effect.reduce(specifications, true as boolean, (acc, spec) =>
    Effect.gen(function* () {
      const current = yield* spec.isSatisfiedBy(target)
      return acc && current
    })
  )
