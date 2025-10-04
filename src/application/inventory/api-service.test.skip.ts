import { describe, expect, it } from '@effect/vitest'
import { Schema } from '@effect/schema'
import * as Arbitrary from 'effect/Arbitrary'
import { Effect, Layer, Option, Ref, pipe } from 'effect'
import { provideLayers } from '../../testing/effect'
import {
  InventoryAPIService,
  InventoryAPIServiceLive,
  snapshotInventoryCommand,
  sortInventoryCommand,
} from './api-service'
import { InventoryService, InventoryServiceError, type AddItemResult } from '../../domain/inventory/InventoryService'
import {
  ItemStackSchema,
  PlayerId,
  Inventory,
  ItemStack,
  createEmptyInventory,
  touchInventory,
} from '../../domain/inventory/InventoryTypes'

const decodeItemStack = Schema.decodeSync(ItemStackSchema)

const slotArraySchema = Schema.Array(Schema.Union(ItemStackSchema, Schema.Null)).pipe(
  Schema.maxItems(36)
)
const slotArrayArb = Arbitrary.make(slotArraySchema)

const buildInventory = (
  playerId: PlayerId,
  slots: ReadonlyArray<ItemStack | null>
): Inventory => {
  const base = createEmptyInventory(playerId)
  const normalizedSlots = Array.from({ length: 36 }, (_, index) =>
    Option.fromNullable(slots[index]).pipe(
      Option.match({
        onNone: () => null,
        onSome: (slot) => slot,
      })
    )
  )
  return touchInventory({
    ...base,
    slots: normalizedSlots,
  })
}

const slotOrderKey = (slot: ItemStack | null): string =>
  Option.fromNullable(slot).pipe(
    Option.match({
      onNone: () => '2:~',
      onSome: (value) => `1:${value.itemId}:${value.count.toString().padStart(3, '0')}`,
    })
  )

const failUnsupported = <A>(): Effect.Effect<A, InventoryServiceError> =>
  Effect.fail(InventoryServiceError.inventoryStateValidationFailed('unsupported in tests'))

const makeInventoryServiceLayer = (inventories: ReadonlyArray<Inventory>): Layer.Layer<InventoryService, never> =>
  Layer.effect(
    InventoryService,
    Effect.gen(function* () {
      const storeRef = yield* Ref.make(new Map<PlayerId, Inventory>(inventories.map((inventory) => [inventory.playerId, inventory])))

      const readInventory = (playerId: PlayerId) =>
        Effect.gen(function* () {
          const store = yield* Ref.get(storeRef)
          return yield* Option.fromNullable(store.get(playerId)).pipe(
            Option.match({
              onSome: Effect.succeed,
              onNone: () => Effect.dieMessage(`inventory not found for ${playerId}`),
            })
          )
        })

      const mutateInventory = (
        playerId: PlayerId,
        mutate: (inventory: Inventory) => Inventory
      ) =>
        Effect.gen(function* () {
          const current = yield* readInventory(playerId)
          const next = mutate(current)
          yield* Ref.update(storeRef, (store) => {
            const updated = new Map(store)
            updated.set(playerId, next)
            return updated
          })
          return next
        })

      const service: InventoryService = {
        createInventory: (playerId) =>
          mutateInventory(playerId, () => touchInventory(createEmptyInventory(playerId))),
        getInventory: readInventory,
        getInventoryState: (playerId) =>
          readInventory(playerId).pipe(
            Effect.map((inventory) => ({ inventory, persistedAt: Date.now() }))
          ),
        loadInventoryState: () => failUnsupported<void>(),
        addItem: () => failUnsupported<AddItemResult>(),
        setSlotItem: () => failUnsupported<void>(),
        getSlotItem: () => failUnsupported<ItemStack | null>(),
        removeItem: () => failUnsupported<ItemStack | null>(),
        moveItem: () => failUnsupported(),
        swapItems: () => failUnsupported(),
        splitStack: () => failUnsupported(),
        mergeStacks: () => failUnsupported<void>(),
        setSelectedSlot: () => failUnsupported<void>(),
        getSelectedItem: () => failUnsupported<ItemStack | null>(),
        getHotbarItem: () => failUnsupported<ItemStack | null>(),
        transferToHotbar: () => failUnsupported<void>(),
        equipArmor: () => failUnsupported<ItemStack | null>(),
        getArmor: () => failUnsupported<ItemStack | null>(),
        setOffhandItem: () => failUnsupported<void>(),
        getOffhandItem: () => failUnsupported<ItemStack | null>(),
        getEmptySlotCount: () => failUnsupported<number>(),
        getUsedSlotCount: () => failUnsupported<number>(),
        findItemSlots: () => failUnsupported<ReadonlyArray<number>>(),
        countItem: () => failUnsupported<number>(),
        hasSpaceForItem: () => failUnsupported<boolean>(),
        sortInventory: (playerId) =>
          mutateInventory(playerId, (inventory) =>
            touchInventory({
              ...inventory,
              slots: [...inventory.slots].sort((left, right) =>
                slotOrderKey(left).localeCompare(slotOrderKey(right))
              ),
            })
          ).pipe(Effect.asVoid),
        compactInventory: () => failUnsupported<void>(),
        dropItem: () => failUnsupported<ItemStack | null>(),
        dropAllItems: () => failUnsupported<ReadonlyArray<ItemStack>>(),
        clearInventory: () => failUnsupported<void>(),
      }

      return service
    })
  )

describe('InventoryAPIService', () => {
  const player = PlayerId('player-live')

  const populatedInventory = buildInventory(player, [
    decodeItemStack({ itemId: 'minecraft:diamond', count: 2 }),
    decodeItemStack({ itemId: 'minecraft:apple', count: 5 }),
    null,
    decodeItemStack({ itemId: 'minecraft:arrow', count: 64 }),
  ])

  const baseLayer = Layer.merge(makeInventoryServiceLayer([populatedInventory]), InventoryAPIServiceLive)

  it.effect('sortInventory reorders slots lexicographically', () =>
    provideLayers(
      Effect.gen(function* () {
        const api = yield* InventoryAPIService
        yield* api.execute(sortInventoryCommand(player))
        const service = yield* InventoryService
        const sortedInventory = yield* service.getInventory(player)
        const slotKeys = sortedInventory.slots.map((slot) => slotOrderKey(slot))
        const expected = [...slotKeys].sort((left, right) => left.localeCompare(right))
        expect(slotKeys).toEqual(expected)
        expect(sortedInventory.slots.filter((slot) => slot !== null).length).toBe(3)
      }),
      baseLayer
    )
  )

  it.prop('snapshot stats match slot occupancy', [slotArrayArb], (generatedSlots) =>
    Effect.gen(function* () {
      const inventory = buildInventory(player, generatedSlots)
      const layer = Layer.merge(makeInventoryServiceLayer([inventory]), InventoryAPIServiceLive)
      const snapshot = yield* provideLayers(
        Effect.gen(function* () {
          const api = yield* InventoryAPIService
          return yield* api.execute(snapshotInventoryCommand(player))
        }),
        layer
      )

      const expectedUsed = inventory.slots.reduce(
        (count, slot) =>
          Option.fromNullable(slot).pipe(
            Option.match({ onNone: () => count, onSome: () => count + 1 })
          ),
        0
      )
      const expectedEmpty = inventory.slots.length - expectedUsed
      expect(snapshot.stats.usedSlots).toBe(expectedUsed)
      expect(snapshot.stats.emptySlots).toBe(expectedEmpty)
      expect(snapshot.stats.totalSlots).toBe(inventory.slots.length)
    })
  )
})
