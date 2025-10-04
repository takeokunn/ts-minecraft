import { Effect, Layer, Ref, pipe } from 'effect'
import {
  InventoryService,
  InventoryServiceError,
  type AddItemResult,
} from '@mc/bc-inventory/domain/inventory-service'
import {
  Inventory,
  InventoryState,
  InventoryStateSchema,
  ItemId,
  ItemIdSchema,
  ItemStack,
  PlayerId,
  computeChecksum,
  createEmptyInventory,
  touchInventory,
} from '@mc/bc-inventory/domain/inventory-types'
import { ItemRegistry, ItemRegistryError, type ItemDefinition } from '@mc/bc-inventory/domain/item-registry'
import { Schema } from '@effect/schema'

const SLOT_COUNT = 36
const HOTBAR_SIZE = 9

const normalizeItemId = (itemId: ItemId | string): ItemId =>
  typeof itemId === 'string' ? Schema.decodeUnknownSync(ItemIdSchema)(itemId) : itemId

const sameStack = (left: ItemStack, right: ItemStack): boolean =>
  left.itemId === right.itemId &&
  JSON.stringify(left.metadata ?? null) === JSON.stringify(right.metadata ?? null)

const ensureSlotIndex = (slotIndex: number) =>
  Effect.try({
    try: () => {
      if (Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < SLOT_COUNT) {
        return slotIndex
      }
      throw new Error('invalid slot index')
    },
    catch: () => InventoryServiceError.invalidSlotIndex(slotIndex),
  })

const ensureHotbarIndex = (index: number) =>
  Effect.try({
    try: () => {
      if (Number.isInteger(index) && index >= 0 && index < HOTBAR_SIZE) {
        return index
      }
      throw new Error('invalid hotbar index')
    },
    catch: () => InventoryServiceError.invalidHotbarIndex(index),
  })

const cloneItem = (item: ItemStack): ItemStack => ({
  itemId: item.itemId,
  count: item.count,
  metadata: item.metadata ? { ...item.metadata } : undefined,
})

