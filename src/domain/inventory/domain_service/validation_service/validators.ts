/**
 * Validation Service Validators
 *
 * 個別の検証ルールとバリデーターを実装するモジュール。
 * 各種検証ロジックを責任分離し、再利用可能な形で提供します。
 */

import { Effect, Match, Option, ReadonlyArray, pipe } from 'effect'
import type { Inventory, ItemId, ItemStack } from '../../types'
import type { ValidationOptions, ValidationViolation } from './index'

// =============================================================================
// Core Validators
// =============================================================================

/**
 * スロット数検証
 */
export const validateSlotCount = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    return yield* Effect.if(inventory.slots.length !== 36, {
      onTrue: () =>
        Effect.succeed([
          {
            type: 'INVALID_SLOT_COUNT',
            severity: 'CRITICAL',
            description: `Invalid slot count: ${inventory.slots.length}, expected 36`,
            affectedSlots: [],
            detectedValue: inventory.slots.length,
            expectedValue: 36,
            canAutoCorrect: false,
          } as ValidationViolation,
        ]),
      onFalse: () => Effect.succeed([]),
    })
  })

/**
 * スタックサイズ検証
 */
export const validateStackSizes = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    return pipe(
      inventory.slots,
      ReadonlyArray.filterMapWithIndex((i, stack) =>
        stack !== null && (stack.count <= 0 || stack.count > 64)
          ? Option.some({
              type: 'INVALID_STACK_SIZE',
              severity: 'ERROR',
              description: `Invalid stack size: ${stack.count} at slot ${i}`,
              affectedSlots: [i],
              detectedValue: stack.count,
              expectedValue: 'between 1 and 64',
              canAutoCorrect: true,
            } as ValidationViolation)
          : Option.none()
      )
    )
  })

/**
 * ホットバー検証
 */
export const validateHotbarSlots = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    // ホットバー配列の長さチェック
    const lengthViolation = yield* Effect.if(inventory.hotbar.length !== 9, {
      onTrue: () =>
        Effect.succeed(
          Option.some({
            type: 'INVALID_SLOT_COUNT',
            severity: 'ERROR',
            description: `Invalid hotbar length: ${inventory.hotbar.length}, expected 9`,
            affectedSlots: [],
            detectedValue: inventory.hotbar.length,
            expectedValue: 9,
            canAutoCorrect: true,
          } as ValidationViolation)
        ),
      onFalse: () => Effect.succeed(Option.none<ValidationViolation>()),
    })

    // 重複チェック
    const duplicates = findDuplicates(inventory.hotbar)
    const duplicateViolation = yield* Effect.if(duplicates.length > 0, {
      onTrue: () =>
        Effect.succeed(
          Option.some({
            type: 'DUPLICATE_HOTBAR_SLOT',
            severity: 'ERROR',
            description: `Duplicate hotbar slot references: ${duplicates.join(', ')}`,
            affectedSlots: duplicates,
            detectedValue: duplicates,
            canAutoCorrect: true,
          } as ValidationViolation)
        ),
      onFalse: () => Effect.succeed(Option.none<ValidationViolation>()),
    })

    // 範囲外チェック
    const outOfBounds = inventory.hotbar.filter((slot) => slot < 0 || slot >= 36)
    const outOfBoundsViolation = yield* Effect.if(outOfBounds.length > 0, {
      onTrue: () =>
        Effect.succeed(
          Option.some({
            type: 'HOTBAR_SLOT_OUT_OF_BOUNDS',
            severity: 'ERROR',
            description: `Hotbar slots out of bounds: ${outOfBounds.join(', ')}`,
            affectedSlots: outOfBounds,
            detectedValue: outOfBounds,
            canAutoCorrect: true,
          } as ValidationViolation)
        ),
      onFalse: () => Effect.succeed(Option.none<ValidationViolation>()),
    })

    return pipe(
      [lengthViolation, duplicateViolation, outOfBoundsViolation],
      ReadonlyArray.filterMap((x) => x)
    )
  })

/**
 * 選択スロット検証
 */
export const validateSelectedSlot = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    return yield* Effect.if(inventory.selectedSlot < 0 || inventory.selectedSlot > 8, {
      onTrue: () =>
        Effect.succeed([
          {
            type: 'INVALID_SELECTED_SLOT',
            severity: 'ERROR',
            description: `Invalid selected slot: ${inventory.selectedSlot}, expected 0-8`,
            affectedSlots: [],
            detectedValue: inventory.selectedSlot,
            expectedValue: 'between 0 and 8',
            canAutoCorrect: true,
          } as ValidationViolation,
        ]),
      onFalse: () => Effect.succeed([]),
    })
  })

