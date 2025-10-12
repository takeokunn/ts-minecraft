/**
 * Validation Service Validators
 *
 * 個別の検証ルールとバリデーターを実装するモジュール。
 * 各種検証ロジックを責任分離し、再利用可能な形で提供します。
 *
 * Phase 2-B Track 7: Effect.if完全撲滅 - ADTパターン適用済み
 */

import type { JsonValue } from '@shared/schema/json'
import { Effect, HashSet, Match, Option, ReadonlyArray, pipe } from 'effect'
import type { Inventory, ItemId, ItemStack } from '../../types'
import type { ValidationOptions, ValidationViolation } from './index'
import { ValidationResult } from './validation_result'

// =============================================================================
// Helper: Type-safe ValidationViolation Construction
// =============================================================================

/**
 * ValidationViolationの型安全な構築ヘルパー
 * `as ValidationViolation`を排除し、コンパイル時の型安全性を保証
 */
const createValidationViolation = (params: {
  readonly type: ValidationViolation['type']
  readonly severity: ValidationViolation['severity']
  readonly description: string
  readonly affectedSlots: ReadonlyArray<number>
  readonly detectedValue: JsonValue
  readonly expectedValue?: JsonValue
  readonly canAutoCorrect: boolean
}): ValidationViolation => params

// =============================================================================
// Core Validators
// =============================================================================

/**
 * スロット数検証
 * Effect.if → Match.value + Match.tag パターン適用
 */
export const validateSlotCount = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    const result = pipe(
      Match.value(inventory.slots.length),
      Match.when(36, () => ValidationResult.Valid({})),
      Match.orElse((detected) => ValidationResult.InvalidSlotCount({ detected, expected: 36 }))
    )

    return yield* pipe(
      result,
      Match.tag({
        Valid: () => Effect.succeed([]),
        InvalidSlotCount: ({ detected, expected }) =>
          Effect.succeed([
            createValidationViolation({
              type: 'INVALID_SLOT_COUNT',
              severity: 'CRITICAL',
              description: `Invalid slot count: ${detected}, expected ${expected}`,
              affectedSlots: [],
              detectedValue: detected,
              expectedValue: expected,
              canAutoCorrect: false,
            }),
          ]),
        _: () => Effect.succeed([]),
      })
    )
  })

/**
 * スタックサイズ検証
 * 既にfilterMapWithIndexで宣言的記述済み（Effect.if不使用）
 */
export const validateStackSizes = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    return pipe(
      inventory.slots,
      ReadonlyArray.filterMapWithIndex((i, stack) =>
        stack !== null && (stack.count <= 0 || stack.count > 64)
          ? Option.some(
              createValidationViolation({
                type: 'INVALID_STACK_SIZE',
                severity: 'ERROR',
                description: `Invalid stack size: ${stack.count} at slot ${i}`,
                affectedSlots: [i],
                detectedValue: stack.count,
                expectedValue: 'between 1 and 64',
                canAutoCorrect: true,
              })
            )
          : Option.none()
      )
    )
  })

/**
 * ホットバー検証
 * Effect.if（3箇所） → Match.value + Match.tag パターン適用
 */
