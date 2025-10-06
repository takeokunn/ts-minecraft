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

export class CanAddItemSpecification implements InventorySpecification {
  readonly name = 'CanAddItem'
  readonly description = '指定されたアイテムを追加できるかどうかを判定'

  constructor(private readonly itemStack: ItemStack) {}

  isSatisfiedBy(aggregate: InventoryAggregate): Effect.Effect<boolean, InventoryAggregateError> {
    return Effect.gen(
      function* () {
        const hasStackableSlot = pipe(
          aggregate.slots,
          ReadonlyArray.some(
            (slot) =>
              slot?.itemStack &&
              slot.itemStack.itemId === this.itemStack.itemId &&
              slot.itemStack.count + this.itemStack.count <= INVENTORY_CONSTANTS.MAX_STACK_SIZE
          )
        )

        return pipe(
          Match.value(hasStackableSlot),
          Match.when(true, () => true),
          Match.orElse(() => aggregate.slots.some((slot) => slot === null))
        )
      }.bind(this)
    )
  }
}

export class HasSufficientSpaceSpecification implements InventorySpecification {
  readonly name = 'HasSufficientSpace'
  readonly description = '指定された数のアイテムを格納する十分なスペースがあるかを判定'

  constructor(
    private readonly itemId: ItemId,
    private readonly requiredQuantity: number
  ) {}

  isSatisfiedBy(aggregate: InventoryAggregate): Effect.Effect<boolean, InventoryAggregateError> {
    return Effect.gen(
      function* () {
        const stackableSpace = pipe(
          aggregate.slots,
          ReadonlyArray.reduce(0, (acc, slot) => {
            if (slot?.itemStack?.itemId === this.itemId) {
              const remaining = INVENTORY_CONSTANTS.MAX_STACK_SIZE - slot.itemStack.count
              return acc + remaining
            }
            return acc
          })
        )

        const emptySlots = aggregate.slots.filter((slot) => slot === null).length
        const availableSpace = stackableSpace + emptySlots * INVENTORY_CONSTANTS.MAX_STACK_SIZE

        return availableSpace >= this.requiredQuantity
      }.bind(this)
    )
  }
}

export class CanRemoveItemSpecification implements InventorySpecification {
  readonly name = 'CanRemoveItem'
  readonly description = '指定されたアイテムを削除できるかどうかを判定'

  constructor(
    private readonly itemId: ItemId,
    private readonly requiredQuantity: number
  ) {}

  isSatisfiedBy(aggregate: InventoryAggregate): Effect.Effect<boolean, InventoryAggregateError> {
    return Effect.gen(
      function* () {
        const total = aggregate.slots.reduce((acc, slot) => {
          if (slot?.itemStack?.itemId === this.itemId) {
            return acc + slot.itemStack.count
          }
          return acc
        }, 0)

        return total >= this.requiredQuantity
      }.bind(this)
    )
  }
}

export class ValidSlotIndexSpecification implements InventorySpecification<SlotIndex> {
  readonly name = 'ValidSlotIndex'
  readonly description = 'スロットインデックスが有効範囲内であるかを判定'

  isSatisfiedBy(slotIndex: SlotIndex): Effect.Effect<boolean, InventoryAggregateError> {
    return Effect.succeed(slotIndex >= 0 && slotIndex < INVENTORY_CONSTANTS.MAIN_INVENTORY_SIZE)
  }
}

export class ValidStackSizeSpecification implements InventorySpecification<ItemStack> {
  readonly name = 'ValidStackSize'
  readonly description = 'アイテムスタックのサイズが有効範囲内にあるかを判定'

  isSatisfiedBy(itemStack: ItemStack): Effect.Effect<boolean, InventoryAggregateError> {
    return Effect.succeed(
      itemStack.count >= INVENTORY_CONSTANTS.MIN_STACK_SIZE && itemStack.count <= INVENTORY_CONSTANTS.MAX_STACK_SIZE
    )
  }
}

export class ValidHotbarSlotSpecification implements InventorySpecification<number> {
  readonly name = 'ValidHotbarSlot'
  readonly description = 'ホットバースロットが有効範囲内にあるかを判定'

  isSatisfiedBy(slotIndex: number): Effect.Effect<boolean, InventoryAggregateError> {
    return Effect.succeed(slotIndex >= 0 && slotIndex < INVENTORY_CONSTANTS.HOTBAR_SIZE)
  }
}

export class InventoryIntegritySpecification implements InventorySpecification {
  readonly name = 'InventoryIntegrity'
  readonly description = 'インベントリ全体の整合性を検証'

  isSatisfiedBy(aggregate: InventoryAggregate): Effect.Effect<boolean, InventoryAggregateError> {
    return Effect.gen(function* () {
      // スロット数の検証
      const slotsValid = yield* pipe(
        Match.value(aggregate.slots.length !== INVENTORY_CONSTANTS.MAIN_INVENTORY_SIZE),
        Match.when(true, () => Effect.succeed(false)),
        Match.orElse(() => Effect.succeed(true))
      )
      if (!slotsValid) return false

      // ホットバー数の検証
      const hotbarValid = yield* pipe(
        Match.value(aggregate.hotbar.length !== INVENTORY_CONSTANTS.HOTBAR_SIZE),
        Match.when(true, () => Effect.succeed(false)),
        Match.orElse(() => Effect.succeed(true))
      )
      if (!hotbarValid) return false

      // ホットバーインデックスの検証
      const hasInvalidHotbarIndex = pipe(
        aggregate.hotbar,
        ReadonlyArray.some((hotbarIndex) => hotbarIndex < 0 || hotbarIndex >= INVENTORY_CONSTANTS.MAIN_INVENTORY_SIZE)
      )

      const hotbarIndexValid = yield* pipe(
        Match.value(hasInvalidHotbarIndex),
        Match.when(true, () => Effect.succeed(false)),
        Match.orElse(() => Effect.succeed(true))
      )
      if (!hotbarIndexValid) return false

      // スタックサイズの検証
      const hasInvalidStack = yield* pipe(
        aggregate.slots,
        Effect.forEach(
          (slot) =>
            slot?.itemStack ? new ValidStackSizeSpecification().isSatisfiedBy(slot.itemStack) : Effect.succeed(true),
          { concurrency: 'unbounded' }
        ),
        Effect.map(ReadonlyArray.some((valid) => !valid))
      )

      const stackValid = yield* pipe(
        Match.value(hasInvalidStack),
        Match.when(true, () => Effect.succeed(false)),
        Match.orElse(() => Effect.succeed(true))
      )
      if (!stackValid) return false

      return yield* new ValidHotbarSlotSpecification().isSatisfiedBy(aggregate.selectedSlot)
    })
  }
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
