/**
 * Stacking Rules and Constraints
 *
 * アイテムスタッキングのルールと制約を定義するモジュール。
 * ドメインルールをカプセル化し、複雑なスタッキング条件を
 * 再利用可能なルールとして実装します。
 */

import { Effect, Match, Option, pipe, ReadonlyArray } from 'effect'
import type { ItemId, ItemMetadata, ItemStack } from '../../types'
import type { MetadataConflict, MetadataValue, StackCompatibility, StackIncompatibilityReason } from './index'

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
  pipe(
    Match.value(sourceStack.itemId === targetStack.itemId),
    Match.when(true, () => Effect.succeed({ isCompatible: true })),
    Match.when(false, () =>
      Effect.succeed({
        isCompatible: false,
        reason: 'DIFFERENT_ITEM_IDS' as const,
      })
    ),
    Match.exhaustive
  )

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

    return yield* pipe(
      Match.value(combinedCount <= stackLimit),
      Match.when(true, () =>
        Effect.succeed({
          isCompatible: true,
          maxCombined: combinedCount,
        })
      ),
      Match.when(false, () =>
        Effect.succeed({
          isCompatible: false,
          maxCombined: stackLimit,
          reason: 'STACK_LIMIT_EXCEEDED' as const,
        })
      ),
      Match.exhaustive
    )
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
    // Option.matchによる両方nullチェック
    const sourceMetaOpt = Option.fromNullable(sourceStack.metadata)
    const targetMetaOpt = Option.fromNullable(targetStack.metadata)

    // Match.valueによるメタデータ存在パターン判定
    return yield* pipe(
      Match.value({ source: Option.isSome(sourceMetaOpt), target: Option.isSome(targetMetaOpt) }),
      Match.when({ source: false, target: false }, () => Effect.succeed({ isCompatible: true, conflicts: [] })),
      Match.when({ source: false, target: true }, () =>
        Effect.succeed({
          isCompatible: false,
          conflicts: [],
          reason: 'METADATA_MISMATCH' as const,
        })
      ),
      Match.when({ source: true, target: false }, () =>
        Effect.succeed({
          isCompatible: false,
          conflicts: [],
          reason: 'METADATA_MISMATCH' as const,
        })
      ),
      Match.orElse(() =>
        Effect.gen(function* () {
          // 両方メタデータあり - 詳細チェック実行
          const sourceMetadata = yield* pipe(sourceMetaOpt, Effect.fromOption, Effect.orDie)
          const targetMetadata = yield* pipe(targetMetaOpt, Effect.fromOption, Effect.orDie)

          const conflicts: MetadataConflict[] = []

          // エンチャントのチェック
          const enchantmentConflictOpt = yield* checkEnchantmentCompatibility(
            sourceMetadata.enchantments,
            targetMetadata.enchantments
          )
          yield* pipe(
            Option.fromNullable(enchantmentConflictOpt),
            Option.match({
              onNone: () => Effect.void,
              onSome: (conflict) =>
                Effect.sync(() => {
                  conflicts.push(conflict)
                }),
            })
          )

          // カスタム名のチェック
          yield* Effect.when(sourceMetadata.customName !== targetMetadata.customName, () =>
            Effect.sync(() => {
              conflicts.push({
                field: 'customName',
                sourceValue: sourceMetadata.customName,
                targetValue: targetMetadata.customName,
                resolutionStrategy: 'PREVENT_STACK',
              })
            })
          )

          // Loreのチェック
          const loreConflictOpt = yield* checkLoreCompatibility(sourceMetadata.lore, targetMetadata.lore)
          yield* pipe(
            Option.fromNullable(loreConflictOpt),
            Option.match({
              onNone: () => Effect.void,
              onSome: (conflict) =>
                Effect.sync(() => {
                  conflicts.push(conflict)
                }),
            })
          )

          // ダメージ値のチェック
          yield* Effect.when(sourceMetadata.damage !== targetMetadata.damage, () =>
            Effect.sync(() => {
              conflicts.push({
                field: 'damage',
                sourceValue: sourceMetadata.damage,
                targetValue: targetMetadata.damage,
                resolutionStrategy: 'AVERAGE',
              })
            })
          )

          // 耐久値のチェック
          yield* Effect.when(sourceMetadata.durability !== targetMetadata.durability, () =>
            Effect.sync(() => {
              conflicts.push({
                field: 'durability',
                sourceValue: sourceMetadata.durability,
                targetValue: targetMetadata.durability,
                resolutionStrategy: 'AVERAGE',
              })
            })
          )

          // 互換性の判定
          const hasBlockingConflicts = conflicts.some((conflict) => conflict.resolutionStrategy === 'PREVENT_STACK')

          return {
            isCompatible: !hasBlockingConflicts,
            conflicts,
            reason: hasBlockingConflicts ? ('METADATA_MISMATCH' as const) : undefined,
          }
        })
      )
    )
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

    return yield* pipe(
      Match.value({ isToolItem, durabilityDifference }),
      Match.when(
        ({ isToolItem, durabilityDifference }) => isToolItem && durabilityDifference > 0.1,
        () =>
          Effect.succeed({
            isCompatible: false,
            reason: 'DURABILITY_CONFLICT' as const,
          })
      ),
      Match.orElse(() => Effect.succeed({ isCompatible: true }))
    )
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
    // Option.matchによる両方nullチェック
    const sourceOpt = Option.fromNullable(sourceEnchantments)
    const targetOpt = Option.fromNullable(targetEnchantments)

    // Match.valueによるエンチャント存在パターン判定
    return yield* pipe(
      Match.value({ source: Option.isSome(sourceOpt), target: Option.isSome(targetOpt) }),
      Match.when({ source: false, target: false }, () => Effect.succeed(null)),
      Match.when({ source: false, target: true }, () =>
        Effect.succeed<MetadataConflict>({
          field: 'enchantments',
          sourceValue: sourceEnchantments,
          targetValue: targetEnchantments,
          resolutionStrategy: 'PREVENT_STACK',
        })
      ),
      Match.when({ source: true, target: false }, () =>
        Effect.succeed<MetadataConflict>({
          field: 'enchantments',
          sourceValue: sourceEnchantments,
          targetValue: targetEnchantments,
          resolutionStrategy: 'PREVENT_STACK',
        })
      ),
      Match.orElse(() =>
        Effect.gen(function* () {
          // 両方エンチャントあり - 詳細比較
          const sourceEnchantmentMap = pipe(
            sourceOpt,
            Option.match({
              onNone: () => new Map<string, number>(),
              onSome: (enchantments) => new Map(enchantments.map((e) => [e.id, e.level])),
            })
          )
          const targetEnchantmentMap = pipe(
            targetOpt,
            Option.match({
              onNone: () => new Map<string, number>(),
              onSome: (enchantments) => new Map(enchantments.map((e) => [e.id, e.level])),
            })
          )

          // エンチャントの種類やレベルが異なる場合
          return yield* pipe(
            Match.value(sourceEnchantmentMap.size !== targetEnchantmentMap.size),
            Match.when(true, () =>
              Effect.succeed<MetadataConflict>({
                field: 'enchantments',
                sourceValue: sourceEnchantments,
                targetValue: targetEnchantments,
                resolutionStrategy: 'PREVENT_STACK',
              })
            ),
            Match.when(false, () =>
              Effect.gen(function* () {
                // ReadonlyArray.findFirstIndexで早期発見パターンに変換
                const entries = Array.from(sourceEnchantmentMap.entries())
                const mismatchIndex = pipe(
                  entries,
                  ReadonlyArray.findFirstIndex(([enchantId, level]) => targetEnchantmentMap.get(enchantId) !== level)
                )

                return yield* pipe(
                  mismatchIndex,
                  Option.match({
                    onNone: () => Effect.succeed<MetadataConflict | null>(null),
                    onSome: () =>
                      Effect.succeed<MetadataConflict>({
                        field: 'enchantments',
                        sourceValue: sourceEnchantments,
                        targetValue: targetEnchantments,
                        resolutionStrategy: 'PREVENT_STACK',
                      }),
                  })
                )
              })
            ),
            Match.exhaustive
          )
        })
      )
    )
  })

