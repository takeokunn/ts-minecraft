/**
 * Transfer Service Specifications
 *
 * アイテム移動可能性の仕様（Specification Pattern）。
 * ドメインルールを明示的にカプセル化し、複雑な条件判定を
 * 再利用可能な仕様として定義します。
 */

import { Effect, Array as EffectArray, Match, Option, pipe, ReadonlyArray } from 'effect'
import type { InventoryErrorReason, ItemId } from '../../types'
import type { TransferabilityDetails, TransferConstraint, TransferRequest } from './index'

// =============================================================================
// Specification Pattern Base
// =============================================================================

/**
 * 転送仕様のベースインターフェース
 */
export interface TransferSpecification {
  readonly isSatisfiedBy: (request: TransferRequest) => Effect.Effect<boolean, never>
  readonly getViolationReason: () => InventoryErrorReason
  readonly getConstraints: (request: TransferRequest) => Effect.Effect<ReadonlyArray<TransferConstraint>, never>
}

// =============================================================================
// Core Transfer Specifications
// =============================================================================

/**
 * スロット有効性仕様
 * 指定されたスロットが有効な範囲内にあるかを検証
 */
export class ValidSlotSpecification implements TransferSpecification {
  isSatisfiedBy = (request: TransferRequest): Effect.Effect<boolean, never> =>
    pipe(
      Effect.Do,
      Effect.bind('sourceValid', () =>
        Effect.succeed(request.sourceSlot >= 0 && request.sourceSlot < request.sourceInventory.slots.length)
      ),
      Effect.bind('targetValid', () =>
        Effect.succeed(
          request.targetSlot === 'auto' ||
            (request.targetSlot >= 0 && request.targetSlot < request.targetInventory.slots.length)
        )
      ),
      Effect.map(({ sourceValid, targetValid }) => sourceValid && targetValid)
    )

  getViolationReason = (): InventoryErrorReason => 'INVALID_SLOT_INDEX'

  getConstraints = (request: TransferRequest): Effect.Effect<ReadonlyArray<TransferConstraint>, never> =>
    pipe(
      Effect.Do,
      Effect.bind('sourceConstraint', () =>
        pipe(
          Match.value(request.sourceSlot < 0 || request.sourceSlot >= request.sourceInventory.slots.length),
          Match.when(true, () =>
            Option.some<TransferConstraint>({
              type: 'slot_occupied',
              message: `Source slot ${request.sourceSlot} is out of bounds`,
              affectedSlots: [request.sourceSlot],
            })
          ),
          Match.when(false, () => Option.none<TransferConstraint>()),
          Match.exhaustive,
          Effect.succeed
        )
      ),
      Effect.bind('targetConstraint', () =>
        pipe(
          Match.value(
            request.targetSlot !== 'auto' &&
              (request.targetSlot < 0 || request.targetSlot >= request.targetInventory.slots.length)
          ),
          Match.when(true, () =>
            Option.some<TransferConstraint>({
              type: 'slot_occupied',
              message: `Target slot ${request.targetSlot} is out of bounds`,
              affectedSlots: [request.targetSlot],
            })
          ),
          Match.when(false, () => Option.none<TransferConstraint>()),
          Match.exhaustive,
          Effect.succeed
        )
      ),
      Effect.map(({ sourceConstraint, targetConstraint }) =>
        pipe(
          [sourceConstraint, targetConstraint],
          ReadonlyArray.filterMap((opt) => opt)
        )
      )
    )
}

/**
 * ソースアイテム存在仕様
 * ソーススロットにアイテムが存在するかを検証
 */
export class SourceItemExistsSpecification implements TransferSpecification {
  isSatisfiedBy = (request: TransferRequest): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const sourceItem = request.sourceInventory.slots[request.sourceSlot]
      return sourceItem !== null
    })

  getViolationReason = (): InventoryErrorReason => 'INSUFFICIENT_ITEMS'

  getConstraints = (request: TransferRequest): Effect.Effect<ReadonlyArray<TransferConstraint>, never> =>
    pipe(
      Effect.succeed(request.sourceInventory.slots[request.sourceSlot]),
      Effect.map((sourceItem) =>
        pipe(
          Option.fromNullable(sourceItem),
          Option.match({
            onNone: () => [
              {
                type: 'slot_occupied' as const,
                message: `Source slot ${request.sourceSlot} is empty`,
                affectedSlots: [request.sourceSlot],
              },
            ],
            onSome: () => [],
          })
        )
      )
    )
}

/**
 * アイテム数量有効性仕様
 * 転送しようとするアイテム数が有効な範囲内にあるかを検証
 */
