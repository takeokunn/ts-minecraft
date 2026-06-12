import { Array as Arr, Effect, Ref, Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/core'
import type { InventorySaveData } from '@ts-minecraft/core'
import { ItemStack, mergeStacks, canMerge, removeFromStack, maxStackFor, damageStack } from '../domain/item-stack'
import { SlotIndex } from '@ts-minecraft/core'
import { InventoryError } from '../domain/errors'
import { INVENTORY_SIZE, HOTBAR_START, HOTBAR_SIZE } from './inventory-service.config'
import { fillExistingStacks, fillEmptySlots, drainPreferredSlot } from './inventory-service.helpers'

export type InventorySlot = Option.Option<ItemStack>
export type InventorySlots = ReadonlyArray<InventorySlot>

export { INVENTORY_SIZE, HOTBAR_START, HOTBAR_SIZE }

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

        moveStack: (from: SlotIndex, to: SlotIndex): Effect.Effect<void, never> =>
          Ref.update(slotsRef, (slots) => {
            const fromIdx = SlotIndex.toNumber(from)
            const toIdx = SlotIndex.toNumber(to)

            if (from === to) return slots

            const fromSlot = Option.getOrElse(Arr.get(slots, fromIdx), () => Option.none<ItemStack>())
            const toSlot = Option.getOrElse(Arr.get(slots, toIdx), () => Option.none<ItemStack>())

            const fromStack = Option.getOrNull(fromSlot)
            if (fromStack === null) return slots
            const toStack = Option.getOrNull(toSlot)
            let newFromSlot: InventorySlot
            let newToSlot: InventorySlot
            if (toStack === null) {
              newFromSlot = Option.none()
              newToSlot = Option.some(fromStack)
            } else if (canMerge(fromStack, toStack)) {
              // Merge stacks
              const [merged, remainder] = mergeStacks(toStack, fromStack)
              newFromSlot = remainder
              newToSlot = Option.some(merged)
            } else {
              // Swap
              newFromSlot = toSlot
              newToSlot = fromSlot
            }
            const withFrom = Arr.modify(slots, fromIdx, () => newFromSlot)
            return Arr.modify(withFrom, toIdx, () => newToSlot)
          }),

        // Vanilla shift-click quick-move: transfer the whole stack at `from` to the OTHER
        // region (main 0..HOTBAR_START <-> hotbar HOTBAR_START..INVENTORY_SIZE), merging into
        // existing same-type stacks first then empty slots. A partial fit leaves the
        // remainder in the source slot; a full target region is a no-op.
        quickMove: (from: SlotIndex): Effect.Effect<void, never> =>
          Ref.update(slotsRef, (slots) => {
            const fromIdx = SlotIndex.toNumber(from)
            const source = Option.getOrNull(
              Option.getOrElse(Arr.get(slots, fromIdx), () => Option.none<ItemStack>()),
            )
            if (source === null) return slots
            const { itemType, count } = source
            const maxStack = maxStackFor(itemType)

            // Target region = the region the source slot is NOT in.
            const inHotbar = fromIdx >= HOTBAR_START
            const lo = inHotbar ? 0 : HOTBAR_START
            const hi = inHotbar ? HOTBAR_START : INVENTORY_SIZE

            const region = slots.slice(lo, hi)
            const [afterFill, rem1] = fillExistingStacks(region, itemType, count, maxStack)
            const [afterEmpty, rem2] = fillEmptySlots(afterFill, itemType, rem1, maxStack)
            const moved = count - rem2
            if (moved === 0) return slots // target region full → nothing transferred

            // Source slot is outside [lo, hi), so updating it is independent of the region splice.
            const merged: InventorySlots = [...slots.slice(0, lo), ...afterEmpty, ...slots.slice(hi)]
            return Arr.modify(merged, fromIdx, () => removeFromStack(source, moved))
          }),

        addBlock: (itemType: InventoryItem, count: number): Effect.Effect<void, InventoryError> =>
          Effect.gen(function* () {
            const succeeded = yield* Ref.modify(slotsRef, (slots) => {
              const maxStack = maxStackFor(itemType)
              const [afterFill, rem1] = fillExistingStacks(slots, itemType, count, maxStack)
              const [afterEmpty, rem2] = fillEmptySlots(afterFill, itemType, rem1, maxStack)
              const ok = rem2 === 0
              // Atomicity: only write new state if ALL items fit; otherwise roll back to original
              return [ok, ok ? afterEmpty : slots] as const
            })
            if (!succeeded) yield* Effect.fail(new InventoryError({ operation: 'addBlock', cause: `No space for ${count}x ${itemType}` }))
          }),

        removeBlock: (itemType: InventoryItem, count: number, preferredSlot?: SlotIndex): Effect.Effect<void, InventoryError> =>
          Effect.gen(function* () {
            const succeeded = yield* Ref.modify(slotsRef, (slots) => {
              const preferredIdx = Option.map(Option.fromNullable(preferredSlot), SlotIndex.toNumber)

              const takeFrom = (rem: number, stack: ItemStack): readonly [number, InventorySlot] => {
                if (stack.itemType !== itemType) return [rem, Option.some(stack)]
                const take = Math.min(stack.count, rem)
                return [rem - take, removeFromStack(stack, take)]
              }

              // Step 1: drain preferred slot first (if provided)
              const [rem1, slots1] = drainPreferredSlot(slots, itemType, count, preferredIdx)

              // Step 2: drain remaining from all other slots in order
              const preferredIdxNum = Option.getOrElse(preferredIdx, () => -1)
              const [rem2, slots2] = Arr.mapAccum(slots1, rem1, (rem, slot, idx) => {
                if (rem <= 0) return [rem, slot] as const
                if (idx === preferredIdxNum) return [rem, slot] as const
                const stack = Option.getOrNull(slot)
                return stack === null ? [rem, slot] as const : takeFrom(rem, stack)
              })

              const ok = rem2 === 0
              // Atomicity: only write new state if ALL items were removed; otherwise roll back
              return [ok, ok ? slots2 : slots] as const
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
          Effect.gen(function* () {
            const slots = yield* Ref.get(slotsRef)
            return {
              slots: Arr.map(slots, (slot, i) =>
                Option.map(slot, (stack) => ({ slot: SlotIndex.make(i), itemType: stack.itemType, count: stack.count, durability: stack.durability }))
              ),
            }
          }),

        // Used by the death flow in survival mode (FR-1.3): inventory is dropped at the
        // death position. Phase-1 semantics treat "drop" as "clear" — Phase-3 will
        // materialize world-entity drops.
        clear: (): Effect.Effect<void, never> =>
          Ref.set(slotsRef, Arr.makeBy(INVENTORY_SIZE, () => Option.none<ItemStack>())),

        // REPLACE (not merge) the entire inventory with the saved snapshot: start from
        // a fresh empty array so slots absent from the snapshot are CLEARED. A merge
        // (folding onto the live slots) would leave stale items behind — which both
        // corrupts a load-into-dirty-inventory and lets dismantleFurnace's rollback
        // leak the items it had already deposited (item duplication).
        deserialize: (data: InventorySaveData): Effect.Effect<void, never> =>
          Ref.set(slotsRef,
            Arr.reduce(data.slots, Arr.makeBy(INVENTORY_SIZE, () => Option.none<ItemStack>()), (acc, entry) => {
              const e = Option.getOrNull(entry)
              if (e === null) return acc
              const i = SlotIndex.toNumber(e.slot)
              // Restore saved durability (if any) rather than resetting tools to full.
              const stack = new ItemStack({ itemType: e.itemType, count: e.count, durability: e.durability })
              return i >= 0 && i < INVENTORY_SIZE ? Arr.modify(acc, i, () => Option.some(stack)) : acc
            })
          ),
      }
    }),
  }
) {}

export const InventoryServiceLive = InventoryService.Default
