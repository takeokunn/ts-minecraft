/**
 * Transfer Service Live Implementation
 *
 * アイテム転送ドメインサービスの純粋なドメインロジック実装。
 * Effect-TSパターンに従い、不変性と純粋関数型アプローチを採用。
 * 外部依存は一切持たない純粋なビジネスロジックとして実装されています。
 */

import { Effect, Array as EffectArray, Layer, Match, Option, pipe, ReadonlyArray } from 'effect'
import type { Inventory, ItemId, ItemStack } from '../../types'
import {
  analyzeTransferability,
  BatchTransferError,
  CanTransferSpecification,
  TransferError,
  TransferService,
  type OptimizedTransferOptions,
  type TransferRequest,
  type TransferResult,
} from './index'

// 型ガード: 転送失敗型
type TransferFailure = {
  readonly failed: true
  readonly index: number
  readonly error: TransferError
}

const isTransferFailure = (result: TransferResult | TransferFailure): result is TransferFailure =>
  'failed' in result && result.failed === true

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

        yield* pipe(
          Match.value(transferability.canTransfer),
          Match.when(false, () =>
            Effect.fail(new TransferError(transferability.reason!, `Cannot transfer item: ${transferability.reason}`))
          ),
          Match.when(true, () => Effect.void),
          Match.exhaustive
        )

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
        const result = yield* pipe(
          request.transfers,
          ReadonlyArray.mapWithIndex((i, transfer) => ({ i, transfer })),
          Effect.reduce(
            {
              sourceInventory: request.sourceInventory,
              targetInventory: request.targetInventory,
              results: [] as const satisfies readonly TransferResult[],
              failedTransfers: [] as const satisfies ReadonlyArray<{ index: number; error: TransferError }>,
            },
            (acc, { i, transfer }) =>
              Effect.gen(function* () {
                const transferRequest: TransferRequest = {
                  ...transfer,
                  sourceInventory: acc.sourceInventory,
                  targetInventory: acc.targetInventory,
                }

                const transferResult = yield* pipe(
                  TransferService.transferItem(transferRequest),
                  Effect.catchAll((error) =>
                    Effect.succeed({
                      failed: true,
                      index: i,
                      error:
                        error instanceof TransferError
                          ? error
                          : new TransferError('INVENTORY_FULL', 'Unknown error occurred'),
                    })
                  )
                )

                // 型ガードを使用した型安全な分岐
                if (isTransferFailure(transferResult)) {
                  return Effect.succeed({
                    ...acc,
                    failedTransfers: [
                      ...acc.failedTransfers,
                      { index: transferResult.index, error: transferResult.error },
                    ],
                  })
                }

                return Effect.succeed({
                  sourceInventory: transferResult.sourceInventory,
                  targetInventory: transferResult.targetInventory,
                  results: [...acc.results, transferResult],
                  failedTransfers: acc.failedTransfers,
                })
              })
          )
        )

        // Effect.whenパターン: 配列長チェック
        yield* Effect.when(result.failedTransfers.length > 0, () =>
          Effect.fail(new BatchTransferError(result.failedTransfers, result.results))
        )

        return result.results
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
        // Effect.whenパターン: オプションフラグ
        yield* Effect.when(options.fillPartialStacks, () =>
          Effect.gen(function* () {
            const partialStackTransfers = yield* generatePartialStackTransfers(sourceInventory, targetInventory)
            strategy.push(...partialStackTransfers)
          })
        )

        // 2. 空きスロットへの転送
        const emptySlotTransfers = yield* generateEmptySlotTransfers(sourceInventory, targetInventory, options)
        strategy.push(...emptySlotTransfers)

        // 3. カテゴリ別整理（オプション）
        // Effect.whenパターン: オプションフラグ
        yield* Effect.when(options.respectItemCategories, () =>
          Effect.gen(function* () {
            const categorizedTransfers = yield* generateCategorizedTransfers(sourceInventory, targetInventory)
            strategy.push(...categorizedTransfers)
          })
        )

        return strategy
      }),

    /**
     * スタック統合転送
     */
    consolidateStacks: (sourceInventory, targetInventory, itemId) =>
      Effect.gen(function* () {
        const itemsToProcess = itemId ? [itemId] : yield* extractUniqueItemIds(sourceInventory)

        const result = yield* pipe(
          itemsToProcess,
          Effect.reduce(
            {
              sourceInventory,
              targetInventory,
              consolidatedStacks: 0,
            },
            (acc, currentItemId) =>
              Effect.gen(function* () {
                const consolidationResult = yield* consolidateItemStacks(
                  acc.sourceInventory,
                  acc.targetInventory,
                  currentItemId
                )

                return {
                  sourceInventory: consolidationResult.sourceInventory,
                  targetInventory: consolidationResult.targetInventory,
                  consolidatedStacks: acc.consolidatedStacks + consolidationResult.mergedStacks,
                }
              })
          )
        )

        return result
      }),

    /**
     * 智的アイテム分散
     */
    distributeItemsIntelligently: (sourceInventory, targetInventories, distributionRules) =>
      Effect.gen(function* () {
        const priorityOrder = distributionRules.priorityOrder ?? EffectArray.range(0, targetInventories.length - 1)

        const result = yield* pipe(
          priorityOrder,
          ReadonlyArray.filter((index) => index < targetInventories.length),
          Effect.reduce(
            {
              sourceInventory,
              targetInventories: [...targetInventories],
              distributionSummary: [] as const satisfies ReadonlyArray<{
                readonly inventoryIndex: number
                readonly itemsReceived: number
                readonly slotsUsed: number
              }>,
            },
            (acc, inventoryIndex) =>
              Effect.gen(function* () {
                const isEmpty = yield* isInventoryEmpty(acc.sourceInventory)

                // Match.whenによる早期return（空の場合）
                return yield* pipe(
                  Match.value(isEmpty),
                  Match.when(true, () => Effect.succeed(acc)),
                  Match.orElse(() =>
                    Effect.gen(function* () {
                      const distributionResult = yield* distributeToSingleInventory(
                        acc.sourceInventory,
                        acc.targetInventories[inventoryIndex],
                        distributionRules
                      )

                      const newTargetInventories = [...acc.targetInventories]
                      newTargetInventories[inventoryIndex] = distributionResult.targetInventory

                      return {
                        sourceInventory: distributionResult.sourceInventory,
                        targetInventories: newTargetInventories,
                        distributionSummary: [
                          ...acc.distributionSummary,
                          {
                            inventoryIndex,
                            itemsReceived: distributionResult.itemsReceived,
                            slotsUsed: distributionResult.slotsUsed,
                          },
                        ],
                      }
                    })
                  )
                )
              })
          )
        )

        return result
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

    // Option.matchパターン: nullチェック早期return
    const validSourceItem = yield* pipe(
      Option.fromNullable(sourceItem),
      Option.match({
        onNone: () => Effect.fail(new TransferError('INSUFFICIENT_ITEMS', 'Source slot is empty')),
        onSome: (item) => Effect.succeed(item),
      })
    )

    const newSlots = [...inventory.slots]

    // Match.valueパターン: 数値比較
    yield* pipe(
      Match.value(validSourceItem.count === transferCount),
      Match.when(true, () =>
        Effect.sync(() => {
          // アイテムを全て転送する場合、スロットを空にする
          newSlots[slotIndex] = null
        })
      ),
      Match.when(false, () =>
        Effect.sync(() => {
          // 一部のみ転送する場合、数量を減らす
          newSlots[slotIndex] = {
            ...validSourceItem,
            count: validSourceItem.count - transferCount,
          }
        })
      ),
      Match.exhaustive
    )

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

    // Option.matchパターン: nullチェック
    yield* pipe(
      Option.fromNullable(targetItem),
      Option.match({
        onNone: () =>
          Effect.sync(() => {
            // 空きスロットに新しいアイテムを配置
            newSlots[slotIndex] = {
              ...sourceItem,
              count: transferCount,
            }
          }),
        onSome: (item) =>
          Effect.gen(function* () {
            // 既存のアイテムと結合
            yield* pipe(
              Match.value(item.itemId !== sourceItem.itemId),
              Match.when(true, () =>
                Effect.fail(new TransferError('ITEM_NOT_STACKABLE', 'Cannot combine different items'))
              ),
              Match.when(false, () =>
                Effect.sync(() => {
                  newSlots[slotIndex] = {
                    ...item,
                    count: item.count + transferCount,
                  }
                })
              ),
              Match.exhaustive
            )
          }),
      })
    )

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
    const transfers = yield* pipe(
      sourceInventory.slots,
      ReadonlyArray.filterMapWithIndex((sourceSlot, sourceItem) =>
        // Option.matchパターン: nullチェック早期return
        pipe(
          Option.fromNullable(sourceItem),
          Option.flatMap((item) => {
            const targetSlot = pipe(
              targetInventory.slots,
              ReadonlyArray.findFirstIndex(
                (targetItem) => targetItem !== null && targetItem.itemId === item.itemId && targetItem.count < 64
              ),
              Option.getOrUndefined
            )

            // Option.matchパターン: undefinedチェック早期return
            return pipe(
              Option.fromNullable(targetSlot),
              Option.map((slot) => {
                const targetItem = targetInventory.slots[slot]!
                const transferableCount = Math.min(item.count, 64 - targetItem.count)

                return {
                  sourceInventory,
                  targetInventory,
                  sourceSlot,
                  targetSlot: slot,
                  itemCount: transferableCount,
                }
              })
            )
          })
        )
      )
    )

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
    const transfers = yield* pipe(
      sourceInventory.slots,
      ReadonlyArray.filterMapWithIndex((sourceSlot, sourceItem) =>
        // Option.matchパターン: nullチェック早期return
        pipe(
          Option.fromNullable(sourceItem),
          Option.match({
            onNone: () => Effect.succeed(Option.none()),
            onSome: (_item) =>
              Effect.gen(function* () {
                const emptySlot = yield* findFirstEmptySlot(targetInventory)

                // Option.matchパターン: undefinedチェック早期return
                return pipe(
                  Option.fromNullable(emptySlot),
                  Option.map((slot) => ({
                    sourceInventory,
                    targetInventory,
                    sourceSlot,
                    targetSlot: slot,
                  }))
                )
              }),
          })
        )
      ),
      Effect.all,
      Effect.map(ReadonlyArray.getSomes)
    )

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
    const transfers = yield* pipe(
      sourceInventory.slots,
      ReadonlyArray.filterMapWithIndex((sourceSlot, sourceItem) =>
        // Option.matchパターン: nullチェック早期return
        pipe(
          Option.fromNullable(sourceItem),
          Option.match({
            onNone: () => Effect.succeed(Option.none()),
            onSome: (item) =>
              Effect.gen(function* () {
                const preferredSlot = yield* calculatePreferredSlotByCategory(item.itemId, targetInventory)

                // Option.matchパターン: undefinedチェック早期return
                return pipe(
                  Option.fromNullable(preferredSlot),
                  Option.map((slot) => ({
                    sourceInventory,
                    targetInventory,
                    sourceSlot,
                    targetSlot: slot,
                  }))
                )
              }),
          })
        )
      ),
      Effect.all,
      Effect.map(ReadonlyArray.getSomes)
    )

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
    const sourceSlots = yield* findItemSlots(sourceInventory, itemId)
    const partialTargetSlots = yield* findPartialStacks(targetInventory, itemId)

    const result = yield* pipe(
      sourceSlots,
      Effect.reduce(
        {
          sourceInventory,
          targetInventory,
          mergedStacks: 0,
        },
        (acc, sourceSlot) =>
          Effect.gen(function* () {
            const targetResult = yield* pipe(
              partialTargetSlots,
              Effect.reduce({ transferred: false, currentAcc: acc }, (innerAcc, targetSlot) =>
                Effect.gen(function* () {
                  // Effect.whenパターン: 早期return（既に転送済み）
                  yield* Effect.when(innerAcc.transferred, () => Effect.void)

                  // Match.whenによる転送済みチェック
                  return yield* pipe(
                    Match.value(innerAcc.transferred),
                    Match.when(true, () => Effect.succeed(innerAcc)),
                    Match.orElse(() =>
                      Effect.gen(function* () {
                        const transferRequest: TransferRequest = {
                          sourceInventory: innerAcc.currentAcc.sourceInventory,
                          targetInventory: innerAcc.currentAcc.targetInventory,
                          sourceSlot,
                          targetSlot,
                        }

                        const canTransfer = yield* new CanTransferSpecification().isSatisfiedBy(transferRequest)

                        // Match.whenによるcanTransfer判定
                        return yield* pipe(
                          Match.value(canTransfer),
                          Match.when(true, () =>
                            Effect.gen(function* () {
                              const result = yield* TransferService.transferItem(transferRequest)
                              return {
                                transferred: true,
                                currentAcc: {
                                  sourceInventory: result.sourceInventory,
                                  targetInventory: result.targetInventory,
                                  mergedStacks: innerAcc.currentAcc.mergedStacks + 1,
                                },
                              }
                            })
                          ),
                          Match.orElse(() => Effect.succeed(innerAcc))
                        )
                      })
                    )
                  )
                })
              )
            )

            return targetResult.currentAcc
          })
      )
    )

    return result
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
    const result = yield* pipe(
      pipe(
        sourceInventory.slots,
        ReadonlyArray.mapWithIndex((sourceSlot, _) => sourceSlot)
      ),
      Effect.reduce(
        {
          sourceInventory,
          targetInventory,
          itemsReceived: 0,
          slotsUsed: 0,
        },
        (acc, sourceSlot) =>
          Effect.gen(function* () {
            // Option.matchパターン: nullチェック早期return
            const slotItem = acc.sourceInventory.slots[sourceSlot]
            const hasItem = Option.fromNullable(slotItem)

            return yield* pipe(
              hasItem,
              Option.match({
                onNone: () => Effect.succeed(acc),
                onSome: (_item) =>
                  Effect.gen(function* () {
                    // Match.whenによるrespectCapacity判定
                    const shouldCheckCapacity = rules.respectCapacity
                    const isFull = shouldCheckCapacity ? yield* isInventoryFull(acc.targetInventory) : false

                    return yield* pipe(
                      Match.value(isFull),
                      Match.when(true, () => Effect.succeed(acc)),
                      Match.orElse(() =>
                        Effect.gen(function* () {
                          const transferRequest: TransferRequest = {
                            sourceInventory: acc.sourceInventory,
                            targetInventory: acc.targetInventory,
                            sourceSlot,
                            targetSlot: 'auto',
                          }

                          const canTransfer = yield* new CanTransferSpecification().isSatisfiedBy(transferRequest)

                          // Match.whenによるcanTransfer判定
                          return yield* pipe(
                            Match.value(canTransfer),
                            Match.when(true, () =>
                              Effect.gen(function* () {
                                const result = yield* TransferService.transferItem(transferRequest)
                                return {
                                  sourceInventory: result.sourceInventory,
                                  targetInventory: result.targetInventory,
                                  itemsReceived: acc.itemsReceived + result.transferredCount,
                                  slotsUsed: acc.slotsUsed + 1,
                                }
                              })
                            ),
                            Match.orElse(() => Effect.succeed(acc))
                          )
                        })
                      )
                    )
                  }),
              })
            )
          })
      )
    )

    return result
  })

