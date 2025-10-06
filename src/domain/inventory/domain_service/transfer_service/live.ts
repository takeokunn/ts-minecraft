/**
 * Transfer Service Live Implementation
 *
 * アイテム転送ドメインサービスの純粋なドメインロジック実装。
 * Effect-TSパターンに従い、不変性と純粋関数型アプローチを採用。
 * 外部依存は一切持たない純粋なビジネスロジックとして実装されています。
 */

import { Effect, Array as EffectArray, Layer, Match, pipe } from 'effect'
import type { Inventory, ItemId, ItemStack } from '../../types'
import {
  BatchTransferError,
  TransferError,
  TransferService,
  type OptimizedTransferOptions,
  type TransferRequest,
  type TransferResult,
} from './index'
import { analyzeTransferability, CanTransferSpecification } from './index'

/**
 * 転送サービスのLive実装
 * 純粋なドメインロジックのみを含む
 */
export const TransferServiceLive = Layer.succeed(
  TransferService,
  TransferService.of({
    /**
     * 単一アイテムの転送実行
     */
    transferItem: (request) =>
      Effect.gen(function* () {
        // 転送可能性の事前チェック
        const transferability = yield* analyzeTransferability(request)

        if (!transferability.canTransfer) {
          yield* Effect.fail(
            new TransferError(transferability.reason!, `Cannot transfer item: ${transferability.reason}`)
          )
        }

        // 転送実行
        const sourceItem = request.sourceInventory.slots[request.sourceSlot]!
        const transferCount = request.itemCount ?? sourceItem.count
        const targetSlot = request.targetSlot === 'auto' ? transferability.recommendedTargetSlot! : request.targetSlot

        // ソースインベントリの更新
        const sourceInventory = yield* updateSourceInventory(request.sourceInventory, request.sourceSlot, transferCount)

        // ターゲットインベントリの更新
        const targetInventory = yield* updateTargetInventory(
          request.targetInventory,
          targetSlot,
          sourceItem,
          transferCount
        )

        return {
          success: true,
          sourceInventory,
          targetInventory,
          transferredCount: transferCount,
          remainingCount: sourceItem.count - transferCount,
          targetSlot,
          message: `Successfully transferred ${transferCount} ${sourceItem.itemId}`,
        } as TransferResult
      }),

    /**
     * バッチアイテム転送の実行
     */
    batchTransferItems: (request) =>
      Effect.gen(function* () {
        const results: TransferResult[] = []
        const failedTransfers: Array<{ index: number; error: TransferError }> = []
        let currentSourceInventory = request.sourceInventory
        let currentTargetInventory = request.targetInventory

        // 各転送を順次実行
        for (let i = 0; i < request.transfers.length; i++) {
          const transfer = request.transfers[i]
          const transferRequest: TransferRequest = {
            ...transfer,
            sourceInventory: currentSourceInventory,
            targetInventory: currentTargetInventory,
          }

          try {
            const result = yield* TransferService.transferItem(transferRequest)
            results.push(result)

            // 次の転送のために現在の状態を更新
            currentSourceInventory = result.sourceInventory
            currentTargetInventory = result.targetInventory
          } catch (error) {
            if (error instanceof TransferError) {
              failedTransfers.push({ index: i, error })
            } else {
              failedTransfers.push({
                index: i,
                error: new TransferError('INVENTORY_FULL', 'Unknown error occurred'),
              })
            }
          }
        }

        if (failedTransfers.length > 0) {
          yield* Effect.fail(new BatchTransferError(failedTransfers, results))
        }

        return results
      }),

    /**
     * 転送可能性の事前チェック
     */
    checkTransferability: analyzeTransferability,

    /**
     * 最適化された転送戦略の提案
     */
    generateOptimizedTransferStrategy: (sourceInventory, targetInventory, options) =>
      Effect.gen(function* () {
        const strategy: TransferRequest[] = []

        // 1. スタック統合が有効な場合、同じアイテムの部分的なスタックを優先
        if (options.fillPartialStacks) {
          const partialStackTransfers = yield* generatePartialStackTransfers(sourceInventory, targetInventory)
          strategy.push(...partialStackTransfers)
        }

        // 2. 空きスロットへの転送
        const emptySlotTransfers = yield* generateEmptySlotTransfers(sourceInventory, targetInventory, options)
        strategy.push(...emptySlotTransfers)

        // 3. カテゴリ別整理（オプション）
        if (options.respectItemCategories) {
          const categorizedTransfers = yield* generateCategorizedTransfers(sourceInventory, targetInventory)
          strategy.push(...categorizedTransfers)
        }

        return strategy
      }),

    /**
     * スタック統合転送
     */
    consolidateStacks: (sourceInventory, targetInventory, itemId) =>
      Effect.gen(function* () {
        let consolidatedStacks = 0
        let currentSourceInventory = sourceInventory
        let currentTargetInventory = targetInventory

        // 指定されたアイテムまたは全アイテムを処理
        const itemsToProcess = itemId ? [itemId] : yield* extractUniqueItemIds(sourceInventory)

        for (const currentItemId of itemsToProcess) {
          // 同じアイテムIDのスタックを統合
          const consolidationResult = yield* consolidateItemStacks(
            currentSourceInventory,
            currentTargetInventory,
            currentItemId
          )

          currentSourceInventory = consolidationResult.sourceInventory
          currentTargetInventory = consolidationResult.targetInventory
          consolidatedStacks += consolidationResult.mergedStacks
        }

        return {
          sourceInventory: currentSourceInventory,
          targetInventory: currentTargetInventory,
          consolidatedStacks,
        }
      }),

    /**
     * 智的アイテム分散
     */
    distributeItemsIntelligently: (sourceInventory, targetInventories, distributionRules) =>
      Effect.gen(function* () {
        let currentSourceInventory = sourceInventory
        let currentTargetInventories = [...targetInventories]
        const distributionSummary: Array<{
          readonly inventoryIndex: number
          readonly itemsReceived: number
          readonly slotsUsed: number
        }> = []

        // 優先順位に基づいて分散
        const priorityOrder = distributionRules.priorityOrder ?? EffectArray.range(0, targetInventories.length - 1)

        for (const inventoryIndex of priorityOrder) {
          if (inventoryIndex >= currentTargetInventories.length) continue

          const distributionResult = yield* distributeToSingleInventory(
            currentSourceInventory,
            currentTargetInventories[inventoryIndex],
            distributionRules
          )

          currentSourceInventory = distributionResult.sourceInventory
          currentTargetInventories[inventoryIndex] = distributionResult.targetInventory

          distributionSummary.push({
            inventoryIndex,
            itemsReceived: distributionResult.itemsReceived,
            slotsUsed: distributionResult.slotsUsed,
          })

          // ソースインベントリが空になったら終了
          if (yield* isInventoryEmpty(currentSourceInventory)) {
            break
          }
        }

        return {
          sourceInventory: currentSourceInventory,
          targetInventories: currentTargetInventories,
          distributionSummary,
        }
      }),

    /**
     * 転送パフォーマンス統計
     */
    getTransferPerformanceStats: () =>
      Effect.gen(function* () {
        // 実際の統計は実装時にカウンタを追加
        // 現在はモック実装
        return {
          totalTransfers: 0,
          successfulTransfers: 0,
          failedTransfers: 0,
          averageTransferTime: 0,
          itemsTransferredPerSecond: 0,
          mostFrequentErrorReason: null,
        }
      }),
  })
)

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * ソースインベントリの更新
 */
