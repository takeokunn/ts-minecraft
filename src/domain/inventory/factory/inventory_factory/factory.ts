/**
 * InventoryFactory - DDD Factory Implementation
 *
 * Effect-TSの関数型パターンによるInventory生成の純粋関数実装
 * class構文を一切使用せず、pipe/flowによる関数合成とEffect.genで実装
 */

import { Effect, Match, Option, pipe } from 'effect'
import * as ReadonlyArray from 'effect/Array'
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
    // playerIdの検証
    yield* Effect.succeed(config.playerId).pipe(
      Effect.filterOrFail(
        (id) => id && id.trim() !== '',
        () =>
          new CreationError({
            reason: 'Invalid inventory configuration',
            invalidFields: ['playerId is required'],
            context: { config },
          })
      )
    )

    // slotCountの検証
    yield* Effect.succeed(config.slotCount).pipe(
      Effect.filterOrFail(
        (count) => count >= 0 && count <= 54,
        () =>
          new CreationError({
            reason: 'Invalid inventory configuration',
            invalidFields: ['slotCount must be between 0 and 54'],
            context: { config },
          })
      )
    )

    // startingItemsの検証
    yield* Effect.when(config.startingItems !== undefined, () =>
      Effect.filterOrFail(
        config.startingItems!,
        (items) => items.length <= config.slotCount,
        () =>
          new CreationError({
            reason: 'Invalid inventory configuration',
            invalidFields: ['startingItems count exceeds slotCount'],
            context: { config },
          })
      )
    )

    return yield* Effect.void
  })

// アイテムを適切なスロットに配置（Pure Function with Effect）
const placeItemsInSlots = (
  inventory: Inventory,
  items: ReadonlyArray<ItemStack>
): Effect.Effect<Inventory, InventoryCreationError> =>
  Effect.gen(function* () {
    const slots = [...inventory.slots]

    // アイテムを空きスロットに配置
    type PlacementAcc = { slots: Array<ItemStack | null>; itemIndex: number }
    const initialAcc: PlacementAcc = { slots, itemIndex: 0 }
    const placementResult = pipe(
      items,
      ReadonlyArray.reduce(initialAcc, (acc, item) =>
        pipe(
          acc.slots.findIndex((slot, idx) => slot === null && idx >= acc.itemIndex),
          (emptySlotIndex) =>
            emptySlotIndex === -1
              ? acc
              : pipe([...acc.slots], (newSlots) => {
                  newSlots[emptySlotIndex] = item
                  return { slots: newSlots, itemIndex: acc.itemIndex + 1 }
                })
        )
      )
    )

    // すべてのアイテムが配置できたか検証
    yield* Effect.succeed(placementResult.itemIndex).pipe(
      Effect.filterOrFail(
        (index) => index >= items.length,
        () =>
          new CreationError({
            reason: 'Not enough empty slots for all starting items',
            invalidFields: ['startingItems'],
            context: { availableSlots: slots.length, requestedItems: items.length },
          })
      )
    )

    return yield* Effect.succeed({
      ...inventory,
      slots: placementResult.slots,
    })
  })