export class ValidItemCountSpecification implements TransferSpecification {
  isSatisfiedBy = (request: TransferRequest): Effect.Effect<boolean, never> =>
    pipe(
      Effect.succeed(request.sourceInventory.slots[request.sourceSlot]),
      Effect.map((sourceItem) =>
        pipe(
          Option.fromNullable(sourceItem),
          Option.match({
            onNone: () => false,
            onSome: (item) => {
              const requestedCount = request.itemCount ?? item.count
              return requestedCount > 0 && requestedCount <= item.count
            },
          })
        )
      )
    )

  getViolationReason = (): InventoryErrorReason => 'INVALID_ITEM_COUNT'

  getConstraints = (request: TransferRequest): Effect.Effect<ReadonlyArray<TransferConstraint>, never> =>
    pipe(
      Effect.succeed(request.sourceInventory.slots[request.sourceSlot]),
      Effect.map((sourceItem) =>
        pipe(
          Option.fromNullable(sourceItem),
          Option.match({
            onNone: () => [],
            onSome: (item) => {
              const requestedCount = request.itemCount ?? item.count

              // バリデーションルールを配列で定義
              const validationRules: ReadonlyArray<{ condition: boolean; constraint: TransferConstraint }> = [
                {
                  condition: requestedCount <= 0,
                  constraint: {
                    type: 'item_specific',
                    message: 'Item count must be greater than 0',
                    affectedSlots: [request.sourceSlot],
                  },
                },
                {
                  condition: requestedCount > item.count,
                  constraint: {
                    type: 'item_specific',
                    message: `Requested count ${requestedCount} exceeds available ${item.count}`,
                    affectedSlots: [request.sourceSlot],
                  },
                },
              ]

              return pipe(
                validationRules,
                EffectArray.filter((rule) => rule.condition),
                EffectArray.map((rule) => rule.constraint)
              )
            },
          })
        )
      )
    )
}

/**
 * ターゲットスロット利用可能性仕様
 * ターゲットスロットがアイテム受け入れ可能かを検証
 */
export class TargetSlotAvailableSpecification implements TransferSpecification {
  isSatisfiedBy = (request: TransferRequest): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      return yield* pipe(
        Match.value(request.targetSlot),
        Match.when('auto', () => Effect.succeed(request.targetInventory.slots.some((slot) => slot === null))),
        Match.orElse((targetSlotIndex) =>
          Effect.gen(function* () {
            const targetSlot = request.targetInventory.slots[targetSlotIndex]
            const sourceItem = request.sourceInventory.slots[request.sourceSlot]

            return yield* pipe(
              Option.fromNullable(sourceItem),
              Option.match({
                onNone: () => Effect.succeed(false),
                onSome: (source) =>
                  pipe(
                    Option.fromNullable(targetSlot),
                    Option.match({
                      onNone: () => Effect.succeed(true),
                      onSome: (target) =>
                        pipe(
                          Match.value(target.itemId === source.itemId),
                          Match.when(true, () => {
                            const requestedCount = request.itemCount ?? source.count
                            return Effect.succeed(target.count + requestedCount <= 64)
                          }),
                          Match.when(false, () => Effect.succeed(false)),
                          Match.exhaustive
                        ),
                    })
                  ),
              })
            )
          })
        )
      )
    })

  getViolationReason = (): InventoryErrorReason => 'SLOT_OCCUPIED'

  getConstraints = (request: TransferRequest): Effect.Effect<ReadonlyArray<TransferConstraint>, never> =>
    pipe(
      Effect.Do,
      Effect.bind('sourceItem', () => Effect.succeed(request.sourceInventory.slots[request.sourceSlot])),
      Effect.map(({ sourceItem }) =>
        pipe(
          Match.value(request.targetSlot),
          Match.when('auto', () => {
            const hasEmptySlot = request.targetInventory.slots.some((slot) => slot === null)
            return pipe(
              Match.value(hasEmptySlot),
              Match.when(false, () => [
                {
                  type: 'slot_occupied' as const,
                  message: 'No empty slots available in target inventory',
                  affectedSlots: [],
                },
              ]),
              Match.when(true, () => []),
              Match.exhaustive
            )
          }),
          Match.orElse((targetSlotIndex) =>
            pipe(
              Option.fromNullable(sourceItem),
              Option.match({
                onNone: () => [],
                onSome: (source) => {
                  const targetSlot = request.targetInventory.slots[targetSlotIndex]
                  const requestedCount = request.itemCount ?? source.count

                  // バリデーションルール定義
                  const validationRules: ReadonlyArray<{
                    condition: boolean
                    constraint: TransferConstraint
                  }> = [
                    {
                      condition: targetSlot !== null && targetSlot.itemId !== source.itemId,
                      constraint: {
                        type: 'incompatible_items',
                        message: `Cannot combine ${source.itemId} with ${targetSlot?.itemId}`,
                        affectedSlots: [targetSlotIndex],
                      },
                    },
                    {
                      condition:
                        targetSlot !== null &&
                        targetSlot.itemId === source.itemId &&
                        targetSlot.count + requestedCount > 64,
                      constraint: {
                        type: 'stack_limit',
                        message: `Stack would exceed limit: ${(targetSlot?.count ?? 0) + requestedCount} > 64`,
                        affectedSlots: [targetSlotIndex],
                      },
                    },
                  ]

                  return pipe(
                    validationRules,
                    EffectArray.filter((rule) => rule.condition),
                    EffectArray.map((rule) => rule.constraint)
                  )
                },
              })
            )
          )
        )
      )
    )
}

