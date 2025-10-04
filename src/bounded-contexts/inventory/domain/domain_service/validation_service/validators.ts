/**
 * Validation Service Validators
 *
 * 個別の検証ルールとバリデーターを実装するモジュール。
 * 各種検証ロジックを責任分離し、再利用可能な形で提供します。
 */

import { Effect, Match, pipe } from 'effect'
import type { Inventory, ItemId, ItemStack } from '../../types'
import type { ValidationOptions, ValidationViolation } from './service'

// =============================================================================
// Core Validators
// =============================================================================

/**
 * スロット数検証
 */
export const validateSlotCount = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    const violations: ValidationViolation[] = []

    if (inventory.slots.length !== 36) {
      violations.push({
        type: 'INVALID_SLOT_COUNT',
        severity: 'CRITICAL',
        description: `Invalid slot count: ${inventory.slots.length}, expected 36`,
        affectedSlots: [],
        detectedValue: inventory.slots.length,
        expectedValue: 36,
        canAutoCorrect: false,
      })
    }

    return violations
  })

/**
 * スタックサイズ検証
 */
export const validateStackSizes = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    const violations: ValidationViolation[] = []

    for (let i = 0; i < inventory.slots.length; i++) {
      const stack = inventory.slots[i]
      if (stack !== null) {
        if (stack.count <= 0 || stack.count > 64) {
          violations.push({
            type: 'INVALID_STACK_SIZE',
            severity: 'ERROR',
            description: `Invalid stack size: ${stack.count} at slot ${i}`,
            affectedSlots: [i],
            detectedValue: stack.count,
            expectedValue: 'between 1 and 64',
            canAutoCorrect: true,
          })
        }
      }
    }

    return violations
  })

/**
 * ホットバー検証
 */
export const validateHotbarSlots = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    const violations: ValidationViolation[] = []

    // ホットバー配列の長さチェック
    if (inventory.hotbar.length !== 9) {
      violations.push({
        type: 'INVALID_SLOT_COUNT',
        severity: 'ERROR',
        description: `Invalid hotbar length: ${inventory.hotbar.length}, expected 9`,
        affectedSlots: [],
        detectedValue: inventory.hotbar.length,
        expectedValue: 9,
        canAutoCorrect: true,
      })
    }

    // 重複チェック
    const duplicates = findDuplicates(inventory.hotbar)
    if (duplicates.length > 0) {
      violations.push({
        type: 'DUPLICATE_HOTBAR_SLOT',
        severity: 'ERROR',
        description: `Duplicate hotbar slot references: ${duplicates.join(', ')}`,
        affectedSlots: duplicates,
        detectedValue: duplicates,
        canAutoCorrect: true,
      })
    }

    // 範囲外チェック
    const outOfBounds = inventory.hotbar.filter((slot) => slot < 0 || slot >= 36)
    if (outOfBounds.length > 0) {
      violations.push({
        type: 'HOTBAR_SLOT_OUT_OF_BOUNDS',
        severity: 'ERROR',
        description: `Hotbar slots out of bounds: ${outOfBounds.join(', ')}`,
        affectedSlots: outOfBounds,
        detectedValue: outOfBounds,
        canAutoCorrect: true,
      })
    }

    return violations
  })

/**
 * 選択スロット検証
 */
export const validateSelectedSlot = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    const violations: ValidationViolation[] = []

    if (inventory.selectedSlot < 0 || inventory.selectedSlot > 8) {
      violations.push({
        type: 'INVALID_SELECTED_SLOT',
        severity: 'ERROR',
        description: `Invalid selected slot: ${inventory.selectedSlot}, expected 0-8`,
        affectedSlots: [],
        detectedValue: inventory.selectedSlot,
        expectedValue: 'between 0 and 8',
        canAutoCorrect: true,
      })
    }

    return violations
  })

/**
 * 防具スロット検証
 */
