/**
 * Stacking Service Live Implementation
 *
 * アイテムスタッキングドメインサービスの純粋なドメインロジック実装。
 * Effect-TSパターンに従い、不変性と純粋関数型アプローチを採用。
 */

import { Effect, Layer, Match, Option, pipe, ReadonlyArray } from 'effect'
import type { Inventory, ItemId, ItemStack } from '../../types'
import {
  checkCompleteStackCompatibility,
  resolveMetadataConflicts,
  StackingError,
  StackingService,
  type StackOptimizationOptions,
  type StackOptimizationResult,
} from './index'

/**
 * スタッキングサービスのLive実装
 */
export const StackingServiceLive = Layer.succeed(
  StackingService,
  StackingService.of({
    /**
     * スタック互換性チェック
     */
    checkStackCompatibility: checkCompleteStackCompatibility,

    /**
     * スタック結合実行
     */
    combineStacks: (sourceStack, targetStack, resolutionStrategy = 'USE_TARGET') =>
      Effect.gen(function* () {
        const compatibility = yield* checkCompleteStackCompatibility(sourceStack, targetStack)

        yield* Effect.when(
          () => !compatibility.isCompatible,
          () => Effect.fail(new StackingError('ITEM_NOT_STACKABLE', compatibility.reason))
        )

        // メタデータ解決
        const resolvedMetadata = compatibility.requiresMetadataConsolidation
          ? yield* resolveMetadataConflicts(
              sourceStack.metadata ?? {},
              targetStack.metadata ?? {},
              compatibility.metadataConflicts
            )
          : targetStack.metadata

        const totalCount = sourceStack.count + targetStack.count
        const maxAllowed = compatibility.maxCombinedCount

        const combinedStack: ItemStack = {
          itemId: targetStack.itemId,
          count: Math.min(totalCount, maxAllowed),
          metadata: resolvedMetadata,
          durability: calculateDurabilityAverage(sourceStack, targetStack),
        }

        const remainingSource =
          totalCount > maxAllowed
            ? {
                ...sourceStack,
                count: totalCount - maxAllowed,
              }
            : null

        return {
          combinedStack,
          remainingSource,
          metadataResolutions: compatibility.metadataConflicts,
        }
      }),

    /**
     * スタック分割実行
     */
    splitStack: (inventory, request) =>
      Effect.gen(function* () {
        const sourceStackOption = Option.fromNullable(inventory.slots[request.sourceSlot])

        const sourceStack = yield* pipe(
          sourceStackOption,
          Effect.fromOption,
          Effect.mapError(() => new StackingError('INSUFFICIENT_ITEMS', 'Source slot is empty'))
        )

        yield* Effect.when(
          () => request.splitCount >= sourceStack.count,
          () => Effect.fail(new StackingError('INVALID_ITEM_COUNT', 'Split count exceeds available items'))
        )

        const targetSlotMaybe = request.targetSlot === 'auto' ? yield* findEmptySlot(inventory) : request.targetSlot

        const targetSlot = yield* pipe(
          Option.fromNullable(targetSlotMaybe),
          Effect.fromOption,
          Effect.mapError(() => new StackingError('INVENTORY_FULL', 'No available slot for split'))
        )

        const newSlots = [...inventory.slots]

        // 元のスタックを更新
        const updatedSourceStack: ItemStack = {
          ...sourceStack,
          count: sourceStack.count - request.splitCount,
        }
        newSlots[request.sourceSlot] = updatedSourceStack

        // 分割されたスタックを新しいスロットに配置
        const splitStack: ItemStack = {
          ...sourceStack,
          count: request.splitCount,
          metadata: request.preserveMetadata ? sourceStack.metadata : undefined,
        }
        newSlots[targetSlot] = splitStack

        return {
          success: true,
          updatedInventory: { ...inventory, slots: newSlots },
          sourceSlot: request.sourceSlot,
          targetSlot,
          originalStack: sourceStack,
          resultingStacks: [updatedSourceStack, splitStack],
        }
      }),

    /**
     * インベントリスタック最適化
     */
    optimizeInventoryStacks: (inventory, options) =>
      Effect.gen(function* () {
        let currentInventory = inventory
        let stacksConsolidated = 0
        const operations: StackOptimizationResult['operationsPerformed'] = []
        const warnings: string[] = []

        // 同じアイテムのスタック統合
        yield* Effect.when(
          () => options.consolidatePartialStacks,
          () =>
            Effect.gen(function* () {
              const consolidationResult = yield* consolidateAllStacks(currentInventory, options)
              currentInventory = consolidationResult.inventory
              stacksConsolidated += consolidationResult.stacksConsolidated
              operations.push(...consolidationResult.operations)
            })
        )

        // カテゴリ別グループ化
        yield* Effect.when(
          () => options.groupByCategory,
          () =>
            Effect.gen(function* () {
              const groupingResult = yield* groupItemsByCategory(currentInventory)
              currentInventory = groupingResult.inventory
              operations.push(...groupingResult.operations)
            })
        )

        // 左詰め配置
        yield* Effect.when(
          () => options.fillFromLeft,
          () =>
            Effect.gen(function* () {
              const compactionResult = yield* compactInventory(currentInventory)
              currentInventory = compactionResult.inventory
              operations.push(...compactionResult.operations)
            })
        )

        const spaceSaved =
          inventory.slots.filter((s) => s === null).length - currentInventory.slots.filter((s) => s === null).length

        return {
          optimizedInventory: currentInventory,
          stacksConsolidated,
          spaceSaved,
          operationsPerformed: operations,
          warnings,
        }
      }),

    /**
     * 智的スタック配置提案
     */
    suggestIntelligentStackArrangement: (inventory, usageStatistics) =>
      Effect.gen(function* () {
        // 使用頻度とカテゴリに基づく最適配置
        const arrangement = yield* generateIntelligentArrangement(inventory, usageStatistics)

        return {
          recommendedInventory: arrangement.inventory,
          improvements: arrangement.improvements,
          alternativeArrangements: arrangement.alternatives,
        }
      }),

    /**
     * スタック制約検証
     */
    validateStackConstraints: (stack) =>
      Effect.gen(function* () {
        const violations: Array<{
          constraint: string
          description: string
          severity: 'ERROR' | 'WARNING' | 'INFO'
          suggestedFix?: string
        }> = []

        // スタック数制限チェック
        if (stack.count > 64) {
          violations.push({
            constraint: 'MAX_STACK_SIZE',
            description: `Stack count ${stack.count} exceeds maximum 64`,
            severity: 'ERROR',
            suggestedFix: 'Split the stack into multiple stacks',
          })
        }

        // アイテム固有制約チェック
        const itemConstraints = yield* checkItemSpecificConstraints(stack)
        violations.push(...itemConstraints)

        return violations
      }),

    /**
     * 高速スタック検索
     */
    findStacksWithCriteria: (inventory, criteria) =>
      Effect.gen(function* () {
        const matches = yield* pipe(
          inventory.slots,
          ReadonlyArray.mapWithIndex((stack, i) => ({ stack, index: i })),
          Effect.forEach(
            ({ stack, index }) =>
              stack !== null
                ? Effect.gen(function* () {
                    const score = yield* calculateMatchScore(stack, criteria)
                    return score > 0 ? Option.some({ slot: index, stack, matchScore: score }) : Option.none()
                  })
                : Effect.succeed(Option.none()),
            { concurrency: 4 }
          ),
          Effect.map(ReadonlyArray.getSomes)
        )

        return pipe(
          matches,
          ReadonlyArray.sort((a, b) => b.matchScore - a.matchScore)
        )
      }),

    /**
     * パフォーマンス統計
     */
    getStackingPerformanceStats: () =>
      Effect.gen(function* () {
        return {
          totalStackOperations: 0,
          averageStackTime: 0,
          stacksConsolidatedPerSecond: 0,
          memoryUsageBytes: 0,
          cacheHitRate: 0,
          mostFrequentErrorType: null,
        }
      }),
  })
)

