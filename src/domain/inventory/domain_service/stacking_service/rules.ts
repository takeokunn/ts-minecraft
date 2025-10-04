/**
 * Stacking Rules and Constraints
 *
 * アイテムスタッキングのルールと制約を定義するモジュール。
 * ドメインルールをカプセル化し、複雑なスタッキング条件を
 * 再利用可能なルールとして実装します。
 */

import { Effect, Match, pipe } from 'effect'
import type { ItemId, ItemMetadata, ItemStack } from '../../types'
import type { MetadataConflict, StackCompatibility, StackIncompatibilityReason } from './service'

// =============================================================================
// Core Stacking Rules
// =============================================================================

/**
 * アイテムID一致ルール
 * 同じアイテムIDのみスタック可能
 */
export const checkItemIdCompatibility = (
  sourceStack: ItemStack,
  targetStack: ItemStack
): Effect.Effect<{ isCompatible: boolean; reason?: StackIncompatibilityReason }, never> =>
  Effect.gen(function* () {
    if (sourceStack.itemId === targetStack.itemId) {
      return { isCompatible: true }
    }
    return {
      isCompatible: false,
      reason: 'DIFFERENT_ITEM_IDS' as const,
    }
  })

/**
 * スタック制限ルール
 * アイテム固有のスタック制限をチェック
 */
export const checkStackLimitRule = (
  sourceStack: ItemStack,
  targetStack: ItemStack
): Effect.Effect<{ isCompatible: boolean; maxCombined: number; reason?: StackIncompatibilityReason }, never> =>
  Effect.gen(function* () {
    const stackLimit = yield* getItemStackLimit(sourceStack.itemId)
    const combinedCount = sourceStack.count + targetStack.count

    if (combinedCount <= stackLimit) {
      return {
        isCompatible: true,
        maxCombined: combinedCount,
      }
    }

    return {
      isCompatible: combinedCount <= stackLimit,
      maxCombined: stackLimit,
      reason: combinedCount > stackLimit ? ('STACK_LIMIT_EXCEEDED' as const) : undefined,
    }
  })

/**
 * メタデータ互換性ルール
 * メタデータが一致するかチェック
 */
export const checkMetadataCompatibility = (
  sourceStack: ItemStack,
  targetStack: ItemStack
): Effect.Effect<
  {
    isCompatible: boolean
    conflicts: ReadonlyArray<MetadataConflict>
    reason?: StackIncompatibilityReason
  },
  never
> =>
  Effect.gen(function* () {
    const conflicts: MetadataConflict[] = []

    // 両方ともメタデータがない場合は互換性あり
    if (!sourceStack.metadata && !targetStack.metadata) {
      return { isCompatible: true, conflicts: [] }
    }

    // 片方のみメタデータがある場合
    if (!sourceStack.metadata || !targetStack.metadata) {
      return {
        isCompatible: false,
        conflicts: [],
        reason: 'METADATA_MISMATCH' as const,
      }
    }

    // 各メタデータフィールドをチェック
    const sourceMetadata = sourceStack.metadata
    const targetMetadata = targetStack.metadata

    // エンチャントのチェック
    const enchantmentConflict = yield* checkEnchantmentCompatibility(
      sourceMetadata.enchantments,
      targetMetadata.enchantments
    )
    if (enchantmentConflict) {
      conflicts.push(enchantmentConflict)
    }

    // カスタム名のチェック
    if (sourceMetadata.customName !== targetMetadata.customName) {
      conflicts.push({
        field: 'customName',
        sourceValue: sourceMetadata.customName,
        targetValue: targetMetadata.customName,
        resolutionStrategy: 'PREVENT_STACK',
      })
    }

    // Loreのチェック
    const loreConflict = yield* checkLoreCompatibility(sourceMetadata.lore, targetMetadata.lore)
    if (loreConflict) {
      conflicts.push(loreConflict)
    }

    // ダメージ値のチェック
    if (sourceMetadata.damage !== targetMetadata.damage) {
      conflicts.push({
        field: 'damage',
        sourceValue: sourceMetadata.damage,
        targetValue: targetMetadata.damage,
        resolutionStrategy: 'AVERAGE',
      })
    }

    // 耐久値のチェック
    if (sourceMetadata.durability !== targetMetadata.durability) {
      conflicts.push({
        field: 'durability',
        sourceValue: sourceMetadata.durability,
        targetValue: targetMetadata.durability,
        resolutionStrategy: 'AVERAGE',
      })
    }

    // 互換性の判定
    const hasBlockingConflicts = conflicts.some((conflict) => conflict.resolutionStrategy === 'PREVENT_STACK')

    return {
      isCompatible: !hasBlockingConflicts,
      conflicts,
      reason: hasBlockingConflicts ? ('METADATA_MISMATCH' as const) : undefined,
    }
  })

