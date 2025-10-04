import { Effect, Match, pipe, Schema } from 'effect'
import { getMaxStackSize, isStackable } from './constraints'
import { MaxStackSizeSchema, StackSizeSchema } from './schema'
import {
  MaxStackSize,
  SplitResult,
  StackabilityResult,
  StackOperation,
  StackOperationResult,
  StackSize,
  StackSizeError,
  StackStats,
} from './types'

/**
 * StackSize ファクトリー関数
 */
export const createStackSize = (size: number): Effect.Effect<StackSize, StackSizeError> =>
  pipe(
    Schema.decodeUnknown(StackSizeSchema)(size),
    Effect.mapError(() =>
      StackSizeError.InvalidSize({
        size,
        min: 1,
        max: 64,
      })
    )
  )

/**
 * MaxStackSize ファクトリー関数
 */
export const createMaxStackSize = (
  size: number,
  category: 'single' | 'tool' | 'food' | 'material' | 'block'
): Effect.Effect<MaxStackSize, StackSizeError> =>
  pipe(
    Schema.decodeUnknown(MaxStackSizeSchema)(size),
    Effect.mapError(() =>
      StackSizeError.InvalidMaxSize({
        maxSize: size,
        category,
        allowedRange: [1, 64],
      })
    )
  )

/**
 * スタックサイズを加算
 */
export const addToStack = (
  current: StackSize,
  addition: StackSize,
  maxSize: MaxStackSize
): Effect.Effect<StackOperationResult, StackSizeError> =>
  Effect.gen(function* () {
    const newTotal = (current as number) + (addition as number)

    if (newTotal <= (maxSize as number)) {
      const newSize = yield* createStackSize(newTotal)
      return StackOperationResult.Success({ newSize })
    }

    const overflow = yield* createStackSize(newTotal - (maxSize as number))
    return StackOperationResult.Overflow({
      maxSize: maxSize as StackSize,
      overflow,
    })
  })

/**
 * スタックサイズから減算
 */
export const removeFromStack = (
  current: StackSize,
  removal: StackSize
): Effect.Effect<StackOperationResult, StackSizeError> =>
  Effect.gen(function* () {
    const currentNum = current as number
    const removalNum = removal as number

    if (removalNum > currentNum) {
      return StackOperationResult.Underflow({
        currentSize: current,
        requested: removal,
      })
    }

    const newSize = currentNum - removalNum
    if (newSize === 0) {
      // スタックが空になった場合
      return StackOperationResult.Success({
        newSize: 1 as StackSize, // 最小値は1なので、空の場合は特別な処理が必要
      })
    }

    const validNewSize = yield* createStackSize(newSize)
    return StackOperationResult.Success({ newSize: validNewSize })
  })

/**
 * スタックを分割
 */
export const splitStack = (stack: StackSize, ratio: number): Effect.Effect<SplitResult, StackSizeError> =>
  Effect.gen(function* () {
    if (ratio <= 0 || ratio >= 1) {
      return yield* Effect.fail(
        StackSizeError.InvalidRatio({
          ratio,
          expected: 'between 0 and 1',
        })
      )
    }

    const stackNum = stack as number
    const part1Size = Math.floor(stackNum * ratio)
    const part2Size = stackNum - part1Size

    if (part1Size === 0 || part2Size === 0) {
      return yield* Effect.fail(
        StackSizeError.InvalidRatio({
          ratio,
          expected: 'ratio that results in both parts being at least 1',
        })
      )
    }

    const part1 = yield* createStackSize(part1Size)
    const part2 = yield* createStackSize(part2Size)

    return {
      original: stack,
      parts: [part1, part2],
      totalParts: 2,
    }
  })

/**
 * 複数スタックに分割
 */
export const splitIntoMultiple = (stack: StackSize, partCount: number): Effect.Effect<SplitResult, StackSizeError> =>
  Effect.gen(function* () {
    if (partCount <= 0) {
      return yield* Effect.fail(
        StackSizeError.InvalidRatio({
          ratio: partCount,
          expected: 'positive integer',
        })
      )
    }

    const stackNum = stack as number
    if (partCount > stackNum) {
      return yield* Effect.fail(
        StackSizeError.InvalidRatio({
          ratio: partCount,
          expected: `at most ${stackNum}`,
        })
      )
    }

    const baseSize = Math.floor(stackNum / partCount)
    const remainder = stackNum % partCount

    const parts: StackSize[] = []

    // 基本サイズの部分を作成
    for (let i = 0; i < partCount - remainder; i++) {
      parts.push(yield* createStackSize(baseSize))
    }

    // 余りを分配
    for (let i = 0; i < remainder; i++) {
      parts.push(yield* createStackSize(baseSize + 1))
    }

    return {
      original: stack,
      parts,
      totalParts: partCount,
    }
  })

/**
 * 2つのスタックをマージ
 */
export const mergeStacks = (
  stack1: StackSize,
  stack2: StackSize,
  maxSize: MaxStackSize
): Effect.Effect<StackOperationResult, StackSizeError> => addToStack(stack1, stack2, maxSize)

/**
 * 複数のスタックを効率的にマージ
 */
