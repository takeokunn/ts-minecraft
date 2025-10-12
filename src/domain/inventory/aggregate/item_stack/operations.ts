/**
 * @fileoverview ItemStackエンティティのドメイン操作
 * merge, split, consume等の核となるビジネスロジック
 */

import { DateTime, Effect, Match, Option, pipe } from 'effect'
import { incrementEntityVersion, ItemStackFactory } from './factory'
import type {
  ItemStackConsumedEvent,
  ItemStackDamageEvent,
  ItemStackEntity,
  ItemStackMergedEvent,
  ItemStackSplitEvent,
} from './types'
import { DurabilitySchema, ITEM_STACK_CONSTANTS, ItemCountSchema, ItemStackError, makeUnsafeItemCount } from './types'

// ===== Core Operations =====

/**
 * 2つのItemStackをマージ（同じアイテムID必須）
 */
export const mergeItemStacks = (
  sourceStack: ItemStackEntity,
  targetStack: ItemStackEntity
): Effect.Effect<
  {
    readonly mergedStack: ItemStackEntity
    readonly event: ItemStackMergedEvent
  },
  ItemStackError
> =>
  Effect.gen(function* () {
    // アイテムID一致チェック
    yield* Effect.when(sourceStack.itemId !== targetStack.itemId, () =>
      Effect.fail(
        ItemStackError.make({
          reason: 'MERGE_DIFFERENT_ITEMS',
          message: 'Cannot merge different item types',
          metadata: {
            sourceItemId: sourceStack.itemId,
            targetItemId: targetStack.itemId,
          },
        })
      )
    )

    const totalCount = sourceStack.count + targetStack.count

    // スタック上限チェック
    yield* Effect.when(totalCount > ITEM_STACK_CONSTANTS.MAX_STACK_SIZE, () =>
      Effect.fail(
        ItemStackError.make({
          reason: 'STACK_LIMIT_EXCEEDED',
          message: 'Merge would exceed max stack size',
          metadata: {
            currentCount: targetStack.count,
            attemptedAdd: sourceStack.count,
            maxAllowed: ITEM_STACK_CONSTANTS.MAX_STACK_SIZE,
          },
        })
      )
    )

    const mergedStack = incrementEntityVersion({
      ...targetStack,
      count: ItemCountSchema.make(totalCount),
    })

    const now = yield* DateTime.now
    const timestamp = DateTime.formatIso(now)
    const event: ItemStackMergedEvent = {
      type: 'ItemStackMerged',
      sourceStackId: sourceStack.id,
      targetStackId: targetStack.id,
      itemId: sourceStack.itemId,
      mergedQuantity: sourceStack.count,
      finalQuantity: ItemCountSchema.make(totalCount),
      timestamp,
    }

    return { mergedStack, event }
  })

/**
 * ItemStackを分割
 */
export const splitItemStack = (
  sourceStack: ItemStackEntity,
  splitQuantity: number
): Effect.Effect<
  {
    readonly remainingStack: ItemStackEntity
    readonly newStack: ItemStackEntity
    readonly event: ItemStackSplitEvent
  },
  ItemStackError
> =>
  Effect.gen(function* () {
    // 分割数量の検証
    yield* Effect.when(splitQuantity <= 0 || splitQuantity >= sourceStack.count, () =>
      Effect.fail(ItemStackError.splitUnderflow(sourceStack.id, splitQuantity))
    )

    const remainingQuantity = sourceStack.count - splitQuantity

    // 残りスタックを更新
    const versionedSource = yield* incrementEntityVersion(sourceStack)
    const remainingStack: ItemStackEntity = {
      ...versionedSource,
      count: ItemCountSchema.make(remainingQuantity),
    }

    // 新しいスタックを作成
    const factory = yield* ItemStackFactory
    const newStack = yield* factory.create(sourceStack.itemId, ItemCountSchema.make(splitQuantity), {
      durability: sourceStack.durability,
      nbtData: sourceStack.nbtData,
      metadata: sourceStack.metadata,
    })

    const now = yield* DateTime.now
    const timestamp = DateTime.formatIso(now)
    const event: ItemStackSplitEvent = {
      type: 'ItemStackSplit',
      sourceStackId: sourceStack.id,
      newStackId: newStack.id,
      itemId: sourceStack.itemId,
      splitQuantity: ItemCountSchema.make(splitQuantity),
      remainingQuantity: ItemCountSchema.make(remainingQuantity),
      timestamp,
    }

    return { remainingStack, newStack, event }
  })

/**
 * ItemStackを消費（数量を減らす）
 */