// インベントリーの最適化（アイテムスタック統合）
const optimizeStacks = (inventory: Inventory): Effect.Effect<Inventory, InventoryCreationError> =>
  Effect.gen(function* () {
    // 同一アイテムのスタック統合ロジック
    const initialSlots: Array<ItemStack | null> = [...inventory.slots]
    const optimizedSlots = pipe(
      ReadonlyArray.makeBy(inventory.slots.length, (i) => i),
      ReadonlyArray.reduce(initialSlots, (slots, i) =>
        pipe(
          Option.fromNullable(slots[i]),
          Option.match({
            onNone: () => slots,
            onSome: (currentSlot) =>
              pipe(
                ReadonlyArray.makeBy(slots.length - (i + 1), (offset) => i + 1 + offset),
                ReadonlyArray.reduce(slots, (currentSlots, j) =>
                  pipe(
                    Option.fromNullable(currentSlots[j]),
                    Option.match({
                      onNone: () => currentSlots,
                      onSome: (targetSlot) =>
                        currentSlot.itemId === targetSlot.itemId && currentSlot.count + targetSlot.count <= 64
                          ? pipe([...currentSlots], (newSlots) => {
                              newSlots[i] = {
                                ...currentSlot,
                                count: currentSlot.count + targetSlot.count,
                              }
                              newSlots[j] = null
                              return newSlots
                            })
                          : currentSlots,
                    })
                  )
                )
              ),
          })
        )
      )
    )

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

      // 機能別設定適用（Match.whenパターン）
      const withHotbar = yield* pipe(
        Match.value(config.enableHotbar),
        Match.when(true, () => Effect.succeed(baseInventory.hotbar)),
        Match.orElse(() => Effect.succeed([]))
      )

      const withArmor = yield* pipe(
        Match.value(config.enableArmor),
        Match.when(true, () => Effect.succeed(baseInventory.armor)),
        Match.orElse(() =>
          Effect.succeed({
            helmet: null,
            chestplate: null,
            leggings: null,
            boots: null,
          })
        )
      )

      const withOffhand = yield* pipe(
        Match.value(config.enableOffhand),
        Match.when(true, () => Effect.succeed(baseInventory.offhand)),
        Match.orElse(() => Effect.succeed(null))
      )

      let result: Inventory = {
        ...baseInventory,
        slots: adjustedSlots,
        hotbar: withHotbar,
        armor: withArmor,
        offhand: withOffhand,
      }

      // 初期アイテム配置
      result = yield* pipe(
        Match.value(config.startingItems !== undefined && config.startingItems.length > 0),
        Match.when(true, () => placeItemsInSlots(result, config.startingItems!)),
        Match.orElse(() => Effect.succeed(result))
      )

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
      // セカンダリのアイテムをプライマリに統合
      type MergeAcc = { mergedSlots: Array<ItemStack | null>; conflicts: string[] }
      const initialMergeAcc: MergeAcc = { mergedSlots: [...primary.slots], conflicts: [] }
      const mergeResult = pipe(
        ReadonlyArray.makeBy(Math.min(secondary.slots.length, primary.slots.length), (i) => i),
        ReadonlyArray.reduce(initialMergeAcc, (acc, i) =>
          pipe(
            Option.fromNullable(secondary.slots[i]),
            Option.match({
              onNone: () => acc,
              onSome: (secondaryItem) =>
                pipe(
                  Option.fromNullable(acc.mergedSlots[i]),
                  Option.match({
                    onNone: () => {
                      const newSlots = [...acc.mergedSlots]
                      newSlots[i] = secondaryItem
                      return { mergedSlots: newSlots, conflicts: acc.conflicts }
                    },
                    onSome: () => ({
                      mergedSlots: acc.mergedSlots,
                      conflicts: [...acc.conflicts, `slot_${i}`],
                    }),
                  })
                ),
            })
          )
        )
      )

      // コンフリクトチェック
      yield* Effect.succeed(mergeResult.conflicts.length).pipe(
        Effect.filterOrFail(
          (len) => len === 0,
          () =>
            new MergeError({
              reason: 'Slot conflicts during merge',
              conflictingFields: mergeResult.conflicts,
              context: { primaryId: primary.playerId, secondaryId: secondary.playerId },
            })
        )
      )

      const merged: Inventory = {
        ...primary,
        slots: mergeResult.mergedSlots,
      }

      return yield* Effect.succeed(merged)
    }),

  // インベントリー検証
  validateInventory: (inventory) =>
    Effect.gen(function* () {
      // playerIdの検証
      yield* Effect.succeed(inventory.playerId).pipe(
        Effect.filterOrFail(
          (id) => id && id.trim() !== '',
          () =>
            new ValidationError({
              reason: 'Inventory validation failed',
              missingFields: ['playerId is required'],
              context: { inventory },
            })
        )
      )

      // slotsの検証
      yield* Effect.succeed(inventory.slots.length).pipe(
        Effect.filterOrFail(
          (len) => len === 36,
          () =>
            new ValidationError({
              reason: 'Inventory validation failed',
              missingFields: ['slots array must have exactly 36 elements'],
              context: { inventory },
            })
        )
      )

      // hotbarの検証
      yield* Effect.succeed(inventory.hotbar.length).pipe(
        Effect.filterOrFail(
          (len) => len === 9,
          () =>
            new ValidationError({
              reason: 'Inventory validation failed',
              missingFields: ['hotbar array must have exactly 9 elements'],
              context: { inventory },
            })
        )
      )

      // selectedSlotの検証
      yield* Effect.succeed(inventory.selectedSlot).pipe(
        Effect.filterOrFail(
          (slot) => slot >= 0 && slot <= 8,
          () =>
            new ValidationError({
              reason: 'Inventory validation failed',
              missingFields: ['selectedSlot must be between 0 and 8'],
              context: { inventory },
            })
        )
      )

      // ホットバーインデックスの検証
      const hotbarErrors = pipe(
        inventory.hotbar,
        ReadonlyArray.filterMap((slotIndex) =>
          slotIndex < 0 || slotIndex >= inventory.slots.length
            ? Option.some(`invalid hotbar slot index: ${slotIndex}`)
            : Option.none()
        )
      )

      yield* Effect.succeed(hotbarErrors.length).pipe(
        Effect.filterOrFail(
          (len) => len === 0,
          () =>
            new ValidationError({
              reason: 'Inventory validation failed',
              missingFields: hotbarErrors,
              context: { inventory },
            })
        )
      )

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