export const validateHotbarSlots = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    // ホットバー配列の長さチェック
    const lengthResult = pipe(
      Match.value(inventory.hotbar.length),
      Match.when(9, () => ValidationResult.Valid({})),
      Match.orElse((detected) => ValidationResult.InvalidHotbarLength({ detected, expected: 9 }))
    )

    const lengthViolation = yield* pipe(
      lengthResult,
      Match.tag({
        Valid: () => Effect.succeed(Option.none<ValidationViolation>()),
        InvalidHotbarLength: ({ detected, expected }) =>
          Effect.succeed(
            Option.some(
              createValidationViolation({
                type: 'INVALID_SLOT_COUNT',
                severity: 'ERROR',
                description: `Invalid hotbar length: ${detected}, expected ${expected}`,
                affectedSlots: [],
                detectedValue: detected,
                expectedValue: expected,
                canAutoCorrect: true,
              })
            )
          ),
        _: () => Effect.succeed(Option.none<ValidationViolation>()),
      })
    )

    // 重複チェック
    const duplicates = findDuplicates(inventory.hotbar)
    const duplicateResult = pipe(
      Match.value(duplicates),
      Match.when(ReadonlyArray.isEmptyReadonlyArray, () => ValidationResult.Valid({})),
      Match.orElse((dups) => ValidationResult.DuplicateHotbarSlot({ duplicates: dups }))
    )

    const duplicateViolation = yield* pipe(
      duplicateResult,
      Match.tag({
        Valid: () => Effect.succeed(Option.none<ValidationViolation>()),
        DuplicateHotbarSlot: ({ duplicates: dups }) =>
          Effect.succeed(
            Option.some(
              createValidationViolation({
                type: 'DUPLICATE_HOTBAR_SLOT',
                severity: 'ERROR',
                description: `Duplicate hotbar slot references: ${dups.join(', ')}`,
                affectedSlots: dups,
                detectedValue: dups,
                canAutoCorrect: true,
              })
            )
          ),
        _: () => Effect.succeed(Option.none<ValidationViolation>()),
      })
    )

    // 範囲外チェック
    const outOfBounds = inventory.hotbar.filter((slot) => slot < 0 || slot >= 36)
    const outOfBoundsResult = pipe(
      Match.value(outOfBounds),
      Match.when(ReadonlyArray.isEmptyReadonlyArray, () => ValidationResult.Valid({})),
      Match.orElse((oob) => ValidationResult.HotbarSlotOutOfBounds({ outOfBounds: oob }))
    )

    const outOfBoundsViolation = yield* pipe(
      outOfBoundsResult,
      Match.tag({
        Valid: () => Effect.succeed(Option.none<ValidationViolation>()),
        HotbarSlotOutOfBounds: ({ outOfBounds: oob }) =>
          Effect.succeed(
            Option.some(
              createValidationViolation({
                type: 'HOTBAR_SLOT_OUT_OF_BOUNDS',
                severity: 'ERROR',
                description: `Hotbar slots out of bounds: ${oob.join(', ')}`,
                affectedSlots: oob,
                detectedValue: oob,
                canAutoCorrect: true,
              })
            )
          ),
        _: () => Effect.succeed(Option.none<ValidationViolation>()),
      })
    )

    return pipe(
      [lengthViolation, duplicateViolation, outOfBoundsViolation],
      ReadonlyArray.filterMap((x) => x)
    )
  })

/**
 * 選択スロット検証
 * Effect.if → Match.value + Match.tag パターン適用
 */
export const validateSelectedSlot = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    const isValid = inventory.selectedSlot >= 0 && inventory.selectedSlot <= 8
    const result = pipe(
      Match.value(isValid),
      Match.when(true, () => ValidationResult.Valid({})),
      Match.orElse(() => ValidationResult.InvalidSelectedSlot({ selectedSlot: inventory.selectedSlot }))
    )

    return yield* pipe(
      result,
      Match.tag({
        Valid: () => Effect.succeed([]),
        InvalidSelectedSlot: ({ selectedSlot }) =>
          Effect.succeed([
            createValidationViolation({
              type: 'INVALID_SELECTED_SLOT',
              severity: 'ERROR',
              description: `Invalid selected slot: ${selectedSlot}, expected 0-8`,
              affectedSlots: [],
              detectedValue: selectedSlot,
              expectedValue: 'between 0 and 8',
              canAutoCorrect: true,
            }),
          ]),
        _: () => Effect.succeed([]),
      })
    )
  })

/**
 * 防具スロット検証
 * Effect.if（1箇所） → Match.value + Match.tag パターン適用
 */
