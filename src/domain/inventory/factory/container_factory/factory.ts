/**
 * ContainerFactory - DDD Factory Implementation for Container Systems
 *
 * Effect-TSの関数型パターンによるContainer生成の純粋関数実装
 * class構文を一切使用せず、pipe/flowによる関数合成とEffect.genで実装
 */

import { Effect, Match, pipe } from 'effect'
import type { ItemStack } from '../../types'
import type {
  Container,
  ContainerConfig,
  ContainerCreationError,
  ContainerFactory,
  ContainerSlot,
  ContainerType,
  ContainerTypeSpec,
  containerTypeSpecs,
  defaultContainerPermissions,
} from './interface'
import {
  ContainerCreationError as CreationError,
  ContainerOperationError as OperationError,
  ContainerValidationError as ValidationError,
} from './interface'

// ===== 内部ヘルパー関数（Pure Functions） =====

// コンテナタイプ仕様取得（Match.valueパターン）
const getContainerSpec = (type: ContainerType): ContainerTypeSpec => containerTypeSpecs[type]

// 空のスロット生成（Pure Function）
const createEmptySlots = (spec: ContainerTypeSpec): ReadonlyArray<ContainerSlot> => {
  const slots: ContainerSlot[] = []

  for (let i = 0; i < spec.defaultSlotCount; i++) {
    // 特殊スロットの確認
    const specialSlot = spec.specialSlots?.find((s) => s.index === i)

    const slot: ContainerSlot = {
      index: i,
      type: specialSlot?.type || 'storage',
      item: null,
      acceptsItemType: specialSlot?.acceptsItemType,
      maxStackSize: 64, // デフォルト
    }

    slots.push(slot)
  }

  return slots
}

// コンテナ設定の検証（Pure Function with Effect Error Handling）
const validateContainerConfig = (config: ContainerConfig): Effect.Effect<void, ContainerCreationError> =>
  Effect.gen(function* () {
    const errors: string[] = []

    if (!config.id || config.id.trim() === '') {
      errors.push('id is required')
    }

    if (!config.type) {
      errors.push('type is required')
    }

    const spec = getContainerSpec(config.type)
    if (config.totalSlots !== undefined) {
      if (config.totalSlots < 1 || config.totalSlots > 54) {
        errors.push('totalSlots must be between 1 and 54')
      }
      if (config.totalSlots !== spec.defaultSlotCount) {
        errors.push(`totalSlots for ${config.type} should be ${spec.defaultSlotCount}`)
      }
    }

    if (config.initialItems) {
      for (const item of config.initialItems) {
        if (item.slotIndex < 0 || item.slotIndex >= spec.defaultSlotCount) {
          errors.push(`invalid slot index ${item.slotIndex} for ${config.type}`)
        }
      }
    }

    if (errors.length > 0) {
      return yield* Effect.fail(
        new CreationError({
          reason: 'Invalid container configuration',
          invalidFields: errors,
          context: { config },
        })
      )
    }

    return yield* Effect.void
  })

// スロットにアイテムが挿入可能かチェック（Pure Function）
const canInsertIntoSlot = (slot: ContainerSlot, item: ItemStack): boolean => {
  // スロットが既に占有されている場合
  if (slot.item !== null) {
    // 同じアイテムでスタック可能かチェック
    if (slot.item.itemId === item.itemId) {
      const maxStackSize = slot.maxStackSize || 64
      return slot.item.count + item.count <= maxStackSize
    }
    return false
  }

  // 空のスロットの場合、アイテムタイプ制限をチェック
  if (slot.acceptsItemType) {
    return slot.acceptsItemType(item.itemId)
  }

  return true
}

// アイテム挿入処理（Pure Function with Effect）
const insertItemIntoSlot = (slot: ContainerSlot, item: ItemStack): Effect.Effect<ContainerSlot, OperationError> =>
  Effect.gen(function* () {
    if (!canInsertIntoSlot(slot, item)) {
      return yield* Effect.fail(
        new OperationError({
          reason: 'Cannot insert item into slot',
          operation: 'insertItem',
          context: { slot, item },
        })
      )
    }

    if (slot.item === null) {
      // 空のスロットに挿入
      return yield* Effect.succeed({
        ...slot,
        item,
      })
    } else {
      // 既存アイテムとスタック
      const maxStackSize = slot.maxStackSize || 64
      const newCount = Math.min(slot.item.count + item.count, maxStackSize)

      return yield* Effect.succeed({
        ...slot,
        item: {
          ...slot.item,
          count: newCount,
        },
      })
    }
  })

