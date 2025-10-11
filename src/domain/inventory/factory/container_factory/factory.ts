/**
 * ContainerFactory - DDD Factory Implementation for Container Systems
 *
 * Effect-TSの関数型パターンによるContainer生成の純粋関数実装
 * class構文を一切使用せず、pipe/flowによる関数合成とEffect.genで実装
 */

import { Effect, Match, Option, pipe, ReadonlyArray } from 'effect'
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
  asContainerType,
  ContainerCreationError as CreationError,
  ContainerOperationError as OperationError,
  ContainerValidationError as ValidationError,
} from './interface'

// ===== 内部ヘルパー関数（Pure Functions） =====

// コンテナタイプ仕様取得（Match.valueパターン）
const getContainerSpec = (type: ContainerType): ContainerTypeSpec => containerTypeSpecs[type]

// 空のスロット生成（Pure Function）
const createEmptySlots = (spec: ContainerTypeSpec): ReadonlyArray<ContainerSlot> =>
  pipe(
    ReadonlyArray.makeBy(spec.defaultSlotCount, (i) => {
      const specialSlot = spec.specialSlots?.find((s) => s.index === i)

      return {
        index: i,
        type: (specialSlot?.type || 'storage') as const,
        item: null,
        acceptsItemType: specialSlot?.acceptsItemType,
        maxStackSize: 64,
      }
    })
  )

// コンテナ設定の検証（Pure Function with Effect Error Handling）
const validateContainerConfig = (config: ContainerConfig): Effect.Effect<void, ContainerCreationError> =>
  Effect.gen(function* () {
    const errors = pipe(
      [
        pipe(
          !config.id || config.id.trim() === '',
          Option.liftPredicate((isEmpty) => isEmpty),
          Option.map(() => 'id is required')
        ),
        pipe(
          !config.type,
          Option.liftPredicate((isEmpty) => isEmpty),
          Option.map(() => 'type is required')
        ),
      ],
      ReadonlyArray.filterMap((opt) => opt)
    )

    const spec = getContainerSpec(config.type)
    const slotErrors = pipe(
      config.totalSlots,
      Option.fromNullable,
      Option.map((totalSlots) =>
        pipe(
          [
            pipe(
              totalSlots < 1 || totalSlots > 54,
              Option.liftPredicate((invalid) => invalid),
              Option.map(() => 'totalSlots must be between 1 and 54')
            ),
            pipe(
              totalSlots !== spec.defaultSlotCount,
              Option.liftPredicate((mismatch) => mismatch),
              Option.map(() => `totalSlots for ${config.type} should be ${spec.defaultSlotCount}`)
            ),
          ],
          ReadonlyArray.filterMap((opt) => opt)
        )
      ),
      Option.getOrElse((): ReadonlyArray<string> => [])
    )

    const itemErrors = pipe(
      config.initialItems ?? [],
      ReadonlyArray.filterMap((item) =>
        pipe(
          item.slotIndex < 0 || item.slotIndex >= spec.defaultSlotCount,
          Option.liftPredicate((invalid) => invalid),
          Option.map(() => `invalid slot index ${item.slotIndex} for ${config.type}`)
        )
      )
    )

    const allErrors = [...errors, ...slotErrors, ...itemErrors]

    return yield* pipe(
      allErrors.length > 0,
      Effect.when({
        onTrue: () =>
          Effect.fail(
            new CreationError({
              reason: 'Invalid container configuration',
              invalidFields: allErrors,
              context: { config },
            })
          ),
        onFalse: () => Effect.void,
      })
    )
  })

// スロットにアイテムが挿入可能かチェック（Pure Function）
const canInsertIntoSlot = (slot: ContainerSlot, item: ItemStack): boolean =>
  pipe(
    slot,
    Match.value,
    // スロットが既に占有されている場合
    Match.when(
      (s) => s.item !== null,
      (s) =>
        pipe(
          Option.fromNullable(s.item),
          Option.match({
            onNone: () => false,
            onSome: (existingItem) =>
              pipe(
                existingItem.itemId === item.itemId,
                Match.value,
                // 同じアイテムでスタック可能かチェック
                Match.when(true, () => {
                  const maxStackSize = s.maxStackSize || 64
                  return existingItem.count + item.count <= maxStackSize
                }),
                Match.orElse(() => false)
              ),
          })
        )
    ),
    // 空のスロットの場合、アイテムタイプ制限をチェック
    Match.when(
      (s) => s.acceptsItemType !== undefined,
      (s) => s.acceptsItemType!(item.itemId)
    ),
    // デフォルト: 挿入可能
    Match.orElse(() => true)
  )