export const validateArmorSlots = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    const armorItems = [
      { slot: 'helmet', item: inventory.armor.helmet },
      { slot: 'chestplate', item: inventory.armor.chestplate },
      { slot: 'leggings', item: inventory.armor.leggings },
      { slot: 'boots', item: inventory.armor.boots },
    ]

    return yield* pipe(
      armorItems,
      Effect.forEach(({ slot, item }) =>
        pipe(
          Option.fromNullable(item),
          Option.match({
            onNone: () => Effect.succeed(Option.none<ValidationViolation>()),
            onSome: (armorItem) =>
              Effect.gen(function* () {
                const isValidArmor = yield* isValidArmorForSlot(armorItem.itemId, slot)
                const result = pipe(
                  Match.value(isValidArmor),
                  Match.when(true, () => ValidationResult.Valid({})),
                  Match.orElse(() => ValidationResult.InvalidArmorSlot({ slot, itemId: armorItem.itemId }))
                )

                return yield* pipe(
                  result,
                  Match.tag({
                    Valid: () => Effect.succeed(Option.none<ValidationViolation>()),
                    InvalidArmorSlot: ({ slot: armorSlot, itemId }) =>
                      Effect.succeed(
                        Option.some(
                          createValidationViolation({
                            type: 'INVALID_ARMOR_SLOT',
                            severity: 'ERROR',
                            description: `Invalid armor item ${itemId} in ${armorSlot} slot`,
                            affectedSlots: [],
                            detectedValue: itemId,
                            canAutoCorrect: false,
                          })
                        )
                      ),
                    _: () => Effect.succeed(Option.none<ValidationViolation>()),
                  })
                )
              }),
          })
        )
      ),
      Effect.map(ReadonlyArray.filterMap((x) => x))
    )
  })

/**
 * メタデータ検証
 * 既にfilterMapWithIndexで宣言的記述済み（Effect.if不使用）
 */
export const validateMetadata = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    return yield* pipe(
      inventory.slots,
      ReadonlyArray.filterMapWithIndex((i, stack) => (stack?.metadata ? Option.some({ stack, i }) : Option.none())),
      Effect.forEach(({ stack, i }) => validateStackMetadata(stack, i)),
      Effect.map(ReadonlyArray.flatten)
    )
  })

/**
 * 耐久値検証
 * 既にfilterMapWithIndexで宣言的記述済み（Effect.if不使用）
 */
export const validateDurability = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    return pipe(
      inventory.slots,
      ReadonlyArray.filterMapWithIndex((i, stack) =>
        stack?.durability !== undefined && (stack.durability < 0 || stack.durability > 1)
          ? Option.some(
              createValidationViolation({
                type: 'DURABILITY_OUT_OF_RANGE',
                severity: 'ERROR',
                description: `Invalid durability: ${stack.durability} at slot ${i}`,
                affectedSlots: [i],
                detectedValue: stack.durability,
                expectedValue: 'between 0 and 1',
                canAutoCorrect: true,
              })
            )
          : Option.none()
      )
    )
  })

// =============================================================================
// Helper Functions
// =============================================================================

const findDuplicates = (array: ReadonlyArray<number>): number[] => {
  const result = pipe(
    array,
    ReadonlyArray.reduce({ seen: HashSet.empty<number>(), duplicates: HashSet.empty<number>() }, (acc, item) =>
      HashSet.has(acc.seen, item)
        ? { ...acc, duplicates: HashSet.add(acc.duplicates, item) }
        : { ...acc, seen: HashSet.add(acc.seen, item) }
    )
  )
  return Array.from(result.duplicates)
}

const isValidArmorForSlot = (itemId: ItemId, slot: string): Effect.Effect<boolean, never> =>
  Effect.gen(function* () {
    return pipe(
      slot,
      Match.value,
      Match.when('helmet', () => itemId.includes('helmet')),
      Match.when('chestplate', () => itemId.includes('chestplate')),
      Match.when('leggings', () => itemId.includes('leggings')),
      Match.when('boots', () => itemId.includes('boots')),
      Match.orElse(() => false)
    )
  })

