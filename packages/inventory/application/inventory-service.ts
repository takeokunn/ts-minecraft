import { Array as Arr, Effect, Ref, Option } from 'effect'
import type { InventoryItem } from '@ts-minecraft/kernel'
import type { InventorySaveData } from '@ts-minecraft/kernel'
import { ItemStack, createStack, mergeStacks, canMerge, addToStack, removeFromStack, maxStackFor, damageStack } from '../domain/item-stack'
import { SlotIndex } from '@ts-minecraft/kernel'
import { InventoryError } from '../domain/errors'

export type InventorySlot = Option.Option<ItemStack>
export type InventorySlots = ReadonlyArray<InventorySlot>

export const INVENTORY_SIZE = 36
export const HOTBAR_START = 27
export const HOTBAR_SIZE = 9

// Pure: fills existing partial stacks of the same item type, returns [updatedSlots, remainingCount]
const fillExistingStacks = (
  slots: InventorySlots,
  itemType: InventoryItem,
  count: number,
  maxStack: number,
): readonly [InventorySlots, number] => {
  const [remaining, updated] = Arr.mapAccum(slots, count, (rem, slot) => {
    if (rem <= 0) return [rem, slot] as const
    return Option.match(slot, {
      onNone: () => [rem, slot] as const,
      onSome: (stackVal) => {
        if (stackVal.itemType !== itemType) return [rem, slot] as const
        const space = maxStack - stackVal.count
        if (space <= 0) return [rem, slot] as const
        const add = Math.min(space, rem)
        return [rem - add, Option.some(addToStack(stackVal, add))] as const
      },
    })
  })
  return [updated, remaining]
}

// Pure: fills empty slots with remaining count, returns [updatedSlots, remainingCount]
const fillEmptySlots = (
  slots: InventorySlots,
  itemType: InventoryItem,
  count: number,
  maxStack: number,
): readonly [InventorySlots, number] => {
  const [remaining, updated] = Arr.mapAccum(slots, count, (rem, slot) => {
    if (rem <= 0) return [rem, slot] as const
    return Option.match(slot, {
      onSome: () => [rem, slot] as const,
      onNone: () => {
        const add = Math.min(maxStack, rem)
        return [rem - add, Option.some(createStack(itemType, add))] as const
      },
    })
  })
  return [updated, remaining]
}