// アイテム挿入処理（Pure Function with Effect）
const insertItemIntoSlot = (slot: ContainerSlot, item: ItemStack): Effect.Effect<ContainerSlot, OperationError> =>
  Effect.gen(function* () {
    const canInsert = yield* canInsertIntoSlot(slot, item)

    return yield* pipe(
      Match.value(canInsert),
      Match.when(true, () =>
        pipe(
          Option.fromNullable(slot.item),
          Option.match({
            onNone: () =>
              Effect.succeed({
                ...slot,
                item,
              }),
            onSome: (existingItem) =>
              Effect.gen(function* () {
                const maxStackSize = slot.maxStackSize || 64
                const newCount = Math.min(existingItem.count + item.count, maxStackSize)

                return yield* Effect.succeed({
                  ...slot,
                  item: {
                    ...existingItem,
                    count: newCount,
                  },
                })
              }),
          })
        )
      ),
      Match.orElse(() =>
        Effect.fail(
          new OperationError({
            reason: 'Cannot insert item into slot',
            operation: 'insertItem',
            context: { slot, item },
          })
        )
      )
    )
  })

// スロットからアイテム抽出（Pure Function with Effect）
const extractItemFromSlot = (
  slot: ContainerSlot,
  amount?: number
): Effect.Effect<readonly [ContainerSlot, ItemStack | null], OperationError> =>
  Effect.gen(function* () {
    return yield* pipe(
      Option.fromNullable(slot.item),
      Option.match({
        onNone: () => Effect.succeed([slot, null] as const),
        onSome: (item) =>
          Effect.gen(function* () {
            const extractAmount = amount || item.count

            return yield* pipe(
              Match.value(extractAmount <= 0),
              Match.when(true, () =>
                Effect.fail(
                  new OperationError({
                    reason: 'Extract amount must be positive',
                    operation: 'extractItem',
                    context: { slot, amount },
                  })
                )
              ),
              Match.orElse(() =>
                pipe(
                  Match.value(extractAmount >= item.count),
                  Match.when(true, () => Effect.succeed([{ ...slot, item: null }, item] as const)),
                  Match.orElse(() =>
                    Effect.gen(function* () {
                      const extractedItem: ItemStack = {
                        ...item,
                        count: extractAmount,
                      }
                      const remainingItem: ItemStack = {
                        ...item,
                        count: item.count - extractAmount,
                      }
                      const newSlot: ContainerSlot = { ...slot, item: remainingItem }
                      return yield* Effect.succeed([newSlot, extractedItem] as const)
                    })
                  )
                )
              )
            )
          }),
      })
    )
  })

