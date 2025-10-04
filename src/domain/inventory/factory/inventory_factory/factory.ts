/**
 * InventoryFactory - DDD Factory Implementation
 *
 * Effect-TSの関数型パターンによるInventory生成の純粋関数実装
 * class構文を一切使用せず、pipe/flowによる関数合成とEffect.genで実装
 */

import { Effect, Match, pipe } from 'effect'
import type { Inventory, ItemStack } from '../../types'
import { createEmptyInventory } from '../../types'
import type {
  InventoryConfig,
  InventoryCreationError,
  InventoryFactory,
  InventoryType,
  defaultPermissions,
} from './interface'
import {
  InventoryCreationError as CreationError,
  InventoryMergeError as MergeError,
  InventoryValidationError as ValidationError,
} from './interface'

// ===== 内部ヘルパー関数（Pure Functions） =====

// タイプ別デフォルト設定（Match.valueパターン）
const getTypeDefaults = (type: InventoryType): Partial<InventoryConfig> =>
  pipe(
    type,
    Match.value,
    Match.when('player', () => ({
      slotCount: 36,
      enableHotbar: true,
      enableArmor: true,
      enableOffhand: true,
      permissions: defaultPermissions,
    })),
    Match.when('creative', () => ({
      slotCount: 45, // 追加スロット
      enableHotbar: true,
      enableArmor: true,
      enableOffhand: true,
      permissions: {
        ...defaultPermissions,
        canAddItems: true,
        canRemoveItems: true,
      },
    })),
    Match.when('survival', () => ({
      slotCount: 36,
      enableHotbar: true,
      enableArmor: true,
      enableOffhand: true,
      permissions: defaultPermissions,
    })),
    Match.when('spectator', () => ({
      slotCount: 0,
      enableHotbar: false,
      enableArmor: false,
      enableOffhand: false,
      permissions: {
        canAddItems: false,
        canRemoveItems: false,
        canModifyArmor: false,
        canUseHotbar: false,
        canUseOffhand: false,
      },
    })),
    Match.when('adventure', () => ({
      slotCount: 36,
      enableHotbar: true,
      enableArmor: true,
      enableOffhand: true,
      permissions: {
        ...defaultPermissions,
        canModifyArmor: false, // アドベンチャーモードでは装備変更不可
      },
    })),
    Match.exhaustive
  )

// 設定の検証（Pure Function with Effect Error Handling）
const validateConfig = (config: InventoryConfig): Effect.Effect<void, InventoryCreationError> =>
  Effect.gen(function* () {
    const errors: string[] = []

    if (!config.playerId || config.playerId.trim() === '') {
      errors.push('playerId is required')
    }

    if (config.slotCount < 0 || config.slotCount > 54) {
      errors.push('slotCount must be between 0 and 54')
    }

    if (config.startingItems && config.startingItems.length > config.slotCount) {
      errors.push('startingItems count exceeds slotCount')
    }

    if (errors.length > 0) {
      return yield* Effect.fail(
        new CreationError({
          reason: 'Invalid inventory configuration',
          invalidFields: errors,
          context: { config },
        })
      )
    }

    return yield* Effect.void
  })

// アイテムを適切なスロットに配置（Pure Function with Effect）
const placeItemsInSlots = (
  inventory: Inventory,
  items: ReadonlyArray<ItemStack>
): Effect.Effect<Inventory, InventoryCreationError> =>
  Effect.gen(function* () {
    const slots = [...inventory.slots]
    let itemIndex = 0

    for (let slotIndex = 0; slotIndex < slots.length && itemIndex < items.length; slotIndex++) {
      if (slots[slotIndex] === null) {
        slots[slotIndex] = items[itemIndex]
        itemIndex++
      }
    }

    if (itemIndex < items.length) {
      return yield* Effect.fail(
        new CreationError({
          reason: 'Not enough empty slots for all starting items',
          invalidFields: ['startingItems'],
          context: { availableSlots: slots.length, requestedItems: items.length },
        })
      )
    }

    return yield* Effect.succeed({
      ...inventory,
      slots,
    })
  })

// インベントリーの最適化（アイテムスタック統合）
const optimizeStacks = (inventory: Inventory): Effect.Effect<Inventory, InventoryCreationError> =>
  Effect.gen(function* () {
    const optimizedSlots = [...inventory.slots]

    // 同一アイテムのスタック統合ロジック
    for (let i = 0; i < optimizedSlots.length; i++) {
      const currentSlot = optimizedSlots[i]
      if (!currentSlot) continue

      for (let j = i + 1; j < optimizedSlots.length; j++) {
        const targetSlot = optimizedSlots[j]
        if (!targetSlot) continue

        // 同じアイテムID且つスタック可能な場合
        if (currentSlot.itemId === targetSlot.itemId && currentSlot.count + targetSlot.count <= 64) {
          optimizedSlots[i] = {
            ...currentSlot,
            count: currentSlot.count + targetSlot.count,
          }
          optimizedSlots[j] = null
        }
      }
    }

    return yield* Effect.succeed({
      ...inventory,
      slots: optimizedSlots,
    })
  })

// ===== Factory実装（Function.flowとEffect.genパターン） =====