// =============================================================================
// Helper Functions
// =============================================================================

const calculateDurabilityAverage = (sourceStack: ItemStack, targetStack: ItemStack): number | undefined => {
  const sourceDur = sourceStack.durability ?? 1.0
  const targetDur = targetStack.durability ?? 1.0
  const totalCount = sourceStack.count + targetStack.count

  return (sourceDur * sourceStack.count + targetDur * targetStack.count) / totalCount
}

const findEmptySlot = (inventory: Inventory): Effect.Effect<number | undefined, never> =>
  Effect.succeed(
    pipe(
      inventory.slots,
      ReadonlyArray.findFirstIndex((slot) => slot === null),
      Option.getOrUndefined
    )
  )

const consolidateAllStacks = (
  inventory: Inventory,
  options: StackOptimizationOptions
): Effect.Effect<
  {
    inventory: Inventory
    stacksConsolidated: number
    operations: StackOptimizationResult['operationsPerformed']
  },
  never
> =>
  Effect.gen(function* () {
    // アイテムIDごとにグループ化
    const itemGroups = yield* groupStacksByItemId(inventory)

    const result = yield* pipe(
      Array.from(itemGroups.entries()),
      ReadonlyArray.filter(([_, slots]) => slots.length > 1),
      Effect.reduce(
        {
          inventory,
          stacksConsolidated: 0,
          operations: [] as const satisfies StackOptimizationResult['operationsPerformed'],
        },
        (acc, [itemId, slots]) =>
          Effect.gen(function* () {
            const consolidationResult = yield* consolidateItemGroup(acc.inventory, itemId, slots)
            return {
              inventory: consolidationResult.inventory,
              stacksConsolidated: acc.stacksConsolidated + consolidationResult.stacksConsolidated,
              operations: [...acc.operations, ...consolidationResult.operations],
            }
          })
      )
    )

    return result
  })

