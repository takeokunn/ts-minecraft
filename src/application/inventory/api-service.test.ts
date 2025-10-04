import { describe, expect, it } from '@effect/vitest'
import { Context, Effect, Layer, Match, Option, Ref, pipe } from 'effect'
import * as Order from 'effect/Order'
import * as ReadonlyArray from 'effect/Array'
import * as HashSet from 'effect/HashSet'
import * as FastCheck from 'effect/FastCheck'
import { InventoryAPIService, InventoryAPIServiceLive, sortInventoryCommand, snapshotInventoryCommand } from './api-service'
import { InventoryService, InventoryServiceError } from '../../domain/inventory/InventoryService'
import {
  ItemId,
  ItemStack,
  PlayerId,
  createEmptyInventory,
  touchInventory,
} from '../../domain/inventory/InventoryTypes'

type Slots = ReadonlyArray<ItemStack | null>

const trackedPlayer = PlayerId('inventory-test-player')

const unsupported = (method: string): Effect.Effect<never> =>
  Effect.die(`Unsupported InventoryService method: ${method}`)

const ensurePlayer = (playerId: PlayerId): Effect.Effect<void, InventoryServiceError> =>
  Match.value(playerId).pipe(
    Match.when(trackedPlayer, () => Effect.void),
    Match.orElse(() => Effect.fail(InventoryServiceError.invalidSlotIndex(-1)))
  )

const sortSlots = (slots: Slots): Slots => {
  const sortedItems = pipe(
    slots,
    ReadonlyArray.filterMap(Option.fromNullable),
    ReadonlyArray.sort(Order.mapInput(Order.string, (item) => item.itemId))
  )
  const includeNull = (item: ItemStack): ItemStack | null => item
  const itemSlots = ReadonlyArray.map(sortedItems, includeNull)
  const difference = slots.length - sortedItems.length
  const nullSlots = Match.value(difference).pipe(
    Match.when(0, () => ReadonlyArray.empty<Slots[number]>()),
    Match.orElse(() =>
      ReadonlyArray.replicate(null satisfies Slots[number], difference)
    )
  )
  return ReadonlyArray.appendAll(itemSlots, nullSlots)
}

const initialInventory = (() => {
  const base = createEmptyInventory(trackedPlayer)
  const primarySlots: Slots = [
    { itemId: ItemId('minecraft:diamond'), count: 3 },
    null,
    { itemId: ItemId('minecraft:apple'), count: 5 },
    { itemId: ItemId('minecraft:stone'), count: 64 },
  ]
  const remaining = base.slots.slice(primarySlots.length)
  return touchInventory({
    ...base,
    slots: [...primarySlots, ...remaining],
    selectedSlot: 2,
  })
})()

const TestInventoryService = Layer.effect(
  InventoryService,
  Effect.gen(function* () {
    const store = yield* Ref.make(initialInventory)

    const service: InventoryService = {
      createInventory: () => unsupported('createInventory'),
      getInventory: (playerId) => ensurePlayer(playerId).pipe(Effect.zipRight(Ref.get(store))),
      getInventoryState: () => unsupported('getInventoryState'),
      loadInventoryState: () => unsupported('loadInventoryState'),
      addItem: () => unsupported('addItem'),
      setSlotItem: () => unsupported('setSlotItem'),
      getSlotItem: () => unsupported('getSlotItem'),
      removeItem: () => unsupported('removeItem'),
      moveItem: () => unsupported('moveItem'),
      swapItems: () => unsupported('swapItems'),
      splitStack: () => unsupported('splitStack'),
      mergeStacks: () => unsupported('mergeStacks'),
      setSelectedSlot: () => unsupported('setSelectedSlot'),
      getSelectedItem: () => unsupported('getSelectedItem'),
      getHotbarItem: () => unsupported('getHotbarItem'),
      transferToHotbar: () => unsupported('transferToHotbar'),
      equipArmor: () => unsupported('equipArmor'),
      getArmor: () => unsupported('getArmor'),
      setOffhandItem: () => unsupported('setOffhandItem'),
      getOffhandItem: () => unsupported('getOffhandItem'),
      getEmptySlotCount: () => unsupported('getEmptySlotCount'),
      getUsedSlotCount: () => unsupported('getUsedSlotCount'),
      findItemSlots: () => unsupported('findItemSlots'),
      countItem: () => unsupported('countItem'),
      hasSpaceForItem: () => unsupported('hasSpaceForItem'),
      sortInventory: (playerId) =>
        ensurePlayer(playerId).pipe(
          Effect.zipRight(
            Ref.update(store, (inventory) => touchInventory({
              ...inventory,
              slots: sortSlots(inventory.slots),
            }))
          )
        ),
      compactInventory: () => unsupported('compactInventory'),
      dropItem: () => unsupported('dropItem'),
      dropAllItems: () => unsupported('dropAllItems'),
      clearInventory: () => unsupported('clearInventory'),
    }

    return InventoryService.of(service)
  })
)