export const InventoryFactoryLive: InventoryFactory = {
  // 基本生成（Pure Function Factory）
  createEmpty: (config) =>
    Effect.gen(function* () {
      const defaults = getTypeDefaults(config.type)
      const fullConfig: InventoryConfig = {
        slotCount: 36,
        enableHotbar: true,
        enableArmor: true,
        enableOffhand: true,
        permissions: defaultPermissions,
        ...defaults,
        ...config,
      }

      yield* validateConfig(fullConfig)

      const baseInventory = createEmptyInventory(fullConfig.playerId)

      return yield* Effect.succeed(baseInventory)
    }),

  // プレイヤーインベントリー生成
  createPlayerInventory: (playerId) =>
    Effect.gen(function* () {
      return yield* InventoryFactoryLive.createEmpty({ playerId, type: 'player' })
    }),

  // クリエイティブインベントリー生成
  createCreativeInventory: (playerId) =>
    Effect.gen(function* () {
      return yield* InventoryFactoryLive.createEmpty({ playerId, type: 'creative' })
    }),

  // サバイバルインベントリー生成
  createSurvivalInventory: (playerId) =>
    Effect.gen(function* () {
      return yield* InventoryFactoryLive.createEmpty({ playerId, type: 'survival' })
    }),

  // 設定ベース生成（Configuration Pattern）
  createWithConfig: (config) =>
    Effect.gen(function* () {
      yield* validateConfig(config)

      const baseInventory = createEmptyInventory(config.playerId)

      // スロット数調整
      const adjustedSlots = Array(config.slotCount).fill(null)

      let result: Inventory = {
        ...baseInventory,
        slots: adjustedSlots,
      }

      // 機能別設定適用
      if (!config.enableHotbar) {
        result = { ...result, hotbar: [] }
      }

      if (!config.enableArmor) {
        result = {
          ...result,
          armor: {
            helmet: null,
            chestplate: null,
            leggings: null,
            boots: null,
          },
        }
      }

      if (!config.enableOffhand) {
        result = { ...result, offhand: null }
      }

      // 初期アイテム配置
      if (config.startingItems && config.startingItems.length > 0) {
        result = yield* placeItemsInSlots(result, config.startingItems)
      }

      return yield* Effect.succeed(result)
    }),

  // アイテム付き生成
  createWithItems: (config, items) =>
    Effect.gen(function* () {
      const fullConfig: InventoryConfig = {
        ...getTypeDefaults(config.type),
        ...config,
        startingItems: items,
        slotCount: 36,
        enableHotbar: true,
        enableArmor: true,
        enableOffhand: true,
        permissions: defaultPermissions,
      }

      return yield* InventoryFactoryLive.createWithConfig(fullConfig)
    }),

  // インベントリークローン
  cloneInventory: (source, newPlayerId) =>
    Effect.gen(function* () {
      const cloned: Inventory = {
        ...source,
        playerId: newPlayerId,
        slots: [...source.slots], // 新しい配列として複製
        hotbar: [...source.hotbar],
        armor: { ...source.armor },
      }

      yield* InventoryFactoryLive.validateInventory(cloned)

      return yield* Effect.succeed(cloned)
    }),

  // インベントリーマージ（Union Pattern）
  mergeInventories: (primary, secondary) =>
    Effect.gen(function* () {
      const mergedSlots = [...primary.slots]
      const conflicts: string[] = []

      // セカンダリのアイテムをプライマリに統合
      for (let i = 0; i < secondary.slots.length && i < mergedSlots.length; i++) {
        const secondaryItem = secondary.slots[i]
        if (secondaryItem && mergedSlots[i] === null) {
          mergedSlots[i] = secondaryItem
        } else if (secondaryItem && mergedSlots[i] !== null) {
          conflicts.push(`slot_${i}`)
        }
      }

      if (conflicts.length > 0) {
        return yield* Effect.fail(
          new MergeError({
            reason: 'Slot conflicts during merge',
            conflictingFields: conflicts,
            context: { primaryId: primary.playerId, secondaryId: secondary.playerId },
          })
        )
      }

      const merged: Inventory = {
        ...primary,
        slots: mergedSlots,
      }

      return yield* Effect.succeed(merged)
    }),

  // インベントリー検証
  validateInventory: (inventory) =>
    Effect.gen(function* () {
      const errors: string[] = []

      if (!inventory.playerId || inventory.playerId.trim() === '') {
        errors.push('playerId is required')
      }

      if (inventory.slots.length !== 36) {
        errors.push('slots array must have exactly 36 elements')
      }

      if (inventory.hotbar.length !== 9) {
        errors.push('hotbar array must have exactly 9 elements')
      }

      if (inventory.selectedSlot < 0 || inventory.selectedSlot > 8) {
        errors.push('selectedSlot must be between 0 and 8')
      }

      // ホットバーインデックスの検証
      for (const slotIndex of inventory.hotbar) {
        if (slotIndex < 0 || slotIndex >= inventory.slots.length) {
          errors.push(`invalid hotbar slot index: ${slotIndex}`)
        }
      }

      if (errors.length > 0) {
        return yield* Effect.fail(
          new ValidationError({
            reason: 'Inventory validation failed',
            missingFields: errors,
            context: { inventory },
          })
        )
      }

      return yield* Effect.void
    }),

  // インベントリー最適化
  optimizeInventory: (inventory) =>
    Effect.gen(function* () {
      yield* InventoryFactoryLive.validateInventory(inventory)
      return yield* optimizeStacks(inventory)
    }),
}

// Layer.effect による依存性注入実装
export const InventoryFactoryLayer = Effect.succeed(InventoryFactoryLive)