/**
 * 耐久値互換性ルール
 * 耐久値を持つアイテムのスタッキング条件
 */
export const checkDurabilityCompatibility = (
  sourceStack: ItemStack,
  targetStack: ItemStack
): Effect.Effect<{ isCompatible: boolean; reason?: StackIncompatibilityReason }, never> =>
  Effect.gen(function* () {
    const sourceDurability = sourceStack.durability ?? 1.0
    const targetDurability = targetStack.durability ?? 1.0

    // 耐久値が大きく異なる場合はスタック不可
    const durabilityDifference = Math.abs(sourceDurability - targetDurability)
    const isToolItem = yield* isToolOrWeapon(sourceStack.itemId)

    if (isToolItem && durabilityDifference > 0.1) {
      // 10%以上の差
      return {
        isCompatible: false,
        reason: 'DURABILITY_CONFLICT' as const,
      }
    }

    return { isCompatible: true }
  })

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * アイテムのスタック制限を取得
 */
const getItemStackLimit = (itemId: ItemId): Effect.Effect<number, never> =>
  Effect.gen(function* () {
    return pipe(
      itemId,
      Match.value,
      // 非スタッカブルアイテム（1個まで）
      Match.when(
        (s) => s.includes('sword'),
        () => 1
      ),
      Match.when(
        (s) => s.includes('pickaxe'),
        () => 1
      ),
      Match.when(
        (s) => s.includes('axe'),
        () => 1
      ),
      Match.when(
        (s) => s.includes('shovel'),
        () => 1
      ),
      Match.when(
        (s) => s.includes('hoe'),
        () => 1
      ),
      Match.when(
        (s) => s.includes('helmet'),
        () => 1
      ),
      Match.when(
        (s) => s.includes('chestplate'),
        () => 1
      ),
      Match.when(
        (s) => s.includes('leggings'),
        () => 1
      ),
      Match.when(
        (s) => s.includes('boots'),
        () => 1
      ),
      Match.when(
        (s) => s.includes('bow'),
        () => 1
      ),
      Match.when(
        (s) => s.includes('bucket'),
        () => 1
      ),
      // 制限付きスタッカブルアイテム（16個まで）
      Match.when(
        (s) => s.includes('ender_pearl'),
        () => 16
      ),
      Match.when(
        (s) => s.includes('snowball'),
        () => 16
      ),
      Match.when(
        (s) => s.includes('egg'),
        () => 16
      ),
      Match.when(
        (s) => s.includes('honey_bottle'),
        () => 16
      ),
      // 通常のスタッカブルアイテム（64個まで）
      Match.orElse(() => 64)
    )
  })

/**
 * エンチャント互換性チェック
 */