export const consumeItemStack = (
  stack: ItemStackEntity,
  quantity: number,
  reason: 'used' | 'crafted' | 'damaged' | 'expired' = 'used'
): Effect.Effect<
  {
    readonly updatedStack: Option.Option<ItemStackEntity>
    readonly event: ItemStackConsumedEvent
  },
  ItemStackError
> =>
  Effect.gen(function* () {
    // 消費数量の検証
    yield* Effect.when(quantity <= 0, () =>
      Effect.fail(
        ItemStackError.make({
          reason: 'INVALID_STACK_SIZE',
          message: `不正な消費数量: ${quantity}`,
          stackId: stack.id,
          quantity: makeUnsafeItemCount(quantity),
        })
      )
    )

    yield* Effect.when(quantity > stack.count, () =>
      Effect.fail(ItemStackError.insufficientQuantity(stack.id, quantity, stack.count))
    )

    const remainingQuantity = stack.count - quantity

    const now = yield* DateTime.now
    const timestamp = DateTime.formatIso(now)
    const event: ItemStackConsumedEvent = {
      type: 'ItemStackConsumed',
      stackId: stack.id,
      itemId: stack.itemId,
      consumedQuantity: ItemCountSchema.make(quantity),
      remainingQuantity: ItemCountSchema.make(remainingQuantity),
      timestamp,
      reason,
    }

    // 完全に消費された場合
    return yield* pipe(
      Match.value(remainingQuantity),
      Match.when(0, () => Effect.succeed({ updatedStack: Option.none<ItemStackEntity>(), event })),
      Match.orElse(() =>
        Effect.gen(function* () {
          const versionedStack = yield* incrementEntityVersion(stack)
          const updatedStack: ItemStackEntity = {
            ...versionedStack,
            count: ItemCountSchema.make(remainingQuantity),
          }

          return { updatedStack: Option.some(updatedStack), event }
        })
      ),
      Match.exhaustive
    )
  })

/**
 * アイテムに耐久度ダメージを与える
 */
export const damageItemStack = (
  stack: ItemStackEntity,
  damageAmount: number
): Effect.Effect<
  {
    readonly updatedStack: Option.Option<ItemStackEntity>
    readonly event: ItemStackDamageEvent
  },
  ItemStackError
> =>
  Effect.gen(function* () {
    const previousDurability = yield* pipe(
      Option.fromNullable(stack.durability),
      Match.value,
      Match.tag('None', () =>
        Effect.fail(
          ItemStackError.make({
            reason: 'INVALID_DURABILITY',
            message: '耐久度が設定されていないアイテムです',
            stackId: stack.id,
          })
        )
      ),
      Match.tag('Some', ({ value }) => Effect.succeed(value)),
      Match.exhaustive
    )

    // ダメージ量の検証
    yield* Effect.when(damageAmount < 0 || damageAmount > 1, () =>
      Effect.fail(
        ItemStackError.make({
          reason: 'INVALID_DURABILITY',
          message: `不正なダメージ量: ${damageAmount}`,
          stackId: stack.id,
        })
      )
    )
    const newDurability = Math.max(0, previousDurability - damageAmount)
    const isBroken = newDurability <= ITEM_STACK_CONSTANTS.BROKEN_THRESHOLD

    const now = yield* DateTime.now
    const timestamp = DateTime.formatIso(now)
    const event: ItemStackDamageEvent = {
      type: 'ItemStackDamaged',
      stackId: stack.id,
      itemId: stack.itemId,
      previousDurability: previousDurability,
      newDurability: DurabilitySchema.make(newDurability),
      damageAmount,
      timestamp,
      broken: isBroken,
    }

    return yield* pipe(
      Match.value(isBroken),
      Match.when(true, () => Effect.succeed({ updatedStack: Option.none<ItemStackEntity>(), event })),
      Match.orElse(() =>
        Effect.gen(function* () {
          const versionedStack = yield* incrementEntityVersion(stack)
          const updatedStack: ItemStackEntity = {
            ...versionedStack,
            durability: DurabilitySchema.make(newDurability),
          }

          return { updatedStack: Option.some(updatedStack), event }
        })
      ),
      Match.exhaustive
    )
  })

/**
 * アイテムの耐久度を修復
 */