export const mergeMultipleStacks = (
  stacks: readonly StackSize[],
  maxSize: MaxStackSize
): Effect.Effect<readonly StackSize[], StackSizeError> =>
  Effect.gen(function* () {
    if (stacks.length === 0) {
      return []
    }

    const result: StackSize[] = []
    let currentStack = stacks[0]

    for (let i = 1; i < stacks.length; i++) {
      const mergeResult = yield* mergeStacks(currentStack, stacks[i], maxSize)

      yield* pipe(
        mergeResult,
        Match.value,
        Match.tag('Success', (success) =>
          Effect.gen(function* () {
            if (success.overflow) {
              result.push(success.newSize)
              currentStack = success.overflow
            } else {
              currentStack = success.newSize
            }
          })
        ),
        Match.tag('Overflow', (overflow) =>
          Effect.gen(function* () {
            result.push(overflow.maxSize)
            currentStack = overflow.overflow
          })
        ),
        Match.orElse(() => Effect.void),
        Match.exhaustive
      )
    }

    result.push(currentStack)
    return result
  })

/**
 * 2つのスタックがスタック可能かを判定
 */
export const canStack = (
  stack1: StackSize,
  stack2: StackSize,
  itemId1: string,
  itemId2: string
): Effect.Effect<StackabilityResult, StackSizeError> =>
  Effect.gen(function* () {
    // アイテムIDが異なる場合はスタック不可
    if (itemId1 !== itemId2) {
      return StackabilityResult.NotStackable({
        reason: `Different item types: ${itemId1} vs ${itemId2}`,
      })
    }

    // アイテムがスタック可能でない場合
    if (!isStackable(itemId1)) {
      return StackabilityResult.NotStackable({
        reason: `Item ${itemId1} is not stackable`,
      })
    }

    const maxSize = getMaxStackSize(itemId1)
    const combinedSize = (stack1 as number) + (stack2 as number)

    if (combinedSize <= (maxSize as number)) {
      const newSize = yield* createStackSize(combinedSize)
      return StackabilityResult.FullyStackable({ combinedSize: newSize })
    }

    const stackedSize = yield* createStackSize(maxSize as number)
    const remainder = yield* createStackSize(combinedSize - (maxSize as number))

    return StackabilityResult.PartiallyStackable({
      stackedSize,
      remainder,
    })
  })

/**
 * スタック操作を実行
 */
export const executeStackOperation = (
  stack: StackSize,
  operation: StackOperation,
  maxSize: MaxStackSize
): Effect.Effect<StackOperationResult, StackSizeError> =>
  pipe(
    operation,
    Match.value,
    Match.tag('Add', (add) => addToStack(stack, add.amount, maxSize)),
    Match.tag('Remove', (remove) => removeFromStack(stack, remove.amount)),
    Match.tag('Split', (split) =>
      Effect.gen(function* () {
        const splitResult = yield* splitStack(stack, split.ratio)
        return StackOperationResult.Success({
          newSize: splitResult.parts[0],
          overflow: splitResult.parts[1],
        })
      })
    ),
    Match.tag('Merge', (merge) => mergeStacks(stack, merge.otherStack, maxSize)),
    Match.tag('SetMax', (setMax) =>
      Effect.gen(function* () {
        const stackNum = stack as number
        const newMaxNum = setMax.newMax as number

        if (stackNum <= newMaxNum) {
          return StackOperationResult.Success({ newSize: stack })
        }

        const newSize = yield* createStackSize(newMaxNum)
        const overflow = yield* createStackSize(stackNum - newMaxNum)

        return StackOperationResult.Overflow({
          maxSize: newSize,
          overflow,
        })
      })
    ),
    Match.exhaustive
  )

/**
 * スタック統計を計算
 */
export const calculateStackStats = (
  stacks: readonly StackSize[],
  maxStackSize: MaxStackSize
): Effect.Effect<StackStats, StackSizeError> =>
  Effect.gen(function* () {
    if (stacks.length === 0) {
      return {
        totalStacks: 0,
        totalItems: 0,
        averageStackSize: 0,
        maxPossibleStacks: 0,
        efficiency: 0,
      }
    }

    const totalStacks = stacks.length
    const totalItems = stacks.reduce((sum, stack) => sum + (stack as number), 0)
    const averageStackSize = totalItems / totalStacks
    const maxPossibleStacks = Math.ceil(totalItems / (maxStackSize as number))
    const efficiency = maxPossibleStacks / totalStacks

    return {
      totalStacks,
      totalItems,
      averageStackSize,
      maxPossibleStacks,
      efficiency,
    }
  })

/**
 * スタックの最適化（効率的な配置）
 */
export const optimizeStacks = (
  stacks: readonly StackSize[],
  maxStackSize: MaxStackSize
): Effect.Effect<readonly StackSize[], StackSizeError> =>
  Effect.gen(function* () {
    const totalItems = stacks.reduce((sum, stack) => sum + (stack as number), 0)
    const maxSizeNum = maxStackSize as number

    const fullStacks = Math.floor(totalItems / maxSizeNum)
    const remainderSize = totalItems % maxSizeNum

    const result: StackSize[] = []

    // フルサイズのスタックを作成
    for (let i = 0; i < fullStacks; i++) {
      result.push(yield* createStackSize(maxSizeNum))
    }

    // 余りがあれば追加
    if (remainderSize > 0) {
      result.push(yield* createStackSize(remainderSize))
    }

    return result
  })

/**
 * スタックサイズの比較
 */
export const compareStackSizes = (stack1: StackSize, stack2: StackSize): number => {
  return (stack1 as number) - (stack2 as number)
}

/**
 * スタックが満杯かどうかを判定
 */
export const isFull = (stack: StackSize, maxSize: MaxStackSize): boolean => (stack as number) === (maxSize as number)

/**
 * スタックが空かどうかを判定（1が最小値なので、実質的には存在チェック）
 */
export const isEmpty = (stack: StackSize): boolean => (stack as number) === 1

/**
 * 利用可能な容量を計算
 */
export const getAvailableCapacity = (stack: StackSize, maxSize: MaxStackSize): number =>
  (maxSize as number) - (stack as number)