const groupStacksByItemId = (inventory: Inventory): Effect.Effect<Map<ItemId, number[]>, never> =>
  Effect.succeed(
    pipe(
      inventory.slots,
      ReadonlyArray.mapWithIndex((stack, i) => ({ stack, index: i })),
      ReadonlyArray.filter(({ stack }) => stack !== null),
      ReadonlyArray.reduce(new Map<ItemId, number[]>(), (groups, { stack, index }) => {
        return pipe(
          Option.fromNullable(stack),
          Option.match({
            onNone: () => groups,
            onSome: (itemStack) => {
              const existing = groups.get(itemStack.itemId) ?? []
              existing.push(index)
              groups.set(itemStack.itemId, existing)
              return groups
            },
          })
        )
      })
    )
  )

const consolidateItemGroup = (
  inventory: Inventory,
  itemId: ItemId,
  slots: number[]
): Effect.Effect<
  {
    inventory: Inventory
    stacksConsolidated: number
    operations: StackOptimizationResult['operationsPerformed']
  },
  never
> =>
  Effect.gen(function* () {
    // 部分的なスタックを統合
    // ネストループをReadonlyArray.flatMapで展開してペア生成
    const pairs = pipe(
      slots,
      ReadonlyArray.flatMap((sourceSlot, i) =>
        pipe(
          slots.slice(i + 1),
          ReadonlyArray.map((targetSlot) => ({ sourceSlot, targetSlot }))
        )
      )
    )

    const result = yield* pipe(
      pairs,
      Effect.reduce(
        {
          inventory,
          stacksConsolidated: 0,
          operations: [] as const satisfies StackOptimizationResult['operationsPerformed'],
          shouldContinue: true,
        },
        (acc, { sourceSlot, targetSlot }) =>
          Effect.gen(function* () {
            if (!acc.shouldContinue) {
              return acc
            }

            const sourceStack = acc.inventory.slots[sourceSlot]
            const targetStack = acc.inventory.slots[targetSlot]

            if (sourceStack && targetStack && sourceStack.count + targetStack.count <= 64) {
              // スタック統合実行
              const newSlots = [...acc.inventory.slots]
              const consolidatedStack = {
                ...targetStack,
                count: sourceStack.count + targetStack.count,
              }
              newSlots[targetSlot] = consolidatedStack
              newSlots[sourceSlot] = null

              const newOperation = {
                type: 'CONSOLIDATE' as const,
                sourceSlot,
                targetSlot,
                itemsBefore: sourceStack.count + targetStack.count,
                itemsAfter: consolidatedStack.count,
              }

              return {
                inventory: { ...acc.inventory, slots: newSlots },
                stacksConsolidated: acc.stacksConsolidated + 1,
                operations: [...acc.operations, newOperation],
                shouldContinue: false, // 1回統合したらbreak
              }
            }

            return acc
          })
      )
    )

    return {
      inventory: result.inventory,
      stacksConsolidated: result.stacksConsolidated,
      operations: result.operations,
    }
  })

const groupItemsByCategory = (
  inventory: Inventory
): Effect.Effect<
  {
    inventory: Inventory
    operations: StackOptimizationResult['operationsPerformed']
  },
  never
> =>
  Effect.gen(function* () {
    // カテゴリ別グループ化のモック実装
    return {
      inventory,
      operations: [],
    }
  })

const compactInventory = (
  inventory: Inventory
): Effect.Effect<
  {
    inventory: Inventory
    operations: StackOptimizationResult['operationsPerformed']
  },
  never