/**
 * 防具スロット検証
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
        Effect.gen(function* () {
          if (item === null) return Option.none<ValidationViolation>()

          const isValidArmor = yield* isValidArmorForSlot(item.itemId, slot)

          return yield* Effect.if(!isValidArmor, {
            onTrue: () =>
              Effect.succeed(
                Option.some({
                  type: 'INVALID_ARMOR_SLOT',
                  severity: 'ERROR',
                  description: `Invalid armor item ${item.itemId} in ${slot} slot`,
                  affectedSlots: [],
                  detectedValue: item.itemId,
                  canAutoCorrect: false,
                } as ValidationViolation)
              ),
            onFalse: () => Effect.succeed(Option.none<ValidationViolation>()),
          })
        })
      ),
      Effect.map(ReadonlyArray.filterMap((x) => x))
    )
  })

/**
 * メタデータ検証
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
 */
export const validateDurability = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    return pipe(
      inventory.slots,
      ReadonlyArray.filterMapWithIndex((i, stack) =>
        stack?.durability !== undefined && (stack.durability < 0 || stack.durability > 1)
          ? Option.some({
              type: 'DURABILITY_OUT_OF_RANGE',
              severity: 'ERROR',
              description: `Invalid durability: ${stack.durability} at slot ${i}`,
              affectedSlots: [i],
              detectedValue: stack.durability,
              expectedValue: 'between 0 and 1',
              canAutoCorrect: true,
            } as ValidationViolation)
          : Option.none()
      )
    )
  })

// =============================================================================
// Helper Functions
// =============================================================================

const findDuplicates = (array: ReadonlyArray<number>): number[] => {
  const seen = new Set<number>()
  const duplicates = new Set<number>()

  for (const item of array) {
    if (seen.has(item)) {
      duplicates.add(item)
    } else {
      seen.add(item)
    }
  }

  return Array.from(duplicates)
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

const validateStackMetadata = (
  stack: ItemStack,
  slotIndex: number
): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    const metadata = stack.metadata!

    // エンチャント検証
    const enchantmentViolations = pipe(
      metadata.enchantments ?? [],
      ReadonlyArray.filterMap((enchantment) =>
        enchantment.level < 1 || enchantment.level > 5
          ? Option.some({
              type: 'METADATA_CORRUPTION',
              severity: 'WARNING',
              description: `Invalid enchantment level: ${enchantment.level} for ${enchantment.id}`,
              affectedSlots: [slotIndex],
              detectedValue: enchantment.level,
              expectedValue: 'between 1 and 5',
              canAutoCorrect: true,
            } as ValidationViolation)
          : Option.none()
      )
    )

    // ダメージ値検証
    const damageViolation = yield* Effect.if(
      metadata.damage !== undefined && (metadata.damage < 0 || metadata.damage > 1000),
      {
        onTrue: () =>
          Effect.succeed(
            Option.some({
              type: 'METADATA_CORRUPTION',
              severity: 'WARNING',
              description: `Invalid damage value: ${metadata.damage}`,
              affectedSlots: [slotIndex],
              detectedValue: metadata.damage,
              expectedValue: 'between 0 and 1000',
              canAutoCorrect: true,
            } as ValidationViolation)
          ),
        onFalse: () => Effect.succeed(Option.none<ValidationViolation>()),
      }
    )

    return [...enchantmentViolations, ...pipe(damageViolation, Option.toArray)]
  })

// =============================================================================
// Composite Validator
// =============================================================================

/**
 * 包括的な検証実行
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
    const hotbarViolations = yield* Effect.if(options.verifyHotbarIntegrity, {
      onTrue: () =>
        Effect.gen(function* () {
          const hotbar = yield* validateHotbarSlots(inventory)
          const selectedSlot = yield* validateSelectedSlot(inventory)
          return [...hotbar, ...selectedSlot]
        }),
      onFalse: () => Effect.succeed([]),
    })

    // 防具検証（条件付き）
    const armorViolations = yield* Effect.if(options.validateArmorSlots, {
      onTrue: () => validateArmorSlots(inventory),
      onFalse: () => Effect.succeed([]),
    })

    // メタデータ検証（条件付き）
    const metadataViolations = yield* Effect.if(options.validateMetadata, {
      onTrue: () => validateMetadata(inventory),
      onFalse: () => Effect.succeed([]),
    })

    // 耐久値検証（条件付き）
    const durabilityViolations = yield* Effect.if(options.checkDurabilityRanges, {
      onTrue: () => validateDurability(inventory),
      onFalse: () => Effect.succeed([]),
    })

    return [
      ...slotCountViolations,
      ...stackSizeViolations,
      ...hotbarViolations,
      ...armorViolations,
      ...metadataViolations,
      ...durabilityViolations,
    ]
  })