export class InventoryService extends Effect.Service<InventoryService>()(
  '@minecraft/application/InventoryService',
  {
    effect: Ref.make<InventorySlots>(Arr.makeBy(INVENTORY_SIZE, () => Option.none())).pipe(
      Effect.map((slotsRef) => ({
        getSlot: (index: SlotIndex): Effect.Effect<InventorySlot, never> =>
          Ref.get(slotsRef).pipe(Effect.map((slots) => Option.getOrElse(Arr.get(slots, SlotIndex.toNumber(index)), () => Option.none<ItemStack>()))),

        setSlot: (index: SlotIndex, stack: InventorySlot): Effect.Effect<void, never> =>
          Ref.update(slotsRef, Arr.modify(SlotIndex.toNumber(index), () => stack)),

        // Applies `amount` durability damage to the held tool at `index`. A non-durable
        // item is unaffected; a tool reduced to 0 durability breaks and its slot is cleared.
        damageSlot: (index: SlotIndex, amount = 1): Effect.Effect<void, never> =>
          Ref.update(slotsRef, (slots) => {
            const i = SlotIndex.toNumber(index)
            const slot = Option.getOrElse(Arr.get(slots, i), () => Option.none<ItemStack>())
            return Option.match(slot, {
              onNone: () => slots,
              onSome: (stack) => Arr.modify(slots, i, () => damageStack(stack, amount)),
            })
          }),

        moveStack: (from: SlotIndex, to: SlotIndex): Effect.Effect<void, never> =>
          Ref.update(slotsRef, (slots) => {
            const fromIdx = SlotIndex.toNumber(from)
            const toIdx = SlotIndex.toNumber(to)

            if (from === to) return slots

            const fromSlot = Option.getOrElse(Arr.get(slots, fromIdx), () => Option.none<ItemStack>())
            const toSlot = Option.getOrElse(Arr.get(slots, toIdx), () => Option.none<ItemStack>())

            return Option.match(fromSlot, {
              onNone: () => slots,
              onSome: (from) => {
                const [newFromSlot, newToSlot] = Option.match(toSlot, {
                  onNone: () => [Option.none<ItemStack>(), Option.some(from)] as const,
                  onSome: (to) => canMerge(from, to)
                    ? (() => {
                        // Merge stacks
                        const [merged, remainder] = mergeStacks(to, from)
                        return [remainder, Option.some(merged)] as const
                      })()
                    // Swap
                    : [toSlot, fromSlot] as const,
                })
                const withFrom = Arr.modify(slots, fromIdx, () => newFromSlot)
                return Arr.modify(withFrom, toIdx, () => newToSlot)
              },
            })
          }),

        addBlock: (itemType: InventoryItem, count: number): Effect.Effect<void, InventoryError> =>
          Ref.modify(slotsRef, (slots) => {
            const maxStack = maxStackFor(itemType)
            const [afterFill, rem1] = fillExistingStacks(slots, itemType, count, maxStack)
            const [afterEmpty, rem2] = fillEmptySlots(afterFill, itemType, rem1, maxStack)
            const succeeded = rem2 === 0
            // Atomicity: only write new state if ALL items fit; otherwise roll back to original
            return [succeeded, succeeded ? afterEmpty : slots] as const
          }).pipe(
            Effect.flatMap((succeeded) =>
              succeeded
                ? Effect.void
                : Effect.fail(new InventoryError({ operation: 'addBlock', cause: `No space for ${count}x ${itemType}` }))
            )
          ),

        removeBlock: (itemType: InventoryItem, count: number, preferredSlot?: SlotIndex): Effect.Effect<void, InventoryError> =>
          Ref.modify(slotsRef, (slots) => {
            const preferredIdx = Option.map(Option.fromNullable(preferredSlot), SlotIndex.toNumber)

            const takeFrom = (rem: number, stack: ItemStack): readonly [number, InventorySlot] => {
              if (stack.itemType !== itemType) return [rem, Option.some(stack)]
              const take = Math.min(stack.count, rem)
              return [rem - take, removeFromStack(stack, take)]
            }

            // Step 1: drain preferred slot first (if provided)
            const [rem1, slots1] = Option.match(preferredIdx, {
              onNone: () => [count, slots] as const,
              onSome: (idx) =>
                Option.match(Option.getOrElse(Arr.get(slots, idx), () => Option.none<ItemStack>()), {
                  onNone: () => [count, slots] as const,
                  onSome: (stack) => {
                    const [newRem, newSlot] = takeFrom(count, stack)
                    return [newRem, Arr.modify(slots, idx, () => newSlot)] as const
                  },
                }),
            })

            // Step 2: drain remaining from all other slots in order
            const preferredIdxNum = Option.getOrElse(preferredIdx, () => -1)
            const [rem2, slots2] = Arr.mapAccum(slots1, rem1, (rem, slot, idx) => {
              if (rem <= 0) return [rem, slot] as const
              if (idx === preferredIdxNum) return [rem, slot] as const
              return Option.match(slot, {
                onNone: () => [rem, slot] as const,
                onSome: (stack) => takeFrom(rem, stack),
              })
            })

            const succeeded = rem2 === 0
            // Atomicity: only write new state if ALL items were removed; otherwise roll back
            return [succeeded, succeeded ? slots2 : slots] as const
          }).pipe(
            Effect.flatMap((succeeded) =>
              succeeded
                ? Effect.void
                : Effect.fail(new InventoryError({ operation: 'removeBlock', cause: `Insufficient ${itemType}: need ${count}` }))
            )
          ),

        getHotbarSlots: (): Effect.Effect<ReadonlyArray<InventorySlot>, never> =>
          Ref.get(slotsRef).pipe(Effect.map((slots) => Arr.take(Arr.drop(slots, HOTBAR_START), HOTBAR_SIZE))),

        getAllSlots: (): Effect.Effect<InventorySlots, never> =>
          Ref.get(slotsRef),

        serialize: (): Effect.Effect<InventorySaveData, never> =>
          Ref.get(slotsRef).pipe(
            Effect.map((slots) => ({
              slots: Arr.map(slots, (slot, i) =>
                Option.map(slot, (stack) => ({ slot: SlotIndex.make(i), itemType: stack.itemType, count: stack.count, durability: stack.durability }))
              ),
            }))
          ),

        // Used by the death flow in survival mode (FR-1.3): inventory is dropped at the
        // death position. Phase-1 semantics treat "drop" as "clear" — Phase-3 will
        // materialize world-entity drops.
        clear: (): Effect.Effect<void, never> =>
          Ref.set(slotsRef, Arr.makeBy(INVENTORY_SIZE, () => Option.none<ItemStack>())),

        deserialize: (data: InventorySaveData): Effect.Effect<void, never> =>
          Ref.update(slotsRef, (slots) =>
            Arr.reduce(data.slots, slots, (acc, entry) =>
              Option.match(entry, {
                onNone: () => acc,
                onSome: (e) => {
                  const i = SlotIndex.toNumber(e.slot)
                  // Restore saved durability (if any) rather than resetting tools to full.
                  const stack = new ItemStack({ itemType: e.itemType, count: e.count, durability: e.durability })
                  return i >= 0 && i < INVENTORY_SIZE
                    ? Arr.modify(acc, i, () => Option.some(stack))
                    : acc
                },
              })
            )
          ),
      }))
    ),
  }
) {}

export const InventoryServiceLive = InventoryService.Default