> =>
  Effect.gen(function* () {
    // 非nullアイテムを前詰め
    const result = yield* pipe(
      inventory.slots,
      ReadonlyArray.mapWithIndex((slot, readIndex) => ({ slot, readIndex })),
      Effect.reduce(
        {
          newSlots: [...inventory.slots],
          operations: [] as const satisfies StackOptimizationResult['operationsPerformed'],
          writeIndex: 0,
        },
        (acc, { slot, readIndex }) =>
          Effect.gen(function* () {
            // Option.matchによるnullチェック
            return yield* pipe(
              Option.fromNullable(slot),
              Option.match({
                onNone: () => Effect.succeed(acc),
                onSome: (stackSlot) =>
                  pipe(
                    Match.value(acc.writeIndex !== readIndex),
                    Match.when(true, () =>
                      Effect.sync(() => {
                        acc.newSlots[acc.writeIndex] = acc.newSlots[readIndex]
                        acc.newSlots[readIndex] = null

                        acc.operations.push({
                          type: 'MOVE',
                          sourceSlot: readIndex,
                          targetSlot: acc.writeIndex,
                          itemsBefore: stackSlot.count,
                          itemsAfter: stackSlot.count,
                        })

                        return {
                          ...acc,
                          writeIndex: acc.writeIndex + 1,
                        }
                      })
                    ),
                    Match.orElse(() =>
                      Effect.succeed({
                        ...acc,
                        writeIndex: acc.writeIndex + 1,
                      })
                    )
                  ),
              })
            )
          })
      )
    )

    return {
      inventory: { ...inventory, slots: result.newSlots },
      operations: result.operations,
    }
  })

const generateIntelligentArrangement = (
  inventory: Inventory,
  usageStatistics?: {
    readonly frequentlyUsedItems: ReadonlyArray<ItemId>
    readonly recentlyUsedItems: ReadonlyArray<ItemId>
    readonly preferredCategories: ReadonlyArray<string>
  }
): Effect.Effect<
  {
    inventory: Inventory
    improvements: ReadonlyArray<{
      description: string
      impact: 'HIGH' | 'MEDIUM' | 'LOW'
      category: 'EFFICIENCY' | 'ORGANIZATION' | 'SPACE'
    }>
    alternatives: ReadonlyArray<Inventory>
  },
  never
> =>
  Effect.gen(function* () {
    // 智的配置のモック実装
    return {
      inventory,
      improvements: [
        {
          description: 'Move frequently used items to hotbar',
          impact: 'HIGH' as const,
          category: 'EFFICIENCY' as const,
        },
      ],
      alternatives: [],
    }
  })

const checkItemSpecificConstraints = (
  stack: ItemStack
): Effect.Effect<
  Array<{
    constraint: string
    description: string
    severity: 'ERROR' | 'WARNING' | 'INFO'
    suggestedFix?: string
  }>,
  never
> =>
  Effect.gen(function* () {
    const violations: Array<{
      constraint: string
      description: string
      severity: 'ERROR' | 'WARNING' | 'INFO'
      suggestedFix?: string
    }> = []

    // アイテム固有の制約をチェック
    const isNonStackable = yield* checkIfNonStackable(stack.itemId)
    yield* Effect.when(
      () => isNonStackable && stack.count > 1,
      () =>
        Effect.sync(() => {
          violations.push({
            constraint: 'NON_STACKABLE_ITEM',
            description: `${stack.itemId} cannot be stacked`,
            severity: 'ERROR',
            suggestedFix: 'Split into individual items',
          })
        })
    )

    return violations
  })

const checkIfNonStackable = (itemId: ItemId): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    return pipe(
      itemId,
      Match.value,
      Match.when(
        (s) => s.includes('sword'),
        () => true
      ),
      Match.when(
        (s) => s.includes('pickaxe'),
        () => true
      ),
      Match.when(
        (s) => s.includes('armor'),
        () => true
      ),
      Match.orElse(() => false)
    )
  })

const calculateMatchScore = (
  stack: ItemStack,
  criteria: Parameters<StackingService['findStacksWithCriteria']>[1]
): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    let score = 0

    yield* Effect.when(
      () => criteria.itemId && stack.itemId === criteria.itemId,
      () =>
        Effect.sync(() => {
          score += 100
        })
    )

    yield* Effect.when(
      () => criteria.minCount && stack.count >= criteria.minCount,
      () =>
        Effect.sync(() => {
          score += 50
        })
    )

    yield* Effect.when(
      () => criteria.maxCount && stack.count <= criteria.maxCount,
      () =>
        Effect.sync(() => {
          score += 25
        })
    )

    yield* Effect.when(
      () => criteria.hasEnchantments,
      () =>
        Effect.gen(function* () {
          const hasEnchantments = stack.metadata?.enchantments && stack.metadata.enchantments.length > 0
          yield* Effect.when(
            () => hasEnchantments,
            () =>
              Effect.sync(() => {
                score += 30
              })
          )
        })
    )

    return score
  })
