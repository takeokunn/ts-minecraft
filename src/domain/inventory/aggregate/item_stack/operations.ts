/**
 * @fileoverview ItemStackエンティティのドメイン操作
 * merge, split, consume等の核となるビジネスロジック
 */

import { Clock, Effect, Option } from 'effect'
import { incrementEntityVersion, ItemStackFactory } from './factory'
import type {
  Durability,
  ItemCount,
  ItemStackConsumedEvent,
  ItemStackDamageEvent,
  ItemStackEntity,
  ItemStackMergedEvent,
  ItemStackSplitEvent,
} from './types'
import { ITEM_STACK_CONSTANTS, ItemStackError } from './types'

// ===== Core Operations =====

/**
 * 2つのItemStackをマージ（同じアイテムID必須）
 */
export const mergeItemStacks = (
  sourceStack: ItemStackEntity,
  targetStack: ItemStackEntity
): Effect.Effect<{ readonly mergedStack: ItemStackEntity; readonly event: ItemStackMergedEvent }, ItemStackError> =>
  Effect.gen(function* () {
    // 同じアイテムIDかチェック
    if (sourceStack.itemId !== targetStack.itemId) {
      yield* Effect.fail(ItemStackError.incompatibleItems(sourceStack.id, targetStack.id))
    }

    // NBTデータの互換性チェック
    const isCompatible = yield* checkNBTCompatibility(sourceStack, targetStack)
    if (!isCompatible) {
      yield* Effect.fail(
        new ItemStackError({
          reason: 'NBT_MISMATCH',
          message: 'NBTデータが互換性がありません',
          stackId: sourceStack.id,
        })
      )
    }

    const totalCount = sourceStack.count + targetStack.count

    // スタックサイズ上限チェック
    if (totalCount > ITEM_STACK_CONSTANTS.MAX_STACK_SIZE) {
      yield* Effect.fail(ItemStackError.mergeOverflow(sourceStack.id, targetStack.id, totalCount))
    }

    // マージされたスタックを作成
    const versionedTarget = yield* incrementEntityVersion(targetStack)
    const mergedStack: ItemStackEntity = {
      ...versionedTarget,
      count: totalCount as ItemCount,
    }

    const timestamp = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())
    const event: ItemStackMergedEvent = {
      type: 'ItemStackMerged',
      sourceStackId: sourceStack.id,
      targetStackId: targetStack.id,
      itemId: sourceStack.itemId,
      mergedQuantity: sourceStack.count,
      finalQuantity: totalCount as ItemCount,
      timestamp: timestamp as any,
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
    if (splitQuantity <= 0 || splitQuantity >= sourceStack.count) {
      yield* Effect.fail(ItemStackError.splitUnderflow(sourceStack.id, splitQuantity))
    }

    const remainingQuantity = sourceStack.count - splitQuantity

    // 残りスタックを更新
    const versionedSource = yield* incrementEntityVersion(sourceStack)
    const remainingStack: ItemStackEntity = {
      ...versionedSource,
      count: remainingQuantity as ItemCount,
    }

    // 新しいスタックを作成
    const factory = yield* ItemStackFactory
    const newStack = yield* factory.create(sourceStack.itemId, splitQuantity as ItemCount, {
      durability: sourceStack.durability,
      nbtData: sourceStack.nbtData,
      metadata: sourceStack.metadata,
    })

    const timestamp = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())
    const event: ItemStackSplitEvent = {
      type: 'ItemStackSplit',
      sourceStackId: sourceStack.id,
      newStackId: newStack.id,
      itemId: sourceStack.itemId,
      splitQuantity: splitQuantity as ItemCount,
      remainingQuantity: remainingQuantity as ItemCount,
      timestamp: timestamp as any,
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
    if (quantity <= 0) {
      yield* Effect.fail(
        new ItemStackError({
          reason: 'INVALID_STACK_SIZE',
          message: `不正な消費数量: ${quantity}`,
          stackId: stack.id,
          quantity: quantity as ItemCount,
        })
      )
    }

    if (quantity > stack.count) {
      yield* Effect.fail(ItemStackError.insufficientQuantity(stack.id, quantity, stack.count))
    }

    const remainingQuantity = stack.count - quantity

    const timestamp = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())
    const event: ItemStackConsumedEvent = {
      type: 'ItemStackConsumed',
      stackId: stack.id,
      itemId: stack.itemId,
      consumedQuantity: quantity as ItemCount,
      remainingQuantity: remainingQuantity as ItemCount,
      timestamp: timestamp as any,
      reason,
    }

    // 完全に消費された場合
    if (remainingQuantity === 0) {
      return { updatedStack: Option.none(), event }
    }

    // 一部消費の場合
    const versionedStack = yield* incrementEntityVersion(stack)
    const updatedStack: ItemStackEntity = {
      ...versionedStack,
      count: remainingQuantity as ItemCount,
    }

    return { updatedStack: Option.some(updatedStack), event }
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
    // 耐久度が設定されていない場合はエラー
    if (!stack.durability) {
      yield* Effect.fail(
        new ItemStackError({
          reason: 'INVALID_DURABILITY',
          message: '耐久度が設定されていないアイテムです',
          stackId: stack.id,
        })
      )
    }

    // ダメージ量の検証
    if (damageAmount < 0 || damageAmount > 1) {
      yield* Effect.fail(
        new ItemStackError({
          reason: 'INVALID_DURABILITY',
          message: `不正なダメージ量: ${damageAmount}`,
          stackId: stack.id,
        })
      )
    }

    const previousDurability = stack.durability!
    const newDurability = Math.max(0, previousDurability - damageAmount)
    const isBroken = newDurability <= ITEM_STACK_CONSTANTS.BROKEN_THRESHOLD

    const timestamp = yield* Effect.map(Clock.currentTimeMillis, (ms) => new Date(ms).toISOString())
    const event: ItemStackDamageEvent = {
      type: 'ItemStackDamaged',
      stackId: stack.id,
      itemId: stack.itemId,
      previousDurability: previousDurability,
      newDurability: newDurability as Durability,
      damageAmount,
      timestamp: timestamp as any,
      broken: isBroken,
    }

    // アイテムが破損した場合
    if (isBroken) {
      return { updatedStack: Option.none(), event }
    }

    // 耐久度を更新
    const versionedStack = yield* incrementEntityVersion(stack)
    const updatedStack: ItemStackEntity = {
      ...versionedStack,
      durability: newDurability as Durability,
    }

    return { updatedStack: Option.some(updatedStack), event }
  })

