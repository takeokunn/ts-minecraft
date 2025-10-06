import { Clock, Effect, Layer, Option, Ref, Schema, pipe } from 'effect'
import * as ReadonlyArray from 'effect/Array'
import {
  Inventory,
  InventoryService,
  InventoryServiceError,
  InventoryStateSchema,
  ItemId,
  ItemIdSchema,
  ItemRegistry,
  ItemStack,
  PlayerId,
  computeChecksum,
  createEmptyInventory,
  touchInventory,
  type AddItemResult,
  type ItemDefinition,
} from './index'

const SLOT_COUNT = 36
const HOTBAR_SIZE = 9

const normalizeItemId = (itemId: ItemId | string): ItemId =>
  typeof itemId === 'string' ? Schema.decodeUnknownSync(ItemIdSchema)(itemId) : itemId

const sameStack = (left: ItemStack, right: ItemStack): boolean =>
  left.itemId === right.itemId && JSON.stringify(left.metadata ?? null) === JSON.stringify(right.metadata ?? null)

const ensureSlotIndex = (slotIndex: number) =>
  Effect.if(Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < SLOT_COUNT, {
    onTrue: () => Effect.succeed(slotIndex),
    onFalse: () => Effect.fail(InventoryServiceError.invalidSlotIndex(slotIndex)),
  })

const ensureHotbarIndex = (index: number) =>
  Effect.if(Number.isInteger(index) && index >= 0 && index < HOTBAR_SIZE, {
    onTrue: () => Effect.succeed(index),
    onFalse: () => Effect.fail(InventoryServiceError.invalidHotbarIndex(index)),
  })

const cloneItem = (item: ItemStack): ItemStack => ({
  itemId: item.itemId,
  count: item.count,
  metadata: item.metadata ? { ...item.metadata } : undefined,
})

const updateInventory = (inventory: Inventory, mutate: (draft: Inventory) => Inventory): Inventory => {
  const mutated = mutate({
    ...inventory,
    slots: [...inventory.slots],
    hotbar: [...inventory.hotbar],
    armor: {
      helmet: inventory.armor.helmet ? cloneItem(inventory.armor.helmet) : null,
      chestplate: inventory.armor.chestplate ? cloneItem(inventory.armor.chestplate) : null,
      leggings: inventory.armor.leggings ? cloneItem(inventory.armor.leggings) : null,
      boots: inventory.armor.boots ? cloneItem(inventory.armor.boots) : null,
    },
    offhand: inventory.offhand ? cloneItem(inventory.offhand) : null,
  })

  return touchInventory(mutated)
}

