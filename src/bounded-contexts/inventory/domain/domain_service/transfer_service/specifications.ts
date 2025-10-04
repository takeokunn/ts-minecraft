/**
 * Transfer Service Specifications
 *
 * アイテム移動可能性の仕様（Specification Pattern）。
 * ドメインルールを明示的にカプセル化し、複雑な条件判定を
 * 再利用可能な仕様として定義します。
 */

import { Effect, Match, pipe } from 'effect'
import type { InventoryErrorReason, ItemId } from '../../types'
import type { TransferConstraint, TransferRequest, TransferabilityDetails } from './service'

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
    Effect.gen(function* () {
      // ソーススロットの検証
      if (request.sourceSlot < 0 || request.sourceSlot >= request.sourceInventory.slots.length) {
        return false
      }

      // ターゲットスロットの検証（'auto'の場合はスキップ）
      if (request.targetSlot !== 'auto') {
        if (request.targetSlot < 0 || request.targetSlot >= request.targetInventory.slots.length) {
          return false
        }
      }

      return true
    })

  getViolationReason = (): InventoryErrorReason => 'INVALID_SLOT_INDEX'

  getConstraints = (request: TransferRequest): Effect.Effect<ReadonlyArray<TransferConstraint>, never> =>
    Effect.gen(function* () {
      const constraints: TransferConstraint[] = []

      // ソーススロット検証
      if (request.sourceSlot < 0 || request.sourceSlot >= request.sourceInventory.slots.length) {
        constraints.push({
          type: 'slot_occupied',
          message: `Source slot ${request.sourceSlot} is out of bounds`,
          affectedSlots: [request.sourceSlot],
        })
      }

      // ターゲットスロット検証
      if (
        request.targetSlot !== 'auto' &&
        (request.targetSlot < 0 || request.targetSlot >= request.targetInventory.slots.length)
      ) {
        constraints.push({
          type: 'slot_occupied',
          message: `Target slot ${request.targetSlot} is out of bounds`,
          affectedSlots: [request.targetSlot],
        })
      }

      return constraints
    })
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
    Effect.gen(function* () {
      const sourceItem = request.sourceInventory.slots[request.sourceSlot]

      if (sourceItem === null) {
        return [
          {
            type: 'slot_occupied',
            message: `Source slot ${request.sourceSlot} is empty`,
            affectedSlots: [request.sourceSlot],
          },
        ]
      }

      return []
    })
}

/**
 * アイテム数量有効性仕様
 * 転送しようとするアイテム数が有効な範囲内にあるかを検証
 */
export class ValidItemCountSpecification implements TransferSpecification {
  isSatisfiedBy = (request: TransferRequest): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const sourceItem = request.sourceInventory.slots[request.sourceSlot]

      if (sourceItem === null) {
        return false
      }

      const requestedCount = request.itemCount ?? sourceItem.count

      return requestedCount > 0 && requestedCount <= sourceItem.count
    })

  getViolationReason = (): InventoryErrorReason => 'INVALID_ITEM_COUNT'

  getConstraints = (request: TransferRequest): Effect.Effect<ReadonlyArray<TransferConstraint>, never> =>
    Effect.gen(function* () {
      const sourceItem = request.sourceInventory.slots[request.sourceSlot]
      const constraints: TransferConstraint[] = []

      if (sourceItem === null) {
        return constraints
      }

      const requestedCount = request.itemCount ?? sourceItem.count

      if (requestedCount <= 0) {
        constraints.push({
          type: 'item_specific',
          message: 'Item count must be greater than 0',
          affectedSlots: [request.sourceSlot],
        })
      }

      if (requestedCount > sourceItem.count) {
        constraints.push({
          type: 'item_specific',
          message: `Requested count ${requestedCount} exceeds available ${sourceItem.count}`,
          affectedSlots: [request.sourceSlot],
        })
      }

      return constraints
    })
}

/**
 * ターゲットスロット利用可能性仕様
 * ターゲットスロットがアイテム受け入れ可能かを検証
 */
export class TargetSlotAvailableSpecification implements TransferSpecification {
  isSatisfiedBy = (request: TransferRequest): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      // 'auto'の場合は空きスロットの存在を確認
      if (request.targetSlot === 'auto') {
        return request.targetInventory.slots.some((slot) => slot === null)
      }

      const targetSlot = request.targetInventory.slots[request.targetSlot]
      const sourceItem = request.sourceInventory.slots[request.sourceSlot]

      if (sourceItem === null) {
        return false
      }

      // ターゲットスロットが空の場合はOK
      if (targetSlot === null) {
        return true
      }

      // 同じアイテムIDの場合は結合可能性を確認
      if (targetSlot.itemId === sourceItem.itemId) {
        const requestedCount = request.itemCount ?? sourceItem.count
        return targetSlot.count + requestedCount <= 64 // スタック制限
      }

