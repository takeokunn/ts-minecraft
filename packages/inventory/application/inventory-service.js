import { Array as Arr, Effect, Ref, Option } from 'effect';
import { createStack, mergeStacks, canMerge, addToStack, removeFromStack, maxStackFor } from '../domain/item-stack';
import { SlotIndex } from '@ts-minecraft/kernel';
import { InventoryError } from '../domain/errors';
export const INVENTORY_SIZE = 36;
export const HOTBAR_START = 27;
export const HOTBAR_SIZE = 9;
// Pure: fills existing partial stacks of the same item type, returns [updatedSlots, remainingCount]
const fillExistingStacks = (slots, itemType, count, maxStack) => {
    const [remaining, updated] = Arr.mapAccum(slots, count, (rem, slot) => {
        if (rem <= 0)
            return [rem, slot];
        return Option.match(slot, {
            onNone: () => [rem, slot],
            onSome: (stackVal) => {
                if (stackVal.itemType !== itemType)
                    return [rem, slot];
                const space = maxStack - stackVal.count;
                if (space <= 0)
                    return [rem, slot];
                const add = Math.min(space, rem);
                return [rem - add, Option.some(addToStack(stackVal, add))];
            },
        });
    });
    return [updated, remaining];
};
// Pure: fills empty slots with remaining count, returns [updatedSlots, remainingCount]
const fillEmptySlots = (slots, itemType, count, maxStack) => {
    const [remaining, updated] = Arr.mapAccum(slots, count, (rem, slot) => {
        if (rem <= 0)
            return [rem, slot];
        return Option.match(slot, {
            onSome: () => [rem, slot],
            onNone: () => {
                const add = Math.min(maxStack, rem);
                return [rem - add, Option.some(createStack(itemType, add))];
            },
        });
    });
    return [updated, remaining];
};
export class InventoryService extends Effect.Service()('@minecraft/application/InventoryService', {
    effect: Ref.make(Arr.makeBy(INVENTORY_SIZE, () => Option.none())).pipe(Effect.map((slotsRef) => ({
        getSlot: (index) => Ref.get(slotsRef).pipe(Effect.map((slots) => Option.getOrElse(Arr.get(slots, SlotIndex.toNumber(index)), () => Option.none()))),
        setSlot: (index, stack) => Ref.update(slotsRef, Arr.modify(SlotIndex.toNumber(index), () => stack)),
        moveStack: (from, to) => Ref.update(slotsRef, (slots) => {
            const fromIdx = SlotIndex.toNumber(from);
            const toIdx = SlotIndex.toNumber(to);
            if (from === to)
                return slots;
            const fromSlot = Option.getOrElse(Arr.get(slots, fromIdx), () => Option.none());
            const toSlot = Option.getOrElse(Arr.get(slots, toIdx), () => Option.none());
            return Option.match(fromSlot, {
                onNone: () => slots,
                onSome: (from) => {
                    const [newFromSlot, newToSlot] = Option.match(toSlot, {
                        onNone: () => [Option.none(), Option.some(from)],
                        onSome: (to) => canMerge(from, to)
                            ? (() => {
                                // Merge stacks
                                const [merged, remainder] = mergeStacks(to, from);
                                return [remainder, Option.some(merged)];
                            })()
                            // Swap
                            : [toSlot, fromSlot],
                    });
                    const withFrom = Arr.modify(slots, fromIdx, () => newFromSlot);
                    return Arr.modify(withFrom, toIdx, () => newToSlot);
                },
            });
        }),
        addBlock: (itemType, count) => Ref.modify(slotsRef, (slots) => {
            const maxStack = maxStackFor(itemType);
            const [afterFill, rem1] = fillExistingStacks(slots, itemType, count, maxStack);
            const [afterEmpty, rem2] = fillEmptySlots(afterFill, itemType, rem1, maxStack);
            const succeeded = rem2 === 0;
            // Atomicity: only write new state if ALL items fit; otherwise roll back to original
            return [succeeded, succeeded ? afterEmpty : slots];
        }).pipe(Effect.flatMap((succeeded) => succeeded
            ? Effect.void
            : Effect.fail(new InventoryError({ operation: 'addBlock', cause: `No space for ${count}x ${itemType}` })))),
        removeBlock: (itemType, count, preferredSlot) => Ref.modify(slotsRef, (slots) => {
            const preferredIdx = Option.map(Option.fromNullable(preferredSlot), SlotIndex.toNumber);
            const takeFrom = (rem, stack) => {
                if (stack.itemType !== itemType)
                    return [rem, Option.some(stack)];
                const take = Math.min(stack.count, rem);
                return [rem - take, removeFromStack(stack, take)];
            };
            // Step 1: drain preferred slot first (if provided)
            const [rem1, slots1] = Option.match(preferredIdx, {
                onNone: () => [count, slots],
                onSome: (idx) => Option.match(Option.getOrElse(Arr.get(slots, idx), () => Option.none()), {
                    onNone: () => [count, slots],
                    onSome: (stack) => {
                        const [newRem, newSlot] = takeFrom(count, stack);
                        return [newRem, Arr.modify(slots, idx, () => newSlot)];
                    },
                }),
            });
            // Step 2: drain remaining from all other slots in order
            const preferredIdxNum = Option.getOrElse(preferredIdx, () => -1);
            const [rem2, slots2] = Arr.mapAccum(slots1, rem1, (rem, slot, idx) => {
                if (rem <= 0)
                    return [rem, slot];
                if (idx === preferredIdxNum)
                    return [rem, slot];
                return Option.match(slot, {
                    onNone: () => [rem, slot],
                    onSome: (stack) => takeFrom(rem, stack),
                });
            });
            const succeeded = rem2 === 0;
            // Atomicity: only write new state if ALL items were removed; otherwise roll back
            return [succeeded, succeeded ? slots2 : slots];
        }).pipe(Effect.flatMap((succeeded) => succeeded
            ? Effect.void
            : Effect.fail(new InventoryError({ operation: 'removeBlock', cause: `Insufficient ${itemType}: need ${count}` })))),
        getHotbarSlots: () => Ref.get(slotsRef).pipe(Effect.map((slots) => Arr.take(Arr.drop(slots, HOTBAR_START), HOTBAR_SIZE))),
        getAllSlots: () => Ref.get(slotsRef),
        serialize: () => Ref.get(slotsRef).pipe(Effect.map((slots) => ({
            slots: Arr.map(slots, (slot, i) => Option.map(slot, (stack) => ({ slot: SlotIndex.make(i), itemType: stack.itemType, count: stack.count }))),
        }))),
        // Used by the death flow in survival mode (FR-1.3): inventory is dropped at the
        // death position. Phase-1 semantics treat "drop" as "clear" — Phase-3 will
        // materialize world-entity drops.
        clear: () => Ref.set(slotsRef, Arr.makeBy(INVENTORY_SIZE, () => Option.none())),
        deserialize: (data) => Ref.update(slotsRef, (slots) => Arr.reduce(data.slots, slots, (acc, entry) => Option.match(entry, {
            onNone: () => acc,
            onSome: (e) => {
                const i = SlotIndex.toNumber(e.slot);
                return i >= 0 && i < INVENTORY_SIZE
                    ? Arr.modify(acc, i, () => Option.some(createStack(e.itemType, e.count)))
                    : acc;
            },
        }))),
    }))),
}) {
}
export const InventoryServiceLive = InventoryService.Default;
//# sourceMappingURL=../../../dist/packages/inventory/application/inventory-service.js.map