// スロットからアイテム抽出（Pure Function with Effect）
const extractItemFromSlot = (
  slot: ContainerSlot,
  amount?: number
): Effect.Effect<readonly [ContainerSlot, ItemStack | null], OperationError> =>
  Effect.gen(function* () {
    if (slot.item === null) {
      return yield* Effect.succeed([slot, null] as const)
    }

    const extractAmount = amount || slot.item.count
    if (extractAmount <= 0) {
      return yield* Effect.fail(
        new OperationError({
          reason: 'Extract amount must be positive',
          operation: 'extractItem',
          context: { slot, amount },
        })
      )
    }

    if (extractAmount >= slot.item.count) {
      // 全て抽出
      const extractedItem = slot.item
      const newSlot: ContainerSlot = { ...slot, item: null }
      return yield* Effect.succeed([newSlot, extractedItem] as const)
    } else {
      // 一部抽出
      const extractedItem: ItemStack = {
        ...slot.item,
        count: extractAmount,
      }
      const remainingItem: ItemStack = {
        ...slot.item,
        count: slot.item.count - extractAmount,
      }
      const newSlot: ContainerSlot = { ...slot, item: remainingItem }
      return yield* Effect.succeed([newSlot, extractedItem] as const)
    }
  })

// 初期アイテム配置（Pure Function with Effect）
const placeInitialItems = (
  slots: ReadonlyArray<ContainerSlot>,
  items: ReadonlyArray<{ slotIndex: number; item: ItemStack }>
): Effect.Effect<ReadonlyArray<ContainerSlot>, ContainerCreationError> =>
  Effect.gen(function* () {
    const mutableSlots = [...slots]

    for (const itemPlacement of items) {
      const { slotIndex, item } = itemPlacement

      if (slotIndex < 0 || slotIndex >= mutableSlots.length) {
        return yield* Effect.fail(
          new CreationError({
            reason: `Invalid slot index ${slotIndex}`,
            invalidFields: ['slotIndex'],
            context: { itemPlacement, totalSlots: mutableSlots.length },
          })
        )
      }

      const currentSlot = mutableSlots[slotIndex]
      const updatedSlot = yield* insertItemIntoSlot(currentSlot, item)
      mutableSlots[slotIndex] = updatedSlot
    }

    return yield* Effect.succeed(mutableSlots)
  })

// ===== Factory実装（Function.flowとEffect.genパターン） =====