const checkEnchantmentCompatibility = (
  sourceEnchantments: ItemMetadata['enchantments'],
  targetEnchantments: ItemMetadata['enchantments']
): Effect.Effect<MetadataConflict | null, never> =>
  Effect.gen(function* () {
    // 両方ともエンチャントなしの場合は互換性あり
    if (!sourceEnchantments && !targetEnchantments) {
      return null
    }

    // 片方のみエンチャントありの場合は互換性なし
    if (!sourceEnchantments || !targetEnchantments) {
      return {
        field: 'enchantments',
        sourceValue: sourceEnchantments,
        targetValue: targetEnchantments,
        resolutionStrategy: 'PREVENT_STACK',
      }
    }

    // エンチャントの比較
    const sourceEnchantmentMap = new Map(sourceEnchantments.map((e) => [e.id, e.level]))
    const targetEnchantmentMap = new Map(targetEnchantments.map((e) => [e.id, e.level]))

    // エンチャントの種類や レベルが異なる場合
    if (sourceEnchantmentMap.size !== targetEnchantmentMap.size) {
      return {
        field: 'enchantments',
        sourceValue: sourceEnchantments,
        targetValue: targetEnchantments,
        resolutionStrategy: 'PREVENT_STACK',
      }
    }

    for (const [enchantId, level] of sourceEnchantmentMap) {
      if (targetEnchantmentMap.get(enchantId) !== level) {
        return {
          field: 'enchantments',
          sourceValue: sourceEnchantments,
          targetValue: targetEnchantments,
          resolutionStrategy: 'PREVENT_STACK',
        }
      }
    }

    return null
  })

/**
 * Lore互換性チェック
 */
const checkLoreCompatibility = (
  sourceLore: ItemMetadata['lore'],
  targetLore: ItemMetadata['lore']
): Effect.Effect<MetadataConflict | null, never> =>
  Effect.gen(function* () {
    // 両方ともLoreなしの場合は互換性あり
    if (!sourceLore && !targetLore) {
      return null
    }

    // 片方のみLoreありの場合は互換性なし
    if (!sourceLore || !targetLore) {
      return {
        field: 'lore',
        sourceValue: sourceLore,
        targetValue: targetLore,
        resolutionStrategy: 'PREVENT_STACK',
      }
    }

    // Loreの配列比較
    if (sourceLore.length !== targetLore.length) {
      return {
        field: 'lore',
        sourceValue: sourceLore,
        targetValue: targetLore,
        resolutionStrategy: 'PREVENT_STACK',
      }
    }

    for (let i = 0; i < sourceLore.length; i++) {
      if (sourceLore[i] !== targetLore[i]) {
        return {
          field: 'lore',
          sourceValue: sourceLore,
          targetValue: targetLore,
          resolutionStrategy: 'PREVENT_STACK',
        }
      }
    }

    return null
  })

/**
 * ツールまたは武器かどうかを判定
 */
const isToolOrWeapon = (itemId: ItemId): Effect.Effect<boolean, never> =>
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
        (s) => s.includes('axe'),
        () => true
      ),
      Match.when(
        (s) => s.includes('shovel'),
        () => true
      ),
      Match.when(
        (s) => s.includes('hoe'),
        () => true
      ),
      Match.when(
        (s) => s.includes('bow'),
        () => true
      ),
      Match.when(
        (s) => s.includes('trident'),
        () => true
      ),
      Match.orElse(() => false)
    )
  })

// =============================================================================
// Composite Rules
// =============================================================================

/**
 * 包括的スタック互換性チェック
 * 全てのルールを組み合わせた包括的なチェック
 */
