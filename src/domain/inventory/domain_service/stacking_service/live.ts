/**
 * Stacking Service Live Implementation
 *
 * アイテムスタッキングドメインサービスの純粋なドメインロジック実装。
 * Effect-TSパターンに従い、不変性と純粋関数型アプローチを採用。
 */

import { Effect, Layer, Match, pipe } from 'effect'
import type { Inventory, ItemId, ItemStack } from '../../types'
import { checkCompleteStackCompatibility, resolveMetadataConflicts } from './index'
import { StackingError, StackingService, type StackOptimizationOptions, type StackOptimizationResult } from './index'

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

        if (!compatibility.isCompatible) {
          yield* Effect.fail(new StackingError('ITEM_NOT_STACKABLE', compatibility.reason))
        }

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
        const sourceStack = inventory.slots[request.sourceSlot]

        if (sourceStack === null) {
          yield* Effect.fail(new StackingError('INSUFFICIENT_ITEMS', 'Source slot is empty'))
        }

        if (request.splitCount >= sourceStack!.count) {
          yield* Effect.fail(new StackingError('INVALID_ITEM_COUNT', 'Split count exceeds available items'))
        }

        const targetSlot = request.targetSlot === 'auto' ? yield* findEmptySlot(inventory) : request.targetSlot

        if (targetSlot === undefined) {
          yield* Effect.fail(new StackingError('INVENTORY_FULL', 'No available slot for split'))
        }

        const newSlots = [...inventory.slots]

        // 元のスタックを更新
        newSlots[request.sourceSlot] = {
          ...sourceStack!,
          count: sourceStack!.count - request.splitCount,
        }

        // 分割されたスタックを新しいスロットに配置
        const splitStack: ItemStack = {
          ...sourceStack!,
          count: request.splitCount,
          metadata: request.preserveMetadata ? sourceStack!.metadata : undefined,
        }
        newSlots[targetSlot] = splitStack

        return {
          success: true,
          updatedInventory: { ...inventory, slots: newSlots },
          sourceSlot: request.sourceSlot,
          targetSlot,
          originalStack: sourceStack!,
          resultingStacks: [newSlots[request.sourceSlot]!, splitStack],
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
        if (options.consolidatePartialStacks) {
          const consolidationResult = yield* consolidateAllStacks(currentInventory, options)
          currentInventory = consolidationResult.inventory
          stacksConsolidated += consolidationResult.stacksConsolidated
          operations.push(...consolidationResult.operations)
        }

        // カテゴリ別グループ化
        if (options.groupByCategory) {
          const groupingResult = yield* groupItemsByCategory(currentInventory)
          currentInventory = groupingResult.inventory
          operations.push(...groupingResult.operations)
        }

        // 左詰め配置
        if (options.fillFromLeft) {
          const compactionResult = yield* compactInventory(currentInventory)
          currentInventory = compactionResult.inventory
          operations.push(...compactionResult.operations)
        }

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
        const matches: Array<{ slot: number; stack: ItemStack; matchScore: number }> = []

        for (let i = 0; i < inventory.slots.length; i++) {
          const stack = inventory.slots[i]
          if (stack === null) continue

          const score = yield* calculateMatchScore(stack, criteria)
          if (score > 0) {
            matches.push({ slot: i, stack, matchScore: score })
          }
        }

        return matches.sort((a, b) => b.matchScore - a.matchScore)
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
  Effect.gen(function* () {
    for (let i = 0; i < inventory.slots.length; i++) {
      if (inventory.slots[i] === null) {
        return i
      }
    }
    return undefined
  })

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
    let currentInventory = inventory
    let stacksConsolidated = 0
    const operations: StackOptimizationResult['operationsPerformed'] = []

    // アイテムIDごとにグループ化
    const itemGroups = yield* groupStacksByItemId(currentInventory)

    for (const [itemId, slots] of itemGroups) {
      if (slots.length > 1) {
        const consolidationResult = yield* consolidateItemGroup(currentInventory, itemId, slots)
        currentInventory = consolidationResult.inventory
        stacksConsolidated += consolidationResult.stacksConsolidated
        operations.push(...consolidationResult.operations)
      }
    }

    return { inventory: currentInventory, stacksConsolidated, operations }
  })

const groupStacksByItemId = (inventory: Inventory): Effect.Effect<Map<ItemId, number[]>, never> =>
  Effect.gen(function* () {
    const groups = new Map<ItemId, number[]>()

    for (let i = 0; i < inventory.slots.length; i++) {
      const stack = inventory.slots[i]
      if (stack !== null) {
        const existing = groups.get(stack.itemId) ?? []
        existing.push(i)
        groups.set(stack.itemId, existing)
      }
    }

    return groups
  })

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
    let currentInventory = inventory
    let stacksConsolidated = 0
    const operations: StackOptimizationResult['operationsPerformed'] = []

    // 部分的なスタックを統合
    for (let i = 0; i < slots.length - 1; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const sourceSlot = slots[i]
        const targetSlot = slots[j]
        const sourceStack = currentInventory.slots[sourceSlot]
        const targetStack = currentInventory.slots[targetSlot]

        if (sourceStack && targetStack && sourceStack.count + targetStack.count <= 64) {
          // スタック統合実行
          const newSlots = [...currentInventory.slots]
          newSlots[targetSlot] = {
            ...targetStack,
            count: sourceStack.count + targetStack.count,
          }
          newSlots[sourceSlot] = null

          currentInventory = { ...currentInventory, slots: newSlots }
          stacksConsolidated++

          operations.push({
            type: 'CONSOLIDATE',
            sourceSlot,
            targetSlot,
            itemsBefore: sourceStack.count + targetStack.count,
            itemsAfter: newSlots[targetSlot]!.count,
          })
          break
        }
      }
    }

    return { inventory: currentInventory, stacksConsolidated, operations }
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
    const newSlots = [...inventory.slots]
    const operations: StackOptimizationResult['operationsPerformed'] = []
    let writeIndex = 0

    // 非nullアイテムを前詰め
    for (let readIndex = 0; readIndex < newSlots.length; readIndex++) {
      if (newSlots[readIndex] !== null) {
        if (writeIndex !== readIndex) {
          newSlots[writeIndex] = newSlots[readIndex]
          newSlots[readIndex] = null

          operations.push({
            type: 'MOVE',
            sourceSlot: readIndex,
            targetSlot: writeIndex,
            itemsBefore: newSlots[writeIndex]!.count,
            itemsAfter: newSlots[writeIndex]!.count,
          })
        }
        writeIndex++
      }
    }

    return {
      inventory: { ...inventory, slots: newSlots },
      operations,
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
    if (isNonStackable && stack.count > 1) {
      violations.push({
        constraint: 'NON_STACKABLE_ITEM',
        description: `${stack.itemId} cannot be stacked`,
        severity: 'ERROR',
        suggestedFix: 'Split into individual items',
      })
    }

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

    if (criteria.itemId && stack.itemId === criteria.itemId) {
      score += 100
    }

    if (criteria.minCount && stack.count >= criteria.minCount) {
      score += 50
    }

    if (criteria.maxCount && stack.count <= criteria.maxCount) {
      score += 25
    }

    if (criteria.hasEnchantments) {
      const hasEnchantments = stack.metadata?.enchantments && stack.metadata.enchantments.length > 0
      if (hasEnchantments) {
        score += 30
      }
    }

    return score
  })
