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
 * Brand型から数値を安全に抽出するヘルパー関数群
 * Schema.make(Schema.Number)を使用してBrand型を数値に変換
 */

/** StackSizeを数値に変換 */
const stackSizeToNumber = (value: StackSize): number => Schema.make(Schema.Number)(value)

/** MaxStackSizeを数値に変換 */
const maxStackSizeToNumber = (value: MaxStackSize): number => Schema.make(Schema.Number)(value)

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
    const currentSize = stackSizeToNumber(current)
    const additionSize = stackSizeToNumber(addition)
    const maxSizeValue = maxStackSizeToNumber(maxSize)

    // バリデーション: 追加量が正の数値であること
    yield* Effect.succeed(additionSize).pipe(
      Effect.filterOrFail(
        (size) => !Number.isNaN(size) && size > 0,
        () =>
          StackSizeError.InvalidOperation({
            operation: StackOperation.Add({ amount: addition }),
            reason: '追加量が0以下です',
          })
      )
    )

    // バリデーション: 追加量が最大値を超えていないこと
    yield* Effect.succeed(additionSize).pipe(
      Effect.filterOrFail(
        (size) => size <= maxSizeValue,
        () =>
          StackSizeError.ExceedsLimit({
            current,
            addition,
            limit: maxSize,
          })
      )
    )

    const newTotal = currentSize + additionSize

    // 条件分岐: 新しい合計が最大値以下か、オーバーフローするか
    return yield* pipe(
      newTotal <= maxSizeValue,
      Match.value,
      Match.when(true, () =>
        Effect.gen(function* () {
          const newSize = yield* createStackSize(newTotal)
          return StackOperationResult.Success({ newSize })
        })
      ),
      Match.when(false, () =>
        Effect.gen(function* () {
          const overflowAmount = newTotal - maxSizeValue
          const overflow = yield* createStackSize(overflowAmount)
          const capped = yield* createStackSize(maxSizeValue)

          return StackOperationResult.Overflow({
            maxSize: capped,
            overflow,
          })
        })
      ),
      Match.exhaustive
    )
  })

/**
 * スタックサイズから減算
 */
export const removeFromStack = (
  current: StackSize,
  removal: StackSize
): Effect.Effect<StackOperationResult, StackSizeError> =>
  Effect.gen(function* () {
    const currentNum = stackSizeToNumber(current)
    const removalNum = stackSizeToNumber(removal)

    // バリデーション: 減算量が正の数値であること
    yield* Effect.succeed(removalNum).pipe(
      Effect.filterOrFail(
        (num) => num > 0,
        () =>
          StackSizeError.InvalidOperation({
            operation: StackOperation.Remove({ amount: removal }),
            reason: '減算量が0以下です',
          })
      )
    )

    // 条件分岐: アンダーフローチェック
    return yield* pipe(
      removalNum > currentNum,
      Match.value,
      Match.when(true, () =>
        Effect.succeed(
          StackOperationResult.Underflow({
            currentSize: current,
            requested: removal,
          })
        )
      ),
      Match.when(false, () =>
        Effect.gen(function* () {
          const newSize = currentNum - removalNum

          // 条件分岐: 0になった場合は最小値1に設定
          return yield* pipe(
            newSize === 0,
            Match.value,
            Match.when(true, () =>
              Effect.gen(function* () {
                const minSize = yield* createStackSize(1)
                return StackOperationResult.Success({ newSize: minSize })
              })
            ),
            Match.when(false, () =>
              Effect.gen(function* () {
                const validNewSize = yield* createStackSize(newSize)
                return StackOperationResult.Success({ newSize: validNewSize })
              })
            ),
            Match.exhaustive
          )
        })
      ),
      Match.exhaustive
    )
  })

/**
 * スタックを分割
 */