/**
 * Lore互換性チェック
 */
const checkLoreCompatibility = (
  sourceLore: ItemMetadata['lore'],
  targetLore: ItemMetadata['lore']
): Effect.Effect<MetadataConflict | null, never> =>
  Effect.gen(function* () {
    // Option.matchによる両方nullチェック
    const sourceOpt = Option.fromNullable(sourceLore)
    const targetOpt = Option.fromNullable(targetLore)

    // Match.valueによるLore存在パターン判定
    return yield* pipe(
      Match.value({ source: Option.isSome(sourceOpt), target: Option.isSome(targetOpt) }),
      Match.when({ source: false, target: false }, () => Effect.succeed(null)),
      Match.when({ source: false, target: true }, () =>
        Effect.succeed<MetadataConflict>({
          field: 'lore',
          sourceValue: sourceLore,
          targetValue: targetLore,
          resolutionStrategy: 'PREVENT_STACK',
        })
      ),
      Match.when({ source: true, target: false }, () =>
        Effect.succeed<MetadataConflict>({
          field: 'lore',
          sourceValue: sourceLore,
          targetValue: targetLore,
          resolutionStrategy: 'PREVENT_STACK',
        })
      ),
      Match.orElse(() =>
        Effect.gen(function* () {
          // 両方Loreあり - 配列比較
          const sourceLoreArray = pipe(
            sourceOpt,
            Option.getOrElse(() => [] as readonly string[])
          )
          const targetLoreArray = pipe(
            targetOpt,
            Option.getOrElse(() => [] as readonly string[])
          )

          return yield* pipe(
            Match.value(sourceLoreArray.length !== targetLoreArray.length),
            Match.when(true, () =>
              Effect.succeed<MetadataConflict>({
                field: 'lore',
                sourceValue: sourceLore,
                targetValue: targetLore,
                resolutionStrategy: 'PREVENT_STACK',
              })
            ),
            Match.when(false, () =>
              Effect.gen(function* () {
                // ReadonlyArray.findFirstIndexで不一致インデックスを検出
                const mismatchIndex = pipe(
                  sourceLoreArray,
                  ReadonlyArray.findFirstIndex((line, i) => targetLoreArray[i] !== line)
                )

                return yield* pipe(
                  mismatchIndex,
                  Option.match({
                    onNone: () => Effect.succeed<MetadataConflict | null>(null),
                    onSome: () =>
                      Effect.succeed<MetadataConflict>({
                        field: 'lore',
                        sourceValue: sourceLore,
                        targetValue: targetLore,
                        resolutionStrategy: 'PREVENT_STACK',
                      }),
                  })
                )
              })
            ),
            Match.exhaustive
          )
        })
      )
    )
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

    return yield* pipe(
      Match.value(itemIdCheck.isCompatible),
      Match.when(false, () =>
        Effect.succeed({
          isCompatible: false,
          reason: itemIdCheck.reason,
          maxCombinedCount: 0,
          requiresMetadataConsolidation: false,
          metadataConflicts: [],
        })
      ),
      Match.when(true, () =>
        Effect.gen(function* () {
          // 2. スタック制限チェック
          const stackLimitCheck = yield* checkStackLimitRule(sourceStack, targetStack)

          // 3. メタデータ互換性チェック
          const metadataCheck = yield* checkMetadataCompatibility(sourceStack, targetStack)

          // 4. 耐久値互換性チェック
          const durabilityCheck = yield* checkDurabilityCompatibility(sourceStack, targetStack)

          // 全ての結果を統合
          const allCompatible =
            stackLimitCheck.isCompatible && metadataCheck.isCompatible && durabilityCheck.isCompatible

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
      ),
      Match.exhaustive
    )
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
    // Effect.reduceでイミュータブルな累積パターンに変換
    return yield* pipe(
      conflicts,
      Effect.reduce(targetMetadata as ItemMetadata, (resolvedMetadata, conflict) =>
        Effect.gen(function* () {
          const resolution = yield* applyResolutionStrategy(conflict, sourceMetadata, targetMetadata)

          return {
            ...resolvedMetadata,
            [conflict.field]: resolution,
          }
        })
      )
    )
  })

/**
 * 解決戦略の適用
 */
const applyResolutionStrategy = (
  conflict: MetadataConflict,
  sourceMetadata: ItemMetadata,
  targetMetadata: ItemMetadata
): Effect.Effect<MetadataValue, never> =>
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
const mergeMetadataValues = (sourceValue: MetadataValue, targetValue: MetadataValue): MetadataValue => {
  return pipe(
    Match.value(Array.isArray(sourceValue) && Array.isArray(targetValue)),
    Match.when(true, () => [...new Set([...sourceValue, ...targetValue])]),
    Match.orElse(() => targetValue)
  )
}

/**
 * メタデータ値の平均
 */
const averageMetadataValues = (sourceValue: MetadataValue, targetValue: MetadataValue): MetadataValue => {
  return pipe(
    Match.value(typeof sourceValue === 'number' && typeof targetValue === 'number'),
    Match.when(true, () => (((sourceValue as number) + targetValue) as number) / 2),
    Match.orElse(() => targetValue)
  )
}

/**
 * メタデータ値の最大値
 */
const maxMetadataValues = (sourceValue: MetadataValue, targetValue: MetadataValue): MetadataValue => {
  return pipe(
    Match.value(typeof sourceValue === 'number' && typeof targetValue === 'number'),
    Match.when(true, () => Math.max(sourceValue as number, targetValue as number)),
    Match.orElse(() => targetValue)
  )
}

/**
 * メタデータ値の最小値
 */
const minMetadataValues = (sourceValue: MetadataValue, targetValue: MetadataValue): MetadataValue => {
  return pipe(
    Match.value(typeof sourceValue === 'number' && typeof targetValue === 'number'),
    Match.when(true, () => Math.min(sourceValue as number, targetValue as number)),
    Match.orElse(() => targetValue)
  )
}