const updateSourceInventory = (
  inventory: Inventory,
  slotIndex: number,
  transferCount: number
): Effect.Effect<Inventory, TransferError> =>
  Effect.gen(function* () {
    const sourceItem = inventory.slots[slotIndex]

    if (sourceItem === null) {
      yield* Effect.fail(new TransferError('INSUFFICIENT_ITEMS', 'Source slot is empty'))
    }

    const newSlots = [...inventory.slots]

    if (sourceItem!.count === transferCount) {
      // アイテムを全て転送する場合、スロットを空にする
      newSlots[slotIndex] = null
    } else {
      // 一部のみ転送する場合、数量を減らす
      newSlots[slotIndex] = {
        ...sourceItem!,
        count: sourceItem!.count - transferCount,
      }
    }

    return {
      ...inventory,
      slots: newSlots,
    }
  })

/**
 * ターゲットインベントリの更新
 */
const updateTargetInventory = (
  inventory: Inventory,
  slotIndex: number,
  sourceItem: ItemStack,
  transferCount: number
): Effect.Effect<Inventory, TransferError> =>
  Effect.gen(function* () {
    const targetItem = inventory.slots[slotIndex]
    const newSlots = [...inventory.slots]

    if (targetItem === null) {
      // 空きスロットに新しいアイテムを配置
      newSlots[slotIndex] = {
        ...sourceItem,
        count: transferCount,
      }
    } else {
      // 既存のアイテムと結合
      if (targetItem.itemId !== sourceItem.itemId) {
        yield* Effect.fail(new TransferError('ITEM_NOT_STACKABLE', 'Cannot combine different items'))
      }

      newSlots[slotIndex] = {
        ...targetItem,
        count: targetItem.count + transferCount,
      }
    }

    return {
      ...inventory,
      slots: newSlots,
    }
  })