export const ContainerFactoryLive: ContainerFactory = {
  // 基本生成（Pure Function Factory）
  createEmpty: (id, type) =>
    Effect.gen(function* () {
      const spec = getContainerSpec(type)
      const slots = createEmptySlots(spec)

      const container: Container = {
        id,
        type,
        slots,
        totalSlots: spec.defaultSlotCount,
        permissions: defaultContainerPermissions,
        isOpen: false,
        isLocked: false,
      }

      yield* ContainerFactoryLive.validateContainer(container)

      return yield* Effect.succeed(container)
    }),

  // チェスト生成
  createChest: (id, size = 'small') =>
    Effect.gen(function* () {
      const type: ContainerType = size === 'large' ? 'large_chest' : 'chest'
      return yield* ContainerFactoryLive.createEmpty(id, type)
    }),

  // 溶鉱炉生成
  createFurnace: (id, variant = 'furnace') =>
    Effect.gen(function* () {
      const type: ContainerType = pipe(
        variant,
        Match.value,
        Match.when('blast_furnace', () => 'blast_furnace' as ContainerType),
        Match.when('smoker', () => 'smoker' as ContainerType),
        Match.orElse(() => 'furnace' as ContainerType)
      )

      return yield* ContainerFactoryLive.createEmpty(id, type)
    }),

  // ホッパー生成
  createHopper: (id) =>
    Effect.gen(function* () {
      return yield* ContainerFactoryLive.createEmpty(id, 'hopper')
    }),

  // 醸造台生成
  createBrewingStand: (id) =>
    Effect.gen(function* () {
      return yield* ContainerFactoryLive.createEmpty(id, 'brewing_stand')
    }),

  // 作業台生成
  createCraftingTable: (id) =>
    Effect.gen(function* () {
      return yield* ContainerFactoryLive.createEmpty(id, 'crafting_table')
    }),

  // シュルカーボックス生成
  createShulkerBox: (id, color) =>
    Effect.gen(function* () {
      const container = yield* ContainerFactoryLive.createEmpty(id, 'shulker_box')

      const metadata = color ? { color } : undefined

      return yield* Effect.succeed({
        ...container,
        metadata,
      })
    }),

  // 設定ベース生成（Configuration Pattern）
  createWithConfig: (config) =>
    Effect.gen(function* () {
      yield* validateContainerConfig(config)

      const spec = getContainerSpec(config.type)
      let slots = createEmptySlots(spec)

      // 初期アイテム配置
      if (config.initialItems && config.initialItems.length > 0) {
        slots = yield* placeInitialItems(slots, config.initialItems)
      }

      const container: Container = {
        id: config.id,
        type: config.type,
        name: config.name,
        slots,
        totalSlots: config.totalSlots || spec.defaultSlotCount,
        permissions: { ...defaultContainerPermissions, ...config.permissions },
        metadata: config.metadata,
        position: config.position,
        owner: config.owner,
        isOpen: false,
        isLocked: config.isLocked || false,
        lockKey: config.lockKey,
      }

      return yield* Effect.succeed(container)
    }),

  // アイテム付き生成
  createWithItems: (id, type, items) =>
    Effect.gen(function* () {
      const config: ContainerConfig = {
        id,
        type,
        initialItems: items,
      }

      return yield* ContainerFactoryLive.createWithConfig(config)
    }),

  // アイテム挿入
  insertItem: (container, item, slotIndex) =>
    Effect.gen(function* () {
      if (slotIndex !== undefined) {
        // 指定スロットに挿入
        if (slotIndex < 0 || slotIndex >= container.slots.length) {
          return yield* Effect.fail(
            new OperationError({
              reason: `Invalid slot index ${slotIndex}`,
              operation: 'insertItem',
              context: { container: container.id, slotIndex },
            })
          )
        }

        const targetSlot = container.slots[slotIndex]
        const updatedSlot = yield* insertItemIntoSlot(targetSlot, item)
        const newSlots = [...container.slots]
        newSlots[slotIndex] = updatedSlot

        return yield* Effect.succeed({
          ...container,
          slots: newSlots,
        })
      } else {
        // 最初の利用可能なスロットに挿入
        for (let i = 0; i < container.slots.length; i++) {
          const slot = container.slots[i]
          if (canInsertIntoSlot(slot, item)) {
            const updatedSlot = yield* insertItemIntoSlot(slot, item)
            const newSlots = [...container.slots]
            newSlots[i] = updatedSlot

            return yield* Effect.succeed({
              ...container,
              slots: newSlots,
            })
          }
        }

        // 挿入可能なスロットが見つからない
        return yield* Effect.fail(
          new OperationError({
            reason: 'No available slot for item insertion',
            operation: 'insertItem',
            context: { container: container.id, item },
          })
        )
      }
    }),

  // アイテム抽出
  extractItem: (container, slotIndex, amount) =>
    Effect.gen(function* () {
      if (slotIndex < 0 || slotIndex >= container.slots.length) {
        return yield* Effect.fail(
          new OperationError({
            reason: `Invalid slot index ${slotIndex}`,
            operation: 'extractItem',
            context: { container: container.id, slotIndex },
          })
        )
      }

      const targetSlot = container.slots[slotIndex]
      const [updatedSlot, extractedItem] = yield* extractItemFromSlot(targetSlot, amount)

      const newSlots = [...container.slots]
      newSlots[slotIndex] = updatedSlot

      const updatedContainer: Container = {
        ...container,
        slots: newSlots,
      }

      return yield* Effect.succeed([updatedContainer, extractedItem] as const)
    }),

  // アイテム移動
  moveItem: (container, fromSlot, toSlot) =>
    Effect.gen(function* () {
      if (fromSlot === toSlot) {
        return yield* Effect.succeed(container)
      }

      if (fromSlot < 0 || fromSlot >= container.slots.length || toSlot < 0 || toSlot >= container.slots.length) {
        return yield* Effect.fail(
          new OperationError({
            reason: 'Invalid slot indices for move operation',
            operation: 'moveItem',
            context: { container: container.id, fromSlot, toSlot },
          })
        )
      }

      const sourceSlot = container.slots[fromSlot]
      const targetSlot = container.slots[toSlot]

      if (sourceSlot.item === null) {
        return yield* Effect.succeed(container)
      }

      const [updatedSourceSlot, extractedItem] = yield* extractItemFromSlot(sourceSlot)
      if (extractedItem === null) {
        return yield* Effect.succeed(container)
      }

      const updatedTargetSlot = yield* insertItemIntoSlot(targetSlot, extractedItem)

      const newSlots = [...container.slots]
      newSlots[fromSlot] = updatedSourceSlot
      newSlots[toSlot] = updatedTargetSlot

      return yield* Effect.succeed({
        ...container,
        slots: newSlots,
      })
    }),

  // コンテナクリア
  clearContainer: (container) =>
    Effect.gen(function* () {
      const spec = getContainerSpec(container.type)
      const clearedSlots = createEmptySlots(spec)

      return yield* Effect.succeed({
        ...container,
        slots: clearedSlots,
      })
    }),

  // コンテナ検証
  validateContainer: (container) =>
    Effect.gen(function* () {
      const errors: string[] = []

      if (!container.id || container.id.trim() === '') {
        errors.push('id is required')
      }

      if (!container.type) {
        errors.push('type is required')
      }

      const spec = getContainerSpec(container.type)
      if (container.totalSlots !== spec.defaultSlotCount) {
        errors.push(`totalSlots should be ${spec.defaultSlotCount} for ${container.type}`)
      }

      if (container.slots.length !== spec.defaultSlotCount) {
        errors.push(`slots array length should be ${spec.defaultSlotCount}`)
      }

      // スロットインデックスの検証
      for (let i = 0; i < container.slots.length; i++) {
        const slot = container.slots[i]
        if (slot.index !== i) {
          errors.push(`slot at position ${i} has incorrect index ${slot.index}`)
        }
      }

      if (errors.length > 0) {
        return yield* Effect.fail(
          new ValidationError({
            reason: 'Container validation failed',
            missingFields: errors,
            context: { container },
          })
        )
      }

      return yield* Effect.void
    }),

  // コンテナ最適化
  optimizeContainer: (container) =>
    Effect.gen(function* () {
      yield* ContainerFactoryLive.validateContainer(container)

      // スタック統合などの最適化
      const optimizedSlots = [...container.slots]

      // 同じアイテムのスタック統合
      for (let i = 0; i < optimizedSlots.length; i++) {
        const slot1 = optimizedSlots[i]
        if (!slot1.item || slot1.type !== 'storage') continue

        for (let j = i + 1; j < optimizedSlots.length; j++) {
          const slot2 = optimizedSlots[j]
          if (!slot2.item || slot2.type !== 'storage') continue

          if (slot1.item.itemId === slot2.item.itemId) {
            const maxStackSize = Math.min(slot1.maxStackSize || 64, slot2.maxStackSize || 64)
            const totalCount = slot1.item.count + slot2.item.count

            if (totalCount <= maxStackSize) {
              // 統合可能
              optimizedSlots[i] = {
                ...slot1,
                item: { ...slot1.item, count: totalCount },
              }
              optimizedSlots[j] = { ...slot2, item: null }
            }
          }
        }
      }

      return yield* Effect.succeed({
        ...container,
        slots: optimizedSlots,
      })
    }),

  // 空きスロット取得
  getEmptySlots: (container) =>
    container.slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.item === null)
      .map(({ index }) => index),

  // 占有スロット取得
  getOccupiedSlots: (container) =>
    container.slots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => slot.item !== null)
      .map(({ index }) => index),

  // タイプ別スロット取得
  getSlotByType: (container, type) => container.slots.filter((slot) => slot.type === type),

  // アイテム挿入可能性チェック
  canInsertItem: (container, item, slotIndex) => {
    if (slotIndex !== undefined) {
      if (slotIndex < 0 || slotIndex >= container.slots.length) {
        return false
      }
      return canInsertIntoSlot(container.slots[slotIndex], item)
    } else {
      return container.slots.some((slot) => canInsertIntoSlot(slot, item))
    }
  },
}

// Layer.effect による依存性注入実装
export const ContainerFactoryLayer = Effect.succeed(ContainerFactoryLive)