export const checkCompleteStackCompatibility = (
  sourceStack: ItemStack,
  targetStack: ItemStack
): Effect.Effect<StackCompatibility, never> =>
  Effect.gen(function* () {
    // 1. アイテムID互換性チェック
    const itemIdCheck = yield* checkItemIdCompatibility(sourceStack, targetStack)
    if (!itemIdCheck.isCompatible) {
      return {
        isCompatible: false,
        reason: itemIdCheck.reason,
        maxCombinedCount: 0,
        requiresMetadataConsolidation: false,
        metadataConflicts: [],
      }
    }

    // 2. スタック制限チェック
    const stackLimitCheck = yield* checkStackLimitRule(sourceStack, targetStack)

    // 3. メタデータ互換性チェック
    const metadataCheck = yield* checkMetadataCompatibility(sourceStack, targetStack)

    // 4. 耐久値互換性チェック
    const durabilityCheck = yield* checkDurabilityCompatibility(sourceStack, targetStack)

    // 全ての結果を統合
    const allCompatible = stackLimitCheck.isCompatible && metadataCheck.isCompatible && durabilityCheck.isCompatible

    const primaryReason = !stackLimitCheck.isCompatible
      ? stackLimitCheck.reason
      : !metadataCheck.isCompatible
        ? metadataCheck.reason
        : !durabilityCheck.isCompatible
          ? durabilityCheck.reason
          : undefined

    return {
      isCompatible: allCompatible,
      reason: primaryReason,
      maxCombinedCount: stackLimitCheck.maxCombined,
      requiresMetadataConsolidation: metadataCheck.conflicts.length > 0,
      metadataConflicts: metadataCheck.conflicts,
    }
  })

// =============================================================================
// Metadata Resolution Strategies
// =============================================================================

/**
 * メタデータ競合解決
 */
export const resolveMetadataConflicts = (
  sourceMetadata: ItemMetadata,
  targetMetadata: ItemMetadata,
  conflicts: ReadonlyArray<MetadataConflict>
): Effect.Effect<ItemMetadata, never> =>
  Effect.gen(function* () {
    let resolvedMetadata = { ...targetMetadata }

    for (const conflict of conflicts) {
      const resolution = yield* applyResolutionStrategy(conflict, sourceMetadata, targetMetadata)

      resolvedMetadata = {
        ...resolvedMetadata,
        [conflict.field]: resolution,
      }
    }

    return resolvedMetadata
  })

/**
 * 解決戦略の適用
 */
const applyResolutionStrategy = (
  conflict: MetadataConflict,
  sourceMetadata: ItemMetadata,
  targetMetadata: ItemMetadata
): Effect.Effect<unknown, never> =>
  Effect.gen(function* () {
    return pipe(
      conflict.resolutionStrategy,
      Match.value,
      Match.when('USE_SOURCE', () => conflict.sourceValue),
      Match.when('USE_TARGET', () => conflict.targetValue),
      Match.when('MERGE', () => mergeMetadataValues(conflict.sourceValue, conflict.targetValue)),
      Match.when('AVERAGE', () => averageMetadataValues(conflict.sourceValue, conflict.targetValue)),
      Match.when('MAX', () => maxMetadataValues(conflict.sourceValue, conflict.targetValue)),
      Match.when('MIN', () => minMetadataValues(conflict.sourceValue, conflict.targetValue)),
      Match.when('PREVENT_STACK', () => conflict.targetValue), // フォールバック
      Match.exhaustive
    )
  })

/**
 * メタデータ値のマージ
 */
const mergeMetadataValues = (sourceValue: unknown, targetValue: unknown): unknown => {
  if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
    return [...new Set([...sourceValue, ...targetValue])]
  }
  return targetValue
}

/**
 * メタデータ値の平均
 */
const averageMetadataValues = (sourceValue: unknown, targetValue: unknown): unknown => {
  if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
    return (sourceValue + targetValue) / 2
  }
  return targetValue
}

/**
 * メタデータ値の最大値
 */
const maxMetadataValues = (sourceValue: unknown, targetValue: unknown): unknown => {
  if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
    return Math.max(sourceValue, targetValue)
  }
  return targetValue
}

/**
 * メタデータ値の最小値
 */
const minMetadataValues = (sourceValue: unknown, targetValue: unknown): unknown => {
  if (typeof sourceValue === 'number' && typeof targetValue === 'number') {
    return Math.min(sourceValue, targetValue)
  }
  return targetValue
}