      // 異なるアイテムの場合は結合不可
      return false
    })

  getViolationReason = (): InventoryErrorReason => 'SLOT_OCCUPIED'

  getConstraints = (request: TransferRequest): Effect.Effect<ReadonlyArray<TransferConstraint>, never> =>
    Effect.gen(function* () {
      const constraints: TransferConstraint[] = []

      if (request.targetSlot === 'auto') {
        const hasEmptySlot = request.targetInventory.slots.some((slot) => slot === null)
        if (!hasEmptySlot) {
          constraints.push({
            type: 'slot_occupied',
            message: 'No empty slots available in target inventory',
            affectedSlots: [],
          })
        }
        return constraints
      }

      const targetSlot = request.targetInventory.slots[request.targetSlot]
      const sourceItem = request.sourceInventory.slots[request.sourceSlot]

      if (sourceItem === null) {
        return constraints
      }

      if (targetSlot !== null && targetSlot.itemId !== sourceItem.itemId) {
        constraints.push({
          type: 'incompatible_items',
          message: `Cannot combine ${sourceItem.itemId} with ${targetSlot.itemId}`,
          affectedSlots: [request.targetSlot],
        })
      }

      if (targetSlot !== null && targetSlot.itemId === sourceItem.itemId) {
        const requestedCount = request.itemCount ?? sourceItem.count
        if (targetSlot.count + requestedCount > 64) {
          constraints.push({
            type: 'stack_limit',
            message: `Stack would exceed limit: ${targetSlot.count + requestedCount} > 64`,
            affectedSlots: [request.targetSlot],
          })
        }
      }

      return constraints
    })
}

/**
 * スタック制限仕様
 * アイテムのスタック制限を検証
 */
export class StackLimitSpecification implements TransferSpecification {
  isSatisfiedBy = (request: TransferRequest): Effect.Effect<boolean, never> =>
    Effect.gen(function* () {
      const sourceItem = request.sourceInventory.slots[request.sourceSlot]

      if (sourceItem === null) {
        return false
      }

      const requestedCount = request.itemCount ?? sourceItem.count

      // 基本的なスタック制限チェック（64個まで）
      if (requestedCount > 64) {
        return false
      }

      // アイテム固有のスタック制限（将来の拡張ポイント）
      const itemSpecificLimit = yield* this.getItemStackLimit(sourceItem.itemId)

      return requestedCount <= itemSpecificLimit
    })

  getViolationReason = (): InventoryErrorReason => 'INVALID_STACK_SIZE'

  getConstraints = (request: TransferRequest): Effect.Effect<ReadonlyArray<TransferConstraint>, never> =>
    Effect.gen(function* () {
      const sourceItem = request.sourceInventory.slots[request.sourceSlot]
      const constraints: TransferConstraint[] = []

      if (sourceItem === null) {
        return constraints
      }

      const requestedCount = request.itemCount ?? sourceItem.count
      const itemSpecificLimit = yield* this.getItemStackLimit(sourceItem.itemId)

      if (requestedCount > itemSpecificLimit) {
        constraints.push({
          type: 'stack_limit',
          message: `Requested count ${requestedCount} exceeds stack limit ${itemSpecificLimit}`,
          affectedSlots: [request.sourceSlot],
        })
      }

      return constraints
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
    Effect.gen(function* () {
      // 全ての仕様が満たされているかを確認
      for (const spec of this.specifications) {
        const satisfied = yield* spec.isSatisfiedBy(request)
        if (!satisfied) {
          return false
        }
      }
      return true
    })

  getViolationReason = (): InventoryErrorReason => 'INVENTORY_FULL' // デフォルト

  getConstraints = (request: TransferRequest): Effect.Effect<ReadonlyArray<TransferConstraint>, never> =>
    Effect.gen(function* () {
      const allConstraints: TransferConstraint[] = []

      // 全ての仕様から制約を収集
      for (const spec of this.specifications) {
        const constraints = yield* spec.getConstraints(request)
        allConstraints.push(...constraints)
      }

      return allConstraints
    })

  /**
   * 最初に違反した仕様の理由を取得
   */
  getFirstViolationReason = (request: TransferRequest): Effect.Effect<InventoryErrorReason | null, never> =>
    Effect.gen(function* () {
      for (const spec of this.specifications) {
        const satisfied = yield* spec.isSatisfiedBy(request)
        if (!satisfied) {
          return spec.getViolationReason()
        }
      }
      return null
    })
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

    if (sourceItem === null) {
      return 0
    }

    const targetSlot = request.targetSlot === 'auto' ? yield* findOptimalTargetSlot(request) : request.targetSlot

    if (targetSlot === undefined) {
      return 0
    }

    const targetItem = request.targetInventory.slots[targetSlot]

    if (targetItem === null) {
      return sourceItem.count
    }

    if (targetItem.itemId !== sourceItem.itemId) {
      return 0
    }

    return Math.min(sourceItem.count, 64 - targetItem.count)
  })

/**
 * 最適なターゲットスロットの検索
 */
const findOptimalTargetSlot = (request: TransferRequest): Effect.Effect<number | undefined, never> =>
  Effect.gen(function* () {
    const sourceItem = request.sourceInventory.slots[request.sourceSlot]

    if (sourceItem === null) {
      return undefined
    }

    // 1. 同じアイテムIDの部分的なスタックを優先
    for (let i = 0; i < request.targetInventory.slots.length; i++) {
      const slot = request.targetInventory.slots[i]
      if (slot !== null && slot.itemId === sourceItem.itemId && slot.count < 64) {
        return i
      }
    }

    // 2. 空きスロットを検索
    for (let i = 0; i < request.targetInventory.slots.length; i++) {
      if (request.targetInventory.slots[i] === null) {
        return i
      }
    }

    return undefined
  })