/**
 * インベントリからユニークなアイテムIDを抽出
 */
const extractUniqueItemIds = (inventory: Inventory): Effect.Effect<ItemId[], never> =>
  Effect.gen(function* () {
    const itemIds = new Set<ItemId>()

    yield* Effect.forEach(
      inventory.slots,
      (slot) =>
        // Option.matchパターン: nullチェック
        pipe(
          Option.fromNullable(slot),
          Option.match({
            onNone: () => Effect.void,
            onSome: (item) =>
              Effect.sync(() => {
                itemIds.add(item.itemId)
              }),
          })
        ),
      { concurrency: 4 }
    )

    return Array.from(itemIds)
  })

/**
 * 最初の空きスロットを検索
 */
const findFirstEmptySlot = (inventory: Inventory): Effect.Effect<number | undefined, never> =>
  Effect.gen(function* () {
    return pipe(
      inventory.slots,
      ReadonlyArray.findFirstIndex((slot) => slot === null),
      Option.getOrElse(() => undefined)
    )
  })

/**
 * 指定されたアイテムIDのスロットを検索
 */
const findItemSlots = (inventory: Inventory, itemId: ItemId): Effect.Effect<number[], never> =>
  Effect.gen(function* () {
    return pipe(
      inventory.slots,
      ReadonlyArray.filterMapWithIndex((i, slot) =>
        slot !== null && slot.itemId === itemId ? Option.some(i) : Option.none()
      )
    )
  })

/**
 * 部分的なスタックを検索
 */
const findPartialStacks = (inventory: Inventory, itemId: ItemId): Effect.Effect<number[], never> =>
  Effect.gen(function* () {
    return pipe(
      inventory.slots,
      ReadonlyArray.filterMapWithIndex((i, slot) =>
        slot !== null && slot.itemId === itemId && slot.count < 64 ? Option.some(i) : Option.none()
      )
    )
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
  return pipe(
    ReadonlyArray.range(startIndex, Math.min(endIndex, inventory.slots.length) - 1),
    ReadonlyArray.findFirst((i) => inventory.slots[i] === null),
    Option.getOrUndefined
  )
}