export const repairItemStack = (
  stack: ItemStackEntity,
  repairAmount: number
): Effect.Effect<ItemStackEntity, ItemStackError> =>
  Effect.gen(function* () {
    const currentDurability = yield* pipe(
      Option.fromNullable(stack.durability),
      Match.value,
      Match.tag('None', () =>
        Effect.fail(
          ItemStackError.make({
            reason: 'INVALID_DURABILITY',
            message: '耐久度が設定されていないアイテムです',
            stackId: stack.id,
          })
        )
      ),
      Match.tag('Some', ({ value }) => Effect.succeed(value)),
      Match.exhaustive
    )

    // 修復量の検証
    yield* Effect.when(repairAmount < 0 || repairAmount > 1, () =>
      Effect.fail(
        ItemStackError.make({
          reason: 'INVALID_DURABILITY',
          message: `不正な修復量: ${repairAmount}`,
          stackId: stack.id,
        })
      )
    )

    const newDurability = Math.min(ITEM_STACK_CONSTANTS.MAX_DURABILITY, currentDurability + repairAmount)

    const versionedStack = yield* incrementEntityVersion(stack)
    return {
      ...versionedStack,
      durability: DurabilitySchema.make(newDurability),
    }
  })

// ===== Helper Functions =====

/**
 * NBTデータの互換性をチェック
 */
const checkNBTCompatibility = (
  stack1: ItemStackEntity,
  stack2: ItemStackEntity
): Effect.Effect<boolean, ItemStackError> =>
  Effect.gen(function* () {
    return yield* pipe(
      Match.value<[ItemStackEntity['nbtData'], ItemStackEntity['nbtData']]>([stack1.nbtData, stack2.nbtData]),
      Match.when(
        ([first, second]) => !first && !second,
        () => Effect.succeed(true)
      ),
      Match.when(
        ([first, second]) => !first || !second,
        () => Effect.succeed(false)
      ),
      Match.orElse(([first, second]) => {
        const enchantments1 = first!.enchantments ?? []
        const enchantments2 = second!.enchantments ?? []

        const enchantmentsEqual = enchantments1.length === enchantments2.length
        const metadataEqual =
          first!.customName === second!.customName &&
          first!.unbreakable === second!.unbreakable &&
          first!.customModelData === second!.customModelData

        return Effect.succeed(enchantmentsEqual && metadataEqual)
      }),
      Match.exhaustive
    )
  })

/**
 * 2つのItemStackが完全に同一かチェック
 */
export const areItemStacksIdentical = (stack1: ItemStackEntity, stack2: ItemStackEntity): boolean => {
  return (
    stack1.itemId === stack2.itemId &&
    stack1.count === stack2.count &&
    stack1.durability === stack2.durability &&
    JSON.stringify(stack1.nbtData) === JSON.stringify(stack2.nbtData) &&
    JSON.stringify(stack1.metadata) === JSON.stringify(stack2.metadata)
  )
}

/**
 * ItemStackがスタック可能かチェック
 */
export const canStackWith = (
  stack1: ItemStackEntity,
  stack2: ItemStackEntity
): Effect.Effect<boolean, ItemStackError> =>
  Effect.gen(function* () {
    // 同じアイテムIDでない場合は不可
    return yield* pipe(
      Match.value(stack1.itemId === stack2.itemId),
      Match.when(false, () => Effect.succeed(false)),
      Match.orElse(() => checkNBTCompatibility(stack1, stack2)),
      Match.exhaustive
    )
  })

/**
 * ItemStackの最大スタック可能数を取得
 */
export const getMaxStackableQuantity = (
  stack1: ItemStackEntity,
  stack2: ItemStackEntity
): Effect.Effect<number, ItemStackError> =>
  Effect.gen(function* () {
    const canStack = yield* canStackWith(stack1, stack2)
    return yield* pipe(
      Match.value(canStack),
      Match.when(false, () => Effect.succeed(0)),
      Match.orElse(() => Effect.succeed(Math.min(stack1.count, ITEM_STACK_CONSTANTS.MAX_STACK_SIZE - stack2.count))),
      Match.exhaustive
    )
  })

/**
 * ItemStackが破損しているかチェック
 */
export const isBroken = (stack: ItemStackEntity): boolean => {
  return pipe(
    Option.fromNullable(stack.durability),
    Match.value,
    Match.tag('None', () => false),
    Match.tag('Some', ({ value }) => value <= ITEM_STACK_CONSTANTS.BROKEN_THRESHOLD),
    Match.exhaustive
  )
}

/**
 * ItemStackがエンチャントされているかチェック
 */
export const isEnchanted = (stack: ItemStackEntity): boolean => {
  return Boolean(stack.nbtData?.enchantments && stack.nbtData.enchantments.length > 0)
}

/**
 * ItemStackが完全な耐久度かチェック
 */
export const isFullDurability = (stack: ItemStackEntity): boolean => {
  return pipe(
    Option.fromNullable(stack.durability),
    Match.value,
    Match.tag('None', () => true),
    Match.tag('Some', ({ value }) => value >= ITEM_STACK_CONSTANTS.MAX_DURABILITY),
    Match.exhaustive
  )
}