export const splitStack = (stack: StackSize, ratio: number): Effect.Effect<SplitResult, StackSizeError> =>
  Effect.gen(function* () {
    // バリデーション: 比率が0と1の間の小数であること
    yield* Effect.succeed(ratio).pipe(
      Effect.filterOrFail(
        (r) => r > 0 && r < 1,
        () =>
          StackSizeError.InvalidRatio({
            ratio,
            expected: '0と1の間の小数',
          })
      )
    )

    const stackNum = stackSizeToNumber(stack)
    const part1Size = Math.floor(stackNum * ratio)
    const part2Size = stackNum - part1Size

    // バリデーション: 両方の分割結果が1以上であること
    yield* Effect.succeed({ part1Size, part2Size }).pipe(
      Effect.filterOrFail(
        ({ part1Size, part2Size }) => part1Size > 0 && part2Size > 0,
        () =>
          StackSizeError.InvalidRatio({
            ratio,
            expected: '両方の分割結果が1以上になる比率',
          })
      )
    )

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
    // バリデーション: partCountが正の整数であること
    yield* Effect.succeed(partCount).pipe(
      Effect.filterOrFail(
        (count) => Number.isSafeInteger(count) && count > 0,
        () =>
          StackSizeError.InvalidRatio({
            ratio: partCount,
            expected: '正の整数',
          })
      )
    )

    const stackNum = stackSizeToNumber(stack)

    // バリデーション: partCountがstackNum以下であること
    yield* Effect.succeed(partCount).pipe(
      Effect.filterOrFail(
        (count) => count <= stackNum,
        () =>
          StackSizeError.InvalidRatio({
            ratio: partCount,
            expected: `最大でも${stackNum}以下`,
          })
      )
    )

    const baseSize = Math.floor(stackNum / partCount)
    const remainder = stackNum % partCount

    const parts = yield* Effect.forEachWithIndex(Array.from({ length: partCount }), (index) =>
      createStackSize(baseSize + (index >= partCount - remainder ? 1 : 0))
    )

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
    // 早期return: 空配列の場合は空配列を返す
    return yield* pipe(
      stacks.length === 0,
      Match.value,
      Match.when(true, () => Effect.succeed([] as const)),
      Match.when(false, () =>
        Effect.gen(function* () {
          const initialMerged: StackSize[] = []
          return yield* Effect.reduce(
            stacks.slice(1),
            {
              merged: initialMerged,
              carry: stacks[0]!,
            },
            (acc, stack) =>
              Effect.gen(function* () {
                const mergeResult = yield* mergeStacks(acc.carry, stack, maxSize)

                return yield* pipe(
                  mergeResult,
                  Match.value,
                  Match.tag('Success', (success) =>
                    Effect.succeed({
                      merged: acc.merged,
                      carry: success.newSize,
                    })
                  ),
                  Match.tag('Overflow', (overflow) =>
                    Effect.succeed({
                      merged: [...acc.merged, overflow.maxSize],
                      carry: overflow.overflow,
                    })
                  ),
                  Match.tag('Underflow', () =>
                    Effect.fail(
                      StackSizeError.InvalidOperation({
                        operation: StackOperation.Merge({ otherStack: stack }),
                        reason: 'スタックのマージ中に不整合が発生しました',
                      })
                    )
                  ),
                  Match.tag('InvalidOperation', (invalid) => Effect.fail(StackSizeError.InvalidOperation(invalid))),
                  Match.exhaustive
                )
              })
          ).pipe(Effect.flatMap(({ merged, carry }) => Effect.succeed([...merged, carry] as const)))
        })
      ),
      Match.exhaustive
    )
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
    // 早期return: アイテムIDが異なる場合はスタック不可
    return yield* pipe(
      itemId1 !== itemId2,
      Match.value,
      Match.when(true, () =>
        Effect.succeed(
          StackabilityResult.NotStackable({
            reason: `Different item types: ${itemId1} vs ${itemId2}`,
          })
        )
      ),
      Match.when(false, () =>
        Effect.gen(function* () {
          // 早期return: アイテムがスタック可能でない場合
          return yield* pipe(
            !isStackable(itemId1),
            Match.value,
            Match.when(true, () =>
              Effect.succeed(
                StackabilityResult.NotStackable({
                  reason: `Item ${itemId1} is not stackable`,
                })
              )
            ),
            Match.when(false, () =>
              Effect.gen(function* () {
                const maxSize = getMaxStackSize(itemId1)
                const combinedSize = stackSizeToNumber(stack1) + stackSizeToNumber(stack2)
                const maxSizeNum = maxStackSizeToNumber(maxSize)

                // 条件分岐: 完全スタック可能か部分スタック可能か
                return yield* pipe(
                  combinedSize <= maxSizeNum,
                  Match.value,
                  Match.when(true, () =>
                    Effect.gen(function* () {
                      const newSize = yield* createStackSize(combinedSize)
                      return StackabilityResult.FullyStackable({ combinedSize: newSize })
                    })
                  ),
                  Match.when(false, () =>
                    Effect.gen(function* () {
                      const stackedSize = yield* createStackSize(maxSizeNum)
                      const remainder = yield* createStackSize(combinedSize - maxSizeNum)

                      return StackabilityResult.PartiallyStackable({
                        stackedSize,
                        remainder,
                      })
                    })
                  ),
                  Match.exhaustive
                )
              })
            ),
            Match.exhaustive
          )
        })
      ),
      Match.exhaustive
    )
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
      pipe(
        splitStack(stack, split.ratio),
        Effect.map((splitResult) =>
          StackOperationResult.Success({
            newSize: splitResult.parts[0],
            overflow: splitResult.parts[1],
          })
        )
      )
    ),
    Match.tag('Merge', (merge) => mergeStacks(stack, merge.otherStack, maxSize)),
    Match.tag('SetMax', (setMax) =>
      Effect.gen(function* () {
        const stackNum = stackSizeToNumber(stack)
        const newMaxNum = maxStackSizeToNumber(setMax.newMax)

        // バリデーション: 新しい最大値が1以上であること
        yield* Effect.succeed(newMaxNum).pipe(
          Effect.filterOrFail(
            (num) => num > 0,
            () =>
              StackSizeError.InvalidOperation({
                operation,
                reason: '最大値は1以上である必要があります',
              })
          )
        )

        // 条件分岐: スタックサイズが新しい最大値以下か、オーバーフローするか
        return yield* pipe(
          stackNum <= newMaxNum,
          Match.value,
          Match.when(true, () => Effect.succeed(StackOperationResult.Success({ newSize: stack }))),
          Match.when(false, () =>
            Effect.gen(function* () {
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
    // 早期return: 空配列の場合は統計ゼロを返す
    return yield* pipe(
      stacks.length === 0,
      Match.value,
      Match.when(true, () =>
        Effect.succeed({
          totalStacks: 0,
          totalItems: 0,
          averageStackSize: 0,
          maxPossibleStacks: 0,
          efficiency: 0,
        } as const)
      ),
      Match.when(false, () =>
        Effect.gen(function* () {
          const numbers = stacks.map(stackSizeToNumber)

          // バリデーション: 全てのスタックサイズが正の数値であること
          yield* Effect.succeed(numbers).pipe(
            Effect.filterOrFail(
              (nums) => !nums.some((value) => value <= 0),
              () =>
                StackSizeError.InvalidOperation({
                  operation: StackOperation.Split({ ratio: 0.5 }),
                  reason: 'スタックサイズに0以下の値が含まれています',
                })
            )
          )

          const totalStacks = numbers.length
          const totalItems = numbers.reduce((sum, value) => sum + value, 0)
          const averageStackSize = totalItems / totalStacks
          const maxPossibleStacks = Math.ceil(totalItems / maxStackSizeToNumber(maxStackSize))
          const efficiency = maxPossibleStacks / totalStacks

          return {
            totalStacks,
            totalItems,
            averageStackSize,
            maxPossibleStacks,
            efficiency,
          } as const
        })
      ),
      Match.exhaustive
    )
  })

/**
 * スタックの最適化（効率的な配置）
 */
export const optimizeStacks = (
  stacks: readonly StackSize[],
  maxStackSize: MaxStackSize
): Effect.Effect<readonly StackSize[], StackSizeError> =>
  Effect.gen(function* () {
    // 早期return: 空配列の場合は空配列を返す
    return yield* pipe(
      stacks.length === 0,
      Match.value,
      Match.when(true, () => Effect.succeed([] as const)),
      Match.when(false, () =>
        Effect.gen(function* () {
          const maxSizeNum = maxStackSizeToNumber(maxStackSize)
          const totalItems = stacks.reduce((sum, stack) => sum + stackSizeToNumber(stack), 0)

          const fullStackCount = Math.floor(totalItems / maxSizeNum)
          const remainder = totalItems % maxSizeNum

          const fullStacks = yield* Effect.forEach(Array.from({ length: fullStackCount }), () =>
            createStackSize(maxSizeNum)
          )

          const emptyStacks: StackSize[] = []
          const remainderStacks = remainder > 0 ? [yield* createStackSize(remainder)] : emptyStacks

          return [...fullStacks, ...remainderStacks] as const
        })
      ),
      Match.exhaustive
    )
  })

/**
 * スタックサイズの比較
 */
export const compareStackSizes = (stack1: StackSize, stack2: StackSize): number =>
  stackSizeToNumber(stack1) - stackSizeToNumber(stack2)

/**
 * スタックが満杯かどうかを判定
 */
export const isFull = (stack: StackSize, maxSize: MaxStackSize): boolean =>
  stackSizeToNumber(stack) === maxStackSizeToNumber(maxSize)

/**
 * スタックが空かどうかを判定（1が最小値なので、実質的には存在チェック）
 */
export const isEmpty = (stack: StackSize): boolean => stackSizeToNumber(stack) === 1

/**
 * 利用可能な容量を計算
 */
export const getAvailableCapacity = (stack: StackSize, maxSize: MaxStackSize): number =>
  maxStackSizeToNumber(maxSize) - stackSizeToNumber(stack)