export const validateArmorSlots = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    const violations: ValidationViolation[] = []

    const armorItems = [
      { slot: 'helmet', item: inventory.armor.helmet },
      { slot: 'chestplate', item: inventory.armor.chestplate },
      { slot: 'leggings', item: inventory.armor.leggings },
      { slot: 'boots', item: inventory.armor.boots },
    ]

    for (const { slot, item } of armorItems) {
      if (item !== null) {
        const isValidArmor = yield* isValidArmorForSlot(item.itemId, slot)
        if (!isValidArmor) {
          violations.push({
            type: 'INVALID_ARMOR_SLOT',
            severity: 'ERROR',
            description: `Invalid armor item ${item.itemId} in ${slot} slot`,
            affectedSlots: [],
            detectedValue: item.itemId,
            canAutoCorrect: false,
          })
        }
      }
    }

    return violations
  })

/**
 * メタデータ検証
 */
export const validateMetadata = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    const violations: ValidationViolation[] = []

    for (let i = 0; i < inventory.slots.length; i++) {
      const stack = inventory.slots[i]
      if (stack?.metadata) {
        const metadataViolations = yield* validateStackMetadata(stack, i)
        violations.push(...metadataViolations)
      }
    }

    return violations
  })

/**
 * 耐久値検証
 */
export const validateDurability = (inventory: Inventory): Effect.Effect<ReadonlyArray<ValidationViolation>, never> =>
  Effect.gen(function* () {
    const violations: ValidationViolation[] = []

    for (let i = 0; i < inventory.slots.length; i++) {
      const stack = inventory.slots[i]
      if (stack?.durability !== undefined) {
        if (stack.durability < 0 || stack.durability > 1) {
          violations.push({
            type: 'DURABILITY_OUT_OF_RANGE',
            severity: 'ERROR',
            description: `Invalid durability: ${stack.durability} at slot ${i}`,
            affectedSlots: [i],
            detectedValue: stack.durability,
            expectedValue: 'between 0 and 1',
            canAutoCorrect: true,
          })
        }
      }
    }

    return violations
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
    const violations: ValidationViolation[] = []
    const metadata = stack.metadata!

    // エンチャント検証
    if (metadata.enchantments) {
      for (const enchantment of metadata.enchantments) {
        if (enchantment.level < 1 || enchantment.level > 5) {
          violations.push({
            type: 'METADATA_CORRUPTION',
            severity: 'WARNING',
            description: `Invalid enchantment level: ${enchantment.level} for ${enchantment.id}`,
            affectedSlots: [slotIndex],
            detectedValue: enchantment.level,
            expectedValue: 'between 1 and 5',
            canAutoCorrect: true,
          })
        }
      }
    }

    // ダメージ値検証
    if (metadata.damage !== undefined) {
      if (metadata.damage < 0 || metadata.damage > 1000) {
        violations.push({
          type: 'METADATA_CORRUPTION',
          severity: 'WARNING',
          description: `Invalid damage value: ${metadata.damage}`,
          affectedSlots: [slotIndex],
          detectedValue: metadata.damage,
          expectedValue: 'between 0 and 1000',
          canAutoCorrect: true,
        })
      }
    }

    return violations
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
    const allViolations: ValidationViolation[] = []

    // 基本構造検証
    const slotCountViolations = yield* validateSlotCount(inventory)
    allViolations.push(...slotCountViolations)

    const stackSizeViolations = yield* validateStackSizes(inventory)
    allViolations.push(...stackSizeViolations)

    // ホットバー検証
    if (options.verifyHotbarIntegrity) {
      const hotbarViolations = yield* validateHotbarSlots(inventory)
      allViolations.push(...hotbarViolations)

      const selectedSlotViolations = yield* validateSelectedSlot(inventory)
      allViolations.push(...selectedSlotViolations)
    }

    // 防具検証
    if (options.validateArmorSlots) {
      const armorViolations = yield* validateArmorSlots(inventory)
      allViolations.push(...armorViolations)
    }

    // メタデータ検証
    if (options.validateMetadata) {
      const metadataViolations = yield* validateMetadata(inventory)
      allViolations.push(...metadataViolations)
    }

    // 耐久値検証
    if (options.checkDurabilityRanges) {
      const durabilityViolations = yield* validateDurability(inventory)
      allViolations.push(...durabilityViolations)
    }

    return allViolations
  })