/**
 * 部分的なスタック向けの転送戦略生成
 */
const generatePartialStackTransfers = (
  sourceInventory: Inventory,
  targetInventory: Inventory
): Effect.Effect<TransferRequest[], never> =>
  Effect.gen(function* () {
    const transfers: TransferRequest[] = []

    for (let sourceSlot = 0; sourceSlot < sourceInventory.slots.length; sourceSlot++) {
      const sourceItem = sourceInventory.slots[sourceSlot]
      if (sourceItem === null) continue

      // ターゲットインベントリ内で同じアイテムの部分的なスタックを検索
      for (let targetSlot = 0; targetSlot < targetInventory.slots.length; targetSlot++) {
        const targetItem = targetInventory.slots[targetSlot]

        if (targetItem !== null && targetItem.itemId === sourceItem.itemId && targetItem.count < 64) {
          const transferableCount = Math.min(sourceItem.count, 64 - targetItem.count)

          transfers.push({
            sourceInventory,
            targetInventory,
            sourceSlot,
            targetSlot,
            itemCount: transferableCount,
          })
          break
        }
      }
    }

    return transfers
  })

/**
 * 空きスロット向けの転送戦略生成
 */
const generateEmptySlotTransfers = (
  sourceInventory: Inventory,
  targetInventory: Inventory,
  options: OptimizedTransferOptions
): Effect.Effect<TransferRequest[], never> =>
  Effect.gen(function* () {
    const transfers: TransferRequest[] = []

    for (let sourceSlot = 0; sourceSlot < sourceInventory.slots.length; sourceSlot++) {
      const sourceItem = sourceInventory.slots[sourceSlot]
      if (sourceItem === null) continue

      // 空きスロットを検索
      const emptySlot = yield* findFirstEmptySlot(targetInventory)
      if (emptySlot !== undefined) {
        transfers.push({
          sourceInventory,
          targetInventory,
          sourceSlot,
          targetSlot: emptySlot,
        })
      }
    }

    return transfers
  })

/**
 * カテゴリ別転送戦略生成
 */