/**
 * スタック制限仕様
 * アイテムのスタック制限を検証
 */
export class StackLimitSpecification implements TransferSpecification {
  isSatisfiedBy = (request: TransferRequest): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const sourceItem = request.sourceInventory.slots[request.sourceSlot]

      return yield* pipe(
        Option.fromNullable(sourceItem),
        Option.match({
          onNone: () => Effect.succeed(false),
          onSome: (item) =>
            Effect.gen(function* () {
              const requestedCount = request.itemCount ?? item.count

              return yield* pipe(
                Match.value(requestedCount > 64),
                Match.when(true, () => Effect.succeed(false)),
                Match.when(false, () =>
                  Effect.gen(function* () {
                    const itemSpecificLimit = yield* this.getItemStackLimit(item.itemId)
                    return requestedCount <= itemSpecificLimit
                  })
                ),
                Match.exhaustive
              )
            }),
        })
      )
    })

  getViolationReason = (): InventoryErrorReason => 'INVALID_STACK_SIZE'

  getConstraints = (request: TransferRequest): Effect.Effect<ReadonlyArray<TransferConstraint>, never> =>
    Effect.gen(function* () {
      const sourceItem = request.sourceInventory.slots[request.sourceSlot]

      return yield* pipe(
        Option.fromNullable(sourceItem),
        Option.match({
          onNone: () => Effect.succeed([]),
          onSome: (item) =>
            Effect.gen(function* () {
              const requestedCount = request.itemCount ?? item.count
              const itemSpecificLimit = yield* this.getItemStackLimit(item.itemId)

              return pipe(
                Match.value(requestedCount > itemSpecificLimit),
                Match.when(true, () => [
                  {
                    type: 'stack_limit' as const,
                    message: `Requested count ${requestedCount} exceeds stack limit ${itemSpecificLimit}`,
                    affectedSlots: [request.sourceSlot],
                  },
                ]),
                Match.when(false, () => []),
                Match.exhaustive
              )
            }),
        })
      )
    })

  private getItemStackLimit = (itemId: ItemId): Effect.Effect<number, never> =>
    Effect.gen(function* () {
      // アイテム固有のスタック制限ロジック
      // 現在は一律64個だが、将来的にアイテムレジストリから取得
      return pipe(
        itemId,
        Match.value,
        Match.when(
          (s) => s.includes('ender_pearl'),
          () => 16
        ),
        Match.when(
          (s) => s.includes('snowball'),
          () => 16
        ),
        Match.when(
          (s) => s.includes('bucket'),
          () => 1
        ),
        Match.when(
          (s) => s.includes('sword'),
          () => 1
        ),
        Match.when(
          (s) => s.includes('armor'),
          () => 1
        ),
        Match.orElse(() => 64)
      )
    })
}

// =============================================================================
// Composite Specifications
// =============================================================================

/**
 * 基本転送可能性仕様（複合仕様）
 * 全ての基本的な転送条件を結合
 */
export class CanTransferSpecification implements TransferSpecification {
  private readonly specifications: ReadonlyArray<TransferSpecification> = [
    new ValidSlotSpecification(),
    new SourceItemExistsSpecification(),
    new ValidItemCountSpecification(),
    new TargetSlotAvailableSpecification(),
    new StackLimitSpecification(),
  ]

  isSatisfiedBy = (request: TransferRequest): Effect.Effect<boolean, never> =>
    pipe(
      this.specifications,
      Effect.forEach((spec) => spec.isSatisfiedBy(request), { concurrency: 'unbounded' }),
      Effect.map((results) => ReadonlyArray.every(results, (satisfied) => satisfied))
    )

  getViolationReason = (): InventoryErrorReason => 'INVENTORY_FULL' // デフォルト

  getConstraints = (request: TransferRequest): Effect.Effect<ReadonlyArray<TransferConstraint>, never> =>
    pipe(
      this.specifications,
      Effect.forEach((spec) => spec.getConstraints(request), { concurrency: 'unbounded' }),
      Effect.map((constraintArrays) => ReadonlyArray.flatten(constraintArrays))
    )