/**
 * アイテムの耐久度を修復
 */
export const repairItemStack = (
  stack: ItemStackEntity,
  repairAmount: number
): Effect.Effect<ItemStackEntity, ItemStackError> =>
  Effect.gen(function* () {
    // 耐久度が設定されていない場合はエラー
    if (!stack.durability) {
      yield* Effect.fail(
        new ItemStackError({
          reason: 'INVALID_DURABILITY',
          message: '耐久度が設定されていないアイテムです',
          stackId: stack.id,
        })
      )
    }

    // 修復量の検証
    if (repairAmount < 0 || repairAmount > 1) {
      yield* Effect.fail(
        new ItemStackError({
          reason: 'INVALID_DURABILITY',
          message: `不正な修復量: ${repairAmount}`,
          stackId: stack.id,
        })
      )
    }

    const newDurability = Math.min(ITEM_STACK_CONSTANTS.MAX_DURABILITY, stack.durability! + repairAmount)

    const versionedStack = yield* incrementEntityVersion(stack)
    return {
      ...versionedStack,
      durability: newDurability as Durability,
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
    // 両方ともNBTデータがない場合は互換性あり
    if (!stack1.nbtData && !stack2.nbtData) {
      return true
    }

    // 片方のみNBTデータがある場合は互換性なし
    if (!stack1.nbtData || !stack2.nbtData) {
      return false
    }

    // エンチャントの比較
    const enchantments1 = stack1.nbtData.enchantments || []
    const enchantments2 = stack2.nbtData.enchantments || []

    if (enchantments1.length !== enchantments2.length) {
      return false
    }

    // 他の重要なNBTデータの比較
    if (
      stack1.nbtData.customName !== stack2.nbtData.customName ||
      stack1.nbtData.unbreakable !== stack2.nbtData.unbreakable ||
      stack1.nbtData.customModelData !== stack2.nbtData.customModelData
    ) {
      return false
    }

    return true
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
    if (stack1.itemId !== stack2.itemId) {
      return false
    }

    // NBTデータの互換性チェック
    return yield* checkNBTCompatibility(stack1, stack2)
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

    if (!canStack) {
      return 0
    }

    return Math.min(stack1.count, ITEM_STACK_CONSTANTS.MAX_STACK_SIZE - stack2.count)
  })

/**
 * ItemStackが破損しているかチェック
 */
export const isBroken = (stack: ItemStackEntity): boolean => {
  if (!stack.durability) {
    return false
  }
  return stack.durability <= ITEM_STACK_CONSTANTS.BROKEN_THRESHOLD
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
  if (!stack.durability) {
    return true // 耐久度がないアイテムは常に"完全"
  }
  return stack.durability >= ITEM_STACK_CONSTANTS.MAX_DURABILITY
}