const generateCategorizedTransfers = (
  sourceInventory: Inventory,
  targetInventory: Inventory
): Effect.Effect<TransferRequest[], never> =>
  Effect.gen(function* () {
    // アイテムカテゴリ別の最適配置ロジック
    // 現在は基本実装、将来的にアイテムレジストリと連携
    const transfers: TransferRequest[] = []

    for (let sourceSlot = 0; sourceSlot < sourceInventory.slots.length; sourceSlot++) {
      const sourceItem = sourceInventory.slots[sourceSlot]
      if (sourceItem === null) continue

      const preferredSlot = yield* calculatePreferredSlotByCategory(sourceItem.itemId, targetInventory)
      if (preferredSlot !== undefined) {
        transfers.push({
          sourceInventory,
          targetInventory,
          sourceSlot,
          targetSlot: preferredSlot,
        })
      }
    }

    return transfers
  })

/**
 * 特定アイテムのスタック統合
 */
const consolidateItemStacks = (
  sourceInventory: Inventory,
  targetInventory: Inventory,
  itemId: ItemId
): Effect.Effect<
  {
    sourceInventory: Inventory
    targetInventory: Inventory
    mergedStacks: number
  },
  TransferError
> =>
  Effect.gen(function* () {
    let currentSourceInventory = sourceInventory
    let currentTargetInventory = targetInventory
    let mergedStacks = 0

    // ソースインベントリから指定されたアイテムのスロットを取得
    const sourceSlots = yield* findItemSlots(sourceInventory, itemId)

    // ターゲットインベントリから部分的なスタックを取得
    const partialTargetSlots = yield* findPartialStacks(targetInventory, itemId)

    // 部分的なスタックを優先的に埋める
    for (const sourceSlot of sourceSlots) {
      for (const targetSlot of partialTargetSlots) {
        const transferRequest: TransferRequest = {
          sourceInventory: currentSourceInventory,
          targetInventory: currentTargetInventory,
          sourceSlot,
          targetSlot,
        }

        const canTransfer = yield* new CanTransferSpecification().isSatisfiedBy(transferRequest)
        if (canTransfer) {
          const result = yield* TransferService.transferItem(transferRequest)
          currentSourceInventory = result.sourceInventory
          currentTargetInventory = result.targetInventory
          mergedStacks++
          break
        }
      }
    }

    return {
      sourceInventory: currentSourceInventory,
      targetInventory: currentTargetInventory,
      mergedStacks,
    }
  })

/**
 * インベントリが満杯かどうかチェック
 */
const isInventoryFull = (inventory: Inventory): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    return inventory.slots.every((slot) => slot !== null)
  })

/**
 * 単一インベントリへの分散
 */
const distributeToSingleInventory = (
  sourceInventory: Inventory,
  targetInventory: Inventory,
  rules: {
    readonly preferEmptySlots: boolean
    readonly groupSimilarItems: boolean
    readonly respectCapacity: boolean
  }
): Effect.Effect<
  {
    sourceInventory: Inventory
    targetInventory: Inventory
    itemsReceived: number
    slotsUsed: number
  },
  TransferError
> =>
  Effect.gen(function* () {
    let currentSourceInventory = sourceInventory
    let currentTargetInventory = targetInventory
    let itemsReceived = 0
    let slotsUsed = 0

    // 転送可能なアイテムを順次処理
    for (let sourceSlot = 0; sourceSlot < sourceInventory.slots.length; sourceSlot++) {
      if (currentSourceInventory.slots[sourceSlot] === null) continue

      const transferRequest: TransferRequest = {
        sourceInventory: currentSourceInventory,
        targetInventory: currentTargetInventory,
        sourceSlot,
        targetSlot: 'auto',
      }

      const canTransfer = yield* new CanTransferSpecification().isSatisfiedBy(transferRequest)
      if (canTransfer) {
        const result = yield* TransferService.transferItem(transferRequest)
        currentSourceInventory = result.sourceInventory
        currentTargetInventory = result.targetInventory
        itemsReceived += result.transferredCount
        slotsUsed++

        // 容量制限に達したら停止
        if (rules.respectCapacity && (yield* isInventoryFull(currentTargetInventory))) {
          break
        }
      }
    }

    return {
      sourceInventory: currentSourceInventory,
      targetInventory: currentTargetInventory,
      itemsReceived,
      slotsUsed,
    }
  })