export const InventoryServiceLive = Layer.effect(
  InventoryService,
  Effect.gen(function* () {
    const itemRegistry = yield* ItemRegistry
    const stateRef = yield* Ref.make<Map<PlayerId, Inventory>>(new Map())

    const getOrCreateInventory = (playerId: PlayerId) =>
      Ref.modify(stateRef, (state) => {
        const existing = state.get(playerId)
        return pipe(
          Option.fromNullable(existing),
          Option.match({
            onNone: () => {
              const created = createEmptyInventory(playerId)
              const next = new Map(state)
              next.set(playerId, created)
              return [created, next] as const
            },
            onSome: (inv) => [inv, state] as const,
          })
        )
      })

    const saveInventory = (inventory: Inventory) =>
      Ref.update(stateRef, (state) => {
        const next = new Map(state)
        next.set(inventory.playerId, inventory)
        return next
      })

    const withInventory = <R, E>(
      playerId: PlayerId,
      f: (inventory: Inventory) => Effect.Effect<R, E>
    ): Effect.Effect<R, E> => Effect.flatMap(getOrCreateInventory(playerId), f)

    const buildAddResult = (
      original: Inventory,
      slots: Array<ItemStack | null>,
      definition: ItemDefinition,
      item: ItemStack
    ): { snapshot: Inventory; result: AddItemResult } => {
      let remaining = item.count
      let added = 0
      const touched = new Set<number>()

      const tryStack = (index: number) => {
        const current = slots[index]
        pipe(
          Option.fromNullable(current),
          Option.filter((curr) => sameStack(curr, item) && definition.stackable),
          Option.filter((curr) => curr.count < definition.maxStackSize),
          Option.map((curr) => {
            const capacity = definition.maxStackSize - curr.count
            const toAdd = Math.min(capacity, remaining)
            slots[index] = {
              ...curr,
              count: curr.count + toAdd,
            }
            remaining -= toAdd
            added += toAdd
            touched.add(index)
          })
        )
      }

      // 既存スタックへの追加を試行
      pipe(
        ReadonlyArray.makeBy(SLOT_COUNT, (i) => i),
        ReadonlyArray.forEach((index) => {
          pipe(
            Effect.when(
              () => remaining > 0,
              () => Effect.sync(() => tryStack(index))
            ),
            Effect.runSync
          )
        })
      )

      // 空きスロットへの配置
      pipe(
        ReadonlyArray.makeBy(SLOT_COUNT, (i) => i),
        ReadonlyArray.forEach((index) => {
          pipe(
            Effect.when(
              () => remaining > 0 && slots[index] === null,
              () =>
                Effect.sync(() => {
                  const toPlace = definition.stackable ? Math.min(definition.maxStackSize, remaining) : 1
                  slots[index] = {
                    itemId: item.itemId,
                    count: toPlace,
                    metadata: item.metadata ? { ...item.metadata } : undefined,
                  }
                  remaining -= toPlace
                  added += toPlace
                  touched.add(index)
                })
            ),
            Effect.runSync
          )
        })
      )

      const result: AddItemResult =
        added === 0
          ? {
              _tag: 'full',
              addedItems: 0,
              remainingItems: item.count,
              affectedSlots: [],
            }
          : remaining > 0
            ? {
                _tag: 'partial',
                addedItems: added,
                remainingItems: remaining,
                affectedSlots: Array.from(touched.values()).sort((a, b) => a - b),
              }
            : {
                _tag: 'success',
                addedItems: added,
                remainingItems: 0,
                affectedSlots: Array.from(touched.values()).sort((a, b) => a - b),
              }

      const snapshot = updateInventory(original, (draft) => ({
        ...draft,
        slots,
      }))

      return { snapshot, result }
    }

    const service: InventoryService = {
      createInventory: (playerId) =>
        Effect.gen(function* () {
          const inventory = createEmptyInventory(playerId)
          yield* saveInventory(inventory)
          return inventory
        }),

      getInventory: (playerId) => getOrCreateInventory(playerId),

      getInventoryState: (playerId) =>
        withInventory(playerId, (inventory) =>
          Effect.gen(function* () {
            return {
              inventory,
              persistedAt: yield* Clock.currentTimeMillis,
            }
          })
        ),

      loadInventoryState: (state) =>
        pipe(
          Schema.decodeUnknown(InventoryStateSchema)(state),
          Effect.mapError((error) => InventoryServiceError.inventoryStateValidationFailed(error)),
          Effect.flatMap(({ inventory }) =>
            Effect.gen(function* () {
              const lastUpdated = yield* Clock.currentTimeMillis
              yield* saveInventory({
                ...inventory,
                metadata: {
                  lastUpdated,
                  checksum: computeChecksum(inventory),
                },
              })
              return { inventory, persistedAt: lastUpdated }
            })
          )
        ),

      addItem: (playerId, item) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const definition = yield* itemRegistry.ensureDefinition(item.itemId)
          const slots = [...inventory.slots]
          const { snapshot, result } = buildAddResult(inventory, slots, definition, item)
          yield* Effect.when(
            () => result._tag !== 'full',
            () => saveInventory(snapshot)
          )
          return result
        }),

      setSlotItem: (playerId, slotIndex, item) =>
        Effect.gen(function* () {
          const index = yield* ensureSlotIndex(slotIndex)
          const inventory = yield* getOrCreateInventory(playerId)
          const updated = updateInventory(inventory, (draft) => {
            const nextSlots = [...draft.slots]
            nextSlots[index] = item ? cloneItem(item) : null
            return {
              ...draft,
              slots: nextSlots,
            }
          })
          yield* saveInventory(updated)
        }),

      getSlotItem: (playerId, slotIndex) =>
        Effect.gen(function* () {
          const index = yield* ensureSlotIndex(slotIndex)
          const inventory = yield* getOrCreateInventory(playerId)
          const item = inventory.slots[index]
          return pipe(
            Option.fromNullable(item),
            Option.match({
              onNone: () => null,
              onSome: (i) => cloneItem(i),
            })
          )
        }),

      removeItem: (playerId, slotIndex, amount) =>
        Effect.gen(function* () {
          const index = yield* ensureSlotIndex(slotIndex)
          const inventory = yield* getOrCreateInventory(playerId)
          const current = inventory.slots[index]
          return yield* pipe(
            Option.fromNullable(current),
            Option.match({
              onNone: () => Effect.succeed(null),
              onSome: (curr) =>
                Effect.gen(function* () {
                  const quantity = amount ?? curr.count
                  yield* Effect.when(
                    () => quantity > curr.count,
                    () =>
                      Effect.fail(
                        InventoryServiceError.insufficientQuantity({
                          slotIndex: index,
                          requested: quantity,
                          available: curr.count,
                        })
                      )
                  )
                  const updated = updateInventory(inventory, (draft) => {
                    const nextSlots = [...draft.slots]
                    nextSlots[index] = quantity === curr.count ? null : { ...curr, count: curr.count - quantity }
                    return {
                      ...draft,
                      slots: nextSlots,
                    }
                  })
                  yield* saveInventory(updated)
                  return {
                    itemId: curr.itemId,
                    count: quantity,
                    metadata: curr.metadata ? { ...curr.metadata } : undefined,
                  }
                }),
            })
          )
        }),

      moveItem: (playerId, fromSlot, toSlot, amount) =>
        Effect.gen(function* () {
          const fromIndex = yield* ensureSlotIndex(fromSlot)
          const toIndex = yield* ensureSlotIndex(toSlot)
          const inventory = yield* getOrCreateInventory(playerId)
          yield* Effect.when(
            () => fromIndex === toIndex,
            () => Effect.void
          )
          const source = inventory.slots[fromIndex]
          const destination = inventory.slots[toIndex]
          return yield* pipe(
            Option.fromNullable(source),
            Option.match({
              onNone: () =>
                Effect.fail(
                  InventoryServiceError.insufficientQuantity({
                    slotIndex: fromIndex,
                    requested: amount ?? 0,
                    available: 0,
                  })
                ),
              onSome: (src) =>
                Effect.gen(function* () {
                  const definition = yield* itemRegistry.ensureDefinition(src.itemId)
                  const transferAmount = amount ?? src.count
                  yield* Effect.when(
                    () => transferAmount > src.count || transferAmount <= 0,
                    () =>
                      Effect.fail(
                        InventoryServiceError.insufficientQuantity({
                          slotIndex: fromIndex,
                          requested: transferAmount,
                          available: src.count,
                        })
                      )
                  )
                  const updated = updateInventory(inventory, (draft) => {
                    const nextSlots = [...draft.slots]
                    const remaining = src.count - transferAmount
                    const movedItem: ItemStack = {
                      itemId: src.itemId,
                      count: transferAmount,
                      metadata: src.metadata ? { ...src.metadata } : undefined,
                    }

                    pipe(
                      Option.fromNullable(destination),
                      Option.match({
                        onNone: () => {
                          nextSlots[toIndex] = movedItem
                          nextSlots[fromIndex] = remaining > 0 ? { ...src, count: remaining } : null
                        },
                        onSome: (dest) => {
                          pipe(
                            Effect.if(sameStack(dest, src) && definition.stackable, {
                              onTrue: () =>
                                Effect.sync(() => {
                                  const total = dest.count + transferAmount
                                  const toPlace = Math.min(definition.maxStackSize, total)
                                  const remainder = total - toPlace
                                  nextSlots[toIndex] = { ...dest, count: toPlace }
                                  nextSlots[fromIndex] =
                                    remainder > 0
                                      ? { ...src, count: remaining + remainder }
                                      : remaining > 0
                                        ? { ...src, count: remaining }
                                        : null
                                }),
                              onFalse: () =>
                                Effect.sync(() => {
                                  nextSlots[toIndex] = movedItem
                                  nextSlots[fromIndex] = dest
                                }),
                            }),
                            Effect.runSync
                          )
                        },
                      })
                    )

                    return {
                      ...draft,
                      slots: nextSlots,
                    }
                  })
                  yield* saveInventory(updated)
                }),
            })
          )
        }),

      swapItems: (playerId, slotA, slotB) =>
        Effect.gen(function* () {
          const first = yield* ensureSlotIndex(slotA)
          const second = yield* ensureSlotIndex(slotB)
          yield* Effect.when(
            () => first === second,
            () => Effect.void
          )
          const inventory = yield* getOrCreateInventory(playerId)
          const updated = updateInventory(inventory, (draft) => {
            const nextSlots = [...draft.slots]
            const temp = nextSlots[first]
            nextSlots[first] = nextSlots[second]
            nextSlots[second] = temp
            return {
              ...draft,
              slots: nextSlots,
            }
          })
          yield* saveInventory(updated)
        }),

      splitStack: (playerId, sourceSlot, targetSlot, amount) =>
        Effect.gen(function* () {
          const sourceIndex = yield* ensureSlotIndex(sourceSlot)
          const targetIndex = yield* ensureSlotIndex(targetSlot)
          yield* Effect.when(
            () => sourceIndex === targetIndex,
            () => Effect.void
          )
          const inventory = yield* getOrCreateInventory(playerId)
          const sourceItem = inventory.slots[sourceIndex]
          const targetItem = inventory.slots[targetIndex]
          return yield* pipe(
            Option.fromNullable(sourceItem),
            Option.match({
              onNone: () =>
                Effect.fail(
                  InventoryServiceError.insufficientQuantity({
                    slotIndex: sourceIndex,
                    requested: amount,
                    available: 0,
                  })
                ),
              onSome: (src) =>
                Effect.gen(function* () {
                  yield* Effect.when(
                    () => amount <= 0 || amount > src.count,
                    () =>
                      Effect.fail(
                        InventoryServiceError.insufficientQuantity({
                          slotIndex: sourceIndex,
                          requested: amount,
                          available: src.count,
                        })
                      )
                  )
                  yield* pipe(
                    Option.fromNullable(targetItem),
                    Option.filter((tgt) => !sameStack(src, tgt)),
                    Option.match({
                      onNone: () => Effect.void,
                      onSome: () =>
                        Effect.fail(
                          InventoryServiceError.splitTargetMustBeCompatible({
                            sourceSlot: sourceIndex,
                            targetSlot: targetIndex,
                          })
                        ),
                    })
                  )
                  const definition = yield* itemRegistry.ensureDefinition(src.itemId)
                  const updated = updateInventory(inventory, (draft) => {
                    const nextSlots = [...draft.slots]
                    const remaining = src.count - amount
                    const existingTargetCount = targetItem?.count ?? 0
                    const desiredTargetCount = existingTargetCount + amount
                    pipe(
                      Effect.when(
                        () => desiredTargetCount > definition.maxStackSize,
                        () =>
                          Effect.fail(
                            InventoryServiceError.splitTargetMustBeCompatible({
                              sourceSlot: sourceIndex,
                              targetSlot: targetIndex,
                            })
                          )
                      ),
                      Effect.runSync
                    )
                    nextSlots[sourceIndex] = remaining > 0 ? { ...src, count: remaining } : null
                    nextSlots[targetIndex] = {
                      itemId: src.itemId,
                      count: desiredTargetCount,
                      metadata: src.metadata ? { ...src.metadata } : undefined,
                    }
                    return {
                      ...draft,
                      slots: nextSlots,
                    }
                  })
                  yield* saveInventory(updated)
                }),
            })
          )
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              typeof error === 'object' &&
                error !== null &&
                '_tag' in error &&
                (error as { _tag: string })._tag === 'SplitTargetMustBeCompatible'
                ? (error as InventoryServiceError)
                : InventoryServiceError.splitTargetMustBeCompatible({
                    sourceSlot,
                    targetSlot,
                  })
            )
          )
        ),

      mergeStacks: (playerId, sourceSlot, targetSlot) =>
        Effect.gen(function* () {
          const sourceIndex = yield* ensureSlotIndex(sourceSlot)
          const targetIndex = yield* ensureSlotIndex(targetSlot)
          yield* Effect.when(
            () => sourceIndex === targetIndex,
            () => Effect.void
          )
          const inventory = yield* getOrCreateInventory(playerId)
          const sourceItem = inventory.slots[sourceIndex]
          const targetItem = inventory.slots[targetIndex]
          return yield* pipe(
            Option.all([Option.fromNullable(sourceItem), Option.fromNullable(targetItem)]),
            Option.match({
              onNone: () => Effect.void,
              onSome: ([src, tgt]) =>
                Effect.gen(function* () {
                  yield* Effect.when(
                    () => !sameStack(src, tgt),
                    () =>
                      Effect.fail(
                        InventoryServiceError.differentItemKind({
                          sourceSlot: sourceIndex,
                          targetSlot: targetIndex,
                        })
                      )
                  )
                  const definition = yield* itemRegistry.ensureDefinition(src.itemId)
                  yield* Effect.when(
                    () => !definition.stackable,
                    () => Effect.void
                  )
                  const total = src.count + tgt.count
                  const toTarget = Math.min(definition.maxStackSize, total)
                  const remainder = total - toTarget
                  const updated = updateInventory(inventory, (draft) => {
                    const nextSlots = [...draft.slots]
                    nextSlots[targetIndex] = {
                      ...tgt,
                      count: toTarget,
                    }
                    nextSlots[sourceIndex] = remainder > 0 ? { ...src, count: remainder } : null
                    return {
                      ...draft,
                      slots: nextSlots,
                    }
                  })
                  yield* saveInventory(updated)
                }),
            })
          )
        }),

      setSelectedSlot: (playerId, hotbarIndex) =>
        Effect.gen(function* () {
          const index = yield* ensureHotbarIndex(hotbarIndex)
          const inventory = yield* getOrCreateInventory(playerId)
          const updated = updateInventory(inventory, (draft) => ({
            ...draft,
            selectedSlot: index,
          }))
          yield* saveInventory(updated)
        }),

      getSelectedItem: (playerId) =>
        withInventory(playerId, (inventory) => {
          const slotIndex = inventory.hotbar[inventory.selectedSlot]
          const item = inventory.slots[slotIndex]
          return pipe(
            Option.fromNullable(item),
            Option.match({
              onNone: () => Effect.succeed(null),
              onSome: (i) => Effect.succeed(cloneItem(i)),
            }),
            Effect.flatten
          )
        }),

      getHotbarItem: (playerId, hotbarIndex) =>
        Effect.gen(function* () {
          const index = yield* ensureHotbarIndex(hotbarIndex)
          const inventory = yield* getOrCreateInventory(playerId)
          const slotIndex = inventory.hotbar[index]
          const item = inventory.slots[slotIndex]
          return pipe(
            Option.fromNullable(item),
            Option.match({
              onNone: () => null,
              onSome: (i) => cloneItem(i),
            })
          )
        }),

      transferToHotbar: (playerId, slotIndex, hotbarIndex) =>
        Effect.gen(function* () {
          const slot = yield* ensureSlotIndex(slotIndex)
          const index = yield* ensureHotbarIndex(hotbarIndex)
          const inventory = yield* getOrCreateInventory(playerId)
          const updated = updateInventory(inventory, (draft) => {
            const nextHotbar = [...draft.hotbar]
            nextHotbar[index] = slot
            return {
              ...draft,
              hotbar: nextHotbar,
            }
          })
          yield* saveInventory(updated)
        }),

      equipArmor: (playerId, slot, item) =>
        withInventory(playerId, (inventory) =>
          Effect.gen(function* () {
            const previous = inventory.armor[slot]
            const updated = updateInventory(inventory, (draft) => ({
              ...draft,
              armor: {
                ...draft.armor,
                [slot]: item ? cloneItem(item) : null,
              },
            }))
            yield* saveInventory(updated)
            return pipe(
              Option.fromNullable(previous),
              Option.match({
                onNone: () => null,
                onSome: (p) => cloneItem(p),
              })
            )
          })
        ),

      getArmor: (playerId, slot) =>
        withInventory(playerId, (inventory) =>
          pipe(
            Option.fromNullable(inventory.armor[slot]),
            Option.match({
              onNone: () => Effect.succeed(null),
              onSome: (armor) => Effect.succeed(cloneItem(armor)),
            }),
            Effect.flatten
          )
        ),

      setOffhandItem: (playerId, item) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const updated = updateInventory(inventory, (draft) => ({
            ...draft,
            offhand: item ? cloneItem(item) : null,
          }))
          yield* saveInventory(updated)
        }),

      getOffhandItem: (playerId) =>
        withInventory(playerId, (inventory) =>
          pipe(
            Option.fromNullable(inventory.offhand),
            Option.match({
              onNone: () => Effect.succeed(null),
              onSome: (oh) => Effect.succeed(cloneItem(oh)),
            }),
            Effect.flatten
          )
        ),

      getEmptySlotCount: (playerId) =>
        withInventory(playerId, (inventory) =>
          pipe(
            inventory.slots,
            ReadonlyArray.reduce(0, (count, slot) =>
              pipe(
                Option.fromNullable(slot),
                Option.match({
                  onNone: () => count + 1,
                  onSome: () => count,
                })
              )
            ),
            Effect.succeed
          )
        ),

      getUsedSlotCount: (playerId) =>
        withInventory(playerId, (inventory) =>
          pipe(
            inventory.slots,
            ReadonlyArray.reduce(0, (count, slot) =>
              pipe(
                Option.fromNullable(slot),
                Option.match({
                  onNone: () => count,
                  onSome: () => count + 1,
                })
              )
            ),
            Effect.succeed
          )
        ),

      findItemSlots: (playerId, itemIdInput) =>
        withInventory(playerId, (inventory) => {
          const itemId = normalizeItemId(itemIdInput)
          const indices = pipe(
            inventory.slots,
            ReadonlyArray.filterMapWithIndex((i, item) =>
              pipe(
                Option.fromNullable(item),
                Option.filter((it) => it.itemId === itemId),
                Option.map(() => i)
              )
            )
          )
          return Effect.succeed(indices)
        }),

      countItem: (playerId, itemIdInput) =>
        withInventory(playerId, (inventory) => {
          const itemId = normalizeItemId(itemIdInput)
          return pipe(
            inventory.slots,
            ReadonlyArray.reduce(0, (amount, slot) =>
              pipe(
                Option.fromNullable(slot),
                Option.filter((s) => s.itemId === itemId),
                Option.match({
                  onNone: () => amount,
                  onSome: (s) => amount + s.count,
                })
              )
            ),
            Effect.succeed
          )
        }),

      hasSpaceForItem: (playerId, item) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const definition = yield* itemRegistry.ensureDefinition(item.itemId)
          const existingSpace = pipe(
            inventory.slots,
            ReadonlyArray.reduce(0, (space, slot) =>
              pipe(
                Option.fromNullable(slot),
                Option.filter((s) => sameStack(s, item) && definition.stackable),
                Option.match({
                  onNone: () => space,
                  onSome: (s) => space + Math.max(0, definition.maxStackSize - s.count),
                })
              )
            )
          )
          return pipe(
            Effect.if(existingSpace >= item.count, {
              onTrue: () => Effect.succeed(true),
              onFalse: () =>
                Effect.succeed(
                  pipe(
                    inventory.slots,
                    ReadonlyArray.some((slot) => slot === null)
                  )
                ),
            }),
            Effect.flatten
          )
        }),

      sortInventory: (playerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const items = inventory.slots.filter((slot): slot is ItemStack => slot !== null)
          const sorted = [...items].sort((a, b) =>
            a.itemId === b.itemId ? b.count - a.count : a.itemId.localeCompare(b.itemId)
          )
          const reordered: Array<ItemStack | null> = [
            ...sorted.map(cloneItem),
            ...Array.from({ length: SLOT_COUNT - sorted.length }, () => null as ItemStack | null),
          ]
          const updated = updateInventory(inventory, (draft) => ({
            ...draft,
            slots: reordered,
          }))
          yield* saveInventory(updated)
        }),

      compactInventory: (playerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const items = inventory.slots.filter((slot): slot is ItemStack => slot !== null)
          const compacted: Array<ItemStack | null> = [
            ...items.map(cloneItem),
            ...Array.from({ length: SLOT_COUNT - items.length }, () => null as ItemStack | null),
          ]
          const updated = updateInventory(inventory, (draft) => ({
            ...draft,
            slots: compacted,
          }))
          yield* saveInventory(updated)
        }),

      dropItem: (playerId, slotIndex, amount) => service.removeItem(playerId, slotIndex, amount),

      dropAllItems: (playerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const slotItems = inventory.slots.filter((slot): slot is ItemStack => slot !== null).map(cloneItem)
          const armorItems = ['helmet', 'chestplate', 'leggings', 'boots'] as const
          const equipped = armorItems
            .map((slot) => inventory.armor[slot])
            .filter((item): item is ItemStack => item !== null)
            .map(cloneItem)
          const offhand = inventory.offhand ? [cloneItem(inventory.offhand)] : []
          const dropped = [...slotItems, ...equipped, ...offhand]
          const cleared = updateInventory(inventory, (draft) => ({
            ...draft,
            slots: Array.from({ length: SLOT_COUNT }, () => null as ItemStack | null),
            armor: {
              helmet: null,
              chestplate: null,
              leggings: null,
              boots: null,
            },
            offhand: null,
          }))
          yield* saveInventory(cleared)
          return dropped
        }),

      clearInventory: (playerId) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const cleared = updateInventory(inventory, (draft) => ({
            ...draft,
            slots: Array.from({ length: SLOT_COUNT }, () => null as ItemStack | null),
            armor: {
              helmet: null,
              chestplate: null,
              leggings: null,
              boots: null,
            },
            offhand: null,
          }))
          yield* saveInventory(cleared)
        }),
    }

    return service
  })
)