/**
 * スタックメタデータ検証
 * Effect.if（1箇所） → Match.value + Match.tag パターン適用
 */
const validateStackMetadata = (
  stack: ItemStack,
  slotIndex: number
): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    const metadata = stack.metadata!

    // エンチャント検証（既に宣言的記述）
    const enchantmentViolations = pipe(
      metadata.enchantments ?? [],
      ReadonlyArray.filterMap((enchantment) =>
        enchantment.level < 1 || enchantment.level > 5
          ? Option.some(
              createValidationViolation({
                type: 'METADATA_CORRUPTION',
                severity: 'WARNING',
                description: `Invalid enchantment level: ${enchantment.level} for ${enchantment.id}`,
                affectedSlots: [slotIndex],
                detectedValue: enchantment.level,
                expectedValue: 'between 1 and 5',
                canAutoCorrect: true,
              })
            )
          : Option.none()
      )
    )

    // ダメージ値検証（Effect.if → Match.value + Match.tag）
    const isDamageValid = metadata.damage === undefined || (metadata.damage >= 0 && metadata.damage <= 1000)
    const damageResult = pipe(
      Match.value(isDamageValid),
      Match.when(true, () => ValidationResult.Valid({})),
      Match.orElse(() => ValidationResult.InvalidDamageValue({ slotIndex, damage: metadata.damage ?? 0 }))
    )

    const damageViolation = yield* pipe(
      damageResult,
      Match.tag({
        Valid: () => Effect.succeed(Option.none<ValidationViolation>()),
        InvalidDamageValue: ({ damage }) =>
          Effect.succeed(
            Option.some(
              createValidationViolation({
                type: 'METADATA_CORRUPTION',
                severity: 'WARNING',
                description: `Invalid damage value: ${damage}`,
                affectedSlots: [slotIndex],
                detectedValue: damage,
                expectedValue: 'between 0 and 1000',
                canAutoCorrect: true,
              })
            )
          ),
        _: () => Effect.succeed(Option.none<ValidationViolation>()),
      })
    )

    return [...enchantmentViolations, ...pipe(damageViolation, Option.toArray)]
  })

// =============================================================================
// Composite Validator
// =============================================================================

/**
 * 包括的な検証実行
 * Effect.if（4箇所、条件付きバリデーション） → Match.value + pipe パターン適用
 */
export const runAllValidators = (
  inventory: Inventory,
  options: ValidationOptions
): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    // 基本構造検証
    const slotCountViolations = yield* validateSlotCount(inventory)
    const stackSizeViolations = yield* validateStackSizes(inventory)

    // ホットバー検証（条件付き）
    const hotbarViolations = yield* pipe(
      Match.value(options.verifyHotbarIntegrity),
      Match.when(true, () =>
        Effect.gen(function* () {
          const hotbar = yield* validateHotbarSlots(inventory)
          const selectedSlot = yield* validateSelectedSlot(inventory)
          return [...hotbar, ...selectedSlot]
        })
      ),
      Match.orElse(() => Effect.succeed([]))
    )

    // 防具検証（条件付き）
    const armorViolations = yield* pipe(
      Match.value(options.validateArmorSlots),
      Match.when(true, () => validateArmorSlots(inventory)),
      Match.orElse(() => Effect.succeed([]))
    )

    // メタデータ検証（条件付き）
    const metadataViolations = yield* pipe(
      Match.value(options.validateMetadata),
      Match.when(true, () => validateMetadata(inventory)),
      Match.orElse(() => Effect.succeed([]))
    )

    // 耐久値検証（条件付き）
    const durabilityViolations = yield* pipe(
      Match.value(options.checkDurabilityRanges),
      Match.when(true, () => validateDurability(inventory)),
      Match.orElse(() => Effect.succeed([]))
    )

    return [
      ...slotCountViolations,
      ...stackSizeViolations,
      ...hotbarViolations,
      ...armorViolations,
      ...metadataViolations,
      ...durabilityViolations,
    ]
  })