/**
 * インベントリからユニークなアイテムIDを抽出
 */
const extractUniqueItemIds = (inventory: Inventory): Effect.Effect<ItemId[], never> =>
  Effect.gen(function* () {
    const itemIds = new Set<ItemId>()

    for (const slot of inventory.slots) {
      if (slot !== null) {
        itemIds.add(slot.itemId)
      }
    }

    return Array.from(itemIds)
  })

/**
 * 最初の空きスロットを検索
 */
const findFirstEmptySlot = (inventory: Inventory): Effect.Effect<number | undefined, never> =>
  Effect.gen(function* () {
    for (let i = 0; i < inventory.slots.length; i++) {
      if (inventory.slots[i] === null) {
        return i
      }
    }
    return undefined
  })

/**
 * 指定されたアイテムIDのスロットを検索
 */
const findItemSlots = (inventory: Inventory, itemId: ItemId): Effect.Effect<number[], never> =>
  Effect.gen(function* () {
    const slots: number[] = []

    for (let i = 0; i < inventory.slots.length; i++) {
      const slot = inventory.slots[i]
      if (slot !== null && slot.itemId === itemId) {
        slots.push(i)
      }
    }

    return slots
  })

/**
 * 部分的なスタックを検索
 */
const findPartialStacks = (inventory: Inventory, itemId: ItemId): Effect.Effect<number[], never> =>
  Effect.gen(function* () {
    const slots: number[] = []

    for (let i = 0; i < inventory.slots.length; i++) {
      const slot = inventory.slots[i]
      if (slot !== null && slot.itemId === itemId && slot.count < 64) {
        slots.push(i)
      }
    }

    return slots
  })

/**
 * インベントリが空かどうかチェック
 */
const isInventoryEmpty = (inventory: Inventory): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    return inventory.slots.every((slot) => slot === null)
  })

/**
 * カテゴリ別の推奨スロット計算
 */
const calculatePreferredSlotByCategory = (
  itemId: ItemId,
  inventory: Inventory
): Effect.Effect<number | undefined, never> =>
  Effect.gen(function* () {
    // アイテムカテゴリ別の配置戦略
    // 現在は基本実装、将来的にアイテムレジストリと連携
    const category = yield* getItemCategory(itemId)

    return pipe(
      category,
      Match.value,
      Match.when('tool', () => findSlotInRange(inventory, 0, 9)), // ホットバー優先
      Match.when('weapon', () => findSlotInRange(inventory, 0, 9)), // ホットバー優先
      Match.when('food', () => findSlotInRange(inventory, 9, 18)), // 上段優先
      Match.when('building', () => findSlotInRange(inventory, 18, 36)), // 下段優先
      Match.orElse(() => undefined)
    )
  })

/**
 * アイテムカテゴリを取得
 */
const getItemCategory = (itemId: ItemId): Effect.Effect<'tool' | 'weapon' | 'food' | 'building' | 'misc', never> =>
  Effect.gen(function* () {
    return pipe(
      itemId,
      Match.value,
      Match.when(
        (s) => s.includes('sword') || s.includes('bow'),
        () => 'weapon' as const
      ),
      Match.when(
        (s) => s.includes('pickaxe') || s.includes('axe') || s.includes('shovel'),
        () => 'tool' as const
      ),
      Match.when(
        (s) => s.includes('bread') || s.includes('meat') || s.includes('apple'),
        () => 'food' as const
      ),
      Match.when(
        (s) => s.includes('stone') || s.includes('wood') || s.includes('dirt'),
        () => 'building' as const
      ),
      Match.orElse(() => 'misc' as const)
    )
  })

/**
 * 指定範囲内で空きスロットを検索
 */
const findSlotInRange = (inventory: Inventory, startIndex: number, endIndex: number): number | undefined => {
  for (let i = startIndex; i < Math.min(endIndex, inventory.slots.length); i++) {
    if (inventory.slots[i] === null) {
      return i
    }
  }
  return undefined
}
