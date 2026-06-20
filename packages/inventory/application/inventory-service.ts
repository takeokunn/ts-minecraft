import { Array as Arr, Effect, Ref, Option } from 'effect'
import { SlotIndex } from '@ts-minecraft/core'
import type { InventoryItem, InventorySaveData } from '@ts-minecraft/core'
import { ItemStack, damageStack } from '../domain/item-stack'
import { InventoryError } from '../domain/errors'
import { INVENTORY_SIZE, HOTBAR_START, HOTBAR_SIZE } from './inventory-service.config'
import type { InventorySlot, InventorySlots } from './inventory-service-types'
import {
  deserializeInventorySlots,
  moveStackInInventorySlots,
  quickMoveInventorySlots,
  removeBlocksFromInventory,
  tryAddBlocksToInventory,
  repairMendingInventorySlotsWithXP,
  serializeInventorySlots,
} from './inventory-service-state'

export { INVENTORY_SIZE, HOTBAR_START, HOTBAR_SIZE }
export type { InventorySlot, InventorySlots } from './inventory-service-types'

export class InventoryService extends Effect.Service<InventoryService>()(
  '@minecraft/application/InventoryService',
  {
    effect: Effect.gen(function* () {
      const slotsRef = yield* Ref.make<InventorySlots>(Arr.makeBy(INVENTORY_SIZE, () => Option.none()))
      return {
        getSlot: (index: SlotIndex): Effect.Effect<InventorySlot, never> =>
          Effect.gen(function* () {
            const slots = yield* Ref.get(slotsRef)
            return Option.getOrElse(Arr.get(slots, SlotIndex.toNumber(index)), () => Option.none<ItemStack>())
          }),

        setSlot: (index: SlotIndex, stack: InventorySlot): Effect.Effect<void, never> =>
          Ref.update(slotsRef, Arr.modify(SlotIndex.toNumber(index), () => stack)),

        // Applies `amount` durability damage to the held tool at `index`. A non-durable
        // item is unaffected; a tool reduced to 0 durability breaks and its slot is cleared.
        damageSlot: (index: SlotIndex, amount = 1): Effect.Effect<void, never> =>
          Ref.update(slotsRef, (slots) => {
            const i = SlotIndex.toNumber(index)
            const slot = Option.getOrElse(Arr.get(slots, i), () => Option.none<ItemStack>())
            const stack = Option.getOrNull(slot)
            return stack === null ? slots : Arr.modify(slots, i, () => damageStack(stack, amount))
          }),

        repairMendingItemsWithXP: (amount: number): Effect.Effect<number, never> =>
          Ref.modify(slotsRef, (slots) => repairMendingInventorySlotsWithXP(slots, amount)),

        moveStack: (from: SlotIndex, to: SlotIndex): Effect.Effect<void, never> =>
          Ref.update(slotsRef, (slots) => moveStackInInventorySlots(slots, from, to)),

        // Vanilla shift-click quick-move: transfer the whole stack at `from` to the OTHER
        // region (main 0..HOTBAR_START <-> hotbar HOTBAR_START..INVENTORY_SIZE), merging into
        // existing same-type stacks first then empty slots. A partial fit leaves the
        // remainder in the source slot; a full target region is a no-op.
        quickMove: (from: SlotIndex): Effect.Effect<void, never> =>
          Ref.update(slotsRef, (slots) => quickMoveInventorySlots(slots, from)),

        addBlock: (itemType: InventoryItem, count: number): Effect.Effect<void, InventoryError> =>
          Effect.gen(function* () {
            const succeeded = yield* Ref.modify(slotsRef, (slots) => {
              return tryAddBlocksToInventory(slots, itemType, count)
            })
            if (!succeeded) yield* Effect.fail(new InventoryError({ operation: 'addBlock', cause: `No space for ${count}x ${itemType}` }))
          }),

        removeBlock: (itemType: InventoryItem, count: number, preferredSlot?: SlotIndex): Effect.Effect<void, InventoryError> =>
          Effect.gen(function* () {
            const succeeded = yield* Ref.modify(slotsRef, (slots) => {
              const [ok, nextSlots] = removeBlocksFromInventory(slots, itemType, count, preferredSlot)
              return [ok, nextSlots] as const
            })
            if (!succeeded) yield* Effect.fail(new InventoryError({ operation: 'removeBlock', cause: `Insufficient ${itemType}: need ${count}` }))
          }),

        getHotbarSlots: (): Effect.Effect<ReadonlyArray<InventorySlot>, never> =>
          Effect.gen(function* () {
            const slots = yield* Ref.get(slotsRef)
            return Arr.take(Arr.drop(slots, HOTBAR_START), HOTBAR_SIZE)
          }),

        getAllSlots: (): Effect.Effect<InventorySlots, never> =>
          Ref.get(slotsRef),

        serialize: (): Effect.Effect<InventorySaveData, never> =>
          Effect.map(Ref.get(slotsRef), serializeInventorySlots),

        // Clears slots after callers have applied any required world-drop semantics.
        clear: (): Effect.Effect<void, never> =>
          Ref.set(slotsRef, Arr.makeBy(INVENTORY_SIZE, () => Option.none<ItemStack>())),

        // REPLACE (not merge) the entire inventory with the saved snapshot: start from
        // a fresh empty array so slots absent from the snapshot are CLEARED. A merge
        // (folding onto the live slots) would leave stale items behind — which both
        // corrupts a load-into-dirty-inventory and lets dismantleFurnace's rollback
        // leak the items it had already deposited (item duplication).
        deserialize: (data: InventorySaveData): Effect.Effect<void, never> =>
          Ref.set(slotsRef, deserializeInventorySlots(data)),
      }
    }),
  }
) {}