// 初期アイテム配置（Pure Function with Effect）
const placeInitialItems = (
  slots: ReadonlyArray<ContainerSlot>,
  items: ReadonlyArray<{ slotIndex: number; item: ItemStack }>
): Effect.Effect<ReadonlyArray<ContainerSlot>, ContainerCreationError> =>
  Effect.gen(function* () {
    return yield* pipe(
      items,
      Effect.reduce([...slots], (mutableSlots, itemPlacement) =>
        Effect.gen(function* () {
          const { slotIndex, item } = itemPlacement

          return yield* pipe(
            Match.value(slotIndex < 0 || slotIndex >= mutableSlots.length),
            Match.when(true, () =>
              Effect.fail(
                new CreationError({
                  reason: `Invalid slot index ${slotIndex}`,
                  invalidFields: ['slotIndex'],
                  context: { itemPlacement, totalSlots: mutableSlots.length },
                })
              )
            ),
            Match.orElse(() =>
              Effect.gen(function* () {
                const currentSlot = mutableSlots[slotIndex]
                const updatedSlot = yield* insertItemIntoSlot(currentSlot, item)
                mutableSlots[slotIndex] = updatedSlot
                return yield* Effect.succeed(mutableSlots)
              })
            )
          )
        })
      )
    )
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
        Match.when('blast_furnace', () => asContainerType('blast_furnace')),
        Match.when('smoker', () => asContainerType('smoker')),
        Match.orElse(() => asContainerType('furnace'))
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

      const metadata = pipe(
        Option.fromNullable(color),
        Option.map((c) => ({ color: c })),
        Option.getOrUndefined
      )

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
      const emptySlots = createEmptySlots(spec)

      const slots = yield* pipe(
        config.initialItems,
        Option.fromNullable,
        Option.filter((items) => items.length > 0),
        Option.match({
          onNone: () => Effect.succeed(emptySlots),
          onSome: (items) => placeInitialItems(emptySlots, items),
        })
      )

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
      return yield* pipe(
        Option.fromNullable(slotIndex),
        Option.match({
          onNone: () =>
            Effect.gen(function* () {
              const availableSlotIndex = pipe(
                container.slots,
                ReadonlyArray.findFirstIndex((slot) => canInsertIntoSlot(slot, item))
              )

              return yield* pipe(
                availableSlotIndex,
                Option.match({
                  onNone: () =>
                    Effect.fail(
                      new OperationError({
                        reason: 'No available slot for item insertion',
                        operation: 'insertItem',
                        context: { container: container.id, item },
                      })
                    ),
                  onSome: (slotIndex) =>
                    Effect.gen(function* () {
                      const updatedSlot = yield* insertItemIntoSlot(container.slots[slotIndex], item)
                      const newSlots = [...container.slots]
                      newSlots[slotIndex] = updatedSlot

                      return yield* Effect.succeed({
                        ...container,
                        slots: newSlots,
                      })
                    }),
                })
              )
            }),
          onSome: (targetSlotIndex) =>
            Effect.gen(function* () {
              return yield* pipe(
                Match.value(targetSlotIndex < 0 || targetSlotIndex >= container.slots.length),
                Match.when(true, () =>
                  Effect.fail(
                    new OperationError({
                      reason: `Invalid slot index ${targetSlotIndex}`,
                      operation: 'insertItem',
                      context: { container: container.id, slotIndex: targetSlotIndex },
                    })
                  )
                ),
                Match.orElse(() =>
                  Effect.gen(function* () {
                    const targetSlot = container.slots[targetSlotIndex]
                    const updatedSlot = yield* insertItemIntoSlot(targetSlot, item)
                    const newSlots = [...container.slots]
                    newSlots[targetSlotIndex] = updatedSlot

                    return yield* Effect.succeed({
                      ...container,
                      slots: newSlots,
                    })
                  })
                )
              )
            }),
        })
      )
    }),

  // アイテム抽出
  extractItem: (container, slotIndex, amount) =>
    Effect.gen(function* () {
      return yield* pipe(
        Match.value(slotIndex < 0 || slotIndex >= container.slots.length),
        Match.when(true, () =>
          Effect.fail(
            new OperationError({
              reason: `Invalid slot index ${slotIndex}`,
              operation: 'extractItem',
              context: { container: container.id, slotIndex },
            })
          )
        ),
        Match.orElse(() =>
          Effect.gen(function* () {
            const targetSlot = container.slots[slotIndex]
            const [updatedSlot, extractedItem] = yield* extractItemFromSlot(targetSlot, amount)

            const newSlots = [...container.slots]
            newSlots[slotIndex] = updatedSlot

            const updatedContainer: Container = {
              ...container,
              slots: newSlots,
            }

            return yield* Effect.succeed([updatedContainer, extractedItem] as const)
          })
        )
      )
    }),

  // アイテム移動
  moveItem: (container, fromSlot, toSlot) =>
    Effect.gen(function* () {
      return yield* pipe(
        Match.value(fromSlot === toSlot),
        Match.when(true, () => Effect.succeed(container)),
        Match.orElse(() =>
          pipe(
            Match.value(
              fromSlot < 0 || fromSlot >= container.slots.length || toSlot < 0 || toSlot >= container.slots.length
            ),
            Match.when(true, () =>
              Effect.fail(
                new OperationError({
                  reason: 'Invalid slot indices for move operation',
                  operation: 'moveItem',
                  context: { container: container.id, fromSlot, toSlot },
                })
              )
            ),
            Match.orElse(() =>
              Effect.gen(function* () {
                const sourceSlot = container.slots[fromSlot]
                const targetSlot = container.slots[toSlot]

                return yield* pipe(
                  Option.fromNullable(sourceSlot.item),
                  Option.match({
                    onNone: () => Effect.succeed(container),
                    onSome: () =>
                      Effect.gen(function* () {
                        const [updatedSourceSlot, extractedItem] = yield* extractItemFromSlot(sourceSlot)

                        return yield* pipe(
                          Option.fromNullable(extractedItem),
                          Option.match({
                            onNone: () => Effect.succeed(container),
                            onSome: (item) =>
                              Effect.gen(function* () {
                                const updatedTargetSlot = yield* insertItemIntoSlot(targetSlot, item)

                                const newSlots = [...container.slots]
                                newSlots[fromSlot] = updatedSourceSlot
                                newSlots[toSlot] = updatedTargetSlot

                                return yield* Effect.succeed({
                                  ...container,
                                  slots: newSlots,
                                })
                              }),
                          })
                        )
                      }),
                  })
                )
              })
            )
          )
        )
      )
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
      const basicErrors = pipe(
        [
          pipe(
            !container.id || container.id.trim() === '',
            Option.liftPredicate((isEmpty) => isEmpty),
            Option.map(() => 'id is required')
          ),
          pipe(
            !container.type,
            Option.liftPredicate((isEmpty) => isEmpty),
            Option.map(() => 'type is required')
          ),
        ],
        ReadonlyArray.filterMap((opt) => opt)
      )

      const spec = getContainerSpec(container.type)
      const specErrors = pipe(
        [
          pipe(
            container.totalSlots !== spec.defaultSlotCount,
            Option.liftPredicate((mismatch) => mismatch),
            Option.map(() => `totalSlots should be ${spec.defaultSlotCount} for ${container.type}`)
          ),
          pipe(
            container.slots.length !== spec.defaultSlotCount,
            Option.liftPredicate((mismatch) => mismatch),
            Option.map(() => `slots array length should be ${spec.defaultSlotCount}`)
          ),
        ],
        ReadonlyArray.filterMap((opt) => opt)
      )

      const indexErrors = pipe(
        container.slots,
        ReadonlyArray.filterMap((slot, i) =>
          pipe(
            slot.index !== i,
            Option.liftPredicate((mismatch) => mismatch),
            Option.map(() => `slot at position ${i} has incorrect index ${slot.index}`)
          )
        )
      )

      const allErrors = [...basicErrors, ...specErrors, ...indexErrors]

      return yield* pipe(
        allErrors.length > 0,
        Effect.when({
          onTrue: () =>
            Effect.fail(
              new ValidationError({
                reason: 'Container validation failed',
                missingFields: allErrors,
                context: { container },
              })
            ),
          onFalse: () => Effect.void,
        })
      )
    }),

  // コンテナ最適化
  optimizeContainer: (container) =>
    Effect.gen(function* () {
      yield* ContainerFactoryLive.validateContainer(container)

      const initialSlots: ContainerSlot[] = [...container.slots]
      const optimizedSlots = pipe(
        ReadonlyArray.makeBy(container.slots.length, (i) => i),
        ReadonlyArray.reduce(initialSlots, (slots, i) => {
          const slot1 = slots[i]

          return pipe(!slot1.item || slot1.type !== 'storage', (shouldSkip) =>
            shouldSkip
              ? slots
              : pipe(
                  ReadonlyArray.makeBy(slots.length - (i + 1), (offset) => i + 1 + offset),
                  ReadonlyArray.reduce(slots, (currentSlots, j) => {
                    const slot2 = currentSlots[j]

                    return pipe(
                      !slot2.item || slot2.type !== 'storage' || slot1.item.itemId !== slot2.item.itemId,
                      (shouldSkip) =>
                        shouldSkip
                          ? currentSlots
                          : pipe(
                              slot1.item,
                              Option.fromNullable,
                              Option.flatMap((item1) =>
                                pipe(
                                  slot2.item,
                                  Option.fromNullable,
                                  Option.map((item2) => {
                                    const maxStackSize = Math.min(slot1.maxStackSize || 64, slot2.maxStackSize || 64)
                                    const totalCount = item1.count + item2.count

                                    return pipe(totalCount <= maxStackSize, (canMerge) =>
                                      canMerge
                                        ? pipe([...currentSlots], (newSlots) => {
                                            newSlots[i] = {
                                              ...slot1,
                                              item: { ...item1, count: totalCount },
                                            }
                                            newSlots[j] = { ...slot2, item: null }
                                            return newSlots
                                          })
                                        : currentSlots
                                    )
                                  })
                                )
                              ),
                              Option.getOrElse(() => currentSlots)
                            )
                    )
                  })
                )
          )
        })
      )

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
  canInsertItem: (container, item, slotIndex) =>
    pipe(
      Option.fromNullable(slotIndex),
      Option.match({
        onNone: () => container.slots.some((slot) => canInsertIntoSlot(slot, item)),
        onSome: (targetSlotIndex) =>
          pipe(
            targetSlotIndex < 0 || targetSlotIndex >= container.slots.length,
            (invalid) => !invalid && canInsertIntoSlot(container.slots[targetSlotIndex], item)
          ),
      })
    ),
}

// Layer.effect による依存性注入実装
export const ContainerFactoryLayer = Effect.succeed(ContainerFactoryLive)
