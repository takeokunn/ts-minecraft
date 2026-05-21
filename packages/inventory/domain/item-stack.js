import { Option, Schema } from 'effect';
import { InventoryItemSchema } from '@ts-minecraft/kernel';
export class ItemStack extends Schema.Class('ItemStack')({
    itemType: InventoryItemSchema,
    count: Schema.Number.pipe(Schema.int(), Schema.between(1, 64)),
}) {
}
export const MAX_STACK_SIZE = 64;
// Tool and weapon types that cannot be stacked beyond 1.
// Uses native Set<string> (not HashSet) — pure O(1) static lookup; HashSet structural equality overhead
// is unacceptable for hot-path lookups (intentional exception per performance boundary policy).
const TOOL_BLOCK_TYPES = new Set([
    'WOODEN_SWORD', 'WOODEN_PICKAXE', 'STONE_PICKAXE', 'IRON_PICKAXE', 'DIAMOND_PICKAXE',
]);
export const maxStackFor = (itemType) => TOOL_BLOCK_TYPES.has(itemType) ? 1 : MAX_STACK_SIZE;
export const createStack = (itemType, count = 1) => {
    const max = maxStackFor(itemType);
    return new ItemStack({ itemType, count: Math.max(1, Math.min(max, count)) });
};
export const addToStack = (stack, n) => new ItemStack({ itemType: stack.itemType, count: Math.min(maxStackFor(stack.itemType), stack.count + n) });
// Returns Option.none() when the stack is depleted.
export const removeFromStack = (stack, n) => {
    const newCount = stack.count - n;
    if (newCount <= 0)
        return Option.none();
    return Option.some(new ItemStack({ itemType: stack.itemType, count: newCount }));
};
export const canMerge = (a, b) => a.itemType === b.itemType;
// Returns [updatedA, remainderB]; remainderB is Option.none() when b was fully absorbed.
export const mergeStacks = (a, b) => {
    if (!canMerge(a, b))
        return [a, Option.some(b)];
    const space = maxStackFor(a.itemType) - a.count;
    if (space <= 0)
        return [a, Option.some(b)];
    const transferred = Math.min(space, b.count);
    const newA = new ItemStack({ itemType: a.itemType, count: a.count + transferred });
    const remaining = b.count - transferred;
    const newB = remaining > 0 ? Option.some(new ItemStack({ itemType: b.itemType, count: remaining })) : Option.none();
    return [newA, newB];
};
//# sourceMappingURL=../../../dist/packages/inventory/domain/item-stack.js.map