  /**
   * 最初に違反した仕様の理由を取得
   */
  getFirstViolationReason = (request: TransferRequest): Effect.Effect<InventoryErrorReason | null, never> =>
    pipe(
      this.specifications,
      Effect.reduce(Option.none<InventoryErrorReason>(), (acc, spec) =>
        Effect.gen(function* () {
          return yield* pipe(
            Option.isSome(acc),
            Match.value,
            Match.when(true, () => Effect.succeed(acc)),
            Match.when(false, () =>
              Effect.gen(function* () {
                const satisfied = yield* spec.isSatisfiedBy(request)
                return pipe(
                  Match.value(satisfied),
                  Match.when(true, () => Option.none<InventoryErrorReason>()),
                  Match.when(false, () => Option.some(spec.getViolationReason())),
                  Match.exhaustive
                )
              })
            ),
            Match.exhaustive
          )
        })
      ),
      Effect.map((result) =>
        pipe(
          Option.isSome(result),
          Match.value,
          Match.when(true, () => result.value),
          Match.when(false, () => null),
          Match.exhaustive
        )
      )
    )
}

// =============================================================================
// Specification Factory
// =============================================================================

/**
 * 転送可能性の詳細分析
 */
export const analyzeTransferability = (request: TransferRequest): Effect.Effect<TransferabilityDetails, never> =>
  Effect.gen(function* () {
    const canTransferSpec = new CanTransferSpecification()

    const canTransfer = yield* canTransferSpec.isSatisfiedBy(request)
    const constraints = yield* canTransferSpec.getConstraints(request)
    const reason = yield* canTransferSpec.getFirstViolationReason(request)

    // 最大転送可能数を計算
    const maxTransferableCount = yield* calculateMaxTransferableCount(request)

    // 推奨ターゲットスロットを計算
    const recommendedTargetSlot = yield* findOptimalTargetSlot(request)

    return {
      canTransfer,
      reason: reason ?? undefined,
      maxTransferableCount,
      recommendedTargetSlot,
      constraints,
    }
  })

/**
 * 最大転送可能数の計算
 */
const calculateMaxTransferableCount = (request: TransferRequest): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    const sourceItem = request.sourceInventory.slots[request.sourceSlot]

    return yield* pipe(
      Option.fromNullable(sourceItem),
      Option.match({
        onNone: () => Effect.succeed(0),
        onSome: (source) =>
          Effect.gen(function* () {
            const targetSlot =
              request.targetSlot === 'auto' ? yield* findOptimalTargetSlot(request) : request.targetSlot

            return yield* pipe(
              Option.fromNullable(targetSlot),
              Option.match({
                onNone: () => Effect.succeed(0),
                onSome: (slot) => {
                  const targetItem = request.targetInventory.slots[slot]

                  return pipe(
                    Option.fromNullable(targetItem),
                    Option.match({
                      onNone: () => Effect.succeed(source.count),
                      onSome: (target) =>
                        pipe(
                          Match.value(target.itemId === source.itemId),
                          Match.when(true, () => Effect.succeed(Math.min(source.count, 64 - target.count))),
                          Match.when(false, () => Effect.succeed(0)),
                          Match.exhaustive
                        ),
                    })
                  )
                },
              })
            )
          }),
      })
    )
  })

/**
 * 最適なターゲットスロットの検索
 */
const findOptimalTargetSlot = (request: TransferRequest): Effect.Effect<number | undefined, never> =>
  Effect.gen(function* () {
    const sourceItem = request.sourceInventory.slots[request.sourceSlot]

    return yield* pipe(
      Option.fromNullable(sourceItem),
      Option.match({
        onNone: () => Effect.succeed(undefined),
        onSome: (source) =>
          Effect.gen(function* () {
            // 1. 同じアイテムIDの部分的なスタックを優先
            const partialStackIndex = pipe(
              request.targetInventory.slots,
              ReadonlyArray.findFirstIndex((slot) => slot !== null && slot.itemId === source.itemId && slot.count < 64)
            )

            return yield* pipe(
              Option.isSome(partialStackIndex),
              Match.value,
              Match.when(true, () => Effect.succeed(partialStackIndex.value)),
              Match.when(false, () =>
                Effect.gen(function* () {
                  // 2. 空きスロットを検索
                  const emptySlotIndex = pipe(
                    request.targetInventory.slots,
                    ReadonlyArray.findFirstIndex((slot) => slot === null)
                  )

                  return pipe(
                    Option.isSome(emptySlotIndex),
                    Match.value,
                    Match.when(true, () => emptySlotIndex.value),
                    Match.when(false, () => undefined),
                    Match.exhaustive
                  )
                })
              ),
              Match.exhaustive
            )
          }),
      })
    )
  })