const ApiLayer = InventoryAPIServiceLive.pipe(Layer.provide(TestInventoryService))

const withApi = <A, E>(
  program: Effect.Effect<A, E, typeof InventoryAPIService>
): Effect.Effect<A, E> =>
  Effect.scoped(
    Layer.build(ApiLayer).pipe(
      Effect.flatMap((context) =>
        program.pipe(
          Effect.provideService(
            InventoryAPIService,
            Context.get(context, InventoryAPIService)
          )
        )
      )
    )
  )

describe('application/inventory/api-service', () => {
  const itemIdArbitrary = FastCheck.stringMatching(/^[a-z]{1,12}$/).map((value) =>
    ItemId(`minecraft:${value}`)
  )
  const itemStackArbitrary = FastCheck.record({
    itemId: itemIdArbitrary,
    count: FastCheck.integer({ min: 1, max: 64 }),
  })

  it('sortSlots orders non-null slots lexicographically (property)', () => {
    FastCheck.assert(
      FastCheck.property(
        FastCheck.array(FastCheck.option(itemStackArbitrary, { nil: null }), {
          minLength: 4,
          maxLength: 36,
        }),
        (slots) => {
          const sorted = sortSlots(slots)
          const remainingNulls = sorted.filter((slot) => slot === null).length
          const originalNulls = slots.filter((slot) => slot === null).length
          expect(remainingNulls).toBe(originalNulls)

          const nonNull = sorted.filter((slot): slot is ItemStack => slot !== null)
          const ids = nonNull.map((stack) => stack.itemId)
          const sortedIds = [...ids].sort((a, b) => a.localeCompare(b))
          expect(ids).toEqual(sortedIds)
        }
      )
    )
  })

  it.effect('creates snapshot without sorting', () =>
    withApi(
      Effect.gen(function* () {
        const api = yield* InventoryAPIService
        const snapshot = yield* api.execute(snapshotInventoryCommand(trackedPlayer))
        expect(snapshot.playerId).toBe(trackedPlayer)
        expect(snapshot.stats.uniqueItems).toBe(3)
        expect(snapshot.uniqueItemIds).toEqual([
          'minecraft:apple',
          'minecraft:diamond',
          'minecraft:stone',
        ])
        expect(HashSet.size(HashSet.fromIterable(snapshot.uniqueItemIds))).toBe(
          snapshot.uniqueItemIds.length
        )
      })
    )
  )

  it.effect('sorts inventory before snapshotting', () =>
    withApi(
      Effect.gen(function* () {
        const api = yield* InventoryAPIService
        const before = yield* api.execute(snapshotInventoryCommand(trackedPlayer))
        const beforeChecksum = before.checksum
        yield* api.execute(sortInventoryCommand(trackedPlayer))
        const after = yield* api.execute(snapshotInventoryCommand(trackedPlayer))
        expect(after.checksum).not.toBe(beforeChecksum)
        expect(after.uniqueItemIds).toEqual(before.uniqueItemIds)
      })
    )
  )
})