const updateInventory = (
  inventory: Inventory,
  mutate: (draft: Inventory) => Inventory
): Inventory => {
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
        if (existing) {
          return [existing, state] as const
        }
        const created = createEmptyInventory(playerId)
        const next = new Map(state)
        next.set(playerId, created)
        return [created, next] as const
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
    ): Effect.Effect<R, E> =>
      Effect.flatMap(getOrCreateInventory(playerId), f)

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
        if (!current) return
        if (!sameStack(current, item) || !definition.stackable) return
        if (current.count >= definition.maxStackSize) return
        const capacity = definition.maxStackSize - current.count
        const toAdd = Math.min(capacity, remaining)
        slots[index] = {
          ...current,
          count: current.count + toAdd,
        }
        remaining -= toAdd
        added += toAdd
        touched.add(index)
      }

      for (let index = 0; index < SLOT_COUNT && remaining > 0; index += 1) {
        tryStack(index)
      }

      for (let index = 0; index < SLOT_COUNT && remaining > 0; index += 1) {
        if (slots[index] === null) {
          const toPlace = definition.stackable ? Math.min(definition.maxStackSize, remaining) : 1
          slots[index] = {
            itemId: item.itemId,
            count: toPlace,
            metadata: item.metadata ? { ...item.metadata } : undefined,
          }
          remaining -= toPlace
          added += toPlace
          touched.add(index)
        }
      }

      const result: AddItemResult = added === 0
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
          Effect.succeed<InventoryState>({
            inventory,
            persistedAt: Date.now(),
          })
        ),

      loadInventoryState: (state) =>
        pipe(
          Schema.decodeUnknown(InventoryStateSchema)(state),
          Effect.mapError((error) => InventoryServiceError.inventoryStateValidationFailed(error)),
          Effect.tap(({ inventory }) => saveInventory({
            ...inventory,
            metadata: {
              lastUpdated: Date.now(),
              checksum: computeChecksum(inventory),
            },
          }))
        ),

      addItem: (playerId, item) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const definition = yield* itemRegistry.ensureDefinition(item.itemId)
          const slots = [...inventory.slots]
          const { snapshot, result } = buildAddResult(inventory, slots, definition, item)
          if (result._tag !== 'full') {
            yield* saveInventory(snapshot)
          }
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
          return item ? cloneItem(item) : null
        }),

      removeItem: (playerId, slotIndex, amount) =>
        Effect.gen(function* () {
          const index = yield* ensureSlotIndex(slotIndex)
          const inventory = yield* getOrCreateInventory(playerId)
          const current = inventory.slots[index]
          if (!current) {
            return null
          }
          const quantity = amount ?? current.count
          if (quantity > current.count) {
            return yield* Effect.fail(
              InventoryServiceError.insufficientQuantity({
                slotIndex: index,
                requested: quantity,
                available: current.count,
              })
            )
          }
          const updated = updateInventory(inventory, (draft) => {
            const nextSlots = [...draft.slots]
            if (quantity === current.count) {
              nextSlots[index] = null
            } else {
              nextSlots[index] = {
                ...current,
                count: current.count - quantity,
              }
            }
            return {
              ...draft,
              slots: nextSlots,
            }
          })
          yield* saveInventory(updated)
          return {
            itemId: current.itemId,
            count: quantity,
            metadata: current.metadata ? { ...current.metadata } : undefined,
          }
        }),

      moveItem: (playerId, fromSlot, toSlot, amount) =>
        Effect.gen(function* () {
          const fromIndex = yield* ensureSlotIndex(fromSlot)
          const toIndex = yield* ensureSlotIndex(toSlot)
          const inventory = yield* getOrCreateInventory(playerId)
          if (fromIndex === toIndex) {
            return
          }
          const source = inventory.slots[fromIndex]
          const destination = inventory.slots[toIndex]
          if (!source) {
            return yield* Effect.fail(
              InventoryServiceError.insufficientQuantity({
                slotIndex: fromIndex,
                requested: amount ?? 0,
                available: 0,
              })
            )
          }
          const definition = yield* itemRegistry.ensureDefinition(source.itemId)
          const transferAmount = amount ?? source.count
          if (transferAmount > source.count || transferAmount <= 0) {
            return yield* Effect.fail(
              InventoryServiceError.insufficientQuantity({
                slotIndex: fromIndex,
                requested: transferAmount,
                available: source.count,
              })
            )
          }
          const updated = updateInventory(inventory, (draft) => {
            const nextSlots = [...draft.slots]
            const remaining = source.count - transferAmount
            const movedItem: ItemStack = {
              itemId: source.itemId,
              count: transferAmount,
              metadata: source.metadata ? { ...source.metadata } : undefined,
            }

            if (destination && sameStack(destination, source) && definition.stackable) {
              const total = destination.count + transferAmount
              const toPlace = Math.min(definition.maxStackSize, total)
              const remainder = total - toPlace
              nextSlots[toIndex] = { ...destination, count: toPlace }
              nextSlots[fromIndex] = remainder > 0
                ? { ...source, count: remaining + remainder }
                : remaining > 0
                  ? { ...source, count: remaining }
                  : null
            } else if (destination === null) {
              nextSlots[toIndex] = movedItem
              nextSlots[fromIndex] = remaining > 0 ? { ...source, count: remaining } : null
            } else {
              nextSlots[toIndex] = movedItem
              nextSlots[fromIndex] = destination
            }

            return {
              ...draft,
              slots: nextSlots,
            }
          })
          yield* saveInventory(updated)
        }),

      swapItems: (playerId, slotA, slotB) =>
        Effect.gen(function* () {
          const first = yield* ensureSlotIndex(slotA)
          const second = yield* ensureSlotIndex(slotB)
          if (first === second) {
            return
          }
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
          if (sourceIndex === targetIndex) {
            return
          }
          const inventory = yield* getOrCreateInventory(playerId)
          const sourceItem = inventory.slots[sourceIndex]
          const targetItem = inventory.slots[targetIndex]
          if (!sourceItem) {
            return yield* Effect.fail(
              InventoryServiceError.insufficientQuantity({
                slotIndex: sourceIndex,
                requested: amount,
                available: 0,
              })
            )
          }
          if (amount <= 0 || amount > sourceItem.count) {
            return yield* Effect.fail(
              InventoryServiceError.insufficientQuantity({
                slotIndex: sourceIndex,
                requested: amount,
                available: sourceItem.count,
              })
            )
          }
          if (targetItem && !sameStack(sourceItem, targetItem)) {
            return yield* Effect.fail(
              InventoryServiceError.splitTargetMustBeCompatible({
                sourceSlot: sourceIndex,
                targetSlot: targetIndex,
              })
            )
          }
          const definition = yield* itemRegistry.ensureDefinition(sourceItem.itemId)
          const updated = updateInventory(inventory, (draft) => {
            const nextSlots = [...draft.slots]
            const remaining = sourceItem.count - amount
            const existingTargetCount = targetItem?.count ?? 0
            const desiredTargetCount = existingTargetCount + amount
            if (desiredTargetCount > definition.maxStackSize) {
              throw InventoryServiceError.splitTargetMustBeCompatible({
                sourceSlot: sourceIndex,
                targetSlot: targetIndex,
              })
            }
            nextSlots[sourceIndex] = remaining > 0 ? { ...sourceItem, count: remaining } : null
            nextSlots[targetIndex] = {
              itemId: sourceItem.itemId,
              count: desiredTargetCount,
              metadata: sourceItem.metadata ? { ...sourceItem.metadata } : undefined,
            }
            return {
              ...draft,
              slots: nextSlots,
            }
          })
          yield* saveInventory(updated)
        }).pipe(
          Effect.catchAll((error) =>
            Effect.fail(
              typeof error === 'object' && error !== null && '_tag' in error && (error as { _tag: string })._tag === 'SplitTargetMustBeCompatible'
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
          if (sourceIndex === targetIndex) {
            return
          }
          const inventory = yield* getOrCreateInventory(playerId)
          const sourceItem = inventory.slots[sourceIndex]
          const targetItem = inventory.slots[targetIndex]
          if (!sourceItem || !targetItem) {
            return
          }
          if (!sameStack(sourceItem, targetItem)) {
            return yield* Effect.fail(
              InventoryServiceError.differentItemKind({
                sourceSlot: sourceIndex,
                targetSlot: targetIndex,
              })
            )
          }
          const definition = yield* itemRegistry.ensureDefinition(sourceItem.itemId)
          if (!definition.stackable) {
            return
          }
          const total = sourceItem.count + targetItem.count
          const toTarget = Math.min(definition.maxStackSize, total)
          const remainder = total - toTarget
          const updated = updateInventory(inventory, (draft) => {
            const nextSlots = [...draft.slots]
            nextSlots[targetIndex] = {
              ...targetItem,
              count: toTarget,
            }
            nextSlots[sourceIndex] = remainder > 0 ? { ...sourceItem, count: remainder } : null
            return {
              ...draft,
              slots: nextSlots,
            }
          })
          yield* saveInventory(updated)
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
          return Effect.succeed(item ? cloneItem(item) : null)
        }),

      getHotbarItem: (playerId, hotbarIndex) =>
        Effect.gen(function* () {
          const index = yield* ensureHotbarIndex(hotbarIndex)
          const inventory = yield* getOrCreateInventory(playerId)
          const slotIndex = inventory.hotbar[index]
          const item = inventory.slots[slotIndex]
          return item ? cloneItem(item) : null
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
            return previous ? cloneItem(previous) : null
          })
        ),

      getArmor: (playerId, slot) =>
        withInventory(playerId, (inventory) => Effect.succeed(inventory.armor[slot] ? cloneItem(inventory.armor[slot]!) : null)),

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
        withInventory(playerId, (inventory) => Effect.succeed(inventory.offhand ? cloneItem(inventory.offhand) : null)),

      getEmptySlotCount: (playerId) =>
        withInventory(playerId, (inventory) =>
          Effect.succeed(inventory.slots.reduce((count, slot) => (slot === null ? count + 1 : count), 0))
        ),

      getUsedSlotCount: (playerId) =>
        withInventory(playerId, (inventory) =>
          Effect.succeed(inventory.slots.reduce((count, slot) => (slot !== null ? count + 1 : count), 0))
        ),

      findItemSlots: (playerId, itemIdInput) =>
        withInventory(playerId, (inventory) => {
          const itemId = normalizeItemId(itemIdInput)
          const indices: number[] = []
          for (let i = 0; i < inventory.slots.length; i += 1) {
            const item = inventory.slots[i]
            if (item && item.itemId === itemId) {
              indices.push(i)
            }
          }
          return Effect.succeed(indices)
        }),

      countItem: (playerId, itemIdInput) =>
        withInventory(playerId, (inventory) => {
          const itemId = normalizeItemId(itemIdInput)
          const total = inventory.slots.reduce((amount, slot) => {
            if (slot && slot.itemId === itemId) {
              return amount + slot.count
            }
            return amount
          }, 0)
          return Effect.succeed(total)
        }),

      hasSpaceForItem: (playerId, item) =>
        Effect.gen(function* () {
          const inventory = yield* getOrCreateInventory(playerId)
          const definition = yield* itemRegistry.ensureDefinition(item.itemId)
          const existingSpace = inventory.slots.reduce((space, slot) => {
            if (slot && sameStack(slot, item) && definition.stackable) {
              const available = Math.max(0, definition.maxStackSize - slot.count)
              return space + available
            }
            return space
          }, 0)
          if (existingSpace >= item.count) {
            return true
          }
          return inventory.slots.some((slot) => slot === null)
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

      dropItem: (playerId, slotIndex, amount) =>
        service.removeItem(playerId, slotIndex, amount),

